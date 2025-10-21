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

/**
 * Release Notes System
 *
 * This module manages the "What's new" feature that shows users what has changed
 * between plugin versions. The system works as follows:
 *
 * 1. On plugin load, it compares the current version with the last shown version
 * 2. If version increased, it shows all release notes between versions
 * 3. If downgraded or same version, it shows the latest 5 releases
 * 4. Individual releases can be marked with showOnUpdate: false to skip auto-display
 * 5. Users can always manually access release notes via plugin settings
 *
 * The lastShownVersion is stored in plugin settings to track what the user has seen.
 */

/**
 * Formatting in release notes
 *
 * Supported inline formats in both info and list items:
 * - Bold text: **text**
 * - Critical emphasis (red + bold): ==text==
 * - Markdown link: [label](https://example.com)
 * - Auto-link: https://example.com
 *
 * Not supported:
 * - Italics, headings, inline code, HTML
 *
 * Writing rules:
 * - Use factual, concise statements
 * - Avoid benefit language and subjective adjectives
 * - Keep to the categories: new, improved, changed, fixed
 */

/**
 * Represents a single release note entry
 */
export interface ReleaseNote {
    version: string;
    date: string;
    /** If false, skip automatic modal display for this version during startup */
    showOnUpdate?: boolean;
    info?: string; // General information about the release, shown at top without bullets
    new?: string[];
    improved?: string[];
    changed?: string[];
    fixed?: string[];
}

/**
 * All release notes for the plugin, ordered from newest to oldest.
 *
 * When adding a new release:
 * 1. Add it at the beginning of the array (newest first)
 * 2. Categorize features into: new, improved, changed, or fixed arrays
 */
const RELEASE_NOTES: ReleaseNote[] = [
    {
        version: '1.6.3',
        date: '2025-10-22',
        showOnUpdate: true,
        fixed: [
            'Tags from hidden folders no longer hide matching tags from visible notes.',
            'Folder notes are now shown after being created from the context menu without having to collapse or expand the parent folder.'
        ]
    },
    {
        version: '1.6.2',
        date: '2025-10-21',
        showOnUpdate: false,
        fixed: [
            'Fixed an issue where some icons in Font awesome were missing.',
            'Fixed a startup issue on mobile devices if default pane was set to navigation and a tag was selected, it would always try to switch to list pane.'
        ]
    },
    {
        version: '1.6.1',
        date: '2025-10-20',
        showOnUpdate: true,
        info: [
            'In this release I have some good news and some bad news. The bad news is that I had to remove the **favorite tags** section due to architectural complexity. It made the codebase very hard to maintain with special cases everywhere. The good news is that you can now sort root tags manually just like folders, so you can still put your favorite tags or untagged notes at the top of the tag list.',
            'My plan is to continue developing and improving this plugin for a long time. Years, maybe even decades. This is why some features might be cut in future releases, but right now I am quite happy with the internal architecture so I do not see this happening with any other features in the near future.',
            'Thank you for using Notebook Navigator!'
        ].join('\n\n'),
        new: [
            'You can now ==reorder sections== like Shortcuts, Recent files, Notes and Tags in the navigation pane. Just drag and drop the section headers in the updated "Reorder root folders and tags" mode accessible through a toolbar button in navigation pane.',
            'You can now change ==sort order for root tags==, just like folders. Just click the button "Reorder root folders and tags" in the navigation pane.',
            'Support for ==back and forward mouse buttons==! Use them on desktop in single pane to quickly switch between navigation and list panes.',
            'Two new style settings: ==Navigation pane transparency== and ==List pane transparency==. You can now make the navigation and list pane transparent (remove background).',
            '**COMMANDS**',
            'New command: ==Add to shortcuts==. Adds the current file, folder, or tag to shortcuts.',
            '**SETTINGS**',
            'New setting: ==Pin created folder notes==. Automatically pin folder notes when created from the context menu. Default disabled.',
            'New setting: ==Separate note counts==. Display separate counts for current folder/tag notes and descendant notes ("2 ▾ 5" instead of "7"). Default enabled.',
            'New setting: ==Show path==. Display the folder path below note names in tooltips. Default enabled.',
            '**MENUS**',
            'New folder menu item: =="Move to..."==. Opens a modal to move the folder to another location.',
            'New file menu items: ==Copy path== and ==Copy relative path==.',
            '==New menu== when right-clicking empty area in list pane: Create new note, folder, canvas, base or drawing.'
        ],
        changed: [
            '**Favorite tags section is removed**. I am sorry about this change, but having a separate favorite tags section caused an architectural nightmare that caused special wiring all over the application. To get a similar experience you can sort tags by frequency, or reorder root tags manually.'
        ],
        improved: [
            'Hidden tags are now also hidden in the list pane ("file tags").',
            'Icon packs will now update automatically if version number in the plugin distribution is newer than the downloaded version.'
        ],
        fixed: [
            'Fixed a rare startup crash that hid Notebook Navigator during startup after enabling the plugin.',
            'Fixed an issue where shortcuts could not be reordered on Android devices.',
            'Fixed scroll to active note in list pane when toggling "Show notes from descendants".',
            'Tab buttons in settings are now rendered properly with various themes.',
            'Fixed issues with text preview filter: italic text, inline code, quotes, footnotes, tasks are now handled properly.'
        ]
    },
    {
        version: '1.5.5',
        date: '2025-10-14',
        showOnUpdate: true,
        info: [
            'Thanks for all great suggestions you have for the plugin! New in this release is ==frequency based sorting for tags==, so your most used tags are shown first.',
            'I also added ==drag and drop support for single pane mode==, so you can now drag files to the left edge of the screen to open the navigation pane to move files or add and remove tags!',
            'Have a great day and enjoy Notebook Navigator!'
        ].join('\n\n'),
        new: [
            '==New setting: Tag sort order==. You can now sort tags alphabetically or by frequency (number of notes with tag).',
            '==Drag and drop files in single pane mode==. You can now drag and drop files in single-pane mode by dragging to the left edge of the screen to open the navigation pane temporarily.'
        ],
        improved: [
            'Emojis can now be read from frontmatter using both "icon: emoji:🔭" and "icon: 🔭" formats.',
            'Emojis are now saved as "icon: 🔭" in frontmatter if the setting Save in Iconize format is enabled.',
            'Settings now remember the last tab you were on when reopening settings.'
        ],
        fixed: [
            'Fixed an issue where custom folder sort order was reset if settings were synced before new folders were synced between devices. Custom folder sort order sync is now rock solid.',
            'Console will no longer show warnings about "Failed to scroll to index" when Notebook Navigator is hidden and you change file in main editor.',
            'Fixed an issue where file dates would show instead of frontmatter dates, if frontmatter dates were enabled and list was sorted by title.',
            'Read metadata from frontmatter in settings now update statistics properly, and also excludes hidden folders from statistics if "Show hidden items" is disabled.'
        ]
    },
    {
        version: '1.5.4',
        date: '2025-10-09',
        showOnUpdate: true,
        new: [
            'Icons read from frontmatter can now also read Iconize formatted icons, e.g. LiHome, FasUser, SiGithub, etc.',
            'New setting: Save in Iconize format. Saves icons in Iconize format in frontmatter instead of proprietary provider:icon format.'
        ],
        improved: [
            'Folders with folder notes can now read icon and color from frontmatter if enabled in settings.',
            'You can now drag and drop interactive frames and images to Excaldraw.'
        ],
        fixed: [
            'Improved shortcuts sync between devices - you should now always see the same shortcuts on all devices.',
            'Folders with folder notes now show correctly in the shortcuts area and can be clicked to open the folder note.',
            'Fixed a display issue on mobile devices in the navigation pane with some themes such as Cupertino.'
        ]
    },
    {
        version: '1.5.3',
        date: '2025-10-07',
        info: [
            'This release is all about ==polish and quality of life improvements== based on your feedback. I have read every single comment and suggestion posted on GitHub, and thanks to your feedback this plugin is shaping up to be something really amazing!',
            'Thanks a lot for all your support and feedback, I build it for you!'
        ].join('\n\n'),
        new: [
            '==Shortcuts can now be pinned== to the top of list! Just press the new bookmark icon 🔖 in the pane header!',
            '==New setting: Separate mobile homepage==. You can now configure a different homepage for mobile devices.',
            '==New setting. Apply color to icons only==. When enabled, custom colors are applied only to icons. When disabled, colors are applied to both icons and text labels.',
            '==New setting: Read file icon and file color from frontmatter==. File icons and colors can now be read from frontmatter metadata.',
            '==New setting: Write file icon and file color to frontmatter==: You can now save file icons and colors to frontmatter instead of settings.',
            '==New settings button: Migrate icon and color to frontmatter==: Migration tool to move all file colors and file icons from plugin settings to frontmatter.',
            '==New command: Convert to folder note==: New command to convert any file into a folder note by creating a matching folder and moving the file inside.',
            '==New setting: File tags - Show parent file tags==. You can now choose to hide parent tag names in file list.',
            '==New setting: File tags - Color file tags==. You can now disable file tag colors in listpane for a cleaner look.',
            '==Two new style settings: File name font weight and Custom color file name font weight==. You can now change the font weight of files in Shortcuts and Recent files.',
            'Notebook Navigator now checks for new releases on startup and shows a notification when an update is available. Each version is announced only once, and checks occur at most once per day and can be disabled in settings.',
            'Notebook Navigator is now translated to **traditional Chinese** (繁體中文) thanks to @emisjerry!'
        ],
        improved: [
            'File color now applies to both the file icon and file name (previously file color only applied to the icon). You can now also apply file color without having an icon set. Old display style can be restored through new setting.',
            'Canvas and Base files are now clearly marked with icons in the slim file list style. External files are also now clearly marked with a shortcut icon.',
            'You can now drag and drop external files from outside Obsidian directly into the file list to import them into the vault.',
            'The parent folder icon in file list now shows the actual parent folder icon instead of a generic folder icon.',
            'List pane will no longer scroll to the selected item when deleting or moving items.'
        ],
        changed: ['**Settings are now reorganized into tabs**. Makes it much easier to quickly find the settings you are looking for.']
    },
    {
        version: '1.5.1',
        date: '2025-10-01',
        new: [
            '==New setting: Navigation banner==. You can now add a custom banner image at the top of the navigation pane.',
            '==New setting: List pane title==. If you did not like the new list pane header style of 1.5 you can now revert back to the old "header" style title. Or disable it completely.',
            '==New setting: Show notes from subfolders / descendants==. Well after way too many users did not find the toolbar button, it is now also available as a setting.'
        ],
        changed: [
            'Renamed tag "Favorites" to "Favorite tags".',
            'Using the **Open** command to shift keyboard focus to Notebook Navigator will now focus navigation pane in single pane mode if navigation pane is visible.'
        ],
        fixed: [
            'Add to shortcuts / remove from shortcuts are now shown for all supported files, not only markdown files.',
            'Fixed an issue where the navigation pane would not be shown on startup when a homepage was configured and the default startup view was set to navigation pane in single-pane mode.',
            'Fixed an issue where clicking a tag shortcut would not open the tag.',
            'Fixed an issue where folder notes were added to file count even when they were hidden.',
            'Fixed an issue where shortcuts would not show name aliases from frontmatter.',
            'Fixed the German word for shortcuts (keyboard shortcuts) to Lesezeichen (bookmarks).',
            'Fixed an issue where file preview would not update after renaming and then editing a file.'
        ]
    },
    {
        version: '1.5.0',
        date: '2025-09-30',
        info: [
            '60 000 downloads in 3 weeks! Thank you all for your feedback and kind words, I have really put my heart into this plugin and reading about how you use it makes it all worthwile! Notebook Navigator 1.5 is a significant upgrade with tons of new productivity features. Most features are based on your feedback, so if you have any ideas please feel free to post them on our GitHub!',
            'Have a great day and enjoy Notebook Navigator!'
        ].join('\n\n'),
        new: [
            '==Shortcuts==. Amazing new feature where you can add **folders**, **tags**, **notes** and **saved searches** to a new area in the navigation pane! You can disable this in settings.',
            '==Recent notes==. A new section showing recently opened files in the navigation pane. You can disable this in settings.',
            '==Manual folder sort order==. You can now manually sort root folders in the navigation pane using the new toolbar button. Sort order is synced between devices, and you can easily go back to alphabetical order.',
            '==Keyboard shortcuts==. You can now customize all keyboard shortcuts in settings using Mod, Ctrl, Shift, and Alt modifiers. VIM user? We got you covered!',
            '==File icon customization==. You can now set custom icons and icon colors for files through the context menu.',
            '==Default startup view==. You can now choose to start in the navigation pane (shortcuts, recent notes, folders) or list pane (notes and files). Default is now navigation pane to quickly access shortcuts and recent notes.',
            '==Transparent colors==. The color picker now has an alpha slider to set transparency. This works for files, folders and tags. You can now also remove individual colors from the recently used color list.',
            '==New icon pack: Simple icons==. 3364 SVG icons for popular brands and services.'
        ],
        changed: [
            '**Dragging notes to folders or tags** will now auto-expand the target folder or tag after a short delay.',
            '**Auto-reveal active note** now selects the nearest visible ancestor when descendant notes are enabled. This means that your folder tree will always stay "clean" without any expanded subfolders if you have show descendants enabled.',
            'The tag section now hides when no tags remain after applying filters.',
            'Remove color and Remove icon options were removed from the context menu, you now remove icons or colors with the "change" dialogs.',
            'Recent icons were moved to local storage to reduce the synced settings file size. This means that you will start with empty recent icons in this release.'
        ],
        fixed: [
            'Moving notes with tags previously removed them from the tag tree, meaning it looked like they no longer had any tags. This has been fixed.'
        ]
    },
    {
        version: '1.4.22',
        date: '2025-09-21',
        fixed: [
            'Fixed dual-pane layout persistence so the preference stays disabled after restarts.',
            'Adjusted Notebook Navigator view startup process to prevent duplicate instances on version update.'
        ]
    },
    {
        version: '1.4.21',
        date: '2025-09-21',
        info: [
            '==Thank you all for a week of amazing feedback!== I love to hear how you use Notebook Navigator, and I will continue to add thoughtful features that makes your life easier and at the same time does not add bloat or overhead to the core experience.',
            'In this release I significantly improved the **tag extraction reliability from frontmatter**. If you previously were not showing some tags, this issue should now be resolved. If it still happens due to sync issues or app restarts, you can now manually rebuild the cache from Notebook Navigator settings.',
            'Have a great day and enjoy Notebook Navigator!'
        ].join('\n\n'),
        new: [
            'You can now choose a ==Homepage document== that opens a Markdown, Canvas, or Base file on startup. 🎉 You can change it in settings.',
            'Added a new command **"Notebook Navigator: Open homepage"** to open your configured homepage file directly.',
            'Added a ==Rebuild cache== command to clear and rebuild the Notebook Navigator cache. Use this if you experience missing tags, incorrect previews or missing feature images. This can happen after sync conflicts or unexpected closures.',
            'Settings now also include a **Rebuild cache** button that clears and rebuilds the cache.'
        ],
        improved: [
            '**Icon picker** now provides better search results with improved relevance scoring and fuzzy matching. No longer will your direct name match be outside the 50 search results. 🥳',
            '**Read metadata from frontmatter** now accepts a string array as name property and will use the first entry.',
            'Significantly improved **tag extraction from frontmatter**. Notebook Navigator now always waits until Obsidian metadata cache has indexed every file even if it takes a very long time.'
        ],
        changed: [
            'Tags in list pane now show without the # prefix.',
            'Dual pane preference is now stored per-device instead of synced, allowing different pane layouts on different devices (laptop, desktop).'
        ],
        fixed: [
            'Icon packs now re-download automatically on the next app launch if download should fail.',
            'Icons from icon packs now render with the correct size on mobile devices.',
            'Previously tag extraction would miss tags if Obsidian metadata cache took more than 5 seconds to be ready; this is now fixed.'
        ]
    },
    {
        version: '1.4.20',
        date: '2025-09-19',
        new: [
            '==ICON PACKS!== You can now download **Bootstrap Icons**, **Font Awesome**, **Material Icons**, **Phosphor Icons** and **RPG Awesome** icon packs from within the Notebook Navigator settings! This is done using a super modular implementation where icon packs are stored locally on each device in a database, with just tiny metadata syncing between devices indicating if they should download or remove packs. Everything "just works" in the background! '
        ],
        improved: [
            '==Tags in list pane are now sorted alphabetically==. Tags in the file list are ordered with colored tags first, followed by uncolored tags.'
        ],
        changed: [
            'Metadata cleanup is no longer run automatically on every startup. You can now access it from Settings, and it will show you if you have any orphaned settings due to moving, deleting or renaming files outside of Obsidian.',
            'Show tooltips (desktop) is now disabled by default, based on user feedback.'
        ],
        fixed: [
            'Notebook Navigator will now properly scroll to the selected ancestor folder during startup (a problem introduced in 1.4.18 when we fixed another issue with auto reveal).',
            'Finally fixed ==ClearType rendering== fuzzyness on Windows by removing GPU transforms from virtualized list rows.'
        ]
    },
    {
        version: '1.4.19',
        date: '2025-09-18',
        new: [
            '**Filter search** You can now ==search for tags== in the built-in Filter search using the # prefix! For example: "#oo" matches #tool and #mytags/root. Just typing "#" filters to show only notes with tags',
            '**Filter search** Now supports negation tokens: ==!name and !#tag==. This makes it super easy to find untagged notes in a folder, or notes without a certain word in the title.',
            '==Folder notes can now be Markdown, Canvas or Base==. Notebook Navigator also has a new setting "Default folder note type" where you can change the default document type when creating folder notes from the context menu.'
        ],
        changed: [
            'Changed default search provider to **Filter search** due to performance issues with Omnisearch in large vaults.',
            'Due to the improvements to filter search, Omnisearch no longer combines search results with Filter search.'
        ],
        improved: ['"Navigate to folder" and "Navigate to tag" fuzzy modals now match multi-word queries in any order.'],
        fixed: [
            'Fixed so list pane properly updates sort order for notes if it is sorted by modification date.',
            'Further improvements to pixel perfect rendering to avoid blurry text on scaled Windows displays (125% and 150% scaling).'
        ]
    },
    {
        version: '1.4.18',
        date: '2025-09-17',
        info: [
            '==Omnisearch integration== - Notebook Navigator now integrates with the Omnisearch plugin for powerful full-text search! When Omnisearch is installed you can switch between file name filtering and full-text search in Settings → Search → Search provider. This allows you to search through the actual content of your notes, not just their titles!',
            '**Minimal theme** - Many people have asked me what theme I use for the screenshot. It\'s the "Minimal" theme with the "Things" color scheme. To set the color scheme you install both the theme "Minimal" and the plugin "Minimal Theme Settings". You can then change the color scheme in "Minimal Theme Settings".'
        ].join('\n\n'),
        new: [
            '**Omnisearch integration** - Full-text search support when the Omnisearch plugin is installed',
            '**Search provider** setting to switch between file name filter and Omnisearch',
            '==Background colors== for folders and tags: you can now set custom background colors via the context menu (this is also now available in the API)',
            '**New setting**: ==Multi-select modifier==. You can now switch to Option/Alt for multi-select and use Cmd/Ctrl click to open notes in new tab 🎉.',
            '**New setting**: You can now toggle file tags in slim mode. Default is disabled.',
            '**New setting**: You can now toggle text scaling with item height in navigation pane. Default is enabled.',
            '**New languages**: 한국어 and Polski'
        ],
        changed: ['Hidden tags setting now accepts tag* and *tag name wildcards.'],
        fixed: [
            'Featured image detection now reads frontmatter wikilinks that include embed markers or alias text (for example ![[image.jpg|cover]])',
            'Implemented a fix that should resolve blurred text in Windows caused by rounding errors in subpixel rendering (very rare, only some fonts affected).',
            'Fixed a bug where navigation pane would jump to a tag when a folder with same name was selected.'
        ]
    },
    {
        version: '1.4.17',
        date: '2025-09-15',
        info: 'Welcome to the community release of Notebook Navigator!'
    },
    {
        version: '1.4.16',
        date: '2025-09-14',
        info: [
            'No new features or changes in this release. This update focuses on performance and stability improvements, handling edge cases and rare configurations in preparation for the public community release.',
            '==Important!== If you have been using Notebook Navigator through BRAT, **please copy the contents of data.json to a markdown document now to preserve your settings!** When you remove the BRAT version and install the community version, you can paste your settings back to keep pinned notes, colors, icons, custom sort orders and appearances.',
            '**Recommendation**: Use the community version of Notebook Navigator to avoid multiple plugin instances loading when BRAT updates on startup.'
        ].join('\n\n'),
        improved: [
            'Improved quick search performance for large vaults.',
            'Improved list rendering performance for large lists.',
            'Background processing stops cleanly and pending idle tasks are canceled when the plugin unloads.',
            'Safety guards added to most services and hooks.',
            'Stricter error handling in IndexedDB with proper transaction cleanup.',
            'Proactive listener cleanup in drag-and-drop modules and modals.'
        ]
    },
    {
        version: '1.4.15',
        date: '2025-09-12',
        fixed: [
            "Fixed keyboard event handling in modals to use Obsidian's scope.register() native method. See https://github.com/obsidianmd/obsidian-releases/pull/6886#issuecomment-3286434078"
        ]
    },
    {
        version: '1.4.14',
        date: '2025-09-12',
        improved: ['Improved settings sync between devices.'],
        fixed: ['Fixed so dragging external files to root folder works as expected.']
    },
    {
        version: '1.4.13',
        date: '2025-09-11',
        new: ['You can now **drag and drop files** from your operating system directly onto folders to import them into your vault.'],
        changed: [
            'The toolbar button "Show notes from subfolders" was renamed to **Show notes from descendants** and now applies to both folders and tags.',
            'The command **Toggle notes from subfolders** was renamed to "Toggle notes from descendants" (ID: toggle-descendant-notes). Please update your hotkeys.'
        ],
        fixed: [
            'Toggling **Show hidden items** now properly focuses the selected item in the navigation pane. Also greatly improved the scrolling logic.'
        ],
        improved: [
            'Tag view now shows parent folder for each note when "Show parent folder names" is enabled.',
            'All File names except markdown, canvas and base **now show extension suffixes** in the file list.'
        ]
    },
    {
        version: '1.4.12',
        date: '2025-09-10',
        fixed: [
            'Folders now properly show an expansion arrow when they contain only hidden subfolders while "Show hidden items" is enabled.',
            'Mobile keyboard hides correctly when switching from list pane to navigation pane.'
        ]
    },
    {
        version: '1.4.11',
        date: '2025-09-09',
        improved: [
            'Folders, tags, and files now use **natural sorting** that compares number sequences by value (e.g., "note2" is now listed before "note10").'
        ],
        changed: [
            'Tag metadata (colors, icons, appearance, sorting) is no longer automatically cleaned up on startup, as tags may be used occasionally for special items.'
        ],
        fixed: [
            'If **Read metadata from frontmatter** is enabled, metadata changes will now properly trigger updates of file name, sorting, and tooltips when changed.',
            'Fixed an issue where deleting multiple files would not select the next file in the same folder.'
        ]
    },
    {
        version: '1.4.10',
        date: '2025-09-07',
        improved: ['**Quick search** now highlights filename matches in the list pane.'],
        changed: [
            '**File visibility**: You can now choose between documents / supported / all files (was previously "markdown only" / supported / all). Default is "documents" showing md, canvas and base files.',
            '**Show hidden items** now applies to both folders and tags, it just complicated things to have them separate where tags had files in hidden folders etc.'
        ],
        fixed: [
            '**Untagged** no longer includes files from hidden folders unless Show hidden items is enabled.',
            '**Untagged note counter** now only counts markdown files.'
        ]
    }
];

/**
 * Gets all release notes between two versions (inclusive).
 * Used when upgrading to show what's changed since the last version.
 *
 * @param fromVersion - The starting version (usually the previously shown version)
 * @param toVersion - The ending version (usually the current version)
 * @returns Array of release notes between the versions, or latest notes if versions not found
 */
export function getReleaseNotesBetweenVersions(fromVersion: string, toVersion: string): ReleaseNote[] {
    const fromIndex = RELEASE_NOTES.findIndex(note => note.version === fromVersion);
    const toIndex = RELEASE_NOTES.findIndex(note => note.version === toVersion);

    // If either version is not found, fall back to showing latest releases
    if (fromIndex === -1 || toIndex === -1) {
        return getLatestReleaseNotes();
    }

    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    return RELEASE_NOTES.slice(startIndex, endIndex + 1);
}

/**
 * Gets the most recent release notes.
 * Used for manual "What's new" access and as fallback.
 *
 * @param count - Number of latest releases to return (defaults to 5)
 * @returns Array of the most recent release notes
 */
export function getLatestReleaseNotes(count: number = 5): ReleaseNote[] {
    return RELEASE_NOTES.slice(0, count);
}

/**
 * Compares two semantic version strings.
 *
 * @param v1 - First version string (e.g., "1.2.3")
 * @param v2 - Second version string (e.g., "1.2.4")
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;

        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }

    return 0;
}

/**
 * Determines whether release notes for the given version should appear automatically on update.
 */
export function isReleaseAutoDisplayEnabled(version: string): boolean {
    const note = RELEASE_NOTES.find(entry => entry.version === version);
    if (!note) {
        return true;
    }
    return note.showOnUpdate !== false;
}
