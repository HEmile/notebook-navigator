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
import { TopicNode } from '../types/storage';
import { isPathInExcludedFolder } from './fileFilters';
import { HiddenTagMatcher } from './tagPrefixMatcher';
import { App, CachedMetadata, TFile } from 'obsidian';

// Cache for note counts to avoid recalculation
let noteCountCache: WeakMap<TopicNode, number> | null = null;

export const SUBSET_RELATIONS = ["subset", "in", "partOf", 'groep', "worksIn", 'decennium', "year", "eeuw", "maand", "stroming", "festival", "genre", "voor", "project"];
export const HAS_TOPIC_RELATIONS = SUBSET_RELATIONS.concat(["hasTopic", "isA", "for", 'with', "author", "publishedIn", "by", "artiest", "live", "adres", "gerecht", "at"]);
export const TOPIC_TAGS = ["topic", "jaar", "decennium", "maand"];

export function clearNoteCountCache(): void {
    noteCountCache = null;
}

function getNoteCountCache(): WeakMap<TopicNode, number> {
    if (!noteCountCache) {
        noteCountCache = new WeakMap();
    }
    return noteCountCache;
}

export function getTopicNameFromPath(topicPath: string): string {
    if (topicPath.includes("/")) {
        topicPath = topicPath.split('/').pop() || '';
    }
    if (topicPath.endsWith(".md")) {
        return topicPath.split('.').slice(0, -1).join('') || '';
    }
    return topicPath;
}

export function getTopicTags(metadata: CachedMetadata): string[] {
    if (!metadata || !metadata.tags) {
        return [];
    }
    return metadata.tags?.map(tag => tag.tag) || [];
}

export function getTopicRelations(metadata: CachedMetadata, isTopicNote: boolean = false): string[] {
    let topics: string[] = [];
    const relations = isTopicNote ? HAS_TOPIC_RELATIONS.filter(relation => !SUBSET_RELATIONS.includes(relation)) : HAS_TOPIC_RELATIONS;
    for (const relation of relations) {
        const value = metadata.frontmatter?.[relation];
        if (value && Symbol.iterator in Object(value)) {
            for (const topic of metadata.frontmatter?.[relation] as string[]) {
                if (typeof topic === "string" && topic.startsWith('[[') && topic.endsWith(']]')) {
                    topics.push(topic);
                }
            }
            topics = topics.concat(metadata.frontmatter?.[relation] as string[]);
        }
    }
    return Array.from(new Set(topics));
}

export function hasTopicTag(tags: string[]): boolean {
    return tags?.some(tag => TOPIC_TAGS.some(topicTag => tag.contains(topicTag)));
}

function traverseTopicsUp(allTopics: Map<string, TopicNode>, topicPath: string, app: App, visitedTopics: Set<string>): TopicNode {
    const topicName = getTopicNameFromPath(topicPath);

    if (allTopics.has(topicName)) {
        return allTopics.get(topicName) as TopicNode;
    }

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
        if (typeof parentTopic !== "string" || parentTopic.length === 0) {
            continue;
        }
        if (!(parentTopic.startsWith('[[') && parentTopic.endsWith(']]'))) {
            continue;
        }
        const parentFile = app.metadataCache.getFirstLinkpathDest(parentTopic.slice(2, -2).split("|")[0], "");
        if (!parentFile) {
            continue;
        }
        const parentFilePath = parentFile.path;
        const parentMetadata = app.metadataCache.getFileCache(parentFile);
        if (parentMetadata && !hasTopicTag(getTopicTags(parentMetadata))) {
            continue;
        }

        const parentName = getTopicNameFromPath(parentFilePath);
        if (visitedTopics.has(parentName)) {
            continue;
        }
        const parentVisitedTopic = new Set(visitedTopics);
        parentVisitedTopic.add(parentName);
        const parent = traverseTopicsUp(allTopics, parentFilePath, app, parentVisitedTopic);
        if (parent) {
            parent.children.set(topicName, topicNode);
            topicNode.parents.set(parentName, parent);
        }
    }
    return topicNode;
}

export function buildTopicGraphFromDatabase(
    db: IndexedDBStorage,
    app: App,
    excludedFolderPatterns?: string[],
    includedPaths?: Set<string>
): Map<string, TopicNode> {
    const allTopics = new Map<string, TopicNode>();
    const allFiles = db.getAllFiles();

    // First pass: collect all topics and their parents
    for (const { path, data: fileData } of allFiles) {
        if (includedPaths && !includedPaths.has(path)) {
            continue;
        }
        if (excludedFolderPatterns && isPathInExcludedFolder(path, excludedFolderPatterns)) {
            continue;
        }

        const tags = fileData.tags;
        if (!tags || !hasTopicTag(tags)) {
            continue;
        }
        if (allTopics.has(path)) {
            continue;
        }
        const visitedTopics = new Set<string>();
        visitedTopics.add(getTopicNameFromPath(path));
        traverseTopicsUp(allTopics, path, app, visitedTopics);
    }

    function collectParentTopics(file: TFile, path: string, visitedPaths: Set<string>) {
        const metadata = app.metadataCache.getFileCache(file);
        if (!metadata) {
            return;
        }
        const isTopicNote = hasTopicTag(getTopicTags(metadata));
        const topics = getTopicRelations(metadata, isTopicNote);
        if (!topics.length) {
            return;
        }

        for (let topic of topics) {
            if (typeof topic !== "string" || topic.length === 0) {
                continue;
            }
            if (!(topic.startsWith('[[') && topic.endsWith(']]'))) {
                continue;
            }
            topic = topic.slice(2, -2).split("|")[0];
            const topicFile = app.metadataCache.getFirstLinkpathDest(topic, "");
            if (!topicFile || visitedPaths.has(topicFile.path)) {
                continue;
            }
            visitedPaths.add(topicFile.path);
            const metadataTopic = app.metadataCache.getFileCache(topicFile);
            if (metadataTopic && !hasTopicTag(getTopicTags(metadataTopic))) {
                collectParentTopics(topicFile, path, visitedPaths);
            } else {
                const topicName = getTopicNameFromPath(topicFile.path);
                const topicNode = allTopics.get(topicName);
                if (topicNode) {
                    topicNode.notesWithTag.add(path);
                }
            }
        }
    }

    // Second pass: collect all notes with each topic
    for (const { path } of allFiles) {
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
        const visitedPaths = new Set<string>();
        visitedPaths.add(path);
        collectParentTopics(file, path, visitedPaths);
    }

    const rootTopics = new Map<string, TopicNode>();

    // Third pass: filter to root topics
    for (const [topicName, topicNode] of allTopics) {
        if (topicNode.parents.size === 0) {
            rootTopics.set(topicName, topicNode);
        }
    }

    clearNoteCountCache();
    return rootTopics;
}

export function getTotalNoteCount(node: TopicNode): number {
    const cache = getNoteCountCache();
    const cachedCount = cache.get(node);
    if (cachedCount !== undefined) {
        return cachedCount;
    }

    const allFiles = new Set(node.notesWithTag);

    function collectFromChildren(n: TopicNode): void {
        for (const child of n.children.values()) {
            if (visitedTopics.has(child.name)) {
                continue;
            }
            visitedTopics.add(child.name);
            child.notesWithTag.forEach(file => allFiles.add(file));
            collectFromChildren(child);
        }
    }

    const visitedTopics = new Set<string>();
    visitedTopics.add(node.name);
    collectFromChildren(node);
    const count = allFiles.size;

    cache.set(node, count);
    return count;
}

export function collectTopicDescendants(node: TopicNode, paths: Set<TopicNode> = new Set(), visitedTopics: Set<string> = new Set()): Set<TopicNode> {
    paths.add(node);
    if (visitedTopics.has(node.name)) {
        return paths;
    }
    visitedTopics.add(node.name);
    for (const child of node.children.values()) {
        collectTopicDescendants(child, paths, visitedTopics);
    }
    return paths;
}

export function collectTopicFilePaths(node: TopicNode, visitedTopics: Set<string> = new Set()): Set<string> {
    if (visitedTopics.has(node.name)) {
        return new Set();
    }
    visitedTopics.add(node.name);
    const filePaths = new Set<string>();

    node.notesWithTag.forEach(path => filePaths.add(path));

    for (const child of node.children.values()) {
        const childPaths = collectTopicFilePaths(child, visitedTopics);
        childPaths.forEach(path => filePaths.add(path));
    }

    return filePaths;
}

export function findTopicNode(graph: Map<string, TopicNode>, topicName: string): TopicNode | null {
    const visitedTopics = new Set<string>();
    function searchNode(nodes: Map<string, TopicNode>): TopicNode | null {
        for (const node of nodes.values()) {
            if (node.name === topicName) {
                return node;
            }
            if (visitedTopics.has(node.name)) {
                continue;
            }
            visitedTopics.add(node.name);
            const found = searchNode(node.children);
            if (found) {
                return found;
            }
        }
        return null;
    }
    return searchNode(graph);
}

export function findTopicNodeByPath(graph: Map<string, TopicNode>, topicPath: string): TopicNode | null {
    const visitedTopicNames = topicPath.split('/');
    let currentNode = graph.get(visitedTopicNames[0]);
    if (!currentNode) {
        return null;
    }
    for (const topicName of visitedTopicNames.slice(1)) {
        currentNode = currentNode.children.get(topicName);
        if (!currentNode) {
            return null;
        }
    }
    return currentNode;
}

export function getTopicAncestors(topicNode: TopicNode): string[] {
    const ancestors: string[] = [];

    if (topicNode.parents.size === 0) {
        return ancestors;
    }

    const firstParent = Array.from(topicNode.parents.values())[0];
    const visitedTopics = new Set<string>();
    visitedTopics.add(firstParent.name);

    function collectAncestors(node: TopicNode) {
        if (node.parents.size > 0) {
            const parent = Array.from(node.parents.values())[0];
            if (visitedTopics.has(parent.name)) {
                return;
            }
            visitedTopics.add(parent.name);
            collectAncestors(parent);
        }
        ancestors.push(node.name);
    }

    collectAncestors(firstParent);
    return ancestors;
}

export function getAllTopicPathsToRoot(topicNode: TopicNode): string[][] {
    const allPaths: string[][] = [];

    if (topicNode.parents.size === 0) {
        return allPaths;
    }

    function collectPathsThroughNode(node: TopicNode, currentPath: string[]): void {
        if (node.parents.size === 0) {
            allPaths.push([...currentPath]);
            return;
        }
        for (const parent of node.parents.values()) {
            collectPathsThroughNode(parent, [parent.name, ...currentPath]);
        }
    }

    for (const parent of topicNode.parents.values()) {
        collectPathsThroughNode(parent, [parent.name]);
    }

    return allPaths;
}

export function excludeFromTopicTree(tree: Map<string, TopicNode>, matcher: HiddenTagMatcher): Map<string, TopicNode> {
    // TODO: Implement topic exclusion filtering
    return tree;
}
