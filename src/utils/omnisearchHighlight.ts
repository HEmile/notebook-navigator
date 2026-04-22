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

import type { SearchResultMatch } from '../types/search';

const QUERY_TOKEN_SPLIT_REGEX = /\s+/;
const HIGHLIGHTABLE_CHARACTER_REGEX = /[\p{L}\p{N}]/u;
const CJK_SINGLE_CHARACTER_REGEX = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u;
const DIACRITIC_MARK_REGEX = /\p{M}+/gu;
const QUERY_FILTER_OPERATOR_REGEX = /(^|\s)-?(?:path|ext)\s*:\s*(?:"[^"]*"|'[^']*'|[^\s]+)/gi;
const QUERY_QUOTED_TOKEN_REGEX = /"([^"]+)"|'([^']+)'/g;
const QUERY_BOUNDARY_QUOTE_REGEX = /^["'`]+|["'`]+$/g;
const QUERY_PREFIX_OPERATOR_REGEX = /^[-+]+/;

function normalizeToken(value: string): string {
    return value.trim().toLowerCase();
}

function foldDiacritics(value: string): string {
    return value.normalize('NFD').replace(DIACRITIC_MARK_REGEX, '');
}

function hasHighlightableCharacters(value: string): boolean {
    return HIGHLIGHTABLE_CHARACTER_REGEX.test(value);
}

function hasPrefixRelation(token: string, queryToken: string): boolean {
    return queryToken.startsWith(token) || token.startsWith(queryToken);
}

function isSingleCharacterCjkToken(token: string): boolean {
    return CJK_SINGLE_CHARACTER_REGEX.test(token);
}

function isTokenRelatedToQuery(
    token: string,
    foldedToken: string,
    queryTokens: readonly string[],
    foldedQueryTokens: readonly string[]
): boolean {
    if (queryTokens.length === 0) {
        return false;
    }

    if (token.length === 1) {
        if (queryTokens.some(queryToken => queryToken === token)) {
            return true;
        }

        if (!isSingleCharacterCjkToken(token)) {
            return false;
        }

        return queryTokens.some(queryToken => queryToken.includes(token));
    }

    if (queryTokens.some(queryToken => queryToken === token || hasPrefixRelation(token, queryToken))) {
        return true;
    }

    return foldedQueryTokens.some(queryToken => queryToken === foldedToken || hasPrefixRelation(foldedToken, queryToken));
}

function shouldKeepToken(
    token: string,
    foldedToken: string,
    queryTokens: readonly string[],
    foldedQueryTokens: readonly string[]
): boolean {
    if (!token) {
        return false;
    }

    if (!hasHighlightableCharacters(token)) {
        return false;
    }

    return isTokenRelatedToQuery(token, foldedToken, queryTokens, foldedQueryTokens);
}

function stripQueryFilterOperators(query: string): string {
    return query.replace(QUERY_FILTER_OPERATOR_REGEX, (_match: string, leadingWhitespace: string | undefined) => {
        if (typeof leadingWhitespace === 'string' && leadingWhitespace.length > 0) {
            return leadingWhitespace;
        }
        return ' ';
    });
}

function normalizeQueryToken(value: string): string {
    return normalizeToken(value).replace(QUERY_BOUNDARY_QUOTE_REGEX, '').replace(QUERY_PREFIX_OPERATOR_REGEX, '').trim();
}

function pushQueryToken(target: string[], seen: Set<string>, token: string): void {
    const normalized = normalizeQueryToken(token);
    if (!normalized || !hasHighlightableCharacters(normalized)) {
        return;
    }
    if (normalized === 'path' || normalized === 'ext' || normalized.startsWith('path:') || normalized.startsWith('ext:')) {
        return;
    }
    if (seen.has(normalized)) {
        return;
    }

    seen.add(normalized);
    target.push(normalized);
}

export function extractOmnisearchQueryTokens(query: string): string[] {
    const tokens: string[] = [];
    const seen = new Set<string>();
    const queryWithoutFilterOperators = stripQueryFilterOperators(query);
    const withoutQuotedPhrases = queryWithoutFilterOperators.replace(
        QUERY_QUOTED_TOKEN_REGEX,
        (_match: string, doubleQuoted: string | undefined, singleQuoted: string | undefined) => {
            const phrase = typeof doubleQuoted === 'string' ? doubleQuoted : singleQuoted;
            if (typeof phrase === 'string' && phrase.length > 0) {
                pushQueryToken(tokens, seen, phrase);
                phrase.split(QUERY_TOKEN_SPLIT_REGEX).forEach(segment => pushQueryToken(tokens, seen, segment));
            }
            return ' ';
        }
    );

    withoutQuotedPhrases.split(QUERY_TOKEN_SPLIT_REGEX).forEach(segment => pushQueryToken(tokens, seen, segment));

    return tokens;
}

export interface OmnisearchHighlightQueryTokenContext {
    queryTokens: string[];
    foldedQueryTokens: string[];
}

export function createOmnisearchHighlightQueryTokenContext(query: string): OmnisearchHighlightQueryTokenContext {
    const queryTokens = extractOmnisearchQueryTokens(query);
    return {
        queryTokens,
        foldedQueryTokens: queryTokens.map(token => foldDiacritics(token))
    };
}

export interface SanitizedOmnisearchHighlightTokens {
    matches: SearchResultMatch[];
    terms: string[];
}

export function sanitizeOmnisearchHighlightTokens(
    matches: readonly SearchResultMatch[],
    terms: readonly string[],
    queryContext: OmnisearchHighlightQueryTokenContext
): SanitizedOmnisearchHighlightTokens {
    const { queryTokens, foldedQueryTokens } = queryContext;
    if (queryTokens.length === 0) {
        return { matches: [], terms: [] };
    }

    const filteredMatches: SearchResultMatch[] = [];
    const filteredTerms: string[] = [];
    const seenMatchTokens = new Set<string>();
    const seenMatchFoldedTokens = new Set<string>();
    const seenTermTokens = new Set<string>();
    const seenTermFoldedTokens = new Set<string>();

    for (const match of matches) {
        const normalizedToken = normalizeToken(match.text);
        if (!normalizedToken) {
            continue;
        }

        const foldedToken = foldDiacritics(normalizedToken);
        const validRange = Number.isFinite(match.offset) && Number.isFinite(match.length) && match.offset >= 0 && match.length > 0;

        if (!validRange || !shouldKeepToken(normalizedToken, foldedToken, queryTokens, foldedQueryTokens)) {
            continue;
        }

        filteredMatches.push(match);
        seenMatchTokens.add(normalizedToken);
        seenMatchFoldedTokens.add(foldedToken);
    }

    for (const term of terms) {
        const normalizedToken = normalizeToken(term);
        if (!normalizedToken) {
            continue;
        }

        const foldedToken = foldDiacritics(normalizedToken);
        if (!shouldKeepToken(normalizedToken, foldedToken, queryTokens, foldedQueryTokens)) {
            continue;
        }

        if (
            seenMatchTokens.has(normalizedToken) ||
            seenMatchFoldedTokens.has(foldedToken) ||
            seenTermTokens.has(normalizedToken) ||
            seenTermFoldedTokens.has(foldedToken)
        ) {
            continue;
        }

        seenTermTokens.add(normalizedToken);
        seenTermFoldedTokens.add(foldedToken);
        filteredTerms.push(term);
    }

    return {
        matches: filteredMatches,
        terms: filteredTerms
    };
}
