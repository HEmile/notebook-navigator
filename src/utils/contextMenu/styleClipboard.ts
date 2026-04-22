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
 * Style data that can be copied and pasted between items
 */
export interface StyleClipboardData {
    icon?: string;
    color?: string;
    background?: string;
}

/**
 * Wrapper for clipboard data storage
 */
export interface StyleClipboardEntry {
    data: StyleClipboardData;
}

/** In-memory clipboard storage shared across all context menus */
let sharedClipboard: StyleClipboardEntry | null = null;

/**
 * Checks if the style data contains any values
 */
export function hasStyleData(data: StyleClipboardData): boolean {
    return Boolean(data.icon || data.color || data.background);
}

/**
 * Copies style data to the shared clipboard
 */
export function copyStyleToClipboard(data: StyleClipboardData): void {
    if (!hasStyleData(data)) {
        return;
    }

    sharedClipboard = {
        data
    };
}

/**
 * Retrieves the current style clipboard contents
 */
export function getStyleClipboard(): StyleClipboardEntry | null {
    return sharedClipboard;
}
