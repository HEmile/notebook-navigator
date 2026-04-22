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
import { type ContentProviderType } from '../../interfaces/IContentProvider';
import { NotebookNavigatorSettings } from '../../settings';
import { FileData } from '../../storage/IndexedDBStorage';
import { getDBInstance } from '../../storage/fileOperations';
import { extractMetadataFromCache } from '../../utils/metadataExtractor';
import { createFrontmatterPropertyExclusionMatcher, shouldExcludeFileWithMatcher } from '../../utils/fileFilters';
import { getActiveHiddenFileProperties } from '../../utils/vaultProfiles';
import { BaseContentProvider, type ContentProviderProcessResult } from './BaseContentProvider';

// Compares two arrays for same members regardless of order
function haveSameMembers(left: string[], right: string[]): boolean {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.every((value, index) => value === sortedRight[index]);
}

/**
 * Content provider for extracting metadata from frontmatter
 */
export class MetadataContentProvider extends BaseContentProvider {
    // Cache of computed hidden states during needsProcessing checks to avoid redundant frontmatter reads
    private pendingHiddenStates = new Map<string, boolean>();

    // Clears cached hidden states when no longer needed
    private clearPendingHiddenStates(): void {
        if (this.pendingHiddenStates.size > 0) {
            this.pendingHiddenStates.clear();
        }
    }

    getContentType(): ContentProviderType {
        return 'metadata';
    }

    getRelevantSettings(): (keyof NotebookNavigatorSettings)[] {
        return [
            'useFrontmatterMetadata',
            'frontmatterNameField',
            'frontmatterIconField',
            'frontmatterColorField',
            'frontmatterBackgroundField',
            'frontmatterCreatedField',
            'frontmatterModifiedField',
            'frontmatterDateFormat',
            'vaultProfile',
            'vaultProfiles'
        ];
    }

    shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean {
        const previousHiddenFileProperties = getActiveHiddenFileProperties(oldSettings);
        const nextHiddenFileProperties = getActiveHiddenFileProperties(newSettings);
        const excludedFilesChanged = !haveSameMembers(previousHiddenFileProperties, nextHiddenFileProperties);
        if (excludedFilesChanged) {
            return true;
        }

        // Clear if metadata extraction is disabled
        if (!newSettings.useFrontmatterMetadata && oldSettings.useFrontmatterMetadata) {
            return true;
        }

        // Regenerate if metadata extraction is enabled and settings changed
        if (newSettings.useFrontmatterMetadata) {
            return (
                oldSettings.useFrontmatterMetadata !== newSettings.useFrontmatterMetadata ||
                oldSettings.frontmatterNameField !== newSettings.frontmatterNameField ||
                oldSettings.frontmatterIconField !== newSettings.frontmatterIconField ||
                oldSettings.frontmatterColorField !== newSettings.frontmatterColorField ||
                oldSettings.frontmatterBackgroundField !== newSettings.frontmatterBackgroundField ||
                oldSettings.frontmatterCreatedField !== newSettings.frontmatterCreatedField ||
                oldSettings.frontmatterModifiedField !== newSettings.frontmatterModifiedField ||
                oldSettings.frontmatterDateFormat !== newSettings.frontmatterDateFormat
            );
        }

        return false;
    }

    async clearContent(_context?: { oldSettings: NotebookNavigatorSettings; newSettings: NotebookNavigatorSettings }): Promise<void> {
        this.clearPendingHiddenStates();
        const db = getDBInstance();
        await db.batchClearAllFileContent('metadata');
    }

    onSettingsChanged(settings: NotebookNavigatorSettings): void {
        super.onSettingsChanged(settings);
        if (getActiveHiddenFileProperties(settings).length === 0) {
            this.clearPendingHiddenStates();
        }
    }

    stopProcessing(): void {
        super.stopProcessing();
        this.clearPendingHiddenStates();
    }

    protected needsProcessing(fileData: FileData | null, file: TFile, settings: NotebookNavigatorSettings): boolean {
        const hiddenFileProperties = getActiveHiddenFileProperties(settings);
        const requiresMetadata = settings.useFrontmatterMetadata || hiddenFileProperties.length > 0;
        if (!requiresMetadata) {
            return false;
        }

        if (file.extension !== 'md') {
            return false;
        }

        const shouldTrackHidden = hiddenFileProperties.length > 0;
        const hiddenFilePropertyMatcher = shouldTrackHidden ? createFrontmatterPropertyExclusionMatcher(hiddenFileProperties) : null;
        // Lazy computation pattern - only check frontmatter when actually needed
        let hiddenStateComputed = false;
        let hiddenState = false;
        // Computes hidden state by checking frontmatter against exclusion patterns
        const computeHiddenState = (): void => {
            if (hiddenStateComputed || !hiddenFilePropertyMatcher) {
                return;
            }
            hiddenState = shouldExcludeFileWithMatcher(file, hiddenFilePropertyMatcher, this.app);
            hiddenStateComputed = true;
        };
        // Saves computed hidden state to cache for later retrieval in processFile
        const storeHiddenState = (): void => {
            if (hiddenStateComputed) {
                this.pendingHiddenStates.set(file.path, hiddenState);
            }
        };

        const needsRefresh = fileData !== null && fileData.metadataMtime !== file.stat.mtime;
        if (!fileData || fileData.metadata === null) {
            computeHiddenState();
            storeHiddenState();
            return true;
        }

        if (needsRefresh) {
            computeHiddenState();
            storeHiddenState();
            return true;
        }

        if (shouldTrackHidden) {
            computeHiddenState();
            const recordedState = fileData.metadata?.hidden;
            if (recordedState !== hiddenState) {
                storeHiddenState();
                return true;
            }
        }

        return false;
    }

    protected async processFile(
        job: { file: TFile; path: string },
        fileData: FileData | null,
        settings: NotebookNavigatorSettings
    ): Promise<ContentProviderProcessResult> {
        if (job.file.extension !== 'md') {
            return { update: null, processed: true };
        }

        const hiddenFileProperties = getActiveHiddenFileProperties(settings);
        const shouldExtractMetadata = settings.useFrontmatterMetadata;
        const shouldTrackHidden = hiddenFileProperties.length > 0;
        const hiddenFilePropertyMatcher = shouldTrackHidden ? createFrontmatterPropertyExclusionMatcher(hiddenFileProperties) : null;
        if (!shouldExtractMetadata && !shouldTrackHidden) {
            return { update: null, processed: true };
        }

        try {
            const cachedMetadata = this.app.metadataCache.getFileCache(job.file);
            if (!cachedMetadata && (shouldExtractMetadata || (shouldTrackHidden && job.file.extension === 'md'))) {
                return { update: null, processed: false };
            }
            const processedMetadata = shouldExtractMetadata ? extractMetadataFromCache(cachedMetadata, settings) : {};

            const fileMetadata: FileData['metadata'] = {};
            if (shouldExtractMetadata) {
                if (processedMetadata.fn) fileMetadata.name = processedMetadata.fn;
                if (processedMetadata.fc !== undefined) fileMetadata.created = processedMetadata.fc;
                if (processedMetadata.fm !== undefined) fileMetadata.modified = processedMetadata.fm;
                if (processedMetadata.icon) fileMetadata.icon = processedMetadata.icon;
                if (processedMetadata.color) fileMetadata.color = processedMetadata.color;
                if (processedMetadata.background) fileMetadata.background = processedMetadata.background;
            }

            if (shouldTrackHidden && job.file.extension === 'md') {
                let hiddenValue: boolean;
                const pendingHiddenState = this.pendingHiddenStates.get(job.path);
                if (pendingHiddenState !== undefined) {
                    hiddenValue = pendingHiddenState;
                    this.pendingHiddenStates.delete(job.path);
                } else {
                    hiddenValue = hiddenFilePropertyMatcher
                        ? shouldExcludeFileWithMatcher(job.file, hiddenFilePropertyMatcher, this.app)
                        : false;
                }
                fileMetadata.hidden = hiddenValue;
            }

            const newMetadata = Object.keys(fileMetadata).length > 0 ? fileMetadata : {};

            // Only return update if metadata changed
            if (fileData && this.metadataEqual(fileData.metadata, newMetadata)) {
                return { update: null, processed: true };
            }

            return { update: { path: job.path, metadata: newMetadata }, processed: true };
        } catch (error) {
            console.error(`Error extracting metadata for ${job.path}:`, error);
            return { update: null, processed: false };
        }
    }

    /**
     * Check if two metadata objects are equal
     * @param meta1 - First metadata object
     * @param meta2 - Second metadata object
     * @returns True if metadata are equal
     */
    private metadataEqual(meta1: FileData['metadata'] | null, meta2: FileData['metadata'] | null): boolean {
        // Null means "not generated yet" and must not be treated as equivalent to an empty object.
        if (meta1 === null && meta2 === null) return true;
        if (meta1 === null || meta2 === null) return false;

        // Check if all keys and values match
        const keys1 = Object.keys(meta1);
        const keys2 = Object.keys(meta2);

        if (keys1.length !== keys2.length) return false;

        return keys1.every(key => {
            const k = key as keyof FileData['metadata'];
            return meta1[k] === meta2[k];
        });
    }
}
