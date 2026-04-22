#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const MAX_EVALUATED_STRINGS = 500;

const projectRoot = path.resolve(dirname, '..');

const stylesPath = path.join(projectRoot, 'styles.css');
const srcDir = path.join(projectRoot, 'src');

function toProjectRelative(absolutePath) {
    const relativePath = path.relative(projectRoot, absolutePath);
    return relativePath || '.';
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

    result.sort();
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

async function main() {
    let stylesRaw;
    try {
        stylesRaw = await fs.readFile(stylesPath, 'utf8');
    } catch {
        console.error(`Error: styles.css not found at ${toProjectRelative(stylesPath)}`);
        process.exitCode = 1;
        return;
    }

    const definedClasses = extractCssClasses(stylesRaw);
    const definedVars = extractCssVariablesDefined(stylesRaw);
    const usedVarsFromCss = extractCssVariablesUsed(stylesRaw);
    const settingsIds = extractStyleSettingsIds(stylesRaw);

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
        const scriptKind = getScriptKindForPath(filePath);
        const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, false, scriptKind);
        analyzeSourceFile(sourceFile, codeTokens, codeVarTokens);
    }

    const pluginClassesDefined = [...definedClasses].filter(name => isPluginClassName(name)).sort();
    const pluginVarsDefined = [...definedVars].filter(name => name.startsWith('--nn-')).sort();

    const usedPluginClasses = new Set(pluginClassesDefined.filter(name => codeTokens.has(name)));

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

    const unusedPluginClasses = pluginClassesDefined.filter(name => !usedPluginClasses.has(name));
    const unusedPluginVars = pluginVarsDefined.filter(name => !usedVars.has(name));

    const usedPluginVarsCount = pluginVarsDefined.length - unusedPluginVars.length;

    console.log('CSS usage report (plugin only)');
    console.log('');
    console.log(`Styles: ${toProjectRelative(stylesPath)}`);
    console.log(`Code:   ${toProjectRelative(srcDir)}`);
    console.log(`Files:  ${codeFiles.length}`);
    console.log('');
    console.log('Totals');
    console.log(`  Classes in CSS:    ${definedClasses.size}`);
    console.log(`  Variables in CSS:  ${definedVars.size}`);
    console.log(`  Plugin classes:    ${pluginClassesDefined.length}`);
    console.log(`  Plugin variables:  ${pluginVarsDefined.length}`);
    console.log('');
    console.log('Plugin usage');
    console.log(`  Classes: ${usedPluginClasses.size} used, ${unusedPluginClasses.length} unused`);
    console.log(`  Vars:    ${usedPluginVarsCount} used, ${unusedPluginVars.length} unused`);

    if (unusedPluginClasses.length > 0) {
        console.log('');
        console.log('Unused plugin classes');
        for (const name of unusedPluginClasses) {
            console.log(`  - ${name}`);
        }
    }

    if (unusedPluginVars.length > 0) {
        console.log('');
        console.log('Unused plugin variables');
        for (const name of unusedPluginVars) {
            console.log(`  - ${name}`);
        }
    }

    if (unusedPluginClasses.length === 0 && unusedPluginVars.length === 0) {
        console.log('');
        console.log('All plugin classes and variables are being used.');
    }
}

main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
