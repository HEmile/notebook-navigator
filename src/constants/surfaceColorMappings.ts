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

import type { SurfaceVariableMapping } from '../hooks/useSurfaceColorVariables';

export const LIST_PANE_SURFACE_COLOR_MAPPINGS: SurfaceVariableMapping[] = [
    { source: '--nn-theme-file-selected-bg', target: '--nn-computed-file-selected-bg' },
    { source: '--nn-theme-file-selected-inactive-bg', target: '--nn-computed-file-selected-inactive-bg' }
];

export const NAVIGATION_PANE_SURFACE_COLOR_MAPPINGS: SurfaceVariableMapping[] = [
    { source: '--nn-theme-navitem-selected-bg', target: '--nn-computed-navitem-selected-bg' },
    { source: '--nn-theme-navitem-selected-inactive-bg', target: '--nn-computed-navitem-selected-inactive-bg' },
    { source: '--nn-theme-tag-positive-bg', target: '--nn-computed-tag-positive-bg' },
    { source: '--nn-theme-tag-negative-bg', target: '--nn-computed-tag-negative-bg' }
];
