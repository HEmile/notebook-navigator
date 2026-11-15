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
import { addTopicToSearchQuery, toggleTopicInSearchQuery } from '../../src/utils/topicSearch';
import { buildSearchNavFilterState, parseFilterSearchTokens } from '../../src/utils/filterSearch';

describe('toggleTopicInSearchQuery', () => {
    it('adds a topic filter', () => {
        expect(toggleTopicInSearchQuery('', 'Machine Learning')).toBe('topic:"Machine Learning"');
        expect(toggleTopicInSearchQuery('#idea draft', 'Physics')).toBe('#idea draft topic:"Physics"');
    });

    it('removes an existing include filter for the topic, ignoring case', () => {
        expect(toggleTopicInSearchQuery('draft topic:"machine learning" #idea', 'Machine Learning')).toBe('draft #idea');
        expect(toggleTopicInSearchQuery('topic:"Physics"', 'Physics')).toBe('');
    });

    it('leaves exclude filters and other topics alone', () => {
        expect(toggleTopicInSearchQuery('!topic:"Physics" topic:"Optics"', 'Physics')).toBe(
            '!topic:"Physics" topic:"Optics" topic:"Physics"'
        );
    });

    it('ignores names it cannot quote', () => {
        expect(toggleTopicInSearchQuery('draft', 'Say "hi"')).toBe('draft');
    });

    it('produces tokens the search parser reads back', () => {
        const query = toggleTopicInSearchQuery('#idea', 'Machine Learning');
        expect(parseFilterSearchTokens(query).topicTokens).toEqual(['machine learning']);
    });
});

describe('addTopicToSearchQuery', () => {
    it('adds the topic once', () => {
        expect(addTopicToSearchQuery('draft', 'Physics')).toBe('draft topic:"Physics"');
        expect(addTopicToSearchQuery('draft topic:"physics"', 'Physics')).toBe('draft topic:"physics"');
    });
});

describe('buildSearchNavFilterState', () => {
    it('collects topic include and exclude names for highlighting', () => {
        const state = buildSearchNavFilterState('topic:"Machine Learning" !topic:"Archive" #idea');
        expect(state.topics).toEqual({ include: ['machine learning'], exclude: ['archive'] });
    });
});
