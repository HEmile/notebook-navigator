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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../../types';
import type { SearchNavFilterState } from '../../types/search';
import { foldSearchText } from '../../utils/recordUtils';
import { buildPropertyKeyNodeId, buildPropertyValueNodeId, parsePropertyNodeId } from '../../utils/propertyTree';

const EMPTY_TAG_TOKENS: string[] = [];
const MAX_FOLDED_SEARCH_CACHE_ENTRIES = 2048;

const buildNormalizedSearchTokenSet = (
    tokens: readonly string[] | null | undefined,
    normalizeToken: (token: string) => string
): Set<string> | null => {
    if (!tokens || tokens.length === 0) {
        return null;
    }

    const normalizedTokens = new Set<string>();
    tokens.forEach(token => {
        const normalizedToken = normalizeToken(token);
        if (!normalizedToken) {
            return;
        }
        normalizedTokens.add(normalizedToken);
    });

    return normalizedTokens.size > 0 ? normalizedTokens : null;
};

const setBoundedFoldedSearchCacheEntry = (cache: Map<string, string>, key: string, value: string): void => {
    if (!cache.has(key) && cache.size >= MAX_FOLDED_SEARCH_CACHE_ENTRIES) {
        for (const oldestKey of cache.keys()) {
            cache.delete(oldestKey);
            break;
        }
    }

    cache.set(key, value);
};

const normalizePropertyNodeIdForSearchMatch = (propertyNodeId: string): string => {
    const parsed = parsePropertyNodeId(propertyNodeId);
    if (!parsed) {
        return foldSearchText(propertyNodeId);
    }

    const foldedKey = foldSearchText(parsed.key);
    if (!parsed.valuePath) {
        return buildPropertyKeyNodeId(foldedKey);
    }

    return buildPropertyValueNodeId(foldedKey, foldSearchText(parsed.valuePath));
};

export interface NavigationSearchHighlightsResult {
    getTagSearchMatch: (tagPath: string) => 'include' | 'exclude' | undefined;
    getPropertySearchMatch: (propertyNodeId: string) => 'include' | 'exclude' | undefined;
    getTagCollectionSearchMatch: (tagCollectionId: string | null) => 'include' | 'exclude' | undefined;
}

interface UseNavigationSearchHighlightsProps {
    searchNavFilters?: SearchNavFilterState;
}

export function useNavigationSearchHighlights({ searchNavFilters }: UseNavigationSearchHighlightsProps): NavigationSearchHighlightsResult {
    const searchIncludeTokens = useMemo(() => {
        const includeTokens = searchNavFilters?.tags.include;
        if (!includeTokens || includeTokens.length === 0) {
            return EMPTY_TAG_TOKENS;
        }
        return includeTokens;
    }, [searchNavFilters]);

    const searchExcludeTokens = useMemo(() => {
        const excludeTokens = searchNavFilters?.tags.exclude;
        if (!excludeTokens || excludeTokens.length === 0) {
            return EMPTY_TAG_TOKENS;
        }
        return excludeTokens;
    }, [searchNavFilters]);

    const highlightRequireTagged = searchNavFilters?.tags.requireTagged ?? false;
    const highlightExcludeTagged = searchNavFilters?.tags.excludeTagged ?? false;
    const highlightIncludeUntagged = searchNavFilters?.tags.includeUntagged ?? false;

    const searchIncludeTokenSet = useMemo(() => {
        return buildNormalizedSearchTokenSet(searchIncludeTokens, foldSearchText);
    }, [searchIncludeTokens]);

    const searchExcludeTokenSet = useMemo(() => {
        return buildNormalizedSearchTokenSet(searchExcludeTokens, foldSearchText);
    }, [searchExcludeTokens]);

    const propertyIncludeTokenSet = useMemo(() => {
        return buildNormalizedSearchTokenSet(searchNavFilters?.properties.include, normalizePropertyNodeIdForSearchMatch);
    }, [searchNavFilters]);

    const propertyExcludeTokenSet = useMemo(() => {
        return buildNormalizedSearchTokenSet(searchNavFilters?.properties.exclude, normalizePropertyNodeIdForSearchMatch);
    }, [searchNavFilters]);

    const foldedTagPathCacheRef = useRef<Map<string, string>>(new Map());
    const foldedPropertyNodeIdCacheRef = useRef<Map<string, string>>(new Map());

    const getFoldedTagPath = useCallback((tagPath: string): string => {
        const cached = foldedTagPathCacheRef.current.get(tagPath);
        if (cached !== undefined) {
            return cached;
        }

        const normalizedTagPath = foldSearchText(tagPath);
        setBoundedFoldedSearchCacheEntry(foldedTagPathCacheRef.current, tagPath, normalizedTagPath);
        return normalizedTagPath;
    }, []);

    const getFoldedPropertyNodeId = useCallback((propertyNodeId: string): string => {
        const cached = foldedPropertyNodeIdCacheRef.current.get(propertyNodeId);
        if (cached !== undefined) {
            return cached;
        }

        const normalizedPropertyNodeId = normalizePropertyNodeIdForSearchMatch(propertyNodeId);
        setBoundedFoldedSearchCacheEntry(foldedPropertyNodeIdCacheRef.current, propertyNodeId, normalizedPropertyNodeId);
        return normalizedPropertyNodeId;
    }, []);

    useEffect(() => {
        foldedTagPathCacheRef.current.clear();
    }, [searchIncludeTokenSet, searchExcludeTokenSet]);

    useEffect(() => {
        foldedPropertyNodeIdCacheRef.current.clear();
    }, [propertyIncludeTokenSet, propertyExcludeTokenSet]);

    const getTagSearchMatch = useCallback(
        (tagPath: string): 'include' | 'exclude' | undefined => {
            if (tagPath === UNTAGGED_TAG_ID) {
                if (highlightIncludeUntagged) {
                    return 'include';
                }
                if (highlightExcludeTagged) {
                    return 'exclude';
                }
                return undefined;
            }

            if (!searchIncludeTokenSet && !searchExcludeTokenSet) {
                return undefined;
            }

            const normalizedTagPath = getFoldedTagPath(tagPath);
            if (searchExcludeTokenSet?.has(normalizedTagPath)) {
                return 'exclude';
            }
            if (searchIncludeTokenSet?.has(normalizedTagPath)) {
                return 'include';
            }

            return undefined;
        },
        [getFoldedTagPath, highlightExcludeTagged, highlightIncludeUntagged, searchExcludeTokenSet, searchIncludeTokenSet]
    );

    const getTagCollectionSearchMatch = useCallback(
        (tagCollectionId: string | null): 'include' | 'exclude' | undefined => {
            if (tagCollectionId !== TAGGED_TAG_ID) {
                return undefined;
            }

            if (highlightExcludeTagged) {
                return 'exclude';
            }
            if (highlightRequireTagged) {
                return 'include';
            }

            return undefined;
        },
        [highlightExcludeTagged, highlightRequireTagged]
    );

    const getPropertySearchMatch = useCallback(
        (propertyNodeId: string): 'include' | 'exclude' | undefined => {
            if (propertyNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
                return undefined;
            }

            if (!propertyIncludeTokenSet && !propertyExcludeTokenSet) {
                return undefined;
            }

            const normalizedPropertyNodeId = getFoldedPropertyNodeId(propertyNodeId);
            if (propertyExcludeTokenSet?.has(normalizedPropertyNodeId)) {
                return 'exclude';
            }
            if (propertyIncludeTokenSet?.has(normalizedPropertyNodeId)) {
                return 'include';
            }

            return undefined;
        },
        [getFoldedPropertyNodeId, propertyExcludeTokenSet, propertyIncludeTokenSet]
    );

    return {
        getTagSearchMatch,
        getPropertySearchMatch,
        getTagCollectionSearchMatch
    };
}
