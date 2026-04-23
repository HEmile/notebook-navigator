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

import { useEffect, useRef, useState } from 'react';
import { TFile, TFolder } from 'obsidian';
import type { App } from 'obsidian';
import type { NotebookNavigatorSettings, SortOption } from '../../settings';
import type { FilterSearchMatchOptions, FilterSearchTokens } from '../../utils/filterSearch';
import {
    fileMatchesDateFilterTokens,
    fileMatchesFilterTokens,
    filterSearchHasActiveCriteria,
    filterSearchNeedsPropertyLookup,
    filterSearchNeedsTagLookup,
    filterSearchRequiresTagsForEveryMatch,
    parseFilterSearchTokens
} from '../../utils/filterSearch';
import { resolveDefaultDateField } from '../../utils/sortUtils';
import { PreviewTextUtils } from '../../utils/previewTextUtils';
import { getCachedFileTags } from '../../utils/tagUtils';
import { createOmnisearchHighlightQueryTokenContext, sanitizeOmnisearchHighlightTokens } from '../../utils/omnisearchHighlight';
import { foldSearchText } from '../../utils/recordUtils';
import { normalizePropertyTreeValuePath } from '../../utils/propertyTree';
import {
    createFrontmatterPropertyExclusionMatcher,
    createHiddenFileNameMatcher,
    isFolderInExcludedFolder,
    shouldExcludeFileWithMatcher
} from '../../utils/fileFilters';
import { createHiddenTagVisibility, normalizeTagPathValue } from '../../utils/tagPrefixMatcher';
import { runAsyncAction } from '../../utils/async';
import type { SearchResultMeta } from '../../types/search';
import type { OmnisearchService } from '../../services/OmnisearchService';
import type { IndexedDBStorage, FileData } from '../../storage/IndexedDBStorage';
import type { TopicService } from '../../services/TopicGraphService';
import { findTopicNode, collectTopicFilePaths } from '../../utils/topicGraph';

const EMPTY_FILTER_SEARCH_PROPERTIES = new Map<string, string[]>();
const TAG_PRESENCE_SENTINEL = ['__nn_tag_present__'];
const EMPTY_HIDDEN_STATE = new Map<string, boolean>();

export interface OmnisearchListResult {
    query: string;
    files: TFile[];
    meta: Map<string, SearchResultMeta>;
}

interface UseOmnisearchListResultArgs {
    basePathSet: ReadonlySet<string>;
    omnisearchPathScope?: string;
    omnisearchService: OmnisearchService | null;
    trimmedQuery: string;
    useOmnisearch: boolean;
}

interface UseSearchableNamesArgs {
    app: App;
    baseFiles: TFile[];
    getFileDisplayName: (file: TFile) => string;
}

interface FilterListPaneFilesArgs {
    app: App;
    baseFiles: TFile[];
    getDB: () => IndexedDBStorage;
    getFileTimestamps: (file: TFile) => { created: number; modified: number };
    omnisearchResult: OmnisearchListResult | null;
    searchTokens?: FilterSearchTokens;
    searchableNames: ReadonlyMap<string, string>;
    settings: NotebookNavigatorSettings;
    sortOption: SortOption;
    trimmedQuery: string;
    useOmnisearch: boolean;
    topicService?: TopicService | null;
}

interface BuildHiddenFileStateArgs {
    app: App;
    files: TFile[];
    getDB: () => IndexedDBStorage;
    hiddenFileNames: string[];
    hiddenFilePropertyMatcher: ReturnType<typeof createFrontmatterPropertyExclusionMatcher>;
    hiddenFileTags: string[];
    hiddenFolders: string[];
    showHiddenItems: boolean;
}

function normalizeTagsForFilterSearch(rawTags: readonly string[]): string[] {
    return rawTags.map(tag => foldSearchText(normalizeTagPathValue(tag))).filter((value): value is string => value.length > 0);
}

function normalizePropertiesForFilterSearch(properties: FileData['properties'] | null): Map<string, string[]> {
    if (!properties || properties.length === 0) {
        return EMPTY_FILTER_SEARCH_PROPERTIES;
    }

    const normalizedValues = new Map<string, Set<string>>();
    properties.forEach(entry => {
        const normalizedKey = foldSearchText(entry.fieldKey.trim());
        if (!normalizedKey) {
            return;
        }

        let values = normalizedValues.get(normalizedKey);
        if (!values) {
            values = new Set<string>();
            normalizedValues.set(normalizedKey, values);
        }

        const normalizedValue = normalizePropertyTreeValuePath(entry.value);
        if (!normalizedValue) {
            return;
        }

        values.add(foldSearchText(normalizedValue));
    });

    const normalized = new Map<string, string[]>();
    normalizedValues.forEach((values, key) => {
        normalized.set(key, Array.from(values));
    });

    return normalized;
}

export function useOmnisearchListResult({
    basePathSet,
    omnisearchPathScope,
    omnisearchService,
    trimmedQuery,
    useOmnisearch
}: UseOmnisearchListResultArgs): OmnisearchListResult | null {
    const [omnisearchResult, setOmnisearchResult] = useState<OmnisearchListResult | null>(null);
    const searchTokenRef = useRef(0);

    useEffect(() => {
        if (!useOmnisearch) {
            setOmnisearchResult(null);
        }
    }, [useOmnisearch]);

    useEffect(() => {
        if (!useOmnisearch) {
            return;
        }
        if (!omnisearchService) {
            setOmnisearchResult(null);
            return;
        }

        const token = ++searchTokenRef.current;
        let disposed = false;

        runAsyncAction(async () => {
            try {
                const hits = await omnisearchService.search(trimmedQuery, {
                    pathScope: omnisearchPathScope
                });
                if (disposed || searchTokenRef.current !== token) {
                    return;
                }

                const meta = new Map<string, SearchResultMeta>();
                const files: TFile[] = [];
                const queryTokenContext = createOmnisearchHighlightQueryTokenContext(trimmedQuery);

                hits.forEach(hit => {
                    if (!basePathSet.has(hit.path)) {
                        return;
                    }

                    files.push(hit.file);
                    const { matches, terms } = sanitizeOmnisearchHighlightTokens(hit.matches, hit.foundWords, queryTokenContext);
                    const excerpt =
                        typeof hit.excerpt === 'string' ? PreviewTextUtils.normalizeExcerpt(hit.excerpt, { stripHtml: false }) : undefined;

                    meta.set(hit.path, {
                        score: hit.score,
                        terms,
                        matches,
                        excerpt
                    });
                });

                setOmnisearchResult({ query: trimmedQuery, files, meta });
            } catch {
                if (searchTokenRef.current === token) {
                    setOmnisearchResult({ query: trimmedQuery, files: [], meta: new Map() });
                }
            }
        });

        return () => {
            disposed = true;
        };
    }, [basePathSet, omnisearchPathScope, omnisearchService, trimmedQuery, useOmnisearch]);

    return omnisearchResult;
}

export function useSearchableNames({ app, baseFiles, getFileDisplayName }: UseSearchableNamesArgs): ReadonlyMap<string, string> {
    const [searchableNames, setSearchableNames] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const next = new Map<string, string>();
        baseFiles.forEach(file => {
            next.set(file.path, foldSearchText(getFileDisplayName(file)));
        });
        setSearchableNames(next);
    }, [baseFiles, getFileDisplayName]);

    useEffect(() => {
        const basePaths = new Set(baseFiles.map(file => file.path));
        const offref = app.metadataCache.on('changed', changedFile => {
            if (!changedFile || !basePaths.has(changedFile.path)) {
                return;
            }

            const nextName = foldSearchText(getFileDisplayName(changedFile));
            setSearchableNames(previous => {
                if (previous.get(changedFile.path) === nextName) {
                    return previous;
                }

                const next = new Map(previous);
                next.set(changedFile.path, nextName);
                return next;
            });
        });

        return () => {
            app.metadataCache.offref(offref);
        };
    }, [app.metadataCache, baseFiles, getFileDisplayName]);

    return searchableNames;
}

export function filterListPaneFiles({
    app,
    baseFiles,
    getDB,
    getFileTimestamps,
    omnisearchResult,
    searchTokens,
    searchableNames,
    settings,
    sortOption,
    trimmedQuery,
    useOmnisearch,
    topicService
}: FilterListPaneFilesArgs): TFile[] {
    if (!trimmedQuery) {
        return baseFiles;
    }

    const tokens = searchTokens ?? parseFilterSearchTokens(trimmedQuery);

    // Build topic path sets for include/exclude filtering
    let topicIncludePaths: Set<string> | null = null;
    let topicExcludePaths: Set<string> | null = null;
    if (tokens.topicTokens.length > 0 || tokens.excludeTopicTokens.length > 0) {
        const topicGraph = topicService?.getTopicGraph();
        if (topicGraph) {
            if (tokens.topicTokens.length > 0) {
                topicIncludePaths = new Set<string>();
                for (const topicName of tokens.topicTokens) {
                    const node = findTopicNode(topicGraph, topicName);
                    if (node) collectTopicFilePaths(node).forEach(p => topicIncludePaths!.add(p));
                }
            }
            if (tokens.excludeTopicTokens.length > 0) {
                topicExcludePaths = new Set<string>();
                for (const topicName of tokens.excludeTopicTokens) {
                    const node = findTopicNode(topicGraph, topicName);
                    if (node) collectTopicFilePaths(node).forEach(p => topicExcludePaths!.add(p));
                }
            }
        }
    }

    if (useOmnisearch) {
        if (!omnisearchResult || omnisearchResult.query !== trimmedQuery) {
            return [];
        }

        const omnisearchPaths = new Set(omnisearchResult.files.map(file => file.path));
        if (omnisearchPaths.size === 0) {
            return [];
        }

        return baseFiles.filter(file => {
            if (!omnisearchPaths.has(file.path)) return false;
            if (topicIncludePaths && !topicIncludePaths.has(file.path)) return false;
            if (topicExcludePaths && topicExcludePaths.has(file.path)) return false;
            return true;
        });
    }
    if (!filterSearchHasActiveCriteria(tokens)) {
        return baseFiles;
    }

    const hasDateFilters = tokens.dateRanges.length > 0 || tokens.excludeDateRanges.length > 0;
    const hasTaskFilters = tokens.requireUnfinishedTasks || tokens.excludeUnfinishedTasks;
    const hasFolderFilters = tokens.folderTokens.length > 0 || tokens.excludeFolderTokens.length > 0;
    const hasExtensionFilters = tokens.extensionTokens.length > 0 || tokens.excludeExtensionTokens.length > 0;
    const defaultDateField = resolveDefaultDateField(sortOption, settings.alphabeticalDateMode ?? 'modified');
    const needsTagLookup = filterSearchNeedsTagLookup(tokens);
    const needsPropertyLookup = filterSearchNeedsPropertyLookup(tokens);
    const requireTaggedMatches = filterSearchRequiresTagsForEveryMatch(tokens);
    const requiresNormalizedTagValues = tokens.mode === 'tag' || tokens.tagTokens.length > 0 || tokens.excludeTagTokens.length > 0;
    const db = getDB();
    const emptyTags: string[] = [];

    return baseFiles.filter(file => {
        if (topicIncludePaths && !topicIncludePaths.has(file.path)) return false;
        if (topicExcludePaths && topicExcludePaths.has(file.path)) return false;

        const foldedName = searchableNames.get(file.path) ?? '';
        const fileData = hasTaskFilters || needsTagLookup || needsPropertyLookup ? db.getFile(file.path) : null;
        const hasUnfinishedTasks = hasTaskFilters && typeof fileData?.taskUnfinished === 'number' && fileData.taskUnfinished > 0;
        const needsMatchOptions = hasTaskFilters || hasFolderFilters || hasExtensionFilters;
        let matchOptions: FilterSearchMatchOptions | undefined;

        if (needsMatchOptions) {
            matchOptions = { hasUnfinishedTasks };

            if (hasFolderFilters) {
                matchOptions.foldedFolderPath = foldSearchText(file.parent?.path ?? '');
            }

            if (hasExtensionFilters) {
                matchOptions.foldedExtension = foldSearchText(file.extension);
            }
        }

        if (needsPropertyLookup) {
            const propertyValuesByKey = normalizePropertiesForFilterSearch(fileData?.properties ?? null);
            if (matchOptions) {
                matchOptions = { ...matchOptions, propertyValuesByKey };
            } else {
                matchOptions = { hasUnfinishedTasks, propertyValuesByKey };
            }
        }

        if (!needsTagLookup) {
            if (!fileMatchesFilterTokens(foldedName, emptyTags, tokens, matchOptions)) {
                return false;
            }

            if (!hasDateFilters) {
                return true;
            }

            const timestamps = getFileTimestamps(file);
            return fileMatchesDateFilterTokens(
                { created: timestamps.created, modified: timestamps.modified, defaultField: defaultDateField },
                tokens
            );
        }

        const rawTags = getCachedFileTags({ app, file, db, fileData });
        const hasTags = rawTags.length > 0;
        if (requireTaggedMatches && !hasTags) {
            return false;
        }

        let foldedTags: string[];
        if (!hasTags) {
            foldedTags = emptyTags;
        } else if (requiresNormalizedTagValues) {
            foldedTags = normalizeTagsForFilterSearch(rawTags);
        } else {
            foldedTags = TAG_PRESENCE_SENTINEL;
        }

        if (!fileMatchesFilterTokens(foldedName, foldedTags, tokens, matchOptions)) {
            return false;
        }

        if (!hasDateFilters) {
            return true;
        }

        const timestamps = getFileTimestamps(file);
        return fileMatchesDateFilterTokens(
            { created: timestamps.created, modified: timestamps.modified, defaultField: defaultDateField },
            tokens
        );
    });
}

export function buildHiddenFileState({
    app,
    files,
    getDB,
    hiddenFileNames,
    hiddenFilePropertyMatcher,
    hiddenFileTags,
    hiddenFolders,
    showHiddenItems
}: BuildHiddenFileStateArgs): ReadonlyMap<string, boolean> {
    if (!showHiddenItems || files.length === 0) {
        return EMPTY_HIDDEN_STATE;
    }

    const db = getDB();
    const records = db.getFiles(files.map(file => file.path));
    const shouldCheckFolders = hiddenFolders.length > 0;
    const shouldCheckFrontmatter = hiddenFilePropertyMatcher.hasCriteria;
    const shouldCheckFileNames = hiddenFileNames.length > 0;
    const shouldCheckFileTags = hiddenFileTags.length > 0;
    const fileNameMatcher = shouldCheckFileNames ? createHiddenFileNameMatcher(hiddenFileNames) : null;
    const hiddenFileTagVisibility = shouldCheckFileTags ? createHiddenTagVisibility(hiddenFileTags, false) : null;
    const folderHiddenCache = shouldCheckFolders ? new Map<string, boolean>() : null;
    const result = new Map<string, boolean>();

    const resolveFolderHidden = (folder: TFolder | null): boolean => {
        if (!folderHiddenCache || !folder) {
            return false;
        }
        if (folderHiddenCache.has(folder.path)) {
            return folderHiddenCache.get(folder.path) ?? false;
        }

        const hidden = isFolderInExcludedFolder(folder, hiddenFolders);
        folderHiddenCache.set(folder.path, hidden);
        return hidden;
    };

    files.forEach(file => {
        const record = records.get(file.path);
        let hiddenByFrontmatter = false;
        if (shouldCheckFrontmatter && file.extension === 'md') {
            hiddenByFrontmatter =
                record?.metadata?.hidden === undefined
                    ? shouldExcludeFileWithMatcher(file, hiddenFilePropertyMatcher, app)
                    : Boolean(record.metadata?.hidden);
        }

        const hiddenByFileName = fileNameMatcher ? fileNameMatcher.matches(file) : false;
        const hiddenByFolder = shouldCheckFolders ? resolveFolderHidden(file.parent ?? null) : false;
        const hiddenByTags =
            hiddenFileTagVisibility !== null &&
            hiddenFileTagVisibility.hasHiddenRules &&
            file.extension === 'md' &&
            getCachedFileTags({ app, file, db, fileData: record ?? null }).some(
                tagValue => !hiddenFileTagVisibility.isTagVisible(tagValue)
            );

        if (hiddenByFrontmatter || hiddenByFileName || hiddenByFolder || hiddenByTags) {
            result.set(file.path, true);
        }
    });

    return result;
}
