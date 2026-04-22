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
import { IndexedDBStorage, createDefaultFileData } from '../../src/storage/IndexedDBStorage';
import { MemoryFileCache } from '../../src/storage/MemoryFileCache';
import type { PreviewTextCoordinator } from '../../src/storage/indexeddb/previewTextOps';

class MockIDBRequest<T> {
    result: T;
    error: DOMException | null = null;
    private onSuccessHandler: (() => void) | null = null;
    private onErrorHandler: (() => void) | null = null;
    private isCompleted = false;
    private readonly onComplete: () => void;

    constructor(result: T, onComplete: () => void) {
        this.result = result;
        this.onComplete = onComplete;
    }

    get onsuccess(): (() => void) | null {
        return this.onSuccessHandler;
    }

    set onsuccess(handler: (() => void) | null) {
        this.onSuccessHandler = handler;
        if (handler) {
            handler();
            this.complete();
        }
    }

    get onerror(): (() => void) | null {
        return this.onErrorHandler;
    }

    set onerror(handler: (() => void) | null) {
        this.onErrorHandler = handler;
    }

    private complete(): void {
        if (this.isCompleted) {
            return;
        }
        this.isCompleted = true;
        this.onComplete();
    }
}

class MockIDBTransaction {
    error: DOMException | null = null;
    onabort: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private onCompleteHandler: (() => void) | null = null;
    private pendingRequests = 0;
    private readonly previewTexts: Map<string, string>;

    constructor(previewTexts: Map<string, string>) {
        this.previewTexts = previewTexts;
    }

    get oncomplete(): (() => void) | null {
        return this.onCompleteHandler;
    }

    set oncomplete(handler: (() => void) | null) {
        this.onCompleteHandler = handler;
        this.maybeComplete();
    }

    abort(): void {
        this.onabort?.();
    }

    objectStore(): {
        get: (path: string) => MockIDBRequest<unknown>;
        put: (value: string, path: string) => MockIDBRequest<void>;
        delete: (path: string) => MockIDBRequest<void>;
    } {
        return {
            get: (path: string) => this.createGetRequest(path),
            put: (value: string, path: string) => this.createPutRequest(value, path),
            delete: (path: string) => this.createDeleteRequest(path)
        };
    }

    private createGetRequest(path: string): MockIDBRequest<unknown> {
        this.pendingRequests += 1;
        return new MockIDBRequest(this.previewTexts.get(path), () => {
            this.pendingRequests = Math.max(0, this.pendingRequests - 1);
            this.maybeComplete();
        });
    }

    private createPutRequest(value: string, path: string): MockIDBRequest<void> {
        this.previewTexts.set(path, value);
        return new MockIDBRequest<void>(undefined, () => void 0);
    }

    private createDeleteRequest(path: string): MockIDBRequest<void> {
        this.previewTexts.delete(path);
        return new MockIDBRequest<void>(undefined, () => void 0);
    }

    private maybeComplete(): void {
        if (this.pendingRequests !== 0) {
            return;
        }
        this.onCompleteHandler?.();
    }
}

class MockIDBDatabase {
    private readonly previewTexts: Map<string, string>;

    constructor(previewTexts: Map<string, string>) {
        this.previewTexts = previewTexts;
    }

    transaction(): MockIDBTransaction {
        return new MockIDBTransaction(this.previewTexts);
    }
}

describe('IndexedDBStorage preview text moves', () => {
    it('does not downgrade preview status while a move is in-flight', async () => {
        const oldPath = 'notes/old.md';
        const newPath = 'notes/new.md';
        const previewText = 'Moved preview text';

        const previewTexts = new Map<string, string>([[oldPath, previewText]]);
        const storage = new IndexedDBStorage('test-preview-moves', { previewTextCacheMaxEntries: 10 });

        const cache = Reflect.get(storage, 'cache') as MemoryFileCache;
        cache.markInitialized();

        const seeded = createDefaultFileData({ mtime: 1, path: newPath });
        seeded.previewStatus = 'has';
        storage.seedMemoryFile(newPath, seeded);

        storage.beginPreviewTextMove(oldPath, newPath);

        const previewEvents: (string | null)[] = [];
        const unsubscribe = storage.onFileContentChange(newPath, changes => {
            if (changes.preview !== undefined) {
                previewEvents.push(changes.preview ?? null);
            }
        });

        try {
            storage.init = async () => void 0;
            Reflect.set(storage, 'db', new MockIDBDatabase(previewTexts));
            const previewCoordinator = Reflect.get(storage, 'previewTexts') as PreviewTextCoordinator;
            Reflect.set(previewCoordinator, 'repairPreviewStatusRecords', async () => void 0);

            const previewLoadDeferred = Reflect.get(previewCoordinator, 'previewLoadDeferred') as Map<string, { resolve: () => void }>;
            const previewLoadQueue = Reflect.get(previewCoordinator, 'previewLoadQueue') as Set<string>;

            let wasResolved = false;
            previewLoadDeferred.set(newPath, { resolve: () => (wasResolved = true) });
            previewLoadQueue.add(newPath);

            const flushPreviewTextLoadQueue = Reflect.get(previewCoordinator, 'flushPreviewTextLoadQueue') as () => Promise<void>;
            await flushPreviewTextLoadQueue.call(previewCoordinator);

            expect(wasResolved).toBe(true);
            expect(storage.getFile(newPath)?.previewStatus).toBe('has');
            expect(previewEvents).toEqual([]);

            await storage.movePreviewText(oldPath, newPath);

            expect(wasResolved).toBe(true);
            expect(storage.getCachedPreviewText(newPath)).toBe(previewText);
            expect(previewEvents).toEqual([previewText]);
            expect(previewTexts.has(oldPath)).toBe(false);
            expect(previewTexts.get(newPath)).toBe(previewText);
        } finally {
            unsubscribe();
        }
    });
});
