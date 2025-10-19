/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { TFile, TFolder, App } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';
import { NavigatorContext, PinnedNotes } from '../types';
import { UNTAGGED_TAG_ID } from '../types';
import { shouldExcludeFile, shouldExcludeFolder, getFilteredDocumentFiles, getFilteredFiles, isPathInExcludedFolder } from './fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY } from './fileTypeUtils';
import { getEffectiveSortOption, sortFiles } from './sortUtils';
import { TagTreeService } from '../services/TagTreeService';
import { TopicService } from '../services/TopicGraphService';
import { getDBInstance } from '../storage/fileOperations';
import { extractMetadata } from '../utils/metadataExtractor';
import { METADATA_SENTINEL } from '../storage/IndexedDBStorage';
import { getFileDisplayName as getDisplayName } from './fileNameUtils';
import { isFolderNote } from './folderNotes';
import { createHiddenTagVisibility, normalizeTagPathValue } from './tagPrefixMatcher';
import {  collectTopicDescendants } from './topicGraph';
import { TopicNode } from 'src/types/storage';

/**
 * Collects all pinned note paths from settings
 */
export function collectPinnedPaths(pinnedNotes: PinnedNotes, contextFilter?: NavigatorContext): Set<string> {
    const allPinnedPaths = new Set<string>();

    if (!pinnedNotes || typeof pinnedNotes !== 'object') {
        return allPinnedPaths;
    }

    for (const [path, contexts] of Object.entries(pinnedNotes)) {
        if (!contextFilter) {
            // Include all pinned notes
            allPinnedPaths.add(path);
        } else if (contexts[contextFilter]) {
            // Include if pinned in the specified context
            allPinnedPaths.add(path);
        }
    }

    return allPinnedPaths;
}

/**
 * Gets a sorted list of files for a given folder, respecting all plugin settings.
 * This is the primary utility function to be used by the reducer.
 */
export function getFilesForFolder(folder: TFolder, settings: NotebookNavigatorSettings, app: App): TFile[] {
    const excludedProperties = settings.excludedFiles;

    // Collect files from folder
    const files: TFile[] = [];
    const excludedFolderPatterns = settings.excludedFolders;

    const showHiddenFolders = settings.showHiddenItems;

    const collectFiles = (f: TFolder): void => {
        for (const child of f.children) {
            if (child instanceof TFile) {
                // Check if file should be displayed based on visibility setting
                if (shouldDisplayFile(child, settings.fileVisibility, app)) {
                    files.push(child);
                }
            } else if (settings.includeDescendantNotes && child instanceof TFolder) {
                // Skip excluded folders when collecting files - pass full path for path-based patterns
                // Include excluded folders only when showHiddenItems is true
                if (
                    showHiddenFolders ||
                    excludedFolderPatterns.length === 0 ||
                    !shouldExcludeFolder(child.name, excludedFolderPatterns, child.path)
                ) {
                    collectFiles(child);
                }
            }
        }
    };

    collectFiles(folder);
    let allFiles = files.filter(file => !shouldExcludeFile(file, excludedProperties, app));

    // Filter out folder notes if enabled and set to hide
    if (settings.enableFolderNotes && settings.hideFolderNoteInList) {
        allFiles = allFiles.filter(file => {
            if (file.parent && file.parent instanceof TFolder) {
                return !isFolderNote(file, file.parent, {
                    enableFolderNotes: true,
                    folderNoteName: settings.folderNoteName
                });
            }
            return true;
        });
    }

    const sortOption = getEffectiveSortOption(settings, 'folder', folder);

    if (settings.useFrontmatterMetadata) {
        const metadataCache = new Map<string, ReturnType<typeof extractMetadata>>();
        const getCached = (file: TFile) => {
            let v = metadataCache.get(file.path);
            if (!v) {
                v = extractMetadata(app, file, settings);
                metadataCache.set(file.path, v);
            }
            return v;
        };

        sortFiles(
            allFiles,
            sortOption,
            (file: TFile) => {
                const md = getCached(file);
                if (md.fc === undefined || md.fc === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fc === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.ctime;
                }
                return md.fc;
            },
            (file: TFile) => {
                const md = getCached(file);
                if (md.fm === undefined || md.fm === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fm === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.mtime;
                }
                return md.fm;
            },
            (file: TFile) => {
                const md = getCached(file);
                return getDisplayName(file, { fn: md.fn }, settings);
            }
        );
    } else {
        sortFiles(
            allFiles,
            sortOption,
            (file: TFile) => file.stat.ctime,
            (file: TFile) => file.stat.mtime,
            (file: TFile) => file.basename
        );
    }

    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, 'folder');
    // Separate pinned and unpinned files
    let sortedFiles: TFile[];
    if (pinnedPaths.size === 0) {
        sortedFiles = allFiles;
    } else {
        const pinnedFiles: TFile[] = [];
        const unpinnedFiles: TFile[] = [];

        for (const file of allFiles) {
            if (pinnedPaths.has(file.path)) {
                pinnedFiles.push(file);
            } else {
                unpinnedFiles.push(file);
            }
        }

        sortedFiles = [...pinnedFiles, ...unpinnedFiles];
    }

    return sortedFiles;
}

/**
 * Gets a sorted list of files for a given tag, respecting all plugin settings.
 */
export function getFilesForTag(tag: string, settings: NotebookNavigatorSettings, app: App, tagTreeService: TagTreeService | null): TFile[] {
    // Get all files based on visibility setting, with proper filtering
    let allFiles: TFile[] = [];
    const hiddenTagVisibility = createHiddenTagVisibility(settings.hiddenTags, settings.showHiddenItems);
    const shouldFilterHiddenTags = hiddenTagVisibility.shouldFilterHiddenTags;

    if (settings.fileVisibility === FILE_VISIBILITY.DOCUMENTS) {
        // Only document files (markdown, canvas, base)
        allFiles = getFilteredDocumentFiles(app, settings);
    } else {
        // Get all files with filtering
        allFiles = getFilteredFiles(app, settings);
    }

    const excludedFolderPatterns = settings.excludedFolders;
    // For tag views, exclude files in excluded folders only when hidden items are not shown
    // When showing hidden items, include files from excluded folders to match the tag tree
    const baseFiles = settings.showHiddenItems
        ? allFiles
        : allFiles.filter(
              (file: TFile) => excludedFolderPatterns.length === 0 || !isPathInExcludedFolder(file.path, excludedFolderPatterns)
          );

    let filteredFiles: TFile[] = [];

    const db = getDBInstance();

    // Special case for untagged files
    if (tag === UNTAGGED_TAG_ID) {
        // Only show markdown files in untagged section since only they can be tagged
        filteredFiles = baseFiles.filter(file => {
            if (file.extension !== 'md') {
                return false;
            }
            // Check if the markdown file has tags using our cache
            const fileTags = db.getCachedTags(file.path);
            return fileTags.length === 0;
        });
    } else {
        // For regular tags, only consider markdown files since only they can have tags
        const markdownFiles = baseFiles.filter(file => file.extension === 'md');

        // Find the selected tag node using TagTreeService
        const selectedNode = tagTreeService?.findTagNode(tag) || null;

        if (selectedNode) {
            // Collect tags to include based on setting:
            // - When showing notes from descendants: include selected tag and all descendants
            // - Otherwise: include only the exact selected tag
            const tagsToInclude = settings.includeDescendantNotes
                ? tagTreeService?.collectTagPaths(selectedNode) || new Set<string>()
                : new Set<string>([selectedNode.path]);
            const normalizedTagPaths = new Set(Array.from(tagsToInclude).map(path => normalizeTagPathValue(path)));
            const filteredTagPaths = shouldFilterHiddenTags
                ? new Set(Array.from(normalizedTagPaths).filter(tagPath => hiddenTagVisibility.isTagVisible(tagPath)))
                : normalizedTagPaths;

            if (filteredTagPaths.size === 0) {
                return [];
            }

            // Filter files that have any of the collected tags (case-insensitive)
            filteredFiles = markdownFiles.filter(file => {
                const fileTags = db.getCachedTags(file.path);
                if (fileTags.length === 0) {
                    return false;
                }

                return fileTags.some(tag => {
                    const normalizedTag = normalizeTagPathValue(tag);
                    if (!filteredTagPaths.has(normalizedTag)) {
                        return false;
                    }
                    if (!shouldFilterHiddenTags) {
                        return true;
                    }
                    return hiddenTagVisibility.isTagVisible(tag);
                });
            });
        } else {
            // Fallback to empty if tag not found
            filteredFiles = [];
        }
    }

    // Sort files
    const sortOption = getEffectiveSortOption(settings, 'tag', null, tag);

    if (settings.useFrontmatterMetadata) {
        const metadataCache = new Map<string, ReturnType<typeof extractMetadata>>();
        const getCached = (file: TFile) => {
            let v = metadataCache.get(file.path);
            if (!v) {
                v = extractMetadata(app, file, settings);
                metadataCache.set(file.path, v);
            }
            return v;
        };

        sortFiles(
            filteredFiles,
            sortOption,
            (file: TFile) => {
                const md = getCached(file);
                if (md.fc === undefined || md.fc === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fc === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.ctime;
                }
                return md.fc;
            },
            (file: TFile) => {
                const md = getCached(file);
                if (md.fm === undefined || md.fm === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fm === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.mtime;
                }
                return md.fm;
            },
            (file: TFile) => {
                const md = getCached(file);
                return getDisplayName(file, { fn: md.fn }, settings);
            }
        );
    } else {
        sortFiles(
            filteredFiles,
            sortOption,
            (file: TFile) => file.stat.ctime,
            (file: TFile) => file.stat.mtime,
            (file: TFile) => file.basename
        );
    }

    // Handle pinned notes for tag context
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, 'tag');
    // Separate pinned and unpinned files
    if (pinnedPaths.size === 0) {
        return filteredFiles;
    }
    const pinnedFiles: TFile[] = [];
    const unpinnedFiles: TFile[] = [];

    for (const file of filteredFiles) {
        if (pinnedPaths.has(file.path)) {
            pinnedFiles.push(file);
        } else {
            unpinnedFiles.push(file);
        }
    }

    return [...pinnedFiles, ...unpinnedFiles];
}

/**
 * Gets a sorted list of files for a given topic, respecting all plugin settings.
 */
export function getFilesForTopic(topicName: string, settings: NotebookNavigatorSettings, app: App, topicService: TopicService | null): TFile[] {
    console.log('getFilesForTopic', topicName);
    // Get all files based on visibility setting, with proper filtering
    let allFiles: TFile[] = [];

    if (settings.fileVisibility === FILE_VISIBILITY.DOCUMENTS) {
        // Only document files (markdown, canvas, base)
        allFiles = getFilteredDocumentFiles(app, settings);
    } else {
        // Get all files with filtering
        allFiles = getFilteredFiles(app, settings);
    }

    let filteredFiles: TFile[] = [];
    const selectedNode = topicService?.findTopicNode(topicName);

    if (selectedNode) {
        // Collect topics to include based on setting:
        // - When showing notes from descendants: include selected topic and all descendants
        // - Otherwise: include only the exact selected topic
        const topicsToInclude = settings.includeDescendantNotes
            ? collectTopicDescendants(selectedNode)
            : new Set<TopicNode>([selectedNode]);

        if (topicsToInclude.size === 0) {
            return [];
        }

        // Collect all files from the selected topic and its descendants
        let filesToInclude = new Set<string>();
        for (const topic of topicsToInclude) {
            filesToInclude = new Set([...filesToInclude, ...topic.notesWithTag]);
        }
        for (const filePath of filesToInclude) {
            const file = app.vault.getFileByPath(filePath);
            if (file) {
                filteredFiles.push(file);
            } else {
                console.error(`File not found: ${filePath}`);
            }
        }
    } else {
        // Fallback to empty if topic not found
        filteredFiles = [];
    }

    // Sort files
    const sortOption = getEffectiveSortOption(settings, 'topic', null, null, topicName);

    if (settings.useFrontmatterMetadata) {
        const metadataCache = new Map<string, ReturnType<typeof extractMetadata>>();
        const getCached = (file: TFile) => {
            let v = metadataCache.get(file.path);
            if (!v) {
                v = extractMetadata(app, file, settings);
                metadataCache.set(file.path, v);
            }
            return v;
        };

        sortFiles(
            filteredFiles,
            sortOption,
            (file: TFile) => {
                const md = getCached(file);
                if (md.fc === undefined || md.fc === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fc === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.ctime;
                }
                return md.fc;
            },
            (file: TFile) => {
                const md = getCached(file);
                if (md.fm === undefined || md.fm === METADATA_SENTINEL.FIELD_NOT_CONFIGURED || md.fm === METADATA_SENTINEL.PARSE_FAILED) {
                    return file.stat.mtime;
                }
                return md.fm;
            },
            (file: TFile) => {
                const md = getCached(file);
                return getDisplayName(file, { fn: md.fn }, settings);
            }
        );
    } else {
        sortFiles(
            filteredFiles,
            sortOption,
            (file: TFile) => file.stat.ctime,
            (file: TFile) => file.stat.mtime,
            (file: TFile) => file.basename
        );
    }

    // Handle pinned notes for tag context (topics share pinning with tags)
    const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, 'tag');
    // Separate pinned and unpinned files
    if (pinnedPaths.size === 0) {
        return filteredFiles;
    }
    const pinnedFiles: TFile[] = [];
    const unpinnedFiles: TFile[] = [];

    for (const file of filteredFiles) {
        if (pinnedPaths.has(file.path)) {
            pinnedFiles.push(file);
        } else {
            unpinnedFiles.push(file);
        }
    }

    console.log('filteredFiles', filteredFiles);
    console.log('pinnedFiles', pinnedFiles);
    console.log('unpinnedFiles', unpinnedFiles);

    return [...pinnedFiles, ...unpinnedFiles];
}
