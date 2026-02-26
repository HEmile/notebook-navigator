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

/**
 * English language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_EN = {
    // Common UI elements
    common: {
        cancel: 'Cancel', // Button text for canceling dialogs and operations (English: Cancel)
        delete: 'Delete', // Button text for delete operations in dialogs (English: Delete)
        clear: 'Clear', // Button text for clearing values (English: Clear)
        remove: 'Remove', // Button text for remove operations in dialogs (English: Remove)
        submit: 'Submit', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'No selection', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Untagged', // Label for notes without any tags (English: Untagged)
        featureImageAlt: 'Feature image', // Alt text for thumbnail/preview images (English: Feature image)
        unknownError: 'Unknown error', // Generic fallback when an error has no message (English: Unknown error)
        clipboardWriteError: 'Could not write to clipboard',
        updateBannerTitle: 'Notebook Navigator update available',
        updateBannerInstruction: 'Update in Settings -> Community plugins',
        previous: 'Previous', // Generic aria label for previous navigation (English: Previous)
        next: 'Next' // Generic aria label for next navigation (English: Next)
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Select a folder or tag to view notes', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'No notes', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: 'Pinned', // Header for the pinned notes section at the top of file list (English: Pinned)
        notesSection: 'Notes', // Header shown between pinned and regular items when showing documents only (English: Notes)
        filesSection: 'Files', // Header shown between pinned and regular items when showing supported or all files (English: Files)
        hiddenItemAriaLabel: '{name} (hidden)' // Accessibility label applied to list items that are normally hidden
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Untagged', // Label for the special item showing notes without tags (English: Untagged)
        tags: 'Tags' // Label for the tags virtual folder (English: Tags)
    },

    // Navigation pane
    navigationPane: {
        shortcutsHeader: 'Shortcuts', // Header label for shortcuts section in navigation pane (English: Shortcuts)
        recentNotesHeader: 'Recent notes', // Header label for recent notes section in navigation pane (English: Recent notes)
        recentFilesHeader: 'Recent files', // Header label when showing recent non-note files in navigation pane (English: Recent files)
        properties: 'Properties', // Header label for properties section in navigation pane (English: Properties)
        reorderRootFoldersTitle: 'Reorder navigation',
        reorderRootFoldersHint: 'Use arrows or drag to reorder',
        vaultRootLabel: 'Vault',
        resetRootToAlpha: 'Reset to alphabetical order',
        resetRootToFrequency: 'Reset to frequency order',
        pinShortcuts: 'Pin shortcuts',
        pinShortcutsAndRecentNotes: 'Pin shortcuts and recent notes',
        pinShortcutsAndRecentFiles: 'Pin shortcuts and recent files',
        unpinShortcuts: 'Unpin shortcuts',
        unpinShortcutsAndRecentNotes: 'Unpin shortcuts and recent notes',
        unpinShortcutsAndRecentFiles: 'Unpin shortcuts and recent files',
        profileMenuAria: 'Change vault profile'
    },

    navigationCalendar: {
        ariaLabel: 'Calendar',
        dailyNotesNotEnabled: 'Daily notes core plugin is not enabled.',
        createDailyNote: {
            title: 'New daily note',
            message: 'File {filename} does not exist. Would you like to create it?',
            confirmButton: 'Create'
        },
        helpModal: {
            title: 'Calendar shortcuts',
            items: [
                'Click any day to open or create a daily note. Weeks, months, quarters, and years work the same way.',
                'A filled dot under a day means it has a note. A hollow dot means it has unfinished tasks.',
                "If a note has a feature image, it appears as the day's background."
            ],
            dateFilterCmdCtrl: '`Cmd/Ctrl`+click a date to filter by that date in the file list.',
            dateFilterOptionAlt: '`Option/Alt`+click a date to filter by that date in the file list.'
        }
    },

    dailyNotes: {
        templateReadFailed: 'Failed to read the daily note template.',
        createFailed: 'Unable to create daily note.'
    },

    shortcuts: {
        folderExists: 'Folder already in shortcuts',
        noteExists: 'Note already in shortcuts',
        tagExists: 'Tag already in shortcuts',
        propertyExists: 'Property already in shortcuts',
        invalidProperty: 'Invalid property shortcut',
        searchExists: 'Search shortcut already exists',
        emptySearchQuery: 'Enter a search query before saving it',
        emptySearchName: 'Enter a name before saving the search',
        add: 'Add to shortcuts',
        addNotesCount: 'Add {count} notes to shortcuts',
        addFilesCount: 'Add {count} files to shortcuts',
        rename: 'Rename shortcut',
        remove: 'Remove from shortcuts',
        removeAll: 'Remove all shortcuts',
        removeAllConfirm: 'Remove all shortcuts?',
        folderNotesPinned: 'Pinned {count} folder notes'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Collapse items', // Tooltip for button that collapses expanded items (English: Collapse items)
        expandAllFolders: 'Expand all items', // Tooltip for button that expands all items (English: Expand all items)
        showCalendar: 'Show calendar',
        hideCalendar: 'Hide calendar',
        newFolder: 'New folder', // Tooltip for create new folder button (English: New folder)
        newNote: 'New note', // Tooltip for create new note button (English: New note)
        mobileBackToNavigation: 'Back to navigation', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: 'Change sort order', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Default', // Label for default sorting mode (English: Default)
        showFolders: 'Show navigation', // Tooltip for button to show the navigation pane (English: Show navigation)
        reorderRootFolders: 'Reorder navigation',
        finishRootFolderReorder: 'Done reordering',
        showExcludedItems: 'Show hidden folders, tags, and notes', // Tooltip for button to show hidden items (English: Show hidden items)
        hideExcludedItems: 'Hide hidden folders, tags, and notes', // Tooltip for button to hide hidden items (English: Hide hidden items)
        showDualPane: 'Show dual panes', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: 'Show single pane', // Tooltip for button to show single-pane layout (English: Show single pane)
        changeAppearance: 'Change appearance', // Tooltip for button to change folder appearance settings (English: Change appearance)
        showNotesFromSubfolders: 'Show notes from subfolders',
        showFilesFromSubfolders: 'Show files from subfolders',
        showNotesFromDescendants: 'Show notes from descendants',
        showFilesFromDescendants: 'Show files from descendants',
        search: 'Search' // Tooltip for search button (English: Search)
    },
    // Search input
    searchInput: {
        placeholder: 'Search...', // Placeholder text for search input (English: Search...)
        placeholderOmnisearch: 'Omnisearch...', // Placeholder text when Omnisearch provider is active (English: Omnisearch...)
        clearSearch: 'Clear search', // Tooltip for clear search button (English: Clear search)
        switchToFilterSearch: 'Switch to filter search',
        switchToOmnisearch: 'Switch to Omnisearch',
        saveSearchShortcut: 'Save search shortcut',
        removeSearchShortcut: 'Remove search shortcut',
        shortcutModalTitle: 'Save search shortcut',
        shortcutNamePlaceholder: 'Enter shortcut name',
        shortcutStartIn: 'Always start in: {path}',
        searchHelp: 'Search syntax',
        searchHelpTitle: 'Search syntax',
        searchHelpModal: {
            intro: 'Combine file names, properties, tags, dates, and filters in one query (e.g., `meeting .status=active #work @thisweek`). Install the Omnisearch plugin to use full-text search.',
            introSwitching: 'Switch between filter search and Omnisearch using the up/down arrow keys or by clicking the search icon.',
            sections: {
                fileNames: {
                    title: 'File names',
                    items: [
                        '`word` Match notes with "word" in the file name.',
                        '`word1 word2` Require every word to match the file name.',
                        '`-word` Exclude notes with "word" in the file name.'
                    ]
                },
                tags: {
                    title: 'Tags',
                    items: [
                        '`#tag` Include notes with tag (also matches nested tags like `#tag/subtag`).',
                        '`#` Include only tagged notes.',
                        '`-#tag` Exclude notes with tag.',
                        '`-#` Include only untagged notes.',
                        '`#tag1 #tag2` Match both tags (implicit AND).',
                        '`#tag1 AND #tag2` Match both tags (explicit AND).',
                        '`#tag1 OR #tag2` Match either tag.',
                        '`#a OR #b AND #c` AND has higher precedence: matches `#a`, or both `#b` and `#c`.',
                        'Cmd/Ctrl+Click a tag to add with AND. Cmd/Ctrl+Shift+Click to add with OR.'
                    ]
                },
                properties: {
                    title: 'Properties',
                    items: [
                        '`.key` Include notes with property key.',
                        '`.key=value` Include notes with property value.',
                        '`."Reading Status"` Include notes with a property key that contains whitespace.',
                        '`."Reading Status"="In Progress"` Keys and values with whitespace must be double-quoted.',
                        '`-.key` Exclude notes with property key.',
                        '`-.key=value` Exclude notes with property value.',
                        'Cmd/Ctrl+Click a property to add with AND. Cmd/Ctrl+Shift+Click to add with OR.'
                    ]
                },
                tasks: {
                    title: 'Filters',
                    items: [
                        '`has:task` Include notes with unfinished tasks.',
                        '`-has:task` Exclude notes with unfinished tasks.',
                        '`folder:meetings` Include notes where a folder name contains `meetings`.',
                        '`folder:/work/meetings` Include notes only in `work/meetings` (not subfolders).',
                        '`folder:/` Include notes only in the vault root.',
                        '`-folder:archive` Exclude notes where a folder name contains `archive`.',
                        '`-folder:/archive` Exclude notes only in `archive` (not subfolders).',
                        '`ext:md` Include notes with extension `md` (`ext:.md` is also supported).',
                        '`-ext:pdf` Exclude notes with extension `pdf`.',
                        'Combine with tags, names, and dates (for example: `folder:/work/meetings ext:md @thisweek`).'
                    ]
                },
                connectors: {
                    title: 'AND/OR behavior',
                    items: [
                        '`AND` and `OR` are operators only in tag/property-only queries.',
                        'Tag/property-only queries contain only tag and property filters: `#tag`, `-#tag`, `#`, `-#`, `.key`, `-.key`, `.key=value`, `-.key=value`.',
                        'If a query includes names, dates (`@...`), task filters (`has:task`), folder filters (`folder:...`), or extension filters (`ext:...`), `AND` and `OR` are matched as words.',
                        'Example operator query: `#work OR .status=started`.',
                        'Example mixed query: `#work OR ext:md` (`OR` is matched in file names).'
                    ]
                },
                dates: {
                    title: 'Dates',
                    items: [
                        '`@today` Match notes from today using the default date field.',
                        '`@yesterday`, `@last7d`, `@last30d`, `@thisweek`, `@thismonth` Relative date ranges.',
                        '`@2026-02-07` Match a single day (also supports `@20260207`).',
                        '`@2026` Match a calendar year.',
                        '`@2026-02` or `@202602` Match a calendar month.',
                        '`@2026-W05` or `@2026W05` Match an ISO week.',
                        '`@2026-Q2` or `@2026Q2` Match a calendar quarter.',
                        '`@13/02/2026` Numeric formats with separators (`@07022026` follows your locale when ambiguous).',
                        '`@2026-02-01..2026-02-07` Match an inclusive day range (open ends supported).',
                        '`@c:...` or `@m:...` Target created or modified date.',
                        '`-@...` Exclude a date match.'
                    ]
                },
                omnisearch: {
                    title: 'Omnisearch',
                    items: [
                        'Full-text search across the vault, filtered to the current folder or selected tags.',
                        'Can be slow with fewer than 3 characters in large vaults.',
                        'Cannot search paths with non-ASCII characters or search subpaths correctly.',
                        'Returns limited results before folder filtering, so relevant files may not appear if many matches exist elsewhere.',
                        'Note previews show Omnisearch excerpts instead of the default preview text.'
                    ]
                }
            }
        }
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Open in new tab',
            openToRight: 'Open to the right',
            openInNewWindow: 'Open in new window',
            openMultipleInNewTabs: 'Open {count} notes in new tabs',
            openMultipleFilesInNewTabs: 'Open {count} files in new tabs',
            openMultipleToRight: 'Open {count} notes to the right',
            openMultipleFilesToRight: 'Open {count} files to the right',
            openMultipleInNewWindows: 'Open {count} notes in new windows',
            openMultipleFilesInNewWindows: 'Open {count} files in new windows',
            pinNote: 'Pin note',
            pinFile: 'Pin file',
            unpinNote: 'Unpin note',
            unpinFile: 'Unpin file',
            pinMultipleNotes: 'Pin {count} notes',
            pinMultipleFiles: 'Pin {count} files',
            unpinMultipleNotes: 'Unpin {count} notes',
            unpinMultipleFiles: 'Unpin {count} files',
            duplicateNote: 'Duplicate note',
            duplicateFile: 'Duplicate file',
            duplicateMultipleNotes: 'Duplicate {count} notes',
            duplicateMultipleFiles: 'Duplicate {count} files',
            openVersionHistory: 'Open version history',
            revealInFolder: 'Reveal in folder',
            revealInFinder: 'Reveal in Finder',
            showInExplorer: 'Show in system explorer',
            renameNote: 'Rename note',
            renameFile: 'Rename file',
            deleteNote: 'Delete note',
            deleteFile: 'Delete file',
            deleteMultipleNotes: 'Delete {count} notes',
            deleteMultipleFiles: 'Delete {count} files',
            moveNoteToFolder: 'Move note to...',
            moveFileToFolder: 'Move file to...',
            moveMultipleNotesToFolder: 'Move {count} notes to...',
            moveMultipleFilesToFolder: 'Move {count} files to...',
            addTag: 'Add tag',
            removeTag: 'Remove tag',
            removeAllTags: 'Remove all tags',
            changeIcon: 'Change icon',
            changeColor: 'Change color'
        },
        folder: {
            newNote: 'New note',
            newNoteFromTemplate: 'New note from template',
            newFolder: 'New folder',
            newCanvas: 'New canvas',
            newBase: 'New base',
            newDrawing: 'New drawing',
            newExcalidrawDrawing: 'New Excalidraw drawing',
            newTldrawDrawing: 'New Tldraw drawing',
            duplicateFolder: 'Duplicate folder',
            searchInFolder: 'Search in folder',
            createFolderNote: 'Create folder note',
            detachFolderNote: 'Detach folder note',
            deleteFolderNote: 'Delete folder note',
            changeIcon: 'Change icon',
            changeColor: 'Change color',
            changeBackground: 'Change background',
            excludeFolder: 'Hide folder',
            unhideFolder: 'Unhide folder',
            moveFolder: 'Move folder to...',
            renameFolder: 'Rename folder',
            deleteFolder: 'Delete folder'
        },
        tag: {
            changeIcon: 'Change icon',
            changeColor: 'Change color',
            changeBackground: 'Change background',
            showTag: 'Show tag',
            hideTag: 'Hide tag'
        },
        property: {
            addKey: 'Configure property keys',
            renameKey: 'Rename property',
            deleteKey: 'Delete property'
        },
        navigation: {
            addSeparator: 'Add separator',
            removeSeparator: 'Remove separator'
        },
        copyPath: {
            title: 'Copy path',
            asObsidianUrl: 'as Obsidian URL',
            fromVaultFolder: 'from vault folder',
            fromSystemRoot: 'from system root'
        },
        style: {
            title: 'Style',
            copy: 'Copy style',
            paste: 'Paste style',
            removeIcon: 'Remove icon',
            removeColor: 'Remove color',
            removeBackground: 'Remove background',
            clear: 'Clear style'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        standardPreset: 'Standard',
        compactPreset: 'Compact',
        defaultSuffix: '(default)',
        defaultLabel: 'Default',
        titleRows: 'Title rows',
        previewRows: 'Preview rows',
        groupBy: 'Group by',
        defaultTitleOption: (rows: number) => `Default title rows (${rows})`,
        defaultPreviewOption: (rows: number) => `Default preview rows (${rows})`,
        defaultGroupOption: (groupLabel: string) => `Default grouping (${groupLabel})`,
        titleRowOption: (rows: number) => `${rows} title row${rows === 1 ? '' : 's'}`,
        previewRowOption: (rows: number) => `${rows} preview row${rows === 1 ? '' : 's'}`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Search icons...',
            recentlyUsedHeader: 'Recently used',
            emptyStateSearch: 'Start typing to search icons',
            emptyStateNoResults: 'No icons found',
            showingResultsInfo: 'Showing 50 of {count} results. Type more to narrow down.',
            emojiInstructions: 'Type or paste any emoji to use it as an icon',
            removeIcon: 'Remove icon',
            removeFromRecents: 'Remove from recent icons',
            allTabLabel: 'All'
        },
        fileIconRuleEditor: {
            addRuleAria: 'Add rule'
        },
        interfaceIcons: {
            title: 'Interface icons',
            fileItemsSection: 'File items',
            items: {
                'nav-shortcuts': 'Shortcuts',
                'nav-recent-files': 'Recent files',
                'nav-expand-all': 'Expand all',
                'nav-collapse-all': 'Collapse all',
                'nav-calendar': 'Calendar',
                'nav-tree-expand': 'Tree chevron: expand',
                'nav-tree-collapse': 'Tree chevron: collapse',
                'nav-hidden-items': 'Hidden items',
                'nav-root-reorder': 'Reorder root folders',
                'nav-new-folder': 'New folder',
                'nav-show-single-pane': 'Show single pane',
                'nav-show-dual-pane': 'Show dual panes',
                'nav-profile-chevron': 'Profile menu chevron',
                'list-search': 'Search',
                'list-descendants': 'Notes from subfolders',
                'list-sort-ascending': 'Sort order: ascending',
                'list-sort-descending': 'Sort order: descending',
                'list-appearance': 'Change appearance',
                'list-new-note': 'New note',
                'nav-folder-open': 'Folder open',
                'nav-folder-closed': 'Folder closed',
                'nav-tags': 'Tags',
                'nav-tag': 'Tag',
                'nav-properties': 'Properties',
                'nav-property': 'Property',
                'nav-property-value': 'Value',
                'list-pinned': 'Pinned items',
                'file-unfinished-task': 'Unfinished tasks',
                'file-word-count': 'Word count'
            }
        },
        colorPicker: {
            currentColor: 'Current',
            newColor: 'New',
            paletteDefault: 'Default',
            paletteCustom: 'Custom',
            copyColors: 'Copy color',
            colorsCopied: 'Color copied to clipboard',
            pasteColors: 'Paste color',
            pasteClipboardError: 'Could not read clipboard',
            pasteInvalidFormat: 'Expected a hex color value',
            colorsPasted: 'Color pasted successfully',
            resetUserColors: 'Clear custom colors',
            clearCustomColorsConfirm: 'Remove all custom colors?',
            userColorSlot: 'Color {slot}',
            recentColors: 'Recent colors',
            clearRecentColors: 'Clear recent colors',
            removeRecentColor: 'Remove color',
            removeColor: 'Remove color',
            apply: 'Apply',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA'
        },
        selectVaultProfile: {
            title: 'Select vault profile',
            currentBadge: 'Active',
            emptyState: 'No vault profiles available.'
        },
        tagOperation: {
            renameTitle: 'Rename tag {tag}',
            deleteTitle: 'Delete tag {tag}',
            newTagPrompt: 'New tag name',
            newTagPlaceholder: 'Enter new tag name',
            renameWarning: 'Renaming tag {oldTag} will modify {count} {files}.',
            deleteWarning: 'Deleting tag {tag} will modify {count} {files}.',
            modificationWarning: 'This will update file modification dates.',
            affectedFiles: 'Affected files:',
            andMore: '...and {count} more',
            confirmRename: 'Rename tag',
            renameUnchanged: '{tag} unchanged',
            renameNoChanges: '{oldTag} → {newTag} ({countLabel})',
            renameBatchNotFinalized: 'Renamed {renamed}/{total}. Not updated: {notUpdated}. Metadata and shortcuts were not updated.',
            invalidTagName: 'Enter a valid tag name.',
            inlineParsingWarning: {
                title: 'Inline tag compatibility',
                message: '{tag} contains characters that Obsidian cannot parse in inline tags. Frontmatter tags are not affected.',
                confirm: 'Use anyway'
            },
            descendantRenameError: 'Cannot move a tag into itself or a descendant.',
            confirmDelete: 'Delete tag',
            deleteBatchNotFinalized: 'Removed from {removed}/{total}. Not updated: {notUpdated}. Metadata and shortcuts were not updated.',
            checkConsoleForDetails: 'Check console for details.',
            file: 'file',
            files: 'files'
        },
        propertyOperation: {
            renameTitle: 'Rename property {property}',
            deleteTitle: 'Delete property {property}',
            newKeyPrompt: 'New property name',
            newKeyPlaceholder: 'Enter new property name',
            renameWarning: 'Renaming property {property} will modify {count} {files}.',
            renameConflictWarning:
                'Property {newKey} already exists in {count} {files}. Renaming {oldKey} will replace existing {newKey} values.',
            deleteWarning: 'Deleting property {property} will modify {count} {files}.',
            confirmRename: 'Rename property',
            confirmDelete: 'Delete property',
            renameNoChanges: '{oldKey} → {newKey} (no changes)',
            renameSettingsUpdateFailed: 'Renamed property {oldKey} → {newKey}. Failed to update settings.',
            deleteSingleSuccess: 'Deleted property {property} from 1 note',
            deleteMultipleSuccess: 'Deleted property {property} from {count} notes',
            deleteSettingsUpdateFailed: 'Deleted property {property}. Failed to update settings.',
            invalidKeyName: 'Enter a valid property name.'
        },
        fileSystem: {
            newFolderTitle: 'New folder',
            renameFolderTitle: 'Rename folder',
            renameFileTitle: 'Rename file',
            deleteFolderTitle: "Delete '{name}'?",
            deleteFileTitle: "Delete '{name}'?",
            deleteFileAttachmentsTitle: 'Delete file attachments?',
            moveFileConflictTitle: 'Move conflict',
            folderNamePrompt: 'Enter folder name:',
            hideInOtherVaultProfiles: 'Hide in other vault profiles',
            renamePrompt: 'Enter new name:',
            renameVaultTitle: 'Change vault display name',
            renameVaultPrompt: 'Enter custom display name (leave empty to use default):',
            deleteFolderConfirm: 'Are you sure you want to delete this folder and all its contents?',
            deleteFileConfirm: 'Are you sure you want to delete this file?',
            deleteFileAttachmentsDescriptionSingle: 'This attachment is no longer used in any notes. Would you like to delete it?',
            deleteFileAttachmentsDescriptionMultiple: 'These attachments are no longer used in any notes. Would you like to delete them?',
            deleteFileAttachmentsViewFileTreeAriaLabel: 'File tree',
            deleteFileAttachmentsViewGalleryAriaLabel: 'Gallery',
            moveFileConflictDescriptionSingle: 'A file conflict was found in "{folder}".',
            moveFileConflictDescriptionMultiple: '{count} file conflicts were found in "{folder}".',
            moveFileConflictAffectedFiles: 'Affected files',
            moveFileConflictItem: '"{name}" -> "{suggested}"{renameOnly}',
            moveFileConflictRenameOnly: '(rename only)',
            moveFileConflictRename: 'Rename',
            moveFileConflictOverwrite: 'Overwrite',
            removeAllTagsTitle: 'Remove all tags',
            removeAllTagsFromNote: 'Are you sure you want to remove all tags from this note?',
            removeAllTagsFromNotes: 'Are you sure you want to remove all tags from {count} notes?'
        },
        folderNoteType: {
            title: 'Select folder note type',
            folderLabel: 'Folder: {name}'
        },
        folderSuggest: {
            placeholder: (name: string) => `Move ${name} to folder...`,
            multipleFilesLabel: (count: number) => `${count} files`,
            navigatePlaceholder: 'Navigate to folder...',
            instructions: {
                navigate: 'to navigate',
                move: 'to move',
                select: 'to select',
                dismiss: 'to dismiss'
            }
        },
        homepage: {
            placeholder: 'Search files...',
            instructions: {
                navigate: 'to navigate',
                select: 'to set homepage',
                dismiss: 'to dismiss'
            }
        },
        calendarTemplate: {
            placeholder: 'Search templates...',
            instructions: {
                navigate: 'to navigate',
                select: 'to select template',
                dismiss: 'to dismiss'
            }
        },
        navigationBanner: {
            placeholder: 'Search images...',
            instructions: {
                navigate: 'to navigate',
                select: 'to set banner',
                dismiss: 'to dismiss'
            }
        },
        tagSuggest: {
            navigatePlaceholder: 'Navigate to tag...',
            addPlaceholder: 'Search for tag to add...',
            removePlaceholder: 'Select tag to remove...',
            createNewTag: 'Create new tag: #{tag}',
            instructions: {
                navigate: 'to navigate',
                select: 'to select',
                dismiss: 'to dismiss',
                add: 'to add tag',
                remove: 'to remove tag'
            }
        },
        propertySuggest: {
            placeholder: 'Select property key...',
            navigatePlaceholder: 'Navigate to property...',
            instructions: {
                navigate: 'to navigate',
                select: 'to add property',
                dismiss: 'to dismiss'
            }
        },
        propertyKeyVisibility: {
            title: 'Property key visibility',
            searchPlaceholder: 'Search property keys...',
            propertyColumnLabel: 'Property',
            showInNavigation: 'Show in navigation',
            showInList: 'Show in list',
            toggleAllInNavigation: 'Toggle all in navigation',
            toggleAllInList: 'Toggle all in list',
            applyButton: 'Apply',
            emptyState: 'No property keys found.'
        },
        welcome: {
            title: 'Welcome to {pluginName}',
            introText:
                'Hi there! Before you start, I highly recommend that you watch the first five minutes of the video below to understand how the panes and the toggle "Show notes from subfolders" works.',
            continueText:
                'If you have five more minutes then continue watching the video to understand the compact display modes and how to properly set up shortcuts and important hotkeys.',
            thanksText: 'Thank you so much for downloading, and enjoy!',
            videoAlt: 'Installing and mastering Notebook Navigator',
            openVideoButton: 'Play video',
            closeButton: 'Maybe later'
        }
    },
    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Failed to create folder: {error}',
            createFile: 'Failed to create file: {error}',
            renameFolder: 'Failed to rename folder: {error}',
            renameFolderNoteConflict: 'Cannot rename: "{name}" already exists in this folder',
            renameFile: 'Failed to rename file: {error}',
            deleteFolder: 'Failed to delete folder: {error}',
            deleteFile: 'Failed to delete file: {error}',
            deleteAttachments: 'Failed to delete attachments: {error}',
            duplicateNote: 'Failed to duplicate note: {error}',
            duplicateFolder: 'Failed to duplicate folder: {error}',
            openVersionHistory: 'Failed to open version history: {error}',
            versionHistoryNotFound: 'Version history command not found. Ensure Obsidian Sync is enabled.',
            revealInExplorer: 'Failed to reveal file in system explorer: {error}',
            folderNoteAlreadyExists: 'Folder note already exists',
            folderAlreadyExists: 'Folder "{name}" already exists',
            folderNotesDisabled: 'Enable folder notes in settings to convert files',
            folderNoteAlreadyLinked: 'This file already acts as a folder note',
            folderNoteNotFound: 'No folder note in selected folder',
            folderNoteUnsupportedExtension: 'Unsupported file extension: {extension}',
            folderNoteMoveFailed: 'Failed to move file during conversion: {error}',
            folderNoteRenameConflict: 'A file named "{name}" already exists in the folder',
            folderNoteConversionFailed: 'Failed to convert file to folder note',
            folderNoteConversionFailedWithReason: 'Failed to convert file to folder note: {error}',
            folderNoteOpenFailed: 'Converted file but failed to open folder note: {error}',
            failedToDeleteFile: 'Failed to delete {name}: {error}',
            failedToDeleteMultipleFiles: 'Failed to delete {count} files',
            versionHistoryNotAvailable: 'Version history service not available',
            drawingAlreadyExists: 'A drawing with this name already exists',
            failedToCreateDrawing: 'Failed to create drawing',
            noFolderSelected: 'No folder is selected in Notebook Navigator',
            noFileSelected: 'No file is selected'
        },
        warnings: {
            linkBreakingNameCharacters: 'This name includes characters that break Obsidian links: #, |, ^, %%, [[, ]].',
            forbiddenNameCharactersAllPlatforms: 'Names cannot start with a period or include : or /.',
            forbiddenNameCharactersWindows: 'Windows-reserved characters are not allowed: <, >, ", \\, |, ?, *.'
        },
        notices: {
            hideFolder: 'Folder hidden: {name}',
            showFolder: 'Folder shown: {name}'
        },
        notifications: {
            deletedMultipleFiles: 'Deleted {count} files',
            movedMultipleFiles: 'Moved {count} files to {folder}',
            folderNoteConversionSuccess: 'Converted file to folder note in "{name}"',
            folderMoved: 'Moved folder "{name}"',
            deepLinkCopied: 'Obsidian URL copied to clipboard',
            pathCopied: 'Path copied to clipboard',
            relativePathCopied: 'Relative path copied to clipboard',
            tagAddedToNote: 'Added tag to 1 note',
            tagAddedToNotes: 'Added tag to {count} notes',
            tagRemovedFromNote: 'Removed tag from 1 note',
            tagRemovedFromNotes: 'Removed tag from {count} notes',
            tagsClearedFromNote: 'Cleared all tags from 1 note',
            tagsClearedFromNotes: 'Cleared all tags from {count} notes',
            noTagsToRemove: 'No tags to remove',
            noFilesSelected: 'No files selected',
            tagOperationsNotAvailable: 'Tag operations not available',
            propertyOperationsNotAvailable: 'Property operations not available',
            tagsRequireMarkdown: 'Tags are only supported on Markdown notes',
            propertiesRequireMarkdown: 'Properties are only supported on Markdown notes',
            propertySetOnNote: 'Updated property on 1 note',
            propertySetOnNotes: 'Updated property on {count} notes',
            iconPackDownloaded: '{provider} downloaded',
            iconPackUpdated: '{provider} updated ({version})',
            iconPackRemoved: '{provider} removed',
            iconPackLoadFailed: 'Failed to load {provider}',
            hiddenFileReveal: 'File is hidden. Enable "Show hidden items" to display it'
        },
        confirmations: {
            deleteMultipleFiles: 'Are you sure you want to delete {count} files?',
            deleteConfirmation: 'This action cannot be undone.'
        },
        defaultNames: {
            untitled: 'Untitled'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Cannot move a folder into itself or a subfolder.',
            itemAlreadyExists: 'An item named "{name}" already exists in this location.',
            failedToMove: 'Failed to move: {error}',
            failedToAddTag: 'Failed to add tag "{tag}"',
            failedToSetProperty: 'Failed to update property: {error}',
            failedToClearTags: 'Failed to clear tags',
            failedToMoveFolder: 'Failed to move folder "{name}"',
            failedToImportFiles: 'Failed to import: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} files already exist in destination',
            filesAlreadyHaveTag: '{count} files already have this tag or a more specific one',
            filesAlreadyHaveProperty: '{count} files already have this property',
            noTagsToClear: 'No tags to clear',
            fileImported: 'Imported 1 file',
            filesImported: 'Imported {count} files'
        }
    },

    // Date grouping
    dateGroups: {
        today: 'Today',
        yesterday: 'Yesterday',
        previous7Days: 'Previous 7 days',
        previous30Days: 'Previous 30 days'
    },

    // Plugin commands
    commands: {
        open: 'Open', // Command palette: Opens the Notebook Navigator view (English: Open)
        toggleLeftSidebar: 'Toggle left sidebar', // Command palette: Toggles left sidebar, opening Notebook Navigator when uncollapsing (English: Toggle left sidebar)
        openHomepage: 'Open homepage', // Command palette: Opens the Notebook Navigator view and loads the homepage file (English: Open homepage)
        openDailyNote: 'Open daily note',
        openWeeklyNote: 'Open weekly note',
        openMonthlyNote: 'Open monthly note',
        openQuarterlyNote: 'Open quarterly note',
        openYearlyNote: 'Open yearly note',
        revealFile: 'Reveal file', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        search: 'Search', // Command palette: Toggle search in the file list (English: Search)
        searchVaultRoot: 'Search in vault root', // Command palette: Selects the vault root folder and focuses search (English: Search in vault root)
        toggleDualPane: 'Toggle dual pane layout', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        toggleCalendar: 'Toggle calendar', // Command palette: Toggles showing the calendar overlay in the navigation pane (English: Toggle calendar)
        selectVaultProfile: 'Select vault profile', // Command palette: Opens a modal to choose a different vault profile (English: Select vault profile)
        selectVaultProfile1: 'Select vault profile 1', // Command palette: Activates the first vault profile without opening the modal (English: Select vault profile 1)
        selectVaultProfile2: 'Select vault profile 2', // Command palette: Activates the second vault profile without opening the modal (English: Select vault profile 2)
        selectVaultProfile3: 'Select vault profile 3', // Command palette: Activates the third vault profile without opening the modal (English: Select vault profile 3)
        deleteFile: 'Delete files', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: 'Create new note', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        createNewNoteFromTemplate: 'Create new note from template', // Command palette: Creates a new note from a template in the currently selected folder (English: Create new note from template)
        moveFiles: 'Move files', // Command palette: Move selected files to another folder (English: Move files)
        selectNextFile: 'Select next file', // Command palette: Selects the next file in the current view (English: Select next file)
        selectPreviousFile: 'Select previous file', // Command palette: Selects the previous file in the current view (English: Select previous file)
        convertToFolderNote: 'Convert to folder note', // Command palette: Converts the active file into a folder note with a new folder (English: Convert to folder note)
        setAsFolderNote: 'Set as folder note', // Command palette: Renames the active file to its folder note name (English: Set as folder note)
        detachFolderNote: 'Detach folder note', // Command palette: Renames the active folder note to a new name (English: Detach folder note)
        pinAllFolderNotes: 'Pin all folder notes', // Command palette: Pins all folder notes to shortcuts (English: Pin all folder notes)
        navigateToFolder: 'Navigate to folder', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: 'Navigate to tag', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        navigateToProperty: 'Navigate to property', // Command palette: Navigate to a property key or value using fuzzy search (English: Navigate to property)
        addShortcut: 'Add to shortcuts', // Command palette: Adds or removes the current file, folder, tag, or property from shortcuts (English: Add to shortcuts)
        openShortcut: 'Open shortcut {number}', // Command palette: Opens a shortcut by its position (English: Open shortcut {number})
        toggleDescendants: 'Toggle descendants', // Command palette: Toggles showing notes from descendants (English: Toggle descendants)
        toggleHidden: 'Toggle hidden folders, tags, and notes', // Command palette: Toggles showing hidden items (English: Toggle hidden items)
        toggleTagSort: 'Toggle tag sort order', // Command palette: Toggles between alphabetical and frequency tag sorting (English: Toggle tag sort order)
        toggleCompactMode: 'Toggle compact mode', // Command palette: Toggles list mode between standard and compact (English: Toggle compact mode)
        collapseExpand: 'Collapse / expand all items', // Command palette: Collapse or expand all folders and tags (English: Collapse / expand all items)
        addTag: 'Add tag to selected files', // Command palette: Opens a dialog to add a tag to selected files (English: Add tag to selected files)
        removeTag: 'Remove tag from selected files', // Command palette: Opens a dialog to remove a tag from selected files (English: Remove tag from selected files)
        removeAllTags: 'Remove all tags from selected files', // Command palette: Removes all tags from selected files (English: Remove all tags from selected files)
        openAllFiles: 'Open all files', // Command palette: Opens all files in the current folder or tag (English: Open all files)
        rebuildCache: 'Rebuild cache' // Command palette: Rebuilds the local Notebook Navigator cache (English: Rebuild cache)
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator', // Name shown in the view header/tab (English: Notebook Navigator)
        calendarViewName: 'Calendar', // Name shown in the view header/tab
        ribbonTooltip: 'Notebook Navigator', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Reveal in Notebook Navigator' // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Last modified at',
        createdAt: 'Created at',
        file: 'file',
        files: 'files',
        folder: 'folder',
        folders: 'folders'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: 'Failed metadata report exported to: {filename}',
            exportFailed: 'Failed to export metadata report'
        },
        sections: {
            general: 'General',
            navigationPane: 'Navigation',
            calendar: 'Calendar',
            files: 'Files',
            icons: 'Icon packs',
            folders: 'Folders',
            folderNotes: 'Folder notes',
            foldersAndTags: 'Folders',
            tagsAndProperties: 'Tags & properties',
            tags: 'Tags',
            listPane: 'List',
            notes: 'Notes',
            advanced: 'Advanced'
        },
        groups: {
            general: {
                vaultProfiles: 'Vault profiles',
                filtering: 'Filtering',
                templates: 'Templates',
                behavior: 'Behavior',
                keyboardNavigation: 'Keyboard navigation',
                view: 'Appearance',
                icons: 'Icons',
                desktopAppearance: 'Desktop appearance',
                mobileAppearance: 'Mobile appearance',
                formatting: 'Formatting'
            },
            navigation: {
                appearance: 'Appearance',
                leftSidebar: 'Left sidebar',
                calendarIntegration: 'Calendar integration'
            },
            list: {
                display: 'Appearance',
                pinnedNotes: 'Pinned notes'
            },
            notes: {
                frontmatter: 'Frontmatter',
                icon: 'Icon',
                title: 'Title',
                previewText: 'Preview text',
                featureImage: 'Feature image',
                tags: 'Tags',
                properties: 'Properties',
                date: 'Date',
                parentFolder: 'Parent folder'
            }
        },
        syncMode: {
            notSynced: '(not synced)',
            disabled: '(disabled)',
            switchToSynced: 'Enable sync',
            switchToLocal: 'Disable sync'
        },
        items: {
            listPaneTitle: {
                name: 'List pane title',
                desc: 'Choose where the list pane title is shown.',
                options: {
                    header: 'Show in header',
                    list: 'Show in list pane',
                    hidden: 'Do not show'
                }
            },
            sortNotesBy: {
                name: 'Sort notes by',
                desc: 'Choose how notes are sorted in the note list.',
                options: {
                    'modified-desc': 'Date edited (newest on top)',
                    'modified-asc': 'Date edited (oldest on top)',
                    'created-desc': 'Date created (newest on top)',
                    'created-asc': 'Date created (oldest on top)',
                    'title-asc': 'Title (A on top)',
                    'title-desc': 'Title (Z on top)',
                    'filename-asc': 'File name (A on top)',
                    'filename-desc': 'File name (Z on top)',
                    'property-asc': 'Property (A on top)',
                    'property-desc': 'Property (Z on top)'
                },
                propertyOverride: {
                    asc: 'Property ‘{property}’ (A on top)',
                    desc: 'Property ‘{property}’ (Z on top)'
                }
            },
            propertySortKey: {
                name: 'Property to sort by',
                desc: 'Used with Property sort. Notes with this frontmatter property are listed first and sorted by the property value. Arrays are joined into one value.',
                placeholder: 'order'
            },
            propertySortSecondary: {
                name: 'Secondary sort',
                desc: 'Used with Property sort when notes have the same property value or no property value.',
                options: {
                    title: 'Title',
                    filename: 'File name',
                    created: 'Date created',
                    modified: 'Date edited'
                }
            },
            revealFileOnListChanges: {
                name: 'Scroll to selected file on list changes',
                desc: 'Scroll to the selected file when pinning notes, showing descendant notes, changing folder appearance, or running file operations.'
            },
            includeDescendantNotes: {
                name: 'Show notes from subfolders / descendants',
                desc: 'Include notes from nested subfolders and tag descendants when viewing a folder or tag.'
            },
            limitPinnedToCurrentFolder: {
                name: 'Limit pinned notes to their folder',
                desc: 'Pinned notes appear only when viewing the folder or tag where they were pinned.'
            },
            separateNoteCounts: {
                name: 'Show current and descendant counts separately',
                desc: 'Display note counts as "current ▾ descendants" format in folders and tags.'
            },
            groupNotes: {
                name: 'Group notes',
                desc: 'Display headers between notes grouped by date or folder. Tag views use date groups when folder grouping is enabled.',
                options: {
                    none: "Don't group",
                    date: 'Group by date',
                    folder: 'Group by folder'
                }
            },
            showPinnedGroupHeader: {
                name: 'Show pinned group header',
                desc: 'Display the pinned section header above pinned notes.'
            },
            showPinnedIcon: {
                name: 'Show pinned icon',
                desc: 'Show the icon next to the pinned section header.'
            },
            defaultListMode: {
                name: 'Default list mode',
                desc: 'Select the default list layout. Standard shows title, date, description, and preview text. Compact shows title only. Override appearance per folder.',
                options: {
                    standard: 'Standard',
                    compact: 'Compact'
                }
            },
            showFileIcons: {
                name: 'Show file icons',
                desc: 'Display file icons with left-aligned spacing. Disabling removes both icons and indentation. Priority: unfinished tasks icon > custom icon > file name icon > file type icon > default icon.'
            },
            showFileIconUnfinishedTask: {
                name: 'Unfinished tasks icon',
                desc: 'Display a task icon when a note has unfinished tasks.'
            },
            showFilenameMatchIcons: {
                name: 'Icons by file name',
                desc: 'Assign icons to files based on text in their names.'
            },
            fileNameIconMap: {
                name: 'File name icon map',
                desc: 'Files containing the text get the specified icon. One mapping per line: text=icon',
                placeholder: '# Text=icon\nmeeting=LiCalendar\ninvoice=PhReceipt',
                editTooltip: 'Edit mappings'
            },
            showCategoryIcons: {
                name: 'Icons by file type',
                desc: 'Assign icons to files based on their extension.'
            },
            fileTypeIconMap: {
                name: 'File type icon map',
                desc: 'Files with the extension get the specified icon. One mapping per line: extension=icon',
                placeholder: '# Extension=icon\ncpp=LiFileCode\npdf=RaBook',
                editTooltip: 'Edit mappings'
            },
            optimizeNoteHeight: {
                name: 'Variable note height',
                desc: 'Use compact height for pinned notes and notes without preview text.'
            },
            compactItemHeight: {
                name: 'Compact item height',
                desc: 'Set the height of compact list items on desktop and mobile.',
                resetTooltip: 'Restore to default (28px)'
            },
            compactItemHeightScaleText: {
                name: 'Scale text with compact item height',
                desc: 'Scale compact list text when the item height is reduced.'
            },
            showParentFolder: {
                name: 'Show parent folder',
                desc: 'Display the parent folder name for notes in subfolders or tags.'
            },
            parentFolderClickRevealsFile: {
                name: 'Click parent folder to go to folder',
                desc: 'Clicking the parent folder label opens the folder in list pane.'
            },
            showParentFolderColor: {
                name: 'Show parent folder color',
                desc: 'Use folder colors on parent folder labels.'
            },
            showParentFolderIcon: {
                name: 'Show parent folder icon',
                desc: 'Show folder icons next to parent folder labels.'
            },
            showQuickActions: {
                name: 'Show quick actions',
                desc: 'Show action buttons when hovering over files. Button controls select which actions appear.'
            },
            dualPane: {
                name: 'Dual pane layout',
                desc: 'Show navigation pane and list pane side by side on desktop.'
            },
            dualPaneOrientation: {
                name: 'Dual pane orientation',
                desc: 'Choose horizontal or vertical layout when dual pane is active.',
                options: {
                    horizontal: 'Horizontal split',
                    vertical: 'Vertical split'
                }
            },
            appearanceBackground: {
                name: 'Background color',
                desc: 'Choose background colors for navigation and list panes.',
                options: {
                    separate: 'Separate backgrounds',
                    primary: 'Use list background',
                    secondary: 'Use navigation background'
                }
            },
            appearanceScale: {
                name: 'Zoom level',
                desc: 'Controls the overall zoom level of Notebook Navigator.'
            },
            useFloatingToolbars: {
                name: 'Use floating toolbars on iOS/iPadOS',
                desc: 'Applies to Obsidian 1.11 and later.'
            },
            startView: {
                name: 'Default startup view',
                desc: 'Choose which pane to display when opening Notebook Navigator. Navigation pane shows shortcuts, recent notes, and folder tree. List pane shows note list immediately.',
                options: {
                    navigation: 'Navigation pane',
                    files: 'List pane'
                }
            },
            toolbarButtons: {
                name: 'Toolbar buttons',
                desc: 'Choose which buttons appear in the toolbar. Hidden buttons remain accessible via commands and menus.',
                navigationLabel: 'Navigation toolbar',
                listLabel: 'List toolbar'
            },
            createNewNotesInNewTab: {
                name: 'Open new notes in new tab',
                desc: 'When enabled, the Create new note command opens notes in a new tab. When disabled, notes replace the current tab.'
            },
            autoRevealActiveNote: {
                name: 'Auto-reveal active note',
                desc: 'Automatically reveal notes when opened from Quick Switcher, links, or search.'
            },
            autoRevealShortestPath: {
                name: 'Use shortest path',
                desc: "Enabled: Auto-reveal selects the nearest visible ancestor folder or tag. Disabled: Auto-reveal selects the file's actual folder and exact tag."
            },
            autoRevealIgnoreRightSidebar: {
                name: 'Ignore events from right sidebar',
                desc: 'Do not change active note when clicking or changing notes in the right sidebar.'
            },
            paneTransitionDuration: {
                name: 'Single pane animation',
                desc: 'Transition duration when switching panes in single-pane mode (milliseconds).',
                resetTooltip: 'Reset to default'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Auto-select first note',
                desc: 'Automatically open the first note when switching folders or tags.'
            },
            skipAutoScroll: {
                name: 'Disable auto-scroll for shortcuts',
                desc: "Don't scroll the navigation pane when clicking items in shortcuts."
            },
            autoExpandNavItems: {
                name: 'Expand on selection',
                desc: 'Expand folders, tags, and properties when selected. In single pane mode, first selection expands, second selection shows files.'
            },
            springLoadedFolders: {
                name: 'Spring-loaded folders',
                desc: 'Expand folders and tags on hover during drag operations.'
            },
            springLoadedFoldersInitialDelay: {
                name: 'First expand delay',
                desc: 'Delay before the first folder or tag expands during a drag operation (seconds).'
            },
            springLoadedFoldersSubsequentDelay: {
                name: 'Subsequent expand delay',
                desc: 'Delay before expanding additional folders or tags during the same drag operation (seconds).'
            },
            navigationBanner: {
                name: 'Navigation banner (vault profile)',
                desc: 'Display an image above the navigation pane. Changes with the selected vault profile.',
                current: 'Current banner: {path}',
                chooseButton: 'Choose image'
            },
            pinNavigationBanner: {
                name: 'Pin banner',
                desc: 'Pin the navigation banner above the navigation tree.'
            },
            showShortcuts: {
                name: 'Show shortcuts',
                desc: 'Display the shortcuts section in the navigation pane.'
            },
            shortcutBadgeDisplay: {
                name: 'Shortcut badge',
                desc: "What to display next to shortcuts. Use 'Open shortcut 1-9' commands to open shortcuts directly.",
                options: {
                    index: 'Position (1-9)',
                    count: 'Item counts',
                    none: 'None'
                }
            },
            showRecentNotes: {
                name: 'Show recent notes',
                desc: 'Display the recent notes section in the navigation pane.'
            },
            hideRecentNotes: {
                name: 'Hide notes',
                desc: 'Choose which note types to hide in the recent notes section.',
                options: {
                    none: 'None',
                    folderNotes: 'Folder notes'
                }
            },
            recentNotesCount: {
                name: 'Recent notes count',
                desc: 'Number of recent notes to display.'
            },
            pinRecentNotesWithShortcuts: {
                name: 'Pin recent notes with shortcuts',
                desc: 'Include recent notes when shortcuts are pinned.'
            },
            calendarPlacement: {
                name: 'Calendar placement',
                desc: 'Display in the left or right sidebar.',
                options: {
                    leftSidebar: 'Left sidebar',
                    rightSidebar: 'Right sidebar'
                }
            },
            calendarLeftPlacement: {
                name: 'Single pane placement',
                desc: 'Where the calendar is shown in single pane mode.',
                options: {
                    navigationPane: 'Navigation pane',
                    below: 'Below panes'
                }
            },
            calendarLocale: {
                name: 'Locale',
                desc: 'Controls week numbering and first day of the week.',
                options: {
                    systemDefault: 'Default'
                }
            },
            calendarWeekendDays: {
                name: 'Weekend days',
                desc: 'Show weekend days with a different background color.',
                options: {
                    none: 'None',
                    satSun: 'Saturday and Sunday',
                    friSat: 'Friday and Saturday',
                    thuFri: 'Thursday and Friday'
                }
            },
            showInfoButtons: {
                name: 'Show info buttons',
                desc: 'Display info buttons in the search bar and calendar header.'
            },
            calendarWeeksToShow: {
                name: 'Weeks to show in left sidebar',
                desc: 'Calendar in the right sidebar always displays the full month.',
                options: {
                    fullMonth: 'Full month',
                    oneWeek: '1 week',
                    weeksCount: '{count} weeks'
                }
            },
            calendarHighlightToday: {
                name: "Highlight today's date",
                desc: "Highlight today's date with a background color and bold text."
            },
            calendarShowFeatureImage: {
                name: 'Show feature image',
                desc: 'Display feature images for notes in the calendar.'
            },
            calendarShowWeekNumber: {
                name: 'Show week number',
                desc: 'Add a column with the week number.'
            },
            calendarShowQuarter: {
                name: 'Show quarter',
                desc: 'Add a quarter label in the calendar header.'
            },
            calendarShowYearCalendar: {
                name: 'Show year calendar',
                desc: 'Display year navigation and month grid in the right sidebar.'
            },
            calendarConfirmBeforeCreate: {
                name: 'Confirm before creating new note',
                desc: 'Show a confirmation dialog when creating a new daily note.'
            },
            calendarIntegrationMode: {
                name: 'Daily note source',
                desc: 'Source for calendar notes.',
                options: {
                    dailyNotes: 'Daily notes (core plug-in)',
                    notebookNavigator: 'Notebook Navigator'
                },
                info: {
                    dailyNotes: 'Folder and date format are configured in the Daily Notes core plugin.'
                }
            },

            calendarCustomRootFolder: {
                name: 'Root folder (vault profile)',
                desc: 'Base folder for periodic notes. Date patterns can include subfolders. Changes with the selected vault profile.',
                placeholder: 'Personal/Diary'
            },
            calendarTemplateFolder: {
                name: 'Template folder location',
                desc: 'Template file picker shows notes from this folder.',
                placeholder: 'Templates'
            },
            calendarCustomFilePattern: {
                name: 'Daily notes',
                desc: 'Format path using Moment date format. Wrap subfolder names in brackets, e.g., [Work]/YYYY. Click template icon to set template. Set template folder location in General > Templates.',
                momentDescPrefix: 'Format path using ',
                momentLinkText: 'Moment date format',
                momentDescSuffix:
                    '. Wrap subfolder names in brackets, e.g., [Work]/YYYY. Click template icon to set template. Set template folder location in General > Templates.',
                placeholder: 'YYYY/YYYYMMDD',
                example: 'Current syntax: {path}',
                parsingError: 'Pattern must format and parse back to a full date (year, month, day).'
            },
            calendarCustomWeekPattern: {
                name: 'Weekly notes',
                parsingError: 'Pattern must format and parse back to a full week (week year, week number).'
            },
            calendarCustomMonthPattern: {
                name: 'Monthly notes',
                parsingError: 'Pattern must format and parse back to a full month (year, month).'
            },
            calendarCustomQuarterPattern: {
                name: 'Quarterly notes',
                parsingError: 'Pattern must format and parse back to a full quarter (year, quarter).'
            },
            calendarCustomYearPattern: {
                name: 'Yearly notes',
                parsingError: 'Pattern must format and parse back to a full year (year).'
            },
            calendarTemplateFile: {
                current: 'Template file: {name}'
            },
            showTooltips: {
                name: 'Show tooltips',
                desc: 'Display hover tooltips with additional information for notes and folders.'
            },
            showTooltipPath: {
                name: 'Show path',
                desc: 'Display the folder path below note names in tooltips.'
            },
            resetPaneSeparator: {
                name: 'Reset pane separator position',
                desc: 'Reset the draggable separator between navigation pane and list pane to default position.',
                buttonText: 'Reset separator',
                notice: 'Separator position reset. Restart Obsidian or reopen Notebook Navigator to apply.'
            },
            resetAllSettings: {
                name: 'Reset all settings',
                desc: 'Reset all Notebook Navigator settings to default values.',
                buttonText: 'Reset all settings',
                confirmTitle: 'Reset all settings?',
                confirmMessage: 'This will reset all Notebook Navigator settings to their default values. This cannot be undone.',
                confirmButtonText: 'Reset all settings',
                notice: 'All settings reset. Restart Obsidian or reopen Notebook Navigator to apply.',
                error: 'Failed to reset settings.'
            },
            multiSelectModifier: {
                name: 'Multi-select modifier',
                desc: 'Choose which modifier key toggles multi-selection. When Option/Alt is selected, Cmd/Ctrl click opens notes in a new tab.',
                options: {
                    cmdCtrl: 'Cmd/Ctrl click',
                    optionAlt: 'Option/Alt click'
                }
            },
            enterToOpenFiles: {
                name: 'Press Enter to open files',
                desc: 'Open files only when pressing Enter during list keyboard navigation.'
            },
            shiftEnterOpenContext: {
                name: 'Shift+Enter',
                desc: 'Open selected file in a new tab, split, or window when pressing Shift+Enter.'
            },
            cmdEnterOpenContext: {
                name: 'Cmd+Enter',
                desc: 'Open selected file in a new tab, split, or window when pressing Cmd+Enter.'
            },
            ctrlEnterOpenContext: {
                name: 'Ctrl+Enter',
                desc: 'Open selected file in a new tab, split, or window when pressing Ctrl+Enter.'
            },
            fileVisibility: {
                name: 'Show file types (vault profile)',
                desc: 'Filter which file types are shown in the navigator. File types not supported by Obsidian may open in external applications.',
                options: {
                    documents: 'Documents (.md, .canvas, .base)',
                    supported: 'Supported (opens in Obsidian)',
                    all: 'All (may open externally)'
                }
            },
            homepage: {
                name: 'Homepage',
                desc: 'Choose the file that Notebook Navigator opens automatically, such as a dashboard.',
                current: 'Current: {path}',
                currentMobile: 'Mobile: {path}',
                chooseButton: 'Choose file',
                separateMobile: {
                    name: 'Separate mobile homepage',
                    desc: 'Use a different homepage for mobile devices.'
                }
            },
            excludedNotes: {
                name: 'Hide notes with property rules (vault profile)',
                desc: 'Comma-separated list of frontmatter rules. Use `key` or `key=value` entries (e.g., status=done, published=true, archived).',
                placeholder: 'status=done, published=true, archived'
            },
            excludedFileNamePatterns: {
                name: 'Hide files (vault profile)',
                desc: 'Comma-separated list of filename patterns to hide. Supports * wildcards and / paths (e.g., temp-*, *.png, /assets/*).',
                placeholder: 'temp-*, *.png, /assets/*'
            },
            vaultProfiles: {
                name: 'Vault profile',
                desc: 'Profiles store file type visibility, hidden files, hidden folders, hidden tags, hidden notes, shortcuts, and navigation banner. Switch profiles from the navigation pane header.',
                defaultName: 'Default',
                addButton: 'Add profile',
                editProfilesButton: 'Edit profiles',
                addProfileOption: 'Add profile...',
                applyButton: 'Apply',
                deleteButton: 'Delete profile',
                addModalTitle: 'Add profile',
                editProfilesModalTitle: 'Edit profiles',
                addModalPlaceholder: 'Profile name',
                deleteModalTitle: 'Delete {name}',
                deleteModalMessage: 'Remove {name}? Hidden file, folder, tag, and note filters saved in this profile will be deleted.',
                moveUp: 'Move up',
                moveDown: 'Move down',
                errors: {
                    emptyName: 'Enter a profile name',
                    duplicateName: 'Profile name already exists'
                }
            },
            vaultTitle: {
                name: 'Vault title placement',
                desc: 'Choose where the vault title is shown.',
                options: {
                    header: 'Show in header',
                    navigation: 'Show in navigation pane'
                }
            },
            excludedFolders: {
                name: 'Hide folders (vault profile)',
                desc: 'Comma-separated list of folders to hide. Name patterns: assets* (folders starting with assets), *_temp (ending with _temp). Path patterns: /archive (root archive only), /res* (root folders starting with res), /*/temp (temp folders one level deep), /projects/* (all folders inside projects).',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            showFileDate: {
                name: 'Show date',
                desc: 'Display the date below note names.'
            },
            alphabeticalDateMode: {
                name: 'When sorting by name',
                desc: 'Date to show when notes are alphabetically sorted.',
                options: {
                    created: 'Created date',
                    modified: 'Modified date'
                }
            },
            showFileTags: {
                name: 'Show file tags',
                desc: 'Display clickable tags in file items.'
            },
            showFileTagAncestors: {
                name: 'Show full tag paths',
                desc: "Display complete tag hierarchy paths. When enabled: 'ai/openai', 'work/projects/2024'. When disabled: 'openai', '2024'."
            },
            colorFileTags: {
                name: 'Color file tags',
                desc: 'Apply tag colors to tag badges on file items.'
            },
            prioritizeColoredFileTags: {
                name: 'Show colored tags first',
                desc: 'Sort colored tags before other tags on file items.'
            },
            showFileTagsInCompactMode: {
                name: 'Show file tags in compact mode',
                desc: 'Display tags when date, preview, and image are hidden.'
            },
            showFileProperties: {
                name: 'Show file properties',
                desc: 'Display clickable properties in file items.'
            },
            colorFileProperties: {
                name: 'Color file properties',
                desc: 'Apply property colors to property badges on file items.'
            },
            prioritizeColoredFileProperties: {
                name: 'Show colored properties first',
                desc: 'Sort colored properties before other properties on file items.'
            },
            showFilePropertiesInCompactMode: {
                name: 'Show properties in compact mode',
                desc: 'Display properties when compact mode is active.'
            },
            notePropertyType: {
                name: 'Note property',
                desc: 'Select the note property to display in file items.',
                options: {
                    frontmatter: 'Frontmatter property',
                    wordCount: 'Word count',
                    none: 'None'
                }
            },
            propertyFields: {
                name: 'Property keys (vault profile)',
                desc: 'Frontmatter property keys, with per-key visibility for navigation and file list.',
                addButtonTooltip: 'Configure property keys',
                noneConfigured: 'No properties configured',
                singleConfigured: '1 property configured: {properties}',
                multipleConfigured: '{count} properties configured: {properties}'
            },
            showPropertiesOnSeparateRows: {
                name: 'Show properties on separate rows',
                desc: 'Display each property on its own row.'
            },
            dateFormat: {
                name: 'Date format',
                desc: 'Format for displaying dates (uses Moment format).',
                placeholder: 'MMM D, YYYY',
                help: 'Common formats:\nMMM D, YYYY = May 25, 2022\nDD/MM/YYYY = 25/05/2022\nYYYY-MM-DD = 2022-05-25\n\nTokens:\nYYYY/YY = year\nMMMM/MMM/MM = month\nDD/D = day\ndddd/ddd = weekday',
                helpTooltip: 'Format using Moment',
                momentLinkText: 'Moment format'
            },
            timeFormat: {
                name: 'Time format',
                desc: 'Format for displaying times (uses Moment format).',
                placeholder: 'h:mm a',
                help: 'Common formats:\nh:mm a = 2:30 PM (12-hour)\nHH:mm = 14:30 (24-hour)\nh:mm:ss a = 2:30:45 PM\nHH:mm:ss = 14:30:45\n\nTokens:\nHH/H = 24-hour\nhh/h = 12-hour\nmm = minutes\nss = seconds\na = AM/PM',
                helpTooltip: 'Format using Moment',
                momentLinkText: 'Moment format'
            },
            showFilePreview: {
                name: 'Show note preview',
                desc: 'Display preview text beneath note names.'
            },
            skipHeadingsInPreview: {
                name: 'Skip headings in preview',
                desc: 'Skip heading lines when generating preview text.'
            },
            skipCodeBlocksInPreview: {
                name: 'Skip code blocks in preview',
                desc: 'Skip code blocks when generating preview text.'
            },
            stripHtmlInPreview: {
                name: 'Strip HTML in previews',
                desc: 'Remove HTML tags from preview text. May affect performance on large notes.'
            },
            previewProperties: {
                name: 'Preview properties',
                desc: 'Comma-separated list of frontmatter properties to check for preview text. The first property with text will be used.',
                placeholder: 'summary, description, abstract',
                info: 'If no preview text is found in the specified properties, the preview will be generated from the note content.'
            },
            previewRows: {
                name: 'Preview rows',
                desc: 'Number of rows to display for preview text.',
                options: {
                    '1': '1 row',
                    '2': '2 rows',
                    '3': '3 rows',
                    '4': '4 rows',
                    '5': '5 rows'
                }
            },
            fileNameRows: {
                name: 'Title rows',
                desc: 'Number of rows to display for note titles.',
                options: {
                    '1': '1 row',
                    '2': '2 rows'
                }
            },
            showFeatureImage: {
                name: 'Show feature image',
                desc: 'Display a thumbnail of the first image found in the note.'
            },
            forceSquareFeatureImage: {
                name: 'Force square feature image',
                desc: 'Render feature images as square thumbnails.'
            },
            featureImageProperties: {
                name: 'Image properties',
                desc: 'Comma-separated list of frontmatter properties to check first. Falls back to the first image in markdown content.',
                placeholder: 'thumbnail, featureResized, feature'
            },
            featureImageExcludeProperties: {
                name: 'Exclude notes with properties',
                desc: 'Comma-separated list of frontmatter properties. Notes containing any of these properties do not store feature images.',
                placeholder: 'private, confidential'
            },
            downloadExternalFeatureImages: {
                name: 'Download external images',
                desc: 'Download remote images and YouTube thumbnails for feature images.'
            },
            showRootFolder: {
                name: 'Show root folder',
                desc: 'Display the vault name as the root folder in the tree.'
            },
            showFolderIcons: {
                name: 'Show folder icons',
                desc: 'Display icons next to folders in the navigation pane.'
            },
            inheritFolderColors: {
                name: 'Inherit folder colors',
                desc: 'Child folders inherit color from parent folders.'
            },
            folderSortOrder: {
                name: 'Folder sort order',
                desc: 'Right-click any folder to set a different sort order for its children.',
                options: {
                    alphaAsc: 'A to Z',
                    alphaDesc: 'Z to A'
                }
            },
            showNoteCount: {
                name: 'Show note count',
                desc: 'Display the number of notes next to each folder and tag.'
            },
            showSectionIcons: {
                name: 'Show icons for shortcuts and recent items',
                desc: 'Display icons for navigation sections like Shortcuts and Recent files.'
            },
            interfaceIcons: {
                name: 'Interface icons',
                desc: 'Edit toolbar, folder, tag, pinned, search, and sort icons.',
                buttonText: 'Edit icons'
            },
            showIconsColorOnly: {
                name: 'Apply color to icons only',
                desc: 'When enabled, custom colors are applied only to icons. When disabled, colors are applied to both icons and text labels.'
            },
            collapseBehavior: {
                name: 'Collapse items',
                desc: 'Choose what the expand/collapse all button affects.',
                options: {
                    all: 'All folders and tags',
                    foldersOnly: 'Folders only',
                    tagsOnly: 'Tags only'
                }
            },
            smartCollapse: {
                name: 'Keep selected item expanded',
                desc: 'When collapsing, keep the currently selected folder or tag and its parents expanded.'
            },
            navIndent: {
                name: 'Tree indentation',
                desc: 'Adjust the indentation width for nested folders and tags.'
            },
            navItemHeight: {
                name: 'Item height',
                desc: 'Adjust the height of folders and tags in the navigation pane.'
            },
            navItemHeightScaleText: {
                name: 'Scale text with item height',
                desc: 'Reduce navigation text size when item height is decreased.'
            },
            showIndentGuides: {
                name: 'Show indent guides',
                desc: 'Display indent guides for nested folders and tags.'
            },
            navRootSpacing: {
                name: 'Root item spacing',
                desc: 'Spacing between root-level folders and tags.'
            },
            showTags: {
                name: 'Show tags',
                desc: 'Display tags section in the navigator.'
            },
            showTagIcons: {
                name: 'Show tag icons',
                desc: 'Display icons next to tags in the navigation pane.'
            },
            inheritTagColors: {
                name: 'Inherit tag colors',
                desc: 'Child tags inherit color from parent tags.'
            },
            tagSortOrder: {
                name: 'Tag sort order',
                desc: 'Right-click any tag to set a different sort order for its children.',
                options: {
                    alphaAsc: 'A to Z',
                    alphaDesc: 'Z to A',
                    frequency: 'Frequency',
                    lowToHigh: 'low to high',
                    highToLow: 'high to low'
                }
            },
            showAllTagsFolder: {
                name: 'Show tags folder',
                desc: 'Display "Tags" as a collapsible folder.'
            },
            showUntagged: {
                name: 'Show untagged notes',
                desc: 'Display "Untagged" item for notes without any tags.'
            },
            keepEmptyTagsProperty: {
                name: 'Retain tags property after removing last tag',
                desc: 'Keep the tags frontmatter property when all tags are removed. When disabled, the tags property is deleted from frontmatter.'
            },
            showProperties: {
                name: 'Show properties',
                desc: 'Display properties section in the navigator.',
                propertyKeysInfoPrefix: 'Configure properties in ',
                propertyKeysInfoLinkText: 'General > Property keys',
                propertyKeysInfoSuffix: ''
            },
            showPropertyIcons: {
                name: 'Show property icons',
                desc: 'Display icons next to properties in the navigation pane.'
            },
            inheritPropertyColors: {
                name: 'Inherit property colors',
                desc: 'Property values inherit color and background from their property key.'
            },
            propertySortOrder: {
                name: 'Property sort order',
                desc: 'Right-click any property to set a different sort order for its values.',
                options: {
                    alphaAsc: 'A to Z',
                    alphaDesc: 'Z to A',
                    frequency: 'Frequency',
                    lowToHigh: 'low to high',
                    highToLow: 'high to low'
                }
            },
            showAllPropertiesFolder: {
                name: 'Show properties folder',
                desc: 'Display "Properties" as a collapsible folder.'
            },
            hiddenTags: {
                name: 'Hide tags (vault profile)',
                desc: 'Comma-separated list of tag patterns. Name patterns: tag* (starting with), *tag (ending with). Path patterns: archive (tag and descendants), archive/* (descendants only), projects/*/drafts (mid-segment wildcard).',
                placeholder: 'archive*, *draft, projects/*/old'
            },
            hiddenFileTags: {
                name: 'Hide notes with tags (vault profile)',
                desc: 'Comma-separated list of tag patterns. Notes containing matching tags are hidden. Name patterns: tag* (starting with), *tag (ending with). Path patterns: archive (tag and descendants), archive/* (descendants only), projects/*/drafts (mid-segment wildcard).',
                placeholder: 'archive*, *draft, projects/*/old'
            },
            enableFolderNotes: {
                name: 'Enable folder notes',
                desc: 'Folders with a matching note file are displayed as clickable links.'
            },
            folderNoteType: {
                name: 'Default folder note type',
                desc: 'Folder note type created from the context menu.',
                options: {
                    ask: 'Ask when creating',
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: 'Folder note name',
                desc: 'Name of the folder note without extension. Leave empty to use the same name as the folder.',
                placeholder: 'index'
            },
            folderNoteNamePattern: {
                name: 'Folder note name pattern',
                desc: 'Name pattern for folder notes without extension. Use {{folder}} to insert the folder name. When set, Folder note name does not apply.'
            },
            folderNoteTemplate: {
                name: 'Folder note template',
                desc: 'Template file for new markdown folder notes. Set template folder location in General > Templates.'
            },
            enableFolderNoteLinks: {
                name: 'Enable folder note links',
                desc: 'Folder labels are styled as links and open folder notes on click. When off, folder notes still provide name, icon, and color metadata.'
            },
            hideFolderNoteInList: {
                name: 'Hide folder notes in list',
                desc: 'Hide folder notes from appearing in the file list.'
            },
            pinCreatedFolderNote: {
                name: 'Pin created folder notes',
                desc: 'Pin folder notes when created from the context menu.'
            },
            openFolderNotesInNewTab: {
                name: 'Open folder notes in new tab',
                desc: 'Open folder notes in a new tab when clicking on a folder.'
            },
            confirmBeforeDelete: {
                name: 'Confirm before deleting',
                desc: 'Show confirmation dialog when deleting notes or folders'
            },
            deleteAttachments: {
                name: 'Delete attachments when deleting files',
                desc: "Automatically remove attachments linked to the deleted file if they're not used elsewhere",
                options: {
                    ask: 'Ask each time',
                    always: 'Always',
                    never: 'Never'
                }
            },
            moveFileConflicts: {
                name: 'Move conflicts',
                desc: 'When moving a file into a folder where a file with the same name already exists. Ask each time (rename, overwrite, cancel) or always rename.',
                options: {
                    ask: 'Ask each time',
                    rename: 'Always rename'
                }
            },
            metadataCleanup: {
                name: 'Clean up metadata',
                desc: 'Removes orphaned metadata left behind when files, folders, or tags are deleted, moved, or renamed outside of Obsidian. This only affects the Notebook Navigator settings file.',
                buttonText: 'Clean metadata',
                error: 'Settings cleanup failed',
                loading: 'Checking metadata...',
                statusClean: 'No metadata to clean',
                statusCounts:
                    'Orphaned items: {folders} folders, {tags} tags, {properties} properties, {files} files, {pinned} pins, {separators} separators'
            },
            rebuildCache: {
                name: 'Rebuild cache',
                desc: 'Use this if you experience missing tags, incorrect previews or missing feature images. This can happen after sync conflicts or unexpected closures.',
                buttonText: 'Rebuild cache',
                error: 'Failed to rebuild cache',
                indexingTitle: 'Indexing vault...',
                progress: 'Updating Notebook Navigator cache.'
            },
            externalIcons: {
                downloadButton: 'Download',
                downloadingLabel: 'Downloading...',
                removeButton: 'Remove',
                statusInstalled: 'Downloaded (version {version})',
                statusNotInstalled: 'Not downloaded',
                versionUnknown: 'unknown',
                downloadFailed: 'Failed to download {name}. Check your connection and try again.',
                removeFailed: 'Failed to remove {name}.',
                infoNote:
                    'Downloaded icon packs sync installation state across devices. Icon packs stay in the local database on each device; sync only tracks whether to download or remove them. Icon packs download from the Notebook Navigator repository (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).'
            },
            useFrontmatterDates: {
                name: 'Use frontmatter metadata',
                desc: 'Use frontmatter for note name, timestamps, icons, and colors'
            },
            frontmatterIconField: {
                name: 'Icon field',
                desc: 'Frontmatter field for file icons. Leave empty to use icons stored in settings.',
                placeholder: 'icon'
            },
            frontmatterColorField: {
                name: 'Color field',
                desc: 'Frontmatter field for file colors. Leave empty to use colors stored in settings.',
                placeholder: 'color'
            },
            frontmatterBackgroundField: {
                name: 'Background field',
                desc: 'Frontmatter field for background colors. Leave empty to use background colors stored in settings.',
                placeholder: 'background'
            },
            frontmatterMigration: {
                name: 'Migrate icons and colors from settings',
                desc: 'Stored in settings: {icons} icons, {colors} colors.',
                button: 'Migrate',
                buttonWorking: 'Migrating...',
                noticeNone: 'No file icons or colors stored in settings.',
                noticeDone: 'Migrated {migratedIcons}/{icons} icons, {migratedColors}/{colors} colors.',
                noticeFailures: 'Failed entries: {failures}.',
                noticeError: 'Migration failed. Check console for details.'
            },
            frontmatterNameField: {
                name: 'Name fields',
                desc: 'Comma-separated list of frontmatter fields. First non-empty value is used. Falls back to file name.',
                placeholder: 'title, name'
            },
            frontmatterCreatedField: {
                name: 'Created timestamp field',
                desc: 'Frontmatter field name for the created timestamp. Leave empty to only use file system date.',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: 'Modified timestamp field',
                desc: 'Frontmatter field name for the modified timestamp. Leave empty to only use file system date.',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: 'Timestamp format',
                desc: 'Format used to parse timestamps in frontmatter. Leave empty to use ISO 8601 parsing.',
                helpTooltip: 'Format using Moment',
                momentLinkText: 'Moment format',
                help: 'Common formats:\nYYYY-MM-DD[T]HH:mm:ss → 2025-01-04T14:30:45\nYYYY-MM-DD[T]HH:mm:ssZ → 2025-08-07T16:53:39+02:00\nDD/MM/YYYY HH:mm:ss → 04/01/2025 14:30:45\nMM/DD/YYYY h:mm:ss a → 01/04/2025 2:30:45 PM'
            },
            supportDevelopment: {
                name: 'Support development',
                desc: 'If you love using Notebook Navigator, please consider supporting its continued development.',
                buttonText: '❤️ Sponsor',
                coffeeButton: '☕️ Buy me a coffee'
            },
            updateCheckOnStart: {
                name: 'Check for new version on start',
                desc: 'Checks for new plugin releases on startup and shows a notification when an update is available. Each version is announced only once, and checks occur at most once per day.',
                status: 'New version available: {version}'
            },
            whatsNew: {
                name: "What's new in Notebook Navigator {version}",
                desc: 'See recent updates and improvements',
                buttonText: 'View recent updates'
            },
            masteringVideo: {
                name: 'Mastering Notebook Navigator (video)',
                desc: 'This video covers everything you need to be productive in Notebook Navigator, including hot keys, search, tags and advanced customization.'
            },
            cacheStatistics: {
                localCache: 'Local cache',
                items: 'items',
                withTags: 'with tags',
                withPreviewText: 'with preview text',
                withFeatureImage: 'with feature image',
                withMetadata: 'with metadata'
            },
            metadataInfo: {
                successfullyParsed: 'Successfully parsed',
                itemsWithName: 'items with name',
                withCreatedDate: 'with created date',
                withModifiedDate: 'with modified date',
                withIcon: 'with icon',
                withColor: 'with color',
                failedToParse: 'Failed to parse',
                createdDates: 'created dates',
                modifiedDates: 'modified dates',
                checkTimestampFormat: 'Check your timestamp format.',
                exportFailed: 'Export errors'
            }
        }
    },
    whatsNew: {
        title: "What's new in Notebook Navigator",
        supportMessage: 'If you find Notebook Navigator helpful, please consider supporting its development.',
        supportButton: 'Buy me a coffee',
        thanksButton: 'Thanks!'
    }
};
