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
import { findTopicNode, collectTopicDescendants } from '../utils/topicGraph';
import { ITopicGraphProvider } from '../interfaces/ITagTreeProvider';

/**
 * Service that provides access to the tag tree from StorageContext
 * Acts as a bridge between React (StorageContext) and non-React code
 */
export class TopicService implements ITopicGraphProvider {
    private topicGraph: Map<string, TopicNode> = new Map();

    /**
     * Updates the tag tree data from StorageContext
     * Called whenever StorageContext rebuilds the tag tree
     */
    updateTopicGraph(graph: Map<string, TopicNode>): void {
        this.topicGraph = graph;
    }

    /**
     * Gets the current topic graph
     */
    getTopicGraph(): Map<string, TopicNode> {
        return this.topicGraph;
    }

    /**
     * Finds a topic node by its name within the topic graph
     */
    findTopicNode(topicName: string): TopicNode | null {
        return findTopicNode(this.topicGraph, topicName);
    }

    /**
     * Gets all topic names in the graph
     */
    getAllTopicNames(): string[] {
        const allNames: string[] = [];
        for (const rootNode of this.topicGraph.values()) {
            // TODO: Check this change isn't destructive
            const names = Array.from(collectTopicDescendants(rootNode)).map(node => node.name);
            allNames.push(...names);
        }
        return allNames;
    }

    /**
     * Collects all topic names from a specific node and its descendants
     */
    collectTopicNames(node: TopicNode): Set<string> {
        return new Set(Array.from(collectTopicDescendants(node)).map(node => node.name));
    }
}
