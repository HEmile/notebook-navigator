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

import { App, WorkspaceLeaf } from 'obsidian';

/**
 * Shared types and constants for Notebook Navigator
 * Centralizes type definitions used across multiple modules
 */

/**
 * Unique identifier for the Notebook Navigator view type
 * Used by Obsidian to register and manage the custom view
 */
export const NOTEBOOK_NAVIGATOR_VIEW = 'notebook-navigator';

/**
 * Special tag identifier for untagged notes
 * Using double underscore to avoid conflicts with real tags
 */
export const UNTAGGED_TAG_ID = '__untagged__';

/**
 * Identifies which pane currently has keyboard focus
 * Used for keyboard navigation between folder tree and file list
 */
export type FocusedPane = 'navigation' | 'files';

/**
 * Enum for all item types in the navigator
 * Using const enum for better performance (inlined at compile time)
 */
export const ItemType = {
    FILE: 'file',
    FOLDER: 'folder',
    TAG: 'tag',
    TOPIC: 'topic'
} as const;

/**
 * Enum for list pane item types
 * These are specific to the list pane view
 */
export const ListPaneItemType = {
    HEADER: 'header',
    FILE: 'file',
    TOP_SPACER: 'top-spacer',
    BOTTOM_SPACER: 'bottom-spacer'
} as const;

/**
 * Type representing all possible list pane item types
 */
export type ListPaneItemType = (typeof ListPaneItemType)[keyof typeof ListPaneItemType];

/**
 * Navigator context type for context-aware features like pinning
 * Represents different browsing contexts in the navigator
 */
export type NavigatorContext = 'folder' | 'tag';

/**
 * Type alias for pinned notes storage structure
 * Maps file paths to their pinning context states
 */
export type PinnedNotes = Record<string, Record<NavigatorContext, boolean>>;

/**
 * Enum for navigation pane item types
 * These are specific to the navigation pane (left side)
 */
export const NavigationPaneItemType = {
    FOLDER: 'folder',
    VIRTUAL_FOLDER: 'virtual-folder',
    TAG: 'tag',
    UNTAGGED: 'untagged',
    TOPIC: 'topic',
    SHORTCUT_HEADER: 'shortcut-header',
    SHORTCUT_FOLDER: 'shortcut-folder',
    SHORTCUT_NOTE: 'shortcut-note',
    SHORTCUT_SEARCH: 'shortcut-search',
    SHORTCUT_TAG: 'shortcut-tag',
    RECENT_NOTE: 'recent-note',
    BANNER: 'banner',
    TOP_SPACER: 'top-spacer',
    BOTTOM_SPACER: 'bottom-spacer',
    LIST_SPACER: 'list-spacer'
} as const;

/**
 * Type representing all possible navigation pane item types
 */
export type NavigationPaneItemType = (typeof NavigationPaneItemType)[keyof typeof NavigationPaneItemType];

/**
 * Navigation pane measurements for accurate virtualization
 * Used by NavigationPane component
 * Note: Folder and tag heights are now dynamically calculated from settings
 */
export const NAVPANE_MEASUREMENTS = {
    // Default settings
    defaultItemHeight: 28, // Default item height
    defaultIndent: 16, // Default tree indentation
    defaultFontSize: 13, // Default desktop font size

    // Navigation item components
    lineHeight: 18, // Fixed line height for folder/tag names (--nn-nav-line-height)

    // Mobile adjustments
    mobileHeightIncrement: 12, // Mobile item height is desktop + 12px
    mobileFontSizeIncrement: 3, // Mobile font size is desktop + 3px

    // Spacers
    topSpacer: 8,
    listSpacer: 8,
    bottomSpacer: 20
};

/**
 * Overscan value for all virtualized lists
 * Controls how many items are rendered outside the visible area
 */
export const OVERSCAN = 10;

/**
 * List pane measurements for accurate virtualization
 * Used by ListPane component for calculating item heights
 */
export const LISTPANE_MEASUREMENTS = {
    // Date group headers
    firstHeader: 35, // var(--nn-date-header-height)
    subsequentHeader: 50, // var(--nn-date-header-height-subsequent)

    // File item components
    basePadding: 16, // var(--nn-file-padding-total) = var(--nn-file-padding-vertical) * 2
    slimPadding: 10, // var(--nn-file-padding-vertical-slim) * 2
    slimPaddingMobile: 16, // var(--nn-file-padding-vertical-slim-mobile) * 2
    titleLineHeight: 20, // var(--nn-file-title-line-height)
    singleTextLineHeight: 19, // var(--nn-file-single-text-line-height)
    multilineTextLineHeight: 18, // var(--nn-file-multiline-text-line-height)
    tagRowHeight: 26, // Height of tag row (20px container + 4px margin-top)
    featureImageHeight: 42, // var(--nn-feature-image-min-size)

    // Spacers
    bottomSpacer: 20,
    topSpacer: 8
};

/**
 * Type representing all possible item types
 */
export type ItemType = (typeof ItemType)[keyof typeof ItemType];

/**
 * Types of items that can be selected in the navigation pane
 * Either a folder from the file tree, a tag from the tag tree, or a topic from the topic graph
 * This is a subset of ItemType that excludes 'file'
 */
export type NavigationItemType = typeof ItemType.FOLDER | typeof ItemType.TAG | typeof ItemType.TOPIC;

/**
 * Keys used for persisting state in browser localStorage
 * Ensures consistent key naming across the plugin
 */
export interface LocalStorageKeys {
    expandedFoldersKey: string;
    expandedTagsKey: string;
    expandedVirtualFoldersKey: string;
    selectedFolderKey: string;
    selectedFileKey: string;
    selectedFilesKey: string;
    selectedTagKey: string;
    navigationPaneWidthKey: string;
    dualPaneKey: string;
    shortcutsExpandedKey: string;
    recentNotesExpandedKey: string;
    shortcutsPinnedKey: string;
    recentNotesKey: string;
    recentIconsKey: string;
    fileCacheKey: string;
    databaseSchemaVersionKey: string;
    databaseContentVersionKey: string;
    localStorageVersionKey: string;
}

/**
 * Singleton instance of localStorage keys
 * Use this instead of defining keys in multiple places
 */
export const STORAGE_KEYS: LocalStorageKeys = {
    expandedFoldersKey: 'notebook-navigator-expanded-folders',
    expandedTagsKey: 'notebook-navigator-expanded-tags',
    expandedVirtualFoldersKey: 'notebook-navigator-expanded-virtual-folders',
    selectedFolderKey: 'notebook-navigator-selected-folder',
    selectedFileKey: 'notebook-navigator-selected-file',
    selectedFilesKey: 'notebook-navigator-selected-files',
    selectedTagKey: 'notebook-navigator-selected-tag',
    navigationPaneWidthKey: 'notebook-navigator-navigation-pane-width',
    dualPaneKey: 'notebook-navigator-dual-pane',
    shortcutsExpandedKey: 'notebook-navigator-shortcuts-expanded',
    recentNotesExpandedKey: 'notebook-navigator-recent-notes-expanded',
    shortcutsPinnedKey: 'notebook-navigator-shortcuts-pinned',
    recentNotesKey: 'notebook-navigator-recent-notes',
    recentIconsKey: 'notebook-navigator-recent-icons',
    fileCacheKey: 'notebook-navigator-file-cache',
    databaseSchemaVersionKey: 'notebook-navigator-db-schema-version',
    databaseContentVersionKey: 'notebook-navigator-db-content-version',
    localStorageVersionKey: 'notebook-navigator-localstorage-version'
};

/**
 * Default dimensions for the navigation pane (folder/tag tree)
 * These values are used when no saved state exists
 */
export const NAVIGATION_PANE_DIMENSIONS = {
    defaultWidth: 300,
    minWidth: 150
};

/**
 * Default dimensions for the file pane (file list)
 * The file pane uses flex: 1 so it doesn't have a defaultWidth or maxWidth
 */
export const FILE_PANE_DIMENSIONS = {
    minWidth: 250
};

/**
 * Supported file types in Notebook Navigator
 * Maps file extensions to their corresponding Obsidian leaf types
 */
const SUPPORTED_FILE_TYPES = {
    // Extension to leaf type mapping
    md: 'markdown',
    canvas: 'canvas',
    pdf: 'pdf',
    base: 'base'
} as const;

/**
 * Array of supported leaf types (derived from SUPPORTED_FILE_TYPES values)
 */
const SUPPORTED_LEAF_TYPES = Object.values(SUPPORTED_FILE_TYPES);

/**
 * Type for supported file extensions
 */
export type SupportedFileExtension = keyof typeof SUPPORTED_FILE_TYPES;

/**
 * Type for supported leaf types
 */
export type SupportedLeafType = (typeof SUPPORTED_FILE_TYPES)[SupportedFileExtension];

/**
 * Helper functions related to supported leaf types
 */

/**
 * Helper function to get all leaves with supported file types
 */
export function getSupportedLeaves(app: App): WorkspaceLeaf[] {
    return SUPPORTED_LEAF_TYPES.flatMap(type => app.workspace.getLeavesOfType(type));
}

/**
 * Virtual folder for organizing tags
 * These are not real folders but act like folders in the UI
 */
export interface VirtualFolder {
    /** Unique identifier for the virtual folder */
    id: string;
    /** Display name of the virtual folder */
    name: string;
    /** Optional custom icon for the virtual folder */
    icon?: string;
}

/**
 * Virtual folder id for the shortcuts section in the navigation pane
 */
export const SHORTCUTS_VIRTUAL_FOLDER_ID = 'shortcuts-root';
export const RECENT_NOTES_VIRTUAL_FOLDER_ID = 'recent-notes-root';

/**
 * Data attributes for drag-and-drop functionality using event delegation
 * These attributes are added to DOM elements to enable drag-drop without individual event listeners
 */
export interface DragDropAttributes {
    // Draggable element attributes
    'data-draggable'?: 'true';
    'data-drag-type'?: ItemType;
    'data-drag-path'?: string;
    'data-drag-handle'?: 'true';

    // Drop zone attributes
    'data-drop-zone'?: typeof ItemType.FOLDER;
    'data-drop-path'?: string;
    'data-drop-validator'?: typeof ItemType.FOLDER;

    // Interaction attributes
    'data-clickable'?: typeof ItemType.FOLDER | typeof ItemType.FILE;
    'data-click-path'?: string;
    'data-dblclick-action'?: 'expand' | 'preview';
    'data-context-menu'?: ItemType;

    // State attributes
    'data-expanded'?: 'true' | 'false';
    'data-selected'?: 'true' | 'false';
    'data-focused'?: 'true' | 'false';

    // Index for keyboard navigation
    'data-index'?: string;

    // Nesting level for folders
    'data-level'?: string;
}

/**
 * Combined attributes interface for DOM elements
 * Extends standard HTML attributes with our custom data attributes
 */
export interface NavigatorElementAttributes extends DragDropAttributes {
    'data-path': string; // Required path attribute for all items
    class?: string;
    draggable?: 'true' | 'false';
    'aria-label'?: string;
    'aria-expanded'?: 'true' | 'false';
    'aria-selected'?: 'true' | 'false';
}
