/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
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

import { describe, expect, it } from 'vitest';
import { collectTopicFilePaths, findTopicNode, getTopicNameFromPath, resolveTopicPath } from '../../src/utils/topicGraph';
import { parseFilterSearchTokens } from '../../src/utils/filterSearch';
import type { TopicNode } from '../../src/types/storage';

function createTopicNode(name: string): TopicNode {
    return {
        name,
        parents: new Map(),
        children: new Map(),
        notesWithTag: new Set()
    };
}

function linkTopics(parent: TopicNode, child: TopicNode): void {
    parent.children.set(child.name, child);
    child.parents.set(parent.name, parent);
}

/**
 * Builds a graph shaped like:
 *   Science -> Physics -> Optics
 *   Hobbies -> Optics        (Optics has two parents)
 *   Standalone               (root with no children)
 */
function createGraph(): Map<string, TopicNode> {
    const science = createTopicNode('Science');
    const physics = createTopicNode('Physics');
    const optics = createTopicNode('Optics');
    const hobbies = createTopicNode('Hobbies');
    const standalone = createTopicNode('Standalone');

    linkTopics(science, physics);
    linkTopics(physics, optics);
    linkTopics(hobbies, optics);

    return new Map([
        ['Science', science],
        ['Hobbies', hobbies],
        ['Standalone', standalone]
    ]);
}

describe('resolveTopicPath', () => {
    it('returns an already valid topic path unchanged', () => {
        expect(resolveTopicPath(createGraph(), 'Science/Physics/Optics')).toBe('Science/Physics/Optics');
    });

    it('expands a bare nested topic name into a full path', () => {
        // Topic shortcuts store only the topic name. The graph's top level holds
        // root topics, so a nested name has to be resolved by search.
        expect(resolveTopicPath(createGraph(), 'Physics')).toBe('Science/Physics');
    });

    it('resolves a bare name for a topic reachable through several parents', () => {
        const resolved = resolveTopicPath(createGraph(), 'Optics');
        expect(resolved).not.toBeNull();
        expect(['Science/Physics/Optics', 'Hobbies/Optics']).toContain(resolved);
    });

    it('returns a root topic name as its own path', () => {
        expect(resolveTopicPath(createGraph(), 'Standalone')).toBe('Standalone');
    });

    it('returns null for a topic that is not in the graph', () => {
        expect(resolveTopicPath(createGraph(), 'Missing')).toBeNull();
    });

    it('returns null for an empty input', () => {
        expect(resolveTopicPath(createGraph(), '')).toBeNull();
    });
});

describe('findTopicNode', () => {
    it('finds nested topics by exact name', () => {
        expect(findTopicNode(createGraph(), 'Optics')?.name).toBe('Optics');
    });

    it('ignores case when there is no exact match', () => {
        expect(findTopicNode(createGraph(), 'optics')?.name).toBe('Optics');
        expect(findTopicNode(createGraph(), 'SCIENCE')?.name).toBe('Science');
    });

    it('prefers an exact match over an earlier case-insensitive one', () => {
        const graph = createGraph();
        const lower = createTopicNode('science');
        graph.set('science', lower);
        expect(findTopicNode(graph, 'science')).toBe(lower);
    });

    it('returns null for unknown topics', () => {
        expect(findTopicNode(createGraph(), 'Chemistry')).toBeNull();
    });
});

describe('topic search tokens', () => {
    it('resolve topics whose names have capitals', () => {
        const graph = createGraph();
        graph.get('Science')?.children.get('Physics')?.notesWithTag.add('Notes/Lens.md');

        const tokens = parseFilterSearchTokens('topic:"Physics"');
        const node = findTopicNode(graph, tokens.topicTokens[0]);

        expect(node?.name).toBe('Physics');
        expect(node ? [...collectTopicFilePaths(node)] : []).toEqual(['Notes/Lens.md']);
    });

    it('resolve excluded topics whose names have capitals', () => {
        const tokens = parseFilterSearchTokens('!topic:"Hobbies"');
        expect(findTopicNode(createGraph(), tokens.excludeTopicTokens[0])?.name).toBe('Hobbies');
    });
});

describe('getTopicNameFromPath', () => {
    it('strips the folder and the .md extension', () => {
        expect(getTopicNameFromPath('Topics/Physics.md')).toBe('Physics');
        expect(getTopicNameFromPath('Science/Physics')).toBe('Physics');
    });

    it('keeps dots inside the name', () => {
        expect(getTopicNameFromPath('Topics/v1.2.md')).toBe('v1.2');
        expect(getTopicNameFromPath('Dr. Who.md')).toBe('Dr. Who');
        expect(getTopicNameFromPath('Science/Node.js')).toBe('Node.js');
    });
});
