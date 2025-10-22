/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

/**
 * Tokens extracted from a filter search query.
 * Tokens are normalized to lowercase for matching.
 */
export interface FilterSearchTokens {
    nameTokens: string[];
    tagTokens: string[];
    requireTagged: boolean;
    excludeNameTokens: string[];
    excludeTagTokens: string[];
    excludeTagged: boolean;
    topicTokens: string[];
    excludeTopicTokens: string[];
}

const CONNECTOR_WORDS = new Set(['and']);

/**
 * Parse a filter search query into name and tag tokens with support for negations.
 *
 * Inclusion patterns (must match):
 * - #tag - Include notes with tags containing "tag"
 * - # - Include only notes that have at least one tag
 * - topic: "name" - Include notes belonging to the specified topic
 * - word - Include notes with "word" in their name
 *
 * Exclusion patterns (must NOT match):
 * - !#tag - Exclude notes with tags containing "tag"
 * - !# - Exclude all tagged notes (show only untagged)
 * - -topic: "name" - Exclude notes belonging to the specified topic
 * - !word - Exclude notes with "word" in their name
 *
 * Special handling:
 * - Connector words like "and" are ignored when other tokens exist
 * - All tokens are normalized to lowercase for case-insensitive matching
 *
 * @param query - Raw search query from the UI
 * @returns Parsed tokens with include/exclude criteria for filtering
 */
export function parseFilterSearchTokens(query: string): FilterSearchTokens {
    // First, extract topic patterns before tokenizing
    // Match patterns like: topic: "name" or -topic: "name"
    const topicPattern = /(!)?topic:\s*"([^"]+)"/gi;
    const topicTokens: string[] = [];
    const excludeTopicTokens: string[] = [];
    
    let cleanedQuery = query;
    let match;
    while ((match = topicPattern.exec(query)) !== null) {
        const isExclude = match[1] === '-';
        const topicName = match[2].trim().toLowerCase();
        
        if (isExclude) {
            excludeTopicTokens.push(topicName);
        } else {
            topicTokens.push(topicName);
        }
        
        // Remove this pattern from the query
        cleanedQuery = cleanedQuery.replace(match[0], ' ');
    }
    
    const normalized = cleanedQuery.trim().toLowerCase();
    if (!normalized && topicTokens.length === 0 && excludeTopicTokens.length === 0) {
        return {
            nameTokens: [],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false,
            topicTokens: [],
            excludeTopicTokens: []
        };
    }

    const rawTokens = normalized.split(/\s+/).filter(Boolean);
    if (rawTokens.length === 0) {
        return {
            nameTokens: [],
            tagTokens: [],
            requireTagged: false,
            excludeNameTokens: [],
            excludeTagTokens: [],
            excludeTagged: false,
            topicTokens,
            excludeTopicTokens
        };
    }

    const nameTokens: string[] = [];
    const tagTokens: string[] = [];
    const excludeNameTokens: string[] = [];
    const excludeTagTokens: string[] = [];
    const connectorCandidates: string[] = [];
    let requireTagged = false;
    let excludeTagged = false;

    rawTokens.forEach(token => {
        // Handle negated tokens (exclusions) - these filter OUT matching notes
        if (token.startsWith('!')) {
            const negatedToken = token.slice(1);

            // !#tag or !# for tag exclusions
            if (negatedToken.startsWith('#')) {
                const tagToken = negatedToken.slice(1);
                if (tagToken) {
                    // Exclude notes with tags containing this text
                    excludeTagTokens.push(tagToken);
                } else {
                    // Exclude all notes with any tags (show untagged only)
                    excludeTagged = true;
                }
                return;
            }

            // !word for name exclusions - exclude notes with this word in the name
            if (negatedToken.length > 0) {
                excludeNameTokens.push(negatedToken);
                return;
            }

            return;
        }

        // Handle tag inclusions - these filter IN matching notes
        if (token.startsWith('#')) {
            const tagToken = token.slice(1);
            if (tagToken) {
                // Include only notes with tags containing this text
                tagTokens.push(tagToken);
                requireTagged = true;
            } else {
                // Include only notes that have at least one tag
                requireTagged = true;
            }
            return;
        }

        if (CONNECTOR_WORDS.has(token)) {
            connectorCandidates.push(token);
            return;
        }

        nameTokens.push(token);
    });

    if (nameTokens.length === 0 && tagTokens.length === 0 && connectorCandidates.length > 0) {
        nameTokens.push(...connectorCandidates);
    }

    return {
        nameTokens,
        tagTokens,
        requireTagged,
        excludeNameTokens,
        excludeTagTokens,
        excludeTagged,
        topicTokens,
        excludeTopicTokens
    };
}

/**
 * Check if a file matches parsed filter search tokens.
 *
 * Filtering logic:
 * - All inclusion tokens (name, tag) are ANDed - file must match ALL
 * - All exclusion tokens (!name, !#tag) are also ANDed - file must match NONE
 * - Tag requirements (# or !#) control whether tagged/untagged notes are shown
 *
 * @param lowercaseName - File display name in lowercase
 * @param lowercaseTags - File tags in lowercase
 * @param tokens - Parsed query tokens with include/exclude criteria
 * @returns True when the file passes all filter criteria
 */
export function fileMatchesFilterTokens(lowercaseName: string, lowercaseTags: string[], tokens: FilterSearchTokens): boolean {
    if (tokens.nameTokens.length > 0) {
        const matchesName = tokens.nameTokens.every(token => lowercaseName.includes(token));
        if (!matchesName) {
            return false;
        }
    }

    if (tokens.requireTagged || tokens.tagTokens.length > 0) {
        if (lowercaseTags.length === 0) {
            return false;
        }
        if (tokens.tagTokens.length > 0) {
            const matchesTags = tokens.tagTokens.every(token => lowercaseTags.some(tag => tag.includes(token)));
            if (!matchesTags) {
                return false;
            }
        }
    }

    // Check exclusion criteria - fail if any excluded pattern matches
    if (tokens.excludeNameTokens.length > 0) {
        const hasExcludedName = tokens.excludeNameTokens.some(token => lowercaseName.includes(token));
        if (hasExcludedName) {
            return false;
        }
    }

    // Exclude tagged notes if !# was specified (show untagged only)
    if (tokens.excludeTagged) {
        if (lowercaseTags.length > 0) {
            return false;
        }
    } else if (tokens.excludeTagTokens.length > 0 && lowercaseTags.length > 0) {
        // Exclude notes with specific tags matching !#tag patterns
        const hasExcludedTag = tokens.excludeTagTokens.some(token => lowercaseTags.some(tag => tag.includes(token)));
        if (hasExcludedTag) {
            return false;
        }
    }

    return true;
}
