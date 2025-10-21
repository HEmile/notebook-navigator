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
 * Chrome 128+ on Android breaks drag and drop with custom MIME types.
 * This module tracks internal drag operations using module-level state
 * instead of dataTransfer to work around the Chromium bug.
 */

export type InternalDragType = 'shortcut' | 'navigation-root';

// Module-level state tracking active drag operation type
let activeInternalDrag: InternalDragType | null = null;

/**
 * Marks the beginning of an internal drag operation such as shortcut or root navigation reordering.
 */
export function beginInternalDrag(type: InternalDragType) {
    activeInternalDrag = type;
}

/**
 * Clears the active internal drag state when the drag operation completes or cancels.
 */
export function endInternalDrag(type: InternalDragType) {
    if (activeInternalDrag === type) {
        activeInternalDrag = null;
    }
}

/**
 * Returns true when an internal drag is in progress. When a type is provided, checks for that specific drag kind.
 */
export function isInternalDragActive(type?: InternalDragType): boolean {
    if (!type) {
        return activeInternalDrag !== null;
    }
    return activeInternalDrag === type;
}
