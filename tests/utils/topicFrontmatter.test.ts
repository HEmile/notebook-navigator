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
import { addTopicLinkToFrontmatter } from '../../src/utils/topicFrontmatter';

describe('addTopicLinkToFrontmatter', () => {
    it('adds a hasTopic list to a note without one', () => {
        const frontmatter: Record<string, unknown> = { title: 'Lens' };
        expect(addTopicLinkToFrontmatter(frontmatter, 'Optics')).toBe('added');
        expect(frontmatter).toEqual({ title: 'Lens', hasTopic: ['[[Optics]]'] });
    });

    it('treats empty values as missing', () => {
        for (const empty of [null, '']) {
            const frontmatter: Record<string, unknown> = { hasTopic: empty };
            expect(addTopicLinkToFrontmatter(frontmatter, 'Optics')).toBe('added');
            expect(frontmatter.hasTopic).toEqual(['[[Optics]]']);
        }
    });

    it('appends to an existing list, keeping its entries untouched', () => {
        const frontmatter: Record<string, unknown> = { hasTopic: ['[[Physics]]', 'plain text', 42] };
        expect(addTopicLinkToFrontmatter(frontmatter, 'Optics')).toBe('added');
        expect(frontmatter.hasTopic).toEqual(['[[Physics]]', 'plain text', 42, '[[Optics]]']);
    });

    it('turns a single link into a list', () => {
        const frontmatter: Record<string, unknown> = { hasTopic: '[[Physics]]' };
        expect(addTopicLinkToFrontmatter(frontmatter, 'Optics')).toBe('added');
        expect(frontmatter.hasTopic).toEqual(['[[Physics]]', '[[Optics]]']);
    });

    it('reuses the existing key spelling', () => {
        const frontmatter: Record<string, unknown> = { HasTopic: ['[[Physics]]'] };
        expect(addTopicLinkToFrontmatter(frontmatter, 'Optics')).toBe('added');
        expect(frontmatter).toEqual({ HasTopic: ['[[Physics]]', '[[Optics]]'] });
    });

    it('does nothing when any topic relation already links the topic', () => {
        const cases: Record<string, unknown>[] = [
            { hasTopic: ['[[Optics]]'] },
            { hasTopic: '[[optics]]' },
            { subset: ['[[Science/Optics.md|lenses]]'] },
            { author: '[[Optics#History]]' }
        ];
        for (const frontmatter of cases) {
            const before = JSON.stringify(frontmatter);
            expect(addTopicLinkToFrontmatter(frontmatter, 'Optics')).toBe('already-linked');
            expect(JSON.stringify(frontmatter)).toBe(before);
        }
    });

    it('never overwrites a value it does not understand', () => {
        for (const value of [5, { nested: true }, true]) {
            const frontmatter: Record<string, unknown> = { hasTopic: value };
            expect(addTopicLinkToFrontmatter(frontmatter, 'Optics')).toBe('unsupported-value');
            expect(frontmatter.hasTopic).toBe(value);
        }
    });

    it('refuses names that cannot be written as a link', () => {
        for (const name of ['', '  ', 'A|B', 'A#B', 'A[1]', 'A^B']) {
            const frontmatter: Record<string, unknown> = {};
            expect(addTopicLinkToFrontmatter(frontmatter, name)).toBe('invalid-name');
            expect(frontmatter).toEqual({});
        }
    });

    it('keeps other frontmatter fields as they are', () => {
        const frontmatter: Record<string, unknown> = { tags: ['idea'], created: '2026-01-01', aliases: ['x'] };
        addTopicLinkToFrontmatter(frontmatter, 'Optics');
        expect(frontmatter).toEqual({ tags: ['idea'], created: '2026-01-01', aliases: ['x'], hasTopic: ['[[Optics]]'] });
    });
});
