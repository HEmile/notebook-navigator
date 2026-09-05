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
import { TFolder } from 'obsidian';
import {
    getSelectedFolderFileWatchPaths,
    getSelectedFolderFileWatchPathSignature,
    isWatchedFolderFileChange
} from '../../src/hooks/useSelectedFolderFileVersion';
import { createTestTFile } from '../utils/createTestTFile';

function createTestFolder(path: string, parent: TFolder | null = null): TFolder {
    const folder = new TFolder(path) as TFolder & {
        children: TFolder[];
        name: string;
        parent: TFolder | null;
    };
    folder.name = path === '/' ? '/' : (path.split('/').pop() ?? path);
    folder.children = [];
    folder.parent = parent;
    parent?.children.push(folder);
    return folder;
}

describe('selected folder file watch paths', () => {
    it('watches only the selected folder by default', () => {
        const root = createTestFolder('/');
        const projects = createTestFolder('Projects', root);
        const child = createTestFolder('Projects/Feature', projects);

        const paths = getSelectedFolderFileWatchPaths(child);

        expect(Array.from(paths)).toEqual(['Projects/Feature']);
        expect(isWatchedFolderFileChange(createTestTFile('Projects/Feature/index.md'), paths)).toBe(true);
        expect(isWatchedFolderFileChange(createTestTFile('Projects/index.md'), paths)).toBe(false);
    });

    it('watches ancestor folder note candidates when requested', () => {
        const root = createTestFolder('/');
        const projects = createTestFolder('Projects', root);
        const child = createTestFolder('Projects/Feature', projects);

        const paths = getSelectedFolderFileWatchPaths(child, true);

        expect(Array.from(paths)).toEqual(['Projects/Feature', 'Projects', '/']);
        expect(isWatchedFolderFileChange(createTestTFile('Projects/Feature/index.md'), paths)).toBe(true);
        expect(isWatchedFolderFileChange(createTestTFile('Projects/index.md'), paths)).toBe(true);
        expect(isWatchedFolderFileChange(createTestTFile('Shared Scratch.md'), paths)).toBe(true);
        expect(isWatchedFolderFileChange(createTestTFile('Projects/Other/index.md'), paths)).toBe(false);
        expect(isWatchedFolderFileChange(createTestTFile('Archive/index.md'), paths, 'Projects/index.md')).toBe(true);
    });

    it('invalidates when a watched folder is renamed', () => {
        const root = createTestFolder('/');
        const projects = createTestFolder('Projects', root);
        const child = createTestFolder('Projects/Feature', projects);
        const paths = getSelectedFolderFileWatchPaths(child, true);

        projects.path = 'Work';

        expect(isWatchedFolderFileChange(projects, paths, 'Projects')).toBe(true);
        expect(isWatchedFolderFileChange(createTestFolder('Archive'), paths, 'Archive')).toBe(false);
    });

    it('changes the watch path signature when selected folder paths mutate in place', () => {
        const root = createTestFolder('/');
        const projects = createTestFolder('Projects', root);
        const child = createTestFolder('Projects/Feature', projects);

        const beforeRename = getSelectedFolderFileWatchPathSignature(child, true);
        projects.path = 'Work';
        child.path = 'Work/Feature';
        const afterRename = getSelectedFolderFileWatchPathSignature(child, true);

        expect(afterRename).not.toBe(beforeRename);
    });
});
