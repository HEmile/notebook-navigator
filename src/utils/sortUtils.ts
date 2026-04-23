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
import type { AlphabeticalDateMode, AlphaSortOrder, SortOption, NotebookNavigatorSettings, PropertySortSecondaryOption } from '../settings';
import { NavigationItemType, ItemType } from '../types';

export { SORT_OPTIONS } from '../settings/types';

export function isDateSortOption(sortOption: SortOption): boolean {
    return sortOption.startsWith('modified') || sortOption.startsWith('created');
}

function isAlphabeticalSortOption(sortOption: SortOption): boolean {
    return !isDateSortOption(sortOption);
}

export function isPropertySortOption(sortOption: SortOption): sortOption is 'property-asc' | 'property-desc' {
    return sortOption === 'property-asc' || sortOption === 'property-desc';
}

export function shouldRefreshOnFileModifyForSort(sortOption: SortOption, propertySortSecondary: PropertySortSecondaryOption): boolean {
    return sortOption.startsWith('modified') || (isPropertySortOption(sortOption) && propertySortSecondary === 'modified');
}

export function shouldRefreshOnMetadataChangeForSort(params: {
    sortOption: SortOption;
    propertySortKey: string;
    propertySortSecondary: PropertySortSecondaryOption;
    useFrontmatterMetadata: boolean;
    frontmatterNameField: string;
    frontmatterCreatedField: string;
    frontmatterModifiedField: string;
}): boolean {
    const {
        sortOption,
        propertySortKey,
        propertySortSecondary,
        useFrontmatterMetadata,
        frontmatterNameField,
        frontmatterCreatedField,
        frontmatterModifiedField
    } = params;
    if (!isPropertySortOption(sortOption)) {
        // Date/title sorts depend on frontmatter values when configured; metadata changes must refresh the ordering.
        if (!useFrontmatterMetadata) {
            return false;
        }

        if (sortOption.startsWith('created')) {
            return frontmatterCreatedField.trim().length > 0;
        }

        if (sortOption.startsWith('modified')) {
            return frontmatterModifiedField.trim().length > 0;
        }

        if (sortOption.startsWith('title')) {
            return frontmatterNameField.trim().length > 0;
        }

        return false;
    }

    if (propertySortKey.trim().length > 0) {
        return true;
    }

    if (!useFrontmatterMetadata) {
        return false;
    }

    if (propertySortSecondary === 'created') {
        return frontmatterCreatedField.trim().length > 0;
    }

    if (propertySortSecondary === 'modified') {
        return frontmatterModifiedField.trim().length > 0;
    }

    if (propertySortSecondary === 'title') {
        return frontmatterNameField.trim().length > 0;
    }

    return false;
}

/**
 * Natural string comparison that treats digit sequences as numbers.
 */
const collatorCache = new Map<string, Intl.Collator>();

export function naturalCompare(a: string, b: string): number {
    const cacheKey = 'system';
    let collator = collatorCache.get(cacheKey);
    if (!collator) {
        collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base', usage: 'sort' });
        collatorCache.set(cacheKey, collator);
    }
    return collator.compare(a, b);
}

/**
 * Natural string comparison that applies alphabetical direction.
 */
export function compareByAlphaSortOrder(a: string, b: string, sortOrder: AlphaSortOrder): number {
    const cmp = naturalCompare(a, b);
    if (cmp === 0) {
        return 0;
    }
    return sortOrder === 'alpha-desc' ? -cmp : cmp;
}

interface FolderChildSortOrderSettings {
    folderSortOrder: AlphaSortOrder;
    folderTreeSortOverrides?: Readonly<Record<string, AlphaSortOrder>> | null;
}

/**
 * Resolves the effective child-folder alphabetical order for the given folder path.
 */
export function resolveFolderChildSortOrder(settings: FolderChildSortOrderSettings, folderPath: string): AlphaSortOrder {
    const overrides = settings.folderTreeSortOverrides;
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, folderPath)) {
        return overrides[folderPath] ?? settings.folderSortOrder;
    }

    return settings.folderSortOrder;
}

function compareTextValues(valueA: string, valueB: string, descending: boolean): number {
    const cmp = naturalCompare(valueA, valueB);
    if (cmp !== 0) {
        return descending ? -cmp : cmp;
    }
    if (valueA.length !== valueB.length) {
        return valueA.length - valueB.length;
    }
    return 0;
}

function compareDisplayNames(a: TFile, b: TFile, getDisplayName: ((file: TFile) => string) | undefined, descending: boolean): number {
    const nameA = getDisplayName ? getDisplayName(a) : a.basename;
    const nameB = getDisplayName ? getDisplayName(b) : b.basename;
    return compareTextValues(nameA, nameB, descending);
}

function compareFileNames(a: TFile, b: TFile, descending: boolean): number {
    return compareTextValues(a.basename, b.basename, descending);
}

function compareDates(a: TFile, b: TFile, getDate: (file: TFile) => number, descending: boolean): number {
    const cmp = getDate(a) - getDate(b);
    if (cmp === 0) {
        return 0;
    }
    return descending ? -cmp : cmp;
}

/**
 * Determines the effective sort option for a given context
 * @param settings - Plugin settings
 * @param selectionType - Active navigation scope
 * @param selectedFolder - The currently selected folder (if any)
 * @param selectedTag - The currently selected tag (if any)
 * @param selectedProperty - The currently selected property node id (if any)
 * @returns The sort option to use
 */
export function getEffectiveSortOption(
    settings: NotebookNavigatorSettings,
    selectionType: NavigationItemType,
    selectedFolder: TFolder | null,
    selectedTag?: string | null,
    selectedProperty?: string | null,
    selectedTopic?: string | null
): SortOption {
    if (selectionType === ItemType.FOLDER && selectedFolder && settings.folderSortOverrides?.[selectedFolder.path]) {
        return settings.folderSortOverrides[selectedFolder.path];
    }
    if (selectionType === ItemType.TAG && selectedTag && settings.tagSortOverrides?.[selectedTag]) {
        return settings.tagSortOverrides[selectedTag];
    }
    if (selectionType === ItemType.PROPERTY && selectedProperty && settings.propertySortOverrides?.[selectedProperty]) {
        return settings.propertySortOverrides[selectedProperty];
    }
    if (selectionType === ItemType.TOPIC && selectedTopic && settings.topicSortOverrides?.[selectedTopic]) {
        return settings.topicSortOverrides[selectedTopic];
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
    getDisplayName?: (file: TFile) => string,
    getPropertyValue?: (file: TFile) => string | null,
    propertySortSecondary: PropertySortSecondaryOption = 'title'
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
                const cmp = compareDisplayNames(a, b, getDisplayName, false);
                if (cmp !== 0) return cmp;
                return a.path.localeCompare(b.path);
            });
            break;
        case 'title-desc':
            files.sort((a, b) => {
                const cmp = compareDisplayNames(a, b, getDisplayName, true);
                if (cmp !== 0) return cmp;
                return a.path.localeCompare(b.path);
            });
            break;
        case 'filename-asc':
            files.sort((a, b) => {
                const cmp = compareFileNames(a, b, false);
                if (cmp !== 0) return cmp;
                return a.path.localeCompare(b.path);
            });
            break;
        case 'filename-desc':
            files.sort((a, b) => {
                const cmp = compareFileNames(a, b, true);
                if (cmp !== 0) return cmp;
                return a.path.localeCompare(b.path);
            });
            break;
        case 'property-asc':
        case 'property-desc': {
            const descending = sortOption === 'property-desc';
            files.sort((a, b) => {
                const valueA = getPropertyValue ? getPropertyValue(a) : null;
                const valueB = getPropertyValue ? getPropertyValue(b) : null;
                const hasValueA = Boolean(valueA);
                const hasValueB = Boolean(valueB);

                if (hasValueA !== hasValueB) {
                    return hasValueA ? -1 : 1;
                }

                if (hasValueA && hasValueB && valueA && valueB) {
                    const cmp = compareTextValues(valueA, valueB, descending);
                    if (cmp !== 0) {
                        return cmp;
                    }
                }

                let secondaryCmp = 0;
                if (propertySortSecondary === 'created') {
                    secondaryCmp = compareDates(a, b, getCreatedTime, descending);
                } else if (propertySortSecondary === 'modified') {
                    secondaryCmp = compareDates(a, b, getModifiedTime, descending);
                } else if (propertySortSecondary === 'filename') {
                    secondaryCmp = compareFileNames(a, b, descending);
                } else {
                    secondaryCmp = compareDisplayNames(a, b, getDisplayName, descending);
                }
                if (secondaryCmp !== 0) {
                    return secondaryCmp;
                }

                if (propertySortSecondary !== 'title') {
                    const titleCmp = compareDisplayNames(a, b, getDisplayName, descending);
                    if (titleCmp !== 0) {
                        return titleCmp;
                    }
                }

                return a.path.localeCompare(b.path);
            });
            break;
        }
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

/**
 * Resolves which date field to use based on sort option and alphabetical date mode setting.
 * For date sorts, uses the sort field; for alphabetical sorts, uses the user preference.
 */
export function resolveDefaultDateField(sortOption: SortOption, alphabeticalDateMode: AlphabeticalDateMode): 'created' | 'modified' {
    if (isAlphabeticalSortOption(sortOption)) {
        return alphabeticalDateMode === 'created' ? 'created' : 'modified';
    }

    return getDateField(sortOption) === 'ctime' ? 'created' : 'modified';
}
