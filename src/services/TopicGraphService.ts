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

import { TopicNode } from '../types/storage';
import { findTopicNode, collectTopicDescendants, findTopicNodeByPath } from '../utils/topicGraph';

export class TopicService {
    private topicGraph: Map<string, TopicNode> = new Map();
    private topicNames: Set<string> = new Set();
    private version = 0;
    private listeners = new Set<() => void>();

    updateTopicGraph(graph: Map<string, TopicNode>): void {
        this.topicGraph = graph;
        this.topicNames = new Set(this.getAllTopicNames());
        this.version += 1;
        this.listeners.forEach(listener => listener());
    }

    /** Increases on every graph update, so React memos can depend on it */
    getVersion(): number {
        return this.version;
    }

    /** Registers a listener called after every graph update. Returns the unsubscribe function. */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Whether a topic with this exact name is in the current graph */
    hasTopicName(topicName: string): boolean {
        return this.topicNames.has(topicName);
    }

    getTopicGraph(): Map<string, TopicNode> {
        return this.topicGraph;
    }

    findTopicNodeByName(topicName: string): TopicNode | null {
        return findTopicNode(this.topicGraph, topicName);
    }

    findTopicNodeByPath(topicPath: string): TopicNode | null {
        return findTopicNodeByPath(this.topicGraph, topicPath);
    }

    getAllTopicNames(): string[] {
        const allNames: string[] = [];
        for (const rootNode of this.topicGraph.values()) {
            const names = Array.from(collectTopicDescendants(rootNode)).map(node => node.name);
            allNames.push(...names);
        }
        return allNames;
    }

    collectTopicNames(node: TopicNode): Set<string> {
        return new Set(Array.from(collectTopicDescendants(node)).map(n => n.name));
    }
}
