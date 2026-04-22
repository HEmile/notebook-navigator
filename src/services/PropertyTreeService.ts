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

import type { IPropertyTreeProvider } from '../interfaces/IPropertyTreeProvider';
import type { PropertyTreeNode } from '../types/storage';
import {
    collectPropertyKeyFilePaths,
    collectPropertyValueFilePaths,
    resolvePropertySelectionNodeId,
    type PropertySelectionNodeId
} from '../utils/propertyTree';

/**
 * Service that provides access to the property tree from StorageContext.
 * Acts as a bridge between React state and non-React code.
 */
export class PropertyTreeService implements IPropertyTreeProvider {
    private propertyTree: Map<string, PropertyTreeNode> = new Map();
    private propertyNodeById: Map<string, PropertyTreeNode> = new Map();
    private descendantNodeIdsByNode: WeakMap<PropertyTreeNode, readonly string[]> = new WeakMap();
    private filePathsByNodeAndMode: WeakMap<
        PropertyTreeNode,
        { direct: readonly string[] | null; withDescendants: readonly string[] | null }
    > = new WeakMap();
    private treeUpdateListeners = new Set<() => void>();

    /**
     * Updates the property tree data from StorageContext.
     */
    updatePropertyTree(tree: Map<string, PropertyTreeNode>): void {
        this.propertyTree = tree;
        this.rebuildIndexes(tree);
        this.descendantNodeIdsByNode = new WeakMap();
        this.filePathsByNodeAndMode = new WeakMap();
        this.notifyTreeUpdateListeners();
    }

    /**
     * Gets the current property tree.
     */
    getPropertyTree(): Map<string, PropertyTreeNode> {
        return this.propertyTree;
    }

    /**
     * Returns whether the property tree has any indexed nodes.
     */
    hasNodes(): boolean {
        return this.propertyNodeById.size > 0;
    }

    /**
     * Subscribes to tree updates.
     * Returns an unsubscribe callback.
     */
    addTreeUpdateListener(listener: () => void): () => void {
        this.treeUpdateListeners.add(listener);
        return () => {
            this.treeUpdateListeners.delete(listener);
        };
    }

    /**
     * Finds a property tree node by canonical node id.
     */
    findNode(nodeId: string): PropertyTreeNode | null {
        return this.propertyNodeById.get(nodeId) ?? null;
    }

    /**
     * Finds a key node by normalized property key.
     */
    getKeyNode(normalizedKey: string): PropertyTreeNode | null {
        return this.propertyTree.get(normalizedKey) ?? null;
    }

    /**
     * Resolves a property selection id against the current property tree.
     */
    resolveSelectionNodeId(selectionNodeId: PropertySelectionNodeId): PropertySelectionNodeId {
        return resolvePropertySelectionNodeId(this.propertyTree, selectionNodeId);
    }

    /**
     * Collects descendant node ids for the provided node id.
     */
    collectDescendantNodeIds(nodeId: string): Set<string> {
        const rootNode = this.findNode(nodeId);
        if (!rootNode) {
            return new Set();
        }

        const cachedIds = this.descendantNodeIdsByNode.get(rootNode);
        if (cachedIds) {
            return new Set(cachedIds);
        }

        const ids = new Set<string>();
        const visited = new Set<PropertyTreeNode>();

        const visit = (node: PropertyTreeNode) => {
            if (visited.has(node)) {
                return;
            }
            visited.add(node);

            for (const child of node.children.values()) {
                ids.add(child.id);
                visit(child);
            }
        };

        visit(rootNode);
        this.descendantNodeIdsByNode.set(rootNode, Array.from(ids));
        return ids;
    }

    /**
     * Collects file paths for a node id.
     */
    collectFilePaths(nodeId: string, includeDescendants: boolean): Set<string> {
        const node = this.findNode(nodeId);
        if (!node) {
            return new Set();
        }

        if (node.kind === 'value') {
            const cachedValuePaths = this.filePathsByNodeAndMode.get(node);
            const cached = cachedValuePaths?.direct ?? cachedValuePaths?.withDescendants;
            if (cached) {
                return new Set(cached);
            }

            const filePaths = this.collectNodeFilePaths(node, includeDescendants);
            const normalizedPaths = Array.from(filePaths);
            this.filePathsByNodeAndMode.set(node, { direct: normalizedPaths, withDescendants: normalizedPaths });
            return new Set(normalizedPaths);
        }

        const modeKey = includeDescendants ? 'withDescendants' : 'direct';
        const cacheEntry = this.filePathsByNodeAndMode.get(node);
        const cachedPaths = cacheEntry?.[modeKey];
        if (cachedPaths) {
            return new Set(cachedPaths);
        }

        const filePaths = this.collectNodeFilePaths(node, includeDescendants);
        const normalizedPaths = Array.from(filePaths);
        this.filePathsByNodeAndMode.set(node, {
            direct: modeKey === 'direct' ? normalizedPaths : (cacheEntry?.direct ?? null),
            withDescendants: modeKey === 'withDescendants' ? normalizedPaths : (cacheEntry?.withDescendants ?? null)
        });

        return new Set(normalizedPaths);
    }

    /**
     * Collects file paths for the provided normalized key set.
     */
    collectFilesForKeys(normalizedKeys: Iterable<string>): Set<string> {
        const filePaths = new Set<string>();

        for (const normalizedKey of normalizedKeys) {
            const keyNode = this.getKeyNode(normalizedKey);
            if (!keyNode) {
                continue;
            }
            keyNode.notesWithValue.forEach(path => filePaths.add(path));
        }

        return filePaths;
    }

    private rebuildIndexes(tree: Map<string, PropertyTreeNode>): void {
        const nodeById = new Map<string, PropertyTreeNode>();
        const visited = new Set<PropertyTreeNode>();

        const visitNode = (node: PropertyTreeNode) => {
            if (visited.has(node)) {
                return;
            }
            visited.add(node);

            nodeById.set(node.id, node);

            for (const child of node.children.values()) {
                visitNode(child);
            }
        };

        for (const rootNode of tree.values()) {
            visitNode(rootNode);
        }

        this.propertyNodeById = nodeById;
    }

    private notifyTreeUpdateListeners(): void {
        this.treeUpdateListeners.forEach(listener => {
            listener();
        });
    }

    private collectNodeFilePaths(node: PropertyTreeNode, includeDescendants: boolean): Set<string> {
        if (node.kind === 'key') {
            return collectPropertyKeyFilePaths(node, includeDescendants);
        }

        if (!node.valuePath) {
            return new Set<string>();
        }

        const keyNode = this.getKeyNode(node.key);
        if (!keyNode) {
            return new Set<string>();
        }

        return collectPropertyValueFilePaths(keyNode, node.valuePath);
    }
}
