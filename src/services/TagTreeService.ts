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

import { TagTreeNode } from '../types/storage';
import { findTagNode, collectAllTagPaths, collectTagFilePaths as collectTagFilePathsFromNode } from '../utils/tagTree';
import { ITagTreeProvider } from '../interfaces/ITagTreeProvider';
import { naturalCompare } from '../utils/sortUtils';
import { normalizeTagPathValue } from '../utils/tagPrefixMatcher';

/**
 * Service that provides access to the tag tree from StorageContext
 * Acts as a bridge between React (StorageContext) and non-React code
 */
export class TagTreeService implements ITagTreeProvider {
    private tagTree: Map<string, TagTreeNode> = new Map();
    private tagNodeByPath: Map<string, TagTreeNode> = new Map();
    private taggedCount = 0;
    private untaggedCount = 0;
    private flattenedTags: TagTreeNode[] = [];
    private cachedTagPaths: string[] | null = null;
    private descendantTagPathsByNode: WeakMap<TagTreeNode, readonly string[]> = new WeakMap();
    private descendantFilePathsByNode: WeakMap<TagTreeNode, readonly string[]> = new WeakMap();
    private treeUpdateListeners = new Set<() => void>();

    /**
     * Updates the tag tree data from StorageContext
     * Called whenever StorageContext rebuilds the tag tree
     */
    updateTagTree(tree: Map<string, TagTreeNode>, tagged: number, untagged: number): void {
        const { nodeByPath, flattenedTags } = this.rebuildTreeIndexes(tree);
        this.tagTree = tree;
        this.tagNodeByPath = nodeByPath;
        this.taggedCount = tagged;
        this.untaggedCount = untagged;
        this.flattenedTags = flattenedTags;
        this.cachedTagPaths = null;
        this.descendantTagPathsByNode = new WeakMap();
        this.descendantFilePathsByNode = new WeakMap();
        this.notifyTreeUpdateListeners();
    }

    /**
     * Gets the current tag tree
     */
    getTagTree(): Map<string, TagTreeNode> {
        return this.tagTree;
    }

    /**
     * Returns whether the tag tree has any indexed nodes.
     */
    hasNodes(): boolean {
        return this.tagNodeByPath.size > 0;
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
     * Gets the count of untagged files
     */
    getUntaggedCount(): number {
        return this.untaggedCount;
    }

    /**
     * Finds a tag node by its path within the tag tree
     */
    findTagNode(tagPath: string): TagTreeNode | null {
        const normalizedPath = this.normalizeLookupPath(tagPath);
        if (normalizedPath.length > 0) {
            const indexedNode = this.tagNodeByPath.get(normalizedPath);
            if (indexedNode) {
                return indexedNode;
            }
        }

        return findTagNode(this.tagTree, tagPath);
    }

    /**
     * Resolves a selected tag path against the current tree.
     * Returns canonical node path, nearest existing parent path, or null.
     */
    resolveSelectionTagPath(tagPath: string): string | null {
        const selectedNode = this.findTagNode(tagPath);
        if (selectedNode) {
            return selectedNode.path;
        }

        let fallbackPath = this.normalizeLookupPath(tagPath);
        while (fallbackPath.includes('/')) {
            fallbackPath = fallbackPath.slice(0, fallbackPath.lastIndexOf('/'));
            if (!fallbackPath) {
                break;
            }

            const fallbackNode = this.findTagNode(fallbackPath);
            if (fallbackNode) {
                return fallbackNode.path;
            }
        }

        return null;
    }

    /**
     * Gets all tag paths in the tree
     */
    getAllTagPaths(): readonly string[] {
        if (!this.cachedTagPaths) {
            this.cachedTagPaths = this.flattenedTags.map(node => node.path);
        }
        return [...this.cachedTagPaths];
    }

    /**
     * Gets all tag nodes in a flattened array, sorted alphabetically
     */
    getFlattenedTagNodes(): readonly TagTreeNode[] {
        return this.flattenedTags;
    }

    /**
     * Collects descendant tag paths for the selected tag path.
     * Does not include the selected tag path itself.
     */
    collectDescendantTagPaths(tagPath: string): Set<string> {
        const node = this.findTagNode(tagPath);
        if (!node) {
            return new Set();
        }

        const paths = this.collectTagPaths(node);
        paths.delete(node.path);
        return paths;
    }

    /**
     * Collects all tag paths from a specific node and its descendants.
     */
    private collectTagPaths(node: TagTreeNode): Set<string> {
        const cachedPaths = this.descendantTagPathsByNode.get(node);
        if (cachedPaths) {
            return new Set(cachedPaths);
        }

        const paths = Array.from(collectAllTagPaths(node));
        this.descendantTagPathsByNode.set(node, paths);
        return new Set(paths);
    }

    /**
     * Collects file paths for the specified tag and its descendants.
     */
    collectTagFilePaths(tagPath: string): string[] {
        const node = this.findTagNode(tagPath);
        if (!node) {
            return [];
        }

        const cachedPaths = this.descendantFilePathsByNode.get(node);
        if (cachedPaths) {
            return [...cachedPaths];
        }

        const files = Array.from(collectTagFilePathsFromNode(node));
        this.descendantFilePathsByNode.set(node, files);
        return [...files];
    }
    /**
     * Gets the count of tagged files
     */
    getTaggedCount(): number {
        return this.taggedCount;
    }

    private normalizeLookupPath(tagPath: string): string {
        return normalizeTagPathValue(tagPath);
    }

    private rebuildTreeIndexes(tree: Map<string, TagTreeNode>): { nodeByPath: Map<string, TagTreeNode>; flattenedTags: TagTreeNode[] } {
        const nodeByPath = new Map<string, TagTreeNode>();
        const flattenedTags: TagTreeNode[] = [];
        const visited = new Set<TagTreeNode>();
        const stack: TagTreeNode[] = [];

        for (const rootNode of tree.values()) {
            stack.push(rootNode);
        }

        while (stack.length > 0) {
            const node = stack.pop();
            if (!node || visited.has(node)) {
                continue;
            }
            visited.add(node);

            if (!nodeByPath.has(node.path)) {
                nodeByPath.set(node.path, node);
            }
            if (node.displayPath.length > 0) {
                flattenedTags.push(node);
            }

            node.children.forEach(child => {
                stack.push(child);
            });
        }

        flattenedTags.sort((a, b) => naturalCompare(a.displayPath, b.displayPath));
        return { nodeByPath, flattenedTags };
    }

    private notifyTreeUpdateListeners(): void {
        this.treeUpdateListeners.forEach(listener => {
            listener();
        });
    }
}
