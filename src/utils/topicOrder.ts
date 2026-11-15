/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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
import type { NotebookNavigatorSettings } from '../settings/types';
import type { TopicNode } from '../types/storage';
import { getTotalNoteCount } from './topicGraph';

/**
 * Fork: orders root topics by the manual root order. Names in the order come first, in order; roots not in it
 * follow, sorted by the fallback comparator (the topic sort order). Names without a root topic are skipped.
 */
export function orderRootTopics(
    nodes: readonly TopicNode[],
    rootTopicOrder: readonly string[],
    fallback: (a: TopicNode, b: TopicNode) => number
): TopicNode[] {
    if (rootTopicOrder.length === 0) {
        return nodes.slice().sort(fallback);
    }
    const byName = new Map(nodes.map(node => [node.name, node]));
    const ordered: TopicNode[] = [];
    const placed = new Set<string>();
    for (const name of rootTopicOrder) {
        const node = byName.get(name);
        if (node && !placed.has(name)) {
            ordered.push(node);
            placed.add(name);
        }
    }
    const rest = nodes.filter(node => !placed.has(node.name)).sort(fallback);
    return ordered.concat(rest);
}

/** Fork: compares topics by the topic sort order setting */
export function createTopicComparator(sortOrder: NotebookNavigatorSettings['topicSortOrder']): (a: TopicNode, b: TopicNode) => number {
    return (a, b) => {
        switch (sortOrder) {
            case 'frequency-desc':
                return getTotalNoteCount(b) - getTotalNoteCount(a) || a.name.localeCompare(b.name);
            case 'frequency-asc':
                return getTotalNoteCount(a) - getTotalNoteCount(b) || a.name.localeCompare(b.name);
            case 'alpha-desc':
                return b.name.localeCompare(a.name);
            default:
                return a.name.localeCompare(b.name);
        }
    };
}
