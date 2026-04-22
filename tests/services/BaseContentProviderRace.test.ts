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

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { App, TFile } from 'obsidian';
import type { ContentProviderType } from '../../src/interfaces/IContentProvider';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { FileData } from '../../src/storage/IndexedDBStorage';
import { BaseContentProvider, type ContentProviderProcessResult } from '../../src/services/content/BaseContentProvider';

class FakeDB {
    private readonly files = new Map<string, FileData>();
    private readonly providerMtimeUpdates = new Map<string, number[]>();

    private getProviderMtimeUpdateKey(provider: ContentProviderType, path: string): string {
        return `${provider}::${path}`;
    }

    // Returns applied processed-mtime updates in write order for one provider/path pair.
    getAppliedProviderMtimeUpdates(provider: ContentProviderType, path: string): number[] {
        return [...(this.providerMtimeUpdates.get(this.getProviderMtimeUpdateKey(provider, path)) ?? [])];
    }

    async batchUpdateFileContentAndProviderProcessedMtimes(params: {
        contentUpdates: {
            path: string;
            tags?: string[] | null;
            wordCount?: number | null;
            preview?: string;
            featureImage?: Blob | null;
            featureImageKey?: string | null;
            metadata?: FileData['metadata'];
            properties?: FileData['properties'];
        }[];
        provider?: ContentProviderType;
        processedMtimeUpdates?: { path: string; mtime: number; expectedPreviousMtime: number }[];
    }): Promise<void> {
        const { provider, processedMtimeUpdates } = params;
        if (!provider || !processedMtimeUpdates || processedMtimeUpdates.length === 0) {
            return;
        }

        await this.updateProviderProcessedMtimes(provider, processedMtimeUpdates);
    }

    setFile(path: string, data: FileData): void {
        this.files.set(path, data);
    }

    getFile(path: string): FileData | null {
        return this.files.get(path) ?? null;
    }

    async batchUpdateFileContent(): Promise<void> {}

    async updateProviderProcessedMtimes(
        provider: ContentProviderType,
        updates: { path: string; mtime: number; expectedPreviousMtime: number }[]
    ): Promise<void> {
        for (const update of updates) {
            const existing = this.files.get(update.path);
            if (!existing) {
                continue;
            }

            if (provider === 'markdownPipeline') {
                if (existing.markdownPipelineMtime !== update.expectedPreviousMtime) {
                    continue;
                }
                existing.markdownPipelineMtime = update.mtime;
            } else if (provider === 'tags') {
                if (existing.tagsMtime !== update.expectedPreviousMtime) {
                    continue;
                }
                existing.tagsMtime = update.mtime;
            } else if (provider === 'metadata') {
                if (existing.metadataMtime !== update.expectedPreviousMtime) {
                    continue;
                }
                existing.metadataMtime = update.mtime;
            } else if (provider === 'fileThumbnails') {
                if (existing.fileThumbnailsMtime !== update.expectedPreviousMtime) {
                    continue;
                }
                existing.fileThumbnailsMtime = update.mtime;
            }

            // Records mtime write history for race-order assertions.
            const historyKey = this.getProviderMtimeUpdateKey(provider, update.path);
            const history = this.providerMtimeUpdates.get(historyKey);
            if (history) {
                history.push(update.mtime);
            } else {
                this.providerMtimeUpdates.set(historyKey, [update.mtime]);
            }
        }
    }

    forceProviderMtime(path: string, provider: ContentProviderType, mtime: number): void {
        const existing = this.files.get(path);
        if (!existing) {
            return;
        }

        if (provider === 'markdownPipeline') {
            existing.markdownPipelineMtime = mtime;
        } else if (provider === 'tags') {
            existing.tagsMtime = mtime;
        } else if (provider === 'metadata') {
            existing.metadataMtime = mtime;
        } else if (provider === 'fileThumbnails') {
            existing.fileThumbnailsMtime = mtime;
        }
    }
}

let db: FakeDB;

vi.mock('../../src/storage/fileOperations', () => ({
    getDBInstance: () => db,
    isShutdownInProgress: () => false
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

function createDeferredVoid(): { promise: Promise<void>; resolve: () => void } {
    let resolveFn: (() => void) | null = null;
    const promise = new Promise<void>(resolve => {
        resolveFn = () => resolve(undefined);
    });
    if (!resolveFn) {
        throw new Error('Deferred promise resolver not initialized');
    }
    return { promise, resolve: resolveFn };
}

type ProcessGate = {
    onStarted: () => void;
    release: Promise<void>;
};

class TestTagsProvider extends BaseContentProvider {
    private processCalls = 0;

    constructor(
        app: App,
        private readonly firstCallGate: ProcessGate | null
    ) {
        super(app);
    }

    getCallCount(): number {
        return this.processCalls;
    }

    getQueueSize(): number {
        return this.queue.length;
    }

    async runBatch(settings: NotebookNavigatorSettings): Promise<void> {
        this.onSettingsChanged(settings);
        await this.processNextBatch();
    }

    getContentType(): ContentProviderType {
        return 'tags';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return [];
    }

    shouldRegenerate(): boolean {
        return false;
    }

    async clearContent(): Promise<void> {}

    protected needsProcessing(fileData: FileData | null, file: TFile): boolean {
        return !fileData || fileData.tagsMtime !== file.stat.mtime;
    }

    protected async processFile(): Promise<ContentProviderProcessResult> {
        this.processCalls += 1;

        if (this.processCalls === 1 && this.firstCallGate) {
            this.firstCallGate.onStarted();
            await this.firstCallGate.release;
        }

        return { update: null, processed: true };
    }

    protected async yieldToEventLoop(): Promise<void> {}
}

// Simulates a provider that returns one retry before succeeding.
class RetryOnceTagsProvider extends BaseContentProvider {
    private processCalls = 0;

    getCallCount(): number {
        return this.processCalls;
    }

    async runBatch(settings: NotebookNavigatorSettings): Promise<void> {
        this.onSettingsChanged(settings);
        await this.processNextBatch();
    }

    getContentType(): ContentProviderType {
        return 'tags';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return [];
    }

    shouldRegenerate(): boolean {
        return false;
    }

    async clearContent(): Promise<void> {}

    protected needsProcessing(fileData: FileData | null, file: TFile): boolean {
        return !fileData || fileData.tagsMtime !== file.stat.mtime;
    }

    protected async processFile(): Promise<ContentProviderProcessResult> {
        this.processCalls += 1;
        if (this.processCalls === 1) {
            return { update: null, processed: false };
        }
        return { update: null, processed: true };
    }

    protected async yieldToEventLoop(): Promise<void> {
        await vi.advanceTimersByTimeAsync(1);
    }
}

// Simulates a queued retry path that is removed while another file blocks batch completion.
class RetryAndSkipQueuedPathTagsProvider extends BaseContentProvider {
    protected readonly QUEUE_BATCH_SIZE = 1;
    protected readonly PARALLEL_LIMIT = 1;
    private attemptsByPath = new Map<string, number>();
    private startedBlockingFile = false;

    constructor(
        app: App,
        private readonly retryPath: string,
        private readonly blockingPath: string,
        private readonly blockingGate: Promise<void>
    ) {
        super(app);
    }

    didStartBlockingFile(): boolean {
        return this.startedBlockingFile;
    }

    async runBatch(settings: NotebookNavigatorSettings): Promise<void> {
        this.onSettingsChanged(settings);
        await this.processNextBatch();
    }

    getContentType(): ContentProviderType {
        return 'tags';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return [];
    }

    shouldRegenerate(): boolean {
        return false;
    }

    async clearContent(): Promise<void> {}

    protected needsProcessing(fileData: FileData | null, file: TFile): boolean {
        return !fileData || fileData.tagsMtime !== file.stat.mtime;
    }

    protected async processFile(job: { file: TFile }): Promise<ContentProviderProcessResult> {
        if (job.file.path === this.retryPath) {
            const attempts = (this.attemptsByPath.get(job.file.path) ?? 0) + 1;
            this.attemptsByPath.set(job.file.path, attempts);
            if (attempts === 1) {
                return { update: null, processed: false };
            }
            return { update: null, processed: true };
        }

        if (job.file.path === this.blockingPath) {
            this.startedBlockingFile = true;
            await this.blockingGate;
            return { update: null, processed: true };
        }

        return { update: null, processed: true };
    }

    protected async yieldToEventLoop(): Promise<void> {
        await vi.advanceTimersByTimeAsync(1);
    }
}

describe('BaseContentProvider race handling', () => {
    const settings: NotebookNavigatorSettings = DEFAULT_SETTINGS;

    beforeEach(() => {
        vi.useFakeTimers();
        db = new FakeDB();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('requeues paths queued during processing and snapshots mtime at start', async () => {
        const app = new App();
        const file = new TFile();
        file.path = 'notes/note.md';
        file.stat.mtime = 100;
        app.vault.getAbstractFileByPath = (path: string) => (path === file.path ? file : null);

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                tagsMtime: 0
            })
        );

        let startResolved = false;
        const firstCallGate = createDeferredVoid();

        const provider = new TestTagsProvider(app, {
            onStarted: () => {
                startResolved = true;
            },
            release: firstCallGate.promise
        });

        provider.queueFiles([file]);
        const firstRun = provider.runBatch(settings);

        // Wait until the provider begins processing before simulating a new queue request.
        while (!startResolved) {
            await Promise.resolve();
        }

        file.stat.mtime = 200;
        provider.queueFiles([file]);

        firstCallGate.resolve();

        await firstRun;
        await provider.waitForIdle();

        expect(provider.getCallCount()).toBe(2);
        expect(db.getFile(file.path)?.tagsMtime).toBe(200);
        expect(provider.getQueueSize()).toBe(0);
        expect(db.getAppliedProviderMtimeUpdates('tags', file.path)).toEqual([100, 200]);

        await provider.runBatch(settings);

        expect(provider.getCallCount()).toBe(2);
        expect(db.getFile(file.path)?.tagsMtime).toBe(200);

        provider.stopProcessing();
        vi.runAllTimers();
    });

    it('does not overwrite a forced reset of provider mtimes mid-flight', async () => {
        const app = new App();
        const file = new TFile();
        file.path = 'notes/note.md';
        file.stat.mtime = 200;
        app.vault.getAbstractFileByPath = (path: string) => (path === file.path ? file : null);

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                tagsMtime: 100
            })
        );

        let started = false;
        const firstCallGate = createDeferredVoid();

        const provider = new TestTagsProvider(app, {
            onStarted: () => {
                started = true;
            },
            release: firstCallGate.promise
        });

        provider.queueFiles([file]);
        const runPromise = provider.runBatch(settings);

        while (!started) {
            await Promise.resolve();
        }

        db.forceProviderMtime(file.path, 'tags', 0);

        firstCallGate.resolve();

        await runPromise;

        expect(db.getFile(file.path)?.tagsMtime).toBe(0);

        provider.stopProcessing();
        vi.runAllTimers();
    });

    it('waitForIdle includes scheduled retries', async () => {
        const app = new App();
        const file = new TFile();
        file.path = 'notes/note.md';
        file.stat.mtime = 100;
        app.vault.getAbstractFileByPath = (path: string) => (path === file.path ? file : null);

        db.setFile(
            file.path,
            createFileData({
                mtime: file.stat.mtime,
                tagsMtime: 0
            })
        );

        const provider = new RetryOnceTagsProvider(app);

        provider.queueFiles([file]);
        await provider.runBatch(settings);

        let idleResolved = false;
        const idlePromise = provider.waitForIdle().then(() => {
            idleResolved = true;
        });

        await Promise.resolve();
        expect(idleResolved).toBe(false);

        await vi.advanceTimersByTimeAsync(1000);
        await idlePromise;

        expect(provider.getCallCount()).toBe(2);
        expect(db.getFile(file.path)?.tagsMtime).toBe(100);

        provider.stopProcessing();
        vi.runAllTimers();
    });

    it('waitForIdle resolves after a queued retry path is removed before processing', async () => {
        const app = new App();
        const retryFile = new TFile();
        retryFile.path = 'notes/retry.md';
        retryFile.stat.mtime = 100;

        const blockingFile = new TFile();
        blockingFile.path = 'notes/blocking.md';
        blockingFile.stat.mtime = 200;

        const filesByPath = new Map<string, TFile>([
            [retryFile.path, retryFile],
            [blockingFile.path, blockingFile]
        ]);

        app.vault.getAbstractFileByPath = (path: string) => filesByPath.get(path) ?? null;

        db.setFile(
            retryFile.path,
            createFileData({
                mtime: retryFile.stat.mtime,
                tagsMtime: 0
            })
        );
        db.setFile(
            blockingFile.path,
            createFileData({
                mtime: blockingFile.stat.mtime,
                tagsMtime: 0
            })
        );

        const blockingGate = createDeferredVoid();
        const provider = new RetryAndSkipQueuedPathTagsProvider(app, retryFile.path, blockingFile.path, blockingGate.promise);

        provider.queueFiles([retryFile]);
        await provider.runBatch(settings);

        provider.queueFiles([blockingFile]);
        const blockingRun = provider.runBatch(settings);

        while (!provider.didStartBlockingFile()) {
            await Promise.resolve();
        }

        // Queueing while the blocking file is processing sets up a duplicate path entry before retries flush.
        provider.queueFiles([retryFile]);
        await vi.advanceTimersByTimeAsync(1000);

        // Remove the path before the queued retry can be processed.
        filesByPath.delete(retryFile.path);

        blockingGate.resolve();
        await blockingRun;

        let idleResolved = false;
        const idlePromise = provider.waitForIdle().then(() => {
            idleResolved = true;
        });

        await vi.advanceTimersByTimeAsync(3000);
        await Promise.resolve();
        const resolvedBeforeStop = idleResolved;

        if (!idleResolved) {
            provider.stopProcessing();
            await vi.advanceTimersByTimeAsync(100);
        }
        await idlePromise;

        expect(resolvedBeforeStop).toBe(true);

        provider.stopProcessing();
        vi.runAllTimers();
    });
});
