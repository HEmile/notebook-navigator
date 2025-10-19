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

import { FileData, IndexedDBStorage } from '../storage/IndexedDBStorage';
import { TopicNode as TopicNode } from '../types/storage';
import { isPathInExcludedFolder } from './fileFilters';
import { HiddenTagMatcher, matchesHiddenTagPattern, normalizeTagPathValue } from './tagPrefixMatcher';
import { naturalCompare } from './sortUtils';
import {App} from 'obsidian';

/**
 * Tag Tree Utilities
 *
 * This module provides functions for building and managing hierarchical tag trees
 * from various data sources (vault files, database).
 */

// Cache for note counts to avoid recalculation
let noteCountCache: WeakMap<TopicNode, number> | null = null;

/**
 * Clear the note count cache
 */
export function clearNoteCountCache(): void {
    noteCountCache = null;
}

/**
 * Get or create the note count cache
 */
function getNoteCountCache(): WeakMap<TopicNode, number> {
    if (!noteCountCache) {
        noteCountCache = new WeakMap();
    }
    return noteCountCache;
}

function traverseTopicsUp(allTopics: Map<string, TopicNode>, topicName: string, app: App): TopicNode | undefined {
    // If topic is already in allTopics, return immediately
    if (allTopics.has(topicName)) {
        return allTopics.get(topicName);
    }
    // Otherwise, add topic and traverse up if possible
    const topicNode = {
        name: topicName,
        parents: new Map(),
        children: new Map(),
        notesWithTopic: new Set()
    } as TopicNode;
    allTopics.set(topicName, topicNode);

    const file = app.vault.getFileByPath(topicName);
    if (!file) {
        return undefined;
    }
    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata) {
        return undefined;
    }
    const topics = metadata.frontmatter?.['subsets'] as string[] | undefined;
    if (!topics) {
        return undefined;
    }
    for (const parentTopic of topics) {
        const parent = traverseTopicsUp(allTopics, parentTopic, app);
        if (parent) {
            parent.children.set(topicName, topicNode);
            topicNode.parents.set(parentTopic, parent);
        }
    }
    return topicNode;
}

/**
 * Build topic graph from database
 * @param db - IndexedDBStorage instance
 * @param excludedFolderPatterns - Optional array of folder patterns to exclude
 * @returns Object containing topic graph
 */
export function buildTopicGraphFromDatabase(
    db: IndexedDBStorage,
    app: App,
    excludedFolderPatterns?: string[],
    includedPaths?: Set<string>
): Map<string, TopicNode> {
    // Track all unique topics that exist in the vault
    const allTopics = new Map<string, TopicNode>();

    // Get all files from cache
    const allFiles = db.getAllFiles();

    // First pass: collect all topics and their parents
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

        // Skip files that do not have the topics tag
        if (!tags || !tags.includes('topics')) {
            continue;
        }

        // Skip files that we already traversed through going up the hierarchy
        if (allTopics.has(path)) {
            continue;
        }

        // Traverse the topic hierarchy up
        traverseTopicsUp(allTopics, path, app);
    }

    // Second pass: collect all notes with each topic
    for (const { path, data: fileData } of allFiles) {
        if (includedPaths && !includedPaths.has(path)) {
            continue;
        }
        if (excludedFolderPatterns && isPathInExcludedFolder(path, excludedFolderPatterns)) {
            continue;
        }

        const file = app.vault.getFileByPath(path);
        if (!file) {
            continue;
        }
        const metadata = app.metadataCache.getFileCache(file);
        if (!metadata) {
            continue;
        }
        const hasTopics = metadata.frontmatter?.['hasTopic'] as string[] | undefined;
        const isAs = metadata.frontmatter?.['isA'] as string[] | undefined;

        // Merge hasTopics and isAs arrays into a single list of topics
        let topics: string[] = [];
        if (Array.isArray(hasTopics)) {
            topics = topics.concat(hasTopics);
        }
        if (Array.isArray(isAs)) {
            topics = topics.concat(isAs);
        }
        // Remove duplicates, if any
        topics = Array.from(new Set(topics));

        // Assign the file to the topics
        for (const topic of topics) {
            const topicNode = allTopics.get(topic);
            if (topicNode) {
                topicNode.notesWithTopic.add(path);
            }
        }
    }

    const rootTopics = new Map<string, TopicNode>();

    // Third pass: filter to root topics
    for (const [topicName, topicNode] of allTopics) {
        if (topicNode.parents.size === 0) {
            rootTopics.set(topicName, topicNode);
        }
    }

    // Clear note count cache since tree structure has changed
    clearNoteCountCache();

    return rootTopics;
}

/**
 * Get the total number of notes for a tag (including all descendants)
 * Results are memoized for performance
 */
export function getTotalNoteCount(node: TopicNode): number {
    const cache = getNoteCountCache();

    // Check cache first
    const cachedCount = cache.get(node);
    if (cachedCount !== undefined) {
        return cachedCount;
    }

    // Calculate count
    let count = node.notesWithTopic.size;

    // Collect all unique files from this node and all descendants
    const allFiles = new Set(node.notesWithTopic);

    // Helper to collect files from children
    function collectFromChildren(n: TopicNode): void {
        for (const child of n.children.values()) {
            child.notesWithTopic.forEach(file => allFiles.add(file));
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
 * Collect all topic names from a node and its descendants
 * Returns lowercase paths for logic operations
 */
export function collectAllTopicPaths(node: TopicNode, paths: Set<string> = new Set()): Set<string> {
    paths.add(node.name);
    for (const child of node.children.values()) {
        collectAllTopicPaths(child, paths);
    }
    return paths;
}

/**
 * Find a topic node by its name
 */
export function findTopicNode(tree: Map<string, TopicNode>, topicName: string): TopicNode | null {
    // Helper function to search recursively
    function searchNode(nodes: Map<string, TopicNode>): TopicNode | null {
        for (const node of nodes.values()) {
            if (node.name === topicName) {
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
 * Exclude topics from tree based on exclusion patterns
 *
 * Removes topics that match the patterns and all their descendants.
 * Also removes parent topics that become empty (no notes and no children).
 *
 * @param tree - The original topic tree
 * @param matcher - Compiled matcher describing hidden topic rules
 * @returns A new tree with excluded topics and empty parents removed
 */
export function excludeFromTopicTree(tree: Map<string, TopicNode>, matcher: HiddenTagMatcher): Map<string, TopicNode> {
    console.log("TODO: Implement excludeFromTopicTree");
    return tree;
    // if (matcher.prefixes.length === 0 && matcher.startsWithNames.length === 0 && matcher.endsWithNames.length === 0) {
    //     return tree;
    // }

    // const filtered = new Map<string, TagTreeNode>();

    // // Helper to recursively check and filter nodes
    // // Returns null if node should be excluded, otherwise returns node with filtered children
    // function shouldIncludeNode(node: TagTreeNode): TagTreeNode | null {
    //     // Check if this tag matches any exclusion prefix
    //     const shouldExclude = matchesHiddenTagPattern(node.path, node.name, matcher);

    //     if (shouldExclude) {
    //         return null;
    //     }

    //     // Process children
    //     const filteredChildren = new Map<string, TagTreeNode>();
    //     for (const [childKey, child] of node.children) {
    //         const filteredChild = shouldIncludeNode(child);
    //         if (filteredChild) {
    //             filteredChildren.set(childKey, filteredChild);
    //         }
    //     }

    //     // Remove empty nodes (no notes and no children after filtering)
    //     // This ensures parent tags don't show if all their children are excluded
    //     if (filteredChildren.size === 0 && node.notesWithTag.size === 0) {
    //         return null;
    //     }

    //     // Return node with filtered children
    //     return {
    //         name: node.name,
    //         path: node.path,
    //         displayPath: node.displayPath,
    //         children: filteredChildren,
    //         notesWithTag: node.notesWithTag
    //     };
    // }

    // // Process each root node
    // for (const [key, node] of tree) {
    //     const filteredNode = shouldIncludeNode(node);
    //     if (filteredNode) {
    //         filtered.set(key, filteredNode);
    //     }
    // }

    // return filtered;
}
