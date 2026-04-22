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

// Shared scroll types and helpers

export type Align = 'auto' | 'center' | 'start' | 'end';

// Navigation pane scroll intents
export type NavScrollIntent = 'selection' | 'startup' | 'reveal' | 'visibilityToggle' | 'external' | 'mobile-visibility';

// List pane scroll intents
export type ListScrollIntent = 'folder-navigation' | 'visibility-change' | 'reveal' | 'list-structure-change';

// Determine alignment for navigation pane based on intent and explicit override
export function getNavAlign(intent?: NavScrollIntent): Align {
    switch (intent) {
        case 'visibilityToggle':
        case 'mobile-visibility':
            return 'auto';
        case 'selection':
            return Platform.isMobile ? 'center' : 'auto';
        case 'reveal':
        case 'external':
            return 'auto';
        default:
            return 'center';
    }
}

import { Platform } from 'obsidian';

// Determine alignment for list pane based on intent and platform
export function getListAlign(reason?: ListScrollIntent): Align {
    switch (reason) {
        case 'folder-navigation':
            return Platform.isMobile ? 'center' : 'auto';
        case 'visibility-change':
            return 'auto';
        case 'list-structure-change':
            return 'auto';
        case 'reveal':
        default:
            return 'auto';
    }
}

// Rank list pane pending requests for simple coalescing
export function rankListPending(p?: { type: 'file' | 'top'; reason?: ListScrollIntent }): number {
    if (!p) return -1;
    if (p.type === 'top') return 0;
    switch (p.reason) {
        case 'list-structure-change':
            return 1; // Maintain position after list changes
        case 'visibility-change':
            return 2; // Pane became visible on mobile
        case 'folder-navigation':
            return 3; // User navigated to a different folder/tag
        case 'reveal':
            return 4; // Explicit reveal of active file
        default:
            return 1;
    }
}
