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

import { App, WorkspaceLeaf } from 'obsidian';

export type SplitLocation = 'main' | 'left-sidebar' | 'right-sidebar' | 'unknown';

// Checks if a value is a non-null object
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

// Type guard for objects that expose a parent reference used in workspace tree
function hasParentRef(value: unknown): value is { parent?: unknown } {
    return isObject(value) && 'parent' in value;
}

/**
 * Determines the split location for a given leaf by walking its parent tree
 * and comparing against the workspace's root, left, and right splits.
 *
 * @param app - The Obsidian App instance
 * @param leaf - The WorkspaceLeaf to inspect
 * @returns Split location identifier
 */
export function getLeafSplitLocation(app: App, leaf: WorkspaceLeaf | null): SplitLocation {
    if (!leaf) return 'unknown';

    let current: unknown = leaf.parent;

    // Walk up the workspace item tree to find the top-level split
    while (current) {
        if (current === app.workspace.rootSplit) {
            return 'main';
        }
        if (current === app.workspace.leftSplit) {
            return 'left-sidebar';
        }
        if (current === app.workspace.rightSplit) {
            return 'right-sidebar';
        }

        if (!hasParentRef(current)) break;
        current = current.parent;
    }

    return 'unknown';
}
