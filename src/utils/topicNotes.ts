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

export function getTopicNote(topicName: string, app: App): TFile | null {
    const topicFile = app.metadataCache.getFirstLinkpathDest(topicName, '');
    if (!topicFile || !(topicFile instanceof TFile)) {
        return null;
    }
    return topicFile;
}

export function isTopicNote(file: TFile, app: App): boolean {
    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata) {
        return false;
    }
    return hasTopicTag(getTopicTags(metadata));
}

export function getTopicNameFromFile(file: TFile): string {
    return getTopicNameFromPath(file.path);
}

export function findFirstTopicPathInHierarchy(file: TFile, app: App, topicGraph: Map<string, TopicNode>, visited: Set<string> = new Set()): string | null {
    if (visited.has(file.path)) {
        return null;
    }
    visited.add(file.path);

    const metadata = app.metadataCache.getFileCache(file);
    if (!metadata) {
        return null;
    }

    if (isTopicNote(file, app)) {
        const topicName = getTopicNameFromFile(file);
        const topicNode = findTopicNode(topicGraph, topicName);
        if (!topicNode) {
            return topicName;
        }

        const pathParts: string[] = [];
        const visitedNodes = new Set<string>();

        function traverseUp(node: TopicNode) {
            if (visitedNodes.has(node.name)) {
                return;
            }
            visitedNodes.add(node.name);
            pathParts.unshift(node.name);
            if (node.parents.size > 0) {
                const firstParent = node.parents.values().next().value;
                traverseUp(firstParent);
            }
        }

        traverseUp(topicNode);
        return pathParts.join('/');
    }

    const parentLinks = getTopicRelations(metadata);

    for (const parentLink of parentLinks) {
        const linkPath = parentLink.slice(2, -2).split('|')[0];
        const parentFile = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
        if (!parentFile) {
            continue;
        }
        const topicPath = findFirstTopicPathInHierarchy(parentFile, app, topicGraph, visited);
        if (topicPath) {
            return topicPath;
        }
    }

    return null;
}
