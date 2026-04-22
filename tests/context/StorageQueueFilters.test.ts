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
import { TFile } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { ContentProviderType } from '../../src/interfaces/IContentProvider';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import type { FileData } from '../../src/storage/IndexedDBStorage';
import { filterFilesRequiringMetadataSources, filterPdfFilesRequiringThumbnails } from '../../src/context/storageQueueFilters';

class FakeDB {
    private readonly files = new Map<string, FileData>();

    setFile(path: string, data: FileData): void {
        this.files.set(path, data);
    }

    getFiles(paths: string[]): Map<string, FileData> {
        const result = new Map<string, FileData>();
        for (const path of paths) {
            const record = this.files.get(path);
            if (record) {
                result.set(path, record);
            }
        }
        return result;
    }
}

let db: FakeDB;

vi.mock('../../src/storage/fileOperations', () => ({
    getDBInstance: () => db
}));

function createFileData(overrides: Partial<FileData>): FileData {
    return {
        mtime: 0,
        markdownPipelineMtime: 0,
        tagsMtime: 0,
        metadataMtime: 0,
        fileThumbnailsMtime: 0,
        tags: null,
        wordCount: null,
        taskTotal: 0,
        taskUnfinished: 0,
        properties: null,
        previewStatus: 'unprocessed',
        featureImage: null,
        featureImageStatus: 'unprocessed',
        featureImageKey: null,
        metadata: null,
        ...overrides
    };
}

describe('Storage queue filters', () => {
    let settings: NotebookNavigatorSettings;

    beforeEach(() => {
        db = new FakeDB();
        settings = { ...DEFAULT_SETTINGS };
    });

    it('includes markdown files when tagsMtime is reset even if tags already exist', () => {
        const file = new TFile();
        file.path = 'notes/note.md';
        file.extension = 'md';
        file.stat.mtime = 123;

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                tags: ['tag'],
                tagsMtime: 0
            })
        );

        const types: ContentProviderType[] = ['tags'];
        const result = filterFilesRequiringMetadataSources([file], types, settings);

        expect(result).toEqual([file]);
    });

    it('includes markdown files when markdownPipelineMtime is stale even if statuses are processed', () => {
        const file = new TFile();
        file.path = 'notes/note.md';
        file.extension = 'md';
        file.stat.mtime = 456;

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                markdownPipelineMtime: 0,
                previewStatus: 'has',
                featureImageStatus: 'has',
                // Stored custom property items include the source field key and value.
                properties: [{ fieldKey: 'status', value: '1' }]
            })
        );

        const types: ContentProviderType[] = ['markdownPipeline'];
        const result = filterFilesRequiringMetadataSources([file], types, settings);

        expect(result).toEqual([file]);
    });

    it('includes markdown files when featureImageKey is null even if status is not unprocessed', () => {
        const file = new TFile();
        file.path = 'notes/note.md';
        file.extension = 'md';
        file.stat.mtime = 456;

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                markdownPipelineMtime: file.stat.mtime,
                previewStatus: 'has',
                featureImageStatus: 'none',
                featureImageKey: null,
                // Stored custom property items include the source field key and value.
                properties: [{ fieldKey: 'status', value: '1' }]
            })
        );

        settings = { ...settings, showFeatureImage: true };

        const types: ContentProviderType[] = ['markdownPipeline'];
        const result = filterFilesRequiringMetadataSources([file], types, settings);

        expect(result).toEqual([file]);
    });

    it('includes markdown files when task counters are pending', () => {
        const file = new TFile();
        file.path = 'notes/note.md';
        file.extension = 'md';
        file.stat.mtime = 456;

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                markdownPipelineMtime: file.stat.mtime,
                wordCount: 0,
                taskTotal: null,
                taskUnfinished: null,
                previewStatus: 'none',
                featureImageStatus: 'none',
                featureImageKey: ''
            })
        );

        settings = { ...settings, showFilePreview: false, showFeatureImage: false };

        const types: ContentProviderType[] = ['markdownPipeline'];
        const result = filterFilesRequiringMetadataSources([file], types, settings);

        expect(result).toEqual([file]);
    });

    it('includes markdown files conservatively for metadata when hidden rules are active', () => {
        const file = new TFile();
        file.path = 'notes/note.md';
        file.extension = 'md';
        file.stat.mtime = 1111;

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                metadataMtime: file.stat.mtime,
                metadata: { hidden: false }
            })
        );

        settings = {
            ...settings,
            vaultProfiles: [
                {
                    ...settings.vaultProfiles[0],
                    hiddenFileProperties: ['hide']
                }
            ]
        };

        const types: ContentProviderType[] = ['metadata'];
        const strictResult = filterFilesRequiringMetadataSources([file], types, settings);
        expect(strictResult).toEqual([]);

        const conservativeResult = filterFilesRequiringMetadataSources([file], types, settings, { conservativeMetadata: true });
        expect(conservativeResult).toEqual([file]);
    });

    it('includes PDF files when fileThumbnailsMtime is reset even if featureImageKey matches', () => {
        const file = new TFile();
        file.path = 'docs/file.pdf';
        file.extension = 'pdf';
        file.stat.mtime = 789;

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                fileThumbnailsMtime: 0,
                featureImageKey: `f:${file.path}@${file.stat.mtime}`,
                featureImageStatus: 'has'
            })
        );

        settings = { ...settings, showFeatureImage: true };

        const result = filterPdfFilesRequiringThumbnails([file], settings);

        expect(result).toEqual([file]);
    });

    it('excludes PDF files when fileThumbnailsMtime and featureImageKey are up-to-date', () => {
        const file = new TFile();
        file.path = 'docs/file.pdf';
        file.extension = 'pdf';
        file.stat.mtime = 1000;

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                fileThumbnailsMtime: file.stat.mtime,
                featureImageKey: `f:${file.path}@${file.stat.mtime}`,
                featureImageStatus: 'has'
            })
        );

        settings = { ...settings, showFeatureImage: true };

        const result = filterPdfFilesRequiringThumbnails([file], settings);

        expect(result).toEqual([]);
    });
});
