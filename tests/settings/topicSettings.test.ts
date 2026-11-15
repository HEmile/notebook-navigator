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
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { sanitizeTopicSettings } from '../../src/settings/topicSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';

function settingsWith(overrides: Record<string, unknown>): NotebookNavigatorSettings {
    return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('sanitizeTopicSettings', () => {
    it('keeps valid topic settings', () => {
        const settings = settingsWith({
            showTopics: false,
            topicSortOrder: 'frequency-desc',
            topicTags: ['topic', 'person'],
            hiddenTopics: ['Inbox'],
            rootTopicOrder: ['Science', 'Hobbies']
        });
        sanitizeTopicSettings(settings);
        expect(settings.showTopics).toBe(false);
        expect(settings.topicSortOrder).toBe('frequency-desc');
        expect(settings.topicTags).toEqual(['topic', 'person']);
        expect(settings.hiddenTopics).toEqual(['Inbox']);
        expect(settings.rootTopicOrder).toEqual(['Science', 'Hobbies']);
    });

    it('repairs wrong types and invalid values', () => {
        const settings = settingsWith({
            showTopics: 'yes',
            topicSortOrder: 'sideways',
            topicTags: 'topic',
            hiddenTopics: null,
            rootTopicOrder: { a: 1 },
            topicStylesMigrated: 'no'
        });
        sanitizeTopicSettings(settings);
        expect(settings.showTopics).toBe(DEFAULT_SETTINGS.showTopics);
        expect(settings.topicSortOrder).toBe(DEFAULT_SETTINGS.topicSortOrder);
        expect(settings.topicTags).toEqual(DEFAULT_SETTINGS.topicTags);
        expect(settings.hiddenTopics).toEqual([]);
        expect(settings.rootTopicOrder).toEqual([]);
        expect(settings.topicStylesMigrated).toBe(false);
    });

    it('cleans string lists and never leaves topic tags empty', () => {
        const settings = settingsWith({ topicTags: [' topic ', '', 42, 'topic'], hiddenTopics: ['A', 'A', '  '] });
        sanitizeTopicSettings(settings);
        expect(settings.topicTags).toEqual(['topic']);
        expect(settings.hiddenTopics).toEqual(['A']);

        const empty = settingsWith({ topicTags: ['', '  '] });
        sanitizeTopicSettings(empty);
        expect(empty.topicTags).toEqual(DEFAULT_SETTINGS.topicTags);
    });
});
