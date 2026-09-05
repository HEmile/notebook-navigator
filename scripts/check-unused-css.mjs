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
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const DEFAULT_PROJECT_ROOT = path.resolve(dirname, '..');
const MAX_EVALUATED_STRINGS = 500;
const KEEP_COMMENT_REGEX = /unused-css\s+keep\s+([^\n*]+)/g;

function printUsage() {
    console.log(`Usage: node scripts/check-unused-css.mjs [--check | --fix] [--project-root <path>]

Scans generated CSS from src/styles/index.css and source files for unused plugin CSS classes and variables.

Options:
  --check                 Exit non-zero when stale CSS or unused plugin selectors/variables are found.
  --fix                   Regenerate styles.css when stale, then run the unused CSS check.
  --project-root <path>   Use a different project root. Intended for fixture tests.
  -h, --help              Show this help message.

Allowlist:
  Add a comment containing "unused-css keep nn-class --nn-variable" to keep intentional dynamic usage.`);
}

function parseArgs(argv) {
    const options = {
        mode: 'report',
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
    return {
        srcDir: path.join(projectRoot, 'src'),
        stylesEntryPath: path.join(projectRoot, 'src', 'styles', 'index.css'),
        stylesPath: path.join(projectRoot, 'styles.css')
    };
}

function toProjectRelative(projectRoot, absolutePath) {
    const relativePath = path.relative(projectRoot, absolutePath);
    return relativePath || '.';
}

async function buildStylesFromSources(projectRoot, stylesEntryPath) {
    const entry = await fs.readFile(stylesEntryPath, 'utf8');
    const importRegex = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g;
    const importPaths = Array.from(entry.matchAll(importRegex), match => match[1]);

    if (importPaths.length === 0) {
        throw new Error(`No @import statements found in ${toProjectRelative(projectRoot, stylesEntryPath)}`);
    }

    const resolvedImports = importPaths.map(importPath => {
        if (!importPath.startsWith('.')) {
            throw new Error(`Only relative @import paths are supported (got: ${importPath})`);
        }

        const absolutePath = path.resolve(path.dirname(stylesEntryPath), importPath);
        const relativePath = path.relative(projectRoot, absolutePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error(`@import path must stay within project root (got: ${importPath})`);
        }

        return {
            absolutePath,
            relativePath: relativePath.split(path.sep).join(path.posix.sep)
        };
    });

    const sourceIndexPath = toProjectRelative(projectRoot, stylesEntryPath).split(path.sep).join(path.posix.sep);
    const header = [
        '/*',
        'Notebook Navigator - Plugin for Obsidian',
        'Copyright (c) 2025-2026 Johan Sanneblad',
        '',
        'This program is free software: you can redistribute it and/or modify',
        'it under the terms of the GNU General Public License as published by',
        'the Free Software Foundation, either version 3 of the License, or',
        '(at your option) any later version.',
        '',
        'This program is distributed in the hope that it will be useful,',
        'but WITHOUT ANY WARRANTY; without even the implied warranty of',
        'MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
        'GNU General Public License for more details.',
        '',
        'You should have received a copy of the GNU General Public License',
        'along with this program.  If not, see <https://www.gnu.org/licenses/>.',
        '',
        '=========================================================================',
        'GENERATED FILE - DO NOT EDIT styles.css',
        '=========================================================================',
        '',
        'Edit the CSS sources instead:',
        `- ${sourceIndexPath} (import order + per-file descriptions)`,
        '- src/styles/sections/*',
        '',
        'Generated by: scripts/build-styles.mjs',
        '*/',
        ''
    ].join('\n');

    let cssText = header;
    for (const entry of resolvedImports) {
        cssText += await fs.readFile(entry.absolutePath, 'utf8');
    }

    return { cssText, importCount: importPaths.length };
}

function stripCssNoise(cssText) {
    let text = cssText;
    text = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
    text = text.replace(/"([^"\\]|\\.)*"/g, '""');
    text = text.replace(/'([^'\\]|\\.)*'/g, "''");
    text = text.replace(/url\(\s*[^)]*\)/g, 'url()');
    return text;
}

function extractCssClasses(cssText) {
    const cleaned = stripCssNoise(cssText);
    const regex = /\.([_a-zA-Z][-_a-zA-Z0-9]*)/g;
    return new Set(Array.from(cleaned.matchAll(regex), match => match[1]));
}

function extractCssVariablesDefined(cssText) {
    const cleaned = stripCssNoise(cssText);
    const regex = /(--[_a-zA-Z0-9-]+)\s*:/g;
    return new Set(Array.from(cleaned.matchAll(regex), match => match[1]));
}

function extractCssVariablesUsed(cssText) {
    const cleaned = stripCssNoise(cssText);
    const regex = /var\(\s*(--[_a-zA-Z0-9-]+)/g;
    return new Set(Array.from(cleaned.matchAll(regex), match => match[1]));
}

function extractStyleSettingsIds(cssText) {
    const ids = new Set();
    const settingsBlockRegex = /\/\*\s*@settings[\s\S]*?\*\//g;
    const idRegex = /\bid:\s*([_a-zA-Z0-9-]+)/g;

    for (const match of cssText.matchAll(settingsBlockRegex)) {
        const block = match[0];
        for (const idMatch of block.matchAll(idRegex)) {
            ids.add(idMatch[1]);
        }
    }

    return ids;
}

function parseKeepCommentTokens(text) {
    const classes = new Set();
    const variables = new Set();
    let match = KEEP_COMMENT_REGEX.exec(text);

    while (match) {
        const rawTokens = match[1].split(/[\s,]+/);
        for (const rawToken of rawTokens) {
            const token = rawToken
                .trim()
                .replace(/^['"`]/, '')
                .replace(/['"`;:)]$/, '');
            if (!token) {
                continue;
            }
            if (token.startsWith('--')) {
                variables.add(token);
                continue;
            }
            classes.add(token.startsWith('.') ? token.slice(1) : token);
        }
        match = KEEP_COMMENT_REGEX.exec(text);
    }

    return { classes, variables };
}

function mergeKeepTokens(target, source) {
    for (const className of source.classes) {
        target.classes.add(className);
    }
    for (const variableName of source.variables) {
        target.variables.add(variableName);
    }
}

function getScriptKindForPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ts') return ts.ScriptKind.TS;
    if (ext === '.tsx') return ts.ScriptKind.TSX;
    if (ext === '.js') return ts.ScriptKind.JS;
    if (ext === '.jsx') return ts.ScriptKind.JSX;
    return ts.ScriptKind.Unknown;
}

async function collectFilesRecursive(rootDir, predicate) {
    const result = [];
    const queue = [rootDir];
    const ignoredDirNames = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', 'docs']);

    while (queue.length > 0) {
        const dirPath = queue.pop();
        if (!dirPath) {
            continue;
        }
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (!ignoredDirNames.has(entry.name)) {
                    queue.push(entryPath);
                }
                continue;
            }
            if (entry.isFile() && predicate(entryPath)) {
                if (entry.name.endsWith('.d.ts')) {
                    continue;
                }
                result.push(entryPath);
            }
        }
    }

    result.sort((a, b) => a.localeCompare(b));
    return result;
}

function isPluginClassName(className) {
    return className.startsWith('nn-') || className === 'notebook-navigator' || className.startsWith('notebook-navigator-');
}

function addTokensFromText(text, tokenSet, varSet) {
    const classRegex = /[_a-zA-Z][-_a-zA-Z0-9]*/g;
    let match;
    while ((match = classRegex.exec(text)) !== null) {
        tokenSet.add(match[0]);
    }

    const varRegex = /--[_a-zA-Z0-9-]+/g;
    while ((match = varRegex.exec(text)) !== null) {
        varSet.add(match[0]);
    }
}

function evaluateStaticStringExpression(expression) {
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
        return [expression.text];
    }

    if (ts.isNumericLiteral(expression)) {
        return [expression.text];
    }

    if (ts.isPrefixUnaryExpression(expression)) {
        if (expression.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(expression.operand)) {
            return [`-${expression.operand.text}`];
        }
        if (expression.operator === ts.SyntaxKind.PlusToken && ts.isNumericLiteral(expression.operand)) {
            return [expression.operand.text];
        }
    }

    if (ts.isParenthesizedExpression(expression)) {
        return evaluateStaticStringExpression(expression.expression);
    }

    if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) {
        return evaluateStaticStringExpression(expression.expression);
    }

    if (ts.isConditionalExpression(expression)) {
        const whenTrue = evaluateStaticStringExpression(expression.whenTrue);
        const whenFalse = evaluateStaticStringExpression(expression.whenFalse);
        if (!whenTrue || !whenFalse) {
            return null;
        }

        const combined = new Set([...whenTrue, ...whenFalse]);
        return Array.from(combined);
    }

    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const leftValues = evaluateStaticStringExpression(expression.left);
        const rightValues = evaluateStaticStringExpression(expression.right);
        if (!leftValues || !rightValues) {
            return null;
        }

        const combined = [];
        for (const leftValue of leftValues) {
            for (const rightValue of rightValues) {
                combined.push(`${leftValue}${rightValue}`);
                if (combined.length > MAX_EVALUATED_STRINGS) {
                    return null;
                }
            }
        }
        return combined;
    }

    if (ts.isTemplateExpression(expression)) {
        let results = [expression.head.text];
        for (const span of expression.templateSpans) {
            const spanValues = evaluateStaticStringExpression(span.expression);
            if (!spanValues) {
                return null;
            }

            const nextResults = [];
            for (const prefix of results) {
                for (const value of spanValues) {
                    nextResults.push(`${prefix}${value}${span.literal.text}`);
                    if (nextResults.length > MAX_EVALUATED_STRINGS) {
                        return null;
                    }
                }
            }
            results = nextResults;
        }
        return results;
    }

    return null;
}

function analyzeSourceFile(sourceFile, tokenSet, varSet) {
    const visit = node => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            addTokensFromText(node.text, tokenSet, varSet);
        } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            const evaluated = evaluateStaticStringExpression(node);
            if (evaluated) {
                for (const value of evaluated) {
                    addTokensFromText(value, tokenSet, varSet);
                }
            }
        } else if (ts.isTemplateExpression(node)) {
            const evaluated = evaluateStaticStringExpression(node);
            if (evaluated) {
                for (const value of evaluated) {
                    addTokensFromText(value, tokenSet, varSet);
                }
            } else {
                addTokensFromText(node.head.text, tokenSet, varSet);
                for (const span of node.templateSpans) {
                    addTokensFromText(span.literal.text, tokenSet, varSet);
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
}

async function readExistingStyles(stylesPath) {
    try {
        return await fs.readFile(stylesPath, 'utf8');
    } catch {
        return null;
    }
}

async function analyzeUnusedCss(options) {
    const { projectRoot } = options;
    const { srcDir, stylesEntryPath, stylesPath } = getProjectPaths(projectRoot);
    const expectedStyles = await buildStylesFromSources(projectRoot, stylesEntryPath);
    const existingStyles = await readExistingStyles(stylesPath);
    let stylesAreStale = existingStyles !== expectedStyles.cssText;
    let regeneratedStyles = false;

    if (stylesAreStale && options.mode === 'fix') {
        await fs.writeFile(stylesPath, expectedStyles.cssText, 'utf8');
        stylesAreStale = false;
        regeneratedStyles = true;
    }

    const cssText = expectedStyles.cssText;
    const definedClasses = extractCssClasses(cssText);
    const definedVars = extractCssVariablesDefined(cssText);
    const usedVarsFromCss = extractCssVariablesUsed(cssText);
    const settingsIds = extractStyleSettingsIds(cssText);
    const keepTokens = parseKeepCommentTokens(cssText);

    const usedVars = new Set(usedVarsFromCss);
    for (const id of settingsIds) {
        if (id.startsWith('nn-')) {
            usedVars.add(`--${id}`);
        }
    }

    const codeTokens = new Set();
    const codeVarTokens = new Set();
    const codeFiles = await collectFilesRecursive(srcDir, filePath => {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
    });

    for (const filePath of codeFiles) {
        const text = await fs.readFile(filePath, 'utf8');
        mergeKeepTokens(keepTokens, parseKeepCommentTokens(text));

        const scriptKind = getScriptKindForPath(filePath);
        const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, false, scriptKind);
        analyzeSourceFile(sourceFile, codeTokens, codeVarTokens);
    }

    const pluginClassesDefined = [...definedClasses].filter(name => isPluginClassName(name)).sort((a, b) => a.localeCompare(b));
    const pluginVarsDefined = [...definedVars].filter(name => name.startsWith('--nn-')).sort((a, b) => a.localeCompare(b));
    const usedPluginClasses = new Set(pluginClassesDefined.filter(name => codeTokens.has(name)));

    for (const className of keepTokens.classes) {
        usedPluginClasses.add(className);
    }

    const dynamicPrefixTokens = [...codeTokens].filter(token => {
        if (!token.endsWith('-')) {
            return false;
        }
        if (!(token.startsWith('nn-') || token.startsWith('notebook-navigator-'))) {
            return false;
        }
        return token.length > 6;
    });

    for (const prefix of dynamicPrefixTokens) {
        for (const className of pluginClassesDefined) {
            if (className.startsWith(prefix)) {
                usedPluginClasses.add(className);
            }
        }
    }

    for (const value of codeVarTokens) {
        usedVars.add(value);
    }
    for (const variableName of keepTokens.variables) {
        usedVars.add(variableName);
    }

    const unusedPluginClasses = pluginClassesDefined.filter(name => !usedPluginClasses.has(name));
    const unusedPluginVars = pluginVarsDefined.filter(name => !usedVars.has(name));

    return {
        projectRoot,
        srcDir,
        stylesPath,
        stylesEntryPath,
        importCount: expectedStyles.importCount,
        codeFiles,
        definedClasses,
        definedVars,
        pluginClassesDefined,
        pluginVarsDefined,
        usedPluginClasses,
        unusedPluginClasses,
        unusedPluginVars,
        stylesAreStale,
        regeneratedStyles
    };
}

function printReport(result) {
    const usedPluginVarsCount = result.pluginVarsDefined.length - result.unusedPluginVars.length;

    console.log('CSS usage report (plugin only)');
    console.log('');
    console.log(`Styles: ${toProjectRelative(result.projectRoot, result.stylesPath)}`);
    console.log(`Source: ${toProjectRelative(result.projectRoot, result.stylesEntryPath)} (${result.importCount} files)`);
    console.log(`Code:   ${toProjectRelative(result.projectRoot, result.srcDir)}`);
    console.log(`Files:  ${result.codeFiles.length}`);
    console.log('');
    console.log(`Generated CSS: ${result.stylesAreStale ? 'stale' : 'up to date'}`);
    if (result.regeneratedStyles) {
        console.log('Regenerated styles.css from source CSS.');
    }
    console.log('');
    console.log('Totals');
    console.log(`  Classes in CSS:    ${result.definedClasses.size}`);
    console.log(`  Variables in CSS:  ${result.definedVars.size}`);
    console.log(`  Plugin classes:    ${result.pluginClassesDefined.length}`);
    console.log(`  Plugin variables:  ${result.pluginVarsDefined.length}`);
    console.log('');
    console.log('Plugin usage');
    console.log(`  Classes: ${result.usedPluginClasses.size} used, ${result.unusedPluginClasses.length} unused`);
    console.log(`  Vars:    ${usedPluginVarsCount} used, ${result.unusedPluginVars.length} unused`);

    if (result.unusedPluginClasses.length > 0) {
        console.log('');
        console.log('Unused plugin classes');
        for (const name of result.unusedPluginClasses) {
            console.log(`  - ${name}`);
        }
    }

    if (result.unusedPluginVars.length > 0) {
        console.log('');
        console.log('Unused plugin variables');
        for (const name of result.unusedPluginVars) {
            console.log(`  - ${name}`);
        }
    }

    if (result.unusedPluginClasses.length === 0 && result.unusedPluginVars.length === 0) {
        console.log('');
        console.log('All plugin classes and variables are being used.');
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printUsage();
        return;
    }

    const result = await analyzeUnusedCss(options);
    printReport(result);

    const hasUnusedCss = result.unusedPluginClasses.length > 0 || result.unusedPluginVars.length > 0;
    const hasCheckFailure = result.stylesAreStale || hasUnusedCss;
    if ((options.mode === 'check' || options.mode === 'fix') && hasCheckFailure) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
