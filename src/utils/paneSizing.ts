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

import { NAVIGATION_PANE_DIMENSIONS, STORAGE_KEYS, type DualPaneOrientation } from '../types';

interface NavigationPaneSizing {
    defaultSize: number;
    minSize: number;
    storageKey: string;
}

/**
 * Returns sizing defaults and persistence keys for the navigation pane
 * based on the active dual-pane orientation.
 */
export function getNavigationPaneSizing(orientation: DualPaneOrientation): NavigationPaneSizing {
    if (orientation === 'vertical') {
        return {
            defaultSize: NAVIGATION_PANE_DIMENSIONS.defaultHeight,
            minSize: NAVIGATION_PANE_DIMENSIONS.minHeight,
            storageKey: STORAGE_KEYS.navigationPaneHeightKey
        };
    }

    return {
        defaultSize: NAVIGATION_PANE_DIMENSIONS.defaultWidth,
        minSize: NAVIGATION_PANE_DIMENSIONS.minWidth,
        storageKey: STORAGE_KEYS.navigationPaneWidthKey
    };
}
