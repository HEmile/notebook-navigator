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

import type { App, TFile, TFolder } from 'obsidian';
import { PROPERTIES_ROOT_VIRTUAL_FOLDER_ID } from '../../types';
import { normalizePropertyNodeId } from '../../utils/propertyTree';
import { normalizeTagPath } from '../../utils/tagUtils';
import type { SelectionAction, SelectionRevealSource, SelectionState } from './types';

function createSelectedFilesSet(file?: TFile | null): Set<string> {
    const selectedFiles = new Set<string>();
    if (file) {
        selectedFiles.add(file.path);
    }
    return selectedFiles;
}

function normalizeSelectedPropertyNodeId(nodeId: SelectionState['selectedProperty']): SelectionState['selectedProperty'] {
    if (!nodeId || nodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
        return nodeId;
    }

    return normalizePropertyNodeId(nodeId) ?? nodeId;
}

function withSingleSelection(
    state: SelectionState,
    params: {
        selectionType: SelectionState['selectionType'];
        selectedFolder: TFolder | null;
        selectedTag: string | null;
        selectedProperty: SelectionState['selectedProperty'];
        selectedFile: TFile | null;
        isRevealOperation: boolean;
        isFolderChangeWithAutoSelect: boolean;
        isKeyboardNavigation: boolean;
        isFolderNavigation: boolean;
        revealSource: SelectionRevealSource | null;
    }
): SelectionState {
    return {
        ...state,
        selectionType: params.selectionType,
        selectedFolder: params.selectedFolder,
        selectedTag: params.selectedTag,
        selectedProperty: params.selectedProperty,
        selectedFiles: createSelectedFilesSet(params.selectedFile),
        selectedFile: params.selectedFile,
        anchorIndex: null,
        lastMovementDirection: null,
        isRevealOperation: params.isRevealOperation,
        isFolderChangeWithAutoSelect: params.isFolderChangeWithAutoSelect,
        isKeyboardNavigation: params.isKeyboardNavigation,
        isFolderNavigation: params.isFolderNavigation,
        revealSource: params.revealSource
    };
}

export function getFirstSelectedFile(selectedFiles: Set<string>, app: App): TFile | null {
    const iterator = selectedFiles.values().next();
    if (iterator.done) {
        return null;
    }

    const firstPath = iterator.value;
    if (!firstPath) {
        return null;
    }

    return app.vault.getFileByPath(firstPath) ?? null;
}

export function resolvePrimarySelectedFile(app: App, selectionState: SelectionState): TFile | null {
    if (selectionState.selectedFile) {
        return selectionState.selectedFile;
    }

    return getFirstSelectedFile(selectionState.selectedFiles, app);
}

export function selectionReducer(state: SelectionState, action: SelectionAction, app?: App): SelectionState {
    switch (action.type) {
        case 'SET_SELECTED_FOLDER':
            return withSingleSelection(state, {
                selectionType: 'folder',
                selectedFolder: action.folder,
                selectedTag: null,
                selectedProperty: null,
                selectedFile: action.autoSelectedFile ?? null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false,
                isFolderNavigation: true,
                revealSource: action.source ?? null
            });

        case 'SET_SELECTED_TAG':
            return withSingleSelection(state, {
                selectionType: 'tag',
                selectedFolder: null,
                selectedTag: normalizeTagPath(action.tag),
                selectedProperty: null,
                selectedFile: action.autoSelectedFile ?? null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false,
                isFolderNavigation: true,
                revealSource: action.source ?? null
            });

        case 'SET_SELECTED_PROPERTY':
            return withSingleSelection(state, {
                selectionType: 'property',
                selectedFolder: null,
                selectedTag: null,
                selectedProperty: normalizeSelectedPropertyNodeId(action.nodeId),
                selectedFile: action.autoSelectedFile ?? null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: action.autoSelectedFile !== undefined && action.autoSelectedFile !== null,
                isKeyboardNavigation: false,
                isFolderNavigation: true,
                revealSource: action.source ?? null
            });

        case 'SET_SELECTED_FILE':
            return {
                ...state,
                selectedFiles: createSelectedFilesSet(action.file),
                selectedFile: action.file,
                anchorIndex: null,
                lastMovementDirection: null,
                isRevealOperation: false,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                isFolderNavigation: false,
                revealSource: null
            };

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
                selectedProperty: null,
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
            const revealSource: SelectionRevealSource = action.source ?? (action.isManualReveal ? 'manual' : 'auto');
            const targetFolder = action.targetFolder ?? null;

            if (action.isManualReveal) {
                return withSingleSelection(state, {
                    selectionType: 'folder',
                    selectedFolder: targetFolder ?? action.file.parent,
                    selectedTag: null,
                    selectedProperty: null,
                    selectedFile: action.file,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    isFolderNavigation: state.isFolderNavigation,
                    revealSource
                });
            }

            if (normalizedTargetTag !== undefined) {
                if (normalizedTargetTag) {
                    return withSingleSelection(state, {
                        selectionType: 'tag',
                        selectedFolder: null,
                        selectedTag: normalizedTargetTag,
                        selectedProperty: null,
                        selectedFile: action.file,
                        isRevealOperation: true,
                        isFolderChangeWithAutoSelect: false,
                        isKeyboardNavigation: false,
                        isFolderNavigation: state.isFolderNavigation,
                        revealSource
                    });
                }

                return withSingleSelection(state, {
                    selectionType: 'folder',
                    selectedFolder:
                        targetFolder ?? (action.preserveFolder && state.selectedFolder ? state.selectedFolder : action.file.parent),
                    selectedTag: null,
                    selectedProperty: null,
                    selectedFile: action.file,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    isFolderNavigation: state.isFolderNavigation,
                    revealSource
                });
            }

            if (action.targetProperty !== undefined) {
                if (action.targetProperty) {
                    return withSingleSelection(state, {
                        selectionType: 'property',
                        selectedFolder: null,
                        selectedTag: null,
                        selectedProperty: normalizeSelectedPropertyNodeId(action.targetProperty),
                        selectedFile: action.file,
                        isRevealOperation: true,
                        isFolderChangeWithAutoSelect: false,
                        isKeyboardNavigation: false,
                        isFolderNavigation: state.isFolderNavigation,
                        revealSource
                    });
                }

                return withSingleSelection(state, {
                    selectionType: 'folder',
                    selectedFolder:
                        targetFolder ?? (action.preserveFolder && state.selectedFolder ? state.selectedFolder : action.file.parent),
                    selectedTag: null,
                    selectedProperty: null,
                    selectedFile: action.file,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    isFolderNavigation: state.isFolderNavigation,
                    revealSource
                });
            }

            if (state.selectionType === 'tag' && state.selectedTag) {
                return withSingleSelection(state, {
                    selectionType: 'tag',
                    selectedFolder: null,
                    selectedTag: state.selectedTag,
                    selectedProperty: null,
                    selectedFile: action.file,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    isFolderNavigation: state.isFolderNavigation,
                    revealSource
                });
            }

            if (state.selectionType === 'property' && state.selectedProperty) {
                return withSingleSelection(state, {
                    selectionType: 'property',
                    selectedFolder: null,
                    selectedTag: null,
                    selectedProperty: state.selectedProperty,
                    selectedFile: action.file,
                    isRevealOperation: true,
                    isFolderChangeWithAutoSelect: false,
                    isKeyboardNavigation: false,
                    isFolderNavigation: state.isFolderNavigation,
                    revealSource
                });
            }

            return withSingleSelection(state, {
                selectionType: 'folder',
                selectedFolder: targetFolder ?? (action.preserveFolder && state.selectedFolder ? state.selectedFolder : action.file.parent),
                selectedTag: null,
                selectedProperty: null,
                selectedFile: action.file,
                isRevealOperation: true,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                isFolderNavigation: state.isFolderNavigation,
                revealSource
            });
        }

        case 'CLEANUP_DELETED_FOLDER':
            if (!state.selectedFolder || state.selectedFolder.path !== action.deletedPath) {
                return state;
            }

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

        case 'CLEANUP_DELETED_FILE': {
            const selectedFiles = new Set(state.selectedFiles);
            selectedFiles.delete(action.deletedPath);

            let anchorIndex = state.anchorIndex;
            if (state.anchorIndex !== null && selectedFiles.size === 0) {
                anchorIndex = null;
            }

            if (action.nextFileToSelect) {
                selectedFiles.add(action.nextFileToSelect.path);
            }

            return {
                ...state,
                selectedFiles,
                selectedFile: action.nextFileToSelect ?? (app ? getFirstSelectedFile(selectedFiles, app) : null),
                anchorIndex,
                isFolderChangeWithAutoSelect: false,
                isKeyboardNavigation: false,
                revealSource: null
            };
        }

        case 'TOGGLE_FILE_SELECTION': {
            const selectedFiles = new Set(state.selectedFiles);
            if (selectedFiles.has(action.file.path)) {
                selectedFiles.delete(action.file.path);
            } else {
                selectedFiles.add(action.file.path);
            }

            return {
                ...state,
                selectedFiles,
                selectedFile: state.selectedFile,
                anchorIndex: action.anchorIndex !== undefined ? action.anchorIndex : state.anchorIndex,
                lastMovementDirection: null
            };
        }

        case 'EXTEND_SELECTION': {
            const { toIndex, allFiles } = action;
            if (state.anchorIndex === null) {
                return state;
            }

            const minIndex = Math.min(state.anchorIndex, toIndex);
            const maxIndex = Math.max(state.anchorIndex, toIndex);
            const selectedFiles = new Set<string>();
            for (let index = minIndex; index <= maxIndex && index < allFiles.length; index += 1) {
                if (allFiles[index]) {
                    selectedFiles.add(allFiles[index].path);
                }
            }

            return {
                ...state,
                selectedFiles,
                selectedFile: allFiles[toIndex] ?? null,
                lastMovementDirection: null
            };
        }

        case 'CLEAR_FILE_SELECTION':
            return {
                ...state,
                selectedFiles: new Set<string>(),
                selectedFile: null,
                anchorIndex: null,
                lastMovementDirection: null
            };

        case 'SET_ANCHOR_INDEX':
            return {
                ...state,
                anchorIndex: action.index
            };

        case 'SET_MOVEMENT_DIRECTION':
            return {
                ...state,
                lastMovementDirection: action.direction
            };

        case 'UPDATE_CURRENT_FILE':
            return {
                ...state,
                selectedFile: action.file
            };

        case 'TOGGLE_WITH_CURSOR': {
            const selectedFiles = new Set(state.selectedFiles);
            if (selectedFiles.has(action.file.path)) {
                selectedFiles.delete(action.file.path);
            } else {
                selectedFiles.add(action.file.path);
            }

            return {
                ...state,
                selectedFiles,
                selectedFile: action.file,
                anchorIndex: action.anchorIndex !== undefined ? action.anchorIndex : state.anchorIndex,
                lastMovementDirection: null
            };
        }

        case 'SET_KEYBOARD_NAVIGATION':
            return {
                ...state,
                isKeyboardNavigation: action.isKeyboardNavigation
            };

        case 'SET_FOLDER_CHANGE_WITH_AUTO_SELECT':
            return {
                ...state,
                isFolderChangeWithAutoSelect: action.isFolderChangeWithAutoSelect
            };

        case 'SET_FOLDER_NAVIGATION':
            return {
                ...state,
                isFolderNavigation: action.isFolderNavigation
            };

        case 'UPDATE_FILE_PATH': {
            const selectedFiles = new Set(state.selectedFiles);
            if (selectedFiles.has(action.oldPath)) {
                selectedFiles.delete(action.oldPath);
                selectedFiles.add(action.newPath);
            }

            let selectedFile = state.selectedFile;
            if (state.selectedFile && state.selectedFile.path === action.oldPath && app) {
                selectedFile = app.vault.getFileByPath(action.newPath) ?? selectedFile;
            }

            return {
                ...state,
                selectedFiles,
                selectedFile
            };
        }

        default:
            return state;
    }
}
