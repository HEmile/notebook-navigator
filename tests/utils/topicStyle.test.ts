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
import { resolveTopicStyle } from '../../src/utils/topicStyle';
import { parseTopicTagsInput, unhideTopic } from '../../src/settings/tabs/TopicsTab';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { TOPICS_ROOT_VIRTUAL_FOLDER_ID } from '../../src/types';

const colors: Record<string, string> = { science: '#111111', physics: '#222222' };
const backgrounds: Record<string, string> = { science: '#eeeeee' };
const source = {
    getTopicColor: (name: string) => colors[name.toLowerCase()],
    getTopicBackgroundColor: (name: string) => backgrounds[name.toLowerCase()]
};

describe('resolveTopicStyle', () => {
    it('uses the topic own style first', () => {
        expect(resolveTopicStyle(source, 'Science/Physics', { inheritTopicColors: true })).toEqual({
            color: '#222222',
            backgroundColor: '#eeeeee'
        });
    });

    it('inherits from the nearest ancestor on the shown path', () => {
        expect(resolveTopicStyle(source, 'Science/Physics/Optics', { inheritTopicColors: true }).color).toBe('#222222');
        expect(resolveTopicStyle(source, 'Hobbies/Optics', { inheritTopicColors: true }).color).toBeUndefined();
    });

    it('falls back to the Topics section color, and inherits nothing when turned off', () => {
        const settings = { inheritTopicColors: true, virtualFolderColors: { [TOPICS_ROOT_VIRTUAL_FOLDER_ID]: '#abcdef' } };
        expect(resolveTopicStyle(source, 'Hobbies/Optics', settings).color).toBe('#abcdef');
        expect(resolveTopicStyle(source, 'Science/Physics/Optics', { ...settings, inheritTopicColors: false })).toEqual({
            color: undefined,
            backgroundColor: undefined
        });
    });
});

describe('Topics settings page helpers', () => {
    it('parses the topic tags field', () => {
        expect(parseTopicTagsInput(' topic, #person ,, topic,jaar ')).toEqual(['topic', 'person', 'jaar']);
        expect(parseTopicTagsInput(' , ')).toEqual([]);
    });

    it('unhides a topic', () => {
        const settings = { ...DEFAULT_SETTINGS, hiddenTopics: ['Inbox', 'Archive'] };
        unhideTopic(settings, 'Inbox');
        expect(settings.hiddenTopics).toEqual(['Archive']);
    });
});
