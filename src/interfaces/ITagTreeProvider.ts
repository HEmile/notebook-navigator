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

import type { TagTreeNode } from '../types/storage';

/**
 * Interface for providing access to tag tree data.
 * Tag consumers address nodes by canonical path strings.
 */
export interface ITagTreeProvider {
    /**
     * Subscribes to tag tree updates.
     * Returns an unsubscribe callback.
     */
    addTreeUpdateListener(listener: () => void): () => void;
    /**
     * Returns whether the tag tree currently contains any nodes.
     */
    hasNodes(): boolean;
    /**
     * Finds a tag node by canonical tag path.
     */
    findTagNode(tagPath: string): TagTreeNode | null;
    /**
     * Resolves a selected tag path against the current tree.
     * Returns the canonical existing path, nearest existing ancestor, or null.
     */
    resolveSelectionTagPath(tagPath: string): string | null;
    /**
     * Gets all tag paths from the tag tree.
     */
    getAllTagPaths(): readonly string[];
    /**
     * Collects descendant tag paths for the selected tag path.
     * Does not include the selected path itself.
     */
    collectDescendantTagPaths(tagPath: string): Set<string>;
    /**
     * Collects file paths for the selected tag and descendants.
     */
    collectTagFilePaths(tagPath: string): string[];
}
