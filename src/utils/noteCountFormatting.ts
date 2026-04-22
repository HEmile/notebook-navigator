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

import type { NoteCountInfo } from '../types/noteCounts';

export interface NoteCountDisplay {
    /** Whether the count should be rendered */
    shouldDisplay: boolean;
    /** Text representation for the count badge */
    label: string;
}

/**
 * Builds a formatted note-count label for folders, tags, and shortcuts.
 * Handles separate current/descendant formatting and hides zero values.
 */
export function buildNoteCountDisplay(
    countInfo: NoteCountInfo | undefined,
    includeDescendants: boolean,
    useSeparateCounts: boolean,
    descendantSeparator: string = '•'
): NoteCountDisplay {
    // Ensure counts are non-negative with fallback to zero
    const current = Math.max(0, countInfo?.current ?? 0);
    const descendants = includeDescendants ? Math.max(0, countInfo?.descendants ?? 0) : 0;
    const total = current + descendants;

    // Handle separate count display format (e.g., "2 • 5" for 2 current, 5 descendants)
    if (useSeparateCounts && includeDescendants) {
        let label = '';
        if (current === 0 && descendants === 0) {
            // No notes at all - hide the count
            label = '';
        } else if (descendants === 0) {
            // Only current notes, no descendants
            label = `${current}`;
        } else if (current === 0) {
            // Only descendant notes, no current ones
            label = `${descendantSeparator} ${descendants}`;
        } else {
            // Both current and descendant notes
            label = `${current} ${descendantSeparator} ${descendants}`;
        }

        return {
            shouldDisplay: label.length > 0,
            label
        };
    }

    // Handle combined count display format (single number)
    const combinedCount = includeDescendants ? total : current;
    const shouldDisplay = combinedCount > 0;

    return {
        shouldDisplay,
        label: shouldDisplay ? `${combinedCount}` : ''
    };
}

export function buildSortableNoteCountDisplay(
    noteCountDisplay: NoteCountDisplay,
    sortOrderIndicator: string | undefined
): NoteCountDisplay {
    if (!sortOrderIndicator) {
        return noteCountDisplay;
    }

    if (!noteCountDisplay.shouldDisplay) {
        return {
            shouldDisplay: true,
            label: sortOrderIndicator
        };
    }

    return {
        shouldDisplay: true,
        label: `${sortOrderIndicator} ${noteCountDisplay.label}`
    };
}
