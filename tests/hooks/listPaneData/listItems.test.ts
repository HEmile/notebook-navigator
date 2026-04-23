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
import { App, TFile } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaultSettings';
import type { PropertyItem } from '../../../src/storage/IndexedDBStorage';
import type { IndexedDBStorage } from '../../../src/storage/IndexedDBStorage';
import { buildListItems, type ListPaneConfig } from '../../../src/hooks/listPaneData/listItems';
import { FILE_VISIBILITY } from '../../../src/utils/fileTypeUtils';
import { buildPropertyKeyNodeId, buildPropertyValueNodeId } from '../../../src/utils/propertyTree';
import { createTestTFile } from '../../utils/createTestTFile';
import { ItemType, ListPaneItemType, PINNED_SECTION_HEADER_KEY } from '../../../src/types';

interface FileMetadataRecord {
    properties: PropertyItem[] | null;
    tags: readonly string[] | null;
}

function createApp(): App {
    const app = new App();
    app.metadataCache.getFileCache = () => null;
    return app;
}

function createDb(records: Record<string, FileMetadataRecord>): IndexedDBStorage {
    return {
        getFile(path: string): FileMetadataRecord | null {
            return records[path] ?? null;
        }
    } as IndexedDBStorage;
}

function createListConfig(pinnedNotes: ListPaneConfig['pinnedNotes']): ListPaneConfig {
    return {
        filterPinnedByFolder: true,
        folderAppearances: DEFAULT_SETTINGS.folderAppearances,
        folderSortOrder: DEFAULT_SETTINGS.folderSortOrder,
        folderTreeSortOverrides: DEFAULT_SETTINGS.folderTreeSortOverrides,
        noteGrouping: DEFAULT_SETTINGS.noteGrouping,
        pinnedNotes,
        propertyAppearances: DEFAULT_SETTINGS.propertyAppearances,
        showFileTags: false,
        showPinnedGroupHeader: true,
        showTags: false,
        tagAppearances: DEFAULT_SETTINGS.tagAppearances
    };
}

function getFileItems(items: ReturnType<typeof buildListItems>): { path: string; isPinned: boolean }[] {
    const fileItems: { path: string; isPinned: boolean }[] = [];

    items.forEach(item => {
        if (item.type !== ListPaneItemType.FILE) {
            return;
        }

        const fileData = item.data;
        if (!(fileData instanceof TFile)) {
            return;
        }

        fileItems.push({
            path: fileData.path,
            isPinned: item.isPinned === true
        });
    });

    return fileItems;
}

describe('buildListItems pinned display scope', () => {
    it('keeps tag pins in the pinned section when folder pin scoping is enabled', () => {
        const app = createApp();
        const rootFile = createTestTFile('notes/root.md');
        const childFile = createTestTFile('notes/child.md');
        const db = createDb({
            [rootFile.path]: { tags: ['work'], properties: null },
            [childFile.path]: { tags: ['work/anthropic'], properties: null }
        });

        const items = buildListItems({
            app,
            dayKey: '2026-03-07',
            fileVisibility: FILE_VISIBILITY.DOCUMENTS,
            files: [rootFile, childFile],
            getDB: () => db,
            getFileTimestamps: () => ({ created: 0, modified: 0 }),
            hiddenFileState: new Map(),
            hiddenTags: [],
            listConfig: createListConfig({
                [childFile.path]: { folder: false, tag: true, property: false, topic: false }
            }),
            searchMetaMap: new Map(),
            selectedFolder: null,
            selectedProperty: null,
            selectedTag: 'work',
            selectionType: ItemType.TAG,
            showHiddenItems: false,
            sortOption: 'modified-desc'
        });

        expect(items.some(item => item.key === PINNED_SECTION_HEADER_KEY)).toBe(true);
        expect(getFileItems(items)).toEqual([
            { path: childFile.path, isPinned: true },
            { path: rootFile.path, isPinned: false }
        ]);
    });

    it('keeps direct tag pins in the pinned section for the matching tag selection', () => {
        const app = createApp();
        const childFile = createTestTFile('notes/child.md');
        const siblingFile = createTestTFile('notes/sibling.md');
        const db = createDb({
            [childFile.path]: { tags: ['work/anthropic'], properties: null },
            [siblingFile.path]: { tags: ['work/anthropic'], properties: null }
        });

        const items = buildListItems({
            app,
            dayKey: '2026-03-07',
            fileVisibility: FILE_VISIBILITY.DOCUMENTS,
            files: [childFile, siblingFile],
            getDB: () => db,
            getFileTimestamps: () => ({ created: 0, modified: 0 }),
            hiddenFileState: new Map(),
            hiddenTags: [],
            listConfig: createListConfig({
                [childFile.path]: { folder: false, tag: true, property: false, topic: false }
            }),
            searchMetaMap: new Map(),
            selectedFolder: null,
            selectedProperty: null,
            selectedTag: 'work/anthropic',
            selectionType: ItemType.TAG,
            showHiddenItems: false,
            sortOption: 'modified-desc'
        });

        expect(items.some(item => item.key === PINNED_SECTION_HEADER_KEY)).toBe(true);
        expect(getFileItems(items)).toEqual([
            { path: childFile.path, isPinned: true },
            { path: siblingFile.path, isPinned: false }
        ]);
    });

    it('keeps property pins in the pinned section when folder pin scoping is enabled', () => {
        const app = createApp();
        const keyOnlyFile = createTestTFile('notes/key-only.md');
        const valueFile = createTestTFile('notes/value.md');
        const db = createDb({
            [keyOnlyFile.path]: {
                tags: null,
                properties: [{ fieldKey: 'status', value: '', valueKind: 'string' }]
            },
            [valueFile.path]: {
                tags: null,
                properties: [{ fieldKey: 'status', value: 'work/anthropic', valueKind: 'string' }]
            }
        });

        const items = buildListItems({
            app,
            dayKey: '2026-03-07',
            fileVisibility: FILE_VISIBILITY.DOCUMENTS,
            files: [keyOnlyFile, valueFile],
            getDB: () => db,
            getFileTimestamps: () => ({ created: 0, modified: 0 }),
            hiddenFileState: new Map(),
            hiddenTags: [],
            listConfig: createListConfig({
                [valueFile.path]: { folder: false, tag: false, property: true, topic: false }
            }),
            searchMetaMap: new Map(),
            selectedFolder: null,
            selectedProperty: buildPropertyKeyNodeId('status'),
            selectedTag: null,
            selectionType: ItemType.PROPERTY,
            showHiddenItems: false,
            sortOption: 'modified-desc'
        });

        expect(items.some(item => item.key === PINNED_SECTION_HEADER_KEY)).toBe(true);
        expect(getFileItems(items)).toEqual([
            { path: valueFile.path, isPinned: true },
            { path: keyOnlyFile.path, isPinned: false }
        ]);
    });

    it('keeps direct property value pins in the pinned section for the matching value selection', () => {
        const app = createApp();
        const valueFile = createTestTFile('notes/value.md');
        const siblingFile = createTestTFile('notes/sibling.md');
        const db = createDb({
            [valueFile.path]: {
                tags: null,
                properties: [{ fieldKey: 'status', value: 'work/anthropic', valueKind: 'string' }]
            },
            [siblingFile.path]: {
                tags: null,
                properties: [{ fieldKey: 'status', value: 'work/anthropic', valueKind: 'string' }]
            }
        });

        const items = buildListItems({
            app,
            dayKey: '2026-03-07',
            fileVisibility: FILE_VISIBILITY.DOCUMENTS,
            files: [valueFile, siblingFile],
            getDB: () => db,
            getFileTimestamps: () => ({ created: 0, modified: 0 }),
            hiddenFileState: new Map(),
            hiddenTags: [],
            listConfig: createListConfig({
                [valueFile.path]: { folder: false, tag: false, property: true, topic: false }
            }),
            searchMetaMap: new Map(),
            selectedFolder: null,
            selectedProperty: buildPropertyValueNodeId('status', 'work/anthropic'),
            selectedTag: null,
            selectionType: ItemType.PROPERTY,
            showHiddenItems: false,
            sortOption: 'modified-desc'
        });

        expect(items.some(item => item.key === PINNED_SECTION_HEADER_KEY)).toBe(true);
        expect(getFileItems(items)).toEqual([
            { path: valueFile.path, isPinned: true },
            { path: siblingFile.path, isPinned: false }
        ]);
    });
});
