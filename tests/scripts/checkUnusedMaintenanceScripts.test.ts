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

import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../..');

interface ScriptResult {
    code: number;
    stdout: string;
    stderr: string;
}

interface ExecFileError extends Error {
    code?: number | string;
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}

const tempProjects: string[] = [];

function isExecFileError(error: unknown): error is ExecFileError {
    return error instanceof Error;
}

async function runScript(scriptPath: string, args: string[]): Promise<ScriptResult> {
    try {
        const { stdout, stderr } = await execFileAsync(process.execPath, [path.join(repoRoot, scriptPath), ...args], {
            cwd: repoRoot,
            encoding: 'utf8'
        });
        return { code: 0, stdout: String(stdout), stderr: String(stderr) };
    } catch (error) {
        if (!isExecFileError(error)) {
            throw error;
        }

        const code = typeof error.code === 'number' ? error.code : 1;
        return {
            code,
            stdout: String(error.stdout ?? ''),
            stderr: String(error.stderr ?? '')
        };
    }
}

async function createTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'nn-maintenance-script-'));
    tempProjects.push(projectRoot);
    return projectRoot;
}

async function writeProjectFile(projectRoot: string, relativePath: string, contents: string): Promise<void> {
    const filePath = path.join(projectRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, 'utf8');
}

afterEach(async () => {
    await Promise.all(tempProjects.map(projectRoot => rm(projectRoot, { recursive: true, force: true })));
    tempProjects.length = 0;
});

describe('check-unused-strings.mjs', () => {
    it('keeps object-valued string usage and allowlisted keys while fixing unused keys', async () => {
        const projectRoot = await createTempProject();

        await writeProjectFile(
            projectRoot,
            'src/i18n/locales/en.ts',
            `export const STRINGS_EN = {
    common: {
        used: 'Used',
        unused: 'Unused',
        kept: 'Kept' // unused-strings keep common.kept
    },
    searchHelp: {
        sections: {
            names: {
                title: 'Names',
                items: ['Use words.']
            }
        }
    }
};
`
        );
        await writeProjectFile(
            projectRoot,
            'src/i18n/locales/fr.ts',
            `export const STRINGS_FR = {
    common: {
        used: 'Utilisé',
        unused: 'Inutilisé',
        kept: 'Conservé'
    },
    searchHelp: {
        sections: {
            names: {
                title: 'Noms',
                items: ['Utilisez des mots.']
            }
        }
    }
};
`
        );
        await writeProjectFile(
            projectRoot,
            'src/app.ts',
            `import { strings } from './i18n';

const section = strings.searchHelp.sections.names;
console.log(strings.common.used, section);
`
        );

        const fixResult = await runScript('scripts/check-unused-strings.mjs', ['--project-root', projectRoot, '--fix']);
        expect(fixResult.code).toBe(0);
        expect(fixResult.stdout).toContain('Unused: 1');

        const enLocale = await readFile(path.join(projectRoot, 'src/i18n/locales/en.ts'), 'utf8');
        const frLocale = await readFile(path.join(projectRoot, 'src/i18n/locales/fr.ts'), 'utf8');
        expect(enLocale).not.toContain("unused: 'Unused'");
        expect(frLocale).not.toContain("unused: 'Inutilisé'");
        expect(enLocale).toContain("kept: 'Kept'");
        expect(enLocale).toContain("title: 'Names'");
        expect(enLocale).toContain("items: ['Use words.']");

        const checkResult = await runScript('scripts/check-unused-strings.mjs', ['--project-root', projectRoot, '--check']);
        expect(checkResult.code).toBe(0);
        expect(checkResult.stdout).toContain('Unused: 0');
        expect(checkResult.stdout).toContain('Locale shape: OK');
    });

    it('reports locale shape mismatches', async () => {
        const projectRoot = await createTempProject();

        await writeProjectFile(
            projectRoot,
            'src/i18n/locales/en.ts',
            `export const STRINGS_EN = {
    settings: {
        name: 'Settings',
        nested: {
            title: 'Title'
        }
    }
};
`
        );
        await writeProjectFile(
            projectRoot,
            'src/i18n/locales/fr.ts',
            `export const STRINGS_FR = {
    settings: {
        name: 'Paramètres',
        nested: {},
        extra: 'Extra'
    }
};
`
        );
        await writeProjectFile(projectRoot, 'src/app.ts', "console.log('fixture');\n");

        const result = await runScript('scripts/check-unused-strings.mjs', ['--project-root', projectRoot, '--check']);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain('Locale shape mismatches');
        expect(result.stdout).toContain('missing (1)');
        expect(result.stdout).toContain('settings.nested.title');
        expect(result.stdout).toContain('extra (1)');
        expect(result.stdout).toContain('settings.extra');
    });
});

describe('check-unused-css.mjs', () => {
    it('regenerates stale styles.css in fix mode', async () => {
        const projectRoot = await createTempProject();

        await writeProjectFile(projectRoot, 'src/styles/index.css', "@import './sections/base.css';\n");
        await writeProjectFile(
            projectRoot,
            'src/styles/sections/base.css',
            `/* Source: src/styles/sections/base.css */

.nn-used {
    color: var(--nn-color);
}

:root {
    --nn-color: #ff0000;
}
`
        );
        await writeProjectFile(projectRoot, 'src/app.ts', "const className = 'nn-used';\nconsole.log(className);\n");
        await writeProjectFile(projectRoot, 'styles.css', 'stale\n');

        const fixResult = await runScript('scripts/check-unused-css.mjs', ['--project-root', projectRoot, '--fix']);
        expect(fixResult.code).toBe(0);
        expect(fixResult.stdout).toContain('Regenerated styles.css from source CSS.');

        const styles = await readFile(path.join(projectRoot, 'styles.css'), 'utf8');
        expect(styles).toContain('GENERATED FILE - DO NOT EDIT styles.css');
        expect(styles).toContain('.nn-used');

        const checkResult = await runScript('scripts/check-unused-css.mjs', ['--project-root', projectRoot, '--check']);
        expect(checkResult.code).toBe(0);
        expect(checkResult.stdout).toContain('Generated CSS: up to date');
    });

    it('reports unused selectors while honoring allowlist comments', async () => {
        const projectRoot = await createTempProject();

        await writeProjectFile(projectRoot, 'src/styles/index.css', "@import './sections/base.css';\n");
        await writeProjectFile(
            projectRoot,
            'src/styles/sections/base.css',
            `/* Source: src/styles/sections/base.css */
/* unused-css keep nn-kept --nn-kept-var */

:root {
    --nn-color: #000000;
    --nn-unused-var: #111111;
    --nn-kept-var: #222222;
}

.nn-used {
    color: var(--nn-color);
}

.nn-unused {
    color: #ffffff;
}

.nn-kept {
    color: #eeeeee;
}
`
        );
        await writeProjectFile(projectRoot, 'src/app.ts', "const className = 'nn-used';\nconsole.log(className);\n");
        await writeProjectFile(projectRoot, 'styles.css', 'stale\n');

        const fixResult = await runScript('scripts/check-unused-css.mjs', ['--project-root', projectRoot, '--fix']);
        expect(fixResult.code).toBe(1);
        expect(fixResult.stdout).toContain('Regenerated styles.css from source CSS.');

        const checkResult = await runScript('scripts/check-unused-css.mjs', ['--project-root', projectRoot, '--check']);
        expect(checkResult.code).toBe(1);
        expect(checkResult.stdout).toContain('nn-unused');
        expect(checkResult.stdout).toContain('--nn-unused-var');
        expect(checkResult.stdout).not.toContain('nn-kept');
        expect(checkResult.stdout).not.toContain('--nn-kept-var');
    });
});
