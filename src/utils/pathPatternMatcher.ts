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

// Utilities for parsing normalized path patterns with literal, prefix, and wildcard segments.
export type PathPatternSegment = { type: 'literal'; value: string } | { type: 'prefix'; value: string } | { type: 'wildcard' };

export interface ParsedPathPattern {
    raw: string;
    normalized: string;
    segments: PathPatternSegment[];
    literalPrefixLength: number;
}

export interface PathPatternOptions {
    normalizePattern: (pattern: string) => string;
    requireRoot?: boolean;
}

export interface PathMatcherOptions extends PathPatternOptions {
    normalizePath: (path: string) => string;
}

export interface PathPatternMatcher {
    patterns: ParsedPathPattern[];
    matches: (path: string) => boolean;
}

const parsePathPatternSegment = (segment: string): PathPatternSegment | null => {
    if (!segment) {
        return null;
    }

    const starCount = (segment.match(/\*/g) || []).length;
    if (starCount === 0) {
        return { type: 'literal', value: segment };
    }

    if (starCount > 1) {
        return null;
    }

    if (segment === '*') {
        return { type: 'wildcard' };
    }

    if (segment.endsWith('*')) {
        const prefix = segment.slice(0, -1);
        if (!prefix || prefix.includes('*')) {
            return null;
        }
        return { type: 'prefix', value: prefix };
    }

    return null;
};

export const parsePathPattern = (pattern: string, options: PathPatternOptions): ParsedPathPattern | null => {
    if (typeof pattern !== 'string') {
        return null;
    }

    const trimmed = pattern.trim();
    if (options.requireRoot && !trimmed.startsWith('/')) {
        return null;
    }

    const normalized = options.normalizePattern(trimmed);
    if (!normalized) {
        return null;
    }

    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) {
        return null;
    }

    const segments: PathPatternSegment[] = [];
    for (const part of parts) {
        const parsed = parsePathPatternSegment(part);
        if (!parsed) {
            return null;
        }
        segments.push(parsed);
    }

    let literalPrefixLength = 0;
    for (const segment of segments) {
        if (segment.type === 'literal') {
            literalPrefixLength += 1;
            continue;
        }
        break;
    }

    return {
        raw: pattern,
        normalized,
        segments,
        literalPrefixLength
    };
};

export const getNormalizedPathSegments = (path: string, normalizePath: (value: string) => string): string[] => {
    const normalized = normalizePath(path);
    if (!normalized) {
        return [];
    }
    return normalized.split('/').filter(Boolean);
};

export const matchesParsedPatternSegments = (pattern: ParsedPathPattern, pathSegments: string[]): boolean => {
    if (pathSegments.length === 0) {
        return false;
    }

    const segmentCount = pattern.segments.length;
    const compareCount = Math.min(segmentCount, pathSegments.length);

    for (let index = 0; index < compareCount; index += 1) {
        const segment = pattern.segments[index];
        const candidate = pathSegments[index];

        if (segment.type === 'wildcard') {
            continue;
        }

        if (segment.type === 'prefix') {
            if (!candidate.startsWith(segment.value)) {
                return false;
            }
            continue;
        }

        if (candidate !== segment.value) {
            return false;
        }
    }

    if (pathSegments.length === segmentCount) {
        return true;
    }

    if (pathSegments.length < segmentCount) {
        const hasMissingSegments = pathSegments.length < segmentCount;
        const onlyTrailingWildcards =
            hasMissingSegments && pattern.segments.slice(pathSegments.length).every(segment => segment.type === 'wildcard');

        // When the pattern ends with wildcards, require at least one extra path segment beyond the literal prefix
        // so that "/folder/*" matches children of "/folder" but not "/folder" itself.
        if (onlyTrailingWildcards && pathSegments.length > pattern.literalPrefixLength) {
            return true;
        }

        for (let index = pathSegments.length; index < segmentCount; index += 1) {
            if (pattern.segments[index].type !== 'wildcard') {
                return false;
            }
        }
        return false;
    }

    return true;
};

export const matchesLiteralPrefix = (pattern: ParsedPathPattern, candidateSegments: string[]): boolean => {
    if (pattern.literalPrefixLength === 0 || candidateSegments.length === 0) {
        return false;
    }

    const compareCount = Math.min(pattern.literalPrefixLength, pattern.segments.length, candidateSegments.length);
    if (compareCount === 0) {
        return false;
    }

    for (let index = 0; index < compareCount; index += 1) {
        const segment = pattern.segments[index];
        const candidate = candidateSegments[index];
        if (segment.type !== 'literal' || segment.value !== candidate) {
            return false;
        }
    }

    return true;
};

export const rebuildPattern = (
    pattern: ParsedPathPattern,
    nextSegments: string[],
    options: { addLeadingSlash?: boolean; normalizePattern?: (value: string) => string } = {}
): string => {
    const rebuiltSegments = pattern.segments.map((segment, index) => {
        if (index < pattern.literalPrefixLength && segment.type === 'literal') {
            return nextSegments[index] ?? segment.value;
        }

        if (segment.type === 'wildcard') {
            return '*';
        }

        if (segment.type === 'prefix') {
            return `${segment.value}*`;
        }

        return segment.value;
    });

    const joined = rebuiltSegments.join('/');
    const rebuilt = options.addLeadingSlash ? `/${joined}` : joined;
    return options.normalizePattern ? options.normalizePattern(rebuilt) : rebuilt;
};

export const createPathPatternMatcher = (patterns: string[], options: PathMatcherOptions): PathPatternMatcher => {
    const parsedPatterns = patterns
        .map(entry => parsePathPattern(entry, options))
        .filter((entry): entry is ParsedPathPattern => Boolean(entry));

    const matcher: PathPatternMatcher = {
        patterns: parsedPatterns,
        matches: (path: string) => {
            const pathSegments = getNormalizedPathSegments(path, options.normalizePath);
            if (pathSegments.length === 0 || parsedPatterns.length === 0) {
                return false;
            }
            return parsedPatterns.some(pattern => matchesParsedPatternSegments(pattern, pathSegments));
        }
    };

    return matcher;
};

export const getPathPatternCacheKey = (patterns: string[]): string => patterns.join('\u0001');
