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

import { useMemo, useState } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useFileCache } from '../context/StorageContext';
import { useLocalDayKey } from './useLocalDayKey';
import { ItemType } from '../types';
import type { VisibilityPreferences } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { createFrontmatterPropertyExclusionMatcher } from '../utils/fileFilters';
import { getEffectiveSortOption } from '../utils/sortUtils';
import { parseFilterSearchTokens, filterSearchHasActiveCriteria } from '../utils/filterSearch';
import type { NotebookNavigatorSettings } from '../settings';
import type { FilterSearchTokens } from '../utils/filterSearch';
import type { SearchResultMeta } from '../types/search';
import type { ActiveProfileState } from '../context/SettingsContext';
import type { SearchProvider } from '../types/search';
import type { PropertySelectionNodeId } from '../utils/propertyTree';
import { getFilesForNavigationSelection } from '../utils/selectionUtils';
import { getActivePropertyFields } from '../utils/vaultProfiles';
import { buildHiddenFileState, filterListPaneFiles, useOmnisearchListResult, useSearchableNames } from './listPaneData/searchPipeline';
import {
    buildFileIndexMap,
    buildFilePathToIndexMap,
    buildListItems,
    buildOrderedFiles,
    type ListPaneConfig
} from './listPaneData/listItems';
import { useListPaneRefresh } from './listPaneData/useListPaneRefresh';

const EMPTY_SEARCH_META = new Map<string, SearchResultMeta>();

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

    const [updateKey, setUpdateKey] = useState(0);

    const trimmedQuery = searchQuery?.trim() ?? '';
    const hasSearchQuery = trimmedQuery.length > 0;
    const isOmnisearchAvailable = omnisearchService?.isAvailable() ?? false;
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
    const listConfig = useMemo<ListPaneConfig>(
        () => ({
            pinnedNotes: settings.pinnedNotes,
            filterPinnedByFolder: settings.filterPinnedByFolder,
            showPinnedGroupHeader: settings.showPinnedGroupHeader ?? true,
            showTags: settings.showTags,
            showFileTags: settings.showFileTags,
            noteGrouping: settings.noteGrouping,
            folderAppearances: settings.folderAppearances,
            tagAppearances: settings.tagAppearances,
            propertyAppearances: settings.propertyAppearances,
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
            settings.tagAppearances,
            settings.propertyAppearances
        ]
    );

    const sortOption = useMemo(() => {
        if (selectionType === ItemType.TAG && selectedTag) {
            return getEffectiveSortOption(settings, ItemType.TAG, null, selectedTag);
        }
        if (selectionType === ItemType.PROPERTY && selectedProperty) {
            return getEffectiveSortOption(settings, ItemType.PROPERTY, null, null, selectedProperty);
        }
        return getEffectiveSortOption(settings, ItemType.FOLDER, selectedFolder, selectedTag);
    }, [selectionType, selectedFolder, selectedTag, selectedProperty, settings]);
    const activePropertyFields = getActivePropertyFields(settings);

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
        settings.propertySortOverrides,
        propertyTreeService,
        includeDescendantNotes,
        showHiddenItems,
        app,
        tagTreeService,
        updateKey
    ]);

    const basePathSet = useMemo(() => new Set(baseFiles.map(file => file.path)), [baseFiles]);
    const omnisearchResult = useOmnisearchListResult({
        basePathSet,
        omnisearchPathScope,
        omnisearchService,
        trimmedQuery,
        useOmnisearch
    });
    const searchableNames = useSearchableNames({ app, baseFiles, getFileDisplayName });

    const files = useMemo(() => {
        return filterListPaneFiles({
            app,
            baseFiles,
            getDB,
            getFileTimestamps,
            omnisearchResult,
            searchTokens,
            searchableNames,
            settings,
            sortOption,
            trimmedQuery,
            useOmnisearch
        });
    }, [
        app,
        baseFiles,
        getDB,
        getFileTimestamps,
        omnisearchResult,
        searchTokens,
        searchableNames,
        settings,
        sortOption,
        trimmedQuery,
        useOmnisearch
    ]);

    const hiddenFileState = useMemo(() => {
        return buildHiddenFileState({
            app,
            files,
            getDB,
            hiddenFileNames,
            hiddenFilePropertyMatcher,
            hiddenFileTags,
            hiddenFolders,
            showHiddenItems
        });
    }, [files, getDB, hiddenFolders, hiddenFilePropertyMatcher, hiddenFileNames, hiddenFileTags, showHiddenItems, app]);

    const searchMetaMap = useMemo(() => {
        if (useOmnisearch && omnisearchResult) {
            return omnisearchResult.meta;
        }
        return EMPTY_SEARCH_META;
    }, [useOmnisearch, omnisearchResult]);

    const listItems = useMemo(() => {
        return buildListItems({
            app,
            dayKey,
            fileVisibility,
            files,
            getDB,
            getFileTimestamps,
            hiddenFileState,
            hiddenTags,
            listConfig,
            searchMetaMap,
            selectedFolder,
            selectedProperty,
            selectedTag,
            selectionType,
            showHiddenItems,
            sortOption
        });
    }, [
        app,
        dayKey,
        fileVisibility,
        files,
        getDB,
        getFileTimestamps,
        hiddenFileState,
        hiddenTags,
        listConfig,
        selectedFolder,
        selectedProperty,
        selectedTag,
        selectionType,
        searchMetaMap,
        showHiddenItems,
        sortOption
    ]);

    const filePathToIndex = useMemo(() => {
        return buildFilePathToIndexMap(listItems);
    }, [listItems]);

    const fileIndexMap = useMemo(() => {
        return buildFileIndexMap(files);
    }, [files]);

    const { orderedFiles, orderedFileIndexMap } = useMemo<{
        orderedFiles: TFile[];
        orderedFileIndexMap: Map<string, number>;
    }>(() => {
        return buildOrderedFiles(listItems);
    }, [listItems]);

    useListPaneRefresh({
        app,
        basePathSet,
        commandQueue,
        getDB,
        hasTaskSearchFilters,
        hiddenFilePropertyMatcher,
        hiddenFileTags,
        includeDescendantNotes,
        onRefresh: () => setUpdateKey(current => current + 1),
        propertyTreeService,
        selectedFolder,
        selectedProperty,
        selectedTag,
        selectionType,
        settings,
        showHiddenItems,
        sortOption
    });

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
