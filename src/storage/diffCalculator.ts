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

import { TFile } from 'obsidian';
import { FileData } from './IndexedDBStorage';
import { getDBInstance } from './fileOperations';

/**
 * DiffCalculator - Efficient vault state synchronization
 *
 * What it does:
 * - Calculates differences between current vault files and cached database state
 * - Identifies files that need to be added, updated, or removed
 * - Uses streaming to handle large vaults efficiently
 *
 * Relationships:
 * - Used by: StorageContext (to detect vault changes)
 * - Uses: IndexedDBStorage (streams cached file data)
 *
 * Key responsibilities:
 * - Stream database files into memory-efficient map
 * - Compare file paths and modification times
 * - Return lists of files to add, update, and remove
 * - Provide cached data for reuse to avoid redundant queries
 */

/**
 * Calculate the difference between the IndexedDB storage and current vault state.
 * Identifies files that need to be added, updated, or removed from the cache.
 * Uses streaming to handle large vaults efficiently.
 *
 * @param currentFiles - Array of current files in the vault
 * @param cachedFiles - Optional pre-loaded cache data (for performance)
 * @returns Object containing arrays of files to add/update/remove and the cached data
 */
export async function calculateFileDiff(
    currentFiles: TFile[],
    cachedFiles?: Map<string, FileData>
): Promise<{
    toAdd: TFile[];
    toUpdate: TFile[];
    toRemove: string[];
    cachedFiles: Map<string, FileData>;
}> {
    const toAdd: TFile[] = [];
    const toUpdate: TFile[] = [];
    const toRemove: string[] = [];
    let cachedFilesMap: Map<string, FileData>;

    // Get cached files from database if not provided
    if (cachedFiles) {
        cachedFilesMap = cachedFiles;
    } else {
        const db = getDBInstance();
        cachedFilesMap = new Map<string, FileData>();
        // Get all files from cache
        db.forEachFile((path, data) => {
            cachedFilesMap.set(path, data);
        });
    }

    // Track current file paths for quick lookup when scanning for removals.
    const currentPaths = new Set<string>();

    // Check each current file
    for (const file of currentFiles) {
        currentPaths.add(file.path);
        const cached = cachedFilesMap.get(file.path);

        if (!cached) {
            // New file not in cache
            toAdd.push(file);
        } else if (file.stat.mtime !== cached.mtime) {
            // File modified since last cache
            toUpdate.push(file);
        }
    }

    // Check for deleted files
    for (const [path] of cachedFilesMap) {
        if (!currentPaths.has(path)) {
            toRemove.push(path);
        }
    }

    return { toAdd, toUpdate, toRemove, cachedFiles: cachedFilesMap };
}
