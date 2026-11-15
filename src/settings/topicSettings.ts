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
import { DEFAULT_SETTINGS } from './defaultSettings';
import { isTagSortOrder, type NotebookNavigatorSettings } from './types';

function sanitizeStringList(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) {
        return [...fallback];
    }
    const seen = new Set<string>();
    for (const entry of value) {
        if (typeof entry !== 'string') {
            continue;
        }
        const trimmed = entry.trim();
        if (trimmed) {
            seen.add(trimmed);
        }
    }
    return [...seen];
}

/**
 * Fork: repairs the topic settings after loading, as upstream does for its own settings. Wrong types fall back to
 * the defaults, and string lists drop non-strings, empty entries and duplicates.
 */
export function sanitizeTopicSettings(settings: NotebookNavigatorSettings): void {
    if (typeof settings.showTopics !== 'boolean') {
        settings.showTopics = DEFAULT_SETTINGS.showTopics;
    }
    if (typeof settings.showTopicIcons !== 'boolean') {
        settings.showTopicIcons = DEFAULT_SETTINGS.showTopicIcons;
    }
    if (typeof settings.inheritTopicColors !== 'boolean') {
        settings.inheritTopicColors = DEFAULT_SETTINGS.inheritTopicColors;
    }
    if (typeof settings.topicSortOrder !== 'string' || !isTagSortOrder(settings.topicSortOrder)) {
        settings.topicSortOrder = DEFAULT_SETTINGS.topicSortOrder;
    }
    const topicTags = sanitizeStringList(settings.topicTags, DEFAULT_SETTINGS.topicTags);
    settings.topicTags = topicTags.length > 0 ? topicTags : [...DEFAULT_SETTINGS.topicTags];
    settings.hiddenTopics = sanitizeStringList(settings.hiddenTopics, []);
    settings.rootTopicOrder = sanitizeStringList(settings.rootTopicOrder, []);
    if (typeof settings.topicStylesMigrated !== 'boolean') {
        settings.topicStylesMigrated = DEFAULT_SETTINGS.topicStylesMigrated;
    }
}
