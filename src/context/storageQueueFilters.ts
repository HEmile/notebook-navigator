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
import type { ContentProviderType } from '../interfaces/IContentProvider';
import type { NotebookNavigatorSettings } from '../settings/types';
import { getDBInstance } from '../storage/fileOperations';
import { isPdfFile } from '../utils/fileTypeUtils';
import { hasPropertyFrontmatterFields } from '../utils/propertyUtils';
import { getActiveHiddenFileProperties } from '../utils/vaultProfiles';
import { getLocalFeatureImageKey } from '../services/content/FeatureImageContentProvider';

type MetadataSourceFilterOptions = {
    /**
     * When true, metadata files are treated conservatively when hidden frontmatter rules are active.
     * This avoids false negatives when the provider's hidden-state logic can change without a stat.mtime update.
     */
    conservativeMetadata?: boolean;
};

/**
 * Returns files that need metadata-dependent content providers to run.
 * Filters out files that already have cached content for the requested types.
 */
export function filterFilesRequiringMetadataSources(
    files: TFile[],
    types: ContentProviderType[],
    settings: NotebookNavigatorSettings,
    options?: MetadataSourceFilterOptions
): TFile[] {
    if (files.length === 0 || types.length === 0) {
        return [];
    }

    const db = getDBInstance();
    const records = db.getFiles(files.map(file => file.path));
    const hiddenFileProperties = getActiveHiddenFileProperties(settings);
    const requiresHiddenState = hiddenFileProperties.length > 0;
    const conservativeMetadata = options?.conservativeMetadata ?? false;
    const propertiesEnabled = hasPropertyFrontmatterFields(settings);
    const needsMarkdownPipeline = types.includes('markdownPipeline');
    const needsTags = types.includes('tags');
    const needsMetadata = types.includes('metadata');

    return files.filter(file => {
        const record = records.get(file.path);
        // Include files not in database
        if (!record) {
            return true;
        }

        // Include files missing tags
        if (needsTags && file.extension === 'md' && (record.tags === null || record.tagsMtime !== file.stat.mtime)) {
            return true;
        }

        if (needsMarkdownPipeline && file.extension === 'md') {
            const needsPreview = settings.showFilePreview && record.previewStatus === 'unprocessed';
            const needsFeatureImage =
                settings.showFeatureImage && (record.featureImageKey === null || record.featureImageStatus === 'unprocessed');
            const needsProperties = propertiesEnabled && record.properties === null;
            const needsWordCount = record.wordCount === null;
            const needsTasks = record.taskTotal === null || record.taskUnfinished === null;
            const needsRefresh = record.markdownPipelineMtime !== file.stat.mtime;
            if (needsRefresh || needsPreview || needsFeatureImage || needsProperties || needsWordCount || needsTasks) {
                return true;
            }
        }

        // Include files missing metadata or hidden state
        if (needsMetadata && file.extension === 'md') {
            const metadata = record.metadata;
            if (requiresHiddenState && conservativeMetadata) {
                return true;
            }
            if (record.metadataMtime !== file.stat.mtime) {
                return true;
            }
            if (metadata === null) {
                return true;
            }
            if (requiresHiddenState && metadata.hidden === undefined) {
                return true;
            }
        }

        return false;
    });
}

/**
 * Returns PDF files that need the file thumbnails provider to run.
 *
 * This resumes forced regeneration across restarts when `fileThumbnailsMtime` was reset without changing FileData.mtime.
 */
export function filterPdfFilesRequiringThumbnails(files: TFile[], settings: NotebookNavigatorSettings): TFile[] {
    if (!settings.showFeatureImage || files.length === 0) {
        return [];
    }

    const pdfFiles = files.filter(file => isPdfFile(file));
    if (pdfFiles.length === 0) {
        return [];
    }

    const db = getDBInstance();
    const records = db.getFiles(pdfFiles.map(file => file.path));

    return pdfFiles.filter(file => {
        const record = records.get(file.path);
        if (!record) {
            return true;
        }

        const fileMtime = file.stat.mtime;
        if (record.fileThumbnailsMtime !== fileMtime) {
            return true;
        }

        if (record.featureImageStatus === 'unprocessed') {
            return true;
        }

        const expectedKey = getLocalFeatureImageKey(file);
        return record.featureImageKey === null || record.featureImageKey !== expectedKey;
    });
}
