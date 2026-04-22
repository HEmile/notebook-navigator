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

import { App, TFile } from 'obsidian';

interface CachedReadEntry {
    mtime: number;
    expiresAt: number;
    promise: Promise<string>;
}

/**
 * Short-lived cache for shared cachedRead results across content providers.
 */
export class ContentReadCache {
    private readonly cache = new Map<string, CachedReadEntry>();

    constructor(
        private readonly app: App,
        private readonly ttlMs: number = 3000,
        private readonly maxEntries: number = 50
    ) {}

    readFile(file: TFile): Promise<string> {
        const key = file.path;
        const mtime = file.stat.mtime;
        const now = Date.now();
        const existing = this.cache.get(key);
        if (existing && existing.mtime === mtime && existing.expiresAt > now) {
            return existing.promise;
        }

        const promise = this.app.vault.cachedRead(file).catch(error => {
            this.cache.delete(key);
            throw error;
        });

        this.cache.set(key, {
            mtime,
            expiresAt: now + this.ttlMs,
            promise
        });

        this.prune(now);
        return promise;
    }

    private prune(now: number): void {
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt <= now) {
                this.cache.delete(key);
            }
        }

        while (this.cache.size > this.maxEntries) {
            for (const key of this.cache.keys()) {
                this.cache.delete(key);
                break;
            }
        }
    }
}
