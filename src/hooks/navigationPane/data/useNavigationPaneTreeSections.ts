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

import { useMemo } from 'react';
import { strings } from '../../../i18n';
import type { NotebookNavigatorSettings } from '../../../settings/types';
import {
    NavigationPaneItemType,
    PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
    TAGGED_TAG_ID,
    TAGS_ROOT_VIRTUAL_FOLDER_ID,
    UNTAGGED_TAG_ID,
    type VirtualFolder
} from '../../../types';
import type { NoteCountInfo } from '../../../types/noteCounts';
import type { PropertyTreeNode, TagTreeNode } from '../../../types/storage';
import type { CombinedNavigationItem } from '../../../types/virtualization';
import {
    flattenFolderTree,
    flattenTagTree,
    comparePropertyOrderWithFallback,
    compareTagOrderWithFallback
} from '../../../utils/treeFlattener';
import { resolveUXIcon } from '../../../utils/uxIcons';
import { getVirtualTagCollection, VIRTUAL_TAG_COLLECTION_IDS } from '../../../utils/virtualTagCollections';
import {
    comparePropertyValueNodesAlphabetically,
    compareTagAlphabetically,
    createPropertyComparator,
    type PropertyNodeComparator,
    type TagComparator
} from './navigationComparators';
import type { NavigationPaneSourceState } from './useNavigationPaneSourceState';
import { getTotalPropertyNoteCount } from '../../../utils/propertyTree';

interface NavigationPaneTreeExpansionState {
    expandedFolders: Set<string>;
    expandedTags: Set<string>;
    expandedProperties: Set<string>;
    expandedVirtualFolders: Set<string>;
}

export interface UseNavigationPaneTreeSectionsParams {
    settings: NotebookNavigatorSettings;
    expansionState: NavigationPaneTreeExpansionState;
    showHiddenItems: boolean;
    includeDescendantNotes: boolean;
    sourceState: NavigationPaneSourceState;
}

export interface NavigationPaneTreeSectionsResult {
    folderItems: CombinedNavigationItem[];
    tagItems: CombinedNavigationItem[];
    resolvedRootTagKeys: string[];
    tagsVirtualFolderHasChildren: boolean;
    propertyItems: CombinedNavigationItem[];
    propertiesSectionActive: boolean;
    resolvedRootPropertyKeys: string[];
    propertyCollectionCount: NoteCountInfo | undefined;
}

export function useNavigationPaneTreeSections({
    settings,
    expansionState,
    showHiddenItems,
    includeDescendantNotes,
    sourceState
}: UseNavigationPaneTreeSectionsParams): NavigationPaneTreeSectionsResult {
    const folderItems = useMemo(() => {
        return flattenFolderTree(sourceState.rootFolders, expansionState.expandedFolders, sourceState.hiddenFolders, 0, new Set(), {
            rootOrderMap: sourceState.rootFolderOrderMap,
            defaultSortOrder: settings.folderSortOrder,
            childSortOrderOverrides: settings.folderTreeSortOverrides,
            getFolderSortName: sourceState.getFolderSortName,
            isFolderExcluded: sourceState.folderExclusionByFolderNote
        });
    }, [
        expansionState.expandedFolders,
        settings.folderSortOrder,
        settings.folderTreeSortOverrides,
        sourceState.folderExclusionByFolderNote,
        sourceState.getFolderSortName,
        sourceState.hiddenFolders,
        sourceState.rootFolderOrderMap,
        sourceState.rootFolders
    ]);

    const { tagItems, resolvedRootTagKeys, tagsVirtualFolderHasChildren } = useMemo((): {
        tagItems: CombinedNavigationItem[];
        resolvedRootTagKeys: string[];
        tagsVirtualFolderHasChildren: boolean;
    } => {
        if (!settings.showTags) {
            return {
                tagItems: [],
                resolvedRootTagKeys: [],
                tagsVirtualFolderHasChildren: false
            };
        }

        const items: CombinedNavigationItem[] = [];
        const shouldHideTags = !showHiddenItems;
        const hasHiddenPatterns = sourceState.hiddenMatcherHasRules;
        const shouldIncludeUntagged = settings.showUntagged && sourceState.untaggedCount > 0;
        const matcherForMarking = !shouldHideTags && hasHiddenPatterns ? sourceState.hiddenTagMatcher : undefined;
        const taggedCollectionCount: NoteCountInfo = (() => {
            if (!includeDescendantNotes) {
                return { current: 0, descendants: 0, total: 0 };
            }
            return {
                current: sourceState.visibleTaggedCount,
                descendants: 0,
                total: sourceState.visibleTaggedCount
            };
        })();

        const pushUntaggedNode = (level: number) => {
            if (!shouldIncludeUntagged) {
                return;
            }
            const untaggedNode: TagTreeNode = {
                path: UNTAGGED_TAG_ID,
                displayPath: UNTAGGED_TAG_ID,
                name: getVirtualTagCollection(VIRTUAL_TAG_COLLECTION_IDS.UNTAGGED).getLabel(),
                children: new Map(),
                notesWithTag: new Set()
            };

            items.push({
                type: NavigationPaneItemType.UNTAGGED,
                data: untaggedNode,
                key: UNTAGGED_TAG_ID,
                level
            });
        };

        const addVirtualFolder = (
            id: string,
            name: string,
            icon?: string,
            options?: {
                tagCollectionId?: string;
                propertyCollectionId?: string;
                showFileCount?: boolean;
                noteCount?: NoteCountInfo;
                hasChildren?: boolean;
            }
        ) => {
            const folder: VirtualFolder = { id, name, icon };
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: folder,
                level: 0,
                key: id,
                isSelectable: Boolean(options?.tagCollectionId || options?.propertyCollectionId),
                tagCollectionId: options?.tagCollectionId,
                propertyCollectionId: options?.propertyCollectionId,
                hasChildren: options?.hasChildren,
                showFileCount: options?.showFileCount,
                noteCount: options?.noteCount
            });
        };

        if (sourceState.visibleTagTree.size === 0) {
            if (settings.showAllTagsFolder) {
                const folderId = TAGS_ROOT_VIRTUAL_FOLDER_ID;
                addVirtualFolder(folderId, strings.tagList.tags, resolveUXIcon(settings.interfaceIcons, 'nav-tags'), {
                    tagCollectionId: TAGGED_TAG_ID,
                    hasChildren: shouldIncludeUntagged,
                    showFileCount: settings.showNoteCount,
                    noteCount: taggedCollectionCount
                });

                if (expansionState.expandedVirtualFolders.has(folderId) && shouldIncludeUntagged) {
                    pushUntaggedNode(1);
                }

                const tagsFolderHasChildren = shouldIncludeUntagged;
                return {
                    tagItems: items,
                    resolvedRootTagKeys: shouldIncludeUntagged ? [UNTAGGED_TAG_ID] : [],
                    tagsVirtualFolderHasChildren: tagsFolderHasChildren
                };
            }

            if (shouldIncludeUntagged) {
                pushUntaggedNode(0);
                return { tagItems: items, resolvedRootTagKeys: [UNTAGGED_TAG_ID], tagsVirtualFolderHasChildren: true };
            }

            return { tagItems: items, resolvedRootTagKeys: [], tagsVirtualFolderHasChildren: false };
        }

        const visibleRootNodes = Array.from(sourceState.visibleTagTree.values());
        const baseComparator = sourceState.tagComparator ?? compareTagAlphabetically;
        const effectiveComparator: TagComparator =
            sourceState.rootTagOrderMap.size > 0
                ? (a, b) => compareTagOrderWithFallback(a, b, sourceState.rootTagOrderMap, baseComparator)
                : baseComparator;
        const sortedRootNodes = visibleRootNodes.length > 0 ? visibleRootNodes.slice().sort(effectiveComparator) : visibleRootNodes;
        const hasVisibleTags = sortedRootNodes.length > 0;
        const hasTagCollectionContent = sourceState.visibleTaggedCount > 0;
        const hasContent = hasVisibleTags || shouldIncludeUntagged || hasTagCollectionContent;
        const tagsFolderHasChildren = hasVisibleTags || shouldIncludeUntagged;

        const rootNodeMap = new Map<string, TagTreeNode>();
        sortedRootNodes.forEach(node => {
            rootNodeMap.set(node.path, node);
        });
        sourceState.hiddenRootTagNodes.forEach((node, path) => {
            rootNodeMap.set(path, node);
        });

        const defaultKeyOrder = sortedRootNodes.map(node => node.path);
        const allowedKeys = new Set(defaultKeyOrder);
        if (shouldIncludeUntagged) {
            allowedKeys.add(UNTAGGED_TAG_ID);
        }
        sourceState.hiddenRootTagNodes.forEach((_node, path) => {
            allowedKeys.add(path);
            if (!defaultKeyOrder.includes(path)) {
                defaultKeyOrder.push(path);
            }
        });

        const nextResolvedRootTagKeys: string[] = [];
        settings.rootTagOrder.forEach(entry => {
            if (!allowedKeys.has(entry)) {
                return;
            }
            if (nextResolvedRootTagKeys.includes(entry)) {
                return;
            }
            nextResolvedRootTagKeys.push(entry);
        });

        defaultKeyOrder.forEach(key => {
            if (!nextResolvedRootTagKeys.includes(key)) {
                nextResolvedRootTagKeys.push(key);
            }
        });

        if (shouldIncludeUntagged && !nextResolvedRootTagKeys.includes(UNTAGGED_TAG_ID)) {
            nextResolvedRootTagKeys.push(UNTAGGED_TAG_ID);
        }

        const appendTagNode = (node: TagTreeNode, level: number) => {
            const tagEntries = flattenTagTree([node], expansionState.expandedTags, level, {
                hiddenMatcher: matcherForMarking,
                comparator: effectiveComparator,
                childSortOrderOverrides: settings.tagTreeSortOverrides
            });
            items.push(...tagEntries);
        };

        if (settings.showAllTagsFolder) {
            if (hasContent) {
                const folderId = TAGS_ROOT_VIRTUAL_FOLDER_ID;
                addVirtualFolder(folderId, strings.tagList.tags, resolveUXIcon(settings.interfaceIcons, 'nav-tags'), {
                    tagCollectionId: TAGGED_TAG_ID,
                    hasChildren: tagsFolderHasChildren,
                    showFileCount: settings.showNoteCount,
                    noteCount: taggedCollectionCount
                });

                if (expansionState.expandedVirtualFolders.has(folderId)) {
                    nextResolvedRootTagKeys.forEach(key => {
                        if (sourceState.hiddenRootTagNodes.has(key) && !showHiddenItems) {
                            return;
                        }
                        if (key === UNTAGGED_TAG_ID) {
                            pushUntaggedNode(1);
                            return;
                        }
                        const node = rootNodeMap.get(key);
                        if (!node) {
                            return;
                        }
                        appendTagNode(node, 1);
                    });
                }
            }
        } else {
            nextResolvedRootTagKeys.forEach(key => {
                if (sourceState.hiddenRootTagNodes.has(key) && !showHiddenItems) {
                    return;
                }
                if (key === UNTAGGED_TAG_ID) {
                    pushUntaggedNode(0);
                    return;
                }
                const node = rootNodeMap.get(key);
                if (!node) {
                    return;
                }
                appendTagNode(node, 0);
            });
        }

        return { tagItems: items, resolvedRootTagKeys: nextResolvedRootTagKeys, tagsVirtualFolderHasChildren: tagsFolderHasChildren };
    }, [
        expansionState.expandedTags,
        expansionState.expandedVirtualFolders,
        includeDescendantNotes,
        settings.interfaceIcons,
        settings.rootTagOrder,
        settings.showAllTagsFolder,
        settings.showNoteCount,
        settings.showTags,
        settings.showUntagged,
        settings.tagTreeSortOverrides,
        showHiddenItems,
        sourceState.hiddenMatcherHasRules,
        sourceState.hiddenRootTagNodes,
        sourceState.hiddenTagMatcher,
        sourceState.rootTagOrderMap,
        sourceState.tagComparator,
        sourceState.untaggedCount,
        sourceState.visibleTaggedCount,
        sourceState.visibleTagTree
    ]);

    const propertySectionBase = useMemo((): {
        propertiesSectionActive: boolean;
        keyNodes: PropertyTreeNode[];
        collectionCount: NoteCountInfo | undefined;
        resolvedRootPropertyKeys: string[];
    } => {
        if (!settings.showProperties) {
            return {
                propertiesSectionActive: false,
                keyNodes: [],
                collectionCount: undefined,
                resolvedRootPropertyKeys: []
            };
        }

        const keyNodes = Array.from(sourceState.propertyTree.values()).filter(node =>
            sourceState.visiblePropertyNavigationKeySet.has(node.key)
        );

        const effectiveComparator: PropertyNodeComparator =
            sourceState.rootPropertyOrderMap.size > 0
                ? (a, b) => comparePropertyOrderWithFallback(a, b, sourceState.rootPropertyOrderMap, sourceState.propertyKeyComparator)
                : sourceState.propertyKeyComparator;

        keyNodes.sort(effectiveComparator);

        let collectionCount: NoteCountInfo | undefined;
        const shouldShowRootFolder = settings.showAllPropertiesFolder;
        const shouldComputeCollectionCount = settings.showNoteCount && (shouldShowRootFolder || sourceState.hasRootPropertyShortcut);

        if (shouldComputeCollectionCount) {
            if (!includeDescendantNotes || keyNodes.length === 0) {
                collectionCount = { current: 0, descendants: 0, total: 0 };
            } else {
                const propertyCollectionFiles = new Set<string>();
                keyNodes.forEach(node => {
                    node.notesWithValue.forEach(path => propertyCollectionFiles.add(path));
                });
                const total = propertyCollectionFiles.size;
                collectionCount = { current: total, descendants: 0, total };
            }
        }

        return {
            propertiesSectionActive: true,
            keyNodes,
            collectionCount,
            resolvedRootPropertyKeys: keyNodes.map(node => node.key)
        };
    }, [
        includeDescendantNotes,
        settings.showAllPropertiesFolder,
        settings.showNoteCount,
        settings.showProperties,
        sourceState.hasRootPropertyShortcut,
        sourceState.propertyKeyComparator,
        sourceState.propertyTree,
        sourceState.rootPropertyOrderMap,
        sourceState.visiblePropertyNavigationKeySet
    ]);

    const { propertyItems, propertiesSectionActive } = useMemo((): {
        propertyItems: CombinedNavigationItem[];
        propertiesSectionActive: boolean;
    } => {
        if (!propertySectionBase.propertiesSectionActive) {
            return {
                propertyItems: [],
                propertiesSectionActive: false
            };
        }

        const rootId = PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
        const keyNodes = propertySectionBase.keyNodes;
        const collectionCount = propertySectionBase.collectionCount;
        const shouldShowRootFolder = settings.showAllPropertiesFolder;
        const rootLevel = shouldShowRootFolder ? 1 : 0;
        const childLevel = rootLevel + 1;

        const items: CombinedNavigationItem[] = [];

        if (shouldShowRootFolder) {
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: {
                    id: rootId,
                    name: strings.navigationPane.properties,
                    icon: resolveUXIcon(settings.interfaceIcons, 'nav-properties')
                },
                level: 0,
                key: rootId,
                isSelectable: true,
                propertyCollectionId: PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
                hasChildren: keyNodes.length > 0,
                showFileCount: settings.showNoteCount,
                noteCount: collectionCount
            });

            if (!expansionState.expandedVirtualFolders.has(rootId)) {
                return { propertyItems: items, propertiesSectionActive: true };
            }
        }

        const sortChildren = (keyNode: PropertyTreeNode, children: Iterable<PropertyTreeNode>): PropertyTreeNode[] => {
            const nodes = Array.from(children);
            if (nodes.length <= 1) {
                return nodes;
            }

            const propertyTreeSortOverrides = settings.propertyTreeSortOverrides;
            const hasChildSortOverride = Boolean(
                propertyTreeSortOverrides && Object.prototype.hasOwnProperty.call(propertyTreeSortOverrides, keyNode.id)
            );
            const childSortOverride = hasChildSortOverride ? propertyTreeSortOverrides?.[keyNode.id] : undefined;
            const comparator = createPropertyComparator({
                order: childSortOverride ?? settings.propertySortOrder,
                compareAlphabetically: comparePropertyValueNodesAlphabetically,
                getFrequency: node =>
                    includeDescendantNotes && node.valuePath ? getTotalPropertyNoteCount(keyNode, node.valuePath) : node.notesWithValue.size
            });

            return nodes.sort(comparator);
        };

        keyNodes.forEach(keyNode => {
            items.push({
                type: NavigationPaneItemType.PROPERTY_KEY,
                data: keyNode,
                level: rootLevel,
                key: keyNode.id
            });

            if (expansionState.expandedProperties.has(keyNode.id) && keyNode.children.size > 0) {
                sortChildren(keyNode, keyNode.children.values()).forEach(child => {
                    items.push({
                        type: NavigationPaneItemType.PROPERTY_VALUE,
                        data: child,
                        level: childLevel,
                        key: child.id
                    });
                });
            }
        });

        return { propertyItems: items, propertiesSectionActive: true };
    }, [
        expansionState.expandedProperties,
        expansionState.expandedVirtualFolders,
        includeDescendantNotes,
        propertySectionBase.collectionCount,
        propertySectionBase.keyNodes,
        propertySectionBase.propertiesSectionActive,
        settings.interfaceIcons,
        settings.propertySortOrder,
        settings.propertyTreeSortOverrides,
        settings.showAllPropertiesFolder,
        settings.showNoteCount
    ]);

    return {
        folderItems,
        tagItems,
        resolvedRootTagKeys,
        tagsVirtualFolderHasChildren,
        propertyItems,
        propertiesSectionActive,
        resolvedRootPropertyKeys: propertySectionBase.resolvedRootPropertyKeys,
        propertyCollectionCount: propertySectionBase.collectionCount
    };
}
