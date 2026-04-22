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

import { type FeatureImageStatus, type FileData, getDefaultPreviewStatusForPath, isPropertyData, normalizeTaskCounters } from './fileData';

type MutableFileData = Partial<FileData> & { preview?: string | null; customProperty?: unknown };

export function normalizeFileDataInPlace(data: MutableFileData, pathForDefaults?: string): FileData {
    const featureImageKey = typeof data.featureImageKey === 'string' ? data.featureImageKey : null;
    const rawStatus = data.featureImageStatus;
    const featureImageStatus: FeatureImageStatus =
        rawStatus === 'unprocessed' || rawStatus === 'none' || rawStatus === 'has'
            ? rawStatus
            : featureImageKey === null
              ? 'unprocessed'
              : 'none';

    const rawPreviewStatus = data.previewStatus;
    const previewStatus =
        rawPreviewStatus === 'unprocessed' || rawPreviewStatus === 'none' || rawPreviewStatus === 'has'
            ? rawPreviewStatus
            : typeof data.preview === 'string'
              ? data.preview.length > 0
                  ? 'has'
                  : 'none'
              : typeof pathForDefaults === 'string'
                ? getDefaultPreviewStatusForPath(pathForDefaults)
                : 'unprocessed';

    data.mtime = typeof data.mtime === 'number' ? data.mtime : 0;
    // Default provider processed mtimes to the stored mtime for existing databases.
    // New files explicitly initialize these to 0 so providers run at least once.
    data.markdownPipelineMtime = typeof data.markdownPipelineMtime === 'number' ? data.markdownPipelineMtime : data.mtime;
    data.tagsMtime = typeof data.tagsMtime === 'number' ? data.tagsMtime : data.mtime;
    data.metadataMtime = typeof data.metadataMtime === 'number' ? data.metadataMtime : data.mtime;
    data.fileThumbnailsMtime = typeof data.fileThumbnailsMtime === 'number' ? data.fileThumbnailsMtime : data.mtime;
    data.tags = Array.isArray(data.tags) ? data.tags : null;
    data.wordCount =
        typeof data.wordCount === 'number' && Number.isFinite(data.wordCount) && data.wordCount >= 0 ? Math.trunc(data.wordCount) : null;
    const normalizedTaskCounters = normalizeTaskCounters(data.taskTotal, data.taskUnfinished);
    data.taskTotal = normalizedTaskCounters.taskTotal;
    data.taskUnfinished = normalizedTaskCounters.taskUnfinished;
    const rawProperties = data.properties ?? data.customProperty;
    data.properties = isPropertyData(rawProperties) ? rawProperties : null;
    if ('customProperty' in data) {
        delete data.customProperty;
    }
    data.previewStatus = previewStatus;
    // Feature image blobs are stored separately from the main record.
    // The MemoryFileCache is used for synchronous rendering and should not hold blob payloads.
    data.featureImage = null;
    data.featureImageStatus = featureImageStatus;
    data.featureImageKey = featureImageKey;
    data.metadata = data.metadata && typeof data.metadata === 'object' ? (data.metadata as FileData['metadata']) : null;

    if ('preview' in data) {
        delete data.preview;
    }

    return data as FileData;
}

export function normalizeFileData(data: Partial<FileData> & { preview?: string | null }): FileData {
    const copy: MutableFileData = { ...data };
    return normalizeFileDataInPlace(copy);
}
