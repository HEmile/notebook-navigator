/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const projectRoot = path.resolve(dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const localesDir = path.join(srcDir, 'i18n', 'locales');
const enLocalePath = path.join(localesDir, 'en.ts');

// Normalizes CRLF/CR newlines to LF for consistent parsing.
function normalizeNewlines(input) {
    return input.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

// Removes any trailing `// ...` comment from a line, ignoring comment markers inside quotes.
function stripInlineComment(line) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let escaped = false;

    for (let index = 0; index < line.length; index++) {
        const character = line[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (character === '\\') {
            escaped = true;
            continue;
        }

        if (inSingleQuote) {
            if (character === "'") {
                inSingleQuote = false;
            }
            continue;
        }

        if (inDoubleQuote) {
            if (character === '"') {
                inDoubleQuote = false;
            }
            continue;
        }

        if (inTemplate) {
            if (character === '`') {
                inTemplate = false;
            }
            continue;
        }

        if (character === "'") {
            inSingleQuote = true;
            continue;
        }

        if (character === '"') {
            inDoubleQuote = true;
            continue;
        }

        if (character === '`') {
            inTemplate = true;
            continue;
        }

        if (character === '/' && line[index + 1] === '/') {
            return line.slice(0, index);
        }
    }

    return line;
}

// Extracts dot-delimited leaf key paths from a STRINGS_* export, based on the object literal structure.
function extractLeafKeyPaths(localeSource) {
    const keys = [];
    const lines = normalizeNewlines(localeSource).split('\n');
    const currentPath = [];
    let inExport = false;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!inExport) {
            if (trimmedLine.startsWith('export const STRINGS_')) {
                inExport = true;
            }
            continue;
        }

        const code = stripInlineComment(line).trim();
        if (!code) {
            continue;
        }

        const objectStartMatch = code.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)|(['"])([^'"]+)\2)\s*:\s*\{\s*$/);
        if (objectStartMatch) {
            currentPath.push(objectStartMatch[1] ?? objectStartMatch[3]);
            continue;
        }

        if (/^\}\s*,?\s*;?\s*$/.test(code)) {
            if (currentPath.length > 0) {
                currentPath.pop();
            }
            continue;
        }

        const leafMatch = code.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)|(['"])([^'"]+)\2)\s*:\s*/);
        if (leafMatch) {
            keys.push([...currentPath, leafMatch[1] ?? leafMatch[3]].join('.'));
        }
    }

    return keys;
}

// Collects `.ts` / `.tsx` files under `rootDir`, excluding any directories listed in `excludedDirs`.
async function collectSourceFiles(rootDir, excludedDirs) {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            const shouldExclude = excludedDirs.some(
                excludedDir => fullPath === excludedDir || fullPath.startsWith(`${excludedDir}${path.sep}`)
            );
            if (shouldExclude) {
                continue;
            }

            files.push(...(await collectSourceFiles(fullPath, excludedDirs)));
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        if (entry.name.endsWith('.d.ts')) {
            continue;
        }

        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }

    return files;
}

// Builds matchers for non-`strings.` access like `settings.items.foo` from destructured/aliased objects.
function buildTopLevelMatchers(topLevelKeys) {
    const escapedKeys = topLevelKeys
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(key => key.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (escapedKeys.length === 0) {
        return null;
    }

    const group = `(${escapedKeys.join('|')})`;

    return {
        dotAccessRegex: new RegExp(`\\b${group}\\.([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)`, 'g'),
        bracketLiteralRegex: new RegExp(
            `\\b${group}\\.([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)\\s*\\[\\s*(['\"])([^'\"\\n\\r]+)\\2\\s*\\]`,
            'g'
        ),
        bracketAnyRegex: new RegExp(`\\b${group}\\.([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)\\s*\\[`, 'g')
    };
}

// Resolves `a.b.c.d` to the nearest existing key in the locale map (e.g. `a.b.c`) when deeper access is detected.
function resolveExistingKeyPath(candidatePath, allKeys) {
    let resolved = candidatePath;
    while (resolved) {
        if (allKeys.has(resolved)) {
            return resolved;
        }

        const lastDotIndex = resolved.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return null;
        }

        resolved = resolved.slice(0, lastDotIndex);
    }

    return null;
}

// Finds used leaf keys in a source file by scanning for `strings.<path>` and common destructured access patterns.
function findUsedKeys(sourceText, allKeys, topLevelMatchers) {
    const used = new Set();
    const usedPrefixes = new Set();

    const stringsAccessRegex = /\bstrings\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
    let match = stringsAccessRegex.exec(sourceText);
    while (match) {
        const resolvedPath = resolveExistingKeyPath(match[1], allKeys);
        if (resolvedPath) {
            used.add(resolvedPath);
        }
        match = stringsAccessRegex.exec(sourceText);
    }

    const stringsBracketLiteralRegex = /\bstrings\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\[\s*(['"])([^'"\n\r]+)\2\s*\]/g;
    match = stringsBracketLiteralRegex.exec(sourceText);
    while (match) {
        const candidatePath = `${match[1]}.${match[3]}`;
        if (allKeys.has(candidatePath)) {
            used.add(candidatePath);
        }
        match = stringsBracketLiteralRegex.exec(sourceText);
    }

    const stringsBracketAnyRegex = /\bstrings\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\[/g;
    match = stringsBracketAnyRegex.exec(sourceText);
    while (match) {
        usedPrefixes.add(match[1]);
        match = stringsBracketAnyRegex.exec(sourceText);
    }

    if (topLevelMatchers?.dotAccessRegex) {
        match = topLevelMatchers.dotAccessRegex.exec(sourceText);
        while (match) {
            const resolvedPath = resolveExistingKeyPath(`${match[1]}.${match[2]}`, allKeys);
            if (resolvedPath) {
                used.add(resolvedPath);
            }
            match = topLevelMatchers.dotAccessRegex.exec(sourceText);
        }
    }

    if (topLevelMatchers?.bracketLiteralRegex) {
        match = topLevelMatchers.bracketLiteralRegex.exec(sourceText);
        while (match) {
            const candidatePath = `${match[1]}.${match[2]}.${match[4]}`;
            if (allKeys.has(candidatePath)) {
                used.add(candidatePath);
            }
            match = topLevelMatchers.bracketLiteralRegex.exec(sourceText);
        }
    }

    if (topLevelMatchers?.bracketAnyRegex) {
        match = topLevelMatchers.bracketAnyRegex.exec(sourceText);
        while (match) {
            usedPrefixes.add(`${match[1]}.${match[2]}`);
            match = topLevelMatchers.bracketAnyRegex.exec(sourceText);
        }
    }

    return { usedKeys: used, usedPrefixes };
}

// Prompts for a yes/no confirmation on stdin.
async function promptYesNo(question) {
    const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await reader.question(question);
        return /^y(es)?$/i.test(answer.trim());
    } finally {
        reader.close();
    }
}

// Groups dot-delimited key paths by their top-level prefix (e.g. `settings.*`).
function groupByTopLevelKey(keyPaths) {
    const groups = new Map();
    for (const keyPath of keyPaths) {
        const [topLevel] = keyPath.split('.');
        const group = groups.get(topLevel) ?? [];
        group.push(keyPath);
        groups.set(topLevel, group);
    }

    for (const [, keys] of groups) {
        keys.sort((a, b) => a.localeCompare(b));
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function removeTrailingCommaFromLine(line) {
    const commentlessLine = stripInlineComment(line);
    const trimmedRight = commentlessLine.replace(/\s+$/, '');
    if (!trimmedRight.endsWith(',')) {
        return line;
    }

    const commaIndex = trimmedRight.lastIndexOf(',');
    return line.slice(0, commaIndex) + line.slice(commaIndex + 1);
}

function getNextMeaningfulCodeLine(lines, startIndex) {
    for (let index = startIndex; index < lines.length; index++) {
        const code = stripInlineComment(lines[index]).trim();
        if (code) {
            return code;
        }
    }

    return null;
}

function removeTrailingCommaFromLastMeaningfulOutputLine(output) {
    for (let index = output.length - 1; index >= 0; index--) {
        const code = stripInlineComment(output[index]).trim();
        if (!code) {
            continue;
        }

        if (code.endsWith(',')) {
            output[index] = removeTrailingCommaFromLine(output[index]);
        }
        break;
    }
}

function findHeaderStartIndex(output) {
    let index = output.length;
    while (index > 0) {
        const trimmedLine = output[index - 1].trim();
        if (trimmedLine === '' || trimmedLine.startsWith('//')) {
            index--;
            continue;
        }
        break;
    }

    return index;
}

function collapseConsecutiveBlankLines(lines) {
    const collapsed = [];
    let previousBlank = false;

    for (const line of lines) {
        const isBlank = line.trim() === '';
        if (isBlank) {
            if (previousBlank) {
                continue;
            }
            previousBlank = true;
            collapsed.push('');
            continue;
        }

        previousBlank = false;
        collapsed.push(line);
    }

    return collapsed;
}

// Removes unused keys from a locale file by deleting safe single-line leaf entries, removing empty objects, and collapsing blank lines.
function removeKeysFromLocaleSource(localeSource, keysToRemove) {
    const lines = normalizeNewlines(localeSource).split('\n');
    const currentPath = [];
    const output = [];
    const removedKeys = new Set();
    const objectStack = [];
    let inExport = false;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const trimmedLine = line.trim();
        if (!inExport) {
            output.push(line);
            if (trimmedLine.startsWith('export const STRINGS_')) {
                inExport = true;
            }
            continue;
        }

        const code = stripInlineComment(line).trim();

        const objectStartMatch = code.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)|(['"])([^'"]+)\2)\s*:\s*\{\s*$/);
        if (objectStartMatch) {
            currentPath.push(objectStartMatch[1] ?? objectStartMatch[3]);
            objectStack.push({ headerStartIndex: findHeaderStartIndex(output), hasContent: false });
            output.push(line);
            continue;
        }

        if (/^\}\s*,?\s*;?\s*$/.test(code)) {
            removeTrailingCommaFromLastMeaningfulOutputLine(output);

            if (objectStack.length > 0) {
                const { headerStartIndex, hasContent } = objectStack.pop();
                currentPath.pop();

                if (!hasContent) {
                    output.splice(headerStartIndex);
                    continue;
                }

                if (objectStack.length > 0) {
                    objectStack[objectStack.length - 1].hasContent = true;
                }
            } else if (currentPath.length > 0) {
                currentPath.pop();
            }

            output.push(line);
            continue;
        }

        const leafMatch = code.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)|(['"])([^'"]+)\2)\s*:\s*/);
        if (leafMatch) {
            const keyPath = [...currentPath, leafMatch[1] ?? leafMatch[3]].join('.');
            if (keysToRemove.has(keyPath)) {
                if (code.endsWith(',')) {
                    removedKeys.add(keyPath);
                    continue;
                }

                const nextMeaningfulLine = getNextMeaningfulCodeLine(lines, lineIndex + 1);
                if (nextMeaningfulLine && /^\}\s*,?\s*;?\s*$/.test(nextMeaningfulLine)) {
                    removedKeys.add(keyPath);
                    continue;
                }
            }

            if (objectStack.length > 0) {
                objectStack[objectStack.length - 1].hasContent = true;
            }
        }

        output.push(line);
    }

    return { updatedSource: collapseConsecutiveBlankLines(output).join('\n'), removedKeys };
}

try {
    await fs.access(enLocalePath);
} catch {
    console.error(`Error: Missing locale file at ${path.relative(projectRoot, enLocalePath)}`);
    process.exit(1);
}

const enSource = await fs.readFile(enLocalePath, 'utf8');
const allKeyPaths = Array.from(new Set(extractLeafKeyPaths(enSource))).sort((a, b) => a.localeCompare(b));
const allKeys = new Set(allKeyPaths);
const topLevelKeys = Array.from(new Set(allKeyPaths.map(keyPath => keyPath.split('.')[0])));

const excludedDirs = [localesDir];
const sourceFiles = await collectSourceFiles(srcDir, excludedDirs);

const topLevelMatchers = buildTopLevelMatchers(topLevelKeys);
const usedKeys = new Set();
const usedKeyPrefixes = new Set();

for (const filePath of sourceFiles) {
    const sourceText = await fs.readFile(filePath, 'utf8');
    const { usedKeys: fileUsedKeys, usedPrefixes } = findUsedKeys(sourceText, allKeys, topLevelMatchers);
    for (const key of fileUsedKeys) {
        usedKeys.add(key);
    }
    for (const prefix of usedPrefixes) {
        usedKeyPrefixes.add(prefix);
    }
}

for (const prefix of usedKeyPrefixes) {
    const prefixWithDot = `${prefix}.`;
    for (const keyPath of allKeyPaths) {
        if (keyPath.startsWith(prefixWithDot)) {
            usedKeys.add(keyPath);
        }
    }
}

const unusedKeys = allKeyPaths.filter(key => !usedKeys.has(key));

console.log('Language string usage check');
console.log('');
console.log(`Locale source: ${path.relative(projectRoot, enLocalePath)}`);
console.log(`Search scope: ${path.relative(projectRoot, srcDir)} (excluding ${path.relative(projectRoot, localesDir)})`);
console.log('');
console.log(`String keys: ${allKeyPaths.length}`);
console.log(`Used: ${usedKeys.size}`);
console.log(`Unused: ${unusedKeys.length}`);

if (unusedKeys.length > 0) {
    console.log('');
    console.log('Unused keys:');
    for (const [section, keys] of groupByTopLevelKey(unusedKeys)) {
        console.log('');
        console.log(`${section}:`);
        for (const keyPath of keys) {
            console.log(`  - ${keyPath}`);
        }
    }
} else {
    console.log('');
    console.log('All keys are being used.');
}

if (unusedKeys.length > 0) {
    console.log('');
    const shouldRemove = await promptYesNo(`Remove ${unusedKeys.length} unused keys from locale files? [y/N] `);

    if (shouldRemove) {
        const keysToRemove = new Set(unusedKeys);
        const localeEntries = await fs.readdir(localesDir, { withFileTypes: true });
        const localeFiles = localeEntries
            .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
            .map(entry => path.join(localesDir, entry.name))
            .sort((a, b) => a.localeCompare(b));

        let totalRemoved = 0;
        let updatedFiles = 0;

        for (const localeFile of localeFiles) {
            const localeSource = await fs.readFile(localeFile, 'utf8');
            const { updatedSource, removedKeys } = removeKeysFromLocaleSource(localeSource, keysToRemove);
            if (removedKeys.size === 0) {
                continue;
            }

            await fs.writeFile(localeFile, updatedSource, 'utf8');
            updatedFiles++;
            totalRemoved += removedKeys.size;
        }

        console.log('');
        console.log(`Updated locale files: ${updatedFiles}/${localeFiles.length}`);
        console.log(`Removed keys: ${totalRemoved}`);
    } else {
        console.log('No changes made.');
    }
}
