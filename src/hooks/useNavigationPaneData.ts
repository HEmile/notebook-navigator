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
 * useNavigationPaneData - Manages navigation tree data for the NavigationPane component
 *
 * This hook handles:
 * - Building folder tree from vault structure
 * - Building tag tree with virtual folders
 * - Combining and ordering navigation items
 * - Computing folder and tag counts
 * - Creating efficient lookup maps
 * - Listening to vault changes
 * - Managing tag expansion state
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { TFile, TFolder, debounce } from 'obsidian';
import type { MetadataCache } from 'obsidian';
import { useServices, useMetadataService, useTopicService } from '../context/ServicesContext';
import { useRecentData } from '../context/RecentDataContext';
import { useExpansionState } from '../context/ExpansionContext';
import { useFileCache } from '../context/StorageContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { strings } from '../i18n';
import {
    UNTAGGED_TAG_ID,
    NavigationPaneItemType,
    VirtualFolder,
    ItemType,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    RECENT_NOTES_VIRTUAL_FOLDER_ID,
    NavigationSectionId
} from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { TagTreeNode, TopicNode } from '../types/storage';
import type { CombinedNavigationItem } from '../types/virtualization';
import type { NotebookNavigatorSettings, TagSortOrder } from '../settings/types';
import { isFolderInExcludedFolder } from '../utils/fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY, isImageFile } from '../utils/fileTypeUtils';
// Use Obsidian's trailing debounce for vault-driven updates
import { getTotalNoteCount, excludeFromTagTree, findTagNode } from '../utils/tagTree';
import { getTotalNoteCount as getTopicTotalNoteCount } from '../utils/topicGraph';
import { flattenFolderTree, flattenTagTree, compareTagOrderWithFallback, flattenTopicTree } from '../utils/treeFlattener';
import { createHiddenTagVisibility } from '../utils/tagPrefixMatcher';
import { setNavigationIndex } from '../utils/navigationIndex';
import { resolveCanonicalTagPath } from '../utils/tagUtils';
import { isFolderShortcut, isNoteShortcut, isSearchShortcut, isTagShortcut, isTopicShortcut } from '../types/shortcuts';
import { useRootFolderOrder } from './useRootFolderOrder';
import { useRootTagOrder } from './useRootTagOrder';
import type { FolderNoteDetectionSettings } from '../utils/folderNotes';
import { getDBInstance } from '../storage/fileOperations';
import { naturalCompare } from '../utils/sortUtils';
import type { NoteCountInfo } from '../types/noteCounts';
import { calculateFolderNoteCounts } from '../utils/noteCountUtils';
import { sanitizeNavigationSectionOrder } from '../utils/navigationSections';

// Checks if a navigation item is a shortcut-related item (virtual folder, shortcut, or header)
const isShortcutNavigationItem = (item: CombinedNavigationItem): boolean => {
    if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER) {
        return item.data.id === SHORTCUTS_VIRTUAL_FOLDER_ID;
    }

    return (
        item.type === NavigationPaneItemType.SHORTCUT_FOLDER ||
        item.type === NavigationPaneItemType.SHORTCUT_NOTE ||
        item.type === NavigationPaneItemType.SHORTCUT_SEARCH ||
        item.type === NavigationPaneItemType.SHORTCUT_TAG ||
        item.type === NavigationPaneItemType.SHORTCUT_TOPIC ||
        item.type === NavigationPaneItemType.SHORTCUT_HEADER
    );
};

// Maps non-markdown document extensions to their icon names
const DOCUMENT_EXTENSION_ICONS: Record<string, string> = {
    canvas: 'lucide-layout-grid',
    base: 'lucide-database'
};

const EXCALIDRAW_FILE_SUFFIX = '.excalidraw.md';

// Returns the appropriate icon for a document based on its type and extension
const getDocumentIcon = (file: TFile | null, metadataCache?: MetadataCache): string | undefined => {
    if (!file) {
        return undefined;
    }

    if (isImageFile(file)) {
        return 'lucide-image';
    }

    const lowerCaseName = file.name.toLowerCase();
    if (lowerCaseName.endsWith(EXCALIDRAW_FILE_SUFFIX)) {
        return 'lucide-image';
    }

    if (metadataCache) {
        const frontmatter = metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.['excalidraw-plugin']) {
            return 'lucide-image';
        }
    }

    const extension = file.extension.toLowerCase();
    return DOCUMENT_EXTENSION_ICONS[extension] ?? undefined;
};

/** Comparator function type for sorting tag tree nodes */
type TagComparator = (a: TagTreeNode, b: TagTreeNode) => number;

/** Compares tags alphabetically by name with fallback to path */
const compareTagAlphabetically: TagComparator = (a, b) => {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return a.path.localeCompare(b.path);
};

// Creates comparator for tag sorting modes. Returns undefined for default alphabetical ascending order.
const createTagComparator = (order: TagSortOrder, includeDescendantNotes: boolean): TagComparator | undefined => {
    if (order === 'alpha-asc') {
        return undefined;
    }

    if (order === 'alpha-desc') {
        return (a, b) => -compareTagAlphabetically(a, b);
    }

    /** Gets note count for a tag based on descendant inclusion setting */
    const getCount = includeDescendantNotes
        ? (node: TagTreeNode) => getTotalNoteCount(node)
        : (node: TagTreeNode) => node.notesWithTag.size;

    /** Compares tags by frequency (note count) with alphabetical fallback */
    const compareByFrequency: TagComparator = (a, b) => {
        const diff = getCount(a) - getCount(b);
        if (diff !== 0) {
            return diff;
        }
        return compareTagAlphabetically(a, b);
    };

    if (order === 'frequency-asc') {
        return compareByFrequency;
    }

    return (a, b) => -compareByFrequency(a, b);
};

/** Comparator function type for sorting topic nodes */
type TopicComparator = (a: TopicNode, b: TopicNode) => number;

/** Compares topics alphabetically by name */
const compareTopicAlphabetically: TopicComparator = (a, b) => {
    return naturalCompare(a.name, b.name);
};

// Creates comparator for topic sorting modes. Returns undefined for default alphabetical ascending order.
const createTopicComparator = (order: TagSortOrder, includeDescendantNotes: boolean): TopicComparator | undefined => {
    if (order === 'alpha-asc') {
        return undefined;
    }

    if (order === 'alpha-desc') {
        return (a, b) => -compareTopicAlphabetically(a, b);
    }

    /** Gets note count for a topic based on descendant inclusion setting */
    const getCount = includeDescendantNotes
        ? (node: TopicNode) => getTopicTotalNoteCount(node)
        : (node: TopicNode) => node.notesWithTag.size;

    /** Compares topics by frequency (note count) with alphabetical fallback */
    const compareByFrequency: TopicComparator = (a, b) => {
        const diff = getCount(a) - getCount(b);
        if (diff !== 0) {
            return diff;
        }
        return compareTopicAlphabetically(a, b);
    };

    if (order === 'frequency-asc') {
        return compareByFrequency;
    }

    return (a, b) => -compareByFrequency(a, b);
};

/**
 * Parameters for the useNavigationPaneData hook
 */
interface UseNavigationPaneDataParams {
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Whether the navigation pane is currently visible */
    isVisible: boolean;
    /** Whether the shortcuts virtual folder is expanded */
    shortcutsExpanded: boolean;
    /** Whether the recent notes virtual folder is expanded */
    recentNotesExpanded: boolean;
    /** Whether shortcuts should be pinned at the top of the pane */
    pinShortcuts: boolean;
    /** Preferred ordering of navigation sections */
    sectionOrder: NavigationSectionId[];
}

/**
 * Return value of the useNavigationPaneData hook
 */
interface UseNavigationPaneDataResult {
    /** Combined list of navigation items (folders and tags) */
    items: CombinedNavigationItem[];
    /** Shortcuts rendered separately when pinShortcuts is enabled */
    shortcutItems: CombinedNavigationItem[];
    /** Whether the tags virtual folder has visible children */
    tagsVirtualFolderHasChildren: boolean;
    /** Map from item keys to index in items array */
    pathToIndex: Map<string, number>;
    /** Map from shortcut id to index */
    shortcutIndex: Map<string, number>;
    /** Map from tag path to current/descendant note counts */
    tagCounts: Map<string, NoteCountInfo>;
    /** Map from topic name to current/descendant note counts */
    topicCounts: Map<string, NoteCountInfo>;
    /** Map from folder path to current/descendant note counts */
    folderCounts: Map<string, NoteCountInfo>;
    /** Ordered list of root-level folders */
    rootLevelFolders: TFolder[];
    /** Paths from settings that are not currently present in the vault */
    missingRootFolderPaths: string[];
    /** Final ordered keys used for rendering root-level tags in navigation */
    resolvedRootTagKeys: string[];
    /** Combined tag tree used for ordering (includes hidden roots) */
    rootOrderingTagTree: Map<string, TagTreeNode>;
    /** Map from tag path to custom order index */
    rootTagOrderMap: Map<string, number>;
    /** Paths for tags in custom order that are not currently present */
    missingRootTagPaths: string[];
    /** Version marker that bumps when vault files or metadata change */
    vaultChangeVersion: number;
}

/**
 * Hook that manages navigation tree data for the NavigationPane component.
 * Handles folder and tag tree building, counts, and vault change monitoring.
 *
 * @param params - Configuration parameters
 * @returns Navigation items and lookup maps
 */
export function useNavigationPaneData({
    settings,
    isVisible,
    shortcutsExpanded,
    recentNotesExpanded,
    pinShortcuts,
    sectionOrder
}: UseNavigationPaneDataParams): UseNavigationPaneDataResult {
    const { app } = useServices();
    const { recentNotes } = useRecentData();
    const metadataService = useMetadataService();
    const topicService = useTopicService();
    const expansionState = useExpansionState();
    const { fileData } = useFileCache();
    const { hydratedShortcuts } = useShortcuts();

    // Version counter that increments when vault files change
    const [fileChangeVersion, setFileChangeVersion] = useState(0);
    // Increments version counter to trigger dependent recalculations
    const handleRootFileChange = useCallback(() => {
        setFileChangeVersion(value => value + 1);
    }, []);

    /** Create topic comparator based on current sort order and descendant note settings */
    const topicComparator = useMemo(
        () => createTopicComparator(settings.topicSortOrder, settings.includeDescendantNotes),
        [settings.topicSortOrder, settings.includeDescendantNotes]
    );

    // Get topic graph - cache it separately so changes to the graph trigger re-renders
    const topicGraph = topicService.getTopicGraph();

     /**
     * Build topic items with a single topic graph
     */
     const topicItems = useMemo(() => {
        if (!settings.showTopics) {
            return [] as CombinedNavigationItem[];
        }

        const items: CombinedNavigationItem[] = [];

        const addVirtualFolder = (id: string, name: string, icon?: string) => {
            const folder: VirtualFolder = { id, name, icon };
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: folder,
                level: 0,
                key: id
            });
        };
        // Get root nodes from the topic graph
        let rootNodes = Array.from(topicGraph.values());
        
        // Filter out hidden topics unless showHiddenItems is enabled
        if (!settings.showHiddenItems && settings.hiddenTopics && settings.hiddenTopics.length > 0) {
            const hiddenTopicsSet = new Set(settings.hiddenTopics);
            rootNodes = rootNodes.filter(node => !hiddenTopicsSet.has(node.name));
        }
        
        const folderId = 'topics-root';
        addVirtualFolder(folderId, strings.tagList.topics, 'lucide-tags');

        if (expansionState.expandedVirtualFolders.has(folderId)) {
            const topicEntries = flattenTopicTree(rootNodes, expansionState.expandedTopics, 1, {
                comparator: topicComparator
            });
            items.push(...topicEntries);
        }

        return items;
    }, [
        settings.showTopics,
        settings.showHiddenItems,
        settings.hiddenTopics,
        topicGraph,
        expansionState.expandedTopics,
        expansionState.expandedVirtualFolders,
        topicComparator
    ]);

    // Get ordered root folders and notify on file changes
    const { rootFolders, rootLevelFolders, rootFolderOrderMap, missingRootFolderPaths } = useRootFolderOrder({
        settings,
        onFileChange: handleRootFileChange
    });

    /**
     * Build folder items from vault structure
     */
    const folderItems = useMemo(() => {
        return flattenFolderTree(rootFolders, expansionState.expandedFolders, settings.excludedFolders, 0, new Set(), {
            rootOrderMap: rootFolderOrderMap
        });
    }, [rootFolders, expansionState.expandedFolders, settings.excludedFolders, rootFolderOrderMap]);


    // Extract tag tree data from file cache
    const tagTree = useMemo(() => fileData.tagTree ?? new Map<string, TagTreeNode>(), [fileData.tagTree]);
    const untaggedCount = fileData.untagged;

    // Create matcher for hidden tag patterns (supports "archive", "temp*", "*draft")
    const hiddenTagVisibility = useMemo(
        () => createHiddenTagVisibility(settings.hiddenTags, settings.showHiddenItems),
        [settings.hiddenTags, settings.showHiddenItems]
    );
    const hiddenTagMatcher = hiddenTagVisibility.matcher;
    const hiddenMatcherHasRules = hiddenTagVisibility.hasHiddenRules;

    /** Create tag comparator based on current sort order and descendant note settings */
    const tagComparator = useMemo(
        () => createTagComparator(settings.tagSortOrder, settings.includeDescendantNotes),
        [settings.tagSortOrder, settings.includeDescendantNotes]
    );

    // Retrieves hidden root tag nodes when tags are visible but hidden items are not shown
    const hiddenRootTagNodes = useMemo(() => {
        if (!settings.showTags || settings.showHiddenItems) {
            return new Map<string, TagTreeNode>();
        }
        return fileData.hiddenRootTags ?? new Map<string, TagTreeNode>();
    }, [fileData.hiddenRootTags, settings.showHiddenItems, settings.showTags]);

    // Combines visible and hidden tag trees for root tag ordering calculations
    const tagTreeForOrdering = useMemo(() => {
        if (hiddenRootTagNodes.size === 0) {
            return tagTree;
        }
        const combined = new Map<string, TagTreeNode>(tagTree);
        hiddenRootTagNodes.forEach((node, path) => {
            if (!combined.has(path)) {
                combined.set(path, node);
            }
        });
        return combined;
    }, [hiddenRootTagNodes, tagTree]);

    // Manages custom ordering for root-level tags
    const { rootTagOrderMap, missingRootTagPaths } = useRootTagOrder({
        settings,
        tagTree: tagTreeForOrdering,
        comparator: tagComparator ?? compareTagAlphabetically
    });
        
    /**
     * Build tag items with a single tag tree
     */
    const { tagItems, hasTagContent, resolvedRootTagKeys } = useMemo(() => {
        if (!settings.showTags) {
            return { tagItems: [] as CombinedNavigationItem[], hasTagContent: false, resolvedRootTagKeys: [] };
        }

        const items: CombinedNavigationItem[] = [];

        const shouldHideTags = !settings.showHiddenItems;
        const hasHiddenPatterns = hiddenMatcherHasRules;
        const visibleTagTree = hasHiddenPatterns && shouldHideTags ? excludeFromTagTree(tagTree, hiddenTagMatcher) : tagTree;
        const shouldIncludeUntagged = settings.showUntagged && untaggedCount > 0;
        const matcherForMarking = !shouldHideTags && hasHiddenPatterns ? hiddenTagMatcher : undefined;

        // Adds the untagged node to the items list at the specified level
        const pushUntaggedNode = (level: number) => {
            if (!shouldIncludeUntagged) {
                return;
            }
            const untaggedNode: TagTreeNode = {
                path: UNTAGGED_TAG_ID,
                displayPath: UNTAGGED_TAG_ID,
                name: strings.tagList.untaggedLabel,
                children: new Map(),
                notesWithTag: new Set()
            };

            items.push({
                type: NavigationPaneItemType.UNTAGGED,
                data: untaggedNode,
                key: UNTAGGED_TAG_ID,
                level
            });
        };

        const addVirtualFolder = (id: string, name: string, icon?: string) => {
            const folder: VirtualFolder = { id, name, icon };
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: folder,
                level: 0,
                key: id
            });
        };

        if (!visibleTagTree) {
            if (!shouldIncludeUntagged) {
                return { tagItems: items, hasTagContent: false, resolvedRootTagKeys: [] };
            }

            if (settings.showAllTagsFolder) {
                const folderId = 'tags-root';
                addVirtualFolder(folderId, strings.tagList.tags, 'lucide-tags');

                if (expansionState.expandedVirtualFolders.has(folderId)) {
                    pushUntaggedNode(1);
                }

                return { tagItems: items, hasTagContent: true, resolvedRootTagKeys: [UNTAGGED_TAG_ID] };
            }

            pushUntaggedNode(0);
            return { tagItems: items, hasTagContent: true, resolvedRootTagKeys: [UNTAGGED_TAG_ID] };
        }

        // Extract root nodes and determine effective comparator based on custom ordering
        const visibleRootNodes = Array.from(visibleTagTree.values());
        const baseComparator = tagComparator ?? compareTagAlphabetically;
        const effectiveComparator: TagComparator =
            rootTagOrderMap.size > 0 ? (a, b) => compareTagOrderWithFallback(a, b, rootTagOrderMap, baseComparator) : baseComparator;
        const sortedRootNodes = visibleRootNodes.length > 0 ? visibleRootNodes.slice().sort(effectiveComparator) : visibleRootNodes;
        const hasVisibleTags = sortedRootNodes.length > 0;
        const hasContent = hasVisibleTags || shouldIncludeUntagged;

        // Build map of all root nodes including visible and hidden ones
        const rootNodeMap = new Map<string, TagTreeNode>();
        sortedRootNodes.forEach(node => {
            rootNodeMap.set(node.path, node);
        });
        hiddenRootTagNodes.forEach((node, path) => {
            rootNodeMap.set(path, node);
        });

        // Determine default ordering and allowed keys for final tag list
        const defaultKeyOrder = sortedRootNodes.map(node => node.path);
        const allowedKeys = new Set(defaultKeyOrder);
        if (shouldIncludeUntagged) {
            allowedKeys.add(UNTAGGED_TAG_ID);
        }
        hiddenRootTagNodes.forEach((_, path) => {
            allowedKeys.add(path);
            if (!defaultKeyOrder.includes(path)) {
                defaultKeyOrder.push(path);
            }
        });

        // Build final ordered list of root tag keys, respecting custom order first
        const resolvedRootTagKeys: string[] = [];
        settings.rootTagOrder.forEach(entry => {
            if (!allowedKeys.has(entry)) {
                return;
            }
            if (resolvedRootTagKeys.includes(entry)) {
                return;
            }
            resolvedRootTagKeys.push(entry);
        });

        // Add remaining keys not in custom order
        defaultKeyOrder.forEach(key => {
            if (!resolvedRootTagKeys.includes(key)) {
                resolvedRootTagKeys.push(key);
            }
        });

        // Ensure untagged is included if enabled
        if (shouldIncludeUntagged && !resolvedRootTagKeys.includes(UNTAGGED_TAG_ID)) {
            resolvedRootTagKeys.push(UNTAGGED_TAG_ID);
        }

        // Helper function to flatten and append a tag node with its children
        const appendTagNode = (node: TagTreeNode, level: number) => {
            const tagEntries = flattenTagTree([node], expansionState.expandedTags, level, {
                hiddenMatcher: matcherForMarking,
                comparator: effectiveComparator
            });
            items.push(...tagEntries);
        };

        if (settings.showAllTagsFolder) {
            if (hasContent) {
                const folderId = 'tags-root';
                addVirtualFolder(folderId, strings.tagList.tags, 'lucide-tags');

                if (expansionState.expandedVirtualFolders.has(folderId)) {
                    resolvedRootTagKeys.forEach(key => {
                        if (hiddenRootTagNodes.has(key) && !settings.showHiddenItems) {
                            return;
                        }
                        if (key === UNTAGGED_TAG_ID) {
                            pushUntaggedNode(1);
                            return;
                        }
                        const node = rootNodeMap.get(key);
                        if (!node) {
                            return;
                        }
                        appendTagNode(node, 1);
                    });
                }
            }
        } else {
            resolvedRootTagKeys.forEach(key => {
                if (hiddenRootTagNodes.has(key) && !settings.showHiddenItems) {
                    return;
                }
                if (key === UNTAGGED_TAG_ID) {
                    pushUntaggedNode(0);
                    return;
                }
                const node = rootNodeMap.get(key);
                if (!node) {
                    return;
                }
                appendTagNode(node, 0);
            });
        }

        return { tagItems: items, hasTagContent: hasContent, resolvedRootTagKeys };
    }, [
        settings.showTags,
        settings.showAllTagsFolder,
        settings.showHiddenItems,
        settings.showUntagged,
        hiddenTagMatcher,
        hiddenMatcherHasRules,
        tagTree,
        untaggedCount,
        settings.rootTagOrder,
        expansionState.expandedTags,
        expansionState.expandedVirtualFolders,
        tagComparator,
        rootTagOrderMap,
        hiddenRootTagNodes
    ]);

    /**
     * Pre-compute parsed excluded folders to avoid repeated parsing
     */
    const parsedExcludedFolders = useMemo(() => settings.excludedFolders, [settings.excludedFolders]);

    // Build list of shortcut items with proper hierarchy
    const shortcutItems = useMemo(() => {
        if (!settings.showShortcuts) {
            return [] as CombinedNavigationItem[];
        }

        const headerLevel = 0;
        const itemLevel = headerLevel + 1;

        // Start with the shortcuts header/virtual folder
        const items: CombinedNavigationItem[] = [
            {
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                key: SHORTCUTS_VIRTUAL_FOLDER_ID,
                level: headerLevel,
                data: {
                    id: SHORTCUTS_VIRTUAL_FOLDER_ID,
                    name: strings.navigationPane.shortcutsHeader,
                    icon: 'lucide-bookmark'
                }
            }
        ];

        // Return only header if shortcuts folder is collapsed
        if (!shortcutsExpanded) {
            return items;
        }

        // Add individual shortcut items based on their type
        hydratedShortcuts.forEach(entry => {
            const { key, shortcut, folder, note, search, tagPath, topicName } = entry;

            // Handle folder shortcuts
            if (isFolderShortcut(shortcut)) {
                if (!folder) {
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_FOLDER,
                        key,
                        level: itemLevel,
                        shortcut,
                        folder: null,
                        isMissing: true,
                        missingLabel: shortcut.path
                    });
                    return;
                }

                const isExcluded = settings.excludedFolders.length > 0 && isFolderInExcludedFolder(folder, settings.excludedFolders);
                if (isExcluded && !settings.showHiddenItems) {
                    return;
                }

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_FOLDER,
                    key,
                    level: itemLevel,
                    shortcut,
                    folder,
                    isExcluded
                });
                return;
            }

            // Handle note shortcuts
            if (isNoteShortcut(shortcut)) {
                if (!note) {
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_NOTE,
                        key,
                        level: itemLevel,
                        shortcut,
                        note: null,
                        isMissing: true,
                        missingLabel: shortcut.path
                    });
                    return;
                }
                const isExternalFile = !shouldDisplayFile(note, FILE_VISIBILITY.SUPPORTED, app);
                const icon = isExternalFile ? 'lucide-external-link' : getDocumentIcon(note, app.metadataCache);
                items.push({
                    type: NavigationPaneItemType.SHORTCUT_NOTE,
                    key,
                    level: itemLevel,
                    shortcut,
                    note,
                    icon
                });
                return;
            }

            // Handle search shortcuts
            if (isSearchShortcut(shortcut)) {
                items.push({
                    type: NavigationPaneItemType.SHORTCUT_SEARCH,
                    key,
                    level: itemLevel,
                    shortcut,
                    searchShortcut: search ?? shortcut
                });
                return;
            }

            // Handle tag shortcuts
            if (isTagShortcut(shortcut)) {
                const resolvedPath = tagPath ?? shortcut.tagPath;
                if (!resolvedPath) {
                    return;
                }

                const canonicalPath = resolveCanonicalTagPath(resolvedPath, tagTree);
                if (!canonicalPath) {
                    return;
                }

                const tagNode = findTagNode(tagTree, canonicalPath);
                const displayPath = tagNode?.displayPath ?? resolvedPath;
                const isMissing = !tagNode;

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_TAG,
                    key,
                    level: itemLevel,
                    shortcut,
                    tagPath: canonicalPath,
                    displayName: displayPath,
                    isMissing,
                    missingLabel: isMissing ? resolvedPath : undefined
                });
                return;
            }

            // Handle topic shortcuts
            if (isTopicShortcut(shortcut)) {
                const name = topicName ?? shortcut.topicName;
                if (!name) {
                    
                    return;
                }

                const topicNode = topicService?.findTopicNodeByName(name);
                const displayName = topicNode?.name ?? name;
                const isMissing = !topicNode;

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_TOPIC,
                    key,
                    level: itemLevel,
                    shortcut,
                    topicName: name,
                    displayName,
                    isMissing,
                    missingLabel: isMissing ? name : undefined
                });
            }
        });

        return items;
    }, [app, hydratedShortcuts, tagTree, topicService, settings.excludedFolders, settings.showHiddenItems, settings.showShortcuts, shortcutsExpanded]);

    // Build list of recent notes items with proper hierarchy
    const recentNotesItems = useMemo(() => {
        if (!settings.showRecentNotes) {
            return [] as CombinedNavigationItem[];
        }

        const headerLevel = 0;
        const itemLevel = headerLevel + 1;

        // Use appropriate header based on file visibility setting
        const recentHeaderName =
            settings.fileVisibility === FILE_VISIBILITY.DOCUMENTS
                ? strings.navigationPane.recentNotesHeader
                : strings.navigationPane.recentFilesHeader;

        // Start with the recent notes header/virtual folder
        const items: CombinedNavigationItem[] = [
            {
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                key: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                level: headerLevel,
                data: {
                    id: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                    name: recentHeaderName,
                    icon: 'lucide-history'
                }
            }
        ];

        // Return only header if recent notes folder is collapsed
        if (!recentNotesExpanded) {
            return items;
        }

        // Add recent note items up to the configured limit
        const limit = Math.max(1, settings.recentNotesCount ?? 1);
        const recentPaths = recentNotes.slice(0, limit);

        recentPaths.forEach(path => {
            const file = app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                const isExternalFile = !shouldDisplayFile(file, FILE_VISIBILITY.SUPPORTED, app);
                const icon = isExternalFile ? 'lucide-external-link' : getDocumentIcon(file, app.metadataCache);
                items.push({
                    type: NavigationPaneItemType.RECENT_NOTE,
                    key: `recent-${path}`,
                    level: itemLevel,
                    note: file,
                    icon
                });
            }
        });

        return items;
    }, [app, settings.showRecentNotes, recentNotes, settings.recentNotesCount, settings.fileVisibility, recentNotesExpanded]);

    // Sanitize section order from local storage and ensure defaults are present
    const normalizedSectionOrder = useMemo(() => sanitizeNavigationSectionOrder(sectionOrder), [sectionOrder]);

    /**
     * Combine shortcut, folder, and tag items based on display order settings
     */
    // Combine all navigation items in the correct order with spacers
    const items = useMemo(() => {
        const allItems: CombinedNavigationItem[] = [];

        // Path to the banner file configured in settings
        const bannerPath = settings.navigationBanner;
        // Banner appears in main list when not pinning shortcuts or when shortcuts list is empty
        const shouldIncludeBannerInMainList = Boolean(bannerPath && (!pinShortcuts || shortcutItems.length === 0));

        if (shouldIncludeBannerInMainList && bannerPath) {
            allItems.push({
                type: NavigationPaneItemType.TOP_SPACER,
                key: 'banner-top-spacer'
            });
            allItems.push({
                type: NavigationPaneItemType.BANNER,
                key: `banner-${bannerPath}`,
                path: bannerPath
            });
        }

        // Add top spacer for visual separation between pinned content and tree items
        allItems.push({
            type: NavigationPaneItemType.TOP_SPACER,
            key: 'top-spacer'
        });
        
        // TODO: Include topics section
        // Determines which sections should be displayed based on settings and available items
        const shouldIncludeShortcutsSection = settings.showShortcuts && shortcutItems.length > 0;
        const shouldIncludeRecentSection = settings.showRecentNotes && recentNotesItems.length > 0;
        const shouldIncludeNotesSection = folderItems.length > 0;
        const shouldIncludeTagsSection = settings.showTags && tagItems.length > 0;
        const shouldIncludeTopicsSection = settings.showTopics && topicItems.length > 0;

        // Builds sections in the user-specified order
        const orderedSections: CombinedNavigationItem[][] = [];

        // Adds sections to the display based on user-specified order and visibility conditions
        normalizedSectionOrder.forEach(identifier => {
            switch (identifier) {
                case NavigationSectionId.SHORTCUTS:
                    if (shouldIncludeShortcutsSection) {
                        orderedSections.push(shortcutItems);
                    }
                    break;
                case NavigationSectionId.RECENT:
                    if (shouldIncludeRecentSection) {
                        orderedSections.push(recentNotesItems);
                    }
                    break;
                case NavigationSectionId.NOTES:
                    if (shouldIncludeNotesSection) {
                        orderedSections.push(folderItems);
                    }
                    break;
                case NavigationSectionId.TAGS:
                    if (shouldIncludeTagsSection) {
                        orderedSections.push(tagItems);
                    }
                    break;
                case NavigationSectionId.TOPICS:
                    if (shouldIncludeTopicsSection) {
                        orderedSections.push(topicItems);
                    }
                    break;
                default:
                    break;
            }
        });

        // Filters out empty sections that have no items to display
        const visibleSections = orderedSections.filter(section => section.length > 0);

        // Assembles final item list with spacers between sections
        visibleSections.forEach((section, index) => {
            allItems.push(...section);
            if (index < visibleSections.length - 1) {
                allItems.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: `section-spacer-${index}`
                });
            }
        });

        allItems.push({
            type: NavigationPaneItemType.BOTTOM_SPACER,
            key: 'bottom-spacer'
        });

        return allItems;
    }, [
        folderItems,
        tagItems,
        topicItems,
        shortcutItems,
        recentNotesItems,
        normalizedSectionOrder,
        settings.showShortcuts,
        settings.showRecentNotes,
        settings.showTags,
        settings.showTopics,
        settings.navigationBanner,
        pinShortcuts
    ]);

    /**
     * Create a stable version key for metadata objects that gets updated when they're mutated
     * This is needed because the settings objects are mutated in place when colors/icons change
     * We depend on the entire settings object to ensure this recalculates when settings update
     */
    // Track frontmatter metadata changes separately since they're stored in IndexedDB
    const [frontmatterMetadataVersion, setFrontmatterMetadataVersion] = useState(0);

    // Subscribe to IndexedDB content changes to detect frontmatter metadata updates
    useEffect(() => {
        const db = getDBInstance();
        const unsubscribe = db.onContentChange(changes => {
            const hasMetadataChange = changes.some(change => change.changeType === 'metadata' || change.changeType === 'both');
            if (hasMetadataChange) {
                setFrontmatterMetadataVersion(version => version + 1);
            }
        });
        return unsubscribe;
    }, []);

    const metadataVersion = useMemo(() => {
        // Create a version string that will change when any metadata is added/removed/changed
        // We use JSON.stringify to detect any changes in the objects
        const settingsSignature = JSON.stringify({
            folderColors: settings.folderColors || {},
            folderBackgroundColors: settings.folderBackgroundColors || {},
            tagColors: settings.tagColors || {},
            tagBackgroundColors: settings.tagBackgroundColors || {},
            folderIcons: settings.folderIcons || {},
            tagIcons: settings.tagIcons || {},
            fileIcons: settings.fileIcons || {},
            fileColors: settings.fileColors || {},
            inheritFolderColors: settings.inheritFolderColors
        });
        return `${settingsSignature}::${frontmatterMetadataVersion}`;
    }, [settings, frontmatterMetadataVersion]); // Depend on entire settings object to catch mutations

    /**
     * Add metadata (colors, icons) and excluded folders to items
     * This pre-computation avoids calling these functions during render
     */
    const itemsWithMetadata = useMemo(() => {
        return items.map(item => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                return {
                    ...item,
                    color: metadataService.getFolderColor(item.data.path),
                    backgroundColor: metadataService.getFolderBackgroundColor(item.data.path),
                    icon: metadataService.getFolderIcon(item.data.path),
                    parsedExcludedFolders
                };
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                return {
                    ...item,
                    color: metadataService.getTagColor(tagNode.path),
                    backgroundColor: metadataService.getTagBackgroundColor(tagNode.path),
                    icon: metadataService.getTagIcon(tagNode.path)
                };
            } else if (item.type === NavigationPaneItemType.TOPIC) {
                const topicNode = item.data;
                return {
                    ...item,
                    color: metadataService.getTagColor(topicNode.name),
                    backgroundColor: metadataService.getTagBackgroundColor(topicNode.name),
                    icon: metadataService.getTagIcon(topicNode.name)
                };
            } else if (item.type === NavigationPaneItemType.SHORTCUT_FOLDER) {
                // Apply custom folder icon to shortcut if available
                const folderPath = item.folder?.path;
                const folderColor = folderPath ? metadataService.getFolderColor(folderPath) : undefined;
                const customIcon = folderPath ? metadataService.getFolderIcon(folderPath) : undefined;
                const defaultIcon = folderPath === '/' ? 'vault' : 'lucide-folder';
                return {
                    ...item,
                    icon: customIcon || defaultIcon,
                    color: folderColor
                };
            } else if (item.type === NavigationPaneItemType.SHORTCUT_TAG) {
                // Apply custom tag icon to shortcut if available
                const tagColor = metadataService.getTagColor(item.tagPath);
                return {
                    ...item,
                    icon: metadataService.getTagIcon(item.tagPath) || 'lucide-tags',
                    color: tagColor
                };
            } else if (item.type === NavigationPaneItemType.SHORTCUT_TOPIC) {
                // Apply custom topic icon to shortcut if available
                const topicName = item.topicName;
                const topicColor = metadataService.getTagColor(topicName);
                return {
                    ...item,
                    icon: metadataService.getTagIcon(topicName) || 'lucide-trending-up',
                    color: topicColor
                };
            } else if (item.type === NavigationPaneItemType.SHORTCUT_NOTE) {
                const note = item.note;
                if (!note) {
                    return item;
                }
                const customIcon = metadataService.getFileIcon(note.path);
                const color = metadataService.getFileColor(note.path);
                return {
                    ...item,
                    icon: customIcon ?? item.icon,
                    color
                };
            } else if (item.type === NavigationPaneItemType.RECENT_NOTE) {
                const customIcon = metadataService.getFileIcon(item.note.path);
                const color = metadataService.getFileColor(item.note.path);
                return {
                    ...item,
                    icon: customIcon ?? item.icon,
                    color
                };
            }
            return item;
        });
        // NOTE TO REVIEWER: Including **metadataVersion** to detect settings mutations
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, parsedExcludedFolders, metadataService, metadataVersion]);

    // Extract shortcut items when pinning is enabled for display in pinned area
    const shortcutItemsWithMetadata = useMemo(() => {
        if (!pinShortcuts) {
            return [] as CombinedNavigationItem[];
        }

        return itemsWithMetadata.filter(isShortcutNavigationItem);
    }, [itemsWithMetadata, pinShortcuts]);

    /**
     * Filter items based on showHiddenItems setting
     * When showHiddenItems is false, filter out folders marked as excluded
     */
    const filteredItems = useMemo(() => {
        // When pinning shortcuts, exclude them from main tree (they're rendered separately)
        const baseItems = pinShortcuts ? itemsWithMetadata.filter(current => !isShortcutNavigationItem(current)) : itemsWithMetadata;

        if (settings.showHiddenItems) {
            // Show all items including excluded ones
            return baseItems;
        }

        return baseItems.filter(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.isExcluded) {
                return false;
            }
            return true;
        });
    }, [itemsWithMetadata, settings.showHiddenItems, pinShortcuts]);

    /**
     * Create a map for O(1) item lookups by path
     * Build from filtered items so indices match what's displayed
     */
    const pathToIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        filteredItems.forEach((item, index) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                setNavigationIndex(indexMap, ItemType.FOLDER, item.data.path, index);
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                setNavigationIndex(indexMap, ItemType.TAG, tagNode.path, index);
            } else if (item.type === NavigationPaneItemType.TOPIC) {
                const topicPath = item.path ?? item.data.name; // Use the full path for this topic instance
                setNavigationIndex(indexMap, ItemType.TOPIC, topicPath, index);
            }
        });

        return indexMap;
    }, [filteredItems]);

    // Build index map for shortcuts to enable scrolling to specific shortcuts
    const shortcutIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        const source = pinShortcuts ? shortcutItemsWithMetadata : filteredItems;

        source.forEach((item, index) => {
            if (
                item.type === NavigationPaneItemType.SHORTCUT_FOLDER ||
                item.type === NavigationPaneItemType.SHORTCUT_NOTE ||
                item.type === NavigationPaneItemType.SHORTCUT_SEARCH ||
                item.type === NavigationPaneItemType.SHORTCUT_TAG ||
                item.type === NavigationPaneItemType.SHORTCUT_TOPIC
            ) {
                indexMap.set(item.key, index);
            }
        });

        return indexMap;
    }, [filteredItems, pinShortcuts, shortcutItemsWithMetadata]);

    /**
     * Pre-compute tag counts to avoid expensive calculations during render
     */
    const tagCounts = useMemo(() => {
        const counts = new Map<string, NoteCountInfo>();

        // Skip computation if pane is not visible or not showing tags
        if (!isVisible || !settings.showTags) return counts;

        // Add untagged count
        if (settings.showUntagged) {
            counts.set(UNTAGGED_TAG_ID, {
                current: untaggedCount,
                descendants: 0,
                total: untaggedCount
            });
        }

        // Compute counts for all tag items
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.TAG) {
                const tagNode = item.data;
                const current = tagNode.notesWithTag.size;
                if (settings.includeDescendantNotes) {
                    const total = getTotalNoteCount(tagNode);
                    const descendants = Math.max(total - current, 0);
                    counts.set(tagNode.path, { current, descendants, total });
                } else {
                    counts.set(tagNode.path, {
                        current,
                        descendants: 0,
                        total: current
                    });
                }
            }
        });

        return counts;
    }, [itemsWithMetadata, settings.showTags, settings.showUntagged, settings.includeDescendantNotes, untaggedCount, isVisible]);

    /**
     * Pre-compute tag counts to avoid expensive calculations during render
     */
    const topicCounts = useMemo(() => {
        const counts = new Map<string, NoteCountInfo>();

        // Skip computation if pane is not visible or not showing tags
        if (!isVisible || !settings.showTopics) return counts;

        // Compute counts for all tag items
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.TOPIC) {
                const topicNode = item.data;
                const current = topicNode.notesWithTag.size;
                if (settings.includeDescendantNotes) {
                    const total = getTotalNoteCount(topicNode);
                    const descendants = Math.max(total - current, 0);
                    counts.set(topicNode.name, { current, descendants, total });
                } else {
                    counts.set(topicNode.name, {
                        current,
                        descendants: 0,
                        total: current
                    });
                }
            }
        });

        return counts;
    }, [itemsWithMetadata, settings.showTopics, settings.includeDescendantNotes, isVisible]);

    /**
     * Pre-compute folder file counts to avoid recursive counting during render
     */
    const folderCounts = useMemo(() => {
        const counts = new Map<string, NoteCountInfo>();

        // Skip computation if pane is not visible or not showing note counts
        if (!isVisible || !settings.showNoteCount) {
            return counts;
        }

        const excludedProperties = settings.excludedFiles;
        const excludedFolderPatterns = settings.excludedFolders;
        const folderNoteSettings: FolderNoteDetectionSettings = {
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName
        };
        const includeDescendants = settings.includeDescendantNotes;
        const showHiddenFolders = settings.showHiddenItems;
        const countOptions = {
            app,
            fileVisibility: settings.fileVisibility,
            excludedFiles: excludedProperties,
            excludedFolders: excludedFolderPatterns,
            includeDescendants,
            showHiddenFolders,
            hideFolderNoteInList: settings.hideFolderNoteInList,
            folderNoteSettings,
            cache: counts
        };

        // Compute counts for all folder items
        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.data instanceof TFolder) {
                calculateFolderNoteCounts(item.data, countOptions);
            }
        });

        return counts;
        // NOTE TO REVIEWER: Including **fileChangeVersion** to trigger recalculation when non-markdown files move
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        itemsWithMetadata,
        settings.showNoteCount,
        settings.includeDescendantNotes,
        settings.excludedFiles,
        settings.excludedFolders,
        settings.showHiddenItems,
        settings.fileVisibility,
        settings.enableFolderNotes,
        settings.folderNoteName,
        settings.hideFolderNoteInList,
        app,
        isVisible,
        fileChangeVersion
    ]);

    // Refresh folder counts when frontmatter changes (e.g., hide/unhide via frontmatter properties)
    useEffect(() => {
        const bumpCounts = debounce(
            () => {
                setFileChangeVersion(v => v + 1);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );

        const metaRef = app.metadataCache.on('changed', file => {
            if (file instanceof TFile) {
                bumpCounts();
            }
        });

        return () => {
            app.metadataCache.offref(metaRef);
            bumpCounts.cancel();
        };
    }, [app]);

    return {
        items: filteredItems,
        shortcutItems: shortcutItemsWithMetadata,
        tagsVirtualFolderHasChildren: hasTagContent,
        pathToIndex,
        shortcutIndex,
        tagCounts,
        topicCounts,
        folderCounts,
        rootLevelFolders,
        missingRootFolderPaths,
        resolvedRootTagKeys,
        rootOrderingTagTree: tagTreeForOrdering,
        rootTagOrderMap,
        missingRootTagPaths,
        vaultChangeVersion: fileChangeVersion
    };
}
