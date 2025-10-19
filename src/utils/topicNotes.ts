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
import { getTopicNameFromPath } from './topicGraph';

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
    return metadata.tags?.some(tag => tag.tag.contains('topic')) ?? false;
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

