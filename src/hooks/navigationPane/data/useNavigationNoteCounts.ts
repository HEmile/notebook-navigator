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

import { useEffect, useMemo, useRef } from 'react';
import { TFile, TFolder, type App, debounce } from 'obsidian';
import { NavigationPaneItemType, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../../../types';
import type { CombinedNavigationItem } from '../../../types/virtualization';
import type { NoteCountInfo } from '../../../types/noteCounts';
import type { NotebookNavigatorSettings } from '../../../settings/types';
import type { FileVisibility } from '../../../utils/fileTypeUtils';
import { createTagNoteCountInfo } from '../../../utils/tagTree';
import { createFrontmatterPropertyExclusionMatcher, type HiddenFileNameMatcher } from '../../../utils/fileFilters';
import { createHiddenTagVisibility } from '../../../utils/tagPrefixMatcher';
import { getDBInstanceOrNull } from '../../../storage/fileOperations';
import { getFolderNoteDetectionSettings } from '../../../utils/folderNotes';
import { calculateFolderNoteCounts } from '../../../utils/noteCountUtils';
import type { PropertyTreeNode } from '../../../types/storage';
import { getDirectPropertyKeyNoteCount, getTotalPropertyNoteCount } from '../../../utils/propertyTree';
import { TIMEOUTS } from '../../../types/obsidian-extended';

export interface NavigationNoteCounts {
    tagCounts: Map<string, NoteCountInfo>;
    propertyCounts: Map<string, NoteCountInfo>;
    folderCounts: Map<string, NoteCountInfo>;
}

export interface UseNavigationNoteCountsParams {
    app: App;
    isVisible: boolean;
    settings: NotebookNavigatorSettings;
    propertiesSectionActive: boolean;
    itemsWithMetadata: readonly CombinedNavigationItem[];
    includeDescendantNotes: boolean;
    visibleTaggedCount: number;
    untaggedCount: number;
    renderPropertyTree: Map<string, PropertyTreeNode>;
    propertyCollectionCount: NoteCountInfo | undefined;
    effectiveFrontmatterExclusions: string[];
    hiddenFolders: string[];
    hiddenFileTags: string[];
    showHiddenItems: boolean;
    folderCountFileNameMatcher: HiddenFileNameMatcher | null;
    fileVisibility: FileVisibility;
    vaultChangeVersion: number;
    bumpVaultChangeVersion: () => void;
}

export function useNavigationNoteCounts(params: UseNavigationNoteCountsParams): NavigationNoteCounts {
    const {
        app,
        isVisible,
        settings,
        propertiesSectionActive,
        itemsWithMetadata,
        includeDescendantNotes,
        visibleTaggedCount,
        untaggedCount,
        renderPropertyTree,
        propertyCollectionCount,
        effectiveFrontmatterExclusions,
        hiddenFolders,
        hiddenFileTags,
        showHiddenItems,
        folderCountFileNameMatcher,
        fileVisibility,
        vaultChangeVersion,
        bumpVaultChangeVersion
    } = params;

    const lastTagCountsRef = useRef<Map<string, NoteCountInfo>>(new Map());
    const lastPropertyCountsRef = useRef<Map<string, NoteCountInfo>>(new Map());
    const lastFolderCountsRef = useRef<Map<string, NoteCountInfo>>(new Map());

    const computedTagCounts = useMemo((): Map<string, NoteCountInfo> | null => {
        if (!isVisible || !settings.showTags || !settings.showNoteCount) {
            return null;
        }

        const counts = new Map<string, NoteCountInfo>();
        const taggedCollectionCurrent = includeDescendantNotes ? visibleTaggedCount : 0;

        counts.set(TAGGED_TAG_ID, {
            current: taggedCollectionCurrent,
            descendants: 0,
            total: taggedCollectionCurrent
        });

        if (settings.showUntagged) {
            counts.set(UNTAGGED_TAG_ID, {
                current: untaggedCount,
                descendants: 0,
                total: untaggedCount
            });
        }

        itemsWithMetadata.forEach(item => {
            if (item.type !== NavigationPaneItemType.TAG) {
                return;
            }

            const tagNode = item.data;
            if (item.noteCount) {
                counts.set(tagNode.path, item.noteCount);
                return;
            }
            counts.set(tagNode.path, createTagNoteCountInfo(tagNode, includeDescendantNotes));
        });

        return counts;
    }, [
        includeDescendantNotes,
        isVisible,
        itemsWithMetadata,
        settings.showNoteCount,
        settings.showTags,
        settings.showUntagged,
        untaggedCount,
        visibleTaggedCount
    ]);

    const tagCounts = useMemo(() => {
        if (!settings.showTags || !settings.showNoteCount) {
            return new Map<string, NoteCountInfo>();
        }
        return computedTagCounts ?? lastTagCountsRef.current;
    }, [computedTagCounts, settings.showNoteCount, settings.showTags]);

    useEffect(() => {
        if (!settings.showTags || !settings.showNoteCount) {
            lastTagCountsRef.current = new Map();
            return;
        }
        if (computedTagCounts) {
            lastTagCountsRef.current = computedTagCounts;
        }
    }, [computedTagCounts, settings.showNoteCount, settings.showTags]);

    const computedPropertyCounts = useMemo((): Map<string, NoteCountInfo> | null => {
        if (!isVisible || !propertiesSectionActive || !settings.showNoteCount) {
            return null;
        }

        const counts = new Map<string, NoteCountInfo>();
        if (propertyCollectionCount) {
            counts.set(PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, propertyCollectionCount);
        }

        const visiblePropertyNodes = new Map<string, PropertyTreeNode>();
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.PROPERTY_KEY || item.type === NavigationPaneItemType.PROPERTY_VALUE) {
                visiblePropertyNodes.set(item.data.id, item.data);
            }
        });

        if (visiblePropertyNodes.size === 0) {
            return counts;
        }

        visiblePropertyNodes.forEach(node => {
            if (node.kind === 'key') {
                const current = getDirectPropertyKeyNoteCount(node);
                if (!includeDescendantNotes) {
                    counts.set(node.id, { current, descendants: 0, total: current });
                    return;
                }

                const total = node.notesWithValue.size;
                const descendants = Math.max(total - current, 0);
                counts.set(node.id, { current, descendants, total });
                return;
            }

            const current = node.notesWithValue.size;
            if (!includeDescendantNotes || !node.valuePath) {
                counts.set(node.id, { current, descendants: 0, total: current });
                return;
            }

            const keyNode = renderPropertyTree.get(node.key);
            if (!keyNode) {
                counts.set(node.id, { current, descendants: 0, total: current });
                return;
            }

            const total = getTotalPropertyNoteCount(keyNode, node.valuePath);
            const descendants = Math.max(total - current, 0);
            counts.set(node.id, { current, descendants, total });
        });

        return counts;
    }, [
        includeDescendantNotes,
        isVisible,
        itemsWithMetadata,
        propertiesSectionActive,
        propertyCollectionCount,
        renderPropertyTree,
        settings.showNoteCount
    ]);

    const propertyCounts = useMemo(() => {
        if (!propertiesSectionActive || !settings.showNoteCount) {
            return new Map<string, NoteCountInfo>();
        }
        return computedPropertyCounts ?? lastPropertyCountsRef.current;
    }, [computedPropertyCounts, propertiesSectionActive, settings.showNoteCount]);

    useEffect(() => {
        if (!propertiesSectionActive || !settings.showNoteCount) {
            lastPropertyCountsRef.current = new Map();
            return;
        }
        if (computedPropertyCounts) {
            lastPropertyCountsRef.current = computedPropertyCounts;
        }
    }, [computedPropertyCounts, propertiesSectionActive, settings.showNoteCount]);

    const computedFolderCounts = useMemo((): Map<string, NoteCountInfo> | null => {
        void vaultChangeVersion;
        if (!isVisible || !settings.showNoteCount) {
            return null;
        }

        const counts = new Map<string, NoteCountInfo>();

        const excludedProperties = effectiveFrontmatterExclusions;
        const excludedFileMatcher = createFrontmatterPropertyExclusionMatcher(excludedProperties);
        const excludedFolderPatterns = hiddenFolders;
        const hiddenFileTagVisibility = showHiddenItems ? null : createHiddenTagVisibility(hiddenFileTags, false);
        const db = hiddenFileTagVisibility && hiddenFileTagVisibility.hasHiddenRules ? getDBInstanceOrNull() : null;
        const folderNoteSettings = getFolderNoteDetectionSettings({
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName,
            folderNoteNamePattern: settings.folderNoteNamePattern
        });
        const includeDescendants = includeDescendantNotes;
        const showHiddenFolders = showHiddenItems;
        const countOptions = {
            app,
            db,
            fileVisibility,
            excludedFiles: excludedProperties,
            excludedFileMatcher,
            excludedFolders: excludedFolderPatterns,
            fileNameMatcher: folderCountFileNameMatcher,
            hiddenFileTagVisibility,
            includeDescendants,
            showHiddenFolders,
            hideFolderNoteInList: settings.hideFolderNoteInList,
            folderNoteSettings,
            cache: counts
        };

        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.data instanceof TFolder) {
                calculateFolderNoteCounts(item.data, countOptions);
            }
        });

        return counts;
    }, [
        app,
        effectiveFrontmatterExclusions,
        fileVisibility,
        folderCountFileNameMatcher,
        hiddenFileTags,
        hiddenFolders,
        includeDescendantNotes,
        isVisible,
        itemsWithMetadata,
        settings.enableFolderNotes,
        settings.folderNoteName,
        settings.folderNoteNamePattern,
        settings.hideFolderNoteInList,
        settings.showNoteCount,
        showHiddenItems,
        vaultChangeVersion
    ]);

    const folderCounts = useMemo(() => {
        if (!settings.showNoteCount) {
            return new Map<string, NoteCountInfo>();
        }
        return computedFolderCounts ?? lastFolderCountsRef.current;
    }, [computedFolderCounts, settings.showNoteCount]);

    useEffect(() => {
        if (!settings.showNoteCount) {
            lastFolderCountsRef.current = new Map();
            return;
        }
        if (computedFolderCounts) {
            lastFolderCountsRef.current = computedFolderCounts;
        }
    }, [computedFolderCounts, settings.showNoteCount]);

    useEffect(() => {
        const bumpCounts = debounce(
            () => {
                bumpVaultChangeVersion();
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );

        const metaRef = app.metadataCache.on('changed', file => {
            if (file instanceof TFile) {
                bumpCounts();
            }
        });

        return () => {
            app.metadataCache.offref(metaRef);
            bumpCounts.cancel();
        };
    }, [app, bumpVaultChangeVersion]);

    return { tagCounts, propertyCounts, folderCounts };
}
