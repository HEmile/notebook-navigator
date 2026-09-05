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
import { App, Plugin, TFolder } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { TLDRAW_PLUGIN_ID } from '../../src/constants/pluginIds';
import { getDrawingFilePath } from '../../src/utils/drawingFileUtils';

class TestPlugin extends Plugin {
    settings: Record<string, unknown>;

    constructor(app: App, settings: Record<string, unknown>) {
        super(app, {
            id: TLDRAW_PLUGIN_ID,
            name: 'Tldraw',
            author: 'Test',
            version: '1.0.0',
            minAppVersion: '1.0.0',
            description: 'Test plugin'
        });
        this.settings = settings;
    }
}

function registerTldrawSettings(app: App, settings: Record<string, unknown>): void {
    const appWithPlugins = app as App & { plugins: { plugins: Record<string, Plugin> } };
    appWithPlugins.plugins = {
        plugins: {
            [TLDRAW_PLUGIN_ID]: new TestPlugin(app, settings)
        }
    };
}

describe('getDrawingFilePath', () => {
    it('removes traversal segments from drawing filenames', () => {
        const app = new App();
        const parent = new TFolder();
        parent.path = 'drawings';

        registerTldrawSettings(app, {
            newFilePrefix: '../nested/Sketch..Name',
            newFileTimeFormat: ''
        });

        expect(getDrawingFilePath(app, parent, 'tldraw')).toBe('drawings/nested SketchName.md');
    });
});
