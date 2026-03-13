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
    /** Optional banner image source. true uses version as banner id, string uses explicit URL or banner id */
    bannerUrl?: boolean | string;
    /** Optional YouTube video URL shown above the release notes for this version */
    youtubeUrl?: string;
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
        version: '2.5.1',
        date: '2026-03-13',
        showOnUpdate: true,
        new: [
            'New setting: Navigation > Rainbow colors > ==Consistent brightness across hues==. If enabled (default), hue transitions use the same brightness levels.',
            'New setting: Navigation > Rainbow colors > ==Separate light and dark mode colors==. Configure different colors for light and dark mode. Default disabled.'
        ],
        improved: [
            'Property tree now shows the values for boolean `true` and `false`.',
            'Property tree now treats frontmatter `null` values as unassigned instead of converting them to `true`.'
        ],
        fixed: [
            'Fixed so the "new version available" popup only shows at most once per day, not on every startup.'
        ]
    },
    {
        version: '2.5.0',
        date: '2026-03-09',
        showOnUpdate: true,
        bannerUrl: true,
        new: [
            'New feature: ==Rainbow colors==! You can now set individual rainbow colors for shortcuts, recent files, folders, tags or properties! Pick custom colors, choose between Hue (color wheel) and RGB (direct blend). There are lots of configuration settings, so just head over to **Settings > Navigation > Rainbow colors** to check it out!',
            'You can now set ==background colors for files== in the list pane. Great to make individual files stand out! Background colors can be set in menus or frontmatter.',
            'New setting: List > Notes > ==Unfinished task background==. This makes it super easy to find notes with unfinished tasks in the list pane.',
            'New setting: List > Notes > ==Feature image display size==. You can now increase the max vertical size of feature images from 64px to 128px in list pane.',
            'New setting: List > Notes > ==Feature image pixel size==. You can now set the max thumbnail width from 256 pixels (default) up to 512 pixels for higher-resolution thumbnails in calendar overlays and list pane.',
            'New setting: List > Notes > ==Link property pills to notes==. When enabled (default), properties that are file links can be clicked to open that file.',
            'New setting: List > Notes > ==Link property pills to URLs==. When enabled (default), properties that are URLs can be clicked to open the URL. Very handy if you keep web references in your notes.',
            'New command: ==Toggle dual pane orientation== to quickly change orientation between horizontal and vertical dual panes.',
            '==New API 2.0==: Added whenReady(), tag collection helpers, property node helpers, new tag and property context menu hooks and many other improvements.'
        ],
        improved: [
            'The ==properties tree now supports custom appearance and sort order== in list pane.',
            'The setting ==Scope pinned notes to their location== (previously called "Limit pinned notes") now also applies to tags and properties.',
            'You can now click directly on property keys in the "Property key visibility modal" to quickly toggle visibility in all three places: navigation pane, list pane, and file menus.',
            'Shortcut rows no longer reserve trailing badge space when Shortcut badge is None.'
        ],
        changed: [
            'Updated fontawesome icons 7.1 to 7.2 and simple-icons 15.20 to 16.11. ==Important, this is a breaking change!==. Simple-icons removed 44 icons such as canva, openai and slack. If you used these icons you need to reassign them to new icons.'
        ],
        fixed: [
            'Fixed an issue where deleting the active note could trigger "file not found" errors in Linter when "Lint on Focused File Change" is enabled.',
            'Fixed an issue where disabling "Show icons for shortcuts and recent items" also disabled the icon for the Properties root virtual folder.',
            'Fixed an issue where the Properties folder was showing if there were no visible properties in Navigation pane and "Show properties folder" was disabled.'
        ]
    },
    {
        version: '2.4.3',
        date: '2026-02-28',
        showOnUpdate: true,
        bannerUrl: true,
        new: [
            'You can now ==add properties to files== by right clicking in the list pane and choosing "Set property". Just add properties to list in this menu in the properties modal first, accessed by right-clicking Properties and choosing "Configure property keys".',
            'New command: ==Set property on selected files==. Quickly apply a property value to selected notes.',
            'New setting: ==Folders > Enable folder note links==. You can now use folder notes only for styling! Disable this setting to only use folder notes for folder styles (icon and color), enable to use folder notes as links (default).',
            'New setting: ==List pane > Notes > Strip LaTeX in previews==. Removes inline and block LaTeX expressions from preview text. Default enabled.',
            'New file menu option: ==Open in default app==. Opens the file in its default application outside of Obsidian.'
        ],
        improved: [
            '==Search filter now uses accent-insensitive matching==. "cafe" matches "café", "cancion" matches "canción". Non-Latin scripts like Arabic are not affected.'
        ],
        fixed: [
            'Fixed an issue where deleting multiple open notes at the same time could trigger the error: Failed to open "".',
            'Recent items no longer shows hidden items.'
        ]
    },
    {
        version: '2.4.2',
        date: '2026-02-24',
        showOnUpdate: true,
        bannerUrl: true,
        new: [
            '**Greatly improved the way you work with properties!**',
            'First up, a new ==Property key selection modal== was added with property search, select all/deselect all properties, and the option to choose if each property should be shown in the navigation pane, in the list pane, or both. You access this by right-clicking "Properties" and choose "Configure property keys".',
            'Secondly, you can now ==rename and delete property keys== in the property tree.',
            'You can also ==create a new note directly in property view==. You can create new notes in properties using context menu, the toolbar button or using "Create new note".',
            'New setting: ==General > Open new notes in new tab==. New notes open in a new tab instead of replacing the current tab. Default disabled.',
            'New setting: ==General > Files > Delete attachments==. Optionally delete linked attachments when deleting files, works just like Obsidian 1.12.2 and later. Default value "Ask each time".',
            'New setting: ==General > Files > Move conflicts==. When moving a file to a folder that already has a file with the same name, you can now choose to automatically rename the moved file with a suffix (example: "Untitled.md" -> "Untitled 1.md"). Options are "Ask each time" (default) and "Always rename".',
            'The command **"Add to shortcuts" now removes the selected item from shortcuts** if it is already pinned.'
        ],
        improved: [
            '**Custom folder sort order** is now applied when grouping by folder in list pane.',
            '**Saving a search shortcut** now shows the option: "Always start in: {path}". This means the shortcut will always start in the folder, tag or property where you saved it.',
            '**Visible property keys** are now saved per vault profile.',
            '**Moving files with conflicts** now show a modal dialog where you can choose to overwrite, keep both (rename), or cancel the move operation.',
            '**Hiding a folder note** (using filter, tag or property rules) now also hides the folder with the folder note in the navigation pane.',
            '**Date display for pinned items** is now hidden when "Variable note height" is enabled.'
        ],
        changed: [
            '**Property key configuration** was moved from Navigation Pane to the General settings tab.',
            'In list pane, **property keys with no values** are no longer displayed (previously the property key was showing).'
        ],
        fixed: [
            "Fixed an issue where today's date and file list did not update when a new day started.",
            'Folder sorting now uses the resolved folder display name (including folder-note frontmatter name) instead of only folder.name.'
        ]
    },
    {
        version: '2.4.1',
        date: '2026-02-18',
        showOnUpdate: false,
        fixed: [
            'Fixed an issue where the calendar could use locale week rules for custom week patterns using ISO week tokens ("W" or "G").',
            'Fixed an issue where new notes created from tag view wrote the selected tag in lowercase in note properties.'
        ]
    },
    {
        version: '2.4.0',
        date: '2026-02-18',
        showOnUpdate: true,
        new: [
            '==Property browser==. You can now browse file properties in the navigation pane. Properties are organized in a tree showing property keys and their values with file counts, just like tags. Supports custom colors, icons, context menus, and drag and drop. Just right-click "Properties" and choose "Configure property keys" to get started!',
            '==Create new note in tag==. Right-click a tag in the navigation pane and select "New note" to create a file with that tag. Respects Obsidian\'s "Default location for new notes" setting. This makes it possible to finally work 100% in the tag browser in Notebook Navigator.',
            '==Filter search: folder filters==. Filter notes by folder with "folder:" and "-folder:" tokens. Supports both wildcards "folder:notes" and specific paths "folder:/work/meetingnotes".',
            '==Filter search: extension filters==. Filter files by extension with "ext:" and "-ext:" tokens. For example, "ext:pdf" to show only PDF files or "-ext:md" to exclude markdown files. Can be combined with other filters.',
            '==Folder notes now read and write icon, color and background color to frontmatter==! A new setting List > Frontmatter > Background field is used to read and write background color.',
            'New setting: ==Shortcuts > Recent notes > Hide notes==. You can now hide folder notes from recent notes, useful if you name all your folder notes the same name.',
            "New setting: ==General > Auto reveal > Use shortest path==. Default enabled, if enabled auto-reveal will select the nearest visible ancestor folder or tag. If disabled, auto-reveal will select the file's actual folder and exact tag.",
            'New setting: ==List > Property to sort by > Secondary sort==. Defines what to sort by for files which do not have the custom property. Can be title, file name, date created or date edited.',
            'New command: ==Navigate to property==. Opens a fuzzy search modal listing all property keys and values. Selecting one navigates to it in the navigation pane.',
            'New icons for ==tags, property keys, and property values== in the navigation pane. Configurable in settings.',
            'Public API 1.3: ==Property metadata and navigation==. New methods for getting and setting property colors, background colors, and icons. New navigateToProperty() method for navigating to properties in the UI.'
        ],
        improved: [
            'Subfolder group headers in list pane ==are now clickable when grouping by folder==.',
            'The setting "Hide notes with properties" was renamed to "Hide notes with property rules". ==You can now hide properties with specific keys values==, like status=done, or published=true.',
            '==Tags and properties in File Item now show custom icons== within the pills if set. This makes it much easier to know which property is showing.'
        ],
        changed: [
            'Removed the setting ==Save icons and colors to frontmatter==. Icons and colors are now always saved to frontmatter if frontmatter metadata is enabled.',
            'Settings are now organized in a ==two-level hierarchy== with icons. Main groups (General, Navigation Pane, List Pane, Calendar) now have subtabs for easier navigation.',
            'Most placeholders now use english property names for all locales.'
        ],
        fixed: [
            'Fixed an issue where moving files did not update list pane until refreshing the view.',
            'Fixed an issue where full month calendar in navigation pane always reserved 6 lines, even if month had 4 or 5 weeks.',
            'Fixed an issue where clicking on a week in calendar view opened wrong week in some locales.'
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

/**
 * Determines whether release notes should appear automatically when upgrading between two versions.
 *
 * Upgrade decision rule:
 * - Evaluate release notes in the semantic range (fromVersion, toVersion]
 * - Return true when at least one note in that range has showOnUpdate not explicitly set to false
 *
 * Range resolution:
 * - If both versions exist in RELEASE_NOTES, use their index range in the ordered list
 * - If either version is missing, resolve the range by semantic version comparisons
 *
 * Non-upgrade transitions (same version or downgrade) use the target version setting.
 */
export function shouldAutoDisplayReleaseNotesForUpdate(fromVersion: string, toVersion: string): boolean {
    if (compareVersions(toVersion, fromVersion) <= 0) {
        return isReleaseAutoDisplayEnabled(toVersion);
    }

    const fromIndex = RELEASE_NOTES.findIndex(note => note.version === fromVersion);
    const toIndex = RELEASE_NOTES.findIndex(note => note.version === toVersion);

    const releaseNotesInUpgradePath =
        fromIndex === -1 || toIndex === -1
            ? RELEASE_NOTES.filter(note => compareVersions(note.version, fromVersion) > 0 && compareVersions(note.version, toVersion) <= 0)
            : RELEASE_NOTES.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex));

    if (releaseNotesInUpgradePath.length === 0) {
        return isReleaseAutoDisplayEnabled(toVersion);
    }

    return releaseNotesInUpgradePath.some(note => note.showOnUpdate !== false);
}
