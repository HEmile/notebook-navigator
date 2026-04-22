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

export type SearchMatchState = 'include' | 'exclude';

// Internal constants not exported to prevent unused exports
const SEARCH_MATCH_INCLUDE_CLASS = 'nn-navitem-content--search-include';
const SEARCH_MATCH_EXCLUDE_CLASS = 'nn-navitem-content--search-exclude';

/**
 * Build the class name for navigation item content that may be search-highlighted.
 * Ensures include/exclude styling remains consistent across components.
 */
export function buildSearchMatchContentClass(baseClasses: readonly string[], searchMatch?: SearchMatchState): string {
    const classes = [...baseClasses];

    if (searchMatch === 'include') {
        classes.push(SEARCH_MATCH_INCLUDE_CLASS);
    } else if (searchMatch === 'exclude') {
        classes.push(SEARCH_MATCH_EXCLUDE_CLASS);
    }

    return classes.join(' ');
}
