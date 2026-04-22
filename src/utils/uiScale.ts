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

// Internal constants, only derived/step values exported
const MIN_UI_SCALE = 0.75;
const MAX_UI_SCALE = 1.5;
export const DEFAULT_UI_SCALE = 1;
const UI_SCALE_STEP = 0.05;
export const MIN_UI_SCALE_PERCENT = Math.round(MIN_UI_SCALE * 100);
export const MAX_UI_SCALE_PERCENT = Math.round(MAX_UI_SCALE * 100);
export const UI_SCALE_PERCENT_STEP = Math.round(UI_SCALE_STEP * 100);

/**
 * Ensures UI scale values stay within supported range and uses two decimal precision.
 */
export function sanitizeUIScale(value: number | null | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return DEFAULT_UI_SCALE;
    }
    if (value < MIN_UI_SCALE) {
        return MIN_UI_SCALE;
    }
    if (value > MAX_UI_SCALE) {
        return MAX_UI_SCALE;
    }
    return Math.round(value * 100) / 100;
}

/**
 * Formats a UI scale value as a percentage string for display.
 */
export function formatUIScalePercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

export function scaleToPercent(value: number): number {
    return Math.round(sanitizeUIScale(value) * 100);
}

export function percentToScale(value: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return DEFAULT_UI_SCALE;
    }
    const clampedPercent = Math.min(MAX_UI_SCALE_PERCENT, Math.max(MIN_UI_SCALE_PERCENT, Math.round(value)));
    return Math.round((clampedPercent / 100) * 100) / 100;
}
