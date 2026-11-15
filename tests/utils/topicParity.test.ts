/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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
/*
 * Small checks that topics behave like tags in shared folder/tag/property code paths
 */

import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { shouldShowFileItemParentFolderLine } from '../../src/utils/listPaneMeasurements';
import { partitionPinnedFiles } from '../../src/utils/fileFinder';
import { ItemType, NavigationPaneItemType } from '../../src/types';
import { buildNavigationPathIndexMap, getNavigationIndex } from '../../src/utils/navigationIndex';
import type { CombinedNavigationItem } from '../../src/types/virtualization';
import type { TopicNode } from '../../src/types/storage';

describe('topic lists', () => {
    it('show the parent folder line like tag lists', () => {
        const base = {
            showParentFolder: true,
            isPinned: false,
            includeDescendantNotes: false,
            parentFolder: null,
            fileParentPath: 'Projects/Lenses'
        };
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'topic' })).toBe(true);
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'tag' })).toBe(true);
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'topic', isPinned: true })).toBe(false);
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'topic', fileParentPath: '/' })).toBe(false);
    });

    it('only show notes pinned in topic context in the pinned group', () => {
        const files = ['a.md', 'b.md', 'c.md'].map(path => new TFile(path));
        const pinnedNotes = {
            'a.md': { folder: true, tag: false, property: false, topic: false },
            'b.md': { folder: false, tag: false, property: false, topic: true },
            'c.md': { folder: false, tag: true, property: false, topic: false }
        };

        const { pinnedFiles, unpinnedFiles } = partitionPinnedFiles(files, pinnedNotes, ItemType.TOPIC);

        expect(pinnedFiles.map(file => file.path)).toEqual(['b.md']);
        expect(unpinnedFiles.map(file => file.path)).toEqual(['a.md', 'c.md']);
    });

    it('index topic rows by their path so they can be scrolled into view', () => {
        const node: TopicNode = { name: 'Physics', parents: new Map(), children: new Map(), notesWithTag: new Set() };
        const items = [{ type: NavigationPaneItemType.TOPIC, data: node, level: 2, key: 'Science/Physics' }] as CombinedNavigationItem[];

        const indexMap = buildNavigationPathIndexMap(items);

        expect(getNavigationIndex(indexMap, ItemType.TOPIC, 'Science/Physics')).toBe(0);
        expect(getNavigationIndex(indexMap, ItemType.FOLDER, 'Science/Physics')).toBeUndefined();
    });
});
