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
import { findMatchingRecordKey } from './recordUtils';
import { HAS_TOPIC_RELATIONS } from './topicGraph';

/** Frontmatter property a note gets when it is linked to a topic from the navigator */
export const TOPIC_LINK_RELATION = 'hasTopic';

export type AddTopicLinkResult = 'added' | 'already-linked' | 'unsupported-value' | 'invalid-name';

/** Returns the link target of a `[[target|alias]]` or `[[folder/target.md#heading]]` string, lowercase, or null */
function getWikiLinkTarget(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith('[[') || !trimmed.endsWith(']]')) {
        return null;
    }
    const target = trimmed.slice(2, -2).split('|')[0].split('#')[0].trim();
    const name = target.split('/').pop() ?? target;
    return name.replace(/\.md$/i, '').toLowerCase();
}

function valueLinksTo(value: unknown, lowerName: string): boolean {
    if (Array.isArray(value)) {
        return value.some(entry => getWikiLinkTarget(entry) === lowerName);
    }
    return getWikiLinkTarget(value) === lowerName;
}

/**
 * Fork: adds a link to a topic in a note's frontmatter, for Obsidian's processFrontMatter callback. The note gets
 * `hasTopic: ["[[Topic]]"]`, merged into an existing hasTopic list or single link.
 *
 * It never breaks the note: a note already linked to the topic through any topic relation is left unchanged, and a
 * hasTopic value that is not a string or a list (a number, an object) is never overwritten. Names that cannot be
 * written as a wiki link are refused.
 */
export function addTopicLinkToFrontmatter(frontmatter: Record<string, unknown>, topicName: string): AddTopicLinkResult {
    const name = topicName.trim();
    if (!name || /[[\]|#^]/.test(name)) {
        return 'invalid-name';
    }
    const lowerName = name.toLowerCase();

    for (const relation of HAS_TOPIC_RELATIONS) {
        const key = findMatchingRecordKey(frontmatter, relation);
        if (key && valueLinksTo(frontmatter[key], lowerName)) {
            return 'already-linked';
        }
    }

    const link = `[[${name}]]`;
    const key = findMatchingRecordKey(frontmatter, TOPIC_LINK_RELATION) ?? TOPIC_LINK_RELATION;
    const existing = frontmatter[key];

    if (existing === undefined || existing === null || existing === '') {
        frontmatter[key] = [link];
        return 'added';
    }
    if (typeof existing === 'string') {
        frontmatter[key] = [existing, link];
        return 'added';
    }
    if (Array.isArray(existing)) {
        const entries: unknown[] = existing;
        frontmatter[key] = [...entries, link];
        return 'added';
    }
    return 'unsupported-value';
}
