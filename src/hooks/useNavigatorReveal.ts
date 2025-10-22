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

import { useEffect, useRef, useCallback, RefObject, useState } from 'react';
import { TFile, TFolder, App, FileView } from 'obsidian';
import { getLeafSplitLocation } from '../utils/workspaceSplit';
import type { ListPaneHandle } from '../components/ListPane';
import type { NavigationPaneHandle } from '../components/NavigationPane';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import type { SelectionRevealSource } from '../context/SelectionContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useFileCache } from '../context/StorageContext';
import { useCommandQueue, useTopicService } from '../context/ServicesContext';
import { determineTagToReveal, findNearestVisibleTagAncestor, resolveCanonicalTagPath } from '../utils/tagUtils';
import { ItemType, UNTAGGED_TAG_ID } from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { normalizeNavigationPath } from '../utils/navigationIndex';
import type { Align } from '../types/scroll';

interface UseNavigatorRevealOptions {
    app: App;
    navigationPaneRef: RefObject<NavigationPaneHandle | null>;
    listPaneRef: RefObject<ListPaneHandle | null>;
}

export interface RevealFileOptions {
    // Indicates the source of the reveal action
    source?: SelectionRevealSource;
    // True if this reveal happens during plugin startup
    isStartupReveal?: boolean;
    // Prevents switching focus away from the navigation pane
    preserveNavigationFocus?: boolean;
}

/**
 * Custom hook that handles revealing items (files, folders, tags) in the Navigator, including:
 * - Manual reveal (via commands, context menus, or direct navigation)
 * - Auto-reveal (on file open/startup when enabled in settings)
 * - Parent expansion behavior (expanding ancestor folders/tags to make items visible)
 * - View switching (between navigation and file list in single-pane mode)
 *
 * This hook encapsulates the complex reveal logic that was previously
 * in the NotebookNavigatorComponent, making it reusable and testable.
 */
export function useNavigatorReveal({ app, navigationPaneRef, listPaneRef }: UseNavigatorRevealOptions) {
    const settings = useSettingsState();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const { getDB, findTagInTree } = useFileCache();
    const commandQueue = useCommandQueue();
    const topicService = useTopicService();

    // Auto-reveal state
    const [fileToReveal, setFileToReveal] = useState<TFile | null>(null);
    const [isStartupReveal, setIsStartupReveal] = useState<boolean>(false);
    const activeFileRef = useRef<string | null>(null);
    const hasInitializedRef = useRef<boolean>(false);

    const getRevealTargetFolder = useCallback(
        (folder: TFolder | null): { target: TFolder | null; expandAncestors: boolean } => {
            if (!folder) {
                return { target: null, expandAncestors: false };
            }

            if (!settings.includeDescendantNotes) {
                return { target: folder, expandAncestors: true };
            }

            const root = app.vault.getRoot();
            const rootPath = root?.path ?? '/';

            const isFolderVisible = (candidate: TFolder): boolean => {
                if (!settings.showRootFolder && root && candidate === root) {
                    return false;
                }

                let current: TFolder | null = candidate;
                while (current) {
                    const parent: TFolder | null = current.parent;
                    if (!parent) {
                        break;
                    }
                    const parentIsRoot = root && parent.path === rootPath;

                    if (parentIsRoot && !settings.showRootFolder) {
                        current = parent;
                        continue;
                    }

                    if (!expansionState.expandedFolders.has(parent.path)) {
                        return false;
                    }

                    current = parent;
                }

                return true;
            };

            let current: TFolder | null = folder;
            while (current && !isFolderVisible(current)) {
                current = current.parent;
            }

            if (!current) {
                const fallback = settings.showRootFolder ? (root ?? folder) : folder;
                return { target: fallback, expandAncestors: false };
            }

            if (!settings.showRootFolder && root && current === root) {
                return { target: folder, expandAncestors: false };
            }

            return { target: current, expandAncestors: false };
        },
        [settings.includeDescendantNotes, settings.showRootFolder, expansionState.expandedFolders, app]
    );

    /**
     * Handles manual file reveals triggered from commands or context menus.
     * Selects the file, switches the view to its parent folder (always the real parent when descendant notes are shown),
     * expands any collapsed ancestor folders, focuses the list pane, and requests navigation pane scroll to the target folder.
     *
     * @param file - File to surface in the navigator
     */
    const revealFileInActualFolder = useCallback(
        (file: TFile, options?: RevealFileOptions) => {
            if (!file?.parent) return;

            const parentFolder = file.parent;
            // Determine which folder the navigator should display after reveal
            const { target, expandAncestors } = getRevealTargetFolder(parentFolder);

            // Always resolve to the actual parent folder for manual reveals
            const resolvedFolder = settings.includeDescendantNotes ? parentFolder : (target ?? parentFolder);

            const foldersToExpand: string[] = [];
            let ancestor: TFolder | null = parentFolder.parent;

            // Collect ancestor folders so manual reveal can expand collapsed levels
            while (ancestor) {
                foldersToExpand.unshift(ancestor.path);
                if (ancestor.path === '/') break;
                ancestor = ancestor.parent;
            }

            const shouldExpandFolders =
                foldersToExpand.length > 0 && (expandAncestors || foldersToExpand.some(path => !expansionState.expandedFolders.has(path)));

            if (shouldExpandFolders) {
                // Expand collapsed ancestors to ensure the folder becomes visible in navigation pane
                expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
            }

            // Switch selection to the file and its resolved folder so the list pane updates immediately
            selectionDispatch({
                type: 'REVEAL_FILE',
                file,
                preserveFolder: false,
                isManualReveal: true,
                targetFolder: resolvedFolder ?? undefined,
                source: options?.source
            });

            // In single pane mode, switch to list pane view
            if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation') {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            // Shift focus to list pane unless already there
            if (uiState.focusedPane !== 'files') {
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            }

            if (navigationPaneRef.current && resolvedFolder) {
                // Scroll navigation pane so the resolved folder stays in view for manual reveals
                navigationPaneRef.current.requestScroll(resolvedFolder.path, { align: 'auto', itemType: ItemType.FOLDER });
            }
        },
        [
            expansionState.expandedFolders,
            expansionDispatch,
            selectionDispatch,
            uiState,
            uiDispatch,
            navigationPaneRef,
            getRevealTargetFolder,
            settings.includeDescendantNotes
        ]
    );

    /**
     * Reveals a tag in the navigation pane by expanding parent tags if needed.
     *
     * @param tagPath - The tag path to reveal (without # prefix)
     */
    const revealTag = useCallback(
        (tagPath: string, options?: { skipSinglePaneSwitch?: boolean }) => {
            if (!tagPath) {
                return;
            }

            const canonicalPath = resolveCanonicalTagPath(tagPath);
            if (!canonicalPath) {
                return;
            }

            if (canonicalPath !== UNTAGGED_TAG_ID) {
                const tagNode = findTagInTree(canonicalPath);
                if (!tagNode) {
                    return;
                }
            }

            // Expand virtual folders if needed
            const virtualFoldersToExpand: string[] = [];

            // Check if we need to expand virtual folders based on settings
            if (settings.showTags && settings.showAllTagsFolder) {
                virtualFoldersToExpand.push('tags-root');
            }

            // Expand virtual folders if needed
            const virtualFoldersNeedExpansion = virtualFoldersToExpand.some(id => !expansionState.expandedVirtualFolders.has(id));
            if (virtualFoldersNeedExpansion) {
                const newExpanded = new Set(expansionState.expandedVirtualFolders);
                virtualFoldersToExpand.forEach(id => newExpanded.add(id));
                expansionDispatch({ type: 'SET_EXPANDED_VIRTUAL_FOLDERS', folders: newExpanded });
            }

            if (canonicalPath !== UNTAGGED_TAG_ID) {
                const tagsToExpand: string[] = [];
                const parts = canonicalPath.split('/');

                for (let i = 1; i < parts.length; i++) {
                    const parentPath = parts.slice(0, i).join('/');
                    tagsToExpand.push(parentPath);
                }

                const needsExpansion = tagsToExpand.some(path => !expansionState.expandedTags.has(path));
                if (needsExpansion) {
                    expansionDispatch({ type: 'EXPAND_TAGS', tagPaths: tagsToExpand });
                }
            }

            selectionDispatch({ type: 'SET_SELECTED_TAG', tag: canonicalPath });

            // In single pane mode, switch to list pane view (same as revealFileInActualFolder)
            const shouldSkipSinglePaneSwitch = options?.skipSinglePaneSwitch ?? false;
            if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation' && !shouldSkipSinglePaneSwitch) {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            if (shouldSkipSinglePaneSwitch) {
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
            } else {
                // Always shift focus to list pane (same as revealFileInActualFolder)
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            }

            if (navigationPaneRef.current) {
                navigationPaneRef.current.requestScroll(canonicalPath, { align: 'auto', itemType: ItemType.TAG });
            }

            // If we have a selected file, trigger a reveal to ensure proper item visibility
            // This makes tag reveal follow the same flow as folder reveal
            if (selectionState.selectedFile) {
                selectionDispatch({
                    type: 'REVEAL_FILE',
                    file: selectionState.selectedFile,
                    preserveFolder: true, // We're in tag view, preserve it
                    isManualReveal: false, // This is part of auto-reveal
                    targetTag: canonicalPath
                });
            }
        },
        [
            expansionState.expandedTags,
            expansionState.expandedVirtualFolders,
            expansionDispatch,
            selectionDispatch,
            uiState,
            uiDispatch,
            settings,
            selectionState.selectedFile,
            findTagInTree,
            navigationPaneRef
        ]
    );

    /**
     * Handles implicit file reveals (auto-reveal, shortcuts, recent notes).
     * Keeps the current visible context when possible by targeting the first ancestor that is currently expanded,
     * switches tag views when needed, and only falls back to the real parent when no ancestor is visible.
     *
     * @param file - File to surface while preserving the visible navigation context
     */
    const revealFileInNearestFolder = useCallback(
        (file: TFile, options?: RevealFileOptions) => {
            if (!file?.parent) return;

            // Check if we're in tag view and should switch tags
            let targetTag: string | null | undefined = undefined;
            let targetFolderOverride: TFolder | null = null;
            let preserveFolder = false;
            const revealSource: SelectionRevealSource | undefined = options?.isStartupReveal ? 'startup' : options?.source;
            const shouldCenterNavigation = Boolean(options?.isStartupReveal && settings.startView === 'navigation');
            const navigationAlign: Align = shouldCenterNavigation ? 'center' : 'auto';
            if (selectionState.selectionType === 'tag') {
                targetTag = determineTagToReveal(file, selectionState.selectedTag, settings, getDB());

                if (targetTag) {
                    const visibleTag = findNearestVisibleTagAncestor(targetTag, expansionState.expandedTags);
                    targetTag = visibleTag;
                }
            }

            let resolvedFolder: TFolder | null = null;

            if ((targetTag === null || targetTag === undefined) && file.parent) {
                const { target, expandAncestors } = getRevealTargetFolder(file.parent);
                resolvedFolder = target;

                if (target) {
                    if (selectionState.selectedFolder && selectionState.selectedFolder.path === target.path) {
                        preserveFolder = true;
                    } else {
                        targetFolderOverride = target;
                    }
                }

                if (expandAncestors) {
                    const foldersToExpand: string[] = [];
                    let currentFolder: TFolder | null = file.parent;

                    if (currentFolder && currentFolder.parent) {
                        currentFolder = currentFolder.parent;
                        while (currentFolder) {
                            foldersToExpand.unshift(currentFolder.path);
                            if (currentFolder.path === '/') break;
                            currentFolder = currentFolder.parent;
                        }
                    }

                    if (foldersToExpand.some(path => !expansionState.expandedFolders.has(path))) {
                        expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
                    }
                }
            }

            // Trigger the reveal - this is an auto-reveal, not manual
            selectionDispatch({
                type: 'REVEAL_FILE',
                file,
                preserveFolder,
                isManualReveal: false,
                targetTag,
                targetFolder: targetFolderOverride ?? undefined,
                source: revealSource
            });

            // Determine whether to switch to files view in single pane mode
            // Check if we're currently opening the homepage file
            const isHomepageContext = Boolean(commandQueue?.isOpeningHomepage());
            const shouldSkipSinglePaneSwitch = Boolean(
                (options?.isStartupReveal && settings.startView === 'navigation') ||
                    options?.preserveNavigationFocus ||
                    (isHomepageContext && settings.startView === 'navigation')
            );

            if (uiState.singlePane && uiState.currentSinglePaneView === 'navigation' && !shouldSkipSinglePaneSwitch) {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            // Don't change focus - let Obsidian handle focus naturally when opening files

            if (!targetTag && navigationPaneRef.current) {
                const scrollFolder =
                    targetFolderOverride ??
                    (preserveFolder && selectionState.selectedFolder ? selectionState.selectedFolder : (resolvedFolder ?? file.parent));
                if (scrollFolder) {
                    navigationPaneRef.current.requestScroll(scrollFolder.path, { align: navigationAlign, itemType: ItemType.FOLDER });
                }
            }
        },
        [
            settings,
            selectionState.selectedFolder,
            selectionState.selectionType,
            selectionState.selectedTag,
            expansionState.expandedFolders,
            expansionState.expandedTags,
            expansionDispatch,
            selectionDispatch,
            uiState,
            uiDispatch,
            getDB,
            getRevealTargetFolder,
            navigationPaneRef,
            commandQueue
        ]
    );

    /**
     * Navigates to a folder by path, expanding ancestors and selecting it.
     * Used by the "Navigate to folder" command.
     *
     * @param folderPath - The path of the folder to navigate to
     */
    const navigateToFolder = useCallback(
        (folderPath: string) => {
            const folder = app.vault.getFolderByPath(folderPath);
            if (!folder) return;

            // Expand all ancestors to make the folder visible
            const foldersToExpand: string[] = [];
            let currentFolder: TFolder | null = folder.parent;

            while (currentFolder) {
                foldersToExpand.unshift(currentFolder.path);
                if (currentFolder.path === '/') break;
                currentFolder = currentFolder.parent;
            }

            // Expand folders if needed
            const needsExpansion = foldersToExpand.some(path => !expansionState.expandedFolders.has(path));
            if (needsExpansion) {
                expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: foldersToExpand });
            }

            // Select the folder
            selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

            // In single pane mode, switch to list pane view and focus list pane
            if (uiState.singlePane) {
                if (uiState.currentSinglePaneView === 'navigation') {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                }
                // Set focus to list pane when in single pane mode
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
            } else {
                // In dual-pane mode, focus the folders pane
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
            }

            if (navigationPaneRef.current) {
                navigationPaneRef.current.requestScroll(folder.path, { align: 'auto', itemType: ItemType.FOLDER });
            }
        },
        [app, expansionState.expandedFolders, expansionDispatch, selectionDispatch, uiState, uiDispatch, navigationPaneRef]
    );

    // Auto-reveal effect: Reset fileToReveal after it's been consumed
    useEffect(() => {
        if (fileToReveal) {
            // Clear after a short delay to ensure the consumer has processed it
            const timer = window.setTimeout(() => {
                setFileToReveal(null);
                setIsStartupReveal(false);
            }, TIMEOUTS.DEBOUNCE_KEYBOARD);
            return () => window.clearTimeout(timer);
        }
    }, [fileToReveal]);

    // Auto-reveal effect: Detect which file needs revealing
    useEffect(() => {
        if (!settings.autoRevealActiveFile) return;

        /**
         * Detects if the active file has changed and triggers reveal if needed.
         * This is the single entry point for both file-open and active-leaf-change events.
         */
        const detectActiveFileChange = () => {
            // Get the currently active file view
            const view = app.workspace.getActiveViewOfType(FileView);
            if (!view?.file || !(view.file instanceof TFile)) {
                return;
            }

            const file = view.file;

            // Check if the file was just created; always reveal newly created files
            const isRecentlyCreated = file.stat.ctime === file.stat.mtime && Date.now() - file.stat.ctime < TIMEOUTS.FILE_OPERATION_DELAY;

            if (!isRecentlyCreated && settings.autoRevealIgnoreRightSidebar) {
                // Determine split of the active leaf and skip right-sidebar
                const activeLeaf = view.leaf;
                const split = getLeafSplitLocation(app, activeLeaf);
                if (split === 'right-sidebar') {
                    return;
                }
            }

            // Check if this is actually a different file
            if (activeFileRef.current === file.path) {
                return; // Same file, no change
            }

            // Update the active file reference
            activeFileRef.current = file.path;

            // Always reveal newly created files
            if (isRecentlyCreated) {
                setFileToReveal(file);
                return;
            }

            // Check if we're opening version history or in a new context
            const isOpeningVersionHistory = commandQueue && commandQueue.isOpeningVersionHistory();
            const isOpeningInNewContext = commandQueue && commandQueue.isOpeningInNewContext();

            // Don't reveal if navigator has focus (unless we're opening version history or in new context)
            const navigatorEl = document.querySelector('.nn-split-container');
            const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);

            if (hasNavigatorFocus && !isOpeningVersionHistory && !isOpeningInNewContext) {
                return;
            }

            // Don't reveal if we're opening a folder note
            const isOpeningFolderNote = commandQueue && commandQueue.isOpeningFolderNote();

            if (isOpeningFolderNote) {
                return;
            }

            // Reveal the file
            setFileToReveal(file);
        };

        const handleActiveLeafChange = () => {
            detectActiveFileChange();
        };

        const handleFileOpen = () => {
            detectActiveFileChange();
        };

        const activeLeafEventRef = app.workspace.on('active-leaf-change', handleActiveLeafChange);
        const fileOpenEventRef = app.workspace.on('file-open', handleFileOpen);

        // Check for currently active file on mount
        if (!hasInitializedRef.current) {
            const activeFile = app.workspace.getActiveFile();
            if (activeFile) {
                // Skip startup auto-reveal if the active leaf is in right sidebar
                const activeLeaf = app.workspace.getActiveViewOfType(FileView)?.leaf ?? null;
                const split = getLeafSplitLocation(app, activeLeaf);
                if (!settings.autoRevealIgnoreRightSidebar || split !== 'right-sidebar') {
                    activeFileRef.current = activeFile.path;
                    setIsStartupReveal(true);
                    setFileToReveal(activeFile);
                }
            }
            hasInitializedRef.current = true;
        }

        return () => {
            app.workspace.offref(activeLeafEventRef);
            app.workspace.offref(fileOpenEventRef);
        };
    }, [app, app.workspace, settings.autoRevealActiveFile, settings.autoRevealIgnoreRightSidebar, settings.startView, commandQueue]);

    // Handle revealing the file when detected
    useEffect(() => {
        if (fileToReveal) {
            if (isStartupReveal) {
                // On startup, if we're already in tag view with the correct file selected, skip reveal but expand tags
                if (
                    selectionState.selectionType === ItemType.TAG &&
                    selectionState.selectedTag &&
                    selectionState.selectedFile?.path === fileToReveal.path
                ) {
                    const skipSinglePaneSwitch = uiState.singlePane && settings.startView === 'navigation';
                    revealTag(selectionState.selectedTag, { skipSinglePaneSwitch });

                    // After expanding the tag, trigger the file reveal
                    // This ensures proper visibility in the list pane
                    selectionDispatch({
                        type: 'REVEAL_FILE',
                        file: fileToReveal,
                        preserveFolder: true, // We're in tag view, preserve it
                        isManualReveal: false, // This is auto-reveal
                        targetTag: selectionState.selectedTag
                    });
                    return;
                }
                // Use nearest folder for startup - this respects includeDescendantNotes
                // and preserves the current folder selection when possible
                revealFileInNearestFolder(fileToReveal, { source: 'auto', isStartupReveal: true });
            } else {
                revealFileInNearestFolder(fileToReveal, { source: 'auto' }); // Use nearest folder for sidebar clicks
            }
        }
    }, [
        fileToReveal,
        isStartupReveal,
        revealFileInActualFolder,
        revealFileInNearestFolder,
        selectionState.selectionType,
        selectionState.selectedTag,
        selectionState.selectedFile,
        revealTag,
        selectionDispatch,
        settings.startView,
        uiState.singlePane
    ]);

    /**
     * Request scrolling to revealed items after selection changes.
     * Folder/tag expansion happens in the reveal functions BEFORE selection changes.
     * The actual scrolling is handled by the navigation and list panes.
     */
    useEffect(() => {
        // ONLY process if this is a reveal operation, not normal keyboard navigation
        if (selectionState.isRevealOperation && selectionState.selectedFile) {
            if (selectionState.revealSource === 'shortcut') {
                return;
            }
            // Request scroll in navigation pane if visible
            const shouldScrollNavigation = !uiState.singlePane || uiState.currentSinglePaneView === 'navigation';

            if (shouldScrollNavigation) {
                if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                    // Request scroll to tag
                    const tagPath = normalizeNavigationPath(ItemType.TAG, selectionState.selectedTag);
                    navigationPaneRef.current?.requestScroll(tagPath, {
                        itemType: ItemType.TAG
                    });
                } else if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                    // Scroll to the selected folder even when it remains an ancestor during descendant reveals
                    const folderPath = normalizeNavigationPath(ItemType.FOLDER, selectionState.selectedFolder.path);
                    navigationPaneRef.current?.requestScroll(folderPath, {
                        itemType: ItemType.FOLDER
                    });
                }
            }

            // ListPane handles its own scroll requests via pendingScrollRef
            // This ensures proper measurement for large folders before scrolling
        }
    }, [
        selectionState.isRevealOperation,
        selectionState.selectedFolder,
        selectionState.selectedFile,
        selectionState.selectionType,
        selectionState.selectedTag,
        selectionState.revealSource,
        navigationPaneRef,
        listPaneRef,
        uiState.singlePane,
        uiState.currentSinglePaneView
    ]);

    /**
     * Reveals a topic in the navigation pane by expanding ancestors and selecting it
     */
    const revealTopic = useCallback(
        (topicName: string) => {
            if (!topicService) {
                return;
            }

            const topicNode = topicService.findTopicNode(topicName);
            if (!topicNode) {
                return;
            }

            // Get ancestor topic names (if any)
            const { getTopicAncestors } = require('../utils/topicGraph');
            const ancestorNames = getTopicAncestors(topicNode);

            // Build the full path for this topic from its ancestors
            // If ancestors = ["AI", "Machine Learning"], topicName = "Neural Networks"
            // Then topicPath = "AI/Machine Learning/Neural Networks"
            const topicPath = ancestorNames.length > 0 
                ? `${ancestorNames.join('/')}/${topicName}` 
                : topicName;

            // Build ancestor paths for expansion
            // For ancestors ["AI", "Machine Learning"], we need paths ["AI", "AI/Machine Learning"]
            const ancestorPaths: string[] = [];
            for (let i = 0; i < ancestorNames.length; i++) {
                const path = ancestorNames.slice(0, i + 1).join('/');
                ancestorPaths.push(path);
            }

            // Expand the Topics virtual folder
            const currentExpanded = new Set(expansionState.expandedVirtualFolders);
            currentExpanded.add('topics');
            expansionDispatch({ type: 'SET_EXPANDED_VIRTUAL_FOLDERS', folders: currentExpanded });

            // Expand all ancestor topics using paths
            if (ancestorPaths.length > 0) {
                expansionDispatch({ type: 'EXPAND_TOPICS', topicNames: ancestorPaths });
            }

            // Select the topic using its full path
            selectionDispatch({ type: 'SET_SELECTED_TOPIC', topic: topicPath });

            // Request scroll to the topic in navigation pane using its path
            setTimeout(() => {
                navigationPaneRef.current?.requestScroll(topicPath, {
                    itemType: ItemType.TOPIC
                });
            }, 50);
        },
        [topicService, expansionState.expandedVirtualFolders, expansionDispatch, selectionDispatch, navigationPaneRef]
    );

    return {
        revealFileInActualFolder,
        revealFileInNearestFolder,
        navigateToFolder,
        revealTag,
        revealTopic
    };
}
