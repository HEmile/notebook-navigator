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
import { buildVisibleFolderTraversalState, flattenFolderTree } from '../../src/utils/treeFlattener';

function getFolderName(path: string): string {
    if (path === '/') {
        return '/';
    }
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
}

function createFolder(path: string, children: TFolder[] = []): TFolder {
    const folder = new TFolder();
    Reflect.set(folder, 'path', path);
    Reflect.set(folder, 'name', getFolderName(path));
    Reflect.set(folder, 'children', children);
    return folder;
}

describe('treeFlattener flattenFolderTree', () => {
    it('sorts folders by folder name when no custom sort name resolver is provided', () => {
        const alpha = createFolder('alpha');
        const zeta = createFolder('zeta');
        const root = createFolder('/', [zeta, alpha]);
        const expandedFolders = new Set<string>(['/']);

        const items = flattenFolderTree([root], expandedFolders, [], 0, new Set(), {
            defaultSortOrder: 'alpha-asc'
        });

        const childPaths = items.filter(item => item.level === 1).map(item => item.data.path);
        expect(childPaths).toEqual(['alpha', 'zeta']);
    });

    it('sorts folders by provided sort names when a custom resolver is provided', () => {
        const alpha = createFolder('alpha');
        const zeta = createFolder('zeta');
        const root = createFolder('/', [zeta, alpha]);
        const expandedFolders = new Set<string>(['/']);

        const sortNames = new Map<string, string>([
            ['alpha', 'Zulu'],
            ['zeta', 'Alpha']
        ]);

        const items = flattenFolderTree([root], expandedFolders, [], 0, new Set(), {
            defaultSortOrder: 'alpha-asc',
            getFolderSortName: folder => sortNames.get(folder.path) ?? folder.name
        });

        const childPaths = items.filter(item => item.level === 1).map(item => item.data.path);
        expect(childPaths).toEqual(['zeta', 'alpha']);
    });

    it('marks folders as excluded when custom exclusion resolver returns true', () => {
        const visible = createFolder('visible');
        const archived = createFolder('archived');
        const root = createFolder('/', [visible, archived]);
        const expandedFolders = new Set<string>(['/']);

        const items = flattenFolderTree([root], expandedFolders, [], 0, new Set(), {
            defaultSortOrder: 'alpha-asc',
            isFolderExcluded: folder => folder.path === 'archived'
        });

        const archivedItem = items.find(item => item.data.path === 'archived');
        const visibleItem = items.find(item => item.data.path === 'visible');
        expect(archivedItem?.isExcluded).toBe(true);
        expect(visibleItem?.isExcluded).toBeUndefined();
    });

    it('builds sibling groups without excluded folders', () => {
        const childA = createFolder('Projects/A');
        const childB = createFolder('Projects/B');
        const archived = createFolder('Projects/Archived');
        const projects = createFolder('Projects', [childB, archived, childA]);
        const root = createFolder('/', [projects]);

        const traversalState = buildVisibleFolderTraversalState({
            rootFolders: [root],
            excludePatterns: [],
            defaultSortOrder: 'alpha-asc',
            isFolderExcluded: folder => folder.path === 'Projects/Archived'
        });

        expect(traversalState.siblingPathsByParent.get('Projects')).toEqual(['Projects/A', 'Projects/B']);
    });

    it('builds sibling groups using custom folder sort names', () => {
        const bravo = createFolder('Projects/bravo');
        const alpha = createFolder('Projects/alpha');
        const projects = createFolder('Projects', [alpha, bravo]);
        const root = createFolder('/', [projects]);

        const sortNames = new Map<string, string>([
            ['Projects/alpha', 'Zulu'],
            ['Projects/bravo', 'Alpha']
        ]);

        const traversalState = buildVisibleFolderTraversalState({
            rootFolders: [root],
            excludePatterns: [],
            defaultSortOrder: 'alpha-asc',
            getFolderSortName: folder => sortNames.get(folder.path) ?? folder.name
        });

        expect(traversalState.siblingPathsByParent.get('Projects')).toEqual(['Projects/bravo', 'Projects/alpha']);
    });

    it('does not mutate caller-owned root folder arrays when sorting root siblings', () => {
        const bravo = createFolder('bravo');
        const alpha = createFolder('alpha');
        const rootFolders = [bravo, alpha];

        const traversalState = buildVisibleFolderTraversalState({
            rootFolders,
            excludePatterns: [],
            defaultSortOrder: 'alpha-asc'
        });

        expect(traversalState.siblingPathsByParent.get('/')).toEqual(['alpha', 'bravo']);
        expect(rootFolders.map(folder => folder.path)).toEqual(['bravo', 'alpha']);
    });

    it('continues traversing children when a parent folder is excluded from sibling coloring', () => {
        const visibleChild = createFolder('Projects/VisibleChild');
        const hiddenParent = createFolder('Projects', [visibleChild]);
        const root = createFolder('/', [hiddenParent]);

        const traversalState = buildVisibleFolderTraversalState({
            rootFolders: [root],
            excludePatterns: [],
            defaultSortOrder: 'alpha-asc',
            isFolderExcluded: folder => folder.path === 'Projects'
        });

        expect(traversalState.siblingPathsByParent.get('/')).toEqual([]);
        expect(traversalState.siblingPathsByParent.get('Projects')).toEqual(['Projects/VisibleChild']);
    });

    it('stops after root sibling groups when descendant traversal is disabled', () => {
        const childA = createFolder('Projects/A');
        const childB = createFolder('Projects/B');
        const projects = createFolder('Projects', [childA, childB]);
        const root = createFolder('/', [projects]);

        const traversalState = buildVisibleFolderTraversalState({
            rootFolders: [root],
            excludePatterns: [],
            defaultSortOrder: 'alpha-asc',
            includeDescendantSiblingGroups: false
        });

        expect(traversalState.siblingPathsByParent.get('/')).toEqual(['Projects']);
        expect(traversalState.siblingPathsByParent.has('Projects')).toBe(false);
    });
});
