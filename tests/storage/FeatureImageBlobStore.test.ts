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
import { FeatureImageBlobStore } from '../../src/storage/FeatureImageBlobStore';

interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
    let resolveFn: ((value: T) => void) | null = null;
    const promise = new Promise<T>(resolve => {
        resolveFn = resolve;
    });
    if (!resolveFn) {
        throw new Error('Deferred initialization failed');
    }
    return { promise, resolve: resolveFn };
}

class TestFeatureImageBlobStore extends FeatureImageBlobStore {
    public readonly reads: Array<{ path: string; expectedKey: string }> = [];
    private deferredReads: Deferred<Blob | null>[] = [];

    protected override readBlobFromStore(_db: IDBDatabase, path: string, expectedKey: string): Promise<Blob | null> {
        this.reads.push({ path, expectedKey });
        const deferred = createDeferred<Blob | null>();
        this.deferredReads.push(deferred);
        return deferred.promise;
    }

    resolveRead(index: number, blob: Blob | null): void {
        const deferred = this.deferredReads[index];
        deferred.resolve(blob);
    }
}

describe('FeatureImageBlobStore', () => {
    it('deduplicates concurrent reads and caches results', async () => {
        const store = new TestFeatureImageBlobStore(10);
        const db = {} as IDBDatabase;
        const blob = new Blob(['x']);

        const first = store.getBlob(db, 'file.md', 'k1');
        const second = store.getBlob(db, 'file.md', 'k1');

        expect(store.reads).toHaveLength(1);

        store.resolveRead(0, blob);

        expect(await first).toBe(blob);
        expect(await second).toBe(blob);

        expect(await store.getBlob(db, 'file.md', 'k1')).toBe(blob);
        expect(store.reads).toHaveLength(1);
    });

    it('avoids caching stale in-flight reads after invalidation', async () => {
        const store = new TestFeatureImageBlobStore(10);
        const db = {} as IDBDatabase;
        const blobOld = new Blob(['old']);
        const blobNew = new Blob(['new']);

        const first = store.getBlob(db, 'file.md', 'k1');
        store.deleteFromCache('file.md');
        const second = store.getBlob(db, 'file.md', 'k1');

        expect(store.reads).toHaveLength(2);

        store.resolveRead(1, blobNew);
        store.resolveRead(0, blobOld);

        expect(await second).toBe(blobNew);
        expect(await first).toBe(blobOld);
        expect(await store.getBlob(db, 'file.md', 'k1')).toBe(blobNew);
    });

    it('moves cached entries between paths', async () => {
        const store = new TestFeatureImageBlobStore(10);
        const db = {} as IDBDatabase;
        const blob = new Blob(['x']);

        const first = store.getBlob(db, 'old.md', 'k1');
        store.resolveRead(0, blob);
        expect(await first).toBe(blob);

        store.moveCacheEntry('old.md', 'new.md');

        expect(await store.getBlob(db, 'new.md', 'k1')).toBe(blob);
        expect(store.reads).toHaveLength(1);
    });
});
