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

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { App, TFile, TFolder } from 'obsidian';
import { NavigationItemType, STORAGE_KEYS } from '../types';
import { getFilesForFolder, getFilesForTag, getFilesForTopicByPath} from '../utils/fileFinder';
import { useSettingsState } from './SettingsContext';
import { localStorage } from '../utils/localStorage';
import type { NotebookNavigatorAPI } from '../api/NotebookNavigatorAPI';
import type { TagTreeService } from '../services/TagTreeService';
import type { TopicService } from '../services/TopicGraphService';
import { normalizeTagPath } from '../utils/tagUtils';
import { getTopicNameFromPath } from 'src/utils/topicGraph';

export type SelectionRevealSource = 'auto' | 'manual' | 'shortcut' | 'startup';

// State interface
export interface SelectionState {
    selectionType: NavigationItemType;
    selectedFolder: TFolder | null;
    selectedTag: string | null;
    selectedTopicPath: string | null;
    selectedFiles: Set<string>; // Changed from single file to Set of file paths
    anchorIndex: number | null; // Anchor position for multi-selection
    lastMovementDirection: 'up' | 'down' | null; // Track direction for expand/contract
    isRevealOperation: boolean; // Flag to track if the current selection is from a REVEAL_FILE action
    isFolderChangeWithAutoSelect: boolean; // Flag to track if we just changed folders and auto-selected a file
    isKeyboardNavigation: boolean; // Flag to track if selection is from Tab/Right arrow navigation
    isFolderNavigation: boolean; // Flag to track if we just navigated to a different folder

    selectedFile: TFile | null; // Current cursor position / primary selected file
    revealSource: SelectionRevealSource | null; // Identifies how the latest reveal was triggered
}

// Action types
export type SelectionAction =
    | { type: 'SET_SELECTED_FOLDER'; folder: TFolder | null; autoSelectedFile?: TFile | null }
    | { type: 'SET_SELECTED_TAG'; tag: string | null; autoSelectedFile?: TFile | null }
    | { type: 'SET_SELECTED_TOPIC'; topicPath: string | null; autoSelectedFile?: TFile | null }
    | { type: 'SET_SELECTED_FILE'; file: TFile | null }
    | { type: 'SET_SELECTION_TYPE'; selectionType: NavigationItemType }
    | { type: 'CLEAR_SELECTION' }
    | {
          type: 'REVEAL_FILE';
          file: TFile;
          preserveFolder?: boolean;
          isManualReveal?: boolean;
          targetTag?: string | null;
          targetTopic?: string | null;
          source?: SelectionRevealSource;
          targetFolder?: TFolder | null;
      }
    | { type: 'CLEANUP_DELETED_FOLDER'; deletedPath: string }
    | { type: 'CLEANUP_DELETED_FILE'; deletedPath: string; nextFileToSelect?: TFile | null }
    // Multi-selection actions
    | { type: 'TOGGLE_FILE_SELECTION'; file: TFile; anchorIndex?: number }
    | { type: 'EXTEND_SELECTION'; toIndex: number; files: TFile[]; allFiles: TFile[] }
    | { type: 'CLEAR_FILE_SELECTION' }
    | { type: 'SET_ANCHOR_INDEX'; index: number | null }
    | { type: 'SET_MOVEMENT_DIRECTION'; direction: 'up' | 'down' | null }
    | { type: 'UPDATE_CURRENT_FILE'; file: TFile } // Update current file without changing selection
    | { type: 'TOGGLE_WITH_CURSOR'; file: TFile; anchorIndex?: number } // Toggle selection and update cursor
    | { type: 'SET_KEYBOARD_NAVIGATION'; isKeyboardNavigation: boolean } // Set keyboard navigation flag
    | { type: 'UPDATE_FILE_PATH'; oldPath: string; newPath: string } // Update file path after rename
    | { type: 'SET_FOLDER_NAVIGATION'; isFolderNavigation: boolean }; // Set folder navigation flag

// Dispatch function type
export type SelectionDispatch = React.Dispatch<SelectionAction>;

// Create contexts
const SelectionContext = createContext<SelectionState | null>(null);
const SelectionDispatchContext = createContext<React.Dispatch<SelectionAction> | null>(null);

// Helper function to get first file from selection
function getFirstSelectedFile(selectedFiles: Set<string>, app: App): TFile | null {
    if (selectedFiles.size === 0) return null;
    const firstPath = Array.from(selectedFiles)[0];
    const file = app.vault.getFileByPath(firstPath);
    return file || null;
}

/**
 * Selection state reducer - manages all selection-related state transitions.
 *
 * Key concepts:
 * - selectedFiles: Set of file paths for multi-selection
 * - selectedFile: Current cursor position for keyboard navigation
 * - selectionType: Whether a folder or tag is selected
 * - Flags: isRevealOperation and isFolderChangeWithAutoSelect coordinate complex updates
 *
 * State transitions:
 * - SET_SELECTED_FOLDER/TAG: Changes navigation context, optionally auto-selects first file
 * - TOGGLE_FILE_SELECTION: Adds/removes files from multi-selection
 * - TOGGLE_WITH_CURSOR: Updates both selection and cursor position
 * - UPDATE_CURRENT_FILE: Moves cursor without changing selection
 * - CLEAR_FILE_SELECTION: Resets to no selection
 *
 * @param state Current selection state
 * @param action Action to perform
 * @param app Obsidian app instance for file operations
 * @returns New selection state
 */
function selectionReducer(state: SelectionState, action: SelectionAction, app?: App): SelectionState {
    switch (action.type) {
        case 'SET_SELECTED_FOLDER': {
            const newSelectedFiles = new Set<string>();
            if (action.autoSelectedFile) {
                newSelectedFiles.add(action.autoSelectedFile.path);
            }
            return {
                ...state,
                selectedFolder: action.folder,
                selectedTag: null,
                selectedTopicPath: null,
                selectionType: 'folder',
                selectedFiles: newSelectedFiles,
                selectedFile: action.autoSelectedFile || null,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false,
                isFolderNavigation: true, // Set flag when folder changes
                revealSource: null
            };
        }

        case 'SET_SELECTED_TAG': {
            const newSelectedFiles = new Set<string>();
            if (action.autoSelectedFile) {
                newSelectedFiles.add(action.autoSelectedFile.path);
            }
            const normalizedTag = normalizeTagPath(action.tag);
            return {
                ...state,
                selectedTag: normalizedTag,
                selectedFolder: null,
                selectedTopicPath: null,
                selectionType: 'tag',
                selectedFiles: newSelectedFiles,
                selectedFile: action.autoSelectedFile || null,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false,
                isFolderNavigation: true, // Set flag when tag changes too
                revealSource: null
            };
        }

        case 'SET_SELECTED_TOPIC': {
            const newSelectedFiles = new Set<string>();
            if (action.autoSelectedFile) {
                newSelectedFiles.add(action.autoSelectedFile.path);
            }
            return {
                ...state,
                selectedTopicPath: action.topicPath,
                selectedFolder: null,
                selectedTag: null,
                selectionType: 'topic',
                selectedFiles: newSelectedFiles,
                selectedFile: action.autoSelectedFile || null,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false,
                isFolderNavigation: true, // Set flag when topic changes too
                revealSource: null
            };
        }

        case 'SET_SELECTED_FILE': {
            // Always clear selection and select only this file
            const newSelectedFiles = new Set<string>();
            if (action.file) {
                newSelectedFiles.add(action.file.path);
            }
            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: action.file,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                isFolderNavigation: false,
                revealSource: null // Clear folder navigation flag
            };
        }

        case 'SET_SELECTION_TYPE':
            return {
                ...state,
                selectionType: action.selectionType,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                revealSource: null
            };

        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedFolder: null,
                selectedTag: null,
                selectedTopicPath: null,
                selectedFiles: new Set<string>(),
                selectedFile: null,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                revealSource: null
            };

        case 'REVEAL_FILE': {
            if (!action.file.parent) {
                return state;
            }

            const normalizedTargetTag = action.targetTag === undefined ? undefined : normalizeTagPath(action.targetTag);
            const targetTopic = action.targetTopic ?? undefined;
            const newSelectedFiles = new Set<string>();
            newSelectedFiles.add(action.file.path);

            const revealSource: SelectionRevealSource = action.source ?? (action.isManualReveal ? 'manual' : 'auto');
            const targetFolder = action.targetFolder ?? null;

            // Manual reveals always go to folder view
            if (action.isManualReveal) {
                const folderToSelect = targetFolder ?? action.file.parent;
                return {
                    ...state,
                    selectionType: 'folder',
                    selectedFolder: folderToSelect,
                    selectedTag: null,
                    selectedTopicPath: null,
                    selectedFiles: newSelectedFiles,
                    selectedFile: action.file,
                    anchorIndex: null,
                    lastMovementDirection: null,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    revealSource
                };
            }

            // Auto-reveals: Check if we have a target topic
            if (targetTopic !== undefined) {
                if (targetTopic) {
                    // Switch to or stay in topic view
                    return {
                        ...state,
                        selectionType: 'topic',
                        selectedTopicPath: targetTopic,
                        selectedFolder: null,
                        selectedTag: null,
                        selectedFiles: newSelectedFiles,
                        selectedFile: action.file,
                        anchorIndex: null,
                        lastMovementDirection: null,
                        isRevealOperation: true,
                        isFolderChangeWithAutoSelect: false,
                        isKeyboardNavigation: false,
                        revealSource
                    };
                }
                // No topic to reveal, fall through to check target tag
            }

            // Auto-reveals: Check if we have a target tag
            if (normalizedTargetTag !== undefined) {
                if (normalizedTargetTag) {
                    // Switch to or stay in tag view
                    return {
                        ...state,
                        selectionType: 'tag',
                        selectedTag: normalizedTargetTag,
                        selectedFolder: null,
                        selectedTopicPath: null,
                        selectedFiles: newSelectedFiles,
                        selectedFile: action.file,
                        anchorIndex: null,
                        lastMovementDirection: null,
                        isRevealOperation: true,
                        isFolderChangeWithAutoSelect: false,
                        isKeyboardNavigation: false,
                        revealSource
                    };
                }
                // No tag to reveal, switch to folder view
                const newFolder =
                    targetFolder ?? (action.preserveFolder && state.selectedFolder ? state.selectedFolder : action.file.parent);
                return {
                    ...state,
                    selectionType: 'folder',
                    selectedFolder: newFolder,
                    selectedTag: null,
                    selectedTopicPath: null,
                    selectedFiles: newSelectedFiles,
                    selectedFile: action.file,
                    anchorIndex: null,
                    lastMovementDirection: null,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    revealSource
                };
            }

            // When targetTag is not specified, preserve current view type
            const shouldPreserveTag = state.selectionType === 'tag' && state.selectedTag;
            const shouldPreserveTopic = state.selectionType === 'topic' && state.selectedTopicPath;
            if (shouldPreserveTag) {
                return {
                    ...state,
                    selectionType: 'tag',
                    selectedTag: state.selectedTag,
                    selectedFolder: null,
                    selectedTopicPath: null,
                    selectedFiles: newSelectedFiles,
                    selectedFile: action.file,
                    anchorIndex: null,
                    lastMovementDirection: null,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    revealSource
                };
            }
            if (shouldPreserveTopic) {
                return {
                    ...state,
                    selectionType: 'topic',
                    selectedTopicPath: state.selectedTopicPath,
                    selectedFolder: null,
                    selectedTag: null,
                    selectedFiles: newSelectedFiles,
                    selectedFile: action.file,
                    anchorIndex: null,
                    lastMovementDirection: null,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    revealSource
                };
            }

            // Default: switch to folder view
            const newFolder = targetFolder ?? (action.preserveFolder && state.selectedFolder ? state.selectedFolder : action.file.parent);
            return {
                ...state,
                selectionType: 'folder',
                selectedFolder: newFolder,
                selectedTag: null,
                selectedTopicPath: null,
                selectedFiles: newSelectedFiles,
                selectedFile: action.file,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: true,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                revealSource
            };
        }

        case 'CLEANUP_DELETED_FOLDER': {
            if (state.selectedFolder && state.selectedFolder.path === action.deletedPath) {
                return {
                    ...state,
                    selectedFolder: null,
                    selectedFiles: new Set<string>(),
                    selectedFile: null,
                    anchorIndex: null,
                    lastMovementDirection: null,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    revealSource: null
                };
            }
            return state;
        }

        case 'CLEANUP_DELETED_FILE': {
            const newSelectedFiles = new Set(state.selectedFiles);
            newSelectedFiles.delete(action.deletedPath);

            // If we deleted files from multi-selection, update anchor
            let newAnchorIndex = state.anchorIndex;
            if (state.anchorIndex !== null && newSelectedFiles.size === 0) {
                newAnchorIndex = null;
            }

            if (action.nextFileToSelect) {
                newSelectedFiles.add(action.nextFileToSelect.path);
            }

            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: action.nextFileToSelect || (app ? getFirstSelectedFile(newSelectedFiles, app) : null),
                anchorIndex: newAnchorIndex,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                revealSource: null
            };
        }

        // Multi-selection actions
        case 'TOGGLE_FILE_SELECTION': {
            const newSelectedFiles = new Set(state.selectedFiles);
            if (newSelectedFiles.has(action.file.path)) {
                newSelectedFiles.delete(action.file.path);
            } else {
                newSelectedFiles.add(action.file.path);
            }

            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: state.selectedFile, // Don't change cursor position when toggling
                anchorIndex: action.anchorIndex !== undefined ? action.anchorIndex : state.anchorIndex,
                lastMovementDirection: null
            };
        }

        case 'EXTEND_SELECTION': {
            const { toIndex, allFiles } = action;
            if (state.anchorIndex === null) return state;

            // This action should only select from anchor to current, not replace everything
            // For now, just select the range from anchor to toIndex
            const minIndex = Math.min(state.anchorIndex, toIndex);
            const maxIndex = Math.max(state.anchorIndex, toIndex);

            // Create new selection with files in range
            const newSelectedFiles = new Set<string>();
            for (let i = minIndex; i <= maxIndex && i < allFiles.length; i++) {
                if (allFiles[i]) {
                    newSelectedFiles.add(allFiles[i].path);
                }
            }

            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: allFiles[toIndex] || null,
                lastMovementDirection: null
            };
        }

        case 'CLEAR_FILE_SELECTION': {
            return {
                ...state,
                selectedFiles: new Set<string>(),
                selectedFile: null,
                anchorIndex: null,
                lastMovementDirection: null
            };
        }

        case 'SET_ANCHOR_INDEX': {
            return {
                ...state,
                anchorIndex: action.index
            };
        }

        case 'SET_MOVEMENT_DIRECTION': {
            return {
                ...state,
                lastMovementDirection: action.direction
            };
        }

        case 'UPDATE_CURRENT_FILE': {
            return {
                ...state,
                selectedFile: action.file
            };
        }

        case 'TOGGLE_WITH_CURSOR': {
            const newSelectedFiles = new Set(state.selectedFiles);
            if (newSelectedFiles.has(action.file.path)) {
                newSelectedFiles.delete(action.file.path);
            } else {
                newSelectedFiles.add(action.file.path);
            }

            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: action.file, // Always update cursor to the clicked file
                anchorIndex: action.anchorIndex !== undefined ? action.anchorIndex : state.anchorIndex,
                lastMovementDirection: null
            };
        }

        case 'SET_KEYBOARD_NAVIGATION': {
            return {
                ...state,
                isKeyboardNavigation: action.isKeyboardNavigation
            };
        }

        case 'SET_FOLDER_NAVIGATION': {
            return {
                ...state,
                isFolderNavigation: action.isFolderNavigation
            };
        }

        case 'UPDATE_FILE_PATH': {
            // Update selected files set
            const newSelectedFiles = new Set(state.selectedFiles);
            if (newSelectedFiles.has(action.oldPath)) {
                newSelectedFiles.delete(action.oldPath);
                newSelectedFiles.add(action.newPath);
            }

            // Update selected file reference if it was renamed
            let newSelectedFile = state.selectedFile;
            if (state.selectedFile && state.selectedFile.path === action.oldPath && app) {
                const updatedFile = app.vault.getFileByPath(action.newPath);
                if (updatedFile) {
                    newSelectedFile = updatedFile;
                }
            }

            return {
                ...state,
                selectedFiles: newSelectedFiles,
                selectedFile: newSelectedFile
            };
        }

        default:
            return state;
    }
}

// Provider component
interface SelectionProviderProps {
    children: ReactNode;
    app: App; // Obsidian App instance
    api: NotebookNavigatorAPI | null; // API for triggering events
    tagTreeService: TagTreeService | null; // Tag tree service for tag operations
    topicService: TopicService | null; // Topic service for topic operations
    onFileRename?: (listenerId: string, callback: (oldPath: string, newPath: string) => void) => void;
    onFileRenameUnsubscribe?: (listenerId: string) => void;
    isMobile: boolean;
}

export function SelectionProvider({
    children,
    app,
    api,
    tagTreeService,
    topicService,
    onFileRename,
    onFileRenameUnsubscribe,
    isMobile
}: SelectionProviderProps) {
    // Get current settings from SettingsContext
    const settings = useSettingsState();

    // Load initial state from localStorage and vault
    const loadInitialState = useCallback((): SelectionState => {
        const vault = app.vault;

        // Load saved folder path with error handling
        let savedFolderPath: string | null = null;
        try {
            savedFolderPath = localStorage.get<string>(STORAGE_KEYS.selectedFolderKey);
        } catch (error) {
            console.error('Failed to load selected folder from localStorage:', error);
        }

        let selectedFolder: TFolder | null = null;
        if (savedFolderPath) {
            const folder = vault.getFolderByPath(savedFolderPath);
            if (folder) {
                selectedFolder = folder;
            }
        }

        // Load saved tag with error handling
        let savedTag: string | null = null;
        try {
            savedTag = localStorage.get<string>(STORAGE_KEYS.selectedTagKey);
        } catch (error) {
            console.error('Failed to load selected tag from localStorage:', error);
        }

        // Load saved file path with error handling
        let savedFilePath: string | null = null;
        try {
            savedFilePath = localStorage.get<string>(STORAGE_KEYS.selectedFileKey);
        } catch (error) {
            console.error('Failed to load selected file from localStorage:', error);
        }

        // Load saved multi-selection with error handling
        let savedFilePaths: string[] = [];
        try {
            savedFilePaths = localStorage.get<string[]>(STORAGE_KEYS.selectedFilesKey) || [];
        } catch (error) {
            console.error('Failed to load selected files from localStorage:', error);
        }

        let selectedFile: TFile | null = null;
        const selectedFiles = new Set<string>();

        // Load multi-selection if available
        if (savedFilePaths.length > 0) {
            for (const path of savedFilePaths) {
                const file = vault.getFileByPath(path);
                if (file) {
                    selectedFiles.add(file.path);
                    // Set the first valid file as the primary file if we don't have one
                    if (!selectedFile) {
                        selectedFile = file;
                    }
                }
            }
        }

        // Fall back to single file if no multi-selection
        if (selectedFiles.size === 0 && savedFilePath) {
            const file = vault.getFileByPath(savedFilePath);
            if (file) {
                selectedFile = file;
                selectedFiles.add(file.path);
            }
        }

        // Determine selection type based on what was saved
        let selectionType: NavigationItemType = 'folder';
        const normalizedTag = normalizeTagPath(savedTag);

        if (normalizedTag) {
            selectionType = 'tag';
            selectedFolder = null; // Clear folder if tag is selected
        } else if (!selectedFolder) {
            // Default to root folder if no selection
            selectedFolder = vault.getRoot();
        }

        return {
            selectionType,
            selectedFolder,
            selectedTag: normalizedTag,
            selectedTopicPath: null,
            selectedFiles,
            selectedFile,
            anchorIndex: null,
            lastMovementDirection: null,
            isRevealOperation: false,
            isFolderChangeWithAutoSelect: false,
            isKeyboardNavigation: false,
            isFolderNavigation: false,
            revealSource: null
        };
    }, [app.vault]);

    const [state, dispatch] = useReducer(
        (state: SelectionState, action: SelectionAction) => selectionReducer(state, action, app),
        undefined,
        loadInitialState
    );

    // Create an enhanced dispatch that handles side effects
    const enhancedDispatch = useCallback(
        (action: SelectionAction) => {
            // Handle auto-select logic for folder selection
            if (action.type === 'SET_SELECTED_FOLDER' && action.autoSelectedFile === undefined) {
                if (action.folder) {
                    const filesInFolder = getFilesForFolder(action.folder, settings, app);

                    // Desktop with autoSelectFirstFile enabled: ALWAYS select first file
                    if (!isMobile && settings.autoSelectFirstFileOnFocusChange && filesInFolder.length > 0) {
                        dispatch({ ...action, autoSelectedFile: filesInFolder[0] });
                    } else {
                        // Otherwise, check for active file
                        const activeFile = app.workspace.getActiveFile();
                        const activeFileInFolder = activeFile && filesInFolder.some(f => f.path === activeFile.path);

                        if (activeFileInFolder) {
                            // Select the active file if it's in the folder (mobile always, desktop when autoSelect is off)
                            dispatch({ ...action, autoSelectedFile: activeFile });
                        } else {
                            // No auto-selection
                            dispatch({ ...action, autoSelectedFile: null });
                        }
                    }

                    // Navigation event will be triggered by the useEffect watching selectedFolder
                } else {
                    dispatch({ ...action, autoSelectedFile: null });
                }
            }
            // Handle auto-select logic for tag selection
            else if (action.type === 'SET_SELECTED_TAG' && action.autoSelectedFile === undefined) {
                if (action.tag) {
                    const filesForTag = getFilesForTag(action.tag, settings, app, tagTreeService);

                    // Desktop with autoSelectFirstFile enabled: ALWAYS select first file
                    if (!isMobile && settings.autoSelectFirstFileOnFocusChange && filesForTag.length > 0) {
                        dispatch({ ...action, autoSelectedFile: filesForTag[0] });
                    } else {
                        // Otherwise, check for active file
                        const activeFile = app.workspace.getActiveFile();
                        const activeFileInTag = activeFile && filesForTag.some(f => f.path === activeFile.path);

                        if (activeFileInTag) {
                            // Select the active file if it's in the tag view (mobile always, desktop when autoSelect is off)
                            dispatch({ ...action, autoSelectedFile: activeFile });
                        } else {
                            // No auto-selection
                            dispatch({ ...action, autoSelectedFile: null });
                        }
                    }

                    // Navigation event will be triggered by the useEffect watching selectedTag
                } else {
                    dispatch({ ...action, autoSelectedFile: null });
                }
            }
            // Handle auto-select logic for topic selection
            else if (action.type === 'SET_SELECTED_TOPIC' && action.autoSelectedFile === undefined) {
                if (action.topicPath) {
                    const filesForTopic = getFilesForTopicByPath(action.topicPath, settings, app, topicService);

                    // Desktop with autoSelectFirstFile enabled: ALWAYS select first file
                    if (!isMobile && settings.autoSelectFirstFileOnFocusChange && filesForTopic.length > 0) {
                        dispatch({ ...action, autoSelectedFile: filesForTopic[0] });
                    } else {
                        // Otherwise, check for active file
                        const activeFile = app.workspace.getActiveFile();
                        const activeFileInTopic = activeFile && filesForTopic.some(f => f.path === activeFile.path);

                        if (activeFileInTopic) {
                            // Select the active file if it's in the topic view (mobile always, desktop when autoSelect is off)
                            dispatch({ ...action, autoSelectedFile: activeFile });
                        } else {
                            // No auto-selection
                            dispatch({ ...action, autoSelectedFile: null });
                        }
                    }

                    // Navigation event will be triggered by the useEffect watching selectedTopic
                } else {
                    dispatch({ ...action, autoSelectedFile: null });
                }
            }
            // Handle cleanup for deleted files on mobile
            else if (action.type === 'CLEANUP_DELETED_FILE' && isMobile) {
                // On mobile, never auto-select next file
                dispatch({ ...action, nextFileToSelect: null });
            }
            // For all other actions, dispatch as-is
            else {
                dispatch(action);
            }
        },
        [app, settings, isMobile, tagTreeService, topicService, dispatch]
    );

    // Persist selected folder to localStorage with error handling
    useEffect(() => {
        try {
            if (state.selectedFolder) {
                localStorage.set(STORAGE_KEYS.selectedFolderKey, state.selectedFolder.path);
            } else {
                localStorage.remove(STORAGE_KEYS.selectedFolderKey);
            }
        } catch (error) {
            console.error('Failed to save selected folder to localStorage:', error);
        }
    }, [state.selectedFolder]);

    // Persist selected tag to localStorage with error handling
    useEffect(() => {
        try {
            if (state.selectedTag) {
                localStorage.set(STORAGE_KEYS.selectedTagKey, state.selectedTag);
            } else {
                localStorage.remove(STORAGE_KEYS.selectedTagKey);
            }
        } catch (error) {
            console.error('Failed to save selected tag to localStorage:', error);
        }
    }, [state.selectedTag]);

    // Persist selected file to localStorage with error handling
    useEffect(() => {
        try {
            // Save the first selected file
            const firstFile = state.selectedFile || getFirstSelectedFile(state.selectedFiles, app);
            if (firstFile) {
                localStorage.set(STORAGE_KEYS.selectedFileKey, firstFile.path);
            } else {
                localStorage.remove(STORAGE_KEYS.selectedFileKey);
            }
        } catch (error) {
            console.error('Failed to save selected file to localStorage:', error);
        }
    }, [state.selectedFile, state.selectedFiles, app]);

    // Persist multi-selection to localStorage and notify plugin
    useEffect(() => {
        try {
            // Save all selected files
            if (state.selectedFiles.size > 0) {
                localStorage.set(STORAGE_KEYS.selectedFilesKey, Array.from(state.selectedFiles));
            } else {
                localStorage.remove(STORAGE_KEYS.selectedFilesKey);
            }

            // Notify the API about file selection changes
            if (api && api.selection) {
                api.selection.updateFileState(state.selectedFiles, state.selectedFile);
            }
        } catch (error) {
            console.error('Failed to save selected files to localStorage:', error);
        }
    }, [state.selectedFiles, state.selectedFile, api]);

    // Notify API about navigation selection changes
    useEffect(() => {
        if (api && api.selection) {
            api.selection.updateNavigationState(state.selectedFolder, state.selectedTag);
        }
    }, [state.selectedFolder, state.selectedTag, api]);

    // Register file rename listener
    useEffect(() => {
        const listenerId = `selection-context-${Math.random().toString(36).substr(2, 9)}`;

        const handleFileRename = (oldPath: string, newPath: string) => {
            dispatch({ type: 'UPDATE_FILE_PATH', oldPath, newPath });
        };

        if (onFileRename) {
            onFileRename(listenerId, handleFileRename);
        }

        return () => {
            if (onFileRenameUnsubscribe) {
                onFileRenameUnsubscribe(listenerId);
            }
        };
    }, [onFileRename, onFileRenameUnsubscribe, dispatch]);

    return (
        <SelectionContext.Provider value={state}>
            <SelectionDispatchContext.Provider value={enhancedDispatch}>{children}</SelectionDispatchContext.Provider>
        </SelectionContext.Provider>
    );
}

// Custom hooks
export function useSelectionState() {
    const context = useContext(SelectionContext);
    if (!context) {
        throw new Error('useSelectionState must be used within SelectionProvider');
    }
    return context;
}

export function useSelectionDispatch() {
    const context = useContext(SelectionDispatchContext);
    if (!context) {
        throw new Error('useSelectionDispatch must be used within SelectionProvider');
    }
    return context;
}
