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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, TFile, TFolder } from 'obsidian';
import { loadInitialSelectionState } from '../../src/context/selection/useSelectionProvider';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { STORAGE_KEYS } from '../../src/types';
import { buildPropertyValueNodeId, normalizePropertyTreeValuePath } from '../../src/utils/propertyTree';
import { setActivePropertyFields } from '../../src/utils/vaultProfiles';

const storage = new Map<string, unknown>();

interface SelectionTestApp {
    app: App;
    files: Map<string, TFile>;
    rootFolder: TFolder;
}

vi.mock('../../src/utils/localStorage', () => ({
    localStorage: {
        get: (key: string) => {
            if (!storage.has(key)) {
                return null;
            }
            return storage.get(key) ?? null;
        },
        set: (key: string, value: unknown) => {
            storage.set(key, value);
            return true;
        },
        remove: (key: string) => {
            storage.delete(key);
            return true;
        }
    }
}));

function createAppWithRoot(): SelectionTestApp {
    const app = new App();
    const rootFolder = new TFolder();
    rootFolder.path = '/';
    rootFolder.name = '/';
    rootFolder.parent = null;
    rootFolder.children = [];
    const files = new Map<string, TFile>();

    Object.assign(app.vault, {
        getFolderByPath(path: string): TFolder | null {
            return path === rootFolder.path ? rootFolder : null;
        },
        getFileByPath(path: string): TFile | null {
            return files.get(path) ?? null;
        },
        getRoot(): TFolder {
            return rootFolder;
        }
    });

    return { app, files, rootFolder };
}

function createFile(path: string, parent: TFolder): TFile {
    const file = new TFile();
    const segments = path.split('/');
    const fileName = segments[segments.length - 1] ?? path;
    const extensionIndex = fileName.lastIndexOf('.');
    file.path = path;
    file.name = fileName;
    file.basename = extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex);
    file.extension = extensionIndex === -1 ? '' : fileName.slice(extensionIndex + 1);
    file.parent = parent;
    file.stat = { ctime: 0, mtime: 0, size: 0 };
    return file;
}

describe('loadInitialSelectionState', () => {
    beforeEach(() => {
        storage.clear();
    });

    it('falls back to an empty multi-selection when selectedFiles storage is corrupted', () => {
        storage.set(STORAGE_KEYS.selectedFilesKey, '');

        const { app } = createAppWithRoot();

        expect(() => loadInitialSelectionState({ app, settings: { ...DEFAULT_SETTINGS } })).not.toThrow();

        const state = loadInitialSelectionState({ app, settings: { ...DEFAULT_SETTINGS } });
        expect(state.selectedFiles.size).toBe(0);
        expect(state.selectedFile).toBeNull();
        expect(state.selectedFolder?.path).toBe('/');
    });

    it('restores only valid file paths from selectedFiles storage', () => {
        storage.set(STORAGE_KEYS.selectedFilesKey, ['notes/one.md', 7, null, 'notes/two.md']);

        const { app, files, rootFolder } = createAppWithRoot();
        const firstFile = createFile('notes/one.md', rootFolder);
        const secondFile = createFile('notes/two.md', rootFolder);
        files.set(firstFile.path, firstFile);
        files.set(secondFile.path, secondFile);

        const state = loadInitialSelectionState({ app, settings: { ...DEFAULT_SETTINGS } });

        expect(Array.from(state.selectedFiles)).toEqual(['notes/one.md', 'notes/two.md']);
        expect(state.selectedFile?.path).toBe('notes/one.md');
    });

    it('restores canonical property selections from NFC and NFD-equivalent stored node ids', () => {
        storage.set(STORAGE_KEYS.selectedPropertyKey, 'key:Re\u0301union=Planifie\u0301');

        const { app } = createAppWithRoot();
        const settings = {
            ...DEFAULT_SETTINGS,
            showProperties: true
        };
        setActivePropertyFields(settings, 'Réunion');

        const state = loadInitialSelectionState({ app, settings });

        expect(state.selectionType).toBe('property');
        expect(state.selectedFolder).toBeNull();
        expect(state.selectedProperty).toBe(buildPropertyValueNodeId('réunion', normalizePropertyTreeValuePath('Planifié')));
    });
});
