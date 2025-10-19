/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { IndexedDBStorage } from '../storage/IndexedDBStorage';
import { TagTreeNode, NNNode } from '../types/storage';
import { isPathInExcludedFolder } from './fileFilters';
import { HiddenTagMatcher, matchesHiddenTagPattern, normalizeTagPathValue } from './tagPrefixMatcher';
import { naturalCompare } from './sortUtils';

/**
 * Tag Tree Utilities
 *
 * This module provides functions for building and managing hierarchical tag trees
 * from various data sources (vault files, database).
 */

// Cache for note counts to avoid recalculation
let noteCountCache: WeakMap<TagTreeNode, number> | null = null;

/**
 * Clear the note count cache
 */
export function clearNoteCountCache(): void {
    noteCountCache = null;
}

/**
 * Get or create the note count cache
 */
function getNoteCountCache(): WeakMap<NNNode, number> {
    if (!noteCountCache) {
        noteCountCache = new WeakMap();
    }
    return noteCountCache;
}

/**
 * Build tag tree from database
 * @param db - IndexedDBStorage instance
 * @param excludedFolderPatterns - Optional array of folder patterns to exclude
 * @returns Object containing tag tree and untagged file count
 */
export function buildTagTreeFromDatabase(
    db: IndexedDBStorage,
    excludedFolderPatterns?: string[],
    includedPaths?: Set<string>
): { tagTree: Map<string, TagTreeNode>; untagged: number } {
    // Track all unique tags that exist in the vault
    const allTagsSet = new Set<string>();
    let untaggedCount = 0;

    const caseMap = new Map<string, string>();

    // Map to store file associations for each tag
    const tagFiles = new Map<string, Set<string>>();

    // Get all files from cache
    const allFiles = db.getAllFiles();

    // First pass: collect all tags and their file associations
    for (const { path, data: fileData } of allFiles) {
        // Defense-in-depth: skip files not in the included set (e.g., frontmatter-excluded)
        if (includedPaths && !includedPaths.has(path)) {
            continue;
        }
        // Skip files in excluded folders if patterns provided
        if (excludedFolderPatterns && isPathInExcludedFolder(path, excludedFolderPatterns)) {
            continue;
        }

        const tags = fileData.tags;

        // Skip files with null tags (not extracted yet) or empty tags
        if (tags === null || tags.length === 0) {
            // Only count markdown files as untagged (since only they can have tags)
            if (tags !== null && path.endsWith('.md')) {
                untaggedCount++;
            }
            continue;
        }

        // Process each tag
        for (const tag of tags) {
            const canonicalPath = (tag.startsWith('#') ? tag.substring(1) : tag).replace(/^\/+|\/+$/g, '');
            const normalizedPath = normalizeTagPathValue(tag);
            if (canonicalPath.length === 0 || normalizedPath.length === 0) {
                continue;
            }

            let storedCanonical = caseMap.get(normalizedPath);
            if (!storedCanonical) {
                storedCanonical = canonicalPath;
                caseMap.set(normalizedPath, storedCanonical);
            }

            // Add to all tags set
            allTagsSet.add(storedCanonical);

            // Store file association
            if (!tagFiles.has(storedCanonical)) {
                tagFiles.set(storedCanonical, new Set());
            }
            const fileSet = tagFiles.get(storedCanonical);
            if (fileSet) {
                fileSet.add(path);
            }
        }
    }

    // Convert to list for building tree
    const tagList = Array.from(allTagsSet);

    // Helper function to build a tree from a flat list
    const buildTreeFromList = (tagPaths: string[]): Map<string, TagTreeNode> => {
        const allNodes = new Map<string, TagTreeNode>();
        const tree = new Map<string, TagTreeNode>();

        // Sort tags (natural order) to ensure parents are processed before children
        tagPaths.sort((a, b) => naturalCompare(a, b));

        for (const tagPath of tagPaths) {
            const parts = tagPath.split('/');
            let currentPath = '';

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                currentPath = i === 0 ? part : `${currentPath}/${part}`;
                const normalizedCurrentPath = normalizeTagPathValue(currentPath);
                if (normalizedCurrentPath.length === 0) {
                    continue;
                }

                // Get or create the node
                let node = allNodes.get(normalizedCurrentPath);
                if (!node) {
                    node = {
                        name: part,
                        path: normalizedCurrentPath,
                        displayPath: currentPath,
                        children: new Map(),
                        notesWithTag: new Set()
                    };
                    allNodes.set(normalizedCurrentPath, node);

                    // Only add root-level tags to the tree Map
                    if (i === 0) {
                        tree.set(normalizedCurrentPath, node);
                    }
                }

                // Add files only to the exact tag (not ancestors)
                if (i === parts.length - 1) {
                    const files = tagFiles.get(currentPath);
                    if (files) {
                        node.notesWithTag = files;
                    }
                }

                // Link to parent
                if (i > 0) {
                    const parentPath = normalizeTagPathValue(parts.slice(0, i).join('/'));
                    const parent = allNodes.get(parentPath);
                    if (parent && !parent.children.has(normalizedCurrentPath)) {
                        parent.children.set(normalizedCurrentPath, node);
                    }
                }
            }
        }

        return tree;
    };

    const tagTree = buildTreeFromList(tagList);

    // Clear note count cache since tree structure has changed
    clearNoteCountCache();

    return { tagTree, untagged: untaggedCount };
}

/**
 * Get the total number of notes for a tag (including all descendants)
 * Results are memoized for performance
 */
export function getTotalNoteCount(node: NNNode): number {
    const cache = getNoteCountCache();

    // Check cache first
    const cachedCount = cache.get(node);
    if (cachedCount !== undefined) {
        return cachedCount;
    }

    // Calculate count
    let count = node.notesWithTag.size;

    // Collect all unique files from this node and all descendants
    const allFiles = new Set(node.notesWithTag);

    // Helper to collect files from children
    function collectFromChildren(n: NNNode): void {
        for (const child of n.children.values()) {
            child.notesWithTag.forEach(file => allFiles.add(file));
            collectFromChildren(child);
        }
    }

    collectFromChildren(node);
    count = allFiles.size;

    // Cache the result
    cache.set(node, count);

    return count;
}

/**
 * Collect all tag paths from a node and its descendants
 * Returns lowercase paths for logic operations
 */
export function collectAllTagPaths(node: TagTreeNode, paths: Set<string> = new Set()): Set<string> {
    paths.add(node.path);
    for (const child of node.children.values()) {
        collectAllTagPaths(child, paths);
    }
    return paths;
}

/**
 * Find a tag node by its path
 */
export function findTagNode(tree: Map<string, TagTreeNode>, tagPath: string): TagTreeNode | null {
    // Remove # prefix if present
    const cleanPath = tagPath.startsWith('#') ? tagPath.substring(1) : tagPath;
    const lowerPath = cleanPath.toLowerCase();

    // Helper function to search recursively
    function searchNode(nodes: Map<string, TagTreeNode>): TagTreeNode | null {
        for (const node of nodes.values()) {
            if (node.path === lowerPath) {
                return node;
            }
            // Search in children
            const found = searchNode(node.children);
            if (found) {
                return found;
            }
        }
        return null;
    }

    return searchNode(tree);
}

/**
 * Exclude tags from tree based on exclusion patterns
 *
 * Removes tags that match the patterns and all their descendants.
 * Also removes parent tags that become empty (no notes and no children).
 *
 * @param tree - The original tag tree
 * @param matcher - Compiled matcher describing hidden tag rules
 * @returns A new tree with excluded tags and empty parents removed
 */
export function excludeFromTagTree(tree: Map<string, TagTreeNode>, matcher: HiddenTagMatcher): Map<string, TagTreeNode> {
    if (matcher.prefixes.length === 0 && matcher.startsWithNames.length === 0 && matcher.endsWithNames.length === 0) {
        return tree;
    }

    const filtered = new Map<string, TagTreeNode>();

    // Helper to recursively check and filter nodes
    // Returns null if node should be excluded, otherwise returns node with filtered children
    function shouldIncludeNode(node: TagTreeNode): TagTreeNode | null {
        // Check if this tag matches any exclusion prefix
        const shouldExclude = matchesHiddenTagPattern(node.path, node.name, matcher);

        if (shouldExclude) {
            return null;
        }

        // Process children
        const filteredChildren = new Map<string, TagTreeNode>();
        for (const [childKey, child] of node.children) {
            const filteredChild = shouldIncludeNode(child);
            if (filteredChild) {
                filteredChildren.set(childKey, filteredChild);
            }
        }

        // Remove empty nodes (no notes and no children after filtering)
        // This ensures parent tags don't show if all their children are excluded
        if (filteredChildren.size === 0 && node.notesWithTag.size === 0) {
            return null;
        }

        // Return node with filtered children
        return {
            name: node.name,
            path: node.path,
            displayPath: node.displayPath,
            children: filteredChildren,
            notesWithTag: node.notesWithTag
        };
    }

    // Process each root node
    for (const [key, node] of tree) {
        const filteredNode = shouldIncludeNode(node);
        if (filteredNode) {
            filtered.set(key, filteredNode);
        }
    }

    return filtered;
}
