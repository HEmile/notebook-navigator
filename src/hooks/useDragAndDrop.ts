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

// src/hooks/useDragAndDrop.ts
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TFile, TFolder, Notice, normalizePath } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useTagOperations } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { strings } from '../i18n';
import { ItemType, UNTAGGED_TAG_ID } from '../types';
import { SHORTCUT_DRAG_MIME } from '../types/shortcuts';
import { DragManagerPayload, hasDragManager, TIMEOUTS } from '../types/obsidian-extended';
import { getPathFromDataAttribute } from '../utils/domUtils';
import { getFilesForFolder, getFilesForTag, getFilesForTopic } from '../utils/fileFinder';
import { generateUniqueFilename } from '../utils/fileCreationUtils';
import { createDragGhostManager } from '../utils/dragGhost';

/**
 * Enables drag and drop for files and folders using event delegation.
 * Adds visual feedback, validates drops, and performs file operations.
 *
 * Usage: call with a container element that contains items with
 * data attributes: `data-draggable`, `data-drag-type`, `data-drag-path`,
 * and drop zones with `data-drop-zone`, `data-drop-path`.
 */
export const DRAG_AUTO_EXPAND_DELAY = 500;
type DragItemType = (typeof ItemType)[keyof typeof ItemType];

type AutoExpandTarget = { type: 'folder' | 'tag'; path: string };

interface AutoExpandConfig {
    type: AutoExpandTarget['type'];
    path: string;
    isAlreadyExpanded: () => boolean;
    resolveNode: () => { isValid: boolean; hasChildren: boolean };
    expand: () => void;
}

export function useDragAndDrop(containerRef: React.RefObject<HTMLElement | null>) {
    const { app, isMobile, tagTreeService, topicService } = useServices();
    const fileSystemOps = useFileSystemOps();
    const tagOperations = useTagOperations();
    const selectionState = useSelectionState();
    const dispatch = useSelectionDispatch();
    const settings = useSettingsState();
    const expansionState = useExpansionState();
    const expansionDispatch = useExpansionDispatch();
    const dragOverElement = useRef<HTMLElement | null>(null);
    const autoExpandTimeoutRef = useRef<number | null>(null);
    const autoExpandTargetRef = useRef<AutoExpandTarget | null>(null);
    const expandedFoldersRef = useRef(expansionState.expandedFolders);
    const expandedTagsRef = useRef(expansionState.expandedTags);
    const dragTypeRef = useRef<DragItemType | null>(null);
    const dragGhostManager = useMemo(() => createDragGhostManager(app), [app]);

    /**
     * Sets or clears the drag payload in Obsidian's internal drag manager.
     * This allows other plugins (like Excalidraw) to access drag metadata.
     *
     * @param payload - Drag metadata to set, or null to clear
     */
    const setDragManagerPayload = useCallback(
        (payload: DragManagerPayload | null) => {
            if (!hasDragManager(app)) {
                return;
            }

            try {
                if (!payload) {
                    app.dragManager.draggable = null;
                    return;
                }

                const existingPayload = app.dragManager.draggable;
                const mergedPayload: DragManagerPayload = existingPayload ? { ...existingPayload, ...payload } : { ...payload };
                app.dragManager.draggable = mergedPayload;
            } catch (error) {
                console.error('[Notebook Navigator] Failed to set drag payload', error);
            }
        },
        [app]
    );

    /**
     * Type guard to check if an element is an HTMLElement
     */
    const isHTMLElement = (element: EventTarget | null): element is HTMLElement => {
        return element instanceof HTMLElement;
    };

    /**
     * Helper function to get current file list based on selection
     */
    const getCurrentFileList = useCallback((): TFile[] => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            return getFilesForFolder(selectionState.selectedFolder, settings, app);
        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return getFilesForTag(selectionState.selectedTag, settings, app, tagTreeService);
        } else if (selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopicPath) {
            return getFilesForTopic(selectionState.selectedTopicPath, settings, app, topicService);
        }
        return [];
    }, [selectionState, settings, app, tagTreeService]);

    /**
     * Converts an array of file paths to TFile objects
     */
    const getFilesFromPaths = useCallback(
        (paths: string[]): TFile[] => {
            const files: TFile[] = [];
            for (const path of paths) {
                const file = app.vault.getFileByPath(path);
                if (file) {
                    files.push(file);
                }
            }
            return files;
        },
        [app]
    );

    /**
     * Moves files to a folder with selection context
     */
    const moveFilesWithContext = useCallback(
        async (files: TFile[], targetFolder: TFolder) => {
            const currentFiles = getCurrentFileList();
            await fileSystemOps.moveFilesToFolder({
                files,
                targetFolder,
                selectionContext: {
                    selectedFile: selectionState.selectedFile,
                    dispatch,
                    allFiles: currentFiles
                },
                showNotifications: true
            });
        },
        [fileSystemOps, getCurrentFileList, selectionState.selectedFile, dispatch]
    );

    /**
     * Handles the drag start event.
     * Extracts drag data from data attributes and sets drag effect.
     * Also generates markdown links for dragging into editor panes.
     *
     * @param e - The drag event
     */
    const handleDragStart = useCallback(
        (e: DragEvent) => {
            if (!isHTMLElement(e.target)) {
                return;
            }

            const draggable = e.target.closest('[data-draggable="true"]');
            if (!draggable || !(draggable instanceof HTMLElement)) {
                return;
            }

            const path = getPathFromDataAttribute(draggable, 'data-drag-path');
            const type = draggable.getAttribute('data-drag-type');
            const iconIdAttr = draggable.getAttribute('data-drag-icon');
            const iconColorAttr = draggable.getAttribute('data-drag-icon-color');
            const iconId = iconIdAttr && iconIdAttr.trim().length > 0 ? iconIdAttr : undefined;
            const iconColor = iconColorAttr && iconColorAttr.trim().length > 0 ? iconColorAttr : undefined;
            if (!path || !e.dataTransfer) {
                return;
            }

            // Clear any existing drag payload before setting new one
            setDragManagerPayload(null);

            // Handle multiple file selection drag
            if (type === ItemType.FILE && selectionState.selectedFiles.has(path) && selectionState.selectedFiles.size > 1) {
                const selectedPaths = Array.from(selectionState.selectedFiles);
                e.dataTransfer.setData('obsidian/files', JSON.stringify(selectedPaths));
                e.dataTransfer.effectAllowed = 'all';
                dragTypeRef.current = ItemType.FILE;

                // Set drag manager payload for other plugins to access
                const draggedFiles = getFilesFromPaths(selectedPaths);
                if (draggedFiles.length > 0) {
                    setDragManagerPayload({
                        type: 'files',
                        files: draggedFiles,
                        title: `${draggedFiles.length} files`
                    });
                }

                const markdownLinks: string[] = [];
                selectedPaths.forEach(selectedPath => {
                    const file = app.vault.getFileByPath(selectedPath);
                    if (file) {
                        const src = app.workspace.getActiveFile()?.path ?? '';
                        const link = app.fileManager.generateMarkdownLink(file, src);
                        markdownLinks.push(link);
                    }
                });

                if (markdownLinks.length > 0) {
                    e.dataTransfer.setData('text/plain', markdownLinks.join('\n'));
                }

                selectedPaths.forEach(selectedPath => {
                    const el = containerRef.current?.querySelector(`[data-drag-path="${selectedPath}"]`);
                    el?.classList.add('nn-dragging');
                });

                dragGhostManager.hideNativePreview(e);
                dragGhostManager.showGhost(e, {
                    itemType: ItemType.FILE,
                    path,
                    itemCount: selectedPaths.length,
                    icon: iconId,
                    iconColor
                });
                return;
            }

            e.dataTransfer.setData('obsidian/file', path);
            if (type === ItemType.FILE || type === ItemType.FOLDER || type === ItemType.TAG) {
                dragTypeRef.current = type;
            } else {
                dragTypeRef.current = ItemType.FILE;
            }
            e.dataTransfer.effectAllowed = 'all';

            // Generate markdown link for single file drag and set drag manager payload
            if (type === ItemType.FILE) {
                const file = app.vault.getFileByPath(path);
                if (file) {
                    const src = app.workspace.getActiveFile()?.path ?? '';
                    const link = app.fileManager.generateMarkdownLink(file, src);
                    e.dataTransfer.setData('text/plain', link);
                    // Set drag manager payload for other plugins to access
                    setDragManagerPayload({
                        type: 'file',
                        file,
                        title: file.basename
                    });
                }
            }

            draggable.classList.add('nn-dragging');
            const resolvedType = type === ItemType.FILE || type === ItemType.FOLDER || type === ItemType.TAG ? (type as ItemType) : null;
            dragGhostManager.hideNativePreview(e);
            dragGhostManager.showGhost(e, {
                itemType: resolvedType,
                path,
                icon: iconId,
                iconColor
            });
        },
        [selectionState, containerRef, app, dragGhostManager, getFilesFromPaths, setDragManagerPayload]
    );

    useEffect(() => {
        expandedFoldersRef.current = expansionState.expandedFolders;
    }, [expansionState.expandedFolders]);

    useEffect(() => {
        expandedTagsRef.current = expansionState.expandedTags;
    }, [expansionState.expandedTags]);

    const clearAutoExpandTimer = useCallback(() => {
        if (autoExpandTimeoutRef.current !== null) {
            window.clearTimeout(autoExpandTimeoutRef.current);
            autoExpandTimeoutRef.current = null;
        }
        autoExpandTargetRef.current = null;
    }, []);

    const scheduleAutoExpand = useCallback(
        (config: AutoExpandConfig) => {
            if (autoExpandTargetRef.current?.type === config.type && autoExpandTargetRef.current.path === config.path) {
                return;
            }

            clearAutoExpandTimer();

            if (config.isAlreadyExpanded()) {
                return;
            }

            const initial = config.resolveNode();
            if (!initial.isValid || !initial.hasChildren) {
                return;
            }

            autoExpandTargetRef.current = { type: config.type, path: config.path };
            autoExpandTimeoutRef.current = window.setTimeout(() => {
                const latest = config.resolveNode();
                if (!latest.isValid) {
                    clearAutoExpandTimer();
                    return;
                }

                if (latest.hasChildren && !config.isAlreadyExpanded()) {
                    config.expand();
                }

                clearAutoExpandTimer();
            }, DRAG_AUTO_EXPAND_DELAY);
        },
        [clearAutoExpandTimer]
    );

    const scheduleFolderAutoExpand = useCallback(
        (targetPath: string) => {
            scheduleAutoExpand({
                type: 'folder',
                path: targetPath,
                isAlreadyExpanded: () => expandedFoldersRef.current.has(targetPath),
                resolveNode: () => {
                    const folder = app.vault.getFolderByPath(targetPath);
                    if (!folder) {
                        return { isValid: false, hasChildren: false };
                    }
                    return {
                        isValid: true,
                        hasChildren: folder.children.some(child => child instanceof TFolder)
                    };
                },
                expand: () => expansionDispatch({ type: 'EXPAND_FOLDERS', folderPaths: [targetPath] })
            });
        },
        [app, expansionDispatch, scheduleAutoExpand]
    );

    const scheduleTagAutoExpand = useCallback(
        (targetPath: string) => {
            if (!tagTreeService) {
                return;
            }

            scheduleAutoExpand({
                type: 'tag',
                path: targetPath,
                isAlreadyExpanded: () => expandedTagsRef.current.has(targetPath),
                resolveNode: () => {
                    if (!tagTreeService) {
                        return { isValid: false, hasChildren: false };
                    }
                    const node = tagTreeService.findTagNode(targetPath);
                    if (!node) {
                        return { isValid: false, hasChildren: false };
                    }
                    return { isValid: true, hasChildren: node.children.size > 0 };
                },
                expand: () => expansionDispatch({ type: 'EXPAND_TAGS', tagPaths: [targetPath] })
            });
        },
        [tagTreeService, expansionDispatch, scheduleAutoExpand]
    );

    /**
     * Handles the drag over event.
     * Provides visual feedback by adding CSS classes to valid drop targets.
     *
     * @param e - The drag event
     */
    const handleDragOver = useCallback(
        (e: DragEvent) => {
            if (!isHTMLElement(e.target)) return;
            const dropZone = e.target.closest<HTMLElement>('[data-drop-zone="folder"],[data-drop-zone="tag"]');
            const isShortcutDrag = Boolean(e.dataTransfer?.types?.includes(SHORTCUT_DRAG_MIME));

            if (dragOverElement.current && dragOverElement.current !== dropZone) {
                dragOverElement.current.classList.remove('nn-drag-over');
                dragOverElement.current = null;
                clearAutoExpandTimer();
            }

            if (!dropZone) {
                if (isShortcutDrag && e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'none';
                }
                clearAutoExpandTimer();
                return;
            }

            if (isShortcutDrag) {
                dropZone.classList.remove('nn-drag-over');
                dragOverElement.current = null;
                clearAutoExpandTimer();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'none';
                }
                return;
            }

            e.preventDefault();

            if (e.dataTransfer) {
                const dropType = dropZone.getAttribute('data-drop-zone');
                const targetPath = dropZone.getAttribute('data-drop-path');

                const typesList = e.dataTransfer.types;
                const hasObsidianData = !!typesList?.includes('obsidian/file') || !!typesList?.includes('obsidian/files');
                const isExternal = !!typesList?.includes('Files') && !hasObsidianData;

                // Folder: move (internal) / copy (external); Tag: untagged = move, tag = copy
                if (dropType === 'folder') {
                    e.dataTransfer.dropEffect = isExternal ? 'copy' : 'move';
                    if (targetPath) {
                        scheduleFolderAutoExpand(targetPath);
                    }
                } else if (dropType === 'tag') {
                    if (dragTypeRef.current === ItemType.FOLDER) {
                        if (dragOverElement.current === dropZone) {
                            dropZone.classList.remove('nn-drag-over');
                        }
                        dragOverElement.current = null;
                        clearAutoExpandTimer();
                        e.dataTransfer.dropEffect = 'none';
                        return;
                    }
                    e.dataTransfer.dropEffect = targetPath === UNTAGGED_TAG_ID ? 'move' : 'copy';
                    if (targetPath !== UNTAGGED_TAG_ID) {
                        const canonicalTagPath = dropZone.getAttribute('data-tag');
                        if (canonicalTagPath) {
                            scheduleTagAutoExpand(canonicalTagPath);
                        } else {
                            clearAutoExpandTimer();
                        }
                    } else {
                        clearAutoExpandTimer();
                    }
                }
            }

            dropZone.classList.add('nn-drag-over');
            dragOverElement.current = dropZone;
        },
        [clearAutoExpandTimer, scheduleFolderAutoExpand, scheduleTagAutoExpand]
    );

    /**
     * Handles dropping files on a tag to add that tag to the files
     *
     * @param e - The drag event
     * @param targetTag - The tag to add (or UNTAGGED_TAG_ID to clear all tags)
     */
    const handleTagDrop = useCallback(
        async (e: DragEvent, targetTag: string) => {
            let files: TFile[] = [];

            // Check if dragging multiple files (never folders)
            const multipleFilesData = e.dataTransfer?.getData('obsidian/files');
            if (multipleFilesData) {
                try {
                    const selectedPaths = JSON.parse(multipleFilesData);
                    if (Array.isArray(selectedPaths)) {
                        files = getFilesFromPaths(selectedPaths);
                    }
                } catch (error) {
                    console.error('Error parsing multiple files data:', error);
                    return;
                }
            } else {
                // Check if dragging single item (could be file or folder)
                const singleFileData = e.dataTransfer?.getData('obsidian/file');
                if (singleFileData) {
                    const item = app.vault.getAbstractFileByPath(singleFileData);
                    if (item instanceof TFolder) {
                        return;
                    }
                    if (item instanceof TFile) {
                        files = [item];
                    }
                }
            }

            if (files.length === 0) return;

            // Verify all files are markdown (tags only work with markdown)
            if (files.some(file => file.extension !== 'md')) {
                new Notice(strings.fileSystem.notifications.tagsRequireMarkdown);
                return;
            }

            // Handle special "untagged" drop zone - clear all tags
            if (targetTag === UNTAGGED_TAG_ID) {
                try {
                    const clearedCount = await tagOperations.clearAllTagsFromFiles(files);
                    if (clearedCount > 0) {
                        const message =
                            clearedCount === 1
                                ? strings.fileSystem.notifications.tagsClearedFromNote
                                : strings.fileSystem.notifications.tagsClearedFromNotes.replace('{count}', clearedCount.toString());
                        new Notice(message);
                    } else {
                        new Notice(strings.dragDrop.notifications.noTagsToClear);
                    }
                } catch (error) {
                    console.error('Error clearing tags:', error);
                    new Notice(strings.dragDrop.errors.failedToClearTags);
                }
            } else {
                // Add tag to files
                try {
                    const { added, skipped } = await tagOperations.addTagToFiles(targetTag, files);

                    if (added > 0) {
                        const message =
                            added === 1
                                ? strings.fileSystem.notifications.tagAddedToNote
                                : strings.fileSystem.notifications.tagAddedToNotes.replace('{count}', added.toString());
                        new Notice(message);
                    }
                    if (skipped > 0) {
                        new Notice(
                            strings.dragDrop.notifications.filesAlreadyHaveTag.replace('{count}', skipped.toString()),
                            TIMEOUTS.NOTICE_ERROR
                        );
                    }
                } catch (error) {
                    console.error('Error adding tag:', error);
                    new Notice(strings.dragDrop.errors.failedToAddTag.replace('{tag}', targetTag));
                }
            }
        },
        [app, tagOperations, getFilesFromPaths]
    );

    /**
     * Handles importing external files dropped from OS file manager
     * @param files - FileList from drag event
     * @param targetFolder - Target folder to import files into
     */
    const handleExternalFileDrop = useCallback(
        async (files: FileList, targetFolder: TFolder) => {
            const importedCount = { success: 0, failed: 0 };
            const errors: string[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    // Extract base name and extension
                    const lastDotIndex = file.name.lastIndexOf('.');
                    let baseName: string;
                    let extension: string;

                    if (lastDotIndex === -1 || lastDotIndex === 0) {
                        // No extension or hidden file starting with dot
                        baseName = file.name;
                        extension = '';
                    } else {
                        baseName = file.name.substring(0, lastDotIndex);
                        extension = file.name.substring(lastDotIndex + 1);
                    }

                    // Generate unique filename if needed
                    const uniqueBaseName = generateUniqueFilename(targetFolder.path, baseName, extension, app);
                    const base = targetFolder.path === '/' ? '' : `${targetFolder.path}/`;
                    const finalPath = extension
                        ? normalizePath(`${base}${uniqueBaseName}.${extension}`)
                        : normalizePath(`${base}${uniqueBaseName}`);

                    // Decide text vs binary import
                    const lowerName = file.name.toLowerCase();
                    const mime = file.type || '';
                    const isLikelyText =
                        extension.toLowerCase() === 'md' ||
                        mime.startsWith('text/') ||
                        mime === 'application/json' ||
                        mime === 'application/xml' ||
                        /\.(canvas|json|csv|txt|xml|html|css|js|ts)$/i.test(lowerName);

                    if (isLikelyText) {
                        const content = await file.text();
                        await app.vault.create(finalPath, content);
                    } else {
                        const arrayBuffer = await file.arrayBuffer();
                        await app.vault.createBinary(finalPath, arrayBuffer);
                    }

                    importedCount.success++;
                } catch (error) {
                    console.error(`Failed to import file ${file.name}:`, error);
                    errors.push(file.name);
                    importedCount.failed++;
                }
            }

            // Show notification
            if (importedCount.success > 0) {
                const message =
                    importedCount.success === 1
                        ? strings.dragDrop.notifications.fileImported
                        : strings.dragDrop.notifications.filesImported.replace('{count}', importedCount.success.toString());
                new Notice(message);
            }

            if (importedCount.failed > 0) {
                const errorMessage = strings.dragDrop.errors.failedToImportFiles.replace('{names}', errors.join(', '));
                new Notice(errorMessage, TIMEOUTS.NOTICE_ERROR);
            }
        },
        [app]
    );

    /**
     * Handles the drop event.
     * Validates the drop and performs the appropriate operation based on drop zone type.
     * - For folders: moves files/folders or imports external files
     * - For tags: adds tag to files
     * - For untagged: clears all tags from files
     *
     * @param e - The drag event
     */
    const handleDrop = useCallback(
        async (e: DragEvent) => {
            try {
                let dropZone = dragOverElement.current;
                if (dropZone) {
                    dropZone.classList.remove('nn-drag-over');
                }
                dragOverElement.current = null;

                if (!dropZone && isHTMLElement(e.target)) {
                    const candidate = e.target.closest('[data-drop-zone]');
                    dropZone = candidate instanceof HTMLElement ? candidate : null;
                }

                const isShortcutDrag = Boolean(e.dataTransfer?.types?.includes(SHORTCUT_DRAG_MIME));
                if (isShortcutDrag) {
                    clearAutoExpandTimer();
                    return;
                }

                if (!dropZone) {
                    clearAutoExpandTimer();
                    return;
                }

                e.preventDefault();

                const dropType = dropZone.getAttribute('data-drop-zone');
                const targetPath = getPathFromDataAttribute(dropZone, 'data-drop-path');
                if (!dropType || !targetPath) {
                    return;
                }

                clearAutoExpandTimer();

                if (dropType === 'tag') {
                    if (dragTypeRef.current === ItemType.FOLDER) {
                        return;
                    }

                    const typesList = e.dataTransfer?.types;
                    const hasObsidianData = !!typesList?.includes('obsidian/file') || !!typesList?.includes('obsidian/files');
                    const isExternal = !!typesList?.includes('Files') && !hasObsidianData;
                    if (isExternal) {
                        new Notice(strings.fileSystem.notifications.tagOperationsNotAvailable, TIMEOUTS.NOTICE_ERROR);
                        return;
                    }

                    await handleTagDrop(e, targetPath);
                    return;
                }

                const targetFolder = app.vault.getFolderByPath(targetPath);
                if (!targetFolder) {
                    return;
                }

                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                    const typesList = e.dataTransfer.types;
                    const hasObsidianData = !!typesList?.includes('obsidian/file') || !!typesList?.includes('obsidian/files');
                    if (!hasObsidianData) {
                        await handleExternalFileDrop(e.dataTransfer.files, targetFolder);
                        return;
                    }
                }

                const multipleFilesData = e.dataTransfer?.getData('obsidian/files');
                if (multipleFilesData) {
                    try {
                        const selectedPaths = JSON.parse(multipleFilesData);
                        if (Array.isArray(selectedPaths)) {
                            const filesToMove = getFilesFromPaths(selectedPaths);
                            if (filesToMove.length > 0) {
                                await moveFilesWithContext(filesToMove, targetFolder);
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing multiple files data:', error);
                        return;
                    }
                    return;
                }

                const singleItemData = e.dataTransfer?.getData('obsidian/file');
                if (!singleItemData) {
                    return;
                }

                const sourceItem = app.vault.getAbstractFileByPath(singleItemData);
                if (!sourceItem) {
                    return;
                }

                if (sourceItem instanceof TFile) {
                    await moveFilesWithContext([sourceItem], targetFolder);
                } else if (sourceItem instanceof TFolder) {
                    if (targetFolder.path === sourceItem.path || targetFolder.path.startsWith(`${sourceItem.path}/`)) {
                        new Notice(strings.dragDrop.errors.cannotMoveIntoSelf);
                        return;
                    }

                    if (sourceItem.parent?.path === targetFolder.path) {
                        return;
                    }

                    try {
                        const base = targetFolder.path === '/' ? '' : `${targetFolder.path}/`;
                        const newPath = normalizePath(`${base}${sourceItem.name}`);
                        await app.fileManager.renameFile(sourceItem, newPath);
                        new Notice(strings.fileSystem.notifications.folderMoved.replace('{name}', sourceItem.name));
                    } catch (error) {
                        console.error('Error moving folder:', error);
                        new Notice(strings.dragDrop.errors.failedToMoveFolder.replace('{name}', sourceItem.name));
                    }
                }
            } finally {
                // Clean up drag state and payload after drop completes
                setDragManagerPayload(null);
                dragTypeRef.current = null;
            }
        },
        [app, handleTagDrop, handleExternalFileDrop, moveFilesWithContext, getFilesFromPaths, clearAutoExpandTimer, setDragManagerPayload]
    );

    /**
     * Handles the drag leave event.
     * Removes drag-over styling when leaving a drop zone.
     *
     * @param e - The drag event
     */
    const handleDragLeave = useCallback(
        (e: DragEvent) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;

            const dropZone = target.closest('[data-drop-zone]');
            if (dropZone instanceof HTMLElement && dropZone === dragOverElement.current) {
                // Only remove if we're actually leaving the drop zone, not just moving to a child
                const relatedTarget = e.relatedTarget;
                if (!(relatedTarget instanceof Node) || !dropZone.contains(relatedTarget)) {
                    dropZone.classList.remove('nn-drag-over');
                    dragOverElement.current = null;
                    clearAutoExpandTimer();
                }
            }
        },
        [clearAutoExpandTimer]
    );

    /**
     * Handles the drag end event.
     * Cleans up drag-related CSS classes and removes the drag ghost.
     *
     * @param e - The drag event
     */
    const handleDragEnd = useCallback(
        (e: DragEvent) => {
            const target = e.target;
            if (!isHTMLElement(target)) return;
            const draggable = target.closest('[data-draggable="true"]');
            const path = getPathFromDataAttribute(draggable instanceof HTMLElement ? draggable : null, 'data-drag-path');

            // Remove dragging class from all selected files if dragging multiple
            if (path && selectionState.selectedFiles.has(path)) {
                selectionState.selectedFiles.forEach(selectedPath => {
                    const el = containerRef.current?.querySelector(`[data-drag-path="${selectedPath}"]`);
                    el?.classList.remove('nn-dragging');
                });
            } else {
                draggable?.classList.remove('nn-dragging');
            }

            if (dragOverElement.current) {
                dragOverElement.current.classList.remove('nn-drag-over');
                dragOverElement.current = null;
            }

            dragGhostManager.hideGhost();
            // Clean up drag state and payload when drag ends
            setDragManagerPayload(null);
            clearAutoExpandTimer();
            dragTypeRef.current = null;
        },
        [selectionState, containerRef, dragGhostManager, clearAutoExpandTimer, setDragManagerPayload]
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container || isMobile) return;

        // Global handler for escape key to clean up ghost on cancel
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dragGhostManager.hasGhost()) {
                dragGhostManager.hideGhost();
            }
        };

        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', handleDragEnd);
        document.addEventListener('keydown', handleEscape);

        return () => {
            container.removeEventListener('dragstart', handleDragStart);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('dragleave', handleDragLeave);
            container.removeEventListener('drop', handleDrop);
            container.removeEventListener('dragend', handleDragEnd);
            document.removeEventListener('keydown', handleEscape);

            // Clean up any lingering drag state on unmount
            dragGhostManager.hideGhost();
            setDragManagerPayload(null);
            clearAutoExpandTimer();
            dragTypeRef.current = null;
        };
    }, [
        containerRef,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDragEnd,
        isMobile,
        dragGhostManager,
        clearAutoExpandTimer,
        setDragManagerPayload
    ]);
}
