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

import { App } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { createDefaultFileData, type FileData } from '../../../src/storage/IndexedDBStorage';
import { loadFileItemCacheSnapshot, type FileItemContentDb } from '../../../src/components/fileItem/useFileItemContentState';
import { createTestTFile } from '../../utils/createTestTFile';

function createFileRecord(patch?: Partial<FileData>): FileData {
    const base = createDefaultFileData({ mtime: 0, path: 'Notes/Daily.md' });
    return {
        ...base,
        ...(patch ?? {})
    };
}

function createContentDb(fileData: FileData | null): FileItemContentDb {
    return {
        getCachedPreviewText: () => 'Cached preview text',
        getFile: () => fileData,
        onFileContentChange: () => () => {},
        ensurePreviewTextLoaded: async () => {},
        getFeatureImageBlob: async () => null
    };
}

describe('useFileItemContentState helpers', () => {
    it('loads preview, tags, properties, and counters from the cache snapshot', () => {
        const file = createTestTFile('Notes/Daily.md');
        const properties = [{ fieldKey: 'status', value: 'open', valueKind: 'string' as const }];
        const db = createContentDb(
            createFileRecord({
                tags: ['work', 'important'],
                featureImageKey: 'feature-1',
                featureImageStatus: 'has',
                properties,
                wordCount: 321,
                taskUnfinished: 2
            })
        );

        const snapshot = loadFileItemCacheSnapshot({
            app: new App(),
            file,
            showPreview: true,
            showImage: false,
            db
        });

        expect(snapshot.previewText).toBe('Cached preview text');
        expect(snapshot.tags).toEqual(['work', 'important']);
        expect(snapshot.featureImageKey).toBe('feature-1');
        expect(snapshot.featureImageStatus).toBe('has');
        expect(snapshot.wordCount).toBe(321);
        expect(snapshot.taskUnfinished).toBe(2);
        expect(snapshot.properties).toEqual(properties);
        expect(snapshot.properties).not.toBe(properties);
    });

    it('skips preview and tags for non-markdown files', () => {
        const file = createTestTFile('Assets/Image.png');
        const db = createContentDb(
            createFileRecord({
                tags: ['ignored'],
                wordCount: 999
            })
        );

        const snapshot = loadFileItemCacheSnapshot({
            app: new App(),
            file,
            showPreview: true,
            showImage: false,
            db
        });

        expect(snapshot.previewText).toBe('');
        expect(snapshot.tags).toEqual([]);
        expect(snapshot.wordCount).toBe(999);
    });
});
