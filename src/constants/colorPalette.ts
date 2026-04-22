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

export const DEFAULT_USER_COLORS: readonly string[] = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#ec4899',
    '#f43f5e',
    '#6b7280',
    '#64748b',
    '#78716c'
] as const;

export const USER_COLOR_SLOT_COUNT = DEFAULT_USER_COLORS.length;

/** Fallback color for empty custom palette slots */
export const DEFAULT_CUSTOM_COLOR = '#404040';

/** Initial grayscale colors for the first row of the custom palette */
const DEFAULT_CUSTOM_ROW = ['#ffffff', '#d9d9d9', '#a6a6a6', '#737373', '#000000'];

/** Default custom color palette, filled with grayscale row then fallback color */
export const DEFAULT_CUSTOM_COLORS = Array.from({ length: USER_COLOR_SLOT_COUNT }, (_, index) =>
    index < DEFAULT_CUSTOM_ROW.length ? DEFAULT_CUSTOM_ROW[index] : DEFAULT_CUSTOM_COLOR
);

/** Maximum number of recent colors to keep in history */
export const MAX_RECENT_COLORS = 10;
