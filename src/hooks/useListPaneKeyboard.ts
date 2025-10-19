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
 * useListPaneKeyboard - Keyboard navigation for the list pane
 *
 * This hook handles list-specific keyboard interactions:
 * - File selection and navigation
 * - Multi-selection support (Shift+arrows, Cmd/Ctrl+A)
 * - Range selection (Shift+Home/End)
 * - File opening and deletion
 * - Tab/arrow navigation to editor or back to navigation pane
 * - Page navigation
 */

import { useCallback } from 'react';
import { TFile, FileView } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { getSupportedLeaves, ListPaneItemType } from '../types';
import type { ListPaneItem } from '../types/virtualization';
import { deleteSelectedFiles } from '../utils/deleteOperations';
import { getFilesInRange } from '../utils/selectionUtils';
import { useKeyboardNavigation, KeyboardNavigationHelpers } from './useKeyboardNavigation';
import { useMultiSelection } from './useMultiSelection';
import { matchesShortcut, KeyboardShortcutAction } from '../utils/keyboardShortcuts';

/**
 * Check if a list item is selectable (file, not header or spacer)
 */
const isSelectableListItem = (item: ListPaneItem): boolean => {
    return item.type === ListPaneItemType.FILE;
};

interface UseListPaneKeyboardProps {
    /** List items to navigate through */
    items: ListPaneItem[];
    /** Virtualizer instance for scroll management */
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Container element for event attachment */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Map from file paths to their index in items */
    pathToIndex: Map<string, number>;
    /** Array of files for multi-selection optimization */
    files: TFile[];
    /** Map from file paths to their position in files array */
    fileIndexMap: Map<string, number>;
}

/**
 * Hook for keyboard navigation in the list pane.
 * Handles file-specific keyboard interactions and multi-selection.
 */
export function useListPaneKeyboard({ items, virtualizer, containerRef, pathToIndex, files, fileIndexMap }: UseListPaneKeyboardProps) {
    const { app, isMobile, tagTreeService, commandQueue, topicService } = useServices();
    const fileSystemOps = useFileSystemOps();
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const multiSelection = useMultiSelection();

    /**
     * Get current selection index
     */
    const getCurrentIndex = useCallback(() => {
        if (selectionState.selectedFile?.path) {
            return pathToIndex.get(selectionState.selectedFile.path) ?? -1;
        }
        return -1;
    }, [selectionState.selectedFile, pathToIndex]);

    /**
     * Select item at given index
     */
    const selectItemAtIndex = useCallback(
        (item: ListPaneItem) => {
            if (item.type === ListPaneItemType.FILE) {
                const file = item.data instanceof TFile ? item.data : null;
                if (!file) return;

                // Normal navigation clears multi-selection
                selectionDispatch({ type: 'SET_SELECTED_FILE', file });

                // Mark as keyboard navigation to prevent auto-scrolling on rapid navigation
                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });

                // Open the file in the editor without moving focus
                const openFile = async () => {
                    const leaf = app.workspace.getLeaf(false);
                    if (!leaf) {
                        return;
                    }
                    await leaf.openFile(file, { active: false });
                };

                // Queue the file open if command queue is available
                if (commandQueue) {
                    void commandQueue.executeOpenActiveFile(file, openFile);
                } else {
                    void openFile();
                }
            }
        },
        [selectionDispatch, app.workspace, commandQueue]
    );

    /**
     * Handle range selection with Home/End
     */
    const handleRangeSelection = useCallback(
        (direction: 'home' | 'end', currentFileIndex: number) => {
            const targetIndex = direction === 'home' ? 0 : files.length - 1;
            const targetFile = files[targetIndex];
            if (!targetFile) return;

            // Get files in range
            const filesInRange = getFilesInRange(
                files,
                direction === 'home' ? 0 : currentFileIndex,
                direction === 'home' ? currentFileIndex : files.length - 1
            );

            // Select all files in range that aren't already selected
            filesInRange.forEach(f => {
                if (!selectionState.selectedFiles.has(f.path)) {
                    selectionDispatch({ type: 'TOGGLE_FILE_SELECTION', file: f });
                }
            });

            // Move cursor to target position
            selectionDispatch({ type: 'UPDATE_CURRENT_FILE', file: targetFile });

            // Open the file without changing focus
            const leaf = app.workspace.getLeaf(false);
            if (leaf) {
                leaf.openFile(targetFile, { active: false });
            }

            // Scroll to target position
            virtualizer.scrollToIndex(targetIndex, { align: 'auto' });
        },
        [files, selectionState.selectedFiles, selectionDispatch, app.workspace, virtualizer]
    );

    /**
     * List pane-specific keyboard handler
     */
    const handleKeyDown = useCallback(
        (e: KeyboardEvent, helpers: KeyboardNavigationHelpers<ListPaneItem>) => {
            const currentIndex = getCurrentIndex();
            const shortcuts = settings.keyboardShortcuts;
            const isRTL = helpers.isRTL();
            let targetIndex = -1;
            // Tracks whether to scroll to the top of the list after selection
            let shouldScrollToTop = false;

            // Returns the index of the first selectable item in the list
            const getFirstSelectableIndex = () => helpers.findNextIndex(-1);
            // Finds the nearest selectable item before the given index
            const findSelectableBefore = (startIndex: number) => {
                if (items.length === 0) {
                    return -1;
                }

                for (let i = Math.min(startIndex, items.length - 1); i >= 0; i--) {
                    const candidate = helpers.getItemAt(i);
                    if (candidate && isSelectableListItem(candidate)) {
                        return i;
                    }
                }

                return -1;
            };

            if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.LIST_EXTEND_SELECTION_DOWN)) {
                e.preventDefault();
                if (!isMobile && selectionState.selectedFile?.path) {
                    const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                    if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                        const finalFileIndex = multiSelection.handleShiftArrowSelection('down', currentFileIndex, files);
                        if (finalFileIndex >= 0) {
                            const finalFile = files[finalFileIndex];
                            const itemIndex = pathToIndex.get(finalFile.path);
                            if (itemIndex !== undefined) {
                                helpers.scrollToIndex(itemIndex);
                            }
                        }
                    }
                }
                return;
            }

            if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.LIST_EXTEND_SELECTION_UP)) {
                e.preventDefault();
                if (!isMobile && selectionState.selectedFile?.path) {
                    const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                    if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                        const finalFileIndex = multiSelection.handleShiftArrowSelection('up', currentFileIndex, files);
                        if (finalFileIndex >= 0) {
                            const finalFile = files[finalFileIndex];
                            const itemIndex = pathToIndex.get(finalFile.path);
                            if (itemIndex !== undefined) {
                                helpers.scrollToIndex(itemIndex);
                            }
                        }
                    }
                }
                return;
            }

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
                            if (item && isSelectableListItem(item)) {
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
                matchesShortcut(e, shortcuts, KeyboardShortcutAction.LIST_FOCUS_EDITOR, {
                    isRTL,
                    directional: 'horizontal'
                })
            ) {
                if (selectionState.selectedFile) {
                    e.preventDefault();
                    const leaves = getSupportedLeaves(app);
                    const targetLeaf = leaves.find(leaf => {
                        const view = leaf.view;
                        return view instanceof FileView && view.file?.path === selectionState.selectedFile?.path;
                    });
                    if (targetLeaf) {
                        app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                    }
                }
            } else if (
                matchesShortcut(e, shortcuts, KeyboardShortcutAction.LIST_FOCUS_NAVIGATION, {
                    isRTL,
                    directional: 'horizontal'
                })
            ) {
                e.preventDefault();
                if (uiState.singlePane && !isMobile) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                } else if (!uiState.singlePane) {
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.DELETE_SELECTED)) {
                if (selectionState.selectedFile || selectionState.selectedFiles.size > 0) {
                    e.preventDefault();
                    deleteSelectedFiles({
                        app,
                        fileSystemOps,
                        settings,
                        selectionState,
                        selectionDispatch,
                        tagTreeService,
                        topicService
                    });
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.LIST_SELECT_ALL)) {
                e.preventDefault();
                const allFiles = items
                    .filter(item => item.type === ListPaneItemType.FILE)
                    .map(item => {
                        const fileItem = item;
                        return fileItem.data instanceof TFile ? fileItem.data : null;
                    })
                    .filter((file): file is TFile => file !== null);

                multiSelection.selectAll(allFiles);
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.LIST_RANGE_TO_START)) {
                e.preventDefault();
                if (!isMobile && selectionState.selectedFile?.path) {
                    const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                    if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                        handleRangeSelection('home', currentFileIndex);
                    }
                }
                return;
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.LIST_RANGE_TO_END)) {
                e.preventDefault();
                if (!isMobile && selectionState.selectedFile?.path) {
                    const currentFileIndex = fileIndexMap.get(selectionState.selectedFile.path);
                    if (currentFileIndex !== undefined && currentFileIndex !== -1) {
                        handleRangeSelection('end', currentFileIndex);
                    }
                }
                return;
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_HOME)) {
                e.preventDefault();
                const firstSelectableIndex = getFirstSelectableIndex();
                targetIndex = firstSelectableIndex;
                if (firstSelectableIndex >= 0) {
                    shouldScrollToTop = true;
                }
            } else if (matchesShortcut(e, shortcuts, KeyboardShortcutAction.PANE_END)) {
                e.preventDefault();
                for (let i = items.length - 1; i >= 0; i--) {
                    const item = helpers.getItemAt(i);
                    if (item && isSelectableListItem(item)) {
                        targetIndex = i;
                        break;
                    }
                }
            }

            if (targetIndex >= 0 && targetIndex < items.length) {
                const item = helpers.getItemAt(targetIndex);
                if (item && isSelectableListItem(item)) {
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
            isMobile,
            selectionState,
            fileIndexMap,
            multiSelection,
            files,
            pathToIndex,
            app,
            uiState.singlePane,
            uiDispatch,
            fileSystemOps,
            tagTreeService,
            selectionDispatch,
            selectItemAtIndex,
            handleRangeSelection,
            items,
            virtualizer
        ]
    );

    // Use the base keyboard navigation hook
    useKeyboardNavigation({
        items,
        virtualizer,
        focusedPane: 'files',
        containerRef,
        isSelectable: isSelectableListItem,
        _getCurrentIndex: getCurrentIndex,
        onKeyDown: handleKeyDown
    });
}
