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

import { TFile, TFolder } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import type {
    FolderMetadata,
    FolderMetadataUpdate,
    TagMetadata,
    TagMetadataUpdate,
    PropertyMetadata,
    PropertyMetadataUpdate,
    IconInput,
    IconValue,
    NotebookNavigatorEventType,
    NotebookNavigatorEvents,
    PinContext,
    Pinned
} from '../types';
import type { NotebookNavigatorSettings } from '../../settings';
import { PinnedNotes } from '../../types';
import { normalizeCanonicalIconId } from '../../utils/iconizeFormat';
import { normalizePropertyNodeId } from '../../utils/propertyTree';
import { clonePinnedNotesRecord, normalizePinnedNoteContext } from '../../utils/recordUtils';

type MetadataUpdate = {
    color?: string | null;
    backgroundColor?: string | null;
    icon?: IconInput | null;
};

type MetadataAPIHost = {
    getApp: () => { vault: { getFolderByPath: (path: string) => TFolder | null } };
    getPlugin: () => NotebookNavigatorPlugin;
    trigger: <T extends NotebookNavigatorEventType>(
        event: T,
        ...args: NotebookNavigatorEvents[T] extends void ? [] : [data: NotebookNavigatorEvents[T]]
    ) => void;
};

type PinnedContextSnapshot = Pinned extends Map<string, infer TValue> ? TValue : never;

function freezePinnedContext(context: PinnedNotes[string]): PinnedContextSnapshot {
    return Object.freeze({ ...normalizePinnedNoteContext(context) }) as PinnedContextSnapshot;
}

/**
 * Metadata API - Manage folder, tag, and property appearance, icons, colors, and pinned files
 */
export class MetadataAPI {
    /**
     * Internal state cache for metadata
     */
    private metadataState = {
        // Folder metadata
        folderColors: {} as Record<string, string>,
        folderBackgroundColors: {} as Record<string, string>,
        folderIcons: {} as Record<string, string>,

        // Tag metadata
        tagColors: {} as Record<string, string>,
        tagBackgroundColors: {} as Record<string, string>,
        tagIcons: {} as Record<string, string>,

        // Property metadata
        propertyColors: {} as Record<string, string>,
        propertyBackgroundColors: {} as Record<string, string>,
        propertyIcons: {} as Record<string, string>,

        // File metadata
        fileIcons: {} as Record<string, string>,
        fileColors: {} as Record<string, string>,

        // Pinned files
        pinnedNotes: {} as PinnedNotes
    };

    /**
     * Previous state for change detection
     */
    private previousState: {
        folderColors: Record<string, string>;
        folderBackgroundColors: Record<string, string>;
        folderIcons: Record<string, string>;
        tagColors: Record<string, string>;
        tagBackgroundColors: Record<string, string>;
        tagIcons: Record<string, string>;
        propertyColors: Record<string, string>;
        propertyBackgroundColors: Record<string, string>;
        propertyIcons: Record<string, string>;
        fileIcons: Record<string, string>;
        fileColors: Record<string, string>;
        pinnedNotes: PinnedNotes;
        initialized: boolean;
    } = {
        folderColors: {},
        folderBackgroundColors: {},
        folderIcons: {},
        tagColors: {},
        tagBackgroundColors: {},
        tagIcons: {},
        propertyColors: {},
        propertyBackgroundColors: {},
        propertyIcons: {},
        fileIcons: {},
        fileColors: {},
        pinnedNotes: {},
        initialized: false
    };

    constructor(private api: MetadataAPIHost) {
        this.initializeFromSettings();
    }

    /**
     * Normalizes a tag key by removing leading "#" and converting to lowercase
     * @param tag - Tag string that may or may not have "#" prefix
     * @returns Normalized tag key for internal storage
     */
    private normalizeTagKey(tag: string): string {
        // Strip single leading "#" if present and lowercase
        const normalized = tag.startsWith('#') ? tag.slice(1) : tag;
        return normalized.toLowerCase();
    }

    /**
     * Initialize internal cache from plugin settings
     */
    private initializeFromSettings(): void {
        const plugin = this.api.getPlugin();
        if (plugin && plugin.settings) {
            this.updateFromSettings(plugin.settings);
        }
    }

    /**
     * Deep compare two objects to find changed keys
     * @internal
     */
    private findChangedKeys(oldObj: Record<string, string>, newObj: Record<string, string>): Set<string> {
        const changed = new Set<string>();

        // Check for added or modified
        for (const [key, value] of Object.entries(newObj)) {
            if (oldObj[key] !== value) {
                changed.add(key);
            }
        }

        // Check for deleted
        for (const key of Object.keys(oldObj)) {
            if (!(key in newObj)) {
                changed.add(key);
            }
        }

        return changed;
    }

    /**
     * Deep compare pinned notes objects
     * @internal
     */
    private pinnedNotesChanged(oldNotes: PinnedNotes, newNotes: PinnedNotes): boolean {
        const oldKeys = Object.keys(oldNotes);
        const newKeys = Object.keys(newNotes);

        if (oldKeys.length !== newKeys.length) return true;

        // Check each note
        for (const path of newKeys) {
            const oldContext = oldNotes[path];
            if (!oldContext) return true; // New note added

            const newContext = newNotes[path];
            if (
                oldContext.folder !== newContext.folder ||
                oldContext.tag !== newContext.tag ||
                oldContext.property !== newContext.property
            ) {
                return true;
            }
        }

        return false;
    }

    private getPinnedSnapshot(): Readonly<Pinned> {
        const entries = Object.entries(this.metadataState.pinnedNotes).map(([path, context]) => {
            return [path, freezePinnedContext(context)] as const;
        });

        return new Map(entries);
    }

    /**
     * Update internal cache when settings change and trigger events
     * Called by the plugin when settings are modified
     * @internal
     */
    updateFromSettings(settings: NotebookNavigatorSettings): void {
        const current = {
            folderColors: settings.folderColors || {},
            folderBackgroundColors: settings.folderBackgroundColors || {},
            folderIcons: settings.folderIcons || {},
            tagColors: settings.tagColors || {},
            tagBackgroundColors: settings.tagBackgroundColors || {},
            tagIcons: settings.tagIcons || {},
            propertyColors: settings.propertyColors || {},
            propertyBackgroundColors: settings.propertyBackgroundColors || {},
            propertyIcons: settings.propertyIcons || {},
            fileIcons: settings.fileIcons || {},
            fileColors: settings.fileColors || {},
            pinnedNotes: clonePinnedNotesRecord(settings.pinnedNotes)
        };

        // Update the cache first
        this.metadataState = {
            folderColors: { ...current.folderColors },
            folderBackgroundColors: { ...current.folderBackgroundColors },
            folderIcons: { ...current.folderIcons },
            tagColors: { ...current.tagColors },
            tagBackgroundColors: { ...current.tagBackgroundColors },
            tagIcons: { ...current.tagIcons },
            propertyColors: { ...current.propertyColors },
            propertyBackgroundColors: { ...current.propertyBackgroundColors },
            propertyIcons: { ...current.propertyIcons },
            fileIcons: { ...current.fileIcons },
            fileColors: { ...current.fileColors },
            pinnedNotes: clonePinnedNotesRecord(current.pinnedNotes)
        };

        // Skip comparison on first run (just initialize state)
        if (!this.previousState.initialized) {
            this.previousState = {
                folderColors: { ...current.folderColors },
                folderBackgroundColors: { ...current.folderBackgroundColors },
                folderIcons: { ...current.folderIcons },
                tagColors: { ...current.tagColors },
                tagBackgroundColors: { ...current.tagBackgroundColors },
                tagIcons: { ...current.tagIcons },
                propertyColors: { ...current.propertyColors },
                propertyBackgroundColors: { ...current.propertyBackgroundColors },
                propertyIcons: { ...current.propertyIcons },
                fileIcons: { ...current.fileIcons },
                fileColors: { ...current.fileColors },
                pinnedNotes: clonePinnedNotesRecord(current.pinnedNotes),
                initialized: true
            };
            return;
        }

        // Find changed folders
        const changedFolderColors = this.findChangedKeys(this.previousState.folderColors, current.folderColors);
        const changedFolderBackgrounds = this.findChangedKeys(this.previousState.folderBackgroundColors, current.folderBackgroundColors);
        const changedFolderIcons = this.findChangedKeys(this.previousState.folderIcons, current.folderIcons);
        const changedFolders = new Set([...changedFolderColors, ...changedFolderBackgrounds, ...changedFolderIcons]);

        // Fire events for changed folders
        for (const folderPath of changedFolders) {
            const folder = this.api.getApp().vault.getFolderByPath(folderPath);
            if (folder) {
                const metadata = this.getFolderMeta(folder);
                this.api.trigger('folder-changed', {
                    folder,
                    metadata
                });
            }
        }

        // Find changed tags
        const changedTagColors = this.findChangedKeys(this.previousState.tagColors, current.tagColors);
        const changedTagBackgrounds = this.findChangedKeys(this.previousState.tagBackgroundColors, current.tagBackgroundColors);
        const changedTagIcons = this.findChangedKeys(this.previousState.tagIcons, current.tagIcons);
        const changedTags = new Set([...changedTagColors, ...changedTagBackgrounds, ...changedTagIcons]);

        // Fire events for changed tags
        for (const tag of changedTags) {
            const metadata = this.getTagMeta(tag);
            this.api.trigger('tag-changed', {
                tag,
                metadata
            });
        }

        // Find changed property nodes
        const changedPropertyColors = this.findChangedKeys(this.previousState.propertyColors, current.propertyColors);
        const changedPropertyBackgrounds = this.findChangedKeys(
            this.previousState.propertyBackgroundColors,
            current.propertyBackgroundColors
        );
        const changedPropertyIcons = this.findChangedKeys(this.previousState.propertyIcons, current.propertyIcons);
        const changedProperties = new Set([...changedPropertyColors, ...changedPropertyBackgrounds, ...changedPropertyIcons]);

        // Fire events for changed properties
        for (const nodeId of changedProperties) {
            const metadata = this.getPropertyMeta(nodeId);
            this.api.trigger('property-changed', {
                nodeId,
                metadata
            });
        }

        // Check pinned notes
        if (this.pinnedNotesChanged(this.previousState.pinnedNotes, current.pinnedNotes)) {
            const pinnedMap = this.getPinnedSnapshot();
            this.api.trigger('pinned-files-changed', { files: pinnedMap });
        }

        // Update previous state for next comparison
        this.previousState = {
            folderColors: { ...current.folderColors },
            folderBackgroundColors: { ...current.folderBackgroundColors },
            folderIcons: { ...current.folderIcons },
            tagColors: { ...current.tagColors },
            tagBackgroundColors: { ...current.tagBackgroundColors },
            tagIcons: { ...current.tagIcons },
            propertyColors: { ...current.propertyColors },
            propertyBackgroundColors: { ...current.propertyBackgroundColors },
            propertyIcons: { ...current.propertyIcons },
            fileIcons: { ...current.fileIcons },
            fileColors: { ...current.fileColors },
            pinnedNotes: clonePinnedNotesRecord(current.pinnedNotes),
            initialized: true
        };
    }

    // ===================================================================
    // Generic Metadata Helper
    // ===================================================================

    /**
     * Generic helper to update metadata in settings
     * @internal
     */
    private async updateMetadata(
        key: string,
        meta: MetadataUpdate,
        colorStore: Record<string, string>,
        iconStore: Record<string, string>,
        backgroundStore: Record<string, string>
    ): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        let changed = false;

        // Update color if provided
        if (meta.color !== undefined) {
            if (meta.color === null) {
                // Clear color
                delete colorStore[key];
            } else {
                // Set color
                colorStore[key] = meta.color;
            }
            changed = true;
        }

        // Update background color if provided
        if (meta.backgroundColor !== undefined) {
            if (meta.backgroundColor === null) {
                delete backgroundStore[key];
            } else {
                backgroundStore[key] = meta.backgroundColor;
            }
            changed = true;
        }

        // Update icon if provided
        if (meta.icon !== undefined) {
            if (meta.icon === null) {
                delete iconStore[key];
                changed = true;
            } else if (typeof meta.icon === 'string') {
                const normalizedIcon = normalizeCanonicalIconId(meta.icon);
                if (normalizedIcon) {
                    iconStore[key] = normalizedIcon;
                    changed = true;
                }
            }
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettingsAndUpdate();
        }
    }

    // ===================================================================
    // Folder Metadata
    // ===================================================================

    private getFolderMetadataFromService(folder: TFolder): FolderMetadata | null {
        const plugin = this.api.getPlugin();
        if (!plugin.metadataService) {
            return null;
        }

        const folderDisplayData = plugin.metadataService.getFolderDisplayData(folder.path, {
            includeDisplayName: false,
            includeColor: true,
            includeBackgroundColor: true,
            includeIcon: true,
            includeInheritedColors: false
        });
        if (!folderDisplayData.color && !folderDisplayData.backgroundColor && !folderDisplayData.icon) {
            return null;
        }

        return {
            color: folderDisplayData.color,
            backgroundColor: folderDisplayData.backgroundColor,
            icon: folderDisplayData.icon
        };
    }

    private getFolderSettingsSnapshot(folderPath: string): string {
        const plugin = this.api.getPlugin();
        const color = plugin.settings.folderColors[folderPath];
        const backgroundColor = plugin.settings.folderBackgroundColors[folderPath];
        const icon = plugin.settings.folderIcons[folderPath];
        return `${color === undefined ? '\u0000' : color}\u0001${backgroundColor === undefined ? '\u0000' : backgroundColor}\u0001${
            icon === undefined ? '\u0000' : icon
        }`;
    }

    private isSameFolderMetadata(left: FolderMetadata | null, right: FolderMetadata | null): boolean {
        return left?.color === right?.color && left?.backgroundColor === right?.backgroundColor && left?.icon === right?.icon;
    }

    private triggerFolderChanged(folder: TFolder): void {
        if (this.api.getPlugin().metadataService) {
            const metadata = this.getFolderMetadataFromService(folder);
            this.api.trigger('folder-changed', {
                folder,
                metadata
            });
            return;
        }

        const metadata = this.getFolderMeta(folder);
        this.api.trigger('folder-changed', {
            folder,
            metadata
        });
    }

    /** @internal */
    emitFolderChangedForPath(folderPath: string): void {
        const folder = this.api.getApp().vault.getFolderByPath(folderPath);
        if (!folder) {
            return;
        }

        this.triggerFolderChanged(folder);
    }

    /**
     * Get folder metadata
     * @param folder - Folder to get metadata for
     */
    getFolderMeta(folder: TFolder): FolderMetadata | null {
        const plugin = this.api.getPlugin();
        if (plugin.settings.useFrontmatterMetadata && plugin.metadataService) {
            return this.getFolderMetadataFromService(folder);
        }

        const path = folder.path;
        const color = this.metadataState.folderColors[path];
        const backgroundColor = this.metadataState.folderBackgroundColors[path];
        const icon = this.metadataState.folderIcons[path];

        if (!color && !backgroundColor && !icon) {
            return null;
        }

        return {
            color,
            backgroundColor,
            icon: icon as IconValue | undefined
        };
    }

    /**
     * Set folder metadata (color and/or icon)
     * @param folder - Folder to set metadata for
     * @param meta - Partial metadata object with properties to update
     */
    async setFolderMeta(folder: TFolder, meta: FolderMetadataUpdate): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        if (plugin.metadataService) {
            const folderStyleUpdate: {
                icon?: string | null;
                color?: string | null;
                backgroundColor?: string | null;
            } = {};

            if (meta.icon !== undefined) {
                if (meta.icon === null) {
                    folderStyleUpdate.icon = null;
                } else if (typeof meta.icon === 'string') {
                    const normalizedIcon = normalizeCanonicalIconId(meta.icon);
                    if (normalizedIcon) {
                        folderStyleUpdate.icon = normalizedIcon;
                    }
                }
            }

            if (meta.color !== undefined) {
                folderStyleUpdate.color = meta.color;
            }

            if (meta.backgroundColor !== undefined) {
                folderStyleUpdate.backgroundColor = meta.backgroundColor;
            }

            if (
                folderStyleUpdate.icon !== undefined ||
                folderStyleUpdate.color !== undefined ||
                folderStyleUpdate.backgroundColor !== undefined
            ) {
                const isFolderStyleEventBridgeEnabled = plugin.metadataService.isFolderStyleEventBridgeEnabled?.() === true;
                const settingsSnapshotBefore = this.getFolderSettingsSnapshot(folder.path);
                const metadataBefore = this.getFolderMetadataFromService(folder);
                await plugin.metadataService.setFolderStyle(folder.path, folderStyleUpdate);
                const settingsSnapshotAfter = this.getFolderSettingsSnapshot(folder.path);
                if (settingsSnapshotBefore === settingsSnapshotAfter && !isFolderStyleEventBridgeEnabled) {
                    const metadataAfter = this.getFolderMetadataFromService(folder);
                    if (!this.isSameFolderMetadata(metadataBefore, metadataAfter)) {
                        this.triggerFolderChanged(folder);
                    }
                }
            }
            return;
        }

        await this.updateMetadata(
            folder.path,
            meta,
            plugin.settings.folderColors,
            plugin.settings.folderIcons,
            plugin.settings.folderBackgroundColors
        );
    }

    // ===================================================================
    // Tag Metadata
    // ===================================================================

    /**
     * Get tag metadata
     * @param tag - Tag string (with or without '#' prefix)
     */
    getTagMeta(tag: string): TagMetadata | null {
        // Normalize tag key for lookup
        const normalizedTag = this.normalizeTagKey(tag);

        const color = this.metadataState.tagColors[normalizedTag];
        const backgroundColor = this.metadataState.tagBackgroundColors[normalizedTag];
        const icon = this.metadataState.tagIcons[normalizedTag];

        if (!color && !backgroundColor && !icon) {
            return null;
        }

        return {
            color,
            backgroundColor,
            icon: icon as IconValue | undefined
        };
    }

    /**
     * Set tag metadata (color and/or icon). Pass null to clear a property.
     * @param tag - Tag string (with or without '#' prefix)
     * @param meta - Partial metadata object with properties to update
     */
    async setTagMeta(tag: string, meta: TagMetadataUpdate): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        const normalizedTag = this.normalizeTagKey(tag);
        await this.updateMetadata(
            normalizedTag,
            meta,
            plugin.settings.tagColors,
            plugin.settings.tagIcons,
            plugin.settings.tagBackgroundColors
        );
    }

    // ===================================================================
    // Property Metadata
    // ===================================================================

    /**
     * Get property metadata
     * @param nodeId - Property node id (key or key=value)
     */
    getPropertyMeta(nodeId: string): PropertyMetadata | null {
        const normalizedNodeId = normalizePropertyNodeId(nodeId);
        if (!normalizedNodeId) {
            return null;
        }

        const color = this.metadataState.propertyColors[normalizedNodeId];
        const backgroundColor = this.metadataState.propertyBackgroundColors[normalizedNodeId];
        const icon = this.metadataState.propertyIcons[normalizedNodeId];

        if (!color && !backgroundColor && !icon) {
            return null;
        }

        return {
            color,
            backgroundColor,
            icon: icon as IconValue | undefined
        };
    }

    /**
     * Set property metadata (color and/or icon). Pass null to clear a property.
     * @param nodeId - Property node id (key or key=value)
     * @param meta - Partial metadata object with properties to update
     */
    async setPropertyMeta(nodeId: string, meta: PropertyMetadataUpdate): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin) return;

        const normalizedNodeId = normalizePropertyNodeId(nodeId);
        if (!normalizedNodeId) {
            return;
        }

        await this.updateMetadata(
            normalizedNodeId,
            meta,
            plugin.settings.propertyColors,
            plugin.settings.propertyIcons,
            plugin.settings.propertyBackgroundColors
        );
    }

    // ===================================================================
    // Pinned Files
    // ===================================================================

    /**
     * Check if a file is pinned
     * @param file - File to check
     * @param context - Context to check (if not specified, returns true if pinned in any context)
     */
    isPinned(file: TFile, context?: PinContext): boolean {
        const contexts = this.metadataState.pinnedNotes[file.path];
        if (!contexts) return false;

        if (!context) {
            // No context - check if pinned in any context
            return contexts.folder || contexts.tag || contexts.property;
        } else if (context === 'all') {
            // Check if pinned in all contexts
            return contexts.folder && contexts.tag && contexts.property;
        } else if (context === 'folder') {
            return contexts.folder;
        } else if (context === 'property') {
            return contexts.property;
        }
        return contexts.tag;
    }

    /**
     * Pin a file
     * @param file - File to pin
     * @param context - Context to pin in (defaults to 'all')
     */
    async pin(file: TFile, context: PinContext = 'all'): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin?.metadataService) return;

        if (!plugin.settings.pinnedNotes) {
            plugin.settings.pinnedNotes = {};
        }

        if (!plugin.settings.pinnedNotes[file.path]) {
            plugin.settings.pinnedNotes[file.path] = { folder: false, tag: false, property: false };
        }

        let changed = false;
        const contexts = normalizePinnedNoteContext(plugin.settings.pinnedNotes[file.path]);
        plugin.settings.pinnedNotes[file.path] = contexts;

        if (context === 'all') {
            // Pin in all contexts
            if (!contexts.folder || !contexts.tag || !contexts.property) {
                contexts.folder = true;
                contexts.tag = true;
                contexts.property = true;
                changed = true;
            }
        } else if (context === 'folder') {
            if (!contexts.folder) {
                contexts.folder = true;
                changed = true;
            }
        } else if (context === 'property') {
            if (!contexts.property) {
                contexts.property = true;
                changed = true;
            }
        } else if (context === 'tag') {
            if (!contexts.tag) {
                contexts.tag = true;
                changed = true;
            }
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettingsAndUpdate();
        }
    }

    /**
     * Unpin a file
     * @param file - File to unpin
     * @param context - Context to unpin from (defaults to 'all')
     */
    async unpin(file: TFile, context: PinContext = 'all'): Promise<void> {
        const plugin = this.api.getPlugin();
        if (!plugin?.metadataService) return;

        const currentValue = plugin.settings.pinnedNotes?.[file.path];
        if (!currentValue) return;

        const contexts = normalizePinnedNoteContext(currentValue);
        plugin.settings.pinnedNotes[file.path] = contexts;

        let changed = false;

        if (context === 'all') {
            // Unpin from all contexts - remove entirely
            delete plugin.settings.pinnedNotes[file.path];
            changed = true;
        } else if (context === 'folder') {
            if (contexts.folder) {
                contexts.folder = false;
                changed = true;
            }
        } else if (context === 'property') {
            if (contexts.property) {
                contexts.property = false;
                changed = true;
            }
        } else if (context === 'tag') {
            if (contexts.tag) {
                contexts.tag = false;
                changed = true;
            }
        }

        // Remove if unpinned from all contexts
        if (changed && contexts && !contexts.folder && !contexts.tag && !contexts.property) {
            delete plugin.settings.pinnedNotes[file.path];
        }

        // Save settings if anything changed
        if (changed) {
            await plugin.saveSettingsAndUpdate();
        }
    }

    /**
     * Get all pinned files with their context information
     * @returns Map of file paths to PinnedContext objects
     */
    getPinned(): Readonly<Pinned> {
        return this.getPinnedSnapshot();
    }
}
