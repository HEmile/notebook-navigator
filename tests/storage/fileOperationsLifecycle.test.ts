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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const indexedDbInstances: MockIndexedDBStorage[] = [];

class MockIndexedDBStorage {
    private initialized = false;
    public readonly appId: string;
    public closeCallCount = 0;
    public initCallCount = 0;
    public warmupCallCount = 0;

    constructor(appId: string) {
        this.appId = appId;
        indexedDbInstances.push(this);
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async init(): Promise<void> {
        this.initCallCount += 1;
        this.initialized = true;
    }

    startPreviewTextWarmup(): void {
        this.warmupCallCount += 1;
    }

    close(): void {
        this.closeCallCount += 1;
        this.initialized = false;
    }
}

vi.mock('../../src/storage/IndexedDBStorage', () => ({
    createDefaultFileData: vi.fn(),
    IndexedDBStorage: MockIndexedDBStorage
}));

describe('fileOperations lifecycle', () => {
    beforeEach(() => {
        vi.resetModules();
        indexedDbInstances.length = 0;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null from getDBInstanceOrNull after shutdown', async () => {
        const fileOperations = await import('../../src/storage/fileOperations');

        await fileOperations.initializeDatabase('vault-a');
        expect(fileOperations.getDBInstanceOrNull()).not.toBeNull();

        fileOperations.shutdownDatabase();

        expect(fileOperations.getDBInstanceOrNull()).toBeNull();
        expect(indexedDbInstances).toHaveLength(1);
        expect(indexedDbInstances[0]?.closeCallCount).toBe(1);
    });

    it('marks shutdown state until initializeDatabase is called again', async () => {
        const fileOperations = await import('../../src/storage/fileOperations');

        await fileOperations.initializeDatabase('vault-a');
        expect(fileOperations.isShutdownInProgress()).toBe(false);

        fileOperations.shutdownDatabase();
        expect(fileOperations.isShutdownInProgress()).toBe(true);

        await fileOperations.initializeDatabase('vault-b');
        expect(fileOperations.isShutdownInProgress()).toBe(false);
        expect(fileOperations.getDBInstanceOrNull()).not.toBeNull();
    });

    it('creates a fresh database instance after shutdown and reinitialize', async () => {
        const fileOperations = await import('../../src/storage/fileOperations');

        await fileOperations.initializeDatabase('vault-a');
        fileOperations.shutdownDatabase();

        await fileOperations.initializeDatabase('vault-b');
        const db = fileOperations.getDBInstanceOrNull();

        expect(db).not.toBeNull();
        expect(indexedDbInstances).toHaveLength(2);
        expect(indexedDbInstances[0]?.appId).toBe('vault-a');
        expect(indexedDbInstances[1]?.appId).toBe('vault-b');
    });
});
