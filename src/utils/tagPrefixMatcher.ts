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

import {
    getNormalizedPathSegments,
    getPathPatternCacheKey,
    matchesParsedPatternSegments,
    parsePathPattern,
    type ParsedPathPattern
} from './pathPatternMatcher';
import { normalizeCaseInsensitiveIdentifierPreservingWhitespace } from './recordUtils';

/**
 * Simple tag prefix matching utilities
 *
 * This module provides prefix-based matching for hidden tag rules.
 * Tags are matched from left to right only.
 *
 * Examples:
 * - Prefix "photo/camera" matches: "photo/camera", "photo/camera/fuji"
 * - Prefix "photo/camera" does NOT match: "photo", "hobbies/photo/camera"
 * - Prefix "photo" matches: "photo", "photo/camera", "photo/editing"
 * - Prefix "photo" does NOT match: "hobbies/photo"
 */

/**
 * Cleans a tag path by removing # prefix and trimming slashes.
 * Assumes the input string is already lowercase.
 */
function cleanTagPath(tag: string): string {
    const cleaned = tag.startsWith('#') ? tag.substring(1) : tag;
    return cleaned.replace(/^\/+|\/+$/g, ''); // Trim leading/trailing slashes
}

/**
 * Checks if a tag matches a specific prefix. Assumes lowercase inputs.
 * @param tagPath - The tag path to check (e.g., "photo/camera/fuji") - must be lowercase
 * @param prefix - The prefix to match against (e.g., "photo/camera") - must be lowercase
 * @returns true if the tag starts with the prefix
 */
function matchesPrefix(tagPath: string, prefix: string): boolean {
    const cleanedTag = cleanTagPath(tagPath);
    // prefix from settings is already clean and lowercase

    // Check both exact match and prefix match in one expression
    return cleanedTag === prefix || cleanedTag.startsWith(`${prefix}/`);
}

/**
 * Checks if a tag matches any of the given prefixes. Assumes lowercase inputs.
 * @param tagPath - The tag path to check - must be lowercase
 * @param prefixes - Array of prefixes to match against - must be lowercase
 * @returns true if the tag matches any prefix
 */
function matchesAnyPrefix(tagPath: string, prefixes: string[]): boolean {
    return prefixes.some(prefix => matchesPrefix(tagPath, prefix));
}

/**
 * Hidden tag pattern handling
 *
 * Rules:
 * - Path rules without wildcards hide the tag and its descendants.
 * - Path rules that end with `/*` hide descendants while keeping the base tag visible (e.g., `projects/*` hides `projects/client` but not `projects`).
 * - Path rules that end with `*` but no slash hide the base tag and descendants (e.g., `projects*` hides `projects` and `projects/client`).
 * - Name rules: single wildcard at the start (`*tag`) applies to tag names only, at any depth.
 * - Anything with multiple wildcards or a wildcard in the middle of a path segment is ignored to keep matching predictable.
 *
 * Examples:
 * - "archive" -> hides archive, archive/2024, archive/2024/docs (path prefix)
 * - "archive/*" -> hides archive/2024 and archive/2024/docs, keeps archive visible
 * - "archive*" -> hides archive and all descendants (path prefix with wildcard)
 * - "temp*" -> hides temp, temp-file, temporary (name starts with) while also hiding descendants via path prefix
 * - "*draft" -> hides draft, my-draft, first-draft (name ends with)
 * - "archive/<wildcard>/private" -> ignored (wildcard mid-path)
 * - "*temp*" -> ignored (multiple wildcards)
 */
export interface HiddenTagMatcher {
    prefixes: string[]; // Full path prefix matchers (legacy compatibility)
    startsWithNames: string[]; // Tag name prefix matchers (e.g., "temp" from "temp*")
    endsWithNames: string[]; // Tag name suffix matchers (e.g., "draft" from "*draft")
    pathPatterns: HiddenTagPathPattern[]; // Parsed path-based patterns
}

export type HiddenTagPathPattern = ParsedPathPattern;

const EMPTY_HIDDEN_TAG_MATCHER: HiddenTagMatcher = {
    prefixes: [],
    startsWithNames: [],
    endsWithNames: [],
    pathPatterns: []
};

/**
 * Removes # prefix, trims slashes, and converts to lowercase.
 */
function sanitizePattern(pattern: string): string {
    return normalizeTagPathValue(pattern);
}

/**
 * Normalizes a tag path or pattern by trimming slashes, removing # prefix, and lowercasing.
 */
export function normalizeTagPathValue(tag: string): string {
    return normalizeCaseInsensitiveIdentifierPreservingWhitespace(cleanTagPath(tag));
}

// Cache parsed matchers and path patterns keyed by the joined pattern list.
const tagMatcherCache = new Map<string, HiddenTagMatcher>();
const tagPathCache = new Map<string, HiddenTagPathPattern[]>();

// Clears all hidden-tag matcher caches.
export const clearHiddenTagPatternCache = (): void => {
    tagMatcherCache.clear();
    tagPathCache.clear();
};

export const getHiddenTagPathPatterns = (patterns: string[]): HiddenTagPathPattern[] => {
    const cacheKey = getPathPatternCacheKey(patterns);
    const cached = tagPathCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const parsed = patterns
        .map(entry => parsePathPattern(entry, { normalizePattern: sanitizePattern }))
        .filter((entry): entry is HiddenTagPathPattern => Boolean(entry));
    tagPathCache.set(cacheKey, parsed);
    return parsed;
};

/**
 * Parses patterns and categorizes them into prefix matchers or wildcard name matchers.
 *
 * @param patterns - Array of patterns from settings (e.g., ["archive", "temp*", "*draft"])
 * @returns Matcher with categorized patterns
 */
export function createHiddenTagMatcher(patterns: string[]): HiddenTagMatcher {
    if (patterns.length === 0) {
        return EMPTY_HIDDEN_TAG_MATCHER;
    }

    const cacheKey = getPathPatternCacheKey(patterns);
    const cached = tagMatcherCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const prefixes = new Set<string>();
    const startsWithNames = new Set<string>();
    const endsWithNames = new Set<string>();
    const pathPatterns = getHiddenTagPathPatterns(patterns);

    for (const rawPattern of patterns) {
        const normalized = sanitizePattern(rawPattern);
        if (normalized.length === 0) {
            continue;
        }

        const hasSlash = normalized.includes('/');
        const starCount = (normalized.match(/\*/g) || []).length;
        const startsWithWildcard = normalized.startsWith('*');
        const endsWithWildcard = normalized.endsWith('*');

        if (!hasSlash && starCount === 1 && startsWithWildcard && !endsWithWildcard) {
            const suffix = normalized.slice(1);
            if (suffix.length > 0) {
                endsWithNames.add(suffix);
            }
            continue;
        }

        if (!hasSlash && starCount === 1 && endsWithWildcard && !startsWithWildcard) {
            const prefix = normalized.slice(0, -1);
            if (prefix.length > 0) {
                startsWithNames.add(prefix);
                prefixes.add(prefix);
            }
            continue;
        }

        if (!normalized.includes('*')) {
            prefixes.add(normalized);
        }
    }

    const matcher: HiddenTagMatcher = {
        prefixes: Array.from(prefixes),
        startsWithNames: Array.from(startsWithNames),
        endsWithNames: Array.from(endsWithNames),
        pathPatterns
    };

    tagMatcherCache.set(cacheKey, matcher);
    return matcher;
}

/**
 * Checks if a tag matches any hidden tag pattern.
 *
 * @param tagPath - Full tag path (e.g., "archive/2024/docs")
 * @param tagName - Just the tag name (e.g., "docs")
 * @param matcher - Matcher from createHiddenTagMatcher
 * @returns true if tag matches a pattern
 */
export function matchesHiddenTagPattern(tagPath: string, tagName: string, matcher: HiddenTagMatcher): boolean {
    if (
        matcher.pathPatterns.length === 0 &&
        matcher.prefixes.length === 0 &&
        matcher.startsWithNames.length === 0 &&
        matcher.endsWithNames.length === 0
    ) {
        return false;
    }

    const normalizedPath = sanitizePattern(tagPath);
    const pathSegments = getNormalizedPathSegments(normalizedPath, normalizeTagPathValue);
    const normalizedName = normalizeCaseInsensitiveIdentifierPreservingWhitespace(tagName);

    if (matcher.pathPatterns.some(pattern => matchesParsedPatternSegments(pattern, pathSegments))) {
        return true;
    }

    if (matcher.prefixes.length > 0 && matchesAnyPrefix(normalizedPath, matcher.prefixes)) {
        return true;
    }

    // Check name starts with (e.g., "temp*" matches "temp-file")
    if (matcher.startsWithNames.some(prefix => normalizedName.startsWith(prefix))) {
        return true;
    }

    // Check name ends with (e.g., "*draft" matches "my-draft")
    if (matcher.endsWithNames.some(suffix => normalizedName.endsWith(suffix))) {
        return true;
    }

    return false;
}

/**
 * Provides helpers for working with hidden tag rules in different contexts.
 */
export interface HiddenTagVisibility {
    matcher: HiddenTagMatcher;
    hasHiddenRules: boolean;
    shouldFilterHiddenTags: boolean;
    /**
     * Returns true when the tag does not match any hidden pattern.
     */
    isTagVisible(tagPath: string, tagName?: string): boolean;
    /**
     * Returns true when the collection contains at least one visible tag.
     */
    hasVisibleTags(tags: readonly string[]): boolean;
}

/**
 * Creates a visibility helper for the provided hidden tag patterns and visibility setting.
 *
 * @param patterns - Hidden tag patterns from settings
 * @param showHiddenItems - Whether hidden items should be shown in the UI
 */
export function createHiddenTagVisibility(patterns: string[], showHiddenItems: boolean): HiddenTagVisibility {
    const matcher = createHiddenTagMatcher(patterns);
    const hasHiddenRules =
        matcher.pathPatterns.length > 0 ||
        matcher.prefixes.length > 0 ||
        matcher.startsWithNames.length > 0 ||
        matcher.endsWithNames.length > 0;
    const shouldFilterHiddenTags = hasHiddenRules && !showHiddenItems;

    const isTagVisible = shouldFilterHiddenTags
        ? (tagPath: string, tagName?: string) => {
              const normalizedPath = normalizeTagPathValue(tagPath);
              const normalizedName =
                  tagName !== undefined
                      ? normalizeCaseInsensitiveIdentifierPreservingWhitespace(tagName)
                      : (normalizedPath.split('/').pop() ?? normalizedPath);
              return !matchesHiddenTagPattern(normalizedPath, normalizedName, matcher);
          }
        : () => true;

    const hasVisibleTags = shouldFilterHiddenTags
        ? (tags: readonly string[]) => {
              for (const tag of tags) {
                  if (isTagVisible(tag)) {
                      return true;
                  }
              }
              return false;
          }
        : (tags: readonly string[]) => tags.length > 0;

    return {
        matcher,
        hasHiddenRules,
        shouldFilterHiddenTags,
        isTagVisible,
        hasVisibleTags
    };
}

/**
 * Cleans up redundant tag patterns when adding a new pattern.
 * Removes existing patterns that would be covered by the new pattern.
 *
 * Example: When adding "photo", removes "photo/camera", "photo/camera/fuji"
 *
 * @param existingPatterns - Current list of tag patterns
 * @param newPattern - The new pattern being added
 * @returns Cleaned list with the new pattern added and redundant ones removed
 */
export function cleanupTagPatterns(existingPatterns: string[], newPattern: string): string[] {
    const normalizedNew = sanitizePattern(newPattern);
    if (normalizedNew.length === 0) {
        return existingPatterns;
    }

    const hasWildcard = normalizedNew.includes('*');
    const result: string[] = [];
    const seen = new Set<string>();

    for (const existing of existingPatterns) {
        const normalizedExisting = sanitizePattern(existing);
        if (normalizedExisting.length === 0) {
            continue;
        }

        if (seen.has(normalizedExisting)) {
            continue;
        }

        if (!hasWildcard && !normalizedExisting.includes('*') && normalizedExisting.startsWith(`${normalizedNew}/`)) {
            continue;
        }

        result.push(normalizedExisting);
        seen.add(normalizedExisting);
    }

    if (!seen.has(normalizedNew)) {
        result.push(normalizedNew);
    }

    return result;
}
