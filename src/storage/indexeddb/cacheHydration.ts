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

import { MemoryFileCache } from '../MemoryFileCache';
import type { FileData } from './fileData';
import { normalizeIdbError } from './idbErrors';
import { STORE_NAME } from './constants';
import { normalizeFileDataInPlace } from './normalizeFileData';

export async function hydrateCacheFromMainStore(params: { db: IDBDatabase; cache: MemoryFileCache }): Promise<void> {
    const { db, cache } = params;

    cache.clear();

    // Wrap an IndexedDB request in a promise so it can be awaited.
    const requestToPromise = <T>(request: IDBRequest<T>, fallbackMessage: string): Promise<T> =>
        new Promise((resolveRequest, rejectRequest) => {
            request.onsuccess = () => resolveRequest(request.result);
            request.onerror = () => rejectRequest(normalizeIdbError(request.error, fallbackMessage));
        });

    // Bulk-load the store to avoid per-row cursor callbacks.
    // Use batching to limit peak memory usage on large vaults.
    const batchSize = 5000;
    // Tracks the last key in the previous batch so the next query can resume after it.
    let lastKey: IDBValidKey | null = null;

    while (true) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        // When resuming, start strictly after the last key we processed.
        const range = lastKey === null ? undefined : IDBKeyRange.lowerBound(lastKey, true);

        // Fetch keys and values for the same range/count so indexes line up.
        const keysRequest: IDBRequest<IDBValidKey[]> = store.getAllKeys(range, batchSize);
        const valuesRequest = store.getAll(range, batchSize) as IDBRequest<Partial<FileData>[]>;
        const [keys, values] = await Promise.all([
            requestToPromise(keysRequest, 'getAllKeys failed'),
            requestToPromise(valuesRequest, 'getAll failed')
        ]);

        if (keys.length === 0) {
            break;
        }

        // Apply each row directly into the in-memory cache.
        // Records are persisted by this class and are expected to already be normalized.
        // Avoid allocating new objects during hydration by inserting the stored record directly.
        const rowCount = Math.min(keys.length, values.length);
        for (let index = 0; index < rowCount; index += 1) {
            const key = keys[index];
            if (typeof key !== 'string') {
                continue;
            }
            cache.updateFile(key, normalizeFileDataInPlace(values[index] as Partial<FileData> & { preview?: string | null }, key));
        }

        // Continue from the last key returned in this batch.
        lastKey = keys[keys.length - 1];
        // If IndexedDB returned fewer than the requested count, there are no more rows.
        if (keys.length < batchSize) {
            break;
        }
    }

    // All data loaded, mark cache as ready.
    cache.markInitialized();
}
