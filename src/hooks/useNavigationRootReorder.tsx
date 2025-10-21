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

import React, { useCallback, useMemo } from 'react';
import type { App, TFolder } from 'obsidian';
import type { NotebookNavigatorSettings } from '../settings';
import type { TagTreeNode, TopicNode } from '../types/storage';
import type { CombinedNavigationItem } from '../types/virtualization';
import {
    NavigationPaneItemType,
    ItemType,
    UNTAGGED_TAG_ID,
    STORAGE_KEYS,
    DEFAULT_NAVIGATION_SECTION_ORDER,
    NavigationSectionId
} from '../types';
import { FILE_VISIBILITY } from '../utils/fileTypeUtils';
import { strings } from '../i18n';
import type { MetadataService } from '../services/MetadataService';
import type { DragGhostOptions } from '../utils/dragGhost';
import { localStorage } from '../utils/localStorage';
import { areStringArraysEqual } from '../utils/arrayUtils';
import { useListReorder, type ListReorderHandlers } from './useListReorder';
import { RootFolderReorderItem } from '../components/RootFolderReorderItem';
import { mergeNavigationSectionOrder } from '../utils/navigationSections';
import { getPathBaseName } from '../utils/pathUtils';
import { beginInternalDrag, endInternalDrag } from '../utils/internalDragState';

export interface RootFolderDescriptor {
    key: string;
    folder: TFolder | null;
    isVault?: boolean;
    isMissing?: boolean;
}

export interface RootTagDescriptor {
    key: string;
    tag: TagTreeNode | null;
    isMissing?: boolean;
    isVirtualRoot?: boolean;
    isUntagged?: boolean;
}

export interface RootTopicDescriptor {
    key: string;
    topic: TopicNode | null;
    isMissing?: boolean;
    isVirtualRoot?: boolean;
}

export type RootReorderRenderItem = {
    key: string;
    props: React.ComponentProps<typeof RootFolderReorderItem>;
};

export type SectionReorderRenderItem = RootReorderRenderItem & {
    sectionId: NavigationSectionId;
};

interface ReorderVisualContext {
    positionMap: Map<string, number>;
    getHandlers: (key: string) => ListReorderHandlers;
    dropIndex: number | null;
    draggingKey: string | null;
}

interface ReorderVisualState {
    dragHandlers?: ListReorderHandlers;
    showBefore: boolean;
    showAfter: boolean;
    isDragSource: boolean;
}

function buildReorderVisualState(
    key: string,
    context: ReorderVisualContext,
    createDragHandlers?: (handlers: ListReorderHandlers) => ListReorderHandlers
): ReorderVisualState {
    const index = context.positionMap.get(key);
    if (index === undefined) {
        return { dragHandlers: undefined, showBefore: false, showAfter: false, isDragSource: false };
    }

    const baseHandlers = context.getHandlers(key);
    let dragHandlers = createDragHandlers ? createDragHandlers(baseHandlers) : baseHandlers;

    // Wrap drag handlers to track navigation root drag state globally
    // This prevents interference with file/folder drag operations
    if (dragHandlers.draggable) {
        const originalHandlers = dragHandlers;
        dragHandlers = {
            ...originalHandlers,
            onDragStart: event => {
                // Mark start of navigation root drag
                beginInternalDrag('navigation-root');
                try {
                    originalHandlers.onDragStart(event);
                } catch (error) {
                    endInternalDrag('navigation-root');
                    throw error;
                }
            },
            onDragOver: originalHandlers.onDragOver,
            onDragLeave: originalHandlers.onDragLeave,
            onDrop: event => {
                try {
                    originalHandlers.onDrop(event);
                } finally {
                    // Clear drag state after drop
                    endInternalDrag('navigation-root');
                }
            },
            onDragEnd: event => {
                try {
                    originalHandlers.onDragEnd(event);
                } finally {
                    // Always clear drag state when drag ends
                    endInternalDrag('navigation-root');
                }
            }
        };
    }
    const isDragSource = context.draggingKey === key;
    const isDifferentKey = context.draggingKey !== key;
    const showBefore = Boolean(isDifferentKey && context.dropIndex !== null && context.dropIndex === 0 && index === 0);
    const showAfter = Boolean(isDifferentKey && context.dropIndex !== null && context.dropIndex === index + 1);

    return { dragHandlers, showBefore, showAfter, isDragSource };
}

const TAGS_VIRTUAL_REORDER_KEY = '__nn-tags-root__';
const REMOVE_MISSING_LABEL = strings.common.remove;

export interface UseNavigationRootReorderOptions {
    app: App;
    items: CombinedNavigationItem[];
    settings: NotebookNavigatorSettings;
    updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>;
    sectionOrder: NavigationSectionId[];
    setSectionOrder: React.Dispatch<React.SetStateAction<NavigationSectionId[]>>;
    rootLevelFolders: TFolder[];
    missingRootFolderPaths: string[];
    resolvedRootTagKeys: string[];
    rootOrderingTagTree: Map<string, TagTreeNode>;
    missingRootTagPaths: string[];
    metadataService: MetadataService;
    withDragGhost: (handlers: ListReorderHandlers, options: DragGhostOptions) => ListReorderHandlers;
    isRootReorderMode: boolean;
    notesSectionExpanded: boolean;
    tagsSectionExpanded: boolean;
    topicsSectionExpanded: boolean;
    handleToggleNotesSection: (event: React.MouseEvent<HTMLDivElement>) => void;
    handleToggleTagsSection: (event: React.MouseEvent<HTMLDivElement>) => void;
    handleToggleTopicsSection: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export interface NavigationRootReorderState {
    reorderableRootFolders: RootFolderDescriptor[];
    reorderableRootTags: RootTagDescriptor[];
    reorderableRootTopics: RootTopicDescriptor[];
    sectionReorderItems: SectionReorderRenderItem[];
    folderReorderItems: RootReorderRenderItem[];
    tagReorderItems: RootReorderRenderItem[];
    topicReorderItems: RootReorderRenderItem[];
    canReorderSections: boolean;
    canReorderRootFolders: boolean;
    canReorderRootTags: boolean;
    canReorderRootTopics: boolean;
    canReorderRootItems: boolean;
    showRootFolderSection: boolean;
    showRootTagSection: boolean;
    showRootTopicSection: boolean;
    resetRootTagOrderLabel: string;
    vaultRootDescriptor: RootFolderDescriptor | undefined;
    handleResetRootFolderOrder: () => Promise<void>;
    handleResetRootTagOrder: () => Promise<void>;
}

export function useNavigationRootReorder(options: UseNavigationRootReorderOptions): NavigationRootReorderState {
    const {
        app,
        items,
        settings,
        updateSettings,
        sectionOrder,
        setSectionOrder,
        rootLevelFolders,
        missingRootFolderPaths,
        resolvedRootTagKeys,
        rootOrderingTagTree,
        missingRootTagPaths,
        metadataService,
        withDragGhost,
        isRootReorderMode,
        notesSectionExpanded,
        tagsSectionExpanded,
        topicsSectionExpanded,
        handleToggleNotesSection,
        handleToggleTagsSection,
        handleToggleTopicsSection
    } = options;

    const {
        showRootFolder,
        rootFolderOrder,
        rootTagOrder,
        showUntagged,
        tagSortOrder,
        showShortcuts,
        showRecentNotes,
        showTags,
        showTopics,
        fileVisibility,
        customVaultName
    } = settings;

    const rootFolderDescriptors = useMemo<RootFolderDescriptor[]>(() => {
        const descriptors: RootFolderDescriptor[] = [];
        if (showRootFolder) {
            const vaultRoot = app.vault.getRoot();
            descriptors.push({ key: vaultRoot.path, folder: vaultRoot, isVault: true });
        }

        const folderMap = new Map<string, TFolder>();
        rootLevelFolders.forEach(folder => {
            folderMap.set(folder.path, folder);
        });

        const missingSet = new Set(missingRootFolderPaths);
        const orderedPaths = rootFolderOrder.length > 0 ? rootFolderOrder : rootLevelFolders.map(folder => folder.path);
        const seen = new Set<string>();

        orderedPaths.forEach(path => {
            if (seen.has(path)) {
                return;
            }
            seen.add(path);
            const existing = folderMap.get(path);
            if (existing) {
                descriptors.push({ key: path, folder: existing });
            } else if (missingSet.has(path)) {
                descriptors.push({ key: path, folder: null, isMissing: true });
            }
        });

        rootLevelFolders.forEach(folder => {
            if (!seen.has(folder.path)) {
                descriptors.push({ key: folder.path, folder });
            }
        });

        return descriptors;
    }, [app.vault, missingRootFolderPaths, rootFolderOrder, rootLevelFolders, showRootFolder]);

    const resetRootTagOrderLabel = useMemo(() => {
        if (tagSortOrder === 'frequency-asc' || tagSortOrder === 'frequency-desc') {
            return strings.navigationPane.resetRootToFrequency;
        }
        return strings.navigationPane.resetRootToAlpha;
    }, [tagSortOrder]);

    const rootTagDescriptors = useMemo<RootTagDescriptor[]>(() => {
        const descriptors: RootTagDescriptor[] = [];
        const tagMap = new Map<string, TagTreeNode>();
        rootOrderingTagTree.forEach((node, key) => {
            tagMap.set(key, node);
        });

        const seen = new Set<string>();
        const addDescriptor = (descriptor: RootTagDescriptor) => {
            if (seen.has(descriptor.key)) {
                return;
            }
            seen.add(descriptor.key);
            descriptors.push(descriptor);
        };

        if (tagMap.size > 0) {
            addDescriptor({ key: TAGS_VIRTUAL_REORDER_KEY, tag: null, isVirtualRoot: true });
        }

        resolvedRootTagKeys.forEach(key => {
            if (key === UNTAGGED_TAG_ID) {
                if (showUntagged) {
                    addDescriptor({ key: UNTAGGED_TAG_ID, tag: null, isUntagged: true });
                }
                return;
            }
            const node = tagMap.get(key);
            if (node) {
                addDescriptor({ key: node.path, tag: node });
            }
        });

        rootTagOrder.forEach(path => {
            if (path === UNTAGGED_TAG_ID) {
                return;
            }
            if (seen.has(path)) {
                return;
            }
            if (!tagMap.has(path)) {
                addDescriptor({ key: path, tag: null, isMissing: true });
            }
        });

        missingRootTagPaths.forEach(path => {
            if (path === UNTAGGED_TAG_ID) {
                return;
            }
            if (!seen.has(path)) {
                addDescriptor({ key: path, tag: null, isMissing: true });
            }
        });

        return descriptors;
    }, [missingRootTagPaths, resolvedRootTagKeys, rootOrderingTagTree, rootTagOrder, showUntagged]);

    const reorderableRootFolders = useMemo<RootFolderDescriptor[]>(() => {
        return rootFolderDescriptors.filter(entry => !entry.isVault);
    }, [rootFolderDescriptors]);

    const reorderableRootTags = useMemo<RootTagDescriptor[]>(() => {
        return rootTagDescriptors.filter(entry => !entry.isVirtualRoot);
    }, [rootTagDescriptors]);

    const visibleSectionOrder = useMemo<NavigationSectionId[]>(() => {
        const includeMap = new Map<NavigationSectionId, boolean>([
            [NavigationSectionId.SHORTCUTS, showShortcuts],
            [NavigationSectionId.RECENT, showRecentNotes],
            [NavigationSectionId.TOPICS, showTopics],
            [NavigationSectionId.TAGS, showTags && reorderableRootTags.length > 0],
            [NavigationSectionId.NOTES, rootFolderDescriptors.length > 0]
        ]);

        const ordered: NavigationSectionId[] = [];

        sectionOrder.forEach(identifier => {
            if (!includeMap.get(identifier)) {
                return;
            }
            if (ordered.includes(identifier)) {
                return;
            }
            ordered.push(identifier);
        });

        DEFAULT_NAVIGATION_SECTION_ORDER.forEach(identifier => {
            if (!includeMap.get(identifier)) {
                return;
            }
            if (ordered.includes(identifier)) {
                return;
            }
            ordered.push(identifier);
        });

        return ordered;
    }, [sectionOrder, showShortcuts, showRecentNotes, showTags, reorderableRootTags, rootFolderDescriptors]);

    const sectionReorderEntries = useMemo(() => visibleSectionOrder.map(identifier => ({ key: identifier })), [visibleSectionOrder]);
    const canReorderSections = sectionReorderEntries.length > 1;

    const sectionPositionMap = useMemo(() => {
        const map = new Map<string, number>();
        visibleSectionOrder.forEach((identifier, index) => {
            map.set(identifier, index);
        });
        return map;
    }, [visibleSectionOrder]);

    const {
        getDragHandlers: getSectionDragHandlers,
        dropIndex: sectionReorderDropIndex,
        draggingKey: sectionReorderDraggingKey
    } = useListReorder({
        items: sectionReorderEntries,
        isEnabled: isRootReorderMode && canReorderSections,
        reorderItems: async orderedKeys => {
            const merged = mergeNavigationSectionOrder(orderedKeys, sectionOrder);
            if (areStringArraysEqual(merged, sectionOrder)) {
                return true;
            }
            setSectionOrder(merged);
            localStorage.set(STORAGE_KEYS.navigationSectionOrderKey, merged);
            return true;
        }
    });

    const rootFolderPositionMap = useMemo(() => {
        const map = new Map<string, number>();
        reorderableRootFolders.forEach((entry, index) => {
            map.set(entry.key, index);
        });
        return map;
    }, [reorderableRootFolders]);

    const rootTagPositionMap = useMemo(() => {
        const map = new Map<string, number>();
        reorderableRootTags.forEach((entry, index) => {
            map.set(entry.key, index);
        });
        return map;
    }, [reorderableRootTags]);

    const canReorderRootFolders = reorderableRootFolders.length > 1;
    const canReorderRootTags = reorderableRootTags.length > 1;
    const canReorderRootItems = canReorderSections || canReorderRootFolders || canReorderRootTags;
    const showRootFolderSection = reorderableRootFolders.length > 0;
    const showRootTagSection = reorderableRootTags.length > 0;

    const rootItemMaps = useMemo(() => {
        const folderIconMap = new Map<string, string | undefined>();
        const folderColorMap = new Map<string, string | undefined>();
        const tagIconMap = new Map<string, string | undefined>();
        const tagColorMap = new Map<string, string | undefined>();

        items.forEach(item => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                const path = item.data.path;
                folderIconMap.set(path, item.icon);
                folderColorMap.set(path, item.color);
                return;
            }
            if (item.type === NavigationPaneItemType.TAG) {
                const path = item.data.path;
                tagIconMap.set(path, item.icon);
                tagColorMap.set(path, item.color);
            }
        });

        return {
            rootFolderIconMap: folderIconMap,
            rootFolderColorMap: folderColorMap,
            rootTagIconMap: tagIconMap,
            rootTagColorMap: tagColorMap
        };
    }, [items]);

    const { rootFolderIconMap, rootFolderColorMap, rootTagIconMap, rootTagColorMap } = rootItemMaps;
    const vaultRootDescriptor = useMemo(() => rootFolderDescriptors.find(entry => entry.isVault), [rootFolderDescriptors]);

    const handleRootOrderChange = useCallback(
        async (orderedPaths: string[]) => {
            const normalizedOrder = orderedPaths.slice();
            if (areStringArraysEqual(normalizedOrder, rootFolderOrder)) {
                return;
            }
            await updateSettings(current => {
                current.rootFolderOrder = normalizedOrder;
            });
        },
        [rootFolderOrder, updateSettings]
    );

    const handleRootTagOrderChange = useCallback(
        async (orderedPaths: string[]) => {
            const normalizedOrder = orderedPaths.slice();
            if (areStringArraysEqual(normalizedOrder, rootTagOrder)) {
                return;
            }
            await updateSettings(current => {
                current.rootTagOrder = normalizedOrder;
            });
        },
        [rootTagOrder, updateSettings]
    );

    const handleRemoveMissingRootFolder = useCallback(
        async (path: string) => {
            if (!path) {
                return;
            }
            await updateSettings(current => {
                if (!Array.isArray(current.rootFolderOrder)) {
                    current.rootFolderOrder = [];
                    return;
                }
                if (!current.rootFolderOrder.includes(path)) {
                    return;
                }
                current.rootFolderOrder = current.rootFolderOrder.filter(entry => entry !== path);
            });
        },
        [updateSettings]
    );

    const handleRemoveMissingRootTag = useCallback(
        async (path: string) => {
            if (!path) {
                return;
            }
            await updateSettings(current => {
                if (!Array.isArray(current.rootTagOrder)) {
                    current.rootTagOrder = [];
                    return;
                }
                if (!current.rootTagOrder.includes(path)) {
                    return;
                }
                current.rootTagOrder = current.rootTagOrder.filter(entry => entry !== path);
            });
        },
        [updateSettings]
    );

    const buildRemoveMissingAction = useCallback((path: string, removeCallback: (targetPath: string) => Promise<void>) => {
        const invokeRemoval = () => {
            void removeCallback(path);
        };
        return (
            <span
                role="button"
                tabIndex={0}
                className="nn-root-reorder-remove"
                onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    invokeRemoval();
                }}
                onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        invokeRemoval();
                    }
                }}
            >
                {REMOVE_MISSING_LABEL}
            </span>
        );
    }, []);

    const {
        getDragHandlers: getRootFolderDragHandlers,
        dropIndex: rootFolderReorderDropIndex,
        draggingKey: rootFolderReorderDraggingKey
    } = useListReorder({
        items: reorderableRootFolders,
        isEnabled: isRootReorderMode && canReorderRootFolders,
        reorderItems: async orderedKeys => {
            await handleRootOrderChange(orderedKeys);
            return true;
        }
    });

    const {
        getDragHandlers: getRootTagDragHandlers,
        dropIndex: rootTagReorderDropIndex,
        draggingKey: rootTagReorderDraggingKey
    } = useListReorder({
        items: reorderableRootTags,
        isEnabled: isRootReorderMode && canReorderRootTags,
        reorderItems: async orderedKeys => {
            await handleRootTagOrderChange(orderedKeys);
            return true;
        }
    });

    const getRootFolderReorderVisualState = useCallback(
        (descriptor: RootFolderDescriptor) =>
            buildReorderVisualState(
                descriptor.key,
                {
                    positionMap: rootFolderPositionMap,
                    getHandlers: getRootFolderDragHandlers,
                    dropIndex: rootFolderReorderDropIndex,
                    draggingKey: rootFolderReorderDraggingKey
                },
                handlers => {
                    const icon =
                        rootFolderIconMap.get(descriptor.key) ??
                        (descriptor.isVault ? 'vault' : descriptor.isMissing ? 'lucide-folder-off' : 'lucide-folder');
                    const iconColor = rootFolderColorMap.get(descriptor.key);
                    return withDragGhost(handlers, {
                        itemType: ItemType.FOLDER,
                        path: descriptor.folder ? descriptor.folder.path : descriptor.key,
                        icon,
                        iconColor
                    });
                }
            ),
        [
            getRootFolderDragHandlers,
            rootFolderIconMap,
            rootFolderColorMap,
            rootFolderPositionMap,
            rootFolderReorderDropIndex,
            rootFolderReorderDraggingKey,
            withDragGhost
        ]
    );

    const getRootTagReorderVisualState = useCallback(
        (descriptor: RootTagDescriptor) =>
            buildReorderVisualState(
                descriptor.key,
                {
                    positionMap: rootTagPositionMap,
                    getHandlers: getRootTagDragHandlers,
                    dropIndex: rootTagReorderDropIndex,
                    draggingKey: rootTagReorderDraggingKey
                },
                handlers => {
                    let icon = rootTagIconMap.get(descriptor.key);
                    if (!icon) {
                        if (descriptor.isUntagged) {
                            icon = metadataService.getTagIcon(descriptor.key) ?? 'lucide-tag';
                        } else if (descriptor.isMissing) {
                            icon = 'lucide-tag-off';
                        } else {
                            icon = metadataService.getTagIcon(descriptor.key) ?? 'lucide-tag';
                        }
                    }
                    const metadataColor = descriptor.isUntagged ? undefined : metadataService.getTagColor(descriptor.key);
                    const iconColor = rootTagColorMap.get(descriptor.key) ?? metadataColor;
                    return withDragGhost(handlers, {
                        itemType: ItemType.TAG,
                        path: descriptor.tag ? descriptor.tag.displayPath : descriptor.key,
                        icon,
                        iconColor
                    });
                }
            ),
        [
            getRootTagDragHandlers,
            rootTagIconMap,
            rootTagColorMap,
            metadataService,
            rootTagPositionMap,
            rootTagReorderDropIndex,
            rootTagReorderDraggingKey,
            withDragGhost
        ]
    );

    const folderReorderItems = useMemo<RootReorderRenderItem[]>(() => {
        return reorderableRootFolders.map(entry => {
            const { dragHandlers, showBefore, showAfter, isDragSource } = getRootFolderReorderVisualState(entry);
            const iconName = rootFolderIconMap.get(entry.key);
            const iconColor = rootFolderColorMap.get(entry.key);
            const isMissing = entry.isMissing === true;
            const displayLabel = entry.folder ? entry.folder.name : getPathBaseName(entry.key);

            let displayIcon = 'lucide-folder';
            if (isMissing) {
                displayIcon = 'lucide-folder-off';
            } else if (iconName) {
                displayIcon = iconName;
            }

            const actions = isMissing ? buildRemoveMissingAction(entry.key, handleRemoveMissingRootFolder) : undefined;

            return {
                key: `root-folder-reorder-${entry.key}`,
                props: {
                    icon: displayIcon,
                    color: iconColor,
                    label: displayLabel,
                    level: 1,
                    dragHandlers,
                    showDropIndicatorBefore: showBefore,
                    showDropIndicatorAfter: showAfter,
                    isDragSource,
                    dragHandleLabel: strings.navigationPane.dragHandleLabel,
                    isMissing,
                    actions,
                    itemType: 'folder'
                }
            };
        });
    }, [
        reorderableRootFolders,
        getRootFolderReorderVisualState,
        rootFolderIconMap,
        rootFolderColorMap,
        buildRemoveMissingAction,
        handleRemoveMissingRootFolder
    ]);

    const tagReorderItems = useMemo<RootReorderRenderItem[]>(() => {
        return reorderableRootTags.map(entry => {
            const { dragHandlers, showBefore, showAfter, isDragSource } = getRootTagReorderVisualState(entry);
            const isUntagged = entry.isUntagged === true;
            const isMissing = entry.isMissing === true;

            let displayIcon: string;
            let label: string;
            if (isUntagged) {
                displayIcon = metadataService.getTagIcon(entry.key) ?? 'lucide-tag';
                label = strings.tagList.untaggedLabel;
            } else {
                const iconFromTree = rootTagIconMap.get(entry.key);
                const metadataIcon = metadataService.getTagIcon(entry.key);
                displayIcon = iconFromTree ?? metadataIcon ?? (isMissing ? 'lucide-tag-off' : 'lucide-tag');
                label = entry.tag ? `#${entry.tag.displayPath}` : `#${entry.key}`;
            }

            const metadataColor = isUntagged ? undefined : metadataService.getTagColor(entry.key);
            const iconColor = rootTagColorMap.get(entry.key) ?? metadataColor;
            const actions = isMissing ? buildRemoveMissingAction(entry.key, handleRemoveMissingRootTag) : undefined;

            return {
                key: `root-tag-reorder-${entry.key}`,
                props: {
                    icon: displayIcon,
                    color: iconColor,
                    label,
                    level: 1,
                    dragHandlers,
                    showDropIndicatorBefore: showBefore,
                    showDropIndicatorAfter: showAfter,
                    isDragSource,
                    dragHandleLabel: strings.navigationPane.dragHandleLabel,
                    isMissing,
                    actions,
                    itemType: 'tag'
                }
            };
        });
    }, [
        reorderableRootTags,
        getRootTagReorderVisualState,
        rootTagIconMap,
        rootTagColorMap,
        metadataService,
        buildRemoveMissingAction,
        handleRemoveMissingRootTag
    ]);

    const getSectionReorderVisualState = useCallback(
        (identifier: NavigationSectionId, configureHandlers?: (handlers: ListReorderHandlers) => ListReorderHandlers) =>
            buildReorderVisualState(
                identifier,
                {
                    positionMap: sectionPositionMap,
                    getHandlers: getSectionDragHandlers,
                    dropIndex: sectionReorderDropIndex,
                    draggingKey: sectionReorderDraggingKey
                },
                configureHandlers
            ),
        [sectionPositionMap, getSectionDragHandlers, sectionReorderDropIndex, sectionReorderDraggingKey]
    );

    const sectionReorderItems = useMemo<SectionReorderRenderItem[]>(() => {
        return visibleSectionOrder.map((identifier, index) => {
            let icon = 'lucide-circle';
            let label = '';
            let chevronIcon: string | undefined;
            let onClick: ((event: React.MouseEvent<HTMLDivElement>) => void) | undefined;
            let color: string | undefined;

            if (identifier === NavigationSectionId.SHORTCUTS) {
                icon = 'lucide-bookmark';
                label = strings.navigationPane.shortcutsHeader;
            } else if (identifier === NavigationSectionId.RECENT) {
                icon = 'lucide-history';
                label =
                    fileVisibility === FILE_VISIBILITY.DOCUMENTS
                        ? strings.navigationPane.recentNotesHeader
                        : strings.navigationPane.recentFilesHeader;
            } else if (identifier === NavigationSectionId.NOTES) {
                if (vaultRootDescriptor) {
                    const vaultIcon = rootFolderIconMap.get(vaultRootDescriptor.key);
                    color = rootFolderColorMap.get(vaultRootDescriptor.key);
                    if (vaultIcon) {
                        icon = vaultIcon;
                    } else {
                        icon = notesSectionExpanded ? 'open-vault' : 'vault';
                    }
                    label = customVaultName || app.vault.getName();
                } else {
                    icon = 'lucide-notebook';
                    label = strings.listPane.notesSection;
                }
                chevronIcon = notesSectionExpanded ? 'lucide-chevron-down' : 'lucide-chevron-right';
                onClick = handleToggleNotesSection;
            } else if (identifier === NavigationSectionId.TAGS) {
                icon = 'lucide-tags';
                label = strings.settings.sections.tags;
                chevronIcon = tagsSectionExpanded ? 'lucide-chevron-down' : 'lucide-chevron-right';
                onClick = handleToggleTagsSection;
            } else if (identifier === NavigationSectionId.TOPICS) {
                icon = 'lucide-tags';
                label = strings.settings.sections.topics;
                chevronIcon = topicsSectionExpanded ? 'lucide-chevron-down' : 'lucide-chevron-right';
                onClick = handleToggleTopicsSection;
            }

            const { dragHandlers, showBefore, showAfter, isDragSource } = getSectionReorderVisualState(identifier, handlers =>
                withDragGhost(handlers, {
                    itemType: null,
                    icon,
                    iconColor: color
                })
            );

            const headerClassName = index === 0 ? undefined : 'nn-root-reorder-section-header';

            return {
                key: `section-${identifier}`,
                sectionId: identifier,
                props: {
                    icon,
                    label,
                    level: 0,
                    dragHandlers,
                    showDropIndicatorBefore: showBefore,
                    showDropIndicatorAfter: showAfter,
                    isDragSource,
                    color,
                    dragHandleLabel: strings.navigationPane.dragHandleLabel,
                    onClick,
                    chevronIcon,
                    itemType: 'section',
                    className: headerClassName
                }
            };
        });
    }, [
        visibleSectionOrder,
        getSectionReorderVisualState,
        fileVisibility,
        vaultRootDescriptor,
        rootFolderIconMap,
        rootFolderColorMap,
        customVaultName,
        app.vault,
        notesSectionExpanded,
        tagsSectionExpanded,
        handleToggleNotesSection,
        handleToggleTagsSection,
        withDragGhost
    ]);

    const handleResetRootFolderOrder = useCallback(async () => {
        await updateSettings(current => {
            current.rootFolderOrder = [];
        });
    }, [updateSettings]);

    const handleResetRootTagOrder = useCallback(async () => {
        await updateSettings(current => {
            current.rootTagOrder = [];
        });
    }, [updateSettings]);

    return {
        reorderableRootFolders,
        reorderableRootTags,
        sectionReorderItems,
        folderReorderItems,
        tagReorderItems,
        canReorderSections,
        canReorderRootFolders,
        canReorderRootTags,
        canReorderRootItems,
        showRootFolderSection,
        showRootTagSection,
        resetRootTagOrderLabel,
        vaultRootDescriptor,
        handleResetRootFolderOrder,
        handleResetRootTagOrder
    };
}
