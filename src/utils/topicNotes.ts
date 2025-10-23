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

import { App, TFile } from 'obsidian';
import { getTopicNameFromPath, getTopicRelations, getTopicTags, hasTopicTag, findTopicNode } from './topicGraph';
import { TopicNode } from '../types/storage';

/**
 * Gets the topic note file for a given topic name.
 * Topics are files in the vault that represent the topic itself.
 * 
 * @param topicName - The name of the topic (e.g., "artificial intelligence")
 * @param app - The Obsidian App instance
 * @returns The topic note file if found, null otherwise
 */
export function getTopicNote(topicName: string, app: App): TFile | null {
    // Use Obsidian's link resolution to find the file matching the topic name
    const topicFile = app.metadataCache.getFirstLinkpathDest(topicName, '');
    
    if (!topicFile || !(topicFile instanceof TFile)) {
        return null;
    }
    
    return topicFile;
}

/**
 * Checks if a file is a topic note by checking for #topic tag in its metadata.
 * 
 * @param file - The file to check
 * @param app - The Obsidian App instance
 * @returns True if the file has the #topic tag, false otherwise
 */
export function isTopicNote(file: TFile, app: App): boolean {
    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata) {
        return false;
    }
    
    // Check if file has #topic tag
    return hasTopicTag(getTopicTags(metadata));
}

/**
 * Gets the topic name from a topic note file.
 * 
 * @param file - The topic note file
 * @returns The topic name (basename without extension)
 */
export function getTopicNameFromFile(file: TFile): string {
    return getTopicNameFromPath(file.path);
}

/**
 * Finds the first topic in the hierarchy by traversing isA, subset, hasTopic, and for links.
 * Similar to collectParentTopics in topicGraph.ts but returns the first topic found.
 * 
 * @param file - The file to start searching from
 * @param app - The Obsidian App instance
 * @param topicGraph - The topic graph containing all topic nodes
 * @param visited - Set of visited file paths to prevent infinite loops
 * @returns The topic path if found, null otherwise
 */
export function findFirstTopicPathInHierarchy(file: TFile, app: App, topicGraph: Map<string, TopicNode>, visited: Set<string> = new Set()): string | null {
    // Prevent infinite loops
    console.log('visited', visited, file.path);
    if (visited.has(file.path)) {
        return null;
    }
    visited.add(file.path);

    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata) {
        return null;
    }

    // Check if this file itself is a topic
    if (isTopicNote(file, app)) {
        const topicName = getTopicNameFromFile(file);
        // Get the TopicNode from the graph
        const topicNode = findTopicNode(topicGraph, topicName);
        if (!topicNode) {
            // If not in graph, just return the name
            return topicName;
        }
        
        // Traverse up using parents to form the full topicPath
        const pathParts: string[] = [];
        const visitedNodes = new Set<string>();
        
        function traverseUp(node: TopicNode) {
            // Prevent infinite loops in case of circular references
            if (visitedNodes.has(node.name)) {
                return;
            }
            visitedNodes.add(node.name);
            
            // Add current node to path
            pathParts.unshift(node.name);
            
            // If there are parents, traverse up the first parent
            // (in case of multiple parents, we choose the first one)
            if (node.parents.size > 0) {
                const firstParent = node.parents.values().next().value;
                traverseUp(firstParent);
            }
        }
        
        traverseUp(topicNode);
        // Return the full path (e.g., "AI/Machine Learning/Neural Networks")
        return pathParts.join('/');
    }

    // Get all parent links from frontmatter
    const parentLinks = getTopicRelations(metadata);

    // Traverse each parent link
    for (const parentLink of parentLinks) {
        // Parse the link (remove [[ ]], handle aliases)
        const linkPath = parentLink.slice(2, -2).split('|')[0];
        
        // Resolve the link to a file
        const parentFile = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
        if (!parentFile) {
            continue;
        }

        // Recursively search for a topic
        const topicPath = findFirstTopicPathInHierarchy(parentFile, app, topicGraph, visited);
        if (topicPath) {
            return topicPath;
        }
    }

    return null;
}

