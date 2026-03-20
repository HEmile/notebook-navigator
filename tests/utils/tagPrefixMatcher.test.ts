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
import { describe, it, expect } from 'vitest';
import { createHiddenTagMatcher, matchesHiddenTagPattern } from '../../src/utils/tagPrefixMatcher';

function extractName(tagPath: string): string {
    const parts = tagPath.split('/');
    return parts[parts.length - 1] ?? tagPath;
}

describe('createHiddenTagMatcher', () => {
    it('categorizes prefix, startsWith, endsWith, and path patterns', () => {
        const matcher = createHiddenTagMatcher(['ARCHIVE', 'temp*', '*Draft', 'archive/*', '*temp*']);

        expect(matcher.prefixes).toEqual(['archive', 'temp']);
        expect(matcher.startsWithNames).toEqual(['temp']);
        expect(matcher.endsWithNames).toEqual(['draft']);
        expect(matcher.pathPatterns.map(pattern => pattern.normalized)).toEqual(expect.arrayContaining(['archive', 'archive/*', 'temp*']));
    });

    it('sanitizes patterns by removing hash prefix and trailing slashes', () => {
        const matcher = createHiddenTagMatcher(['#Area/Planning/', 'Docs//']);

        expect(matcher.prefixes).toContain('area/planning');
        expect(matcher.prefixes).toContain('docs');
        expect(matcher.pathPatterns.map(pattern => pattern.normalized)).toEqual(expect.arrayContaining(['area/planning', 'docs']));
    });

    it('ignores invalid wildcard patterns', () => {
        const matcher = createHiddenTagMatcher(['*temp*', 'archive/**/private', 'proj*ect*', '']);

        expect(matcher.prefixes).toEqual([]);
        expect(matcher.startsWithNames).toEqual([]);
        expect(matcher.endsWithNames).toEqual([]);
        expect(matcher.pathPatterns).toEqual([]);
    });
});

describe('matchesHiddenTagPattern', () => {
    const matcher = createHiddenTagMatcher(['archive', 'temp*', '*draft', 'projects/*/drafts']);

    it('matches full path prefixes', () => {
        expect(matchesHiddenTagPattern('archive', extractName('archive'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('archive/2024/reports', extractName('archive/2024/reports'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('ARCHIVE/Ideas', extractName('ARCHIVE/Ideas'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('project/archive', extractName('project/archive'), matcher)).toBe(false);
    });

    it('matches tag names that start with configured text', () => {
        expect(matchesHiddenTagPattern('temp', extractName('temp'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('temp-notes', extractName('temp-notes'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('attempt', extractName('attempt'), matcher)).toBe(false);
    });

    it('matches wildcard name rules across NFC and NFD-equivalent tag names', () => {
        const unicodeMatcher = createHiddenTagMatcher(['réu*', '*union']);

        expect(matchesHiddenTagPattern('re\u0301union', extractName('re\u0301union'), unicodeMatcher)).toBe(true);
    });

    it('matches tag names that end with configured text', () => {
        expect(matchesHiddenTagPattern('draft', extractName('draft'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('meeting-draft', extractName('meeting-draft'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('drafting', extractName('drafting'), matcher)).toBe(false);
    });

    it('matches mid-segment wildcard path patterns', () => {
        expect(matchesHiddenTagPattern('projects/client/drafts', extractName('projects/client/drafts'), matcher)).toBe(true);
        expect(matchesHiddenTagPattern('projects/other/notes', extractName('projects/other/notes'), matcher)).toBe(false);
    });

    it('matches trailing wildcard path patterns against the base tag', () => {
        const trailingMatcher = createHiddenTagMatcher(['projects/*']);

        expect(matchesHiddenTagPattern('projects', extractName('projects'), trailingMatcher)).toBe(false);
        expect(matchesHiddenTagPattern('projects/client', extractName('projects/client'), trailingMatcher)).toBe(true);
    });

    it('does not match when only ignored wildcard patterns are provided', () => {
        const ignoredMatcher = createHiddenTagMatcher(['archive/*/private', '*temp*']);

        expect(matchesHiddenTagPattern('archive/2024', extractName('archive/2024'), ignoredMatcher)).toBe(false);
        expect(matchesHiddenTagPattern('temp-files', extractName('temp-files'), ignoredMatcher)).toBe(false);
    });

    it('returns false when no patterns are configured', () => {
        const emptyMatcher = createHiddenTagMatcher([]);

        expect(matchesHiddenTagPattern('archive', extractName('archive'), emptyMatcher)).toBe(false);
    });

    it('matches NFC and NFD-equivalent tag paths', () => {
        const unicodeMatcher = createHiddenTagMatcher(['réunion']);

        expect(matchesHiddenTagPattern('re\u0301union', extractName('re\u0301union'), unicodeMatcher)).toBe(true);
        expect(matchesHiddenTagPattern('re\u0301union/notes', extractName('re\u0301union/notes'), unicodeMatcher)).toBe(true);
    });
});
