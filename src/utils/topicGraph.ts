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
import {App, CachedMetadata, MetadataCache, TFile} from 'obsidian';

/**
 * Tag Tree Utilities
 *
 * This module provides functions for building and managing hierarchical tag trees
 * from various data sources (vault files, database).
 */

// Cache for note counts to avoid recalculation
let noteCountCache: WeakMap<TopicNode, number> | null = null;

export const SUBSET_RELATIONS = ["subset"]
export const HAS_TOPIC_RELATIONS = ["hasTopic", "isA", "for", "subset"]
export const TOPIC_TAGS = ["topic"]

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

export function getTopicNameFromPath(topicPath: string): string {
    return topicPath.split('/').pop()?.split('.').slice(0, -1).join('') || '';
}

export function getTopicTags(metadata: CachedMetadata): string[] {
    if (!metadata || !metadata.tags) {
        return [];
    }
    return metadata.tags?.map(tag => tag.tag) || [];
}

export function getTopicRelations(metadata: CachedMetadata): string[] {
    let topics: string[] = [];
    for (const relation of HAS_TOPIC_RELATIONS) {
        if (metadata.frontmatter?.[relation]) {
            topics = topics.concat(metadata.frontmatter?.[relation] as string[]);
        }
    }
    return Array.from(new Set(topics));
}

export function hasTopicTag(tags: string[]): boolean {
    return tags?.some(tag => TOPIC_TAGS.some(topicTag => tag.contains(topicTag)));
}

function traverseTopicsUp(allTopics: Map<string, TopicNode>, topicPath: string, app: App): TopicNode | undefined {
    const topicName = getTopicNameFromPath(topicPath);

    // If topic is already in allTopics, return immediately
    if (allTopics.has(topicName)) {
        return allTopics.get(topicName);
    }

    // Otherwise, add topic and traverse up if possible
    const topicNode = {
        name: topicName,
        parents: new Map(),
        children: new Map(),
        notesWithTag: new Set()
    } as TopicNode;
    allTopics.set(topicName, topicNode);

    const file = app.vault.getFileByPath(topicPath);
    if (!file) {
        return topicNode;
    }
    
    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata) {
        return topicNode;
    }
    let topics: string[] = [];
    for (const relation of SUBSET_RELATIONS) {
        if (metadata.frontmatter?.[relation]) {
            topics = topics.concat(metadata.frontmatter?.[relation] as string[]);
        }
    }
    if (!topics) {
        return topicNode;
    }
    
    for (const parentTopic of topics) {
        // Use Obsidian API to resolve the parentTopic as a file path
        const parentFile = app.metadataCache.getFirstLinkpathDest(parentTopic.slice(2, -2).split("|")[0], "");
        if (!parentFile) {
            continue;
        }
        const parentFilePath = parentFile.path;
        const metadata = app.metadataCache.getFileCache(parentFile);
        if (metadata && !hasTopicTag(getTopicTags(metadata))) {
            continue;
        }
        
        const parent = traverseTopicsUp(allTopics, parentFilePath, app);
        const parentName = getTopicNameFromPath(parentFilePath);
        // if (topicName === "topology") {
        //     console.log('metadata', metadata);
        //     console.log('parentName', parentName);
        //     console.log('parentFilePath', parentFilePath);
        //     console.log('parentFile', parent);
        // }
        if (parent) {
            parent.children.set(topicName, topicNode);
            topicNode.parents.set(parentName, parent);
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
        if (!tags || !hasTopicTag(tags)) {
            continue;
        }

        // Skip files that we already traversed through going up the hierarchy
        if (allTopics.has(path)) {
            continue;
        }
        // Traverse the topic hierarchy up
        traverseTopicsUp(allTopics, path, app);
    }

    function collectParentTopics(file: TFile, path: string) {
        const metadata = app.metadataCache.getFileCache(file);
        if (!metadata || hasTopicTag(getTopicTags(metadata))) {
            return 
        }
        const topics = getTopicRelations(metadata);
        if (!topics.length) {
            return;
        }

        // Assign the file to the topics
        for (const topic of topics) {
            // Use Obsidian API to resolve the parentTopic as a file path
            const topicFile = app.metadataCache.getFirstLinkpathDest(topic.slice(2, -2).split("|")[0], "");
            if (!topicFile) {
                continue;
            }
            const metadataTopic = app.metadataCache.getFileCache(topicFile);
            if (metadataTopic && !hasTopicTag(getTopicTags(metadataTopic))) {
                // Handle isA / hasTopics / subsets / fors up recursively until first topic found
                collectParentTopics(topicFile, path);
            } else {
                const topicName = getTopicNameFromPath(topicFile.path);
                const topicNode = allTopics.get(topicName);
                if (topicNode) {
                    topicNode.notesWithTag.add(path);
                } 
            }
            // It's possible it cannot be found when a user uses hasTopic, isA, subset, or for for a note that is not a topic
        }
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
        try {
            collectParentTopics(file, path);
        } catch (RangeError) {
            console.error('RangeError', RangeError);
            console.error("You likely have a circular dependency in your hierarchy. This breaks the plugin! Fix it :). Hint: it's caused by");
            console.error(path)
            continue;
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

    // console.log('rootTopics', rootTopics);
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
    let count = node.notesWithTag.size;

    // Collect all unique files from this node and all descendants
    const allFiles = new Set(node.notesWithTag);

    // Helper to collect files from children
    function collectFromChildren(n: TopicNode): void {
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
 * Collect all topic names from a node and its descendants
 * Returns lowercase paths for logic operations
 */
export function collectTopicDescendants(node: TopicNode, paths: Set<TopicNode> = new Set()): Set<TopicNode> {
    paths.add(node);
    for (const child of node.children.values()) {
        collectTopicDescendants(child, paths);
    }
    return paths;
}

/**
 * Collect all file paths from a topic node and its descendants
 * @param node - The topic node to collect files from
 * @returns Set of file paths associated with the topic and its descendants
 */
export function collectTopicFilePaths(node: TopicNode): Set<string> {
    const filePaths = new Set<string>();
    
    // Add files from the current node
    node.notesWithTag.forEach(path => filePaths.add(path));
    
    // Recursively add files from all descendants
    for (const child of node.children.values()) {
        const childPaths = collectTopicFilePaths(child);
        childPaths.forEach(path => filePaths.add(path));
    }
    
    return filePaths;
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
 * Gets all ancestor topic names for a given topic, choosing the first path when multiple paths exist.
 * Returns the names in order from root to the immediate parent (not including the topic itself).
 * 
 * @param topicNode - The topic node to get ancestors for
 * @returns Array of ancestor topic names from root to immediate parent
 */
export function getTopicAncestors(topicNode: TopicNode): string[] {
    const ancestors: string[] = [];
    
    // If no parents, return empty array
    if (topicNode.parents.size === 0) {
        return ancestors;
    }
    
    // Choose the first parent (arbitrary choice when multiple paths exist)
    const firstParent = Array.from(topicNode.parents.values())[0];
    
    // Recursively collect ancestors
    function collectAncestors(node: TopicNode) {
        if (node.parents.size > 0) {
            // Choose first parent
            const parent = Array.from(node.parents.values())[0];
            collectAncestors(parent);
        }
        ancestors.push(node.name);
    }
    
    collectAncestors(firstParent);
    
    return ancestors;
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
