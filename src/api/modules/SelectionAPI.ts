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

import { TFolder, TFile } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import type { SelectionState, NavItem, NotebookNavigatorEventType, NotebookNavigatorEvents } from '../types';
import { STORAGE_KEYS } from '../../types';
import { localStorage } from '../../utils/localStorage';
import {
    canRestorePropertySelectionNodeId,
    parseStoredPropertySelectionNodeId,
    type PropertySelectionNodeId
} from '../../utils/propertyTree';

type SelectionAPIHost = {
    app: {
        vault: {
            getFolderByPath: (path: string) => TFolder | null;
            getFileByPath: (path: string) => TFile | null;
        };
    };
    getPlugin: () => NotebookNavigatorPlugin;
    trigger: <T extends NotebookNavigatorEventType>(
        event: T,
        ...args: NotebookNavigatorEvents[T] extends void ? [] : [data: NotebookNavigatorEvents[T]]
    ) => void;
};

/**
 * Selection API - Manage and query selection state in the navigator
 */
export class SelectionAPI {
    /**
     * Internal state for tracking all selections
     */
    private selectionState: {
        files: Set<string>;
        primaryFile: TFile | null;
        navigationFolder: TFolder | null;
        navigationTag: string | null;
        navigationProperty: PropertySelectionNodeId | null;
    } = {
        // File selection state
        files: new Set<string>(),
        primaryFile: null,
        // Navigation selection state
        navigationFolder: null,
        navigationTag: null,
        navigationProperty: null
    };

    // Snapshot signature of last-emitted selection to ensure events fire when
    // selection content changes (even if the count stays the same)
    private lastSelectionSignature = '';
    private navigationStateInitialized = false;

    constructor(private api: SelectionAPIHost) {}

    private ensureNavigationStateInitialized(): void {
        if (this.navigationStateInitialized || !localStorage.isInitialized()) {
            return;
        }

        this.navigationStateInitialized = true;
        this.initializeNavigationState();
    }

    /**
     * Initialize navigation state from localStorage on startup
     */
    private initializeNavigationState(): void {
        try {
            const settings = this.api.getPlugin().settings;

            if (settings.showProperties) {
                const propertySelection = parseStoredPropertySelectionNodeId(localStorage.get<unknown>(STORAGE_KEYS.selectedPropertyKey));
                if (propertySelection && canRestorePropertySelectionNodeId(settings, propertySelection)) {
                    this.selectionState.navigationProperty = propertySelection;
                    this.selectionState.navigationTag = null;
                    this.selectionState.navigationFolder = null;
                    return;
                }
                if (propertySelection) {
                    try {
                        localStorage.remove(STORAGE_KEYS.selectedPropertyKey);
                    } catch (error) {
                        console.error('Failed to clear invalid property selection from localStorage:', error);
                    }
                }
            }

            const folderPath = localStorage.get<string>(STORAGE_KEYS.selectedFolderKey);
            const tagName = localStorage.get<string>(STORAGE_KEYS.selectedTagKey);

            if (tagName) {
                this.selectionState.navigationTag = tagName;
                this.selectionState.navigationFolder = null;
                this.selectionState.navigationProperty = null;
            } else if (folderPath) {
                const folder = this.api.app.vault.getFolderByPath(folderPath);
                if (folder) {
                    this.selectionState.navigationFolder = folder;
                    this.selectionState.navigationTag = null;
                    this.selectionState.navigationProperty = null;
                }
            }
        } catch (error) {
            console.error('Failed to initialize navigation state from localStorage:', error);
        }
    }

    /**
     * Get the currently selected navigation item (folder, tag, property, or none)
     * @returns Object with one selected navigation target (folder, tag, property, or none)
     */
    getNavItem(): NavItem {
        this.ensureNavigationStateInitialized();

        if (this.selectionState.navigationProperty) {
            return {
                type: 'property',
                folder: null,
                tag: null,
                property: this.selectionState.navigationProperty
            };
        } else if (this.selectionState.navigationTag) {
            return {
                type: 'tag',
                folder: null,
                tag: this.selectionState.navigationTag,
                property: null
            };
        } else if (this.selectionState.navigationFolder) {
            return {
                type: 'folder',
                folder: this.selectionState.navigationFolder,
                tag: null,
                property: null
            };
        }
        return {
            type: 'none',
            folder: null,
            tag: null,
            property: null
        };
    }

    /**
     * Update the navigation selection state
     * Called by React components when navigation changes
     * @internal
     */
    updateNavigationState(folder: TFolder | null, tag: string | null, property: PropertySelectionNodeId | null): void {
        this.navigationStateInitialized = true;

        if (property) {
            this.selectionState.navigationFolder = null;
            this.selectionState.navigationTag = null;
            this.selectionState.navigationProperty = property;
        } else if (tag) {
            this.selectionState.navigationFolder = null;
            this.selectionState.navigationTag = tag;
            this.selectionState.navigationProperty = null;
        } else if (folder) {
            this.selectionState.navigationFolder = folder;
            this.selectionState.navigationTag = null;
            this.selectionState.navigationProperty = null;
        } else {
            this.selectionState.navigationFolder = null;
            this.selectionState.navigationTag = null;
            this.selectionState.navigationProperty = null;
        }

        // Trigger the consolidated navigation event
        this.api.trigger('nav-item-changed', { item: this.getNavItem() });
    }

    /**
     * Update the file selection state
     * Called by React components when file selection changes
     * @internal
     */
    updateFileState(selectedFiles: Set<string>, primaryFile: TFile | null): void {
        // Compute a stable signature for selected paths + primary file
        const sortedPaths = Array.from(selectedFiles).sort();
        const primaryPath = primaryFile ? primaryFile.path : '';
        const newSignature = `${sortedPaths.join('|')}::${primaryPath}`;

        // Update internal state
        this.selectionState.files = new Set(selectedFiles);
        this.selectionState.primaryFile = primaryFile;

        // Emit event only when selection content actually changes
        if (newSignature !== this.lastSelectionSignature) {
            this.lastSelectionSignature = newSignature;

            // Get TFile objects for the event
            const fileObjects: TFile[] = [];
            for (const path of selectedFiles) {
                const file = this.api.app.vault.getFileByPath(path);
                if (file) fileObjects.push(file);
            }

            this.api.trigger('selection-changed', {
                state: {
                    files: fileObjects,
                    focused: primaryFile
                }
            });
        }
    }

    /**
     * Get the current selection state
     * @returns Current selection state with files and focused file
     */
    getCurrent(): SelectionState {
        const files: TFile[] = [];

        for (const path of this.selectionState.files) {
            const file = this.api.app.vault.getFileByPath(path);
            if (file) files.push(file);
        }

        return {
            files,
            focused: this.selectionState.primaryFile
        };
    }
}
