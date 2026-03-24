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

import { describe, expect, it } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import { selectionReducer } from '../../src/context/selection/state';
import type { SelectionState } from '../../src/context/selection/types';

function createFolder(path: string, parent: TFolder | null = null): TFolder {
    const folder = new TFolder();
    folder.path = path;
    folder.name = path === '/' ? '/' : (path.split('/').pop() ?? path);
    folder.parent = parent;
    folder.children = [];
    return folder;
}

function createFile(path: string, parent: TFolder): TFile {
    const file = new TFile();
    const fileName = path.split('/').pop() ?? path;
    const extensionIndex = fileName.lastIndexOf('.');
    file.path = path;
    file.name = fileName;
    file.basename = extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex);
    file.extension = extensionIndex === -1 ? '' : fileName.slice(extensionIndex + 1);
    file.parent = parent;
    file.stat = { ctime: 0, mtime: 0, size: 0 };
    return file;
}

function createSelectionState(rootFolder: TFolder): SelectionState {
    return {
        selectionType: 'folder',
        selectedFolder: rootFolder,
        selectedTag: null,
        selectedProperty: null,
        selectedFiles: new Set<string>(),
        anchorIndex: null,
        lastMovementDirection: null,
        isRevealOperation: false,
        isFolderChangeWithAutoSelect: false,
        isKeyboardNavigation: false,
        isFolderNavigation: false,
        selectedFile: null,
        revealSource: null,
        navigationHistory: [
            {
                type: 'folder',
                value: rootFolder.path
            }
        ],
        navigationHistoryIndex: 0
    };
}

describe('selectionReducer navigation history', () => {
    it('drops forward history when a new folder is selected after moving back', () => {
        const root = createFolder('/');
        const alpha = createFolder('Alpha', root);
        const beta = createFolder('Beta', root);
        const gamma = createFolder('Gamma', root);

        const initialState = createSelectionState(root);
        const alphaState = selectionReducer(initialState, { type: 'SET_SELECTED_FOLDER', folder: alpha });
        const betaState = selectionReducer(alphaState, { type: 'SET_SELECTED_FOLDER', folder: beta });
        const backState = selectionReducer(betaState, {
            type: 'SET_SELECTED_FOLDER',
            folder: alpha,
            historyIndex: 1
        });
        const gammaState = selectionReducer(backState, { type: 'SET_SELECTED_FOLDER', folder: gamma });

        expect(backState.navigationHistory.map(entry => entry.value)).toEqual(['/', 'Alpha', 'Beta']);
        expect(backState.navigationHistoryIndex).toBe(1);
        expect(gammaState.navigationHistory.map(entry => entry.value)).toEqual(['/', 'Alpha', 'Gamma']);
        expect(gammaState.navigationHistoryIndex).toBe(2);
    });

    it('keeps auto reveals out of navigation history', () => {
        const root = createFolder('/');
        const alpha = createFolder('Alpha', root);
        const beta = createFolder('Beta', root);
        const file = createFile('Beta/note.md', beta);

        const initialState = createSelectionState(root);
        const alphaState = selectionReducer(initialState, { type: 'SET_SELECTED_FOLDER', folder: alpha });
        const revealedState = selectionReducer(alphaState, {
            type: 'REVEAL_FILE',
            file,
            targetFolder: beta,
            source: 'auto'
        });

        expect(revealedState.selectedFolder?.path).toBe('Beta');
        expect(revealedState.navigationHistory.map(entry => entry.value)).toEqual(['/', 'Alpha']);
        expect(revealedState.navigationHistoryIndex).toBe(1);
    });

    it('caps history by dropping the oldest entries', () => {
        const root = createFolder('/');
        let state = createSelectionState(root);

        for (let index = 1; index <= 105; index += 1) {
            state = selectionReducer(state, {
                type: 'SET_SELECTED_FOLDER',
                folder: createFolder(`Folder-${index}`, root)
            });
        }

        expect(state.navigationHistory).toHaveLength(100);
        expect(state.navigationHistory[0]?.value).toBe('Folder-6');
        expect(state.navigationHistory[99]?.value).toBe('Folder-105');
        expect(state.navigationHistoryIndex).toBe(99);
    });
});
