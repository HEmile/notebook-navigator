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
import { getTopicNameFromPath, getTopicRelations, getTopicTags, hasTopicTag } from './topicGraph';

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
 * @param visited - Set of visited file paths to prevent infinite loops
 * @returns The topic name if found, null otherwise
 */
export function findFirstTopicInHierarchy(file: TFile, app: App, visited: Set<string> = new Set()): string | null {
    // Prevent infinite loops
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
        return getTopicNameFromFile(file);
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
        const topicName = findFirstTopicInHierarchy(parentFile, app, visited);
        if (topicName) {
            return topicName;
        }
    }

    return null;
}

