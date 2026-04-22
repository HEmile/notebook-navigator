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

import { TFile, TFolder, normalizePath } from 'obsidian';
import type { App } from 'obsidian';
import type { NotebookNavigatorSettings, SortOption } from '../../settings';
import { ListPaneItemType, ItemType, PINNED_SECTION_HEADER_KEY } from '../../types';
import type { ListPaneItem } from '../../types/virtualization';
import { strings } from '../../i18n';
import { FILE_VISIBILITY, type FileVisibility } from '../../utils/fileTypeUtils';
import { compareByAlphaSortOrder, getDateField, isDateSortOption, resolveFolderChildSortOrder } from '../../utils/sortUtils';
import { resolveListGrouping } from '../../utils/listGrouping';
import { partitionPinnedFiles } from '../../utils/fileFinder';
import { createHiddenTagVisibility } from '../../utils/tagPrefixMatcher';
import { getCachedFileTags } from '../../utils/tagUtils';
import { DateUtils } from '../../utils/dateUtils';
import type { SearchResultMeta } from '../../types/search';
import type { IndexedDBStorage } from '../../storage/IndexedDBStorage';
import type { PropertySelectionNodeId } from '../../utils/propertyTree';

export interface ListPaneConfig {
    filterPinnedByFolder: boolean;
    folderAppearances: NotebookNavigatorSettings['folderAppearances'];
    folderSortOrder: NotebookNavigatorSettings['folderSortOrder'];
    folderTreeSortOverrides: NotebookNavigatorSettings['folderTreeSortOverrides'];
    noteGrouping: NotebookNavigatorSettings['noteGrouping'];
    pinnedNotes: NotebookNavigatorSettings['pinnedNotes'];
    propertyAppearances: NotebookNavigatorSettings['propertyAppearances'];
    showFileTags: boolean;
    showPinnedGroupHeader: boolean;
    showTags: boolean;
    tagAppearances: NotebookNavigatorSettings['tagAppearances'];
}

interface BuildListItemsArgs {
    app: App;
    dayKey: string;
    fileVisibility: FileVisibility;
    files: TFile[];
    getDB: () => IndexedDBStorage;
    getFileTimestamps: (file: TFile) => { created: number; modified: number };
    hiddenFileState: ReadonlyMap<string, boolean>;
    hiddenTags: string[];
    listConfig: ListPaneConfig;
    searchMetaMap: ReadonlyMap<string, SearchResultMeta>;
    selectedFolder: TFolder | null;
    selectedProperty: PropertySelectionNodeId | null;
    selectedTag: string | null;
    selectionType: ItemType | null;
    showHiddenItems: boolean;
    sortOption: SortOption;
}

export function buildListItems({
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
}: BuildListItemsArgs): ListPaneItem[] {
    const items: ListPaneItem[] = [
        {
            type: ListPaneItemType.TOP_SPACER,
            data: '',
            key: 'top-spacer'
        }
    ];

    const contextFilter =
        selectionType === ItemType.TAG
            ? ItemType.TAG
            : selectionType === ItemType.FOLDER
              ? ItemType.FOLDER
              : selectionType === ItemType.PROPERTY
                ? ItemType.PROPERTY
                : undefined;
    const db = getDB();
    const pinnedDisplayScope =
        listConfig.filterPinnedByFolder && selectionType === ItemType.FOLDER && selectedFolder
            ? { restrictToFolderPath: selectedFolder.path }
            : undefined;
    const { pinnedFiles, unpinnedFiles } = partitionPinnedFiles(files, listConfig.pinnedNotes, contextFilter, pinnedDisplayScope);
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

    let fileIndexCounter = 0;
    type FileItemOverrides = Partial<Omit<ListPaneItem, 'type' | 'data' | 'fileIndex' | 'hasTags' | 'isHidden' | 'key' | 'searchMeta'>>;
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

    if (pinnedFiles.length > 0) {
        if (listConfig.showPinnedGroupHeader) {
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

    const groupingInfo = resolveListGrouping({
        settings: {
            noteGrouping: listConfig.noteGrouping,
            folderAppearances: listConfig.folderAppearances,
            tagAppearances: listConfig.tagAppearances,
            propertyAppearances: listConfig.propertyAppearances
        },
        selectionType: selectionType ?? undefined,
        folderPath: selectedFolder ? selectedFolder.path : null,
        tag: selectedTag ?? null,
        propertyNodeId: selectedProperty ?? null
    });
    const groupingMode = groupingInfo.effectiveGrouping;
    const shouldGroupByDate = groupingMode === 'date' && isDateSortOption(sortOption);
    const shouldGroupByFolder = groupingMode === 'folder' && selectionType === ItemType.FOLDER;

    if (!shouldGroupByDate && !shouldGroupByFolder) {
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
        const now = DateUtils.parseLocalDayKey(dayKey) ?? new Date();
        const dateField = getDateField(sortOption);
        let currentGroup: string | null = null;

        unpinnedFiles.forEach(file => {
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

        const folderGroups = new Map<
            string,
            {
                label: string;
                files: TFile[];
                isCurrentFolder: boolean;
                folderPath: string | null;
            }
        >();

        const resolveFolderGroup = (file: TFile): { key: string; label: string; isCurrentFolder: boolean; folderPath: string | null } => {
            const parent = file.parent;
            if (!(parent instanceof TFolder)) {
                return { key: 'folder:/', label: vaultRootLabel, isCurrentFolder: false, folderPath: null };
            }

            if (selectionType === ItemType.FOLDER && baseFolderPath) {
                if (parent.path === baseFolderPath) {
                    return {
                        key: `folder:${baseFolderPath}`,
                        label: baseFolderName ?? parent.name,
                        isCurrentFolder: true,
                        folderPath: baseFolderPath === '/' ? null : baseFolderPath
                    };
                }

                if (basePrefix && parent.path.startsWith(basePrefix)) {
                    const relativePath = parent.path.slice(basePrefix.length);
                    const [firstSegment] = relativePath.split('/');
                    if (firstSegment && firstSegment.length > 0) {
                        return {
                            key: `folder:${baseFolderPath}/${firstSegment}`,
                            label: firstSegment,
                            isCurrentFolder: false,
                            folderPath: normalizePath(
                                !baseFolderPath || baseFolderPath === '/' ? firstSegment : `${baseFolderPath}/${firstSegment}`
                            )
                        };
                    }
                }
            }

            const parentPath = parent.path === '/' ? '' : parent.path;
            const [topLevel] = parentPath.split('/');
            if (topLevel && topLevel.length > 0) {
                return {
                    key: `folder:/${topLevel}`,
                    label: topLevel,
                    isCurrentFolder: false,
                    folderPath: topLevel
                };
            }

            return { key: 'folder:/', label: vaultRootLabel, isCurrentFolder: false, folderPath: null };
        };

        unpinnedFiles.forEach(file => {
            const groupInfo = resolveFolderGroup(file);
            const group = folderGroups.get(groupInfo.key);
            if (group) {
                group.files.push(file);
                return;
            }

            folderGroups.set(groupInfo.key, {
                label: groupInfo.label,
                files: [file],
                isCurrentFolder: groupInfo.isCurrentFolder,
                folderPath: groupInfo.folderPath
            });
        });

        const orderedGroups = Array.from(folderGroups.entries())
            .map(([key, group]) => ({ key, ...group }))
            .sort((left, right) => {
                if (left.isCurrentFolder !== right.isCurrentFolder) {
                    return left.isCurrentFolder ? -1 : 1;
                }

                const labelCompare = compareByAlphaSortOrder(left.label, right.label, folderGroupSortOrder);
                if (labelCompare !== 0) {
                    return labelCompare;
                }

                if (left.key === right.key) {
                    return 0;
                }

                return left.key < right.key ? -1 : 1;
            });

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

    items.push({
        type: ListPaneItemType.BOTTOM_SPACER,
        data: '',
        key: 'bottom-spacer'
    });

    return items;
}

export function buildFilePathToIndexMap(listItems: ListPaneItem[]): Map<string, number> {
    const filePathToIndex = new Map<string, number>();
    listItems.forEach((item, index) => {
        if (item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
            filePathToIndex.set(item.data.path, index);
        }
    });
    return filePathToIndex;
}

export function buildFileIndexMap(files: TFile[]): Map<string, number> {
    const fileIndexMap = new Map<string, number>();
    files.forEach((file, index) => {
        fileIndexMap.set(file.path, index);
    });
    return fileIndexMap;
}

export function buildOrderedFiles(listItems: ListPaneItem[]): {
    orderedFiles: TFile[];
    orderedFileIndexMap: Map<string, number>;
} {
    const orderedFiles: TFile[] = [];
    const orderedFileIndexMap = new Map<string, number>();

    listItems.forEach(item => {
        if (item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
            orderedFileIndexMap.set(item.data.path, orderedFiles.length);
            orderedFiles.push(item.data);
        }
    });

    return { orderedFiles, orderedFileIndexMap };
}
