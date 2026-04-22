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

/**
 * PreviewTextCache - LRU cache keyed by file path.
 *
 * Stores a bounded number of preview text strings in memory.
 * Uses insertion order in Map where the first entry is least-recently-used.
 */
export class PreviewTextCache {
    private entries = new Map<string, string>();
    private maxEntries: number;

    constructor(maxEntries: number) {
        this.maxEntries = Math.max(0, maxEntries);
    }

    has(path: string): boolean {
        return this.entries.has(path);
    }

    get(path: string): string | null {
        const entry = this.entries.get(path);
        if (entry === undefined) {
            return null;
        }

        this.entries.delete(path);
        this.entries.set(path, entry);
        return entry;
    }

    set(path: string, previewText: string): void {
        if (this.maxEntries === 0) {
            return;
        }
        if (previewText.length === 0) {
            this.entries.delete(path);
            return;
        }

        if (this.entries.has(path)) {
            this.entries.delete(path);
        }
        this.entries.set(path, previewText);
        this.evictIfNeeded();
    }

    delete(path: string): void {
        this.entries.delete(path);
    }

    clear(): void {
        this.entries.clear();
    }

    getEntryCount(): number {
        return this.entries.size;
    }

    private evictIfNeeded(): void {
        while (this.entries.size > this.maxEntries) {
            const iterator = this.entries.keys();
            const first = iterator.next();
            if (first.done) {
                return;
            }
            this.entries.delete(first.value);
        }
    }
}
