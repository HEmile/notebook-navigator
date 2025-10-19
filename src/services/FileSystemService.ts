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

import { App, TFile, TFolder, TAbstractFile, Notice, normalizePath, Platform } from 'obsidian';
import type { SelectionDispatch } from '../context/SelectionContext';
import { strings } from '../i18n';
import { ConfirmModal } from '../modals/ConfirmModal';
import { FolderSuggestModal } from '../modals/FolderSuggestModal';
import { InputModal } from '../modals/InputModal';
import { NotebookNavigatorSettings } from '../settings';
import { NavigationItemType, ItemType } from '../types';
import { ExtendedApp, TIMEOUTS, OBSIDIAN_COMMANDS } from '../types/obsidian-extended';
import { createFileWithOptions, createDatabaseContent } from '../utils/fileCreationUtils';
import { getFolderNote, isFolderNote, isSupportedFolderNoteExtension } from '../utils/folderNotes';
import { updateSelectionAfterFileOperation, findNextFileAfterRemoval } from '../utils/selectionUtils';
import { executeCommand } from '../utils/typeGuards';
import { TagTreeService } from './TagTreeService';
import { CommandQueueService } from './CommandQueueService';
import { TopicService } from './TopicGraphService';

/**
 * Selection context for file operations
 * Contains the current selection state needed for smart deletion
 */
interface SelectionContext {
    selectionType: NavigationItemType;
    selectedFolder?: TFolder;
    selectedTag?: string;
    selectedTopic?: string;
}

/**
 * Options for the moveFilesToFolder method
 */
interface MoveFilesOptions {
    /** Files to move */
    files: TFile[];
    /** Target folder to move files into */
    targetFolder: TFolder;
    /** Current selection context for smart selection updates */
    selectionContext?: {
        selectedFile: TFile | null;
        dispatch: SelectionDispatch;
        allFiles: TFile[];
    };
    /** Whether to show notifications (default: true) */
    showNotifications?: boolean;
}

/**
 * Result of the moveFilesToFolder operation
 */
interface MoveFilesResult {
    /** Number of files successfully moved */
    movedCount: number;
    /** Number of files skipped due to conflicts */
    skippedCount: number;
    /** Files that failed to move with their errors */
    errors: { file: TFile; error: Error }[];
}

/**
 * Result of a folder move initiated from the context menu
 */
interface MoveFolderResult {
    /** Original folder path before the move */
    oldPath: string;
    /** New folder path after the move */
    newPath: string;
    /** Destination folder that now contains the moved folder */
    targetFolder: TFolder;
}

/**
 * Handles all file system operations for Notebook Navigator
 * Provides centralized methods for creating, renaming, and deleting files/folders
 * Manages user input modals and confirmation dialogs
 */
export class FileSystemOperations {
    /**
     * Creates a new FileSystemOperations instance
     * @param app - The Obsidian app instance for vault operations
     * @param getTagTreeService - Function to get the TagTreeService instance
     * @param getTopicService - Function to get the TopicService instance
     * @param getCommandQueue - Function to get the CommandQueueService instance
     */
    constructor(
        private app: App,
        private getTagTreeService: () => TagTreeService | null,
        private getTopicService: () => TopicService | null,
        private getCommandQueue: () => CommandQueueService | null
    ) {}

    /**
     * Creates a new folder with user-provided name
     * Shows input modal for folder name and handles creation
     * @param parent - The parent folder to create the new folder in
     * @param onSuccess - Optional callback with the new folder path on successful creation
     */
    async createNewFolder(parent: TFolder, onSuccess?: (path: string) => void): Promise<void> {
        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.newFolderTitle,
            strings.modals.fileSystem.folderNamePrompt,
            async name => {
                if (name) {
                    try {
                        const base = parent.path === '/' ? '' : `${parent.path}/`;
                        const path = normalizePath(`${base}${name}`);
                        await this.app.vault.createFolder(path);
                        if (onSuccess) {
                            onSuccess(path);
                        }
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.createFolder.replace('{error}', error.message));
                    }
                }
            }
        );
        modal.open();
    }

    /**
     * Creates a new markdown file with auto-generated "Untitled" name
     * Automatically increments name if "Untitled" already exists
     * Opens the file and triggers rename mode for immediate naming
     * @param parent - The parent folder to create the file in
     * @returns The created file or null if creation failed
     */
    async createNewFile(parent: TFolder): Promise<TFile | null> {
        return createFileWithOptions(parent, this.app, {
            extension: 'md',
            content: '',
            errorKey: 'createFile'
        });
    }

    /**
     * Renames a folder with user-provided name
     * Shows input modal pre-filled with current name
     * Validates that new name is different from current
     * Also renames associated folder note if it exists
     * @param folder - The folder to rename
     * @param settings - The plugin settings (optional)
     */
    async renameFolder(folder: TFolder, settings?: NotebookNavigatorSettings): Promise<void> {
        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.renameFolderTitle,
            strings.modals.fileSystem.renamePrompt,
            async newName => {
                if (newName && newName !== folder.name) {
                    try {
                        const useDefaultFolderNote = Boolean(settings?.enableFolderNotes && !settings.folderNoteName);

                        let folderNote: TFile | null = null;
                        if (useDefaultFolderNote && settings) {
                            folderNote = getFolderNote(folder, settings);
                        }

                        if (folderNote) {
                            const newNoteName = `${newName}.${folderNote.extension}`;
                            const folderBase = folder.path === '/' ? '' : `${folder.path}/`;
                            const conflictPath = normalizePath(`${folderBase}${newNoteName}`);
                            const conflict = this.app.vault.getFileByPath(conflictPath);
                            if (conflict) {
                                new Notice(strings.fileSystem.errors.renameFolderNoteConflict.replace('{name}', newNoteName));
                                return;
                            }
                        }

                        const parentPath = folder.parent?.path ?? '/';
                        const base = parentPath === '/' ? '' : `${parentPath}/`;
                        const newFolderPath = normalizePath(`${base}${newName}`);

                        // Rename the folder (moves contents including the folder note)
                        await this.app.fileManager.renameFile(folder, newFolderPath);

                        // Rename the folder note to match the new folder name when using default naming
                        if (folderNote) {
                            const newNotePath = normalizePath(`${newFolderPath}/${newName}.${folderNote.extension}`);
                            await this.app.fileManager.renameFile(folderNote, newNotePath);
                        }
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.renameFolder.replace('{error}', error.message));
                    }
                }
            },
            folder.name
        );
        modal.open();
    }

    /**
     * Renames a file with user-provided name
     * Shows input modal pre-filled with current basename
     * Preserves original file extension if not provided in new name
     * @param file - The file to rename
     */
    async renameFile(file: TFile): Promise<void> {
        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.renameFileTitle,
            strings.modals.fileSystem.renamePrompt,
            async newName => {
                if (newName && newName !== file.basename) {
                    try {
                        // Preserve original extension if not provided
                        if (!newName.includes('.')) {
                            newName += `.${file.extension}`;
                        }
                        const parentPath = file.parent?.path ?? '/';
                        const base = parentPath === '/' ? '' : `${parentPath}/`;
                        const newPath = normalizePath(`${base}${newName}`);
                        await this.app.fileManager.renameFile(file, newPath);
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.renameFile.replace('{error}', error.message));
                    }
                }
            },
            file.basename
        );
        modal.open();
    }

    /**
     * Deletes a folder and all its contents
     * Shows confirmation dialog if confirmBeforeDelete is true
     * Recursively deletes all files and subfolders
     * @param folder - The folder to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback on successful deletion
     */
    async deleteFolder(folder: TFolder, confirmBeforeDelete: boolean, onSuccess?: () => void): Promise<void> {
        if (confirmBeforeDelete) {
            const confirmModal = new ConfirmModal(
                this.app,
                strings.modals.fileSystem.deleteFolderTitle.replace('{name}', folder.name),
                strings.modals.fileSystem.deleteFolderConfirm,
                async () => {
                    try {
                        await this.app.fileManager.trashFile(folder);
                        if (onSuccess) {
                            onSuccess();
                        }
                    } catch (error) {
                        new Notice(strings.fileSystem.errors.deleteFolder.replace('{error}', error.message));
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            try {
                await this.app.fileManager.trashFile(folder);
                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                new Notice(strings.fileSystem.errors.deleteFolder.replace('{error}', error.message));
            }
        }
    }

    /**
     * Deletes a file from the vault
     * Shows confirmation dialog if confirmBeforeDelete is true
     * @param file - The file to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback on successful deletion
     * @param preDeleteAction - Optional action to run BEFORE the file is deleted (e.g., to select next file)
     */
    async deleteFile(
        file: TFile,
        confirmBeforeDelete: boolean,
        onSuccess?: () => void,
        preDeleteAction?: () => Promise<void>
    ): Promise<void> {
        const performDeleteCore = async () => {
            try {
                // Run pre-delete action if provided
                if (preDeleteAction) {
                    await preDeleteAction();
                }

                await this.app.fileManager.trashFile(file);

                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                new Notice(strings.fileSystem.errors.deleteFile.replace('{error}', error.message));
            }
        };

        if (confirmBeforeDelete) {
            const confirmModal = new ConfirmModal(
                this.app,
                strings.modals.fileSystem.deleteFileTitle.replace('{name}', file.basename),
                strings.modals.fileSystem.deleteFileConfirm,
                async () => {
                    const commandQueue = this.getCommandQueue();
                    if (commandQueue) {
                        await commandQueue.executeDeleteFiles([file], performDeleteCore);
                    } else {
                        await performDeleteCore();
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            const commandQueue = this.getCommandQueue();
            if (commandQueue) {
                await commandQueue.executeDeleteFiles([file], performDeleteCore);
            } else {
                await performDeleteCore();
            }
        }
    }

    /**
     * Smart delete handler for the currently selected file in the Navigator
     * Automatically selects the next file in the same folder before deletion
     * Used by both keyboard shortcuts and context menu
     *
     * @param file - The file to delete
     * @param settings - Plugin settings
     * @param selectionContext - Current selection context (type, folder, tag)
     * @param selectionDispatch - Selection dispatch function
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     */
    async deleteSelectedFile(
        file: TFile,
        settings: NotebookNavigatorSettings,
        selectionContext: SelectionContext,
        selectionDispatch: SelectionDispatch,
        confirmBeforeDelete: boolean
    ): Promise<void> {
        // Get the file list based on selection type
        let currentFiles: TFile[] = [];
        if (selectionContext.selectionType === ItemType.FOLDER && selectionContext.selectedFolder) {
            const { getFilesForFolder } = await import('../utils/fileFinder');
            currentFiles = getFilesForFolder(selectionContext.selectedFolder, settings, this.app);
        } else if (selectionContext.selectionType === ItemType.TAG && selectionContext.selectedTag) {
            const { getFilesForTag } = await import('../utils/fileFinder');
            currentFiles = getFilesForTag(selectionContext.selectedTag, settings, this.app, this.getTagTreeService());
        } else if (selectionContext.selectionType === ItemType.TOPIC && selectionContext.selectedTopic) {
            const { getFilesForTopic } = await import('../utils/fileFinder');
            currentFiles = getFilesForTopic(selectionContext.selectedTopic, settings, this.app, this.getTopicService());
        }
        // Find next file to select
        let nextFileToSelect: TFile | null = null;
        const currentIndex = currentFiles.findIndex(f => f.path === file.path);

        if (currentIndex !== -1 && currentFiles.length > 1) {
            // Try next file first
            if (currentIndex < currentFiles.length - 1) {
                nextFileToSelect = currentFiles[currentIndex + 1];
            } else if (currentIndex > 0) {
                // No next file, use previous
                nextFileToSelect = currentFiles[currentIndex - 1];
            }
        }

        // Perform the delete with pre-selection
        await this.deleteFile(file, confirmBeforeDelete, undefined, async () => {
            // Pre-delete action: select next file or close editor
            if (nextFileToSelect) {
                // Verify the next file still exists (in case of concurrent deletions)
                const stillExists = this.app.vault.getFileByPath(nextFileToSelect.path);
                if (stillExists) {
                    // Update selection and open the file
                    await updateSelectionAfterFileOperation(nextFileToSelect, selectionDispatch, this.app);
                } else {
                    // Next file was deleted, clear selection
                    await updateSelectionAfterFileOperation(null, selectionDispatch, this.app);
                }
            } else {
                // No other files in folder
                // Don't detach the leaf - let Obsidian handle it naturally after deletion
                // Just clear the selection
                selectionDispatch({ type: 'SET_SELECTED_FILE', file: null });
            }

            // Try to maintain focus on file list using a more reliable method
            window.setTimeout(() => {
                const fileListEl = document.querySelector('.nn-list-pane-scroller');
                if (fileListEl instanceof HTMLElement) {
                    fileListEl.focus();
                }
            }, TIMEOUTS.FILE_OPERATION_DELAY);
        });
    }

    /**
     * Checks if one file/folder is a descendant of another
     * Used to prevent invalid drag-and-drop operations
     * Prevents moving a folder into its own subfolder
     * @param parent - The potential parent file/folder
     * @param child - The potential descendant file/folder
     * @returns True if child is a descendant of parent
     */
    isDescendant(parent: TAbstractFile, child: TAbstractFile): boolean {
        let current = child.parent;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    /**
     * Moves multiple files to a target folder with validation and smart selection
     * Extracted from useDragAndDrop to enable reuse across drag-drop and context menu
     *
     * @param options - Move operation options
     * @returns Result object with moved count, skipped count, and errors
     */
    async moveFilesToFolder(options: MoveFilesOptions): Promise<MoveFilesResult> {
        const { files, targetFolder, selectionContext, showNotifications = true } = options;
        const result: MoveFilesResult = { movedCount: 0, skippedCount: 0, errors: [] };

        if (files.length === 0) return result;

        // Determine if we need to handle selection updates
        const pathsToMove = new Set(files.map(f => f.path));
        const isMovingSelectedFile = selectionContext?.selectedFile && pathsToMove.has(selectionContext.selectedFile.path);

        // Only find next file if we're moving the selected file
        let nextFileToSelect: TFile | null = null;
        if (isMovingSelectedFile && selectionContext) {
            nextFileToSelect = findNextFileAfterRemoval(selectionContext.allFiles, pathsToMove);
        }

        const commandQueue = this.getCommandQueue();
        if (commandQueue) {
            const moveResult = await commandQueue.executeMoveFiles(files, targetFolder);
            if (moveResult.success && moveResult.data) {
                result.movedCount = moveResult.data.movedCount;
                result.skippedCount = moveResult.data.skippedCount;
                // Map per-file errors back to TFile where possible for downstream notices
                if (Array.isArray(moveResult.data.errors) && moveResult.data.errors.length > 0) {
                    for (const err of moveResult.data.errors) {
                        const f = this.app.vault.getFileByPath(err.filePath);
                        if (f) {
                            result.errors.push({ file: f, error: err.error as Error });
                        } else {
                            // Fall back to first of the requested files with matching path
                            const fallback = files.find(x => x.path === err.filePath) || files[0];
                            result.errors.push({ file: fallback, error: err.error as Error });
                        }
                    }
                }
            } else if (moveResult.error) {
                console.error('Error during move operation:', moveResult.error);
                throw moveResult.error;
            }
        }

        // Handle selection updates if needed
        if (result.movedCount > 0 && isMovingSelectedFile && selectionContext) {
            await updateSelectionAfterFileOperation(nextFileToSelect, selectionContext.dispatch, this.app);
        }

        // Show notifications if enabled
        if (showNotifications) {
            if (result.skippedCount > 0) {
                const message =
                    files.length === 1
                        ? strings.dragDrop.errors.itemAlreadyExists.replace('{name}', files[0].name)
                        : strings.dragDrop.notifications.filesAlreadyExist.replace('{count}', result.skippedCount.toString());
                new Notice(message, TIMEOUTS.NOTICE_ERROR);
            }

            if (result.errors.length > 0 && files.length === 1) {
                const firstError = result.errors[0]?.error as unknown;
                const msg =
                    typeof (firstError as { message?: unknown })?.message === 'string' &&
                    ((firstError as { message?: string }).message?.trim() ?? '')
                        ? (firstError as { message: string }).message
                        : strings.common.unknownError;
                new Notice(strings.dragDrop.errors.failedToMove.replace('{error}', msg));
            }
        }

        return result;
    }

    /**
     * Shows a folder selection modal and moves files to the selected folder
     * Used by context menu and keyboard shortcuts for interactive file moving
     *
     * @param files - Files to move
     * @param selectionContext - Optional selection context for smart selection updates
     */
    async moveFilesWithModal(
        files: TFile[],
        selectionContext?: {
            selectedFile: TFile | null;
            dispatch: SelectionDispatch;
            allFiles: TFile[];
        }
    ): Promise<void> {
        if (files.length === 0) return;

        // Create a set of paths to exclude (source folders and their parents)
        const excludePaths = new Set<string>();

        // For single file moves, exclude the parent folder
        if (files.length === 1 && files[0].parent) {
            excludePaths.add(files[0].parent.path);
        }

        // Show the folder selection modal
        const modal = new FolderSuggestModal(
            this.app,
            async (targetFolder: TFolder) => {
                // Move the files to the selected folder
                const result = await this.moveFilesToFolder({
                    files,
                    targetFolder,
                    selectionContext,
                    showNotifications: true
                });

                // Show summary notification for multiple files
                if (files.length > 1 && result.movedCount > 0) {
                    new Notice(
                        strings.fileSystem.notifications.movedMultipleFiles
                            .replace('{count}', result.movedCount.toString())
                            .replace('{folder}', targetFolder.name)
                    );
                }
            },
            strings.modals.folderSuggest.placeholder,
            strings.modals.folderSuggest.instructions.move,
            excludePaths
        );

        modal.open();
    }

    /**
     * Shows a folder selection modal and moves the specified folder to the chosen destination
     * Excludes the folder itself and all descendants from the destination list to prevent recursion
     *
     * @param folder - Folder to move
     * @returns Move result describing the new location, or null if the operation was cancelled or produced no change
     */
    async moveFolderWithModal(folder: TFolder): Promise<MoveFolderResult | null> {
        const excludePaths = new Set<string>();

        const collectPaths = (current: TFolder) => {
            excludePaths.add(current.path);
            current.children.forEach(child => {
                if (child instanceof TFolder) {
                    collectPaths(child);
                }
            });
        };

        collectPaths(folder);

        return new Promise(resolve => {
            let isResolved = false;

            const finish = (result: MoveFolderResult | null) => {
                if (!isResolved) {
                    isResolved = true;
                    resolve(result);
                }
            };

            const modal = new FolderSuggestModal(
                this.app,
                async (targetFolder: TFolder) => {
                    // Prevent selecting the folder itself or any descendant
                    if (targetFolder.path === folder.path || targetFolder.path.startsWith(`${folder.path}/`)) {
                        new Notice(strings.dragDrop.errors.cannotMoveIntoSelf);
                        return;
                    }

                    const destinationBase = targetFolder.path === '/' ? '' : `${targetFolder.path}/`;
                    const newPath = normalizePath(`${destinationBase}${folder.name}`);

                    // No-op if destination equals current location
                    if (newPath === folder.path) {
                        modal.close();
                        finish(null);
                        return;
                    }

                    const existingEntry = this.app.vault.getAbstractFileByPath(newPath);
                    if (existingEntry) {
                        new Notice(strings.fileSystem.errors.folderAlreadyExists.replace('{name}', folder.name));
                        return;
                    }

                    try {
                        const oldPath = folder.path;
                        await this.app.fileManager.renameFile(folder, newPath);

                        const movedEntry = this.app.vault.getAbstractFileByPath(newPath);
                        if (!movedEntry || !(movedEntry instanceof TFolder)) {
                            new Notice(strings.dragDrop.errors.failedToMoveFolder.replace('{name}', folder.name));
                            modal.close();
                            finish(null);
                            return;
                        }

                        new Notice(strings.fileSystem.notifications.folderMoved.replace('{name}', movedEntry.name));
                        modal.close();
                        finish({
                            oldPath,
                            newPath,
                            targetFolder
                        });
                    } catch (error) {
                        console.error('Failed to move folder via modal:', error);
                        new Notice(strings.dragDrop.errors.failedToMoveFolder.replace('{name}', folder.name));
                    }
                },
                strings.modals.folderSuggest.placeholder,
                strings.modals.folderSuggest.instructions.move,
                excludePaths
            );

            const originalOnClose = modal.onClose.bind(modal);
            modal.onClose = () => {
                originalOnClose();
                finish(null);
            };

            modal.open();
        });
    }

    /**
     * Converts a single file into a folder note by creating a sibling folder and moving the file inside
     * @param file - The file to convert
     * @param settings - Notebook Navigator settings for folder note configuration
     */
    async convertFileToFolderNote(file: TFile, settings: NotebookNavigatorSettings): Promise<void> {
        // Validate folder notes are enabled
        if (!settings.enableFolderNotes) {
            new Notice(strings.fileSystem.errors.folderNotesDisabled);
            return;
        }

        // Validate file has a parent folder
        const parent = file.parent;
        if (!parent || !(parent instanceof TFolder)) {
            new Notice(strings.fileSystem.errors.folderNoteConversionFailed);
            return;
        }

        const detectionSettings = {
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName
        };

        // Check if file is already acting as a folder note
        if (isFolderNote(file, parent, detectionSettings)) {
            new Notice(strings.fileSystem.errors.folderNoteAlreadyLinked);
            return;
        }

        // Validate file extension is supported for folder notes
        if (!isSupportedFolderNoteExtension(file.extension)) {
            new Notice(strings.fileSystem.errors.folderNoteUnsupportedExtension.replace('{extension}', file.extension));
            return;
        }

        // Build target folder path using the file's basename
        const parentPath = parent.path === '/' ? '' : `${parent.path}/`;
        const folderName = file.basename;
        const targetFolderPath = normalizePath(`${parentPath}${folderName}`);

        // Check if folder already exists to avoid conflicts
        if (this.app.vault.getAbstractFileByPath(targetFolderPath)) {
            new Notice(strings.fileSystem.errors.folderAlreadyExists.replace('{name}', folderName));
            return;
        }

        // Determine final filename based on folder note settings
        const finalBaseName = settings.folderNoteName ? settings.folderNoteName : folderName;

        // Create the target folder
        try {
            await this.app.vault.createFolder(targetFolderPath);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            new Notice(strings.fileSystem.errors.createFolder.replace('{error}', message));
            return;
        }

        // Verify folder was created successfully
        const targetFolder = this.app.vault.getAbstractFileByPath(targetFolderPath);
        if (!targetFolder || !(targetFolder instanceof TFolder)) {
            new Notice(strings.fileSystem.errors.folderNoteConversionFailed);
            return;
        }

        try {
            // Move file into the newly created folder
            const moveResult = await this.moveFilesToFolder({
                files: [file],
                targetFolder,
                showNotifications: false
            });

            // Handle move failure by cleaning up empty folder
            if (moveResult.movedCount === 0) {
                await this.removeFolderIfEmpty(targetFolder);
                const firstError = moveResult.errors[0]?.error;
                const message =
                    firstError instanceof Error
                        ? firstError.message
                        : typeof firstError === 'string'
                          ? firstError
                          : strings.common.unknownError;
                new Notice(strings.fileSystem.errors.folderNoteMoveFailed.replace('{error}', message));
                return;
            }

            // Get reference to the moved file
            const movedFilePath = normalizePath(`${targetFolder.path}/${file.name}`);
            const movedFileEntry = this.app.vault.getAbstractFileByPath(movedFilePath);
            if (!movedFileEntry || !(movedFileEntry instanceof TFile)) {
                new Notice(strings.fileSystem.errors.folderNoteConversionFailed);
                return;
            }
            let movedFile: TFile = movedFileEntry;

            // Rename file if folder note name setting requires it
            const finalFileName = `${finalBaseName}.${file.extension}`;
            const finalPath = normalizePath(`${targetFolder.path}/${finalFileName}`);

            if (movedFile.path !== finalPath) {
                if (this.app.vault.getAbstractFileByPath(finalPath)) {
                    new Notice(strings.fileSystem.errors.folderNoteRenameConflict.replace('{name}', finalFileName));
                } else {
                    await this.app.fileManager.renameFile(movedFile, finalPath);
                    const updatedFile = this.app.vault.getAbstractFileByPath(finalPath);
                    if (updatedFile instanceof TFile) {
                        movedFile = updatedFile;
                    }
                }
            }

            // Attempt to open the folder note using command queue for proper context tracking
            const commandQueue = this.getCommandQueue();
            let opened = false;

            if (commandQueue) {
                const openResult = await commandQueue.executeOpenFolderNote(targetFolder.path, async () => {
                    await this.app.workspace.getLeaf().openFile(movedFile);
                });

                if (openResult.success) {
                    opened = true;
                } else {
                    console.error('Failed to open folder note via command queue', openResult.error);
                }
            }

            // Fallback to direct file opening if command queue unavailable or failed
            if (!opened) {
                try {
                    await this.app.workspace.getLeaf().openFile(movedFile);
                    opened = true;
                } catch (openError) {
                    console.error('Failed to open folder note after conversion', openError);
                    const message = openError instanceof Error ? openError.message : String(openError);
                    new Notice(strings.fileSystem.errors.folderNoteOpenFailed.replace('{error}', message));
                }
            }

            // Show success notification only if file was successfully opened
            if (opened) {
                new Notice(strings.fileSystem.notifications.folderNoteConversionSuccess.replace('{name}', targetFolder.name));
            }
        } catch (error) {
            // Clean up folder on any error and show error message
            await this.removeFolderIfEmpty(targetFolder);
            const message = error instanceof Error ? error.message : String(error);
            new Notice(strings.fileSystem.errors.folderNoteConversionFailedWithReason.replace('{error}', message));
        }
    }

    /**
     * Removes a folder if it's empty
     * Used for cleanup after failed folder note conversion
     * @param folder - The folder to remove if empty
     */
    private async removeFolderIfEmpty(folder: TFolder): Promise<void> {
        if (folder.children.length > 0) {
            return;
        }

        try {
            await this.app.fileManager.trashFile(folder);
        } catch (error) {
            console.error('Failed to remove folder after conversion failure', error);
        }
    }

    /**
     * Duplicates a file with an incremented name
     * @param file - The file to duplicate
     */
    async duplicateNote(file: TFile): Promise<void> {
        try {
            const baseName = file.basename;
            const extension = file.extension;
            let counter = 1;
            let newName = `${baseName} ${counter}`;
            const parentPath = file.parent?.path ?? '/';
            const base = parentPath === '/' ? '' : `${parentPath}/`;
            let newPath = normalizePath(`${base}${newName}.${extension}`);

            while (this.app.vault.getFileByPath(newPath)) {
                counter++;
                newName = `${baseName} ${counter}`;
                newPath = normalizePath(`${base}${newName}.${extension}`);
            }

            const newFile = await this.app.vault.copy(file, newPath);

            if (newFile instanceof TFile) {
                this.app.workspace.getLeaf(false).openFile(newFile);
            }
        } catch (error) {
            new Notice(strings.fileSystem.errors.duplicateNote.replace('{error}', error.message));
        }
    }

    /**
     * Creates a new canvas file in the specified folder
     * @param parent - The parent folder
     */
    async createCanvas(parent: TFolder): Promise<TFile | null> {
        return createFileWithOptions(parent, this.app, {
            extension: 'canvas',
            content: '{}',
            errorKey: 'createCanvas'
        });
    }

    /**
     * Creates a new database view file in the specified folder
     * @param parent - The parent folder
     */
    async createBase(parent: TFolder): Promise<TFile | null> {
        return createFileWithOptions(parent, this.app, {
            extension: 'base',
            content: createDatabaseContent(),
            errorKey: 'createDatabase'
        });
    }

    /**
     * Duplicates a folder and all its contents
     * @param folder - The folder to duplicate
     */
    async duplicateFolder(folder: TFolder): Promise<void> {
        try {
            const baseName = folder.name;
            let counter = 1;
            let newName = `${baseName} ${counter}`;
            const parentPath = folder.parent?.path ?? '/';
            const base = parentPath === '/' ? '' : `${parentPath}/`;
            let newPath = normalizePath(`${base}${newName}`);

            while (this.app.vault.getFolderByPath(newPath)) {
                counter++;
                newName = `${baseName} ${counter}`;
                newPath = normalizePath(`${base}${newName}`);
            }

            await this.app.vault.copy(folder, newPath);
        } catch (error) {
            new Notice(strings.fileSystem.errors.duplicateFolder.replace('{error}', error.message));
        }
    }

    /**
     * Deletes multiple files with confirmation
     * @param files - Array of files to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback to run after successful deletion
     * @param preDeleteAction - Optional action to run BEFORE files are deleted
     */
    async deleteMultipleFiles(
        files: TFile[],
        confirmBeforeDelete = true,
        onSuccess?: () => void,
        preDeleteAction?: () => void | Promise<void>
    ): Promise<void> {
        if (files.length === 0) return;

        const performDeleteCore = async () => {
            // Run optional pre-delete action (e.g., to update selection)
            if (preDeleteAction) {
                try {
                    await preDeleteAction();
                } catch (e) {
                    // Continue with delete even if pre-delete action throws
                    console.error('Pre-delete action failed:', e);
                }
            }

            // Delete all files in parallel for instant removal
            const errors: { file: TFile; error: unknown }[] = [];
            let deletedCount = 0;

            const results = await Promise.allSettled(files.map(file => this.app.fileManager.trashFile(file)));

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    deletedCount++;
                } else {
                    const file = files[index];
                    errors.push({ file, error: result.reason });
                    console.error('Error deleting file:', file.path, result.reason);
                }
            });

            // Show appropriate notifications
            if (deletedCount > 0) {
                new Notice(strings.fileSystem.notifications.deletedMultipleFiles.replace('{count}', deletedCount.toString()));
            }

            if (errors.length > 0) {
                const errorMsg =
                    errors.length === 1
                        ? strings.fileSystem.errors.failedToDeleteFile
                              .replace('{name}', errors[0].file.name)
                              .replace('{error}', String(errors[0].error))
                        : strings.fileSystem.errors.failedToDeleteMultipleFiles.replace('{count}', errors.length.toString());
                new Notice(errorMsg);
            }

            if (onSuccess && deletedCount > 0) {
                onSuccess();
            }
        };

        if (confirmBeforeDelete) {
            // Import dynamically to avoid circular dependencies
            const { ConfirmModal } = await import('../modals/ConfirmModal');

            const modal = new ConfirmModal(
                this.app,
                strings.fileSystem.confirmations.deleteMultipleFiles.replace('{count}', files.length.toString()),
                strings.fileSystem.confirmations.deleteConfirmation,
                async () => {
                    const commandQueue = this.getCommandQueue();
                    if (commandQueue) {
                        await commandQueue.executeDeleteFiles(files, performDeleteCore);
                    } else {
                        await performDeleteCore();
                    }
                }
            );
            modal.open();
        } else {
            const commandQueue = this.getCommandQueue();
            if (commandQueue) {
                await commandQueue.executeDeleteFiles(files, performDeleteCore);
            } else {
                await performDeleteCore();
            }
        }
    }

    /**
     * Deletes selected files with smart selection of next file
     * Centralizes the delete logic used by both keyboard shortcuts and context menu
     * @param selectedFiles - Set of selected file paths
     * @param allFiles - All files in the current view (for finding next file)
     * @param selectionDispatch - Selection dispatch function
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     */
    async deleteFilesWithSmartSelection(
        selectedFiles: Set<string>,
        allFiles: TFile[],
        selectionDispatch: SelectionDispatch,
        confirmBeforeDelete: boolean
    ): Promise<void> {
        // Convert selected paths to files
        const filesToDelete = Array.from(selectedFiles)
            .map(path => this.app.vault.getFileByPath(path))
            .filter((f): f is TFile => f !== null);

        if (filesToDelete.length === 0) return;

        // Find next file to select using utility
        const nextFileToSelect = findNextFileAfterRemoval(allFiles, selectedFiles);

        // Delete the files with a pre-delete action that updates selection only after confirmation
        await this.deleteMultipleFiles(
            filesToDelete,
            confirmBeforeDelete,
            async () => {
                // No additional selection changes here. Selection handled in beforeDelete.
            },
            async () => {
                if (nextFileToSelect) {
                    // Verify the next file still exists (matching single file deletion)
                    const stillExists = this.app.vault.getFileByPath(nextFileToSelect.path);
                    if (stillExists) {
                        // Update selection using same params as single file deletion
                        await updateSelectionAfterFileOperation(nextFileToSelect, selectionDispatch, this.app);
                    } else {
                        // Next file was deleted, clear selection
                        await updateSelectionAfterFileOperation(null, selectionDispatch, this.app);
                    }
                } else {
                    // No files left in folder - clear selection
                    selectionDispatch({ type: 'CLEAR_FILE_SELECTION' });
                }

                // Focus management (matching single file deletion)
                window.setTimeout(() => {
                    const fileListEl = document.querySelector('.nn-list-pane-scroller');
                    if (fileListEl instanceof HTMLElement) {
                        fileListEl.focus();
                    }
                }, TIMEOUTS.FILE_OPERATION_DELAY);
            }
        );
    }

    /**
     * Opens version history for a file using Obsidian Sync.
     *
     * The version history modal requires the editor to have focus when the command executes.
     * The Notebook Navigator's aggressive focus management can interfere with this.
     *
     * Solution:
     * 1. Track the operation to prevent the navigator from stealing focus
     * 2. Always use openLinkText to open/re-open the file (ensures proper editor focus)
     * 3. Wait briefly for the editor to be ready
     * 4. Execute the version history command
     *
     * @param file - The file to view version history for
     */
    async openVersionHistory(file: TFile): Promise<void> {
        const commandQueue = this.getCommandQueue();
        if (!commandQueue) {
            new Notice(strings.fileSystem.errors.versionHistoryNotAvailable);
            return;
        }

        const result = await commandQueue.executeOpenVersionHistory(file, async () => {
            // Always open/re-open the file to ensure proper focus
            await this.app.workspace.openLinkText(file.path, '', false);

            // Small delay to ensure the editor is ready
            await new Promise(resolve => window.setTimeout(resolve, TIMEOUTS.FILE_OPERATION_DELAY));

            // Execute the version history command
            if (!executeCommand(this.app, OBSIDIAN_COMMANDS.VERSION_HISTORY)) {
                new Notice(strings.fileSystem.errors.versionHistoryNotFound);
            }
        });

        if (!result.success && result.error) {
            new Notice(strings.fileSystem.errors.openVersionHistory.replace('{error}', result.error.message));
        }
    }

    /**
     * Gets the platform-specific text for the "Reveal in system explorer" menu option
     * @returns The appropriate text based on the current platform
     */
    getRevealInSystemExplorerText(): string {
        if (Platform.isMacOS) {
            return strings.contextMenu.file.revealInFinder;
        }
        return strings.contextMenu.file.showInExplorer;
    }

    /**
     * Reveals a file or folder in the system's file explorer
     * @param file - The file or folder to reveal
     */
    async revealInSystemExplorer(file: TFile | TFolder): Promise<void> {
        try {
            // Use Obsidian's built-in method to reveal the file or folder
            // Note: showInFolder is not in Obsidian's public TypeScript API, but is widely used by plugins
            // showInFolder expects the vault-relative path, not the full system path
            const extendedApp = this.app as ExtendedApp;
            await extendedApp.showInFolder(file.path);
        } catch (error) {
            new Notice(strings.fileSystem.errors.revealInExplorer.replace('{error}', error.message));
        }
    }

    /**
     * Creates a new Excalidraw drawing in the specified folder
     * Only available when Excalidraw plugin is installed
     * @param parent - The parent folder to create the drawing in
     * @returns The created file or null if creation failed
     */
    async createNewDrawing(parent: TFolder): Promise<TFile | null> {
        try {
            // Generate unique filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `Drawing ${timestamp}.excalidraw.md`;
            const base = parent.path === '/' ? '' : `${parent.path}/`;
            const filePath = normalizePath(`${base}${fileName}`);

            // Minimal Excalidraw file content
            const content = `---

excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==


# Text Elements
# Embedded files
# Drawing
\`\`\`json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.0.0",
  "elements": [],
  "appState": {
    "gridSize": null,
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
\`\`\`
%%`;

            // Create the file
            const file = await this.app.vault.create(filePath, content);

            // Open the file
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);

            // The Excalidraw plugin should automatically recognize and open it in drawing mode
            return file;
        } catch (error) {
            if (error.message?.includes('already exists')) {
                new Notice(strings.fileSystem.errors.drawingAlreadyExists);
            } else {
                new Notice(strings.fileSystem.errors.failedToCreateDrawing);
            }
            return null;
        }
    }
}
