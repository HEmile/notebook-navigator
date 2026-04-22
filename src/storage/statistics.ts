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

import type { NotebookNavigatorSettings } from '../settings';
import { isPathInExcludedFolder } from '../utils/fileFilters';
import { getActiveHiddenFolders } from '../utils/vaultProfiles';
import { getDBInstance } from './fileOperations';
import { METADATA_SENTINEL, type FileData } from './IndexedDBStorage';

/**
 * Statistics - Cache analytics and monitoring
 *
 * What it does:
 * - Calculates statistics about cached content for user insights
 * - Counts files with preview text, feature images, and metadata
 * - Estimates total cache size in megabytes
 *
 * Relationships:
 * - Used by: Settings UI (displays cache statistics)
 * - Uses: IndexedDBStorage (streams file data for analysis)
 *
 * Key responsibilities:
 * - Stream through all cached files without loading into memory
 * - Count content types (previews, images, metadata)
 * - Calculate total storage size using JSON serialization
 * - Return statistics for display in settings
 */

export interface CacheStatistics {
    totalItems: number;
    itemsWithTags: number;
    itemsWithPreview: number;
    itemsWithFeature: number;
    itemsWithMetadata: number;
    totalSizeMB: number;
    // Detailed metadata breakdown
    itemsWithMetadataName: number;
    itemsWithMetadataCreated: number;
    itemsWithMetadataModified: number;
    itemsWithMetadataIcon: number;
    itemsWithMetadataColor: number;
    // Failed date parsing counts
    itemsWithFailedCreatedParse: number;
    itemsWithFailedModifiedParse: number;
}

function estimateFileDataSizeBytes(fileData: FileData): number {
    // Exclude blobs from size estimates; the main store keeps featureImage null.
    const jsonSizeBytes = JSON.stringify({ ...fileData, featureImage: null }).length;
    return jsonSizeBytes;
}

export interface MetadataParsingStatistics {
    itemsWithMetadataName: number;
    itemsWithMetadataCreated: number;
    itemsWithMetadataModified: number;
    itemsWithMetadataIcon: number;
    itemsWithMetadataColor: number;
    itemsWithFailedCreatedParse: number;
    itemsWithFailedModifiedParse: number;
}

/**
 * Calculate metadata parsing statistics from the database.
 * Streams only the main file store and skips preview/blob stores.
 *
 * @returns Metadata parsing statistics or null on error
 */
export async function calculateMetadataParsingStatistics(
    settings: NotebookNavigatorSettings,
    showHiddenItems: boolean
): Promise<MetadataParsingStatistics | null> {
    try {
        const db = getDBInstance();

        const hiddenFolders = getActiveHiddenFolders(settings);
        const excludedFolderPatterns = showHiddenItems ? [] : hiddenFolders;

        const stats: MetadataParsingStatistics = {
            itemsWithMetadataName: 0,
            itemsWithMetadataCreated: 0,
            itemsWithMetadataModified: 0,
            itemsWithMetadataIcon: 0,
            itemsWithMetadataColor: 0,
            itemsWithFailedCreatedParse: 0,
            itemsWithFailedModifiedParse: 0
        };

        db.forEachFile((path, fileData) => {
            if (excludedFolderPatterns.length > 0 && isPathInExcludedFolder(path, excludedFolderPatterns)) {
                return;
            }

            const metadata = fileData.metadata;
            if (!metadata) {
                return;
            }

            if (metadata.name) {
                stats.itemsWithMetadataName++;
            }

            const hasValidIcon = typeof metadata.icon === 'string' && metadata.icon.trim().length > 0;
            if (hasValidIcon) {
                stats.itemsWithMetadataIcon++;
            }

            const hasValidColor = typeof metadata.color === 'string' && metadata.color.trim().length > 0;
            const hasValidBackground = typeof metadata.background === 'string' && metadata.background.trim().length > 0;
            if (hasValidColor || hasValidBackground) {
                stats.itemsWithMetadataColor++;
            }

            if (metadata.created !== undefined && metadata.created !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED) {
                if (metadata.created === METADATA_SENTINEL.PARSE_FAILED) {
                    stats.itemsWithFailedCreatedParse++;
                } else {
                    stats.itemsWithMetadataCreated++;
                }
            }

            if (metadata.modified !== undefined && metadata.modified !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED) {
                if (metadata.modified === METADATA_SENTINEL.PARSE_FAILED) {
                    stats.itemsWithFailedModifiedParse++;
                } else {
                    stats.itemsWithMetadataModified++;
                }
            }
        });

        return stats;
    } catch (error) {
        console.error('Failed to calculate metadata parsing statistics:', error);
        return null;
    }
}

export interface MetadataParsingFailurePaths {
    failedCreatedFiles: string[];
    failedModifiedFiles: string[];
}

/**
 * Calculate paths for files where metadata date parsing failed.
 *
 * This is computed on-demand (for export) to avoid allocating large path arrays during live refreshes.
 *
 * @returns Failure path lists or null on error
 */
export async function calculateMetadataParsingFailurePaths(
    settings: NotebookNavigatorSettings,
    showHiddenItems: boolean
): Promise<MetadataParsingFailurePaths | null> {
    try {
        const db = getDBInstance();

        const hiddenFolders = getActiveHiddenFolders(settings);
        const excludedFolderPatterns = showHiddenItems ? [] : hiddenFolders;

        const failedCreatedFiles: string[] = [];
        const failedModifiedFiles: string[] = [];

        db.forEachFile((path, fileData) => {
            if (excludedFolderPatterns.length > 0 && isPathInExcludedFolder(path, excludedFolderPatterns)) {
                return;
            }

            const metadata = fileData.metadata;
            if (!metadata) {
                return;
            }

            if (metadata.created === METADATA_SENTINEL.PARSE_FAILED) {
                failedCreatedFiles.push(path);
            }

            if (metadata.modified === METADATA_SENTINEL.PARSE_FAILED) {
                failedModifiedFiles.push(path);
            }
        });

        return { failedCreatedFiles, failedModifiedFiles };
    } catch (error) {
        console.error('Failed to calculate metadata parsing failure paths:', error);
        return null;
    }
}

/**
 * Calculate statistics from the database.
 * Streams through all files to count items and estimate storage size.
 *
 * @returns Cache statistics or null on error
 */
export async function calculateCacheStatistics(
    settings: NotebookNavigatorSettings,
    showHiddenItems: boolean
): Promise<CacheStatistics | null> {
    try {
        const db = getDBInstance();

        // Retrieves folders hidden by the active vault profile
        const hiddenFolders = getActiveHiddenFolders(settings);
        const excludedFolderPatterns = showHiddenItems ? [] : hiddenFolders;

        const stats: CacheStatistics = {
            totalItems: 0,
            itemsWithTags: 0,
            itemsWithPreview: 0,
            itemsWithFeature: 0,
            itemsWithMetadata: 0,
            totalSizeMB: 0,
            itemsWithMetadataName: 0,
            itemsWithMetadataCreated: 0,
            itemsWithMetadataModified: 0,
            itemsWithMetadataIcon: 0,
            itemsWithMetadataColor: 0,
            itemsWithFailedCreatedParse: 0,
            itemsWithFailedModifiedParse: 0
        };

        let totalSize = 0;

        db.forEachFile((path, fileData) => {
            if (excludedFolderPatterns.length > 0 && isPathInExcludedFolder(path, excludedFolderPatterns)) {
                return;
            }

            stats.totalItems++;

            // Estimate size including path and serialized metadata.
            totalSize += path.length + estimateFileDataSizeBytes(fileData);

            // Check for tags (not null and not empty array)
            if (fileData.tags !== null && fileData.tags.length > 0) {
                stats.itemsWithTags++;
            }

            // Check for metadata (not null and has actual values)
            if (fileData.metadata) {
                // Check if any metadata field has a valid value (not a sentinel value)
                const hasValidName = !!fileData.metadata.name;
                const hasValidCreated =
                    fileData.metadata.created !== undefined &&
                    fileData.metadata.created !== METADATA_SENTINEL.PARSE_FAILED &&
                    fileData.metadata.created !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED;
                const hasValidModified =
                    fileData.metadata.modified !== undefined &&
                    fileData.metadata.modified !== METADATA_SENTINEL.PARSE_FAILED &&
                    fileData.metadata.modified !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED;
                const hasValidIcon = typeof fileData.metadata.icon === 'string' && fileData.metadata.icon.trim().length > 0;
                const hasValidColor = typeof fileData.metadata.color === 'string' && fileData.metadata.color.trim().length > 0;
                const hasValidBackground =
                    typeof fileData.metadata.background === 'string' && fileData.metadata.background.trim().length > 0;

                if (hasValidName || hasValidCreated || hasValidModified || hasValidIcon || hasValidColor || hasValidBackground) {
                    stats.itemsWithMetadata++;
                }

                // Count individual metadata fields
                if (hasValidName) {
                    stats.itemsWithMetadataName++;
                }

                if (hasValidIcon) {
                    stats.itemsWithMetadataIcon++;
                }

                if (hasValidColor || hasValidBackground) {
                    stats.itemsWithMetadataColor++;
                }

                // Handle created date - check for specific sentinel values
                if (fileData.metadata.created !== undefined && fileData.metadata.created !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED) {
                    if (fileData.metadata.created === METADATA_SENTINEL.PARSE_FAILED) {
                        stats.itemsWithFailedCreatedParse++;
                    } else {
                        stats.itemsWithMetadataCreated++;
                    }
                }

                // Handle modified date - check for specific sentinel values
                if (fileData.metadata.modified !== undefined && fileData.metadata.modified !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED) {
                    if (fileData.metadata.modified === METADATA_SENTINEL.PARSE_FAILED) {
                        stats.itemsWithFailedModifiedParse++;
                    } else {
                        stats.itemsWithMetadataModified++;
                    }
                }
            }
        });

        // Stream the blob store for accurate feature image counts and sizes.
        await db.forEachFeatureImageBlobRecord((path, record) => {
            if (excludedFolderPatterns.length > 0 && isPathInExcludedFolder(path, excludedFolderPatterns)) {
                return;
            }

            const fileData = db.getFile(path);
            if (!fileData || fileData.featureImageStatus !== 'has' || !fileData.featureImageKey) {
                return;
            }

            // Only count blobs that match the current key in the main store.
            if (fileData.featureImageKey !== record.featureImageKey) {
                return;
            }

            stats.itemsWithFeature++;
            totalSize += record.blob.size;
        });

        // Stream the preview store for accurate preview counts and sizes.
        await db.forEachPreviewTextRecord((path, previewText) => {
            if (excludedFolderPatterns.length > 0 && isPathInExcludedFolder(path, excludedFolderPatterns)) {
                return;
            }

            stats.itemsWithPreview++;
            totalSize += path.length + previewText.length;
        });

        // Calculate cache size in MB
        stats.totalSizeMB = totalSize / 1024 / 1024;

        return stats;
    } catch (error) {
        console.error('Failed to calculate cache statistics:', error);
        return null;
    }
}
