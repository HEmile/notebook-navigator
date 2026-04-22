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

import { describe, it, expect } from 'vitest';
import { NavigationPaneItemType, TAGS_ROOT_VIRTUAL_FOLDER_ID } from '../../src/types';
import { buildIndentGuideLevelsMap, type IndentGuideItem } from '../../src/utils/navigationIndex';

const createItem = (key: string, type: NavigationPaneItemType, level?: number): IndentGuideItem => ({
    key,
    type,
    level
});

describe('buildIndentGuideLevelsMap', () => {
    it('builds connector levels for nested indent guide rows', () => {
        const items: IndentGuideItem[] = [
            createItem('folder-root', NavigationPaneItemType.FOLDER, 0),
            createItem('folder-child', NavigationPaneItemType.FOLDER, 1),
            createItem('folder-grandchild', NavigationPaneItemType.FOLDER, 2),
            createItem('folder-sibling', NavigationPaneItemType.FOLDER, 1),
            createItem('folder-next-root', NavigationPaneItemType.FOLDER, 0)
        ];

        const connectors = buildIndentGuideLevelsMap(items);

        expect(connectors.has('folder-root')).toBe(false);
        expect(connectors.get('folder-child')).toEqual([0]);
        expect(connectors.get('folder-grandchild')).toEqual([0, 1]);
        expect(connectors.get('folder-sibling')).toEqual([0]);
        expect(connectors.has('folder-next-root')).toBe(false);
    });

    it('ignores non-indent guide item types while keeping indent guide descendants connected', () => {
        const items: IndentGuideItem[] = [
            createItem(TAGS_ROOT_VIRTUAL_FOLDER_ID, NavigationPaneItemType.VIRTUAL_FOLDER, 0),
            createItem('shortcut-note', NavigationPaneItemType.SHORTCUT_NOTE, 1),
            createItem('tag-alpha', NavigationPaneItemType.TAG, 1),
            createItem('tag-beta', NavigationPaneItemType.TAG, 1)
        ];

        const connectors = buildIndentGuideLevelsMap(items);

        expect(connectors.has('shortcut-note')).toBe(false);
        expect(connectors.get('tag-alpha')).toEqual([0]);
        expect(connectors.get('tag-beta')).toEqual([0]);
    });

    it('clears ancestor levels when returning to a root indent guide row', () => {
        const items: IndentGuideItem[] = [
            createItem('folders-root', NavigationPaneItemType.FOLDER, 0),
            createItem('folders-child', NavigationPaneItemType.FOLDER, 1),
            createItem(TAGS_ROOT_VIRTUAL_FOLDER_ID, NavigationPaneItemType.VIRTUAL_FOLDER, 0),
            createItem('tags-child', NavigationPaneItemType.TAG, 1)
        ];

        const connectors = buildIndentGuideLevelsMap(items);

        expect(connectors.get('folders-child')).toEqual([0]);
        expect(connectors.has(TAGS_ROOT_VIRTUAL_FOLDER_ID)).toBe(false);
        expect(connectors.get('tags-child')).toEqual([0]);
    });

    it('returns an empty map when no indent guide rows are present', () => {
        const items: IndentGuideItem[] = [
            createItem('shortcut-header', NavigationPaneItemType.SHORTCUT_HEADER, 0),
            createItem('shortcut-note', NavigationPaneItemType.SHORTCUT_NOTE, 1),
            createItem('list-spacer', NavigationPaneItemType.LIST_SPACER)
        ];

        const connectors = buildIndentGuideLevelsMap(items);

        expect(connectors.size).toBe(0);
    });
});
