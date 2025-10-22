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

import type { FileVisibility } from '../utils/fileTypeUtils';
import type { FolderAppearance, TagAppearance } from '../hooks/useListPaneAppearance';
import type { DualPaneBackgroundMode, PinnedNotes } from '../types';
import type { FolderNoteType } from '../types/folderNote';
import type { KeyboardShortcutConfig } from '../utils/keyboardShortcuts';
import type { ShortcutEntry } from '../types/shortcuts';
import type { SearchProvider } from '../types/search';

/** Available sort options for file listing */
export type SortOption = 'modified-desc' | 'modified-asc' | 'created-desc' | 'created-asc' | 'title-asc' | 'title-desc';

/** Available orderings for tags in the navigation pane */
export type TagSortOrder = 'alpha-asc' | 'alpha-desc' | 'frequency-asc' | 'frequency-desc';

/** Type guard for validating tag sort order values */
export function isTagSortOrder(value: string): value is TagSortOrder {
    return value === 'alpha-asc' || value === 'alpha-desc' || value === 'frequency-asc' || value === 'frequency-desc';
}

/** Scope of items that button actions affect */
export type ItemScope = 'all' | 'folders-only' | 'tags-only';

/** Modifier key used for multi-select operations */
export type MultiSelectModifier = 'cmdCtrl' | 'optionAlt';

/** Display options for list pane title */
export type ListPaneTitleOption = 'header' | 'list' | 'hidden';

/** Grouping options for list pane notes */
export type ListNoteGroupingOption = 'none' | 'date' | 'folder';

/**
 * Plugin settings interface defining all configurable options
 * Settings are organized by tab for easier maintenance
 */
export interface NotebookNavigatorSettings {
    // General tab - Startup & layout
    startView: 'navigation' | 'files';
    showTooltips: boolean;
    showTooltipPath: boolean;
    dualPaneBackground: DualPaneBackgroundMode;

    // General tab - Homepage
    homepage: string | null;
    mobileHomepage: string | null;
    useMobileHomepage: boolean;

    // General tab - Behavior
    autoRevealActiveFile: boolean;
    autoRevealIgnoreRightSidebar: boolean;

    // General tab - Filtering
    fileVisibility: FileVisibility;
    excludedFolders: string[];
    excludedFiles: string[];

    // General tab - Formatting
    dateFormat: string;
    timeFormat: string;

    // Navigation pane tab
    autoSelectFirstFileOnFocusChange: boolean;
    navigationBanner: string | null;
    showShortcuts: boolean;
    showRecentNotes: boolean;
    recentNotesCount: number;
    autoExpandFoldersTags: boolean;
    collapseBehavior: ItemScope;
    smartCollapse: boolean;
    showIcons: boolean;
    colorIconOnly: boolean;
    showNoteCount: boolean;
    separateNoteCounts: boolean;
    navIndent: number;
    navItemHeight: number;
    navItemHeightScaleText: boolean;
    showHiddenItems: boolean;

    // Folders, tags & topics tab
    showRootFolder: boolean;
    inheritFolderColors: boolean;
    enableFolderNotes: boolean;
    folderNoteType: FolderNoteType;
    folderNoteName: string;
    folderNoteProperties: string[];
    hideFolderNoteInList: boolean;
    pinCreatedFolderNote: boolean;
    showTags: boolean;
    showAllTagsFolder: boolean;
    showUntagged: boolean;
    tagSortOrder: TagSortOrder;
    hiddenTags: string[];
    showTopics: boolean;
    topicSortOrder: TagSortOrder;
    hiddenTopics: string[];

    // List pane tab
    defaultFolderSort: SortOption;
    listPaneTitle: ListPaneTitleOption;
    multiSelectModifier: MultiSelectModifier;
    includeDescendantNotes: boolean;
    noteGrouping: ListNoteGroupingOption;
    optimizeNoteHeight: boolean;
    showQuickActions: boolean;
    quickActionRevealInFolder: boolean;
    quickActionPinNote: boolean;
    quickActionOpenInNewTab: boolean;

    // Notes tab
    useFrontmatterMetadata: boolean;
    frontmatterIconField: string;
    frontmatterColorField: string;
    frontmatterNameField: string;
    frontmatterCreatedField: string;
    frontmatterModifiedField: string;
    frontmatterDateFormat: string;
    saveMetadataToFrontmatter: boolean;
    iconizeFormat: boolean;
    fileNameRows: number;
    showFileDate: boolean;
    showFileTags: boolean;
    showFileTagAncestors: boolean;
    colorFileTags: boolean;
    showFileTagsInSlimMode: boolean;
    showParentFolderNames: boolean;
    showFilePreview: boolean;
    skipHeadingsInPreview: boolean;
    skipCodeBlocksInPreview: boolean;
    previewProperties: string[];
    previewRows: number;
    showFeatureImage: boolean;
    featureImageProperties: string[];
    forceSquareFeatureImage: boolean;
    useEmbeddedImageFallback: boolean;

    // Icon packs tab
    externalIconProviders: Record<string, boolean>;

    // Search & hotkeys tab
    searchProvider: SearchProvider | null;
    keyboardShortcuts: KeyboardShortcutConfig;
    shortcuts: ShortcutEntry[];

    // Advanced tab
    checkForUpdatesOnStart: boolean;
    confirmBeforeDelete: boolean;

    // Runtime state and cached data
    searchActive: boolean;
    customVaultName: string;
    pinnedNotes: PinnedNotes;
    fileIcons: Record<string, string>;
    fileColors: Record<string, string>;
    folderIcons: Record<string, string>;
    folderColors: Record<string, string>;
    folderBackgroundColors: Record<string, string>;
    folderSortOverrides: Record<string, SortOption>;
    folderAppearances: Record<string, FolderAppearance>;
    tagIcons: Record<string, string>;
    tagColors: Record<string, string>;
    tagBackgroundColors: Record<string, string>;
    tagSortOverrides: Record<string, SortOption>;
    tagAppearances: Record<string, TagAppearance>;
    topicIcons: Record<string, string>;
    topicColors: Record<string, string>;
    topicBackgroundColors: Record<string, string>;
    topicSortOverrides: Record<string, SortOption>;
    topicAppearances: Record<string, TagAppearance>;
    recentColors: string[];
    lastShownVersion: string;
    latestKnownRelease: string;
    lastAnnouncedRelease: string;
    lastReleaseCheckAt: number | null;
    rootFolderOrder: string[];
    rootTagOrder: string[];
    rootTopicOrder: string[];
}
