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

import { TFile, TFolder } from 'obsidian';
import type { SortOption, NotebookNavigatorSettings } from '../settings';
import { NavigationItemType, ItemType } from '../types';
import { getCurrentLanguage } from '../i18n';

/**
 * Available sort options in order they appear in menus
 */
export const SORT_OPTIONS: SortOption[] = ['modified-desc', 'modified-asc', 'created-desc', 'created-asc', 'title-asc', 'title-desc'];

/**
 * Natural string comparison that treats digit sequences as numbers.
 * Currently Obsidian restarts when locale changes, but this might change in the future.
 */
const collatorCache = new Map<string, Intl.Collator>();

export function naturalCompare(a: string, b: string, locale?: string): number {
    // Use Obsidian's language setting if no locale specified
    const effectiveLocale = locale || getCurrentLanguage();
    const key = effectiveLocale || 'default';
    let collator = collatorCache.get(key);
    if (!collator) {
        collator = new Intl.Collator(effectiveLocale, { numeric: true, sensitivity: 'base' });
        collatorCache.set(key, collator);
    }
    return collator.compare(a, b);
}

/**
 * Determines the effective sort option for a given context
 * @param settings - Plugin settings
 * @param selectionType - Whether folder or tag is selected
 * @param selectedFolder - The currently selected folder (if any)
 * @param selectedTag - The currently selected tag (if any)
 * @returns The sort option to use
 */
export function getEffectiveSortOption(
    settings: NotebookNavigatorSettings,
    selectionType: NavigationItemType,
    selectedFolder: TFolder | null,
    selectedTag?: string | null,
    selectedTopic?: string | null
): SortOption {
    if (selectionType === ItemType.FOLDER && selectedFolder && settings.folderSortOverrides?.[selectedFolder.path]) {
        return settings.folderSortOverrides[selectedFolder.path];
    }
    if (selectionType === ItemType.TAG && selectedTag && settings.tagSortOverrides?.[selectedTag]) {
        return settings.tagSortOverrides[selectedTag];
    }
    if (selectionType === ItemType.TOPIC && selectedTopic && settings.tagSortOverrides?.[selectedTopic]) {
        return settings.tagSortOverrides[selectedTopic];
    }
    return settings.defaultFolderSort;
}

/**
 * Sorts an array of files according to the specified sort option using getter functions
 * @param files - Array of files to sort (will be mutated)
 * @param sortOption - How to sort the files
 * @param getCreatedTime - Function to get file created time
 * @param getModifiedTime - Function to get file modified time
 */
export function sortFiles(
    files: TFile[],
    sortOption: SortOption,
    getCreatedTime: (file: TFile) => number,
    getModifiedTime: (file: TFile) => number,
    getDisplayName?: (file: TFile) => string
): void {
    // Helper function to get timestamp for sorting
    const getTimestamp = (file: TFile, type: 'created' | 'modified'): number => {
        return type === 'created' ? getCreatedTime(file) : getModifiedTime(file);
    };

    switch (sortOption) {
        case 'modified-desc':
            files.sort((a, b) => getTimestamp(b, 'modified') - getTimestamp(a, 'modified'));
            break;
        case 'modified-asc':
            files.sort((a, b) => getTimestamp(a, 'modified') - getTimestamp(b, 'modified'));
            break;
        case 'created-desc':
            files.sort((a, b) => getTimestamp(b, 'created') - getTimestamp(a, 'created'));
            break;
        case 'created-asc':
            files.sort((a, b) => getTimestamp(a, 'created') - getTimestamp(b, 'created'));
            break;
        case 'title-asc':
            files.sort((a, b) => {
                const nameA = getDisplayName ? getDisplayName(a) : a.basename;
                const nameB = getDisplayName ? getDisplayName(b) : b.basename;
                const cmp = naturalCompare(nameA, nameB);
                if (cmp !== 0) return cmp;
                // Tie-breaker 1: shorter name first (file1 before file001)
                if (nameA.length !== nameB.length) return nameA.length - nameB.length;
                // Tie-breaker 2: path for total ordering
                return a.path.localeCompare(b.path);
            });
            break;
        case 'title-desc':
            files.sort((a, b) => {
                const nameA = getDisplayName ? getDisplayName(a) : a.basename;
                const nameB = getDisplayName ? getDisplayName(b) : b.basename;
                const cmp = naturalCompare(nameA, nameB);
                if (cmp !== 0) return -cmp; // reverse order for desc
                // Keep tie-breakers consistent to ensure deterministic order across contexts
                if (nameA.length !== nameB.length) return nameA.length - nameB.length;
                return a.path.localeCompare(b.path);
            });
            break;
    }
}

/**
 * Gets the sort icon name based on sort option
 * @param sortOption - The current sort option
 * @returns Icon name for ObsidianIcon component
 */
export function getSortIcon(sortOption: SortOption): string {
    return sortOption.endsWith('-desc') ? 'lucide-sort-desc' : 'lucide-sort-asc';
}

/**
 * Gets the date field to use based on sort option
 * @param sortOption - The current sort option
 * @returns 'ctime' for created sorts, 'mtime' for others
 */
export function getDateField(sortOption: SortOption): 'ctime' | 'mtime' {
    return sortOption.startsWith('created') ? 'ctime' : 'mtime';
}
