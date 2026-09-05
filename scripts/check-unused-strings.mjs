#!/usr/bin/env node
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
import * as ts from 'typescript';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const DEFAULT_PROJECT_ROOT = path.resolve(dirname, '..');
const KEEP_COMMENT_REGEX = /unused-strings\s+keep\s+([^\n*]+)/g;

function printUsage() {
    console.log(`Usage: node scripts/check-unused-strings.mjs [--check | --fix] [--project-root <path>]

Finds unused i18n keys by scanning source usage against src/i18n/locales/en.ts.

Options:
  --check                 Exit non-zero when unused keys or locale shape issues are found.
  --fix                   Remove unused keys from locale files without prompting.
  --project-root <path>   Use a different project root. Intended for fixture tests.
  -h, --help              Show this help message.

Allowlist:
  Add a comment containing "unused-strings keep <key.path>" to keep a key or object subtree.`);
}

function parseArgs(argv) {
    const options = {
        mode: 'prompt',
        projectRoot: DEFAULT_PROJECT_ROOT,
        help: false
    };

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--check') {
            if (options.mode === 'fix') {
                throw new Error('Use either --check or --fix, not both.');
            }
            options.mode = 'check';
            continue;
        }
        if (arg === '--fix') {
            if (options.mode === 'check') {
                throw new Error('Use either --check or --fix, not both.');
            }
            options.mode = 'fix';
            continue;
        }
        if (arg === '--project-root') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('Missing value for --project-root.');
            }
            options.projectRoot = path.resolve(value);
            index++;
            continue;
        }
        if (arg.startsWith('--project-root=')) {
            options.projectRoot = path.resolve(arg.slice('--project-root='.length));
            continue;
        }
        if (arg === '-h' || arg === '--help') {
            options.help = true;
            continue;
        }
        throw new Error(`Unknown option: ${arg}`);
    }

    return options;
}

function getProjectPaths(projectRoot) {
    const srcDir = path.join(projectRoot, 'src');
    const localesDir = path.join(srcDir, 'i18n', 'locales');
    return {
        srcDir,
        localesDir,
        enLocalePath: path.join(localesDir, 'en.ts')
    };
}

function toProjectRelative(projectRoot, absolutePath) {
    const relativePath = path.relative(projectRoot, absolutePath);
    return relativePath || '.';
}

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

function getPropertyName(name) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
    }

    return null;
}

function getLeafKind(expression) {
    if (ts.isArrayLiteralExpression(expression)) {
        return 'array';
    }

    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
        return 'function';
    }

    return 'leaf';
}

function findExportedStringsObject(sourceFile) {
    for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) {
            continue;
        }

        const isExported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
        if (!isExported) {
            continue;
        }

        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || !declaration.name.text.startsWith('STRINGS_')) {
                continue;
            }

            if (declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
                return declaration.initializer;
            }
        }
    }

    throw new Error(`No exported STRINGS_* object literal found in ${sourceFile.fileName}`);
}

function extractLocaleShape(localeSource, localePath) {
    const sourceFile = ts.createSourceFile(localePath, localeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const stringsObject = findExportedStringsObject(sourceFile);
    const leafKeyPaths = [];
    const shape = new Map();

    function visitObject(objectLiteral, prefix) {
        for (const property of objectLiteral.properties) {
            if (!ts.isPropertyAssignment(property)) {
                continue;
            }

            const key = getPropertyName(property.name);
            if (!key) {
                continue;
            }

            const keyPath = prefix ? `${prefix}.${key}` : key;
            const initializer = property.initializer;

            if (ts.isObjectLiteralExpression(initializer)) {
                shape.set(keyPath, 'object');
                visitObject(initializer, keyPath);
                continue;
            }

            const kind = getLeafKind(initializer);
            shape.set(keyPath, kind);
            leafKeyPaths.push(keyPath);
        }
    }

    visitObject(stringsObject, '');
    leafKeyPaths.sort((a, b) => a.localeCompare(b));

    return { leafKeyPaths, shape };
}

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

        if (!entry.isFile() || entry.name.endsWith('.d.ts')) {
            continue;
        }

        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }

    files.sort((a, b) => a.localeCompare(b));
    return files;
}

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
            `\\b${group}\\.([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)\\s*\\[\\s*(['"])([^'"\n\r]+)\\2\\s*\\]`,
            'g'
        ),
        bracketAnyRegex: new RegExp(`\\b${group}\\.([a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*)\\s*\\[`, 'g')
    };
}

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

function hasDescendantKeyPath(candidatePath, allKeyPaths) {
    const prefix = `${candidatePath}.`;
    return allKeyPaths.some(keyPath => keyPath.startsWith(prefix));
}

function markCandidatePathAsUsed(candidatePath, allKeys, allKeyPaths, used, usedPrefixes) {
    const resolvedPath = resolveExistingKeyPath(candidatePath, allKeys);
    if (resolvedPath) {
        used.add(resolvedPath);
        return;
    }

    if (hasDescendantKeyPath(candidatePath, allKeyPaths)) {
        usedPrefixes.add(candidatePath);
    }
}

function findUsedKeys(sourceText, allKeys, allKeyPaths, topLevelMatchers) {
    const used = new Set();
    const usedPrefixes = new Set();

    const stringsAccessRegex = /\bstrings\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g;
    let match = stringsAccessRegex.exec(sourceText);
    while (match) {
        markCandidatePathAsUsed(match[1], allKeys, allKeyPaths, used, usedPrefixes);
        match = stringsAccessRegex.exec(sourceText);
    }

    const stringsBracketLiteralRegex = /\bstrings\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\[\s*(['"])([^'"\n\r]+)\2\s*\]/g;
    match = stringsBracketLiteralRegex.exec(sourceText);
    while (match) {
        markCandidatePathAsUsed(`${match[1]}.${match[3]}`, allKeys, allKeyPaths, used, usedPrefixes);
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
            markCandidatePathAsUsed(`${match[1]}.${match[2]}`, allKeys, allKeyPaths, used, usedPrefixes);
            match = topLevelMatchers.dotAccessRegex.exec(sourceText);
        }
    }

    if (topLevelMatchers?.bracketLiteralRegex) {
        match = topLevelMatchers.bracketLiteralRegex.exec(sourceText);
        while (match) {
            markCandidatePathAsUsed(`${match[1]}.${match[2]}.${match[4]}`, allKeys, allKeyPaths, used, usedPrefixes);
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

function parseKeepCommentCandidates(sourceText) {
    const candidates = [];
    let match = KEEP_COMMENT_REGEX.exec(sourceText);
    while (match) {
        const rawCandidates = match[1].split(/[\s,]+/);
        for (const rawCandidate of rawCandidates) {
            const candidate = rawCandidate
                .trim()
                .replace(/^['"`]/, '')
                .replace(/['"`;:)]$/, '');
            if (candidate) {
                candidates.push(candidate);
            }
        }
        match = KEEP_COMMENT_REGEX.exec(sourceText);
    }
    return candidates;
}

function applyUsedPrefixes(usedKeyPrefixes, allKeyPaths, usedKeys) {
    for (const prefix of usedKeyPrefixes) {
        const prefixWithDot = `${prefix}.`;
        for (const keyPath of allKeyPaths) {
            if (keyPath.startsWith(prefixWithDot)) {
                usedKeys.add(keyPath);
            }
        }
    }
}

function promptYesNo(question) {
    const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
    return reader
        .question(question)
        .then(answer => /^y(es)?$/i.test(answer.trim()))
        .finally(() => reader.close());
}

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

function getLocaleShapeIssues(baseShape, localeShape, localeLabel) {
    const baseKeys = Array.from(baseShape.keys()).sort((a, b) => a.localeCompare(b));
    const localeKeys = new Set(localeShape.keys());
    const missing = baseKeys.filter(key => !localeKeys.has(key));
    const extra = Array.from(localeShape.keys())
        .filter(key => !baseShape.has(key))
        .sort((a, b) => a.localeCompare(b));
    const kindMismatches = baseKeys
        .filter(key => localeKeys.has(key) && baseShape.get(key) !== localeShape.get(key))
        .map(key => `${key} (${localeShape.get(key)} != ${baseShape.get(key)})`)
        .sort((a, b) => a.localeCompare(b));

    if (missing.length === 0 && extra.length === 0 && kindMismatches.length === 0) {
        return null;
    }

    return { localeLabel, missing, extra, kindMismatches };
}

function printLocaleShapeIssues(issues) {
    if (issues.length === 0) {
        console.log('Locale shape: OK');
        return;
    }

    console.log('Locale shape mismatches:');
    for (const issue of issues) {
        console.log('');
        console.log(issue.localeLabel);
        if (issue.missing.length > 0) {
            console.log(`  missing (${issue.missing.length}):`);
            for (const key of issue.missing) {
                console.log(`    - ${key}`);
            }
        }
        if (issue.extra.length > 0) {
            console.log(`  extra (${issue.extra.length}):`);
            for (const key of issue.extra) {
                console.log(`    - ${key}`);
            }
        }
        if (issue.kindMismatches.length > 0) {
            console.log(`  kind mismatch (${issue.kindMismatches.length}):`);
            for (const key of issue.kindMismatches) {
                console.log(`    - ${key}`);
            }
        }
    }
}

async function loadLocaleShapes(projectRoot, localesDir, enLocalePath) {
    await fs.access(enLocalePath);

    const localeEntries = await fs.readdir(localesDir, { withFileTypes: true });
    const localeFiles = localeEntries
        .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
        .map(entry => path.join(localesDir, entry.name))
        .sort((a, b) => a.localeCompare(b));

    const localeData = [];
    for (const localeFile of localeFiles) {
        const source = await fs.readFile(localeFile, 'utf8');
        localeData.push({
            filePath: localeFile,
            label: toProjectRelative(projectRoot, localeFile),
            source,
            ...extractLocaleShape(source, localeFile)
        });
    }

    const enLocale = localeData.find(locale => locale.filePath === enLocalePath);
    if (!enLocale) {
        throw new Error(`Missing locale file at ${toProjectRelative(projectRoot, enLocalePath)}`);
    }

    const shapeIssues = localeData
        .filter(locale => locale.filePath !== enLocalePath)
        .map(locale => getLocaleShapeIssues(enLocale.shape, locale.shape, locale.label))
        .filter(Boolean);

    return { enLocale, localeData, shapeIssues };
}

async function analyzeUnusedStrings(options) {
    const { projectRoot } = options;
    const { srcDir, localesDir, enLocalePath } = getProjectPaths(projectRoot);
    const { enLocale, localeData, shapeIssues } = await loadLocaleShapes(projectRoot, localesDir, enLocalePath);

    const allKeyPaths = enLocale.leafKeyPaths;
    const allKeys = new Set(allKeyPaths);
    const topLevelKeys = Array.from(new Set(allKeyPaths.map(keyPath => keyPath.split('.')[0])));
    const topLevelMatchers = buildTopLevelMatchers(topLevelKeys);
    const sourceFiles = await collectSourceFiles(srcDir, [localesDir]);
    const usedKeys = new Set();
    const usedKeyPrefixes = new Set();

    for (const locale of localeData) {
        for (const candidate of parseKeepCommentCandidates(locale.source)) {
            markCandidatePathAsUsed(candidate, allKeys, allKeyPaths, usedKeys, usedKeyPrefixes);
        }
    }

    for (const filePath of sourceFiles) {
        const sourceText = await fs.readFile(filePath, 'utf8');
        for (const candidate of parseKeepCommentCandidates(sourceText)) {
            markCandidatePathAsUsed(candidate, allKeys, allKeyPaths, usedKeys, usedKeyPrefixes);
        }

        const { usedKeys: fileUsedKeys, usedPrefixes } = findUsedKeys(sourceText, allKeys, allKeyPaths, topLevelMatchers);
        for (const key of fileUsedKeys) {
            usedKeys.add(key);
        }
        for (const prefix of usedPrefixes) {
            usedKeyPrefixes.add(prefix);
        }
    }

    applyUsedPrefixes(usedKeyPrefixes, allKeyPaths, usedKeys);

    return {
        projectRoot,
        srcDir,
        localesDir,
        enLocalePath,
        localeData,
        sourceFiles,
        allKeyPaths,
        usedKeys,
        unusedKeys: allKeyPaths.filter(key => !usedKeys.has(key)),
        shapeIssues
    };
}

function printReport(result) {
    console.log('Language string usage check');
    console.log('');
    console.log(`Locale source: ${toProjectRelative(result.projectRoot, result.enLocalePath)}`);
    console.log(
        `Search scope: ${toProjectRelative(result.projectRoot, result.srcDir)} (excluding ${toProjectRelative(result.projectRoot, result.localesDir)})`
    );
    console.log(`Files: ${result.sourceFiles.length}`);
    console.log('');
    console.log(`String keys: ${result.allKeyPaths.length}`);
    console.log(`Used: ${result.usedKeys.size}`);
    console.log(`Unused: ${result.unusedKeys.length}`);
    console.log('');
    printLocaleShapeIssues(result.shapeIssues);

    if (result.unusedKeys.length > 0) {
        console.log('');
        console.log('Unused keys:');
        for (const [section, keys] of groupByTopLevelKey(result.unusedKeys)) {
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
}

async function removeUnusedKeys(result) {
    const keysToRemove = new Set(result.unusedKeys);
    let totalRemoved = 0;
    let updatedFiles = 0;
    let enRemovedKeys = new Set();

    for (const locale of result.localeData) {
        const { updatedSource, removedKeys } = removeKeysFromLocaleSource(locale.source, keysToRemove);
        if (removedKeys.size === 0) {
            continue;
        }

        await fs.writeFile(locale.filePath, updatedSource, 'utf8');
        updatedFiles++;
        totalRemoved += removedKeys.size;

        if (locale.filePath === result.enLocalePath) {
            enRemovedKeys = removedKeys;
        }
    }

    const skippedKeys = result.unusedKeys.filter(key => !enRemovedKeys.has(key));

    console.log('');
    console.log(`Updated locale files: ${updatedFiles}/${result.localeData.length}`);
    console.log(`Removed keys: ${totalRemoved}`);

    if (skippedKeys.length > 0) {
        console.log('');
        console.log('Skipped keys that could not be removed safely:');
        for (const key of skippedKeys) {
            console.log(`  - ${key}`);
        }
    }

    return skippedKeys;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printUsage();
        return;
    }

    const result = await analyzeUnusedStrings(options);
    printReport(result);

    if (result.shapeIssues.length > 0) {
        process.exitCode = 1;
        return;
    }

    if (result.unusedKeys.length === 0) {
        return;
    }

    if (options.mode === 'check') {
        process.exitCode = 1;
        return;
    }

    const shouldRemove =
        options.mode === 'fix' ? true : await promptYesNo(`\nRemove ${result.unusedKeys.length} unused keys from locale files? [y/N] `);
    if (!shouldRemove) {
        console.log('No changes made.');
        return;
    }

    const skippedKeys = await removeUnusedKeys(result);
    if (skippedKeys.length > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
