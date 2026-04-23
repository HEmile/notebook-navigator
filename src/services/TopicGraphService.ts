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

    updateTopicGraph(graph: Map<string, TopicNode>): void {
        this.topicGraph = graph;
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
