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

import { getDefaultKeyboardShortcuts } from '../utils/keyboardShortcuts';
import { FILE_VISIBILITY } from '../utils/fileTypeUtils';
import { NAVPANE_MEASUREMENTS, type PinnedNotes } from '../types';
import type { FolderAppearance, TagAppearance } from '../hooks/useListPaneAppearance';
import type { NotebookNavigatorSettings } from './types';

/**
 * Default settings for the plugin
 * Used when plugin is first installed or settings are reset
 */
export const DEFAULT_SETTINGS: NotebookNavigatorSettings = {
    // General tab - Startup & layout
    startView: 'files',
    showTooltips: false,
    showTooltipPath: true,

    // General tab - Homepage
    homepage: null,
    mobileHomepage: null,
    useMobileHomepage: false,

    // General tab - Behavior
    autoRevealActiveFile: true,
    autoRevealIgnoreRightSidebar: true,

    // General tab - Filtering
    fileVisibility: FILE_VISIBILITY.DOCUMENTS,
    excludedFolders: [],
    excludedFiles: [],

    // General tab - Formatting
    dateFormat: 'MMM d, yyyy',
    timeFormat: 'h:mm a',

    // Navigation pane tab
    autoSelectFirstFileOnFocusChange: false,
    navigationBanner: null,
    showShortcuts: true,
    showRecentNotes: true,
    recentNotesCount: 5,
    autoExpandFoldersTags: false,
    collapseBehavior: 'all',
    smartCollapse: true,
    showIcons: true,
    colorIconOnly: false,
    showNoteCount: true,
    separateNoteCounts: true,
    navIndent: NAVPANE_MEASUREMENTS.defaultIndent,
    navItemHeight: NAVPANE_MEASUREMENTS.defaultItemHeight,
    navItemHeightScaleText: true,
    showHiddenItems: false,

    // Folders & tags tab
    showRootFolder: true,
    inheritFolderColors: false,
    enableFolderNotes: false,
    folderNoteType: 'markdown',
    folderNoteName: '',
    folderNoteProperties: [],
    hideFolderNoteInList: true,
    pinCreatedFolderNote: false,
    showTags: true,
    showAllTagsFolder: true,
    showUntagged: false,
    tagSortOrder: 'alpha-asc',
    hiddenTags: [],
    showTopics: true,
    hiddenTopics: [],

    // List pane tab
    defaultFolderSort: 'modified-desc',
    listPaneTitle: 'header',
    multiSelectModifier: 'cmdCtrl',
    includeDescendantNotes: true,
    groupByDate: true,
    optimizeNoteHeight: true,
    showQuickActions: true,
    quickActionRevealInFolder: true,
    quickActionPinNote: true,
    quickActionOpenInNewTab: true,

    // Notes tab
    useFrontmatterMetadata: false,
    frontmatterIconField: 'icon',
    frontmatterColorField: 'color',
    frontmatterNameField: '',
    frontmatterCreatedField: '',
    frontmatterModifiedField: '',
    frontmatterDateFormat: '',
    saveMetadataToFrontmatter: false,
    iconizeFormat: false,
    fileNameRows: 1,
    showFileDate: true,
    showFileTags: true,
    showFileTagAncestors: true,
    colorFileTags: true,
    showFileTagsInSlimMode: false,
    showParentFolderNames: true,
    showFilePreview: true,
    skipHeadingsInPreview: true,
    skipCodeBlocksInPreview: true,
    previewProperties: [],
    previewRows: 2,
    showFeatureImage: true,
    featureImageProperties: ['thumbnail', 'featureResized', 'feature'],
    forceSquareFeatureImage: true,
    useEmbeddedImageFallback: true,

    // Icon packs tab
    externalIconProviders: {},

    // Search & hotkeys tab
    searchProvider: 'internal',
    keyboardShortcuts: getDefaultKeyboardShortcuts(),
    shortcuts: [],

    // Advanced tab
    checkForUpdatesOnStart: true,
    confirmBeforeDelete: true,

    // Runtime state and cached data
    searchActive: false,
    customVaultName: '',
    pinnedNotes: {} as PinnedNotes,
    fileIcons: {},
    fileColors: {},
    folderIcons: {},
    folderColors: {},
    folderBackgroundColors: {},
    folderSortOverrides: {},
    folderAppearances: {} as Record<string, FolderAppearance>,
    tagIcons: {},
    tagColors: {},
    tagBackgroundColors: {},
    tagSortOverrides: {},
    tagAppearances: {} as Record<string, TagAppearance>,
    recentColors: [],
    lastShownVersion: '',
    latestKnownRelease: '',
    lastAnnouncedRelease: '',
    lastReleaseCheckAt: null,
    rootFolderOrder: [],
    rootTagOrder: []
};
