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

import type { PropertyTreeNode } from '../types/storage';
import type { PropertySelectionNodeId } from '../utils/propertyTree';

/**
 * Interface for property tree access used by consumers outside StorageContext.
 * Property consumers address nodes by canonical node ids and normalized keys.
 */
export interface IPropertyTreeProvider {
    /**
     * Subscribes to property tree updates.
     * Returns an unsubscribe callback.
     */
    addTreeUpdateListener(listener: () => void): () => void;
    /**
     * Returns whether the property tree currently contains any nodes.
     */
    hasNodes(): boolean;
    /**
     * Finds a property node by canonical node id.
     */
    findNode(nodeId: string): PropertyTreeNode | null;
    /**
     * Finds a key node by canonical normalized key.
     */
    getKeyNode(normalizedKey: string): PropertyTreeNode | null;
    /**
     * Resolves a selection id against the current property tree.
     */
    resolveSelectionNodeId(selectionNodeId: PropertySelectionNodeId): PropertySelectionNodeId;
    /**
     * Collects descendant node ids for the provided node id.
     */
    collectDescendantNodeIds(nodeId: string): Set<string>;
    /**
     * Collects file paths for the provided property node id.
     */
    collectFilePaths(nodeId: string, includeDescendants: boolean): Set<string>;
    /**
     * Collects file paths for a set of normalized property keys.
     * Used by the properties-root selection without exposing node internals.
     */
    collectFilesForKeys(normalizedKeys: Iterable<string>): Set<string>;
}
