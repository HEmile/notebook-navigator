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

import { FileData } from './IndexedDBStorage';
import { PreviewTextCache } from './PreviewTextCache';
import { clonePropertyItems } from '../utils/propertyUtils';

// Creates a deep clone of FileData to prevent mutations from affecting the original
function cloneFileData(data: FileData): FileData {
    return {
        mtime: data.mtime,
        markdownPipelineMtime: data.markdownPipelineMtime,
        tagsMtime: data.tagsMtime,
        metadataMtime: data.metadataMtime,
        fileThumbnailsMtime: data.fileThumbnailsMtime,
        tags: data.tags ? [...data.tags] : null,
        wordCount: data.wordCount,
        taskTotal: data.taskTotal,
        taskUnfinished: data.taskUnfinished,
        // Clone property items to prevent consumers from mutating cached records.
        properties: clonePropertyItems(data.properties),
        previewStatus: data.previewStatus,
        // Feature image blobs are stored in IndexedDB, not in the memory cache.
        featureImage: null,
        featureImageStatus: data.featureImageStatus,
        featureImageKey: data.featureImageKey,
        metadata: data.metadata ? { ...data.metadata } : null
    };
}

interface MemoryFileCacheOptions {
    previewTextCacheMaxEntries?: number;
}

/**
 * In-memory file cache for synchronous rendering.
 *
 * Stores:
 * - Main file records for the entire vault (no blob payloads)
 * - A bounded in-memory LRU for preview text strings
 */
export class MemoryFileCache {
    private fileDataByPath = new Map<string, FileData>();
    private readonly previewTexts: PreviewTextCache;
    private isInitialized = false;

    /**
     * Creates an in-memory cache with a bounded preview text LRU.
     */
    constructor(options?: MemoryFileCacheOptions) {
        const maxEntries = options?.previewTextCacheMaxEntries ?? 10000;
        this.previewTexts = new PreviewTextCache(maxEntries);
    }

    /**
     * Mark the cache as initialized after loading data.
     */
    markInitialized(): void {
        this.isInitialized = true;
    }

    /**
     * Clears any cached data but leaves the cache marked as ready.
     * Used when IndexedDB operations succeed but contain no rows.
     */
    resetToEmpty(): void {
        this.fileDataByPath.clear();
        this.previewTexts.clear();
        this.isInitialized = true;
    }

    /**
     * Get file data synchronously.
     */
    getFile(path: string): FileData | null {
        return this.fileDataByPath.get(path) || null;
    }

    /**
     * Get multiple files synchronously.
     */
    getFiles(paths: string[]): Map<string, FileData> {
        const result = new Map<string, FileData>();
        for (const path of paths) {
            const file = this.fileDataByPath.get(path);
            if (file) {
                result.set(path, file);
            }
        }
        return result;
    }

    /**
     * Check if a file has preview text.
     */
    hasPreview(path: string): boolean {
        const file = this.fileDataByPath.get(path);
        return file?.previewStatus === 'has';
    }

    /**
     * Get preview text synchronously.
     * Returns empty string when preview text is not loaded.
     */
    getPreviewText(path: string): string {
        return this.previewTexts.get(path) ?? '';
    }

    /**
     * Check if preview text is currently loaded in the LRU.
     */
    isPreviewTextLoaded(path: string): boolean {
        return this.previewTexts.has(path);
    }

    /**
     * Get loaded preview text entry count.
     */
    getPreviewTextEntryCount(): number {
        return this.previewTexts.getEntryCount();
    }

    /**
     * Check if a file exists in the cache.
     */
    hasFile(path: string): boolean {
        return this.fileDataByPath.has(path);
    }

    /**
     * Get all files as an array (use sparingly).
     */
    getAllFiles(): FileData[] {
        return Array.from(this.fileDataByPath.values());
    }

    /**
     * Get all files with their paths.
     */
    getAllFilesWithPaths(): { path: string; data: FileData }[] {
        const result: { path: string; data: FileData }[] = [];
        for (const [path, data] of this.fileDataByPath.entries()) {
            result.push({ path, data });
        }
        return result;
    }

    /**
     * Get file count without allocating intermediate arrays.
     */
    getFileCount(): number {
        return this.fileDataByPath.size;
    }

    /**
     * Stream all files without creating copies.
     */
    forEachFile(callback: (path: string, data: FileData) => void): void {
        this.fileDataByPath.forEach((data, path) => {
            callback(path, data);
        });
    }

    /**
     * Update or add a file in the cache.
     */
    updateFile(path: string, data: FileData): void {
        this.fileDataByPath.set(path, data);
        if (data.previewStatus !== 'has') {
            this.previewTexts.delete(path);
        }
    }

    // Sets a cloned copy of file data to prevent external modifications
    setClonedFile(path: string, data: FileData): void {
        this.fileDataByPath.set(path, cloneFileData(data));
        if (data.previewStatus !== 'has') {
            this.previewTexts.delete(path);
        }
    }

    /**
     * Update specific file content fields.
     */
    updateFileContent(
        path: string,
        updates: {
            previewText?: string;
            previewStatus?: FileData['previewStatus'];
            featureImage?: Blob | null;
            featureImageKey?: string | null;
            featureImageStatus?: FileData['featureImageStatus'];
            metadata?: FileData['metadata'];
            properties?: FileData['properties'];
        }
    ): void {
        const existing = this.fileDataByPath.get(path);
        if (existing) {
            // Update specific fields
            if (updates.previewStatus !== undefined) {
                existing.previewStatus = updates.previewStatus;
            }
            if (updates.previewText !== undefined) {
                if (updates.previewText.length > 0) {
                    this.previewTexts.set(path, updates.previewText);
                } else {
                    this.previewTexts.delete(path);
                }
            }
            if (existing.previewStatus !== 'has') {
                this.previewTexts.delete(path);
            }
            // Drop blob updates; the memory cache only tracks the key.
            if (updates.featureImage !== undefined) existing.featureImage = null;
            if (updates.featureImageKey !== undefined) existing.featureImageKey = updates.featureImageKey;
            if (updates.featureImageStatus !== undefined) existing.featureImageStatus = updates.featureImageStatus;
            if (updates.metadata !== undefined) existing.metadata = updates.metadata;
            if (updates.properties !== undefined) existing.properties = updates.properties;
        }
    }

    /**
     * Delete a file from the cache.
     */
    deleteFile(path: string): void {
        this.fileDataByPath.delete(path);
        this.previewTexts.delete(path);
    }

    /**
     * Batch delete multiple files from the cache.
     */
    batchDelete(paths: string[]): void {
        for (const path of paths) {
            this.fileDataByPath.delete(path);
            this.previewTexts.delete(path);
        }
    }

    /**
     * Batch update multiple files.
     */
    batchUpdate(updates: { path: string; data: FileData }[]): void {
        for (const { path, data } of updates) {
            this.fileDataByPath.set(path, data);
            if (data.previewStatus !== 'has') {
                this.previewTexts.delete(path);
            }
        }
    }

    /**
     * Batch update file content fields.
     */
    batchUpdateFileContent(
        updates: {
            path: string;
            previewText?: string;
            previewStatus?: FileData['previewStatus'];
            featureImage?: Blob | null;
            featureImageKey?: string | null;
            featureImageStatus?: FileData['featureImageStatus'];
            metadata?: FileData['metadata'];
        }[]
    ): void {
        for (const update of updates) {
            this.updateFileContent(update.path, update);
        }
    }

    /**
     * Check if cache is initialized.
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Clear the entire cache (used during cleanup).
     */
    clear(): void {
        this.fileDataByPath.clear();
        this.previewTexts.clear();
        this.isInitialized = false;
    }
}
