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

import { DEFAULT_NAVIGATION_SECTION_ORDER, NavigationSectionId } from '../types';

// Set of valid navigation section identifiers for quick lookup
const NAVIGATION_SECTION_VALUES = new Set<NavigationSectionId>(DEFAULT_NAVIGATION_SECTION_ORDER);

// Returns a valid NavigationSectionId when input matches a known identifier, otherwise null
function coerceNavigationSectionId(value: unknown): NavigationSectionId | null {
    if (typeof value !== 'string') {
        return null;
    }

    if (NAVIGATION_SECTION_VALUES.has(value as NavigationSectionId)) {
        return value as NavigationSectionId;
    }

    return null;
}

// Ensures all navigation sections are present in the order array and removes duplicates
export function sanitizeNavigationSectionOrder(order: NavigationSectionId[]): NavigationSectionId[] {
    const seen = new Set<NavigationSectionId>();
    const normalized: NavigationSectionId[] = [];

    // Process existing order, filtering out duplicates and invalid values
    order.forEach(identifier => {
        if (!NAVIGATION_SECTION_VALUES.has(identifier)) {
            return;
        }
        if (seen.has(identifier)) {
            return;
        }
        seen.add(identifier);
        normalized.push(identifier);
    });

    // Add any missing sections from the default order to maintain completeness
    DEFAULT_NAVIGATION_SECTION_ORDER.forEach(identifier => {
        if (seen.has(identifier)) {
            return;
        }
        seen.add(identifier);
        normalized.push(identifier);
    });

    return normalized;
}

// Validates and normalizes user input for navigation section order from local storage
export function normalizeNavigationSectionOrderInput(input: unknown): NavigationSectionId[] {
    if (!Array.isArray(input)) {
        return [...DEFAULT_NAVIGATION_SECTION_ORDER];
    }

    const parsed = input.map(coerceNavigationSectionId).filter((identifier): identifier is NavigationSectionId => Boolean(identifier));
    return sanitizeNavigationSectionOrder(parsed);
}

// Merges newly ordered keys with the previous order, maintaining any sections not in orderedKeys
export function mergeNavigationSectionOrder(orderedKeys: string[], previous: NavigationSectionId[]): NavigationSectionId[] {
    const merged: NavigationSectionId[] = [];
    const seen = new Set<NavigationSectionId>();

    orderedKeys.forEach(key => {
        const identifier = coerceNavigationSectionId(key);
        if (!identifier) {
            return;
        }
        if (seen.has(identifier)) {
            return;
        }
        seen.add(identifier);
        merged.push(identifier);
    });

    previous.forEach(identifier => {
        if (seen.has(identifier)) {
            return;
        }
        seen.add(identifier);
        merged.push(identifier);
    });

    return sanitizeNavigationSectionOrder(merged);
}
