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
import { TFile, TFolder, debounce, normalizePath } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { OperationType } from '../services/CommandQueueService';
import { useFileCache } from '../context/StorageContext';
import { useLocalDayKey } from './useLocalDayKey';
import { ListPaneItemType, ItemType, PINNED_SECTION_HEADER_KEY } from '../types';
import type { VisibilityPreferences } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { TIMEOUTS } from '../types/obsidian-extended';
import { DateUtils } from '../utils/dateUtils';
import { collectPinnedPaths } from '../utils/fileFinder';
import {
    createFrontmatterPropertyExclusionMatcher,
    createHiddenFileNameMatcher,
    isFolderInExcludedFolder,
    shouldExcludeFileWithMatcher
} from '../utils/fileFilters';
import {
    compareByAlphaSortOrder,
    getDateField,
    getEffectiveSortOption,
    isDateSortOption,
    resolveFolderChildSortOrder,
    shouldRefreshOnFileModifyForSort,
    shouldRefreshOnMetadataChangeForSort,
    resolveDefaultDateField
} from '../utils/sortUtils';
import { strings } from '../i18n';
import { FILE_VISIBILITY } from '../utils/fileTypeUtils';
import {
    parseFilterSearchTokens,
    fileMatchesDateFilterTokens,
    fileMatchesFilterTokens,
    filterSearchHasActiveCriteria,
    filterSearchNeedsTagLookup,
    filterSearchNeedsPropertyLookup,
    filterSearchRequiresTagsForEveryMatch
} from '../utils/filterSearch';
import type { NotebookNavigatorSettings } from '../settings';
import type { FilterSearchMatchOptions, FilterSearchTokens } from '../utils/filterSearch';
import type { SearchResultMeta } from '../types/search';
import { createHiddenTagVisibility, normalizeTagPathValue } from '../utils/tagPrefixMatcher';
import { resolveListGrouping } from '../utils/listGrouping';
import { runAsyncAction } from '../utils/async';
import type { ActiveProfileState } from '../context/SettingsContext';
import type { SearchProvider } from '../types/search';
import { PreviewTextUtils } from '../utils/previewTextUtils';
import { getCachedFileTags } from '../utils/tagUtils';
import { createOmnisearchHighlightQueryTokenContext, sanitizeOmnisearchHighlightTokens } from '../utils/omnisearchHighlight';
import { foldSearchText } from '../utils/recordUtils';
import { normalizePropertyTreeValuePath, type PropertySelectionNodeId } from '../utils/propertyTree';
import { getFilesForNavigationSelection } from '../utils/selectionUtils';
import { getActivePropertyFields } from '../utils/vaultProfiles';

const EMPTY_SEARCH_META = new Map<string, SearchResultMeta>();
// Shared empty map used when no files are hidden to avoid allocations
const EMPTY_HIDDEN_STATE = new Map<string, boolean>();
// Shared empty property map used when a file has no searchable properties.
const EMPTY_FILTER_SEARCH_PROPERTIES = new Map<string, string[]>();
// Shared sentinel array used when only tag presence is required
const TAG_PRESENCE_SENTINEL = ['__nn_tag_present__'];

/**
 * Parameters for the useListPaneData hook
 */
interface UseListPaneDataParams {
    /** The type of selection (folder, tag, or property) */
    selectionType: ItemType | null;
    /** The currently selected folder, if any */
    selectedFolder: TFolder | null;
    /** The currently selected tag, if any */
    selectedTag: string | null;
    /** The currently selected property key/value, if any */
    selectedProperty: PropertySelectionNodeId | null;
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Active profile-derived values */
    activeProfile: ActiveProfileState;
    /** Active search provider to use for filtering */
    searchProvider: SearchProvider;
    /** Optional search query to filter files */
    searchQuery?: string;
    /** Pre-parsed search tokens matching the debounced query */
    searchTokens?: FilterSearchTokens;
    /** Visibility preferences that control descendant notes and hidden items */
    visibility: VisibilityPreferences;
}

/**
 * Return value of the useListPaneData hook
 */
interface UseListPaneDataResult {
    /** List items including headers, files, and spacers for rendering */
    listItems: ListPaneItem[];
    /** Ordered array of files (without headers) for multi-selection */
    orderedFiles: TFile[];
    /** Map from file path to index within orderedFiles array */
    orderedFileIndexMap: Map<string, number>;
    /** Map from file path to list item index for O(1) lookups */
    filePathToIndex: Map<string, number>;
    /** Map from file path to position in files array for multi-selection */
    fileIndexMap: Map<string, number>;
    /** Raw array of files before grouping */
    files: TFile[];
    /** Search metadata keyed by file path (populated when using Omnisearch) */
    searchMeta: Map<string, SearchResultMeta>;
    /** Local day key in YYYY-MM-DD format */
    localDayKey: string;
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
    selectedProperty,
    settings,
    activeProfile,
    searchProvider,
    searchQuery,
    searchTokens,
    visibility
}: UseListPaneDataParams): UseListPaneDataResult {
    const { app, tagTreeService, propertyTreeService, commandQueue, omnisearchService } = useServices();
    const { getFileTimestamps, getDB, getFileDisplayName } = useFileCache();
    const { includeDescendantNotes, showHiddenItems } = visibility;
    const dayKey = useLocalDayKey();

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
    const useOmnisearch = searchProvider === 'omnisearch' && isOmnisearchAvailable && hasSearchQuery;
    const hasTaskSearchFilters = useMemo(() => {
        if (!trimmedQuery || useOmnisearch) {
            return false;
        }

        const tokens = searchTokens ?? parseFilterSearchTokens(trimmedQuery);
        if (!filterSearchHasActiveCriteria(tokens)) {
            return false;
        }

        return tokens.requireUnfinishedTasks || tokens.excludeUnfinishedTasks;
    }, [trimmedQuery, useOmnisearch, searchTokens]);
    /**
     * Optional folder scope passed to Omnisearch.
     *
     * Scope is only provided for folder selections because that is where
     * Omnisearch can narrow results by path. Tag selections intentionally skip
     * scope injection because tag views are not represented by a single folder
     * path and may span unrelated locations in the vault.
     *
     * The service applies additional safety checks before injecting `path:"..."`.
     * If the path is not considered safe, the query is executed unchanged.
     */
    const omnisearchPathScope = useMemo(() => {
        if (selectionType !== ItemType.FOLDER || !selectedFolder) {
            return undefined;
        }
        return selectedFolder.path;
    }, [selectionType, selectedFolder]);
    const { hiddenFolders, hiddenFileProperties, hiddenFileNames, hiddenTags, hiddenFileTags, fileVisibility } = activeProfile;
    const hiddenFilePropertyMatcher = useMemo(
        () => createFrontmatterPropertyExclusionMatcher(hiddenFileProperties),
        [hiddenFileProperties]
    );
    const listConfig = useMemo(
        () => ({
            pinnedNotes: settings.pinnedNotes,
            filterPinnedByFolder: settings.filterPinnedByFolder,
            showPinnedGroupHeader: settings.showPinnedGroupHeader ?? true,
            showTags: settings.showTags,
            showFileTags: settings.showFileTags,
            noteGrouping: settings.noteGrouping,
            folderAppearances: settings.folderAppearances,
            tagAppearances: settings.tagAppearances,
            folderSortOrder: settings.folderSortOrder,
            folderTreeSortOverrides: settings.folderTreeSortOverrides
        }),
        [
            settings.filterPinnedByFolder,
            settings.folderAppearances,
            settings.folderSortOrder,
            settings.folderTreeSortOverrides,
            settings.noteGrouping,
            settings.pinnedNotes,
            settings.showFileTags,
            settings.showPinnedGroupHeader,
            settings.showTags,
            settings.tagAppearances
        ]
    );

    const sortOption = useMemo(() => {
        if (selectionType === ItemType.TAG && selectedTag) {
            return getEffectiveSortOption(settings, ItemType.TAG, null, selectedTag);
        }
        return getEffectiveSortOption(settings, ItemType.FOLDER, selectedFolder, selectedTag);
    }, [selectionType, selectedFolder, selectedTag, settings]);
    const activePropertyFields = getActivePropertyFields(settings);

    /**
     * Calculate the base list of files based on current selection without search filtering.
     * Re-runs when selection changes or vault is modified.
     */
    const baseFiles = useMemo(() => {
        return getFilesForNavigationSelection(
            {
                selectionType,
                selectedFolder,
                selectedTag,
                selectedProperty
            },
            settings,
            visibility,
            app,
            tagTreeService,
            propertyTreeService
        );
        // NOTE: Excluding getFilesForNavigationSelection - static import
        // updateKey triggers re-computation on storage updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectionType,
        selectedFolder,
        selectedTag,
        selectedProperty,
        activeProfile.profile.id,
        activeProfile.hiddenFolders,
        activeProfile.hiddenFileProperties,
        activeProfile.hiddenFileNames,
        activeProfile.hiddenTags,
        activeProfile.hiddenFileTags,
        activeProfile.fileVisibility,
        settings.enableFolderNotes,
        settings.hideFolderNoteInList,
        settings.folderNoteName,
        settings.folderNoteNamePattern,
        settings.useFrontmatterMetadata,
        settings.frontmatterNameField,
        settings.frontmatterCreatedField,
        settings.frontmatterModifiedField,
        settings.frontmatterDateFormat,
        settings.filterPinnedByFolder,
        settings.pinnedNotes,
        settings.defaultFolderSort,
        settings.propertySortKey,
        settings.propertySortSecondary,
        activePropertyFields,
        settings.showProperties,
        settings.folderSortOverrides,
        settings.tagSortOverrides,
        propertyTreeService,
        includeDescendantNotes,
        showHiddenItems,
        app,
        tagTreeService,
        updateKey
    ]);

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

        // Track request to handle race conditions
        const token = ++searchTokenRef.current;
        let disposed = false;

        // Execute omnisearch
        runAsyncAction(async () => {
            try {
                // Pass folder scope to Omnisearch so path filtering can run inside
                // Omnisearch's own ranking pipeline. This improves relevance when
                // the vault has many global matches outside the current folder.
                //
                // The service only injects scope when:
                // - no user `path:` filter is already present
                // - the folder path passes ASCII/simple-path safety checks
                //
                // If those conditions are not met, this call behaves like the
                // previous implementation and sends only `trimmedQuery`.
                const hits = await omnisearchService.search(trimmedQuery, {
                    pathScope: omnisearchPathScope
                });
                // Ignore stale results
                if (disposed || searchTokenRef.current !== token) {
                    return;
                }

                const meta = new Map<string, SearchResultMeta>();
                const orderedFiles: TFile[] = [];
                const queryTokenContext = createOmnisearchHighlightQueryTokenContext(trimmedQuery);

                for (const hit of hits) {
                    // Skip files outside the current view's scope
                    if (!basePathSet.has(hit.path)) {
                        continue;
                    }
                    orderedFiles.push(hit.file);

                    // Filter highlight tokens against the active query.
                    const { matches, terms } = sanitizeOmnisearchHighlightTokens(hit.matches, hit.foundWords, queryTokenContext);
                    // Omnisearch excerpts are normalized on every search update; keep this cheap.
                    // HTML stripping is intentionally disabled regardless of stripHtmlInPreview to avoid
                    // additional per-keystroke processing on large excerpts.
                    const excerpt =
                        typeof hit.excerpt === 'string' ? PreviewTextUtils.normalizeExcerpt(hit.excerpt, { stripHtml: false }) : undefined;

                    meta.set(hit.path, {
                        score: hit.score,
                        terms,
                        matches,
                        excerpt
                    });
                }

                setOmnisearchResult({ query: trimmedQuery, files: orderedFiles, meta });
            } catch {
                if (searchTokenRef.current === token) {
                    setOmnisearchResult({ query: trimmedQuery, files: [], meta: new Map() });
                }
            }
        });

        return () => {
            disposed = true;
        };
    }, [useOmnisearch, omnisearchService, trimmedQuery, omnisearchPathScope, basePathSet]);

    // Rebuild the entire map when the baseFiles list or name provider changes
    useEffect(() => {
        const map = new Map<string, string>();
        for (const file of baseFiles) {
            const name = getFileDisplayName(file);
            // Store folded names once and reuse during every filter pass.
            map.set(file.path, foldSearchText(name));
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
            // Keep incremental updates aligned with the initial folded representation.
            const lower = foldSearchText(getFileDisplayName(changedFile));
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

            // Filter baseFiles to only include those found by Omnisearch
            return baseFiles.filter(file => omnisearchPaths.has(file.path));
        }

        // Parse the search query into filter tokens
        const tokens = searchTokens ?? parseFilterSearchTokens(trimmedQuery);

        // Skip filtering if query contains no meaningful criteria
        if (!filterSearchHasActiveCriteria(tokens)) {
            return baseFiles;
        }

        // Check if date filtering is needed and resolve which date field to use
        const hasDateFilters = tokens.dateRanges.length > 0 || tokens.excludeDateRanges.length > 0;
        const hasTaskFilters = tokens.requireUnfinishedTasks || tokens.excludeUnfinishedTasks;
        const hasFolderFilters = tokens.folderTokens.length > 0 || tokens.excludeFolderTokens.length > 0;
        const hasExtensionFilters = tokens.extensionTokens.length > 0 || tokens.excludeExtensionTokens.length > 0;
        const defaultDateField = resolveDefaultDateField(sortOption, settings.alphabeticalDateMode ?? 'modified');

        // Check if we need to access tag metadata for any file
        const needsTagLookup = filterSearchNeedsTagLookup(tokens);
        const needsPropertyLookup = filterSearchNeedsPropertyLookup(tokens);
        // Check if all inclusion clauses require files to have tags
        const requireTaggedMatches = filterSearchRequiresTagsForEveryMatch(tokens);
        const requiresNormalizedTagValues = tokens.mode === 'tag' || tokens.tagTokens.length > 0 || tokens.excludeTagTokens.length > 0;

        const db = getDB();

        const emptyTags: string[] = [];

        const normalizeTagsForFilterSearch = (rawTags: readonly string[]): string[] => {
            // Tag values are normalized to canonical tag paths, then folded for accent-insensitive comparison.
            return rawTags.map(tag => foldSearchText(normalizeTagPathValue(tag))).filter((value): value is string => value.length > 0);
        };

        const normalizePropertiesForFilterSearch = (properties: { fieldKey: string; value: string }[] | null): Map<string, string[]> => {
            if (!properties || properties.length === 0) {
                return EMPTY_FILTER_SEARCH_PROPERTIES;
            }

            const normalizedValues = new Map<string, Set<string>>();
            properties.forEach(entry => {
                // Fold property keys with the same search normalization used by parsed property tokens.
                const normalizedKey = foldSearchText(entry.fieldKey.trim());
                if (!normalizedKey) {
                    return;
                }

                let values = normalizedValues.get(normalizedKey);
                if (!values) {
                    values = new Set<string>();
                    normalizedValues.set(normalizedKey, values);
                }

                const normalizedValue = normalizePropertyTreeValuePath(entry.value);
                if (!normalizedValue) {
                    return;
                }
                // `normalizePropertyTreeValuePath` handles property-specific cleanup (trim/wiki-link display text).
                // Folded values are then compared against folded query tokens.
                values.add(foldSearchText(normalizedValue));
            });

            const normalized = new Map<string, string[]>();
            normalizedValues.forEach((values, key) => {
                normalized.set(key, Array.from(values));
            });

            return normalized;
        };

        const filteredByFilterSearch = baseFiles.filter(file => {
            const foldedName = searchableNames.get(file.path) || '';
            const fileData = hasTaskFilters || needsTagLookup || needsPropertyLookup ? db.getFile(file.path) : null;
            const hasUnfinishedTasks = hasTaskFilters && typeof fileData?.taskUnfinished === 'number' && fileData.taskUnfinished > 0;
            const needsMatchOptions = hasTaskFilters || hasFolderFilters || hasExtensionFilters;
            let matchOptions: FilterSearchMatchOptions | undefined;
            if (needsMatchOptions) {
                matchOptions = { hasUnfinishedTasks };

                if (hasFolderFilters) {
                    // Folder paths are folded before matching with parsed folder tokens.
                    matchOptions.foldedFolderPath = foldSearchText(file.parent?.path ?? '');
                }

                if (hasExtensionFilters) {
                    // Extension values are folded before direct equality checks.
                    matchOptions.foldedExtension = foldSearchText(file.extension);
                }
            }

            if (needsPropertyLookup) {
                // Property keys/values are folded once per file before property token evaluation.
                const propertyValuesByKey = normalizePropertiesForFilterSearch(fileData?.properties ?? null);
                if (matchOptions) {
                    matchOptions = { ...matchOptions, propertyValuesByKey };
                } else {
                    matchOptions = { hasUnfinishedTasks, propertyValuesByKey };
                }
            }

            // Skip tag extraction when no tag token requires tag metadata.
            if (!needsTagLookup) {
                if (!fileMatchesFilterTokens(foldedName, emptyTags, tokens, matchOptions)) {
                    return false;
                }

                if (!hasDateFilters) {
                    return true;
                }

                const timestamps = getFileTimestamps(file);
                return fileMatchesDateFilterTokens(
                    { created: timestamps.created, modified: timestamps.modified, defaultField: defaultDateField },
                    tokens
                );
            }

            const rawTags = getCachedFileTags({ app, file, db, fileData });
            const hasTags = rawTags.length > 0;

            // Early return if file must have tags but has none
            if (requireTaggedMatches && !hasTags) {
                return false;
            }

            let foldedTags: string[];
            if (!hasTags) {
                foldedTags = emptyTags;
            } else if (requiresNormalizedTagValues) {
                // Tag expression mode and tag token matching require folded tag path values.
                foldedTags = normalizeTagsForFilterSearch(rawTags);
            } else {
                // Sentinel preserves "has tags" semantics without per-tag normalization when only presence is needed.
                foldedTags = TAG_PRESENCE_SENTINEL;
            }

            if (!fileMatchesFilterTokens(foldedName, foldedTags, tokens, matchOptions)) {
                return false;
            }

            if (!hasDateFilters) {
                return true;
            }

            const timestamps = getFileTimestamps(file);
            return fileMatchesDateFilterTokens(
                { created: timestamps.created, modified: timestamps.modified, defaultField: defaultDateField },
                tokens
            );
        });

        // Return the filtered results from the internal filter search
        return filteredByFilterSearch;
    }, [
        useOmnisearch,
        trimmedQuery,
        baseFiles,
        searchableNames,
        omnisearchResult,
        getDB,
        getFileTimestamps,
        searchTokens,
        sortOption,
        settings.alphabeticalDateMode,
        app
    ]);

    // Builds map of file paths that are normally hidden but shown via "show hidden items"
    const hiddenFileState = useMemo(() => {
        if (!showHiddenItems || files.length === 0) {
            return EMPTY_HIDDEN_STATE;
        }

        const db = getDB();
        const records = db.getFiles(files.map(file => file.path));
        const shouldCheckFolders = hiddenFolders.length > 0;
        const shouldCheckFrontmatter = hiddenFilePropertyMatcher.hasCriteria;
        const shouldCheckFileNames = hiddenFileNames.length > 0;
        const shouldCheckFileTags = hiddenFileTags.length > 0;
        const fileNameMatcher = shouldCheckFileNames ? createHiddenFileNameMatcher(hiddenFileNames) : null;
        const hiddenFileTagVisibility = shouldCheckFileTags ? createHiddenTagVisibility(hiddenFileTags, false) : null;
        const folderHiddenCache = shouldCheckFolders ? new Map<string, boolean>() : null;
        const result = new Map<string, boolean>();

        // Checks if a folder is in an excluded folder pattern with caching
        const resolveFolderHidden = (folder: TFolder | null): boolean => {
            if (!folderHiddenCache || !folder) {
                return false;
            }
            if (folderHiddenCache.has(folder.path)) {
                return folderHiddenCache.get(folder.path) ?? false;
            }
            const hidden = isFolderInExcludedFolder(folder, hiddenFolders);
            folderHiddenCache.set(folder.path, hidden);
            return hidden;
        };

        files.forEach(file => {
            const record = records.get(file.path);
            let hiddenByFrontmatter = false;
            if (shouldCheckFrontmatter && file.extension === 'md') {
                if (record?.metadata?.hidden === undefined) {
                    hiddenByFrontmatter = shouldExcludeFileWithMatcher(file, hiddenFilePropertyMatcher, app);
                } else {
                    hiddenByFrontmatter = Boolean(record.metadata?.hidden);
                }
            }
            const hiddenByFileName = fileNameMatcher ? fileNameMatcher.matches(file) : false;
            const hiddenByFolder = shouldCheckFolders ? resolveFolderHidden(file.parent ?? null) : false;
            const hiddenByTags =
                hiddenFileTagVisibility !== null &&
                hiddenFileTagVisibility.hasHiddenRules &&
                file.extension === 'md' &&
                getCachedFileTags({ app, file, db, fileData: record ?? null }).some(
                    tagValue => !hiddenFileTagVisibility.isTagVisible(tagValue)
                );

            if (hiddenByFrontmatter || hiddenByFileName || hiddenByFolder || hiddenByTags) {
                result.set(file.path, true);
            }
        });

        return result;
    }, [files, getDB, hiddenFolders, hiddenFilePropertyMatcher, hiddenFileNames, hiddenFileTags, showHiddenItems, app]);

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
        // selectionType can be FOLDER, TAG, PROPERTY, FILE, or null - only context-backed types are used for pinned filtering
        const contextFilter =
            selectionType === ItemType.TAG
                ? ItemType.TAG
                : selectionType === ItemType.FOLDER
                  ? ItemType.FOLDER
                  : selectionType === ItemType.PROPERTY
                    ? ItemType.PROPERTY
                    : undefined;
        const restrictToFolderPath =
            listConfig.filterPinnedByFolder && selectionType === ItemType.FOLDER && selectedFolder ? selectedFolder.path : undefined;
        const pinnedPaths = collectPinnedPaths(
            listConfig.pinnedNotes,
            contextFilter,
            restrictToFolderPath !== undefined ? { restrictToFolderPath } : undefined
        );

        // Separate pinned and unpinned files
        const pinnedFiles = files.filter(f => pinnedPaths.has(f.path));
        const unpinnedFiles = files.filter(f => !pinnedPaths.has(f.path));

        // Check if file has tags for height optimization
        const db = getDB();
        const shouldDetectTags = listConfig.showTags && listConfig.showFileTags;
        const hiddenTagVisibility = shouldDetectTags ? createHiddenTagVisibility(hiddenTags, showHiddenItems) : null;
        const fileHasTags = shouldDetectTags
            ? (file: TFile) => {
                  const tags = getCachedFileTags({ app, file, db });
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

        // Helper to push file items with consistent computed properties
        type FileItemOverrides = Partial<Omit<ListPaneItem, 'type' | 'data' | 'key' | 'fileIndex' | 'searchMeta' | 'hasTags' | 'isHidden'>>;
        const pushFileItem = (file: TFile, overrides: FileItemOverrides = {}) => {
            const baseItem: ListPaneItem = {
                type: ListPaneItemType.FILE,
                data: file,
                parentFolder: selectedFolder?.path,
                key: file.path,
                fileIndex: fileIndexCounter++,
                searchMeta: searchMetaMap.get(file.path),
                hasTags: fileHasTags(file),
                isHidden: hiddenFileState.get(file.path) ?? false
            };
            items.push({ ...baseItem, ...overrides });
        };

        // Controls whether to show header above pinned notes section
        const showPinnedGroupHeader = listConfig.showPinnedGroupHeader;

        // Add pinned files
        if (pinnedFiles.length > 0) {
            if (showPinnedGroupHeader) {
                items.push({
                    type: ListPaneItemType.HEADER,
                    data: strings.listPane.pinnedSection,
                    key: PINNED_SECTION_HEADER_KEY
                });
            }
            pinnedFiles.forEach(file => {
                pushFileItem(file, { isPinned: true });
            });
        }

        // Resolve effective grouping mode (handles global default + per-folder/tag overrides)
        const groupingInfo = resolveListGrouping({
            settings: {
                noteGrouping: listConfig.noteGrouping,
                folderAppearances: listConfig.folderAppearances,
                tagAppearances: listConfig.tagAppearances
            },
            selectionType: selectionType ?? undefined,
            folderPath: selectedFolder ? selectedFolder.path : null,
            tag: selectedTag ?? null
        });
        const groupingMode = groupingInfo.effectiveGrouping;
        // Date grouping is only applied when sorting by date
        const shouldGroupByDate = groupingMode === 'date' && isDateSortOption(sortOption);
        const shouldGroupByFolder = groupingMode === 'folder' && selectionType === ItemType.FOLDER;

        if (!shouldGroupByDate && !shouldGroupByFolder) {
            // No grouping
            // If pinned notes exist and there are regular items, insert a header before regular notes
            if (pinnedFiles.length > 0 && unpinnedFiles.length > 0) {
                const label = fileVisibility === FILE_VISIBILITY.DOCUMENTS ? strings.listPane.notesSection : strings.listPane.filesSection;
                items.push({
                    type: ListPaneItemType.HEADER,
                    data: label,
                    key: `header-${label}`
                });
            }

            unpinnedFiles.forEach(file => {
                pushFileItem(file);
            });
        } else if (shouldGroupByDate) {
            // Group by date
            const now = DateUtils.parseLocalDayKey(dayKey) ?? new Date();
            const dateField = getDateField(sortOption);

            let currentGroup: string | null = null;
            unpinnedFiles.forEach(file => {
                // Get timestamp based on sort field (created or modified)
                const timestamps = getFileTimestamps(file);
                const timestamp = dateField === 'ctime' ? timestamps.created : timestamps.modified;
                const groupTitle = DateUtils.getDateGroup(timestamp, now);

                if (groupTitle !== currentGroup) {
                    currentGroup = groupTitle;
                    items.push({
                        type: ListPaneItemType.HEADER,
                        data: groupTitle,
                        key: `header-${groupTitle}`
                    });
                }

                pushFileItem(file);
            });
        } else {
            // Group by folder (first level relative to current selection or vault root)
            const baseFolderPath = selectedFolder?.path ?? null;
            const baseFolderName = selectedFolder?.name ?? null;
            const basePrefix = baseFolderPath ? `${baseFolderPath}/` : null;
            const vaultRootLabel = strings.navigationPane.vaultRootLabel;
            const folderGroupSortOrder = resolveFolderChildSortOrder(
                {
                    folderSortOrder: listConfig.folderSortOrder,
                    folderTreeSortOverrides: listConfig.folderTreeSortOverrides
                },
                baseFolderPath ?? '/'
            );
            // Map of folder key to group metadata and files
            const folderGroups = new Map<
                string,
                {
                    label: string;
                    files: TFile[];
                    isCurrentFolder: boolean;
                    folderPath: string | null;
                }
            >();

            // Determines which folder group a file belongs to based on its parent path
            const resolveFolderGroup = (
                file: TFile
            ): { key: string; label: string; isCurrentFolder: boolean; folderPath: string | null } => {
                const parent = file.parent;
                // Files at vault root
                if (!(parent instanceof TFolder)) {
                    return { key: 'folder:/', label: vaultRootLabel, isCurrentFolder: false, folderPath: null };
                }

                // When viewing a folder, group by immediate parent folder
                if (selectionType === ItemType.FOLDER && baseFolderPath) {
                    // Files directly in the selected folder
                    if (parent.path === baseFolderPath) {
                        const label = baseFolderName ?? parent.name;
                        const folderPath = baseFolderPath === '/' ? null : baseFolderPath;
                        return {
                            key: `folder:${baseFolderPath}`,
                            label,
                            isCurrentFolder: true,
                            folderPath
                        };
                    }
                    // Files in subfolders - group by first level subfolder name
                    if (basePrefix && parent.path.startsWith(basePrefix)) {
                        const relativePath = parent.path.slice(basePrefix.length);
                        const [firstSegment] = relativePath.split('/');
                        if (firstSegment && firstSegment.length > 0) {
                            const label = firstSegment;
                            const folderPath = normalizePath(
                                !baseFolderPath || baseFolderPath === '/' ? label : `${baseFolderPath}/${label}`
                            );
                            return {
                                key: `folder:${baseFolderPath}/${label}`,
                                label,
                                isCurrentFolder: false,
                                folderPath
                            };
                        }
                    }
                }

                // When viewing tags or all files, group by top level folder
                const parentPath = parent.path === '/' ? '' : parent.path;
                const [topLevel] = parentPath.split('/');
                if (topLevel && topLevel.length > 0) {
                    const label = topLevel;
                    return {
                        key: `folder:/${label}`,
                        label,
                        isCurrentFolder: false,
                        folderPath: topLevel
                    };
                }

                // Fallback to vault root
                return { key: 'folder:/', label: vaultRootLabel, isCurrentFolder: false, folderPath: null };
            };

            // Collect files into folder groups
            unpinnedFiles.forEach(file => {
                const { key, label, isCurrentFolder, folderPath } = resolveFolderGroup(file);
                let group = folderGroups.get(key);
                if (!group) {
                    group = { label, files: [], isCurrentFolder, folderPath };
                    folderGroups.set(key, group);
                }
                group.files.push(file);
            });

            // Sort groups using the selected folder's child-folder order.
            const orderedGroups = Array.from(folderGroups.entries())
                .map(([key, group]) => ({ key, ...group }))
                .sort((a, b) => {
                    if (a.isCurrentFolder !== b.isCurrentFolder) {
                        return a.isCurrentFolder ? -1 : 1;
                    }

                    const labelCompare = compareByAlphaSortOrder(a.label, b.label, folderGroupSortOrder);
                    if (labelCompare !== 0) {
                        return labelCompare;
                    }

                    if (a.key === b.key) {
                        return 0;
                    }
                    return a.key < b.key ? -1 : 1;
                });

            // Add groups and their files to the items list
            orderedGroups.forEach(group => {
                if (group.files.length === 0) {
                    return;
                }

                if (!group.isCurrentFolder || pinnedFiles.length > 0) {
                    items.push({
                        type: ListPaneItemType.HEADER,
                        data: group.label,
                        headerFolderPath: group.folderPath,
                        key: `header-${group.key}`
                    });
                }

                group.files.forEach(file => {
                    pushFileItem(file);
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
    }, [
        files,
        listConfig,
        selectionType,
        selectedFolder,
        selectedTag,
        getFileTimestamps,
        searchMetaMap,
        sortOption,
        getDB,
        hiddenFileState,
        showHiddenItems,
        fileVisibility,
        hiddenTags,
        app,
        dayKey
    ]);

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
    const { orderedFiles, orderedFileIndexMap } = useMemo<{
        orderedFiles: TFile[];
        orderedFileIndexMap: Map<string, number>;
    }>(() => {
        const files: TFile[] = [];
        const indexMap = new Map<string, number>();
        listItems.forEach(item => {
            if (item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
                // Store the index before pushing to maintain correct mapping
                indexMap.set(item.data.path, files.length);
                files.push(item.data);
            }
        });
        return { orderedFiles: files, orderedFileIndexMap: indexMap };
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
        const operationActiveRef: { current: boolean } = { current: false };
        const pendingRefreshRef: { current: boolean } = { current: false };

        // Helper to flush pending updates when operations have settled
        const flushPendingWhenIdle = () => {
            if (!pendingRefreshRef.current) return;
            if (!operationActiveRef.current) {
                pendingRefreshRef.current = false;
                // Queue a refresh after operation completion.
                scheduleRefresh();
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
        let unsubscribePropertyTree: (() => void) | null = null;
        if (selectionType === ItemType.PROPERTY && selectedProperty && propertyTreeService) {
            unsubscribePropertyTree = propertyTreeService.addTreeUpdateListener(() => {
                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                    return;
                }
                scheduleRefresh();
            });
        }

        const shouldRefreshOnFileModify = shouldRefreshOnFileModifyForSort(sortOption, settings.propertySortSecondary);
        const shouldRefreshOnMetadataChange = shouldRefreshOnMetadataChangeForSort({
            sortOption,
            propertySortKey: settings.propertySortKey,
            propertySortSecondary: settings.propertySortSecondary,
            useFrontmatterMetadata: settings.useFrontmatterMetadata,
            frontmatterNameField: settings.frontmatterNameField,
            frontmatterCreatedField: settings.frontmatterCreatedField,
            frontmatterModifiedField: settings.frontmatterModifiedField
        });

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
                if (!shouldRefreshOnFileModify) {
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
            // Filter out non-file metadata changes
            if (!(file instanceof TFile)) {
                return;
            }

            // Only update if the metadata change is for a file in our current view
            if (selectionType === ItemType.FOLDER && selectedFolder) {
                // Check if file is in the selected folder
                const fileFolder = file.parent;
                const selectedPath = selectedFolder.path;
                const isRootSelection = selectedPath === '/';

                if (!fileFolder || fileFolder.path !== selectedPath) {
                    // If not showing descendants, ignore files not in this folder
                    if (!includeDescendantNotes) {
                        return;
                    }
                    // If showing descendants, check if it's a descendant
                    if (!isRootSelection && (!fileFolder?.path || !fileFolder.path.startsWith(`${selectedPath}/`))) {
                        return;
                    }
                }
            } else if (selectionType === ItemType.TAG && selectedTag) {
                if (file.extension !== 'md') {
                    return;
                }

                if (operationActiveRef.current) {
                    pendingRefreshRef.current = true;
                } else {
                    scheduleRefresh();
                }
                return;
            } else if (selectionType === ItemType.PROPERTY && selectedProperty) {
                if (file.extension !== 'md') {
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
                return;
            } else {
                // Ignore metadata changes when nothing is selected
                return;
            }

            // Check if file's hidden state changed (frontmatter property added/removed) to trigger rebuild
            if (hiddenFilePropertyMatcher.hasCriteria && file.extension === 'md') {
                const db = getDB();
                const record = db.getFile(file.path);
                const wasExcluded = Boolean(record?.metadata?.hidden);
                const isCurrentlyExcluded = shouldExcludeFileWithMatcher(file, hiddenFilePropertyMatcher, app);

                if (isCurrentlyExcluded !== wasExcluded) {
                    if (operationActiveRef.current) {
                        pendingRefreshRef.current = true;
                    } else {
                        scheduleRefresh();
                    }
                    return;
                }
            }

            if (shouldRefreshOnMetadataChange) {
                if (file.extension !== 'md') {
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
                return;
            }

            return;
        });

        // Listen for tag/property and metadata changes from database
        const db = getDB();
        const dbUnsubscribe = db.onContentChange(changes => {
            let shouldRefresh = false;
            const isPropertyView = selectionType === ItemType.PROPERTY && selectedProperty;

            // React to tag/property changes that affect the current view
            const hasTagChanges = changes.some(change => change.changes.tags !== undefined);
            const hasPropertyChanges = changes.some(change => change.changes.properties !== undefined);
            if (hasTagChanges || hasPropertyChanges) {
                const isTagView = selectionType === ItemType.TAG && selectedTag;
                const isFolderView = selectionType === ItemType.FOLDER && selectedFolder;

                if (isTagView && hasTagChanges) {
                    shouldRefresh = true;
                } else if (isFolderView && hasTagChanges) {
                    const folderPath = selectedFolder.path;
                    const isRootSelection = folderPath === '/';
                    const shouldCheckFolderScope = hiddenFileTags.length > 0;
                    shouldRefresh = changes.some(change => {
                        if (!shouldCheckFolderScope) {
                            return basePathSet.has(change.path);
                        }
                        if (isRootSelection) {
                            return true;
                        }
                        if (!includeDescendantNotes) {
                            const separatorIndex = change.path.lastIndexOf('/');
                            const parentPath = separatorIndex === -1 ? '/' : change.path.slice(0, separatorIndex);
                            return parentPath === folderPath;
                        }
                        return change.path.startsWith(`${folderPath}/`);
                    });
                } else if (isPropertyView) {
                    if (hasPropertyChanges) {
                        shouldRefresh = true;
                    } else if (hasTagChanges) {
                        const hasTagChangesInCurrentList = changes.some(change => basePathSet.has(change.path));
                        const shouldRefreshForTagVisibility = hiddenFileTags.length > 0 && !showHiddenItems;
                        shouldRefresh = hasTagChangesInCurrentList || shouldRefreshForTagVisibility;
                    }
                }
            }

            // React to metadata changes that may update hidden-state styling
            if (!shouldRefresh && hiddenFilePropertyMatcher.hasCriteria && showHiddenItems) {
                const metadataPaths = changes.filter(change => change.changes.metadata !== undefined).map(change => change.path);
                if (metadataPaths.length > 0) {
                    shouldRefresh = metadataPaths.some(path => basePathSet.has(path));
                }
            }

            // React to task counter changes when task filters are active in the search query
            if (!shouldRefresh && hasTaskSearchFilters) {
                shouldRefresh = changes.some(change => {
                    return change.changes.taskUnfinished !== undefined && basePathSet.has(change.path);
                });
            }

            if (!shouldRefresh) {
                return;
            }

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
            if (unsubscribePropertyTree) unsubscribePropertyTree();
            // Cancel any pending scheduled refresh to avoid stray updates
            scheduleRefresh.cancel();
        };
    }, [
        app,
        selectionType,
        selectedTag,
        selectedFolder,
        selectedProperty,
        includeDescendantNotes,
        hiddenFilePropertyMatcher,
        hiddenFolders,
        hiddenFileTags,
        showHiddenItems,
        hasTaskSearchFilters,
        getDB,
        commandQueue,
        propertyTreeService,
        basePathSet,
        sortOption,
        settings.propertySortKey,
        settings.propertySortSecondary,
        settings.useFrontmatterMetadata,
        settings.frontmatterNameField,
        settings.frontmatterCreatedField,
        settings.frontmatterModifiedField,
        settings.frontmatterDateFormat
    ]);

    return {
        listItems,
        orderedFiles,
        orderedFileIndexMap,
        filePathToIndex,
        fileIndexMap,
        files,
        searchMeta: searchMetaMap,
        localDayKey: dayKey
    };
}
