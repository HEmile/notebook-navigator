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

import { App, Plugin, TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { TEMPLATER_PLUGIN_ID } from '../../src/constants/pluginIds';
import { createCalendarMarkdownFile } from '../../src/utils/calendarNotes';
import { createTestTFile } from './createTestTFile';

interface TestVaultMethods {
    registerFile(file: TFile): void;
}

type TestTemplaterCreateFn = (
    template: TFile | string,
    folder?: unknown,
    filename?: string,
    openNewNote?: boolean
) => TFile | Promise<TFile | undefined> | undefined;

class TestTemplaterPlugin extends Plugin {
    templater: {
        create_new_note_from_template: TestTemplaterCreateFn;
    };

    constructor(app: App, createNoteFromTemplate: TestTemplaterCreateFn) {
        super(app, {
            id: TEMPLATER_PLUGIN_ID,
            name: 'Templater',
            author: 'Test',
            version: '1.0.0',
            minAppVersion: '1.0.0',
            description: 'Test plugin'
        });

        this.templater = {
            create_new_note_from_template: createNoteFromTemplate
        };
    }
}

function getTestVault(app: App): App['vault'] & TestVaultMethods {
    return app.vault as App['vault'] & TestVaultMethods;
}

function registerTemplater(app: App, createNoteFromTemplate: TestTemplaterCreateFn): void {
    const appWithPlugins = app as App & { plugins: { plugins: Record<string, Plugin> } };
    appWithPlugins.plugins = {
        plugins: {
            [TEMPLATER_PLUGIN_ID]: new TestTemplaterPlugin(app, createNoteFromTemplate)
        }
    };
}

describe('calendar note creation', () => {
    it('uses Templater directly when a configured template file is available', async () => {
        const app = new App();
        const templateFile = createTestTFile('Templates/Daily.md');
        const createdFile = createTestTFile('Daily/2026-06-06.md');
        const createNoteFromTemplate = vi.fn(async () => createdFile);
        const createNewMarkdownFile = vi.fn();

        getTestVault(app).registerFile(templateFile);
        registerTemplater(app, createNoteFromTemplate);
        app.fileManager.createNewMarkdownFile = createNewMarkdownFile;

        const created = await createCalendarMarkdownFile(app, '/', '2026-06-06.md', templateFile.path);

        expect(created).toBe(createdFile);
        expect(createNoteFromTemplate).toHaveBeenCalledWith(templateFile, app.vault.getRoot(), '2026-06-06', false);
        expect(createNewMarkdownFile).not.toHaveBeenCalled();
    });

    it('copies template content when Templater is unavailable', async () => {
        const app = new App();
        const templateFile = createTestTFile('Templates/Daily.md');
        const createdFile = createTestTFile('Daily/2026-06-06.md');
        const templateContent = '---\ncreated: <% tp.file.creation_date("YYYY-MM-DD") %>\n---\n';
        const createNewMarkdownFile = vi.fn(async () => createdFile);
        const read = vi.fn(async () => templateContent);
        const modify = vi.fn(async () => undefined);

        getTestVault(app).registerFile(templateFile);
        app.fileManager.createNewMarkdownFile = createNewMarkdownFile;
        app.vault.read = read;
        app.vault.modify = modify;

        const created = await createCalendarMarkdownFile(app, '/', '2026-06-06.md', templateFile.path);

        expect(created).toBe(createdFile);
        expect(createNewMarkdownFile).toHaveBeenCalledWith(app.vault.getRoot(), '2026-06-06');
        expect(read).toHaveBeenCalledWith(templateFile);
        expect(modify).toHaveBeenCalledWith(createdFile, templateContent);
    });
});
