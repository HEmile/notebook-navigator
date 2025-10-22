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
 * useNavigationPaneKeyboard - Keyboard navigation for the navigation pane
 *
 * This hook handles navigation-specific keyboard interactions:
 * - Folder/tag selection with arrow keys
 * - Expand/collapse with left/right arrows
 * - Navigate to parent items
 * - Delete folders
 * - Tab/arrow navigation to switch panes
 * - Page navigation
 */

import { useCallback } from 'react';
import { TFolder } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { NavigationPaneItemType, ItemType } from '../types';
import type { CombinedNavigationItem } from '../types/virtualization';
import { deleteSelectedFolder } from '../utils/deleteOperations';
import { useKeyboardNavigation, KeyboardNavigationHelpers } from './useKeyboardNavigation';
import { matchesShortcut, KeyboardShortcutAction } from '../utils/keyboardShortcuts';
import { getNavigationIndex } from '../utils/navigationIndex';

/**
 * Check if a navigation item is selectable
 */
const isSelectableNavigationItem = (item: CombinedNavigationItem): boolean => {
    return (
        item.type === NavigationPaneItemType.FOLDER ||
        item.type === NavigationPaneItemType.TAG ||
        item.type === NavigationPaneItemType.UNTAGGED ||
        item.type === NavigationPaneItemType.TOPIC ||
        item.type === NavigationPaneItemType.VIRTUAL_FOLDER
    );
};

interface UseNavigationPaneKeyboardProps {
    /** Navigation items to navigate through */
    items: CombinedNavigationItem[];
    /** Virtualizer instance for scroll management */
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Container element for event attachment */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Combined navigation index map */
    pathToIndex: Map<string, number>;
}

/**
 * Hook for keyboard navigation in the navigation pane.
 * Handles folder/tag-specific keyboard interactions.
 */
export function useNavigationPaneKeyboard({ items, virtualizer, containerRef, pathToIndex }: UseNavigationPaneKeyboardProps) {
    const { app, isMobile } = useServices();
    const fileSystemOps = useFileSystemOps();
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

    const resolveIndex = useCallback(
        (path: string | null | undefined, type: ItemType | null) => {
            if (!path) {
                return -1;
            }

            if (type) {
                const exactMatch = getNavigationIndex(pathToIndex, type, path);
                if (exactMatch !== undefined) {
                    return exactMatch;
                }
            }

            const folderIndex = getNavigationIndex(pathToIndex, ItemType.FOLDER, path);
            if (folderIndex !== undefined) {
                return folderIndex;
            }

            const tagIndex = getNavigationIndex(pathToIndex, ItemType.TAG, path);
            if (tagIndex !== undefined) {
                return tagIndex;
            }

            const topicIndex = getNavigationIndex(pathToIndex, ItemType.TOPIC, path);
            if (topicIndex !== undefined) {
                return topicIndex;
            }

            return -1;
        },
        [pathToIndex]
    );

    /**
     * Get current selection index
     */
    const getCurrentIndex = useCallback(() => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder?.path) {
            return resolveIndex(selectionState.selectedFolder.path, ItemType.FOLDER);
        }

        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return resolveIndex(selectionState.selectedTag, ItemType.TAG);
        }

        if (selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopic) {
            return resolveIndex(selectionState.selectedTopic, ItemType.TOPIC);
        }

        return -1;
    }, [selectionState, resolveIndex]);

    /**
     * Select item at given index
     */
    const selectItemAtIndex = useCallback(
        (item: CombinedNavigationItem) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                if (!(item.data instanceof TFolder)) return;
                const folder = item.data;
                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

                // Auto-expand if enabled and folder has children
                if (settings.autoExpandFoldersTags && folder.children.some(child => child instanceof TFolder)) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedFolders.has(folder.path)) {
                        expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                    }
                }
                return;
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                selectionDispatch({ type: 'SET_SELECTED_TAG', tag: tagNode.path });

                // Auto-expand if enabled and tag has children
                if (settings.autoExpandFoldersTags && tagNode.children.size > 0) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedTags.has(tagNode.path)) {
                        expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tagNode.path });
                    }
                }
            } else if (item.type === NavigationPaneItemType.TOPIC) {
                const topicNode = item.data;
                const topicPath = item.path ?? topicNode.name; // Use the unique path for this instance, fallback to name
                selectionDispatch({ type: 'SET_SELECTED_TOPIC', topic: topicPath });

                // Auto-expand if enabled and topic has children
                if (settings.autoExpandFoldersTags && topicNode.children.size > 0) {
                    // Only expand if not already expanded
                    if (!expansionState.expandedTopics.has(topicPath)) {
                        expansionDispatch({ type: 'TOGGLE_TOPIC_EXPANDED', topicName: topicPath });
                    }
                }
            } else if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER) {
                // Virtual folders don't have a selection action, but we allow focusing them
                // This is mainly for keyboard navigation consistency
                return;
            }
        },
        [selectionDispatch, settings, expansionState, expansionDispatch]
    );

    /**
     * Handle expand/collapse for folders, tags, topics, and virtual folders
     */
    const handleExpandCollapse = useCallback(
        (item: CombinedNavigationItem, expand: boolean) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                if (!(item.data instanceof TFolder)) return;
                const folder = item.data;
                const isExpanded = expansionState.expandedFolders.has(folder.path);
                if (expand && !isExpanded && folder.children.length > 0) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                }
            } else if (item.type === NavigationPaneItemType.TAG) {
                const tag = item.data;
                const isExpanded = expansionState.expandedTags.has(tag.path);
                if (expand && !isExpanded && tag.children.size > 0) {
                    expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tag.path });
                }
            } else if (item.type === NavigationPaneItemType.TOPIC) {
                const topic = item.data;
                const topicPath = item.path ?? topic.name; // Use the unique path for this instance, fallback to name
                const isExpanded = expansionState.expandedTopics.has(topicPath);
                if (expand && !isExpanded && topic.children.size > 0) {
                    expansionDispatch({ type: 'TOGGLE_TOPIC_EXPANDED', topicName: topicPath });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_TOPIC_EXPANDED', topicName: topicPath });
                }
            } else if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER) {
                const virtualFolder = item.data;
                const isExpanded = expansionState.expandedVirtualFolders.has(virtualFolder.id);
                if (expand && !isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId: virtualFolder.id });
                } else if (!expand && isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId: virtualFolder.id });
                }
            }
        },
        [expansionState, expansionDispatch]
    );

    /**
     * Navigation pane-specific keyboard handler
     */
    const handleKeyDown = useCallback(
        (e: KeyboardEvent, helpers: KeyboardNavigationHelpers<CombinedNavigationItem>) => {
            const currentIndex = getCurrentIndex();
            const shortcuts = settings.keyboardShortcuts;
            const isRTL = helpers.isRTL();
            let targetIndex = -1;
            let shouldScrollToTop = false;

            const getFirstSelectableIndex = () => helpers.findNextIndex(-1);
            const findSelectableBefore = (startIndex: number) => {
                if (items.length === 0) {
                    return -1;
                }

                for (let i = Math.min(startIndex, items.length - 1); i >= 0; i--) {
                    const candidate = helpers.getItemAt(i);
                    if (candidate && isSelectableNavigationItem(candidate)) {
                        return i;
                    }
                }

                return -1;
            };

            if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_MOVE_DOWN)) {
                e.preventDefault();
                targetIndex = helpers.findNextIndex(currentIndex);
                if (targetIndex === currentIndex && currentIndex >= 0) {
                    return;
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_MOVE_UP)) {
                e.preventDefault();
                if (currentIndex === -1) {
                    targetIndex = helpers.findNextIndex(-1);
                } else {
                    targetIndex = helpers.findPreviousIndex(currentIndex);
                    if (targetIndex === currentIndex && currentIndex >= 0) {
                        return;
                    }
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_PAGE_DOWN)) {
                e.preventDefault();
                if (currentIndex !== -1) {
                    const pageSize = helpers.getPageSize();
                    const newIndex = Math.min(currentIndex + pageSize, items.length - 1);
                    let newTargetIndex = helpers.findNextIndex(newIndex - 1);
                    if (newTargetIndex === currentIndex && currentIndex !== items.length - 1) {
                        for (let i = items.length - 1; i >= 0; i--) {
                            const item = helpers.getItemAt(i);
                            if (item && isSelectableNavigationItem(item)) {
                                newTargetIndex = i;
                                break;
                            }
                        }
                    }
                    targetIndex = newTargetIndex;
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_PAGE_UP)) {
                e.preventDefault();
                const firstSelectableIndex = getFirstSelectableIndex();

                if (currentIndex === -1) {
                    targetIndex = firstSelectableIndex;
                    if (firstSelectableIndex >= 0) {
                        shouldScrollToTop = true;
                    }
                } else {
                    const pageSize = helpers.getPageSize();
                    const newIndex = Math.max(0, currentIndex - pageSize);
                    const nearestSelectable = findSelectableBefore(newIndex);

                    if (nearestSelectable >= 0) {
                        targetIndex = nearestSelectable;
                        if (firstSelectableIndex >= 0 && nearestSelectable === firstSelectableIndex) {
                            shouldScrollToTop = true;
                        }
                    } else {
                        targetIndex = firstSelectableIndex;
                        if (firstSelectableIndex >= 0) {
                            shouldScrollToTop = true;
                        }
                    }
                }
            } else if (
                matchesShortcut(e, shortcuts, KeyboardShortcutAction.NAV_EXPAND_OR_FOCUS_LIST, {
                    isRTL,
                    directional: 'horizontal'
                })
            ) {
                e.preventDefault();
                if (currentIndex >= 0) {
                    const item = helpers.getItemAt(currentIndex);
                    if (!item) {
                        return;
                    }

                    let shouldSwitchPane = false;
                    if (item.type === NavigationPaneItemType.FOLDER) {
                        if (!(item.data instanceof TFolder)) {
                            return;
                        }
                        const folder = item.data;
                        const isExpanded = expansionState.expandedFolders.has(folder.path);
                        const hasChildren = folder.children.some(child => child instanceof TFolder);

                        if (hasChildren && !isExpanded) {
                            handleExpandCollapse(item, true);
                        } else {
                            shouldSwitchPane = true;
                        }
                    } else if (item.type === NavigationPaneItemType.TAG) {
                        const tag = item.data;
                        const isExpanded = expansionState.expandedTags.has(tag.path);
                        const hasChildren = tag.children.size > 0;

                        if (hasChildren && !isExpanded) {
                            handleExpandCollapse(item, true);
                        } else {
                            shouldSwitchPane = true;
                        }
                    } else if (item.type === NavigationPaneItemType.TOPIC) {
                        const topic = item.data;
                        const topicPath = item.path ?? topic.name; // Use the unique path for this instance, fallback to name
                        const isExpanded = expansionState.expandedTopics.has(topicPath);
                        const hasChildren = topic.children.size > 0;

                        if (hasChildren && !isExpanded) {
                            handleExpandCollapse(item, true);
                        } else {
                            shouldSwitchPane = true;
                        }
                    } else {
                        shouldSwitchPane = true;
                    }

                    if (shouldSwitchPane) {
                        if (uiState.singlePane && !isMobile) {
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        } else {
                            selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                        }
                    }
                }
            } else if (
                matchesShortcut(e, shortcuts, KeyboardShortcutAction.NAV_COLLAPSE_OR_PARENT, {
                    isRTL,
                    directional: 'horizontal'
                })
            ) {
                e.preventDefault();
                if (currentIndex >= 0) {
                    const item = helpers.getItemAt(currentIndex);
                    if (!item) {
                        return;
                    }

                    if (item.type === NavigationPaneItemType.FOLDER) {
                        if (!(item.data instanceof TFolder)) {
                            return;
                        }
                        const folder = item.data;
                        const isExpanded = expansionState.expandedFolders.has(folder.path);
                        if (isExpanded) {
                            handleExpandCollapse(item, false);
                        } else if (folder.parent && (!settings.showRootFolder || folder.path !== '/')) {
                            const parentPath = folder.parent.path;
                            const parentIndex = resolveIndex(parentPath, ItemType.FOLDER);
                            if (parentIndex >= 0) {
                                const parentItem = helpers.getItemAt(parentIndex);
                                if (parentItem) {
                                    selectItemAtIndex(parentItem);
                                    helpers.scrollToIndex(parentIndex);
                                }
                            }
                        }
                    } else if (item.type === NavigationPaneItemType.TAG) {
                        const tag = item.data;
                        const isExpanded = expansionState.expandedTags.has(tag.path);
                        if (isExpanded) {
                            handleExpandCollapse(item, false);
                        } else {
                            const lastSlashIndex = tag.path.lastIndexOf('/');
                            if (lastSlashIndex > 0) {
                                const parentPath = tag.path.substring(0, lastSlashIndex);
                                const parentIndex = resolveIndex(parentPath, ItemType.TAG);
                                if (parentIndex >= 0) {
                                    const parentItem = helpers.getItemAt(parentIndex);
                                    if (parentItem) {
                                        selectItemAtIndex(parentItem);
                                        helpers.scrollToIndex(parentIndex);
                                    }
                                }
                            }
                        }
                    } else if (item.type === NavigationPaneItemType.TOPIC) {
                        const topic = item.data;
                        const topicPath = item.path ?? topic.name; // Use the unique path for this instance, fallback to name
                        const isExpanded = expansionState.expandedTopics.has(topicPath);
                        if (isExpanded) {
                            handleExpandCollapse(item, false);
                        } else {
                            // Navigate to parent by removing the last part of the path
                            const lastSlashIndex = topicPath.lastIndexOf('/');
                            if (lastSlashIndex > 0) {
                                const parentPath = topicPath.substring(0, lastSlashIndex);
                                const parentIndex = resolveIndex(parentPath, ItemType.TOPIC);
                                if (parentIndex >= 0) {
                                    const parentItem = helpers.getItemAt(parentIndex);
                                    if (parentItem) {
                                        selectItemAtIndex(parentItem);
                                        helpers.scrollToIndex(parentIndex);
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.NAV_FOCUS_LIST)) {
                e.preventDefault();
                if (!isMobile) {
                    if (uiState.singlePane) {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    } else {
                        selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    }
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.DELETE_SELECTED)) {
                if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                    e.preventDefault();
                    deleteSelectedFolder({
                        app,
                        fileSystemOps,
                        settings,
                        selectionState,
                        selectionDispatch
                    });
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_HOME)) {
                e.preventDefault();
                targetIndex = getFirstSelectableIndex();
                if (targetIndex >= 0) {
                    shouldScrollToTop = true;
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_END)) {
                e.preventDefault();
                for (let i = items.length - 1; i >= 0; i--) {
                    const item = helpers.getItemAt(i);
                    if (item && isSelectableNavigationItem(item)) {
                        targetIndex = i;
                        break;
                    }
                }
            }

            if (targetIndex >= 0 && targetIndex < items.length) {
                const item = helpers.getItemAt(targetIndex);
                if (item && isSelectableNavigationItem(item)) {
                    selectItemAtIndex(item);
                    if (shouldScrollToTop) {
                        virtualizer.scrollToIndex(0, { align: 'start' });
                    }
                    helpers.scrollToIndex(targetIndex);
                }
            } else if (shouldScrollToTop) {
                virtualizer.scrollToIndex(0, { align: 'start' });
            }
        },
        [
            getCurrentIndex,
            settings,
            items.length,
            expansionState,
            handleExpandCollapse,
            uiState.singlePane,
            isMobile,
            uiDispatch,
            selectionDispatch,
            resolveIndex,
            selectItemAtIndex,
            selectionState,
            app,
            fileSystemOps,
            virtualizer
        ]
    );

    // Use the base keyboard navigation hook
    useKeyboardNavigation({
        items,
        virtualizer,
        focusedPane: 'navigation',
        containerRef,
        isSelectable: isSelectableNavigationItem,
        _getCurrentIndex: getCurrentIndex,
        onKeyDown: handleKeyDown
    });
}
