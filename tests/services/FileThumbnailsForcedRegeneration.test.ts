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
import { FeatureImageContentProvider, getLocalFeatureImageKey } from '../../src/services/content/FeatureImageContentProvider';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import type { FileData } from '../../src/storage/IndexedDBStorage';
import type { FeatureImageReference } from '../../src/services/content/featureImageReferenceResolver';

class TestFileThumbnailsProvider extends FeatureImageContentProvider {
    private thumbnailCalls = 0;

    getThumbnailCalls(): number {
        return this.thumbnailCalls;
    }

    getThumbnailDimensionsForTest(settings: NotebookNavigatorSettings) {
        return this.getThumbnailDimensions(settings.featureImagePixelSize);
    }

    async runProcessFile(file: TFile, fileData: FileData | null, settings: NotebookNavigatorSettings) {
        return await this.processFile({ file, path: file.path }, fileData, settings);
    }

    protected async createThumbnailBlob(_reference: FeatureImageReference, _settings: NotebookNavigatorSettings): Promise<Blob | null> {
        this.thumbnailCalls += 1;
        return new Blob([new Uint8Array([1])], { type: 'image/png' });
    }

    protected async yieldToEventLoop(): Promise<void> {}
}

function createFileData(overrides: Partial<FileData>): FileData {
    return {
        mtime: 0,
        markdownPipelineMtime: 0,
        tagsMtime: 0,
        metadataMtime: 0,
        fileThumbnailsMtime: 0,
        tags: [],
        wordCount: 0,
        taskTotal: 0,
        taskUnfinished: 0,
        properties: null,
        previewStatus: 'none',
        featureImage: null,
        featureImageStatus: 'none',
        featureImageKey: null,
        metadata: {},
        ...overrides
    };
}

describe('FeatureImageContentProvider PDF forced regeneration', () => {
    it('tracks featureImagePixelSize as a regeneration setting', () => {
        const app = new App();
        const provider = new TestFileThumbnailsProvider(app);

        expect(provider.getRelevantSettings()).toContain('featureImagePixelSize');
        expect(
            provider.shouldRegenerate(
                { ...DEFAULT_SETTINGS, featureImagePixelSize: '256' },
                { ...DEFAULT_SETTINGS, featureImagePixelSize: '512' }
            )
        ).toBe(true);
    });

    it('maps pixel size settings to thumbnail dimensions', () => {
        const app = new App();
        const provider = new TestFileThumbnailsProvider(app);

        expect(provider.getThumbnailDimensionsForTest({ ...DEFAULT_SETTINGS, featureImagePixelSize: '256' })).toEqual({
            width: 256,
            height: 144
        });
        expect(provider.getThumbnailDimensionsForTest({ ...DEFAULT_SETTINGS, featureImagePixelSize: '384' })).toEqual({
            width: 384,
            height: 216
        });
        expect(provider.getThumbnailDimensionsForTest({ ...DEFAULT_SETTINGS, featureImagePixelSize: '512' })).toEqual({
            width: 512,
            height: 288
        });
    });

    it('re-renders PDFs when fileThumbnailsMtime is stale even if featureImageKey matches', async () => {
        const app = new App();
        const provider = new TestFileThumbnailsProvider(app);

        const file = new TFile();
        file.path = 'docs/file.pdf';
        file.extension = 'pdf';
        file.stat.mtime = 789;

        const expectedKey = getLocalFeatureImageKey(file);
        const fileData = createFileData({
            mtime: file.stat.mtime,
            fileThumbnailsMtime: 0,
            featureImageKey: expectedKey,
            featureImageStatus: 'has'
        });

        const settings: NotebookNavigatorSettings = { ...DEFAULT_SETTINGS, showFeatureImage: true };
        const result = await provider.runProcessFile(file, fileData, settings);

        expect(provider.getThumbnailCalls()).toBe(1);
        expect(result.processed).toBe(true);
        expect(result.update?.path).toBe(file.path);
        expect(result.update?.featureImageKey).toBe(expectedKey);
        expect(result.update?.featureImage instanceof Blob).toBe(true);
        expect((result.update?.featureImage as Blob | undefined)?.size).toBeGreaterThan(0);
    });

    it('skips PDFs when fileThumbnailsMtime and featureImageKey are up-to-date', async () => {
        const app = new App();
        const provider = new TestFileThumbnailsProvider(app);

        const file = new TFile();
        file.path = 'docs/file.pdf';
        file.extension = 'pdf';
        file.stat.mtime = 789;

        const expectedKey = getLocalFeatureImageKey(file);
        const fileData = createFileData({
            mtime: file.stat.mtime,
            fileThumbnailsMtime: file.stat.mtime,
            featureImageKey: expectedKey,
            featureImageStatus: 'has'
        });

        const settings: NotebookNavigatorSettings = { ...DEFAULT_SETTINGS, showFeatureImage: true };
        const result = await provider.runProcessFile(file, fileData, settings);

        expect(provider.getThumbnailCalls()).toBe(0);
        expect(result.processed).toBe(true);
        expect(result.update).toBeNull();
    });
});
