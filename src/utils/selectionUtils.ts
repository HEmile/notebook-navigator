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

import { TFile, App } from 'obsidian';
import { SelectionDispatch, SelectionState } from '../context/SelectionContext';
import { ItemType } from '../types';
import { NotebookNavigatorSettings } from '../settings';
import { TagTreeService } from '../services/TagTreeService';
import { getFilesForFolder, getFilesForTag, getFilesForTopic } from './fileFinder';
import { TopicService } from 'src/services/TopicGraphService';

/**
 * Utilities for managing file selection operations
 */

/**
 * Get the path of the currently selected folder or tag
 * @param selectionState The current selection state
 * @returns The path string or null if nothing is selected
 */
export function getSelectedPath(selectionState: SelectionState): string | null {
    if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
        return selectionState.selectedFolder.path;
    }
    if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
        return selectionState.selectedTag;
    }
    return null;
}

/**
 * Get all files for the current selection (folder or tag)
 * @param selectionState The current selection state
 * @param settings Plugin settings
 * @param app Obsidian app instance
 * @param tagTreeService Tag tree service for tag operations
 * @returns Array of files in the selected folder or with the selected tag
 */
export function getFilesForSelection(
    selectionState: SelectionState,
    settings: NotebookNavigatorSettings,
    app: App,
    tagTreeService: TagTreeService | null,
    topicService: TopicService | null
): TFile[] {
    if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
        return getFilesForFolder(selectionState.selectedFolder, settings, app);
    }
    if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
        return getFilesForTag(selectionState.selectedTag, settings, app, tagTreeService);
    }
    if (selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopicPath) {
        return getFilesForTopic(selectionState.selectedTopicPath, settings, app, topicService);
    }
    return [];
}

/**
 * Find the next file to select after removing files (delete or move)
 * @param allFiles - All files in the current view
 * @param removedPaths - Set of paths that are being removed (deleted or moved)
 * @returns The file to select after removal, or null if none
 */
export function findNextFileAfterRemoval(allFiles: TFile[], removedPaths: Set<string>): TFile | null {
    if (allFiles.length === 0) return null;

    // Find the first removed file's index
    let firstRemovedIndex = -1;
    for (let i = 0; i < allFiles.length; i++) {
        if (removedPaths.has(allFiles[i].path)) {
            firstRemovedIndex = i;
            break;
        }
    }

    if (firstRemovedIndex === -1) return null;

    // Strategy 1: Find first unselected file starting from first removed position
    for (let i = firstRemovedIndex; i < allFiles.length; i++) {
        if (!removedPaths.has(allFiles[i].path)) {
            return allFiles[i];
        }
    }

    // Strategy 2: If no file found after, look for first file before the selection
    if (firstRemovedIndex > 0) {
        for (let i = firstRemovedIndex - 1; i >= 0; i--) {
            if (!removedPaths.has(allFiles[i].path)) {
                return allFiles[i];
            }
        }
    }

    return null;
}

/**
 * Get files in range for shift-click selection
 * @param files - All files in order
 * @param startIndex - Starting index
 * @param endIndex - Ending index
 * @returns Array of files in the range
 */
export function getFilesInRange(files: TFile[], startIndex: number, endIndex: number): TFile[] {
    const minIndex = Math.max(0, Math.min(startIndex, endIndex));
    const maxIndex = Math.min(files.length - 1, Math.max(startIndex, endIndex));

    const result: TFile[] = [];
    for (let i = minIndex; i <= maxIndex; i++) {
        if (files[i]) {
            result.push(files[i]);
        }
    }

    return result;
}

/**
 * Find the index of a file in an ordered list
 * @param files - Ordered list of files
 * @param targetFile - File to find
 * @returns Index of the file, or -1 if not found
 */
export function findFileIndex(files: TFile[], targetFile: TFile | null): number {
    if (!targetFile) return -1;
    return files.findIndex(f => f.path === targetFile.path);
}

/**
 * Update selection after a file operation (delete, move, etc.)
 * Handles both selection state update and opening the file in editor
 * @param nextFile - The file to select, or null to clear selection
 * @param dispatch - Selection dispatch function
 * @param app - Obsidian app instance
 * @param options - Optional configuration
 */
export async function updateSelectionAfterFileOperation(
    nextFile: TFile | null,
    dispatch: SelectionDispatch,
    app: App,
    options: {
        openInEditor?: boolean; // Whether to open the file in editor (default: true)
        activeFile?: boolean; // Whether to make the file active (default: false)
    } = {}
): Promise<void> {
    const { openInEditor = true, activeFile = false } = options;

    // No file to select, clear selection and return
    if (!nextFile) {
        dispatch({ type: 'CLEAR_FILE_SELECTION' });
        return;
    }

    // Update selection state
    dispatch({ type: 'SET_SELECTED_FILE', file: nextFile });

    // Skip opening file if not requested
    if (!openInEditor) {
        return;
    }

    // Open the file in editor
    const leaf = app.workspace.getLeaf(false);
    if (!leaf) {
        return;
    }

    try {
        await leaf.openFile(nextFile, { active: activeFile });
    } catch (error) {
        console.error('Failed to open next file:', error);
    }
}
