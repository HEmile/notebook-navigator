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

/**
 * useListPaneData - Manages file list data for the ListPane component
 *
 * This hook handles:
 * - File collection from folders and tags
 * - Sorting and grouping files by date
 * - Separating pinned and unpinned files
 * - Building list items with headers and spacers
 * - Listening to vault changes and updating the file list
 * - Creating efficient lookup maps for file access
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { TFile, TFolder, debounce } from 'obsidian';
import { useServices, useTopicService } from '../context/ServicesContext';
import { OperationType } from '../services/CommandQueueService';
import { useFileCache } from '../context/StorageContext';
import { ListPaneItemType, ItemType } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { TIMEOUTS } from '../types/obsidian-extended';
import { DateUtils } from '../utils/dateUtils';
import { getFilesForFolder, getFilesForTag, getFilesForTopic, collectPinnedPaths } from '../utils/fileFinder';
import { getDateField, getEffectiveSortOption } from '../utils/sortUtils';
import { strings } from '../i18n';
import { FILE_VISIBILITY } from '../utils/fileTypeUtils';
import { parseFilterSearchTokens, fileMatchesFilterTokens } from '../utils/filterSearch';
import type { NotebookNavigatorSettings } from '../settings';
import type { SearchResultMeta } from '../types/search';
import { createHiddenTagVisibility, normalizeTagPathValue } from '../utils/tagPrefixMatcher';
import { findTopicNode, collectTopicFilePaths } from '../utils/topicGraph';

const EMPTY_SEARCH_META = new Map<string, SearchResultMeta>();

/**
 * Parameters for the useListPaneData hook
 */
interface UseListPaneDataParams {
    /** The type of selection (folder, tag, or topic) */
    selectionType: ItemType | null;
    /** The currently selected folder, if any */
    selectedFolder: TFolder | null;
    /** The currently selected tag, if any */
    selectedTag: string | null;
    /** The currently selected topic, if any */
    selectedTopic: string | null;
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Optional search query to filter files */
    searchQuery?: string;
}

/**
 * Return value of the useListPaneData hook
 */
interface UseListPaneDataResult {
    /** List items including headers, files, and spacers for rendering */
    listItems: ListPaneItem[];
    /** Ordered array of files (without headers) for multi-selection */
    orderedFiles: TFile[];
    /** Map from file path to list item index for O(1) lookups */
    filePathToIndex: Map<string, number>;
    /** Map from file path to position in files array for multi-selection */
    fileIndexMap: Map<string, number>;
    /** Raw array of files before grouping */
    files: TFile[];
    /** Search metadata keyed by file path (populated when using Omnisearch) */
    searchMeta: Map<string, SearchResultMeta>;
}

/**
 * Hook that manages file list data for the ListPane component.
 * Handles file collection, sorting, grouping, and vault change monitoring.
 *
 * @param params - Configuration parameters
 * @returns File list data and lookup maps
 */
export function useListPaneData({
    selectionType,
    selectedFolder,
    selectedTag,
    selectedTopic,
    settings,
    searchQuery
}: UseListPaneDataParams): UseListPaneDataResult {
    const { app, tagTreeService, commandQueue, omnisearchService } = useServices();
    const topicService = useTopicService();
    const { getFileCreatedTime, getFileModifiedTime, getDB, getFileDisplayName } = useFileCache();

    // State to force updates when vault changes (incremented on create/delete/rename)
    const [updateKey, setUpdateKey] = useState(0);
    const [omnisearchResult, setOmnisearchResult] = useState<{
        query: string;
        files: TFile[];
        meta: Map<string, SearchResultMeta>;
    } | null>(null);
    const searchTokenRef = useRef(0);

    const trimmedQuery = searchQuery?.trim() ?? '';
    const hasSearchQuery = trimmedQuery.length > 0;
    const isOmnisearchAvailable = omnisearchService?.isAvailable() ?? false;
    // Use Omnisearch only when selected, available, and there's a query
    const useOmnisearch = settings.searchProvider === 'omnisearch' && isOmnisearchAvailable && hasSearchQuery;

    const sortOption = useMemo(() => {
        if (selectionType === ItemType.TAG && selectedTag) {
            return getEffectiveSortOption(settings, ItemType.TAG, null, selectedTag);
        }
        if (selectionType === ItemType.TOPIC && selectedTopic) {
            return getEffectiveSortOption(settings, ItemType.TOPIC, null, null, selectedTopic);
        }
        return getEffectiveSortOption(settings, ItemType.FOLDER, selectedFolder, selectedTag);
    }, [selectionType, selectedFolder, selectedTag, selectedTopic, settings]);

    /**
     * Calculate the base list of files based on current selection without search filtering.
     * Re-runs when selection changes or vault is modified.
     */
    const baseFiles = useMemo(() => {
        let allFiles: TFile[] = [];

        if (selectionType === ItemType.FOLDER && selectedFolder) {
            allFiles = getFilesForFolder(selectedFolder, settings, app);
        } else if (selectionType === ItemType.TAG && selectedTag) {
            allFiles = getFilesForTag(selectedTag, settings, app, tagTreeService);
        } else if (selectionType === ItemType.TOPIC && selectedTopic) {
            allFiles = getFilesForTopic(selectedTopic, settings, app, topicService);
        }

        return allFiles;
        // NOTE: Excluding getFilesForFolder/getFilesForTag/getFilesForTopic - static imports
        // updateKey triggers re-computation on storage updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectionType, selectedFolder, selectedTag, selectedTopic, settings, app, tagTreeService, topicService, updateKey]);

    // Set of file paths for the current view scope
    const basePathSet = useMemo(() => new Set(baseFiles.map(file => file.path)), [baseFiles]);

    /**
     * Maintain a stateful map of lowercase display names by file path.
     * Rebuild on baseFiles changes; update entries on metadata changes for live name updates.
     */
    const [searchableNames, setSearchableNames] = useState<Map<string, string>>(new Map());

    // Clear Omnisearch results when switching away from it
    useEffect(() => {
        if (!useOmnisearch) {
            setOmnisearchResult(null);
        }
    }, [useOmnisearch]);

    // Execute Omnisearch query when needed
    useEffect(() => {
        if (!useOmnisearch) {
            return;
        }
        if (!omnisearchService) {
            setOmnisearchResult(null);
            return;
        }

        // Remove topic patterns from the query before passing to Omnisearch
        // This allows topic filtering to work as post-processing
        const topicPattern = /(!)?topic:\s*"([^"]+)"/gi;
        const cleanedQuery = trimmedQuery.replace(topicPattern, ' ').trim();

        // Track request to handle race conditions
        const token = ++searchTokenRef.current;
        let disposed = false;

        (async () => {
            try {
                const hits = await omnisearchService.search(cleanedQuery);
                // Ignore stale results
                if (disposed || searchTokenRef.current !== token) {
                    return;
                }

                const meta = new Map<string, SearchResultMeta>();
                const orderedFiles: TFile[] = [];

                for (const hit of hits) {
                    // Skip files outside the current view's scope
                    if (!basePathSet.has(hit.path)) {
                        continue;
                    }
                    orderedFiles.push(hit.file);

                    // Sanitize and normalize match data
                    const matches = hit.matches
                        .filter(match => typeof match.text === 'string' && match.text.length > 0)
                        .map(match => ({
                            offset: match.offset,
                            length: match.length,
                            text: match.text
                        }));

                    const terms = hit.foundWords.filter(word => typeof word === 'string' && word.length > 0);

                    meta.set(hit.path, {
                        score: hit.score,
                        terms,
                        matches,
                        excerpt: hit.excerpt
                    });
                }

                setOmnisearchResult({ query: trimmedQuery, files: orderedFiles, meta });
            } catch {
                if (searchTokenRef.current === token) {
                    setOmnisearchResult({ query: trimmedQuery, files: [], meta: new Map() });
                }
            }
        })();

        return () => {
            disposed = true;
        };
    }, [useOmnisearch, omnisearchService, trimmedQuery, basePathSet]);

    // Rebuild the entire map when the baseFiles list or name provider changes
    useEffect(() => {
        const map = new Map<string, string>();
        for (const file of baseFiles) {
            const name = getFileDisplayName(file);
            map.set(file.path, name.toLowerCase());
        }
        setSearchableNames(map);
    }, [baseFiles, getFileDisplayName]);

    // Incrementally update names when frontmatter changes for files in the current list
    useEffect(() => {
        const basePaths = new Set(baseFiles.map(f => f.path));
        const offref = app.metadataCache.on('changed', changedFile => {
            if (!changedFile) return;
            const path = changedFile.path;
            if (!basePaths.has(path)) return;
            const lower = getFileDisplayName(changedFile).toLowerCase();
            setSearchableNames(prev => {
                const current = prev.get(path);
                if (current === lower) return prev;
                const next = new Map(prev);
                next.set(path, lower);
                return next;
            });
        });
        return () => {
            app.metadataCache.offref(offref);
        };
    }, [app.metadataCache, baseFiles, getFileDisplayName]);

    /**
     * Apply search filter to the base files using the precomputed name map.
     */
    const files = useMemo(() => {
        if (!trimmedQuery) {
            return baseFiles;
        }

        // Parse the search query to extract topic filters (needed for both Omnisearch and regular search)
        const tokens = parseFilterSearchTokens(trimmedQuery);
        
        // Build topic file path sets for filtering
        let topicIncludePaths: Set<string> | null = null;
        let topicExcludePaths: Set<string> | null = null;
        
        if (tokens.topicTokens.length > 0 || tokens.excludeTopicTokens.length > 0) {
            const topicGraph = topicService?.getTopicGraph();
            
            if (topicGraph) {
                // Build set of paths to include based on topic filters
                if (tokens.topicTokens.length > 0) {
                    topicIncludePaths = new Set<string>();
                    for (const topicName of tokens.topicTokens) {
                        const topicNode = findTopicNode(topicGraph, topicName);
                        if (topicNode) {
                            const filePaths = collectTopicFilePaths(topicNode);
                            filePaths.forEach(path => topicIncludePaths!.add(path));
                        }
                    }
                }
                
                // Build set of paths to exclude based on topic filters
                if (tokens.excludeTopicTokens.length > 0) {
                    topicExcludePaths = new Set<string>();
                    for (const topicName of tokens.excludeTopicTokens) {
                        const topicNode = findTopicNode(topicGraph, topicName);
                        if (topicNode) {
                            const filePaths = collectTopicFilePaths(topicNode);
                            filePaths.forEach(path => topicExcludePaths!.add(path));
                        }
                    }
                }
            }
        }

        // Use Omnisearch for full-text search when enabled
        if (useOmnisearch) {
            // Return empty while waiting for search results or if query doesn't match
            if (!omnisearchResult || omnisearchResult.query !== trimmedQuery) {
                return [];
            }

            // Build a set of paths from Omnisearch results for efficient filtering
            const omnisearchPaths = new Set(omnisearchResult.files.map(file => file.path));
            if (omnisearchPaths.size === 0) {
                return [];
            }

            // Filter baseFiles to only include those found by Omnisearch, plus topic filtering
            return baseFiles.filter(file => {
                if (!omnisearchPaths.has(file.path)) {
                    return false;
                }
                
                // Apply topic filtering as post-processing
                if (topicIncludePaths && !topicIncludePaths.has(file.path)) {
                    return false;
                }
                if (topicExcludePaths && topicExcludePaths.has(file.path)) {
                    return false;
                }
                
                return true;
            });
        }

        // Check if any meaningful tokens exist (inclusions or exclusions)
        const hasTokens =
            tokens.nameTokens.length > 0 ||
            tokens.tagTokens.length > 0 ||
            tokens.requireTagged ||
            tokens.excludeNameTokens.length > 0 ||
            tokens.excludeTagTokens.length > 0 ||
            tokens.excludeTagged ||
            tokens.topicTokens.length > 0 ||
            tokens.excludeTopicTokens.length > 0;

        // Skip filtering if no tokens (e.g., query was only connector words)
        if (!hasTokens) {
            return baseFiles;
        }

        // Get database instance for tag lookups
        const db = getDB();

        // Local cache for lowercase tags to avoid repeated transformations
        const lowercaseTagCache = new Map<string, string[]>();

        const filteredByFilterSearch = baseFiles.filter(file => {
            // Apply topic filtering first (early exit for better performance)
            if (topicIncludePaths && !topicIncludePaths.has(file.path)) {
                return false;
            }
            if (topicExcludePaths && topicExcludePaths.has(file.path)) {
                return false;
            }
            
            const name = searchableNames.get(file.path) || '';

            // Performance optimization: Only access the tag cache when the query actually
            // references tags (either for inclusion or exclusion). This avoids expensive
            // tag lookups for simple name-only searches.
            const needsTags =
                tokens.requireTagged || tokens.tagTokens.length > 0 || tokens.excludeTagged || tokens.excludeTagTokens.length > 0;

            let lowercaseTags: string[] = [];
            if (needsTags) {
                const tags = db.getCachedTags(file.path);
                if (tags.length === 0) {
                    // File has no tags - fail if we require tags for inclusion
                    if (tokens.requireTagged || tokens.tagTokens.length > 0) {
                        return false;
                    }
                    // Otherwise, continue with empty tag array for exclusion checks
                    lowercaseTags = [];
                } else {
                    // Performance optimization: Cache lowercase tag arrays to avoid repeated
                    // toLowerCase() calls when checking multiple files
                    let cached = lowercaseTagCache.get(file.path);
                    if (!cached) {
                        cached = tags.map(tag => normalizeTagPathValue(tag)).filter((value): value is string => value.length > 0);
                        lowercaseTagCache.set(file.path, cached);
                    }
                    lowercaseTags = cached;
                }
            }

            return fileMatchesFilterTokens(name, lowercaseTags, tokens);
        });

        // Return the filtered results from the internal filter search
        return filteredByFilterSearch;
    }, [useOmnisearch, trimmedQuery, baseFiles, searchableNames, omnisearchResult, getDB, topicService]);

    /**
     * Build the complete list of items for rendering, including:
     * - Pinned section header and pinned files
     * - Date group headers (if grouping is enabled)
     * - Regular files
     * - Bottom spacer for scroll padding
     */
    const searchMetaMap = useMemo(() => {
        if (useOmnisearch && omnisearchResult) {
            return omnisearchResult.meta;
        }
        return EMPTY_SEARCH_META;
    }, [useOmnisearch, omnisearchResult]);

    const listItems = useMemo(() => {
        const items: ListPaneItem[] = [];

        // Add top spacer at the beginning
        items.push({
            type: ListPaneItemType.TOP_SPACER,
            data: '',
            key: 'top-spacer'
        });

        // Determine context filter based on selection type
        // selectionType can be FOLDER, TAG, TOPIC, FILE, or null - we only use FOLDER and TAG for pinned context
        // Topics use TAG context for pinning since they're conceptually similar
        const contextFilter =
            selectionType === ItemType.TAG || selectionType === ItemType.TOPIC ? ItemType.TAG : 
            selectionType === ItemType.FOLDER ? ItemType.FOLDER : undefined;
        const pinnedPaths = collectPinnedPaths(settings.pinnedNotes, contextFilter);

        // Separate pinned and unpinned files
        const pinnedFiles = files.filter(f => pinnedPaths.has(f.path));
        const unpinnedFiles = files.filter(f => !pinnedPaths.has(f.path));

        // Check if file has tags for height optimization
        const shouldDetectTags = settings.showTags && settings.showFileTags;
        const db = shouldDetectTags ? getDB() : null;
        const hiddenTagVisibility = shouldDetectTags ? createHiddenTagVisibility(settings.hiddenTags, settings.showHiddenItems) : null;
        const fileHasTags =
            shouldDetectTags && db
                ? (file: TFile) => {
                      const tags = db.getCachedTags(file.path);
                      if (!hiddenTagVisibility) {
                          return tags.length > 0;
                      }
                      return hiddenTagVisibility.hasVisibleTags(tags);
                  }
                : () => false;

        // Determine which sort option to use
        // Files are already sorted in fileFinder; preserve order here

        // Track file index for stable onClick handlers
        let fileIndexCounter = 0;

        // Add pinned files
        if (pinnedFiles.length > 0) {
            items.push({
                type: ListPaneItemType.HEADER,
                data: strings.listPane.pinnedSection,
                key: `header-pinned`
            });
            pinnedFiles.forEach(file => {
                items.push({
                    type: ListPaneItemType.FILE,
                    data: file,
                    parentFolder: selectedFolder?.path,
                    key: file.path,
                    fileIndex: fileIndexCounter++,
                    isPinned: true,
                    searchMeta: searchMetaMap.get(file.path),
                    hasTags: fileHasTags(file)
                });
            });
        }

        // Add unpinned files using the configured grouping mode
        const groupingMode = settings.noteGrouping ?? 'none';
        const isTitleSort = sortOption.startsWith('title');
        // Date grouping is only applied when sorting by date
        const shouldGroupByDate =
            (groupingMode === 'date' || (groupingMode === 'folder' && selectionType === ItemType.TAG)) && !isTitleSort;
        const shouldGroupByFolder = groupingMode === 'folder' && selectionType === ItemType.FOLDER;

        if (!shouldGroupByDate && !shouldGroupByFolder) {
            // No grouping
            // If we showed a pinned section and have regular items, insert a split header
            if (pinnedFiles.length > 0 && unpinnedFiles.length > 0) {
                const label =
                    settings.fileVisibility === FILE_VISIBILITY.DOCUMENTS ? strings.listPane.notesSection : strings.listPane.filesSection;
                items.push({
                    type: ListPaneItemType.HEADER,
                    data: label,
                    key: `header-${label}`
                });
            }

            unpinnedFiles.forEach(file => {
                items.push({
                    type: ListPaneItemType.FILE,
                    data: file,
                    parentFolder: selectedFolder?.path,
                    key: file.path,
                    fileIndex: fileIndexCounter++,
                    searchMeta: searchMetaMap.get(file.path),
                    hasTags: fileHasTags(file)
                });
            });
        } else if (shouldGroupByDate) {
            // Group by date
            let currentGroup: string | null = null;
            unpinnedFiles.forEach(file => {
                const dateField = getDateField(sortOption);
                // Get timestamp based on sort field (created or modified)
                const timestamp = dateField === 'ctime' ? getFileCreatedTime(file) : getFileModifiedTime(file);
                const groupTitle = DateUtils.getDateGroup(timestamp);

                if (groupTitle !== currentGroup) {
                    currentGroup = groupTitle;
                    items.push({
                        type: ListPaneItemType.HEADER,
                        data: groupTitle,
                        key: `header-${groupTitle}`
                    });
                }

                items.push({
                    type: ListPaneItemType.FILE,
                    data: file,
                    parentFolder: selectedFolder?.path,
                    key: file.path,
                    fileIndex: fileIndexCounter++,
                    searchMeta: searchMetaMap.get(file.path),
                    hasTags: fileHasTags(file)
                });
            });
        } else {
            // Group by folder (first level relative to current selection or vault root)
            const baseFolderPath = selectedFolder?.path ?? null;
            const baseFolderName = selectedFolder?.name ?? null;
            const basePrefix = baseFolderPath ? `${baseFolderPath}/` : null;
            const vaultRootLabel = strings.navigationPane.vaultRootLabel;
            const vaultRootSortKey = `0-${vaultRootLabel.toLowerCase()}`;
            // Map of folder key to group metadata and files
            const folderGroups = new Map<
                string,
                {
                    label: string;
                    sortKey: string;
                    files: TFile[];
                    isCurrentFolder: boolean;
                }
            >();

            // Determines which folder group a file belongs to based on its parent path
            const resolveFolderGroup = (file: TFile): { key: string; label: string; sortKey: string; isCurrentFolder: boolean } => {
                const parent = file.parent;
                // Files at vault root
                if (!(parent instanceof TFolder)) {
                    return { key: 'folder:/', label: vaultRootLabel, sortKey: vaultRootSortKey, isCurrentFolder: false };
                }

                // When viewing a folder, group by immediate parent folder
                if (selectionType === ItemType.FOLDER && baseFolderPath) {
                    // Files directly in the selected folder
                    if (parent.path === baseFolderPath) {
                        const label = baseFolderName ?? parent.name;
                        return { key: `folder:${baseFolderPath}`, label, sortKey: `0-${label.toLowerCase()}`, isCurrentFolder: true };
                    }
                    // Files in subfolders - group by first level subfolder name
                    if (basePrefix && parent.path.startsWith(basePrefix)) {
                        const relativePath = parent.path.slice(basePrefix.length);
                        const [firstSegment] = relativePath.split('/');
                        if (firstSegment && firstSegment.length > 0) {
                            const label = firstSegment;
                            return {
                                key: `folder:${baseFolderPath}/${label}`,
                                label,
                                sortKey: `1-${label.toLowerCase()}`,
                                isCurrentFolder: false
                            };
                        }
                    }
                }

                // When viewing tags or all files, group by top level folder
                const parentPath = parent.path === '/' ? '' : parent.path;
                const [topLevel] = parentPath.split('/');
                if (topLevel && topLevel.length > 0) {
                    const label = topLevel;
                    return { key: `folder:/${label}`, label, sortKey: `1-${label.toLowerCase()}`, isCurrentFolder: false };
                }

                // Fallback to vault root
                return { key: 'folder:/', label: vaultRootLabel, sortKey: vaultRootSortKey, isCurrentFolder: false };
            };

            // Collect files into folder groups
            unpinnedFiles.forEach(file => {
                const { key, label, sortKey, isCurrentFolder } = resolveFolderGroup(file);
                let group = folderGroups.get(key);
                if (!group) {
                    group = { label, sortKey, files: [], isCurrentFolder };
                    folderGroups.set(key, group);
                }
                group.files.push(file);
            });

            // Sort groups by sort key, then alphabetically by label
            const orderedGroups = Array.from(folderGroups.entries())
                .map(([key, group]) => ({ key, ...group }))
                .sort((a, b) => {
                    if (a.sortKey === b.sortKey) {
                        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
                    }
                    return a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' });
                });

            // Add groups and their files to the items list
            orderedGroups.forEach(group => {
                // Skip header for current folder if there are no pinned notes
                const shouldSkipHeader = group.isCurrentFolder && pinnedFiles.length === 0;
                if (!shouldSkipHeader) {
                    items.push({
                        type: ListPaneItemType.HEADER,
                        data: group.label,
                        key: `header-${group.key}`
                    });
                }

                group.files.forEach(file => {
                    items.push({
                        type: ListPaneItemType.FILE,
                        data: file,
                        parentFolder: selectedFolder?.path,
                        key: file.path,
                        fileIndex: fileIndexCounter++,
                        searchMeta: searchMetaMap.get(file.path),
                        hasTags: fileHasTags(file)
                    });
                });
            });
        }

        // Add spacer at the end so jumping to last position works properly with the virtualizer.
        // Without this, scrolling to the last item may not position it correctly.
        items.push({
            type: ListPaneItemType.BOTTOM_SPACER,
            data: '',
            key: 'bottom-spacer'
        });

        return items;
    }, [files, settings, selectionType, selectedFolder, getFileCreatedTime, getFileModifiedTime, searchMetaMap, sortOption, getDB]);

    /**
     * Create a map from file paths to their index in listItems.
     * Used for efficient file lookups during scrolling and selection.
     */
    const filePathToIndex = useMemo(() => {
        const map = new Map<string, number>();
        listItems.forEach((item, index) => {
            if (item.type === ListPaneItemType.FILE) {
                if (item.data instanceof TFile) {
                    map.set(item.data.path, index);
                }
            }
        });
        return map;
    }, [listItems]);

    /**
     * Create a map from file paths to their position in the files array.
     * Used for multi-selection operations that need file ordering.
     */
    const fileIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        files.forEach((file, index) => {
            map.set(file.path, index);
        });
        return map;
    }, [files]);

    /**
     * Build an ordered array of files (excluding headers and spacers).
     * Used for Shift+Click range selection functionality.
     */
    const orderedFiles = useMemo(() => {
        const files: TFile[] = [];
        listItems.forEach(item => {
            if (item.type === ListPaneItemType.FILE) {
                if (item.data instanceof TFile) {
                    files.push(item.data);
                }
            }
        });
        return files;
    }, [listItems]);

    /**
     * Listen for vault changes and trigger list updates.
     * Handles file creation, deletion, rename, and metadata changes.
     * Uses leading edge debounce for immediate UI feedback.
     */
    useEffect(() => {
        // Trailing debounce for vault-driven updates. Schedules a refresh and
        // extends the timer while more events arrive within FILE_OPERATION_DELAY.
        const scheduleRefresh = debounce(
            () => {
                setUpdateKey(k => k + 1);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );

        // Track ongoing batch operations (move/delete) and defer UI refreshes
        const operationActiveRef = { current: false } as { current: boolean };
        const pendingRefreshRef = { current: false } as { current: boolean };

        // Helper to flush pending updates when operations have settled
        const flushPendingWhenIdle = () => {
            if (!pendingRefreshRef.current) return;
            if (!operationActiveRef.current) {
                pendingRefreshRef.current = false;
                // Run any pending scheduled refresh immediately
                scheduleRefresh.run();
            }
        };

        // Subscribe to command queue operation changes (if available)
        let unsubscribeCQ: (() => void) | null = null;
        if (commandQueue) {
            unsubscribeCQ = commandQueue.onOperationChange((type, active) => {
                if (type === OperationType.MOVE_FILE || type === OperationType.DELETE_FILES) {
                    operationActiveRef.current = active;
                    if (!active) flushPendingWhenIdle();
                }
            });
        }

        const isModifiedSort = sortOption.startsWith('modified');

        const vaultEvents = [
            app.vault.on('create', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
            }),
            app.vault.on('delete', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
            }),
            app.vault.on('rename', () => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
            }),
            app.vault.on('modify', file => {
                if (!isModifiedSort) {
                    return;
                }
                if (!(file instanceof TFile)) {
                    return;
                }
                if (!basePathSet.has(file.path)) {
                    return;
                }
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
            })
        ];
        const metadataEvent = app.metadataCache.on('changed', file => {
            // Only update if the metadata change is for a file in our current view
            if (selectionType === ItemType.FOLDER && selectedFolder) {
                // Check if file is in the selected folder
                const fileFolder = file.parent;
                if (!fileFolder || fileFolder.path !== selectedFolder.path) {
                    // If not showing descendants, ignore files not in this folder
                    if (!settings.includeDescendantNotes) {
                        return;
                    }
                    // If showing descendants, check if it's a descendant
                    if (!fileFolder?.path.startsWith(`${selectedFolder.path}/`)) {
                        return;
                    }
                }
            } else if ((selectionType === ItemType.TAG && selectedTag) || (selectionType === ItemType.TOPIC && selectedTopic)) {
                // For tag/topic view, schedule a trailing refresh and extend if more changes arrive
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
                return;
            }

            // When viewing a folder, we don't need to rebuild the entire file list for metadata changes
            // (only tag view needs rebuilding since files might be added/removed based on tag changes)
            // Individual FileItem components will update themselves through the database subscription
        });

        // Listen for tag changes from database
        const db = getDB();
        const dbUnsubscribe = db.onContentChange(changes => {
            // Check if any files had their tags modified
            const hasTagChanges = changes.some(change => change.changes.tags !== undefined);
            if (!hasTagChanges) {
                return;
            }

            const isTagView = selectionType === ItemType.TAG && selectedTag;
            const isTopicView = selectionType === ItemType.TOPIC && selectedTopic;
            const isFolderView = selectionType === ItemType.FOLDER && selectedFolder;

            let shouldRefresh = false;

            // In tag/topic view, always refresh since files may enter or leave the view
            if (isTagView || isTopicView) {
                shouldRefresh = true;
            } else if (isFolderView) {
                // In folder view, only refresh if changed files are in current folder
                shouldRefresh = changes.some(change => basePathSet.has(change.path));
            }

            if (!shouldRefresh) {
                return;
            }

            // Defer refresh if file operation is active
            if (operationActiveRef.current) {
                pendingRefreshRef.current = true;
            } else {
                scheduleRefresh();
            }
        });

        return () => {
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
            dbUnsubscribe();
            if (unsubscribeCQ) unsubscribeCQ();
            // Cancel any pending scheduled refresh to avoid stray updates
            scheduleRefresh.cancel();
        };
    }, [app, selectionType, selectedTag, selectedTopic, selectedFolder, settings.includeDescendantNotes, getDB, commandQueue, basePathSet, sortOption]);

    return {
        listItems,
        orderedFiles,
        filePathToIndex,
        fileIndexMap,
        files,
        searchMeta: searchMetaMap
    };
}
