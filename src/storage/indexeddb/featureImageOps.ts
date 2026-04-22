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

import { FeatureImageBlobStore } from '../FeatureImageBlobStore';

interface FeatureImageCoordinatorDeps {
    getDb: () => IDBDatabase | null;
    init: () => Promise<void>;
    isClosing: () => boolean;
    blobs: FeatureImageBlobStore;
}

export class FeatureImageCoordinator {
    private readonly getDb: () => IDBDatabase | null;
    private readonly init: () => Promise<void>;
    private readonly isClosing: () => boolean;
    private readonly blobs: FeatureImageBlobStore;
    // Tracks feature image blob store key moves while a rename is in progress: newPath -> { oldPath, startedAt }.
    // Used so `getFeatureImageBlob(newPath)` can fall back to `oldPath` until the blob record is moved.
    // (`getBlob(newPath, expectedKey)` provides the same behavior inside this coordinator.)
    private readonly moveInFlight = new Map<string, { oldPath: string; startedAt: number }>();

    constructor(deps: FeatureImageCoordinatorDeps) {
        this.getDb = deps.getDb;
        this.init = deps.init;
        this.isClosing = deps.isClosing;
        this.blobs = deps.blobs;
    }

    beginMove(oldPath: string, newPath: string): void {
        if (oldPath === newPath) {
            return;
        }
        // Opportunistic cleanup for failed/abandoned moves.
        this.pruneMovesInFlight();

        const existing = this.moveInFlight.get(newPath);
        if (existing?.oldPath === oldPath) {
            return;
        }
        this.moveInFlight.set(newPath, { oldPath, startedAt: Date.now() });
        // Move any cached thumbnail so the UI can render without waiting for IndexedDB.
        this.blobs.moveCacheEntry(oldPath, newPath);
    }

    async getBlob(path: string, expectedKey: string): Promise<Blob | null> {
        if (!expectedKey) {
            return null;
        }
        await this.init();
        const db = this.getDb();
        if (!db) {
            return null;
        }

        // Opportunistic cleanup so fallback reads don't persist across unrelated operations.
        this.pruneMovesInFlight();

        const blob = await this.blobs.getBlob(db, path, expectedKey);
        if (blob || !this.isMoveInFlight(path)) {
            return blob;
        }

        const tracked = this.moveInFlight.get(path);
        const oldPath = tracked?.oldPath ?? '';
        if (oldPath.length === 0) {
            return blob;
        }

        const fallbackBlob = await this.blobs.getBlob(db, oldPath, expectedKey);
        if (fallbackBlob) {
            // Seed the cache under the new path so subsequent reads are fast.
            this.blobs.moveCacheEntry(oldPath, path);
            return fallbackBlob;
        }

        return blob;
    }

    async forEachBlobRecord(callback: (path: string, record: { featureImageKey: string; blob: Blob }) => void): Promise<void> {
        await this.init();
        const db = this.getDb();
        if (!db) {
            return;
        }
        await this.blobs.forEachBlobRecord(db, callback);
    }

    async moveBlob(oldPath: string, newPath: string): Promise<void> {
        if (oldPath === newPath) {
            return;
        }
        this.beginMove(oldPath, newPath);

        let didMove = false;
        try {
            await this.init();
            const db = this.getDb();
            if (!db) throw new Error('Database not initialized');
            await this.blobs.moveBlob(db, oldPath, newPath);
            didMove = true;
        } catch (error: unknown) {
            if (!this.isClosing()) {
                console.error('[FeatureImageBlob] Failed to move feature image blob', { oldPath, newPath, error });
            }
        } finally {
            if (didMove) {
                this.endMove(oldPath, newPath);
            }
        }
    }

    async deleteBlob(path: string): Promise<void> {
        await this.init();
        const db = this.getDb();
        if (!db) throw new Error('Database not initialized');
        await this.blobs.deleteBlob(db, path);
    }

    close(): void {
        this.moveInFlight.clear();
    }

    private endMove(oldPath: string, newPath: string): void {
        const tracked = this.moveInFlight.get(newPath);
        if (tracked?.oldPath === oldPath) {
            this.moveInFlight.delete(newPath);
        }
    }

    private isMoveInFlight(path: string): boolean {
        return this.moveInFlight.has(path);
    }

    private pruneMovesInFlight(): void {
        // In-flight entries are best-effort and can remain if the IndexedDB move fails.
        // Prune on subsequent operations to keep the map bounded.
        const maxAgeMs = 10_000;
        const cutoff = Date.now() - maxAgeMs;
        for (const [newPath, tracked] of this.moveInFlight.entries()) {
            if (tracked.startedAt <= cutoff) {
                this.moveInFlight.delete(newPath);
            }
        }
    }
}
