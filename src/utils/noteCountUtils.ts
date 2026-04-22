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

import type { App } from 'obsidian';
import { TFile, TFolder } from 'obsidian';
import type { NoteCountInfo } from '../types/noteCounts';
import { shouldDisplayFile, type FileVisibility } from './fileTypeUtils';
import type { HiddenFileNameMatcher } from './fileFilters';
import { createFrontmatterPropertyExclusionMatcher, shouldExcludeFileWithMatcher, shouldExcludeFolder } from './fileFilters';
import { isFolderNote, type FolderNoteDetectionSettings } from './folderNotes';
import type { HiddenTagVisibility } from './tagPrefixMatcher';
import { type CachedFileTagsDB, getCachedFileTags } from './tagUtils';

/**
 * Options for calculating note counts in folders
 */
export interface FolderNoteCountOptions {
    app: App;
    db?: CachedFileTagsDB | null;
    fileVisibility: FileVisibility;
    excludedFiles: string[];
    excludedFileMatcher?: ReturnType<typeof createFrontmatterPropertyExclusionMatcher>;
    excludedFolders: string[];
    fileNameMatcher: HiddenFileNameMatcher | null;
    hiddenFileTagVisibility: HiddenTagVisibility | null;
    includeDescendants: boolean;
    showHiddenFolders: boolean;
    hideFolderNoteInList: boolean;
    folderNoteSettings: FolderNoteDetectionSettings;
    cache?: Map<string, NoteCountInfo>;
}

/**
 * Recursively calculates note counts for a folder and its descendants.
 * Respects visibility settings, exclusion patterns, and folder note handling.
 */
export function calculateFolderNoteCounts(folder: TFolder, options: FolderNoteCountOptions): NoteCountInfo {
    // Check cache for previously computed counts
    const cached = options.cache?.get(folder.path);
    if (cached) {
        return cached;
    }

    let current = 0;
    let descendants = 0;
    const excludedFileMatcher = options.excludedFileMatcher ?? createFrontmatterPropertyExclusionMatcher(options.excludedFiles);

    // Process each child item in the folder
    for (const child of folder.children) {
        if (child instanceof TFile) {
            // Skip folder notes if they should be hidden from the list
            if (
                options.folderNoteSettings.enableFolderNotes &&
                options.hideFolderNoteInList &&
                isFolderNote(child, folder, options.folderNoteSettings)
            ) {
                continue;
            }

            const hiddenFileTagVisibility = options.hiddenFileTagVisibility;
            let hiddenByTags = false;
            if (hiddenFileTagVisibility && hiddenFileTagVisibility.hasHiddenRules && child.extension === 'md') {
                const tags = getCachedFileTags({ app: options.app, file: child, db: options.db });
                if (tags.some(tag => !hiddenFileTagVisibility.isTagVisible(tag))) {
                    hiddenByTags = true;
                }
            }

            // Count files that pass visibility and exclusion checks
            if (
                shouldDisplayFile(child, options.fileVisibility, options.app) &&
                !(options.fileNameMatcher && options.fileNameMatcher.matches(child)) &&
                !shouldExcludeFileWithMatcher(child, excludedFileMatcher, options.app) &&
                !hiddenByTags
            ) {
                current += 1;
            }
        } else if (child instanceof TFolder) {
            // Skip processing subfolders if descendants are not included
            if (!options.includeDescendants) {
                continue;
            }

            // Skip excluded/hidden folders
            if (!options.showHiddenFolders && shouldExcludeFolder(child.name, options.excludedFolders, child.path)) {
                continue;
            }

            // Recursively count notes in subfolder
            const childCounts = calculateFolderNoteCounts(child, options);
            descendants += childCounts.total;
        }
    }

    // Build count info based on includeDescendants setting
    const info: NoteCountInfo = options.includeDescendants
        ? { current, descendants, total: current + descendants }
        : { current, descendants: 0, total: current };

    // Cache the result for future use
    options.cache?.set(folder.path, info);
    return info;
}
