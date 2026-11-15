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
import { describe, expect, it } from 'vitest';
import { createTopicComparator, orderRootTopics } from '../../src/utils/topicOrder';
import type { TopicNode } from '../../src/types/storage';

function topic(name: string, notes: number): TopicNode {
    return {
        name,
        parents: new Map(),
        children: new Map(),
        notesWithTag: new Set(Array.from({ length: notes }, (_, index) => `${name}/${index}.md`))
    };
}

const science = topic('Science', 5);
const hobbies = topic('Hobbies', 1);
const art = topic('Art', 3);
const roots = [science, hobbies, art];

describe('orderRootTopics', () => {
    it('uses the topic sort order without a manual order', () => {
        expect(orderRootTopics(roots, [], createTopicComparator('alpha-asc')).map(n => n.name)).toEqual(['Art', 'Hobbies', 'Science']);
        expect(orderRootTopics(roots, [], createTopicComparator('frequency-desc')).map(n => n.name)).toEqual(['Science', 'Art', 'Hobbies']);
    });

    it('puts manually ordered roots first and sorts the rest', () => {
        expect(orderRootTopics(roots, ['Science'], createTopicComparator('alpha-asc')).map(n => n.name)).toEqual([
            'Science',
            'Art',
            'Hobbies'
        ]);
        expect(orderRootTopics(roots, ['Hobbies', 'Science', 'Art'], createTopicComparator('alpha-desc')).map(n => n.name)).toEqual([
            'Hobbies',
            'Science',
            'Art'
        ]);
    });

    it('skips names without a root topic and duplicates', () => {
        expect(orderRootTopics(roots, ['Gone', 'Art', 'Art'], createTopicComparator('alpha-asc')).map(n => n.name)).toEqual([
            'Art',
            'Hobbies',
            'Science'
        ]);
    });
});
