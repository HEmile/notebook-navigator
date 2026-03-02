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

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { TFile, TFolder, debounce } from 'obsidian';
import type { App } from 'obsidian';
import { useServices, useMetadataService } from '../context/ServicesContext';
import { useRecentData } from '../context/RecentDataContext';
import { useExpansionState } from '../context/ExpansionContext';
import { useFileCache } from '../context/StorageContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { strings } from '../i18n';
import {
    TAGGED_TAG_ID,
    TAGS_ROOT_VIRTUAL_FOLDER_ID,
    UNTAGGED_TAG_ID,
    PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
    NavigationPaneItemType,
    VirtualFolder,
    ItemType,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    RECENT_NOTES_VIRTUAL_FOLDER_ID,
    NavigationSectionId
} from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { PropertyTreeNode, TagTreeNode } from '../types/storage';
import type { CombinedNavigationItem } from '../types/virtualization';
import type { NotebookNavigatorSettings, TagSortOrder } from '../settings/types';
import {
    createFrontmatterPropertyExclusionMatcher,
    createHiddenFileNameMatcherForVisibility,
    isFolderInExcludedFolder,
    shouldExcludeFileWithMatcher,
    shouldExcludeFileName
} from '../utils/fileFilters';
import { shouldDisplayFile, FILE_VISIBILITY } from '../utils/fileTypeUtils';
import { resolveFileIconId, type FileNameIconNeedle } from '../utils/fileIconUtils';
// Use Obsidian's trailing debounce for vault-driven updates
import { getTotalNoteCount, excludeFromTagTree, findTagNode } from '../utils/tagTree';
import { flattenFolderTree, flattenTagTree, comparePropertyOrderWithFallback, compareTagOrderWithFallback } from '../utils/treeFlattener';
import { createHiddenTagVisibility, matchesHiddenTagPattern } from '../utils/tagPrefixMatcher';
import { setNavigationIndex } from '../utils/navigationIndex';
import { resolveCanonicalTagPath } from '../utils/tagUtils';
import { getCachedFileTags } from '../utils/tagUtils';
import { isFolderShortcut, isNoteShortcut, isSearchShortcut, isTagShortcut, isPropertyShortcut } from '../types/shortcuts';
import { useRootFolderOrder, type RootFileChangeEvent } from './useRootFolderOrder';
import { useRootPropertyOrder } from './useRootPropertyOrder';
import { useRootTagOrder } from './useRootTagOrder';
import { getFolderNote, getFolderNoteDetectionSettings } from '../utils/folderNotes';
import { getDBInstance, getDBInstanceOrNull } from '../storage/fileOperations';
import { naturalCompare } from '../utils/sortUtils';
import type { NoteCountInfo } from '../types/noteCounts';
import { calculateFolderNoteCounts } from '../utils/noteCountUtils';
import { resolveFolderDisplayName } from '../utils/folderDisplayName';
import { createFileHiddenMatcher, getEffectiveFrontmatterExclusions } from '../utils/exclusionUtils';
import { sanitizeNavigationSectionOrder } from '../utils/navigationSections';
import { getVirtualTagCollection, isVirtualTagCollectionId, VIRTUAL_TAG_COLLECTION_IDS } from '../utils/virtualTagCollections';
import { casefold } from '../utils/recordUtils';
import {
    getDirectPropertyKeyNoteCount,
    getTotalPropertyNoteCount,
    normalizePropertyNodeId,
    parsePropertyNodeId,
    resolvePropertyShortcutNodeId,
    resolvePropertyTreeNode
} from '../utils/propertyTree';
import {
    buildFolderSeparatorKey,
    buildPropertySeparatorKey,
    buildSectionSeparatorKey,
    buildTagSeparatorKey,
    parseNavigationSeparatorKey
} from '../utils/navigationSeparators';
import { resolveUXIcon } from '../utils/uxIcons';
import type { MetadataService } from '../services/MetadataService';
import { useSettingsDerived, type ActiveProfileState } from '../context/SettingsContext';
import { getParentFolderPath, getPathBaseName } from '../utils/pathUtils';
import { resolveFolderNoteName } from '../utils/folderNoteName';
import { EXCALIDRAW_BASENAME_SUFFIX } from '../utils/fileNameUtils';
import { FOLDER_NOTE_TYPE_EXTENSIONS } from '../types/folderNote';

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
        item.type === NavigationPaneItemType.SHORTCUT_PROPERTY ||
        item.type === NavigationPaneItemType.SHORTCUT_HEADER
    );
};

// Checks if a navigation item is part of the recent notes section
const isRecentNavigationItem = (item: CombinedNavigationItem): boolean => {
    if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER) {
        return item.data.id === RECENT_NOTES_VIRTUAL_FOLDER_ID;
    }
    return item.type === NavigationPaneItemType.RECENT_NOTE;
};

/** Options controlling which navigation items are eligible for root spacing */
interface RootSpacingOptions {
    showRootFolder: boolean;
    tagRootLevel: number;
}

/** Determines if the navigation item is a top-level folder or tag eligible for root spacing */
const isRootSpacingCandidate = (item: CombinedNavigationItem, options: RootSpacingOptions): boolean => {
    if (item.type === NavigationPaneItemType.FOLDER) {
        const desiredLevel = options.showRootFolder ? 1 : 0;
        return item.level === desiredLevel;
    }
    if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
        return item.level === options.tagRootLevel;
    }
    return false;
};

const FOLDER_SORT_NAME_CACHE_MAX_ENTRIES = 2000;
const FOLDER_NOTE_EXTENSIONS = new Set<string>(Object.values(FOLDER_NOTE_TYPE_EXTENSIONS));

function decorateNavigationItems(
    source: CombinedNavigationItem[],
    app: App,
    settings: NotebookNavigatorSettings,
    fileNameIconNeedles: readonly FileNameIconNeedle[],
    getFileDisplayName: (file: TFile) => string,
    metadataService: MetadataService,
    parsedExcludedFolders: string[],
    metadataDecorationVersion: number
): CombinedNavigationItem[] {
    void metadataDecorationVersion;
    const shouldResolveFileNameIcons = settings.showFilenameMatchIcons;
    const fileIconSettings = {
        showFilenameMatchIcons: settings.showFilenameMatchIcons,
        fileNameIconMap: settings.fileNameIconMap,
        showCategoryIcons: true,
        fileTypeIconMap: settings.fileTypeIconMap
    };
    const fileIconFallbackMode = 'file';
    const folderDisplayDataByPath = new Map<string, ReturnType<MetadataService['getFolderDisplayData']>>();
    const getFolderDisplayData = (folderPath: string): ReturnType<MetadataService['getFolderDisplayData']> => {
        const cachedData = folderDisplayDataByPath.get(folderPath);
        if (cachedData) {
            return cachedData;
        }

        const nextData = metadataService.getFolderDisplayData(folderPath);
        folderDisplayDataByPath.set(folderPath, nextData);
        return nextData;
    };

    return source.map(item => {
        if (item.type === NavigationPaneItemType.FOLDER) {
            const folderDisplayData = getFolderDisplayData(item.data.path);
            return {
                ...item,
                displayName: folderDisplayData.displayName,
                color: folderDisplayData.color,
                backgroundColor: folderDisplayData.backgroundColor,
                icon: folderDisplayData.icon,
                parsedExcludedFolders
            };
        }
        if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
            const tagNode = item.data;
            // Resolve both color and background in one pass (including inherited values when enabled).
            const tagColorData = metadataService.getTagColorData(tagNode.path);
            return {
                ...item,
                color: tagColorData.color,
                backgroundColor: tagColorData.background,
                icon: metadataService.getTagIcon(tagNode.path)
            };
        }
        if (item.type === NavigationPaneItemType.PROPERTY_KEY || item.type === NavigationPaneItemType.PROPERTY_VALUE) {
            const propertyNode = item.data;
            const propertyNodeId = propertyNode.id;
            const propertyColorData = metadataService.getPropertyColorData(propertyNodeId);
            const icon =
                metadataService.getPropertyIcon(propertyNodeId) ||
                (propertyNode.kind === 'value' ? resolveUXIcon(settings.interfaceIcons, 'nav-property-value') : undefined);

            return {
                ...item,
                color: propertyColorData.color,
                backgroundColor: propertyColorData.background,
                icon
            };
        }
        if (item.type === NavigationPaneItemType.SHORTCUT_FOLDER) {
            const folderPath = item.folder?.path;
            const folderDisplayData = folderPath ? getFolderDisplayData(folderPath) : undefined;
            const defaultIcon = folderPath === '/' ? 'vault' : 'lucide-folder';
            return {
                ...item,
                displayName: folderDisplayData?.displayName,
                icon: folderDisplayData?.icon || defaultIcon,
                color: folderDisplayData?.color,
                backgroundColor: folderDisplayData?.backgroundColor
            };
        }
        if (item.type === NavigationPaneItemType.SHORTCUT_TAG) {
            // Resolve both color and background in one pass (including inherited values when enabled).
            const tagColorData = metadataService.getTagColorData(item.tagPath);
            return {
                ...item,
                icon: metadataService.getTagIcon(item.tagPath) || resolveUXIcon(settings.interfaceIcons, 'nav-tag'),
                color: tagColorData.color,
                backgroundColor: tagColorData.background
            };
        }
        if (item.type === NavigationPaneItemType.SHORTCUT_PROPERTY) {
            const propertyNodeId = item.propertyNodeId;
            const propertyColorData = metadataService.getPropertyColorData(propertyNodeId);
            const icon = (() => {
                if (propertyNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
                    return resolveUXIcon(settings.interfaceIcons, 'nav-properties');
                }

                const parsed = parsePropertyNodeId(propertyNodeId);
                return (
                    metadataService.getPropertyIcon(propertyNodeId) ||
                    (parsed?.valuePath
                        ? resolveUXIcon(settings.interfaceIcons, 'nav-property-value')
                        : resolveUXIcon(settings.interfaceIcons, 'nav-property'))
                );
            })();

            return {
                ...item,
                icon,
                color: propertyColorData.color,
                backgroundColor: propertyColorData.background
            };
        }
        if (item.type === NavigationPaneItemType.SHORTCUT_NOTE) {
            const note = item.note;
            if (!note) {
                return item;
            }
            const color = metadataService.getFileColor(note.path);
            const customIconId = metadataService.getFileIcon(note.path);
            const isExternalFile = !shouldDisplayFile(note, FILE_VISIBILITY.SUPPORTED, app);
            const resolvedIconId = resolveFileIconId(note, fileIconSettings, {
                customIconId,
                metadataCache: app.metadataCache,
                isExternalFile,
                fallbackMode: fileIconFallbackMode,
                fileNameNeedles: fileNameIconNeedles,
                fileNameForMatch: shouldResolveFileNameIcons ? getFileDisplayName(note) : undefined
            });
            return {
                ...item,
                icon: resolvedIconId ?? undefined,
                color
            };
        }
        if (item.type === NavigationPaneItemType.RECENT_NOTE) {
            const note = item.note;
            const customIconId = metadataService.getFileIcon(note.path);
            const color = metadataService.getFileColor(note.path);
            const isExternalFile = !shouldDisplayFile(note, FILE_VISIBILITY.SUPPORTED, app);
            const resolvedIconId = resolveFileIconId(note, fileIconSettings, {
                customIconId,
                metadataCache: app.metadataCache,
                isExternalFile,
                fallbackMode: fileIconFallbackMode,
                fileNameNeedles: fileNameIconNeedles,
                fileNameForMatch: shouldResolveFileNameIcons ? getFileDisplayName(note) : undefined
            });
            return {
                ...item,
                icon: resolvedIconId ?? undefined,
                color
            };
        }
        return item;
    });
}

/**
 * Inserts spacer items between consecutive root-level folders or tags
 * @param items Navigation items to augment with spacing
 * @param spacing Spacing value in pixels
 */
const CUSTOM_SEPARATOR_PREFIXES = ['folder:', 'tag:', 'property:'];
const isCustomSeparatorKey = (key: string): boolean => CUSTOM_SEPARATOR_PREFIXES.some(prefix => key.startsWith(prefix));
const SPACER_ITEM_TYPES = new Set<NavigationPaneItemType>([
    NavigationPaneItemType.TOP_SPACER,
    NavigationPaneItemType.LIST_SPACER,
    NavigationPaneItemType.BOTTOM_SPACER,
    NavigationPaneItemType.ROOT_SPACER
]);

const insertRootSpacing = (items: CombinedNavigationItem[], spacing: number, options: RootSpacingOptions): CombinedNavigationItem[] => {
    if (spacing <= 0) {
        return items;
    }

    const result: CombinedNavigationItem[] = [];
    let rootCountInSection = 0;
    let spacerId = 0;

    const shouldResetSection = (item: CombinedNavigationItem): boolean => {
        if (
            item.type === NavigationPaneItemType.TOP_SPACER ||
            item.type === NavigationPaneItemType.BOTTOM_SPACER ||
            item.type === NavigationPaneItemType.VIRTUAL_FOLDER
        ) {
            return true;
        }

        if (item.type === NavigationPaneItemType.LIST_SPACER) {
            return !isCustomSeparatorKey(item.key);
        }

        return false;
    };

    for (const item of items) {
        if (shouldResetSection(item)) {
            rootCountInSection = 0;
            result.push(item);
            continue;
        }

        if (isRootSpacingCandidate(item, options)) {
            if (rootCountInSection > 0) {
                result.push({
                    type: NavigationPaneItemType.ROOT_SPACER,
                    key: `root-spacer-${spacerId++}`,
                    spacing
                });
            }
            rootCountInSection += 1;
            result.push(item);
            continue;
        }

        result.push(item);
    }

    return result;
};

/** Comparator function type for sorting tag tree nodes */
type TagComparator = (a: TagTreeNode, b: TagTreeNode) => number;
type PropertyNodeComparator = (a: PropertyTreeNode, b: PropertyTreeNode) => number;
type NavigationComparator<T> = (a: T, b: T) => number;

function reverseComparator<T>(comparator: NavigationComparator<T>): NavigationComparator<T> {
    return (a, b) => -comparator(a, b);
}

function createFrequencyComparator<T>(params: {
    order: TagSortOrder;
    compareAlphabetically: NavigationComparator<T>;
    getFrequency: (node: T) => number;
}): NavigationComparator<T> | undefined {
    const { order, compareAlphabetically, getFrequency } = params;

    if (order === 'alpha-asc') {
        return undefined;
    }

    if (order === 'alpha-desc') {
        return reverseComparator(compareAlphabetically);
    }

    const compareByFrequency: NavigationComparator<T> = (a, b) => {
        const diff = getFrequency(a) - getFrequency(b);
        if (diff !== 0) {
            return diff;
        }
        return compareAlphabetically(a, b);
    };

    if (order === 'frequency-asc') {
        return compareByFrequency;
    }

    return reverseComparator(compareByFrequency);
}

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
    const getCount = includeDescendantNotes
        ? (node: TagTreeNode) => getTotalNoteCount(node)
        : (node: TagTreeNode) => node.notesWithTag.size;

    return createFrequencyComparator<TagTreeNode>({
        order,
        compareAlphabetically: compareTagAlphabetically,
        getFrequency: getCount
    });
};

/** Compares property key nodes alphabetically by display name with key fallback */
const comparePropertyKeyNodesAlphabetically: PropertyNodeComparator = (a, b) => {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return a.key.localeCompare(b.key);
};

/** Compares property value nodes alphabetically by display name with value-path fallback */
const comparePropertyValueNodesAlphabetically: PropertyNodeComparator = (a, b) => {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return (a.valuePath ?? '').localeCompare(b.valuePath ?? '');
};

/** Creates a property node comparator for alpha/frequency sorting modes */
const createPropertyComparator = (params: {
    order: TagSortOrder;
    compareAlphabetically: PropertyNodeComparator;
    getFrequency: (node: PropertyTreeNode) => number;
}): PropertyNodeComparator => {
    const { order, compareAlphabetically, getFrequency } = params;
    const comparator = createFrequencyComparator<PropertyTreeNode>({
        order,
        compareAlphabetically,
        getFrequency
    });
    return comparator ?? compareAlphabetically;
};

/**
 * Parameters for the useNavigationPaneData hook
 */
interface UseNavigationPaneDataParams {
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Active profile-derived values */
    activeProfile: ActiveProfileState;
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
    /** First visible navigation section when shortcuts are inlined */
    firstSectionId: NavigationSectionId | null;
    /** First folder path rendered inline after spacers when shortcuts are pinned */
    firstInlineFolderPath: string | null;
    /** Shortcuts rendered separately when pinShortcuts is enabled */
    shortcutItems: CombinedNavigationItem[];
    /** Whether the tags virtual folder has visible children */
    tagsVirtualFolderHasChildren: boolean;
    /** Whether the properties section is available in navigation */
    propertiesSectionActive: boolean;
    /** Recent notes items rendered in the pinned area when pinning is enabled */
    pinnedRecentNotesItems: CombinedNavigationItem[];
    /** Whether recent notes are pinned with shortcuts */
    shouldPinRecentNotes: boolean;
    /** Map from item keys to index in items array */
    pathToIndex: Map<string, number>;
    /** Map from shortcut id to index */
    shortcutIndex: Map<string, number>;
    /** Map from tag path to current/descendant note counts */
    tagCounts: Map<string, NoteCountInfo>;
    /** Map from property node id to current/descendant note counts */
    propertyCounts: Map<string, NoteCountInfo>;
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
    /** Final ordered keys used for rendering root-level properties in navigation */
    resolvedRootPropertyKeys: string[];
    /** Property tree used for ordering (includes configured keys) */
    rootOrderingPropertyTree: Map<string, PropertyTreeNode>;
    /** Map from property key to custom order index */
    rootPropertyOrderMap: Map<string, number>;
    /** Keys for properties in custom order that are not currently present */
    missingRootPropertyKeys: string[];
    /** Version marker that bumps when vault files or metadata change */
    vaultChangeVersion: number;
    /** Path to the navigation banner from the active vault profile */
    navigationBannerPath: string | null;
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
    activeProfile,
    isVisible,
    shortcutsExpanded,
    recentNotesExpanded,
    pinShortcuts,
    sectionOrder
}: UseNavigationPaneDataParams): UseNavigationPaneDataResult {
    const { app } = useServices();
    const { fileNameIconNeedles } = useSettingsDerived();
    const { recentNotes } = useRecentData();
    const metadataService = useMetadataService();
    const expansionState = useExpansionState();
    const { fileData, getFileDisplayName } = useFileCache();
    const { hydratedShortcuts } = useShortcuts();
    const uxPreferences = useUXPreferences();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;
    const showHiddenItems = uxPreferences.showHiddenItems;
    // Resolves frontmatter exclusions, returns empty array when hidden items are shown
    const effectiveFrontmatterExclusions = getEffectiveFrontmatterExclusions(settings, showHiddenItems);
    const { hiddenFolders, hiddenFileProperties, hiddenFileNames, hiddenTags, hiddenFileTags, fileVisibility, navigationBanner } =
        activeProfile;
    const navigationBannerPath = navigationBanner;
    const folderCountFileNameMatcher = useMemo(() => {
        return createHiddenFileNameMatcherForVisibility(hiddenFileNames, showHiddenItems);
    }, [hiddenFileNames, showHiddenItems]);
    const folderVisibilityFileNameMatcher = useMemo(() => {
        return createHiddenFileNameMatcherForVisibility(hiddenFileNames, false);
    }, [hiddenFileNames]);
    const hiddenFilePropertyMatcher = useMemo(
        () => createFrontmatterPropertyExclusionMatcher(hiddenFileProperties),
        [hiddenFileProperties]
    );
    const folderNoteSettings = useMemo(() => {
        return getFolderNoteDetectionSettings({
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName,
            folderNoteNamePattern: settings.folderNoteNamePattern
        });
    }, [settings.enableFolderNotes, settings.folderNoteName, settings.folderNoteNamePattern]);
    const shouldEvaluateFolderNoteExclusions = useMemo(() => {
        return (
            settings.enableFolderNotes &&
            (hiddenFilePropertyMatcher.hasCriteria || folderVisibilityFileNameMatcher !== null || hiddenFileTags.length > 0)
        );
    }, [settings.enableFolderNotes, hiddenFilePropertyMatcher, hiddenFileTags, folderVisibilityFileNameMatcher]);
    const isFolderNoteRelatedPath = useCallback(
        (path: string): boolean => {
            if (!shouldEvaluateFolderNoteExclusions) {
                return false;
            }

            const parentPath = getParentFolderPath(path);
            // Root folder notes are unsupported, so root-level files are never treated as folder notes.
            if (parentPath === '/') {
                return false;
            }

            const fileName = path.split('/').pop();
            if (!fileName) {
                return false;
            }

            const dotIndex = fileName.lastIndexOf('.');
            if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
                return false;
            }

            const basename = fileName.slice(0, dotIndex);
            const extension = fileName.slice(dotIndex + 1).toLowerCase();
            const folderName = getPathBaseName(parentPath);
            const expectedName = resolveFolderNoteName(folderName, folderNoteSettings);

            if (basename === expectedName && FOLDER_NOTE_EXTENSIONS.has(extension)) {
                return true;
            }

            return extension === 'md' && basename === `${expectedName}${EXCALIDRAW_BASENAME_SUFFIX}`;
        },
        [folderNoteSettings, shouldEvaluateFolderNoteExclusions]
    );

    // Version counter that increments when vault files change
    const [fileChangeVersion, setFileChangeVersion] = useState(0);
    const [folderExclusionVersion, setFolderExclusionVersion] = useState(0);
    // Increments version counter to trigger dependent recalculations
    const handleRootFileChange = useCallback(
        (change: RootFileChangeEvent) => {
            setFileChangeVersion(value => value + 1);
            if (isFolderNoteRelatedPath(change.path) || (change.oldPath !== undefined && isFolderNoteRelatedPath(change.oldPath))) {
                setFolderExclusionVersion(value => value + 1);
            }
        },
        [isFolderNoteRelatedPath]
    );
    // Get ordered root folders and notify on file changes
    const { rootFolders, rootLevelFolders, rootFolderOrderMap, missingRootFolderPaths } = useRootFolderOrder({
        settings,
        onFileChange: handleRootFileChange
    });

    // Extract tag tree data from file cache
    const tagTree = useMemo(() => fileData.tagTree ?? new Map<string, TagTreeNode>(), [fileData.tagTree]);
    // Extract property tree data from file cache
    const propertyTree = useMemo(() => fileData.propertyTree ?? new Map<string, PropertyTreeNode>(), [fileData.propertyTree]);
    const untaggedCount = fileData.untagged;

    // Create matcher for hidden tag patterns (supports "archive", "temp*", "*draft")
    const hiddenTagVisibility = useMemo(() => createHiddenTagVisibility(hiddenTags, showHiddenItems), [hiddenTags, showHiddenItems]);
    const hiddenTagMatcher = hiddenTagVisibility.matcher;
    const hiddenMatcherHasRules = hiddenTagVisibility.hasHiddenRules;

    const visibleTagTree = useMemo(() => {
        if (!hiddenMatcherHasRules || showHiddenItems) {
            return tagTree;
        }
        return excludeFromTagTree(tagTree, hiddenTagMatcher);
    }, [tagTree, hiddenMatcherHasRules, showHiddenItems, hiddenTagMatcher]);

    const visibleTaggedCount = fileData.tagged ?? 0;

    const hasRootPropertyShortcut = useMemo(() => {
        return hydratedShortcuts.some(({ shortcut, propertyNodeId }) => {
            if (!isPropertyShortcut(shortcut)) {
                return false;
            }

            return propertyNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID || shortcut.nodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
        });
    }, [hydratedShortcuts]);

    /** Create tag comparator based on current sort order and descendant note settings */
    const tagComparator = useMemo(
        () => createTagComparator(settings.tagSortOrder, includeDescendantNotes),
        [settings.tagSortOrder, includeDescendantNotes]
    );

    // Retrieves hidden root tag nodes when tags are visible but hidden items are not shown
    const hiddenRootTagNodes = useMemo(() => {
        if (!settings.showTags || showHiddenItems) {
            return new Map<string, TagTreeNode>();
        }
        return fileData.hiddenRootTags ?? new Map<string, TagTreeNode>();
    }, [fileData.hiddenRootTags, showHiddenItems, settings.showTags]);

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

    const propertyKeyComparator = useMemo(() => {
        return createPropertyComparator({
            order: settings.propertySortOrder,
            compareAlphabetically: comparePropertyKeyNodesAlphabetically,
            getFrequency: node => (includeDescendantNotes ? node.notesWithValue.size : getDirectPropertyKeyNoteCount(node))
        });
    }, [includeDescendantNotes, settings.propertySortOrder]);

    const { rootPropertyOrderMap, missingRootPropertyKeys } = useRootPropertyOrder({
        settings,
        propertyTree,
        comparator: propertyKeyComparator
    });

    // Tracks folder display-name metadata changes for folder sorting and label refresh.
    const [folderDisplayNameVersion, setFolderDisplayNameVersion] = useState(() => metadataService.getFolderDisplayNameVersion());

    // Subscribe to folder display-name changes and batch version updates.
    useEffect(() => {
        setFolderDisplayNameVersion(metadataService.getFolderDisplayNameVersion());
        const applyFolderDisplayNameVersion = debounce(
            (version: number) => {
                setFolderDisplayNameVersion(version);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );
        const unsubscribe = metadataService.subscribeToFolderDisplayNameChanges(version => {
            applyFolderDisplayNameVersion(version);
        });

        return () => {
            unsubscribe();
            applyFolderDisplayNameVersion.cancel();
        };
    }, [metadataService]);

    // Tracks metadata content updates so note decorations refresh when frontmatter-backed names change.
    const [metadataDecorationVersion, setMetadataDecorationVersion] = useState(0);

    useEffect(() => {
        const db = getDBInstance();
        const bumpFolderExclusionVersion = debounce(
            () => {
                setFolderExclusionVersion(version => version + 1);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );
        const unsubscribe = db.onContentChange(changes => {
            let hasMetadataChange = false;
            let shouldRefreshFolderExclusions = false;
            const folderNotePathByParentPath = new Map<string, string | null>();

            for (const change of changes) {
                if (change.changeType !== 'metadata' && change.changeType !== 'both') {
                    continue;
                }

                hasMetadataChange = true;
                if (!shouldEvaluateFolderNoteExclusions || shouldRefreshFolderExclusions) {
                    continue;
                }

                const parentPath = getParentFolderPath(change.path);
                let cachedFolderNotePath = folderNotePathByParentPath.get(parentPath);
                if (cachedFolderNotePath === undefined) {
                    const parentFolder = app.vault.getFolderByPath(parentPath);
                    cachedFolderNotePath = parentFolder ? (getFolderNote(parentFolder, folderNoteSettings)?.path ?? null) : null;
                    folderNotePathByParentPath.set(parentPath, cachedFolderNotePath);
                }

                if (cachedFolderNotePath === change.path) {
                    shouldRefreshFolderExclusions = true;
                }
            }

            if (hasMetadataChange) {
                setMetadataDecorationVersion(version => version + 1);
                if (shouldRefreshFolderExclusions) {
                    bumpFolderExclusionVersion();
                }
            }
        });
        return () => {
            unsubscribe();
            bumpFolderExclusionVersion.cancel();
        };
    }, [app, folderNoteSettings, shouldEvaluateFolderNoteExclusions]);

    const visiblePropertyNavigationKeySet = useMemo(() => {
        const keys = new Set<string>();
        const seen = new Set<string>();
        const entries = activeProfile.profile.propertyKeys ?? [];
        entries.forEach(entry => {
            if (!entry.showInNavigation) {
                return;
            }

            const normalizedKey = casefold(entry.key);
            if (!normalizedKey || seen.has(normalizedKey)) {
                return;
            }

            seen.add(normalizedKey);
            keys.add(normalizedKey);
        });

        return keys;
    }, [activeProfile.profile.propertyKeys]);

    const getFolderSortName = useMemo(() => {
        void folderDisplayNameVersion;
        const folderSortNameByPath = new Map<string, string>();
        const cacheFolderSortName = (path: string, name: string): string => {
            // Keep cache size bounded during long sessions with vault churn.
            if (folderSortNameByPath.size >= FOLDER_SORT_NAME_CACHE_MAX_ENTRIES) {
                folderSortNameByPath.clear();
            }
            folderSortNameByPath.set(path, name);
            return name;
        };

        return (folder: TFolder): string => {
            const cachedName = folderSortNameByPath.get(folder.path);
            if (cachedName !== undefined) {
                return cachedName;
            }

            if (!settings.useFrontmatterMetadata) {
                return cacheFolderSortName(folder.path, folder.name);
            }

            const resolvedName = resolveFolderDisplayName({
                app,
                metadataService,
                settings: {
                    customVaultName: settings.customVaultName
                },
                folderPath: folder.path,
                fallbackName: folder.name
            });
            return cacheFolderSortName(folder.path, resolvedName);
        };
    }, [app, settings.customVaultName, settings.useFrontmatterMetadata, metadataService, folderDisplayNameVersion]);

    const folderExclusionByFolderNote = useMemo(() => {
        // Recreate the exclusion cache when vault metadata changes.
        void folderExclusionVersion;
        if (!shouldEvaluateFolderNoteExclusions) {
            return undefined;
        }

        const hiddenFileTagVisibility = createHiddenTagVisibility(hiddenFileTags, false);
        const shouldFilterHiddenFileTags = hiddenFileTagVisibility.hasHiddenRules;
        const db = shouldFilterHiddenFileTags ? getDBInstanceOrNull() : null;
        const directExclusionCache = new Map<string, boolean>();
        const inheritedExclusionCache = new Map<string, boolean>();
        const recursionGuard = new Set<string>();

        const isDirectlyExcludedByFolderNote = (folder: TFolder): boolean => {
            const cached = directExclusionCache.get(folder.path);
            if (cached !== undefined) {
                return cached;
            }

            const folderNote = getFolderNote(folder, folderNoteSettings);
            if (!folderNote) {
                directExclusionCache.set(folder.path, false);
                return false;
            }

            let isExcluded = false;
            if (hiddenFilePropertyMatcher.hasCriteria && shouldExcludeFileWithMatcher(folderNote, hiddenFilePropertyMatcher, app)) {
                isExcluded = true;
            }

            if (!isExcluded && folderVisibilityFileNameMatcher && folderVisibilityFileNameMatcher.matches(folderNote)) {
                isExcluded = true;
            }

            if (!isExcluded && shouldFilterHiddenFileTags) {
                const tags = getCachedFileTags({ app, file: folderNote, db });
                if (tags.some(tagValue => !hiddenFileTagVisibility.isTagVisible(tagValue))) {
                    isExcluded = true;
                }
            }

            directExclusionCache.set(folder.path, isExcluded);
            return isExcluded;
        };

        const isExcludedByFolderNote = (folder: TFolder): boolean => {
            if (folder.path === '/') {
                // Root folder notes are unsupported, so the vault root is never excluded by folder-note rules.
                return false;
            }

            const cached = inheritedExclusionCache.get(folder.path);
            if (cached !== undefined) {
                return cached;
            }

            if (recursionGuard.has(folder.path)) {
                return false;
            }
            recursionGuard.add(folder.path);

            let isExcluded = isDirectlyExcludedByFolderNote(folder);
            if (!isExcluded && folder.parent instanceof TFolder) {
                isExcluded = isExcludedByFolderNote(folder.parent);
            }

            recursionGuard.delete(folder.path);
            inheritedExclusionCache.set(folder.path, isExcluded);
            return isExcluded;
        };

        return (folder: TFolder): boolean => isExcludedByFolderNote(folder);
    }, [
        app,
        folderExclusionVersion,
        hiddenFilePropertyMatcher,
        hiddenFileTags,
        folderVisibilityFileNameMatcher,
        folderNoteSettings,
        shouldEvaluateFolderNoteExclusions
    ]);

    /**
     * Build folder items from vault structure
     */
    const folderItems = useMemo(() => {
        return flattenFolderTree(rootFolders, expansionState.expandedFolders, hiddenFolders, 0, new Set(), {
            rootOrderMap: rootFolderOrderMap,
            defaultSortOrder: settings.folderSortOrder,
            childSortOrderOverrides: settings.folderTreeSortOverrides,
            getFolderSortName,
            isFolderExcluded: folderExclusionByFolderNote
        });
    }, [
        rootFolders,
        expansionState.expandedFolders,
        hiddenFolders,
        rootFolderOrderMap,
        settings.folderSortOrder,
        settings.folderTreeSortOverrides,
        getFolderSortName,
        folderExclusionByFolderNote
    ]);

    /**
     * Build tag items with a single tag tree
     */
    const { tagItems, resolvedRootTagKeys, tagsVirtualFolderHasChildren } = useMemo((): {
        tagItems: CombinedNavigationItem[];
        resolvedRootTagKeys: string[];
        tagsVirtualFolderHasChildren: boolean;
    } => {
        if (!settings.showTags) {
            return {
                tagItems: [],
                resolvedRootTagKeys: [],
                tagsVirtualFolderHasChildren: false
            };
        }

        const items: CombinedNavigationItem[] = [];

        const shouldHideTags = !showHiddenItems;
        const hasHiddenPatterns = hiddenMatcherHasRules;
        const shouldIncludeUntagged = settings.showUntagged && untaggedCount > 0;
        const matcherForMarking = !shouldHideTags && hasHiddenPatterns ? hiddenTagMatcher : undefined;
        const taggedCollectionCount: NoteCountInfo = (() => {
            if (!includeDescendantNotes) {
                return { current: 0, descendants: 0, total: 0 };
            }
            return {
                current: visibleTaggedCount,
                descendants: 0,
                total: visibleTaggedCount
            };
        })();

        // Adds the untagged node to the items list at the specified level
        const pushUntaggedNode = (level: number) => {
            if (!shouldIncludeUntagged) {
                return;
            }
            const untaggedNode: TagTreeNode = {
                path: UNTAGGED_TAG_ID,
                displayPath: UNTAGGED_TAG_ID,
                name: getVirtualTagCollection(VIRTUAL_TAG_COLLECTION_IDS.UNTAGGED).getLabel(),
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

        const addVirtualFolder = (
            id: string,
            name: string,
            icon?: string,
            options?: {
                tagCollectionId?: string;
                propertyCollectionId?: string;
                showFileCount?: boolean;
                noteCount?: NoteCountInfo;
                hasChildren?: boolean;
            }
        ) => {
            const folder: VirtualFolder = { id, name, icon };
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: folder,
                level: 0,
                key: id,
                isSelectable: Boolean(options?.tagCollectionId || options?.propertyCollectionId),
                tagCollectionId: options?.tagCollectionId,
                propertyCollectionId: options?.propertyCollectionId,
                hasChildren: options?.hasChildren,
                showFileCount: options?.showFileCount,
                noteCount: options?.noteCount
            });
        };

        if (visibleTagTree.size === 0) {
            if (settings.showAllTagsFolder) {
                const folderId = TAGS_ROOT_VIRTUAL_FOLDER_ID;
                addVirtualFolder(folderId, strings.tagList.tags, resolveUXIcon(settings.interfaceIcons, 'nav-tags'), {
                    tagCollectionId: TAGGED_TAG_ID,
                    hasChildren: shouldIncludeUntagged,
                    showFileCount: settings.showNoteCount,
                    noteCount: taggedCollectionCount
                });

                if (expansionState.expandedVirtualFolders.has(folderId) && shouldIncludeUntagged) {
                    pushUntaggedNode(1);
                }

                const tagsVirtualFolderHasChildren = shouldIncludeUntagged;
                return {
                    tagItems: items,
                    resolvedRootTagKeys: shouldIncludeUntagged ? [UNTAGGED_TAG_ID] : [],
                    tagsVirtualFolderHasChildren
                };
            }

            if (shouldIncludeUntagged) {
                pushUntaggedNode(0);
                return { tagItems: items, resolvedRootTagKeys: [UNTAGGED_TAG_ID], tagsVirtualFolderHasChildren: true };
            }

            return { tagItems: items, resolvedRootTagKeys: [], tagsVirtualFolderHasChildren: false };
        }

        // Extract root nodes and determine effective comparator based on custom ordering
        const visibleRootNodes = Array.from(visibleTagTree.values());
        const baseComparator = tagComparator ?? compareTagAlphabetically;
        const effectiveComparator: TagComparator =
            rootTagOrderMap.size > 0 ? (a, b) => compareTagOrderWithFallback(a, b, rootTagOrderMap, baseComparator) : baseComparator;
        const sortedRootNodes = visibleRootNodes.length > 0 ? visibleRootNodes.slice().sort(effectiveComparator) : visibleRootNodes;
        const hasVisibleTags = sortedRootNodes.length > 0;
        const hasTagCollectionContent = visibleTaggedCount > 0;
        const hasContent = hasVisibleTags || shouldIncludeUntagged || hasTagCollectionContent;
        const tagsVirtualFolderHasChildren = hasVisibleTags || shouldIncludeUntagged;

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
                comparator: effectiveComparator,
                childSortOrderOverrides: settings.tagTreeSortOverrides
            });
            items.push(...tagEntries);
        };

        if (settings.showAllTagsFolder) {
            if (hasContent) {
                const folderId = TAGS_ROOT_VIRTUAL_FOLDER_ID;
                addVirtualFolder(folderId, strings.tagList.tags, resolveUXIcon(settings.interfaceIcons, 'nav-tags'), {
                    tagCollectionId: TAGGED_TAG_ID,
                    hasChildren: tagsVirtualFolderHasChildren,
                    showFileCount: settings.showNoteCount,
                    noteCount: taggedCollectionCount
                });

                if (expansionState.expandedVirtualFolders.has(folderId)) {
                    resolvedRootTagKeys.forEach(key => {
                        if (hiddenRootTagNodes.has(key) && !showHiddenItems) {
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
                if (hiddenRootTagNodes.has(key) && !showHiddenItems) {
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

        return { tagItems: items, resolvedRootTagKeys, tagsVirtualFolderHasChildren };
    }, [
        settings.showTags,
        settings.showAllTagsFolder,
        settings.interfaceIcons,
        showHiddenItems,
        settings.showUntagged,
        hiddenTagMatcher,
        hiddenMatcherHasRules,
        includeDescendantNotes,
        visibleTagTree,
        visibleTaggedCount,
        untaggedCount,
        settings.showNoteCount,
        settings.rootTagOrder,
        settings.tagTreeSortOverrides,
        expansionState.expandedTags,
        expansionState.expandedVirtualFolders,
        tagComparator,
        rootTagOrderMap,
        hiddenRootTagNodes
    ]);

    const propertySectionBase = useMemo((): {
        propertiesSectionActive: boolean;
        keyNodes: PropertyTreeNode[];
        collectionCount: NoteCountInfo | undefined;
        resolvedRootPropertyKeys: string[];
    } => {
        if (!settings.showProperties) {
            return {
                propertiesSectionActive: false,
                keyNodes: [],
                collectionCount: undefined,
                resolvedRootPropertyKeys: []
            };
        }

        // Root property navigation counts are derived from keys that are visible in navigation.
        // Property list selection for the root can include additional keys that are list-only.
        const keyNodes = Array.from(propertyTree.values()).filter(node => visiblePropertyNavigationKeySet.has(node.key));

        const effectiveComparator: PropertyNodeComparator =
            rootPropertyOrderMap.size > 0
                ? (a, b) => comparePropertyOrderWithFallback(a, b, rootPropertyOrderMap, propertyKeyComparator)
                : propertyKeyComparator;

        keyNodes.sort(effectiveComparator);

        let collectionCount: NoteCountInfo | undefined;
        const shouldShowRootFolder = settings.showAllPropertiesFolder;
        const shouldComputeCollectionCount = settings.showNoteCount && (shouldShowRootFolder || hasRootPropertyShortcut);

        if (shouldComputeCollectionCount) {
            if (!includeDescendantNotes || keyNodes.length === 0) {
                collectionCount = { current: 0, descendants: 0, total: 0 };
            } else {
                const propertyCollectionFiles = new Set<string>();
                keyNodes.forEach(node => {
                    node.notesWithValue.forEach(path => propertyCollectionFiles.add(path));
                });
                const total = propertyCollectionFiles.size;
                collectionCount = { current: total, descendants: 0, total };
            }
        }

        return {
            propertiesSectionActive: true,
            keyNodes,
            collectionCount,
            resolvedRootPropertyKeys: keyNodes.map(node => node.key)
        };
    }, [
        propertyKeyComparator,
        propertyTree,
        rootPropertyOrderMap,
        includeDescendantNotes,
        hasRootPropertyShortcut,
        settings.showAllPropertiesFolder,
        settings.showNoteCount,
        settings.showProperties,
        visiblePropertyNavigationKeySet
    ]);

    const { propertyItems, propertiesSectionActive } = useMemo((): {
        propertyItems: CombinedNavigationItem[];
        propertiesSectionActive: boolean;
    } => {
        if (!propertySectionBase.propertiesSectionActive) {
            return {
                propertyItems: [],
                propertiesSectionActive: false
            };
        }

        const rootId = PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
        const keyNodes = propertySectionBase.keyNodes;
        const collectionCount = propertySectionBase.collectionCount;
        const shouldShowRootFolder = settings.showAllPropertiesFolder;
        const rootLevel = shouldShowRootFolder ? 1 : 0;
        const childLevel = rootLevel + 1;

        const items: CombinedNavigationItem[] = [];

        if (shouldShowRootFolder) {
            items.push({
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                data: {
                    id: rootId,
                    name: strings.navigationPane.properties,
                    icon: resolveUXIcon(settings.interfaceIcons, 'nav-properties')
                },
                level: 0,
                key: rootId,
                isSelectable: true,
                propertyCollectionId: PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
                hasChildren: keyNodes.length > 0,
                showFileCount: settings.showNoteCount,
                noteCount: collectionCount
            });

            if (!expansionState.expandedVirtualFolders.has(rootId)) {
                return { propertyItems: items, propertiesSectionActive: true };
            }
        }

        const sortChildren = (keyNode: PropertyTreeNode, children: Iterable<PropertyTreeNode>): PropertyTreeNode[] => {
            const nodes = Array.from(children);
            if (nodes.length <= 1) {
                return nodes;
            }

            const propertyTreeSortOverrides = settings.propertyTreeSortOverrides;
            const hasChildSortOverride = Boolean(
                propertyTreeSortOverrides && Object.prototype.hasOwnProperty.call(propertyTreeSortOverrides, keyNode.id)
            );
            const childSortOverride = hasChildSortOverride ? propertyTreeSortOverrides?.[keyNode.id] : undefined;
            const comparator = createPropertyComparator({
                order: childSortOverride ?? settings.propertySortOrder,
                compareAlphabetically: comparePropertyValueNodesAlphabetically,
                getFrequency: node =>
                    includeDescendantNotes && node.valuePath ? getTotalPropertyNoteCount(keyNode, node.valuePath) : node.notesWithValue.size
            });

            return nodes.sort(comparator);
        };

        keyNodes.forEach(keyNode => {
            items.push({
                type: NavigationPaneItemType.PROPERTY_KEY,
                data: keyNode,
                level: rootLevel,
                key: keyNode.id
            });

            if (expansionState.expandedProperties.has(keyNode.id) && keyNode.children.size > 0) {
                sortChildren(keyNode, keyNode.children.values()).forEach(child => {
                    items.push({
                        type: NavigationPaneItemType.PROPERTY_VALUE,
                        data: child,
                        level: childLevel,
                        key: child.id
                    });
                });
            }
        });

        return { propertyItems: items, propertiesSectionActive: true };
    }, [
        includeDescendantNotes,
        propertySectionBase.collectionCount,
        propertySectionBase.keyNodes,
        propertySectionBase.propertiesSectionActive,
        settings.interfaceIcons,
        settings.propertyTreeSortOverrides,
        settings.propertySortOrder,
        settings.showAllPropertiesFolder,
        settings.showNoteCount,
        expansionState.expandedVirtualFolders,
        expansionState.expandedProperties
    ]);

    /**
     * Pre-compute parsed excluded folders to avoid repeated parsing
     */
    const parsedExcludedFolders = hiddenFolders;

    // Build list of shortcut items with proper hierarchy
    const shortcutItems = useMemo((): CombinedNavigationItem[] => {
        if (!settings.showShortcuts) {
            return [];
        }

        const headerLevel = 0;
        const itemLevel = headerLevel + 1;

        const fileVisibilityCache = new Map<string, boolean>();
        const tagVisibilityCache = new Map<string, boolean>();
        const hiddenFileTagVisibility = createHiddenTagVisibility(hiddenFileTags, false);
        const shouldFilterHiddenFileTags = hiddenFileTagVisibility.hasHiddenRules;
        const db = shouldFilterHiddenFileTags ? getDBInstance() : null;
        const propertyTree = fileData.propertyTree ?? new Map<string, PropertyTreeNode>();

        // Start with the shortcuts header/virtual folder
        const items: CombinedNavigationItem[] = [
            {
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                key: SHORTCUTS_VIRTUAL_FOLDER_ID,
                level: headerLevel,
                data: {
                    id: SHORTCUTS_VIRTUAL_FOLDER_ID,
                    name: strings.navigationPane.shortcutsHeader,
                    icon: resolveUXIcon(settings.interfaceIcons, 'nav-shortcuts')
                },
                hasChildren: hydratedShortcuts.length > 0
            }
        ];

        // Return only header if shortcuts folder is collapsed
        if (!shortcutsExpanded) {
            return items;
        }

        const isFileVisibleWhenHiddenItemsOff = (path: string): boolean => {
            if (fileVisibilityCache.has(path)) {
                return fileVisibilityCache.get(path) ?? false;
            }

            const abstractFile = app.vault.getAbstractFileByPath(path);
            if (!(abstractFile instanceof TFile)) {
                fileVisibilityCache.set(path, false);
                return false;
            }

            if (abstractFile.extension !== 'md') {
                fileVisibilityCache.set(path, false);
                return false;
            }

            if (hiddenFilePropertyMatcher.hasCriteria && shouldExcludeFileWithMatcher(abstractFile, hiddenFilePropertyMatcher, app)) {
                fileVisibilityCache.set(path, false);
                return false;
            }

            if (hiddenFileNames.length > 0 && shouldExcludeFileName(abstractFile, hiddenFileNames)) {
                fileVisibilityCache.set(path, false);
                return false;
            }

            if (
                shouldFilterHiddenFileTags &&
                getCachedFileTags({ app, file: abstractFile, db }).some(tagValue => !hiddenFileTagVisibility.isTagVisible(tagValue))
            ) {
                fileVisibilityCache.set(path, false);
                return false;
            }

            if (hiddenFolders.length > 0 && abstractFile.parent !== null && isFolderInExcludedFolder(abstractFile.parent, hiddenFolders)) {
                fileVisibilityCache.set(path, false);
                return false;
            }

            fileVisibilityCache.set(path, true);
            return true;
        };

        const isTagVisibleWhenHiddenItemsOff = (tagPath: string): boolean => {
            if (tagVisibilityCache.has(tagPath)) {
                return tagVisibilityCache.get(tagPath) ?? false;
            }

            if (isVirtualTagCollectionId(tagPath)) {
                tagVisibilityCache.set(tagPath, true);
                return true;
            }

            if (!showHiddenItems) {
                const visible = Boolean(findTagNode(visibleTagTree, tagPath));
                tagVisibilityCache.set(tagPath, visible);
                return visible;
            }

            const rootNode = findTagNode(tagTreeForOrdering, tagPath);
            if (!rootNode) {
                tagVisibilityCache.set(tagPath, false);
                return false;
            }

            const stack: TagTreeNode[] = [rootNode];
            const visited = new Set<TagTreeNode>();

            while (stack.length > 0) {
                const current = stack.pop();
                if (!current) {
                    continue;
                }
                if (visited.has(current)) {
                    continue;
                }
                visited.add(current);

                if (
                    hiddenMatcherHasRules &&
                    !isVirtualTagCollectionId(current.path) &&
                    matchesHiddenTagPattern(current.path, current.name, hiddenTagMatcher)
                ) {
                    continue;
                }

                for (const filePath of current.notesWithTag) {
                    if (isFileVisibleWhenHiddenItemsOff(filePath)) {
                        tagVisibilityCache.set(tagPath, true);
                        return true;
                    }
                }

                for (const child of current.children.values()) {
                    stack.push(child);
                }
            }

            tagVisibilityCache.set(tagPath, false);
            return false;
        };

        // Add individual shortcut items based on their type
        hydratedShortcuts.forEach(entry => {
            const { key, shortcut, folder, note, search, tagPath, propertyNodeId } = entry;

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

                const isExcluded = hiddenFolders.length > 0 && isFolderInExcludedFolder(folder, hiddenFolders);
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
                const isExcluded =
                    (note.extension === 'md' &&
                        hiddenFilePropertyMatcher.hasCriteria &&
                        shouldExcludeFileWithMatcher(note, hiddenFilePropertyMatcher, app)) ||
                    (note.extension === 'md' &&
                        shouldFilterHiddenFileTags &&
                        getCachedFileTags({ app, file: note, db }).some(tagValue => !hiddenFileTagVisibility.isTagVisible(tagValue))) ||
                    (hiddenFileNames.length > 0 && shouldExcludeFileName(note, hiddenFileNames)) ||
                    (hiddenFolders.length > 0 && note.parent !== null && isFolderInExcludedFolder(note.parent, hiddenFolders));
                items.push({
                    type: NavigationPaneItemType.SHORTCUT_NOTE,
                    key,
                    level: itemLevel,
                    shortcut,
                    note,
                    isExcluded
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

                const canonicalPath = resolveCanonicalTagPath(resolvedPath, tagTreeForOrdering);
                if (!canonicalPath) {
                    return;
                }

                const tagNode = findTagNode(tagTreeForOrdering, canonicalPath);
                let displayPath = tagNode?.displayPath ?? resolvedPath;
                let isMissing = !tagNode;
                const isExcluded = !isTagVisibleWhenHiddenItemsOff(canonicalPath);

                if (isVirtualTagCollectionId(canonicalPath)) {
                    displayPath = getVirtualTagCollection(canonicalPath).getLabel();
                    isMissing = false;
                }

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_TAG,
                    key,
                    level: itemLevel,
                    shortcut,
                    tagPath: canonicalPath,
                    displayName: displayPath,
                    isMissing,
                    isExcluded,
                    missingLabel: isMissing ? resolvedPath : undefined
                });
            }

            // Handle property shortcuts
            if (isPropertyShortcut(shortcut)) {
                const rawNodeId = propertyNodeId ?? shortcut.nodeId;
                const resolvedNodeId = resolvePropertyShortcutNodeId(propertyNodeId, shortcut.nodeId);
                if (resolvedNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
                    const isMissing = !propertiesSectionActive;
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_PROPERTY,
                        key,
                        level: itemLevel,
                        shortcut,
                        propertyNodeId: PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
                        displayName: strings.navigationPane.properties,
                        isMissing,
                        missingLabel: isMissing ? strings.navigationPane.properties : undefined
                    });
                    return;
                }
                const parsed = resolvedNodeId ? parsePropertyNodeId(resolvedNodeId) : null;
                if (!resolvedNodeId || !parsed) {
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_PROPERTY,
                        key,
                        level: itemLevel,
                        shortcut,
                        propertyNodeId: rawNodeId,
                        displayName: rawNodeId,
                        isMissing: true,
                        missingLabel: rawNodeId
                    });
                    return;
                }

                const resolvedNode = resolvePropertyTreeNode({
                    nodeId: resolvedNodeId,
                    propertyTree
                });
                if (!resolvedNode) {
                    const keyNode = propertyTree.get(parsed.key);
                    if (!keyNode) {
                        const valueLabel = parsed.valuePath?.trim();
                        const missingLabel = valueLabel && valueLabel.length > 0 ? valueLabel : parsed.key;
                        items.push({
                            type: NavigationPaneItemType.SHORTCUT_PROPERTY,
                            key,
                            level: itemLevel,
                            shortcut,
                            propertyNodeId: resolvedNodeId,
                            displayName: missingLabel,
                            isMissing: true,
                            missingLabel
                        });
                        return;
                    }

                    const valueLabel = parsed.valuePath?.trim();
                    const missingLabel = valueLabel && valueLabel.length > 0 ? valueLabel : keyNode.name;
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_PROPERTY,
                        key,
                        level: itemLevel,
                        shortcut,
                        propertyNodeId: resolvedNodeId,
                        displayName: missingLabel,
                        isMissing: true,
                        missingLabel
                    });
                    return;
                }

                const propertyNode = resolvedNode.node;
                if (propertyNode.kind === 'key') {
                    items.push({
                        type: NavigationPaneItemType.SHORTCUT_PROPERTY,
                        key,
                        level: itemLevel,
                        shortcut,
                        propertyNodeId: propertyNode.id,
                        displayName: propertyNode.name
                    });
                    return;
                }

                items.push({
                    type: NavigationPaneItemType.SHORTCUT_PROPERTY,
                    key,
                    level: itemLevel,
                    shortcut,
                    propertyNodeId: propertyNode.id,
                    displayName: propertyNode.name
                });
            }
        });

        return items;
    }, [
        app,
        hydratedShortcuts,
        hiddenFileNames,
        hiddenFileTags,
        hiddenFilePropertyMatcher,
        hiddenFolders,
        hiddenMatcherHasRules,
        hiddenTagMatcher,
        shortcutsExpanded,
        showHiddenItems,
        settings.interfaceIcons,
        settings.showShortcuts,
        fileData.propertyTree,
        propertiesSectionActive,
        visibleTagTree,
        tagTreeForOrdering
    ]);

    const recentNotesHiddenFileMatcher = useMemo(() => {
        return createFileHiddenMatcher({ hiddenFileProperties, hiddenFolders, hiddenFileNames, hiddenFileTags }, app, showHiddenItems);
    }, [app, showHiddenItems, hiddenFileProperties, hiddenFolders, hiddenFileNames, hiddenFileTags]);

    // Build list of recent notes items with proper hierarchy.
    //
    // `recentNotes` is persisted as an array of paths, and the vault can change independently (files moved/deleted).
    // The navigation UI uses `hasChildren` to decide whether to render an expander chevron on the recent section header.
    //
    // Design:
    // - Collapsed: return only the header and compute `hasChildren` via a short scan over the configured limit, stopping at the
    //   first path that resolves to a visible `TFile` (existing + not hidden by settings).
    // - Expanded: build the child item list and keep only visible files.
    const recentNotesItems = useMemo((): CombinedNavigationItem[] => {
        if (!settings.showRecentNotes) {
            return [];
        }

        const headerLevel = 0;
        const itemLevel = headerLevel + 1;
        const limit = Math.max(1, settings.recentNotesCount ?? 1);
        const recentPaths = recentNotes.slice(0, limit);
        const getVisibleRecentFile = (path: string): TFile | null => {
            const file = app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) {
                return null;
            }

            return recentNotesHiddenFileMatcher(file) ? null : file;
        };

        // Use appropriate header based on file visibility setting
        const recentHeaderName =
            fileVisibility === FILE_VISIBILITY.DOCUMENTS
                ? strings.navigationPane.recentNotesHeader
                : strings.navigationPane.recentFilesHeader;

        // Collapsed: return only the header (no child items), with `hasChildren` reflecting whether expansion would render any notes.
        if (!recentNotesExpanded) {
            let hasChildren = false;
            for (const path of recentPaths) {
                if (getVisibleRecentFile(path)) {
                    hasChildren = true;
                    break;
                }
            }
            return [
                {
                    type: NavigationPaneItemType.VIRTUAL_FOLDER,
                    key: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                    level: headerLevel,
                    data: {
                        id: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                        name: recentHeaderName,
                        icon: resolveUXIcon(settings.interfaceIcons, 'nav-recent-files')
                    },
                    hasChildren
                }
            ];
        }

        // Expanded: build child items and keep `hasChildren` aligned with the filtered child list.
        const childItems: CombinedNavigationItem[] = [];
        recentPaths.forEach(path => {
            const file = getVisibleRecentFile(path);
            if (file) {
                childItems.push({
                    type: NavigationPaneItemType.RECENT_NOTE,
                    key: `recent-${path}`,
                    level: itemLevel,
                    note: file
                });
            }
        });

        const items: CombinedNavigationItem[] = [
            {
                type: NavigationPaneItemType.VIRTUAL_FOLDER,
                key: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                level: headerLevel,
                data: {
                    id: RECENT_NOTES_VIRTUAL_FOLDER_ID,
                    name: recentHeaderName,
                    icon: resolveUXIcon(settings.interfaceIcons, 'nav-recent-files')
                },
                hasChildren: childItems.length > 0
            }
        ];

        if (childItems.length === 0) {
            return items;
        }

        items.push(...childItems);

        return items;
    }, [
        app,
        settings.showRecentNotes,
        settings.recentNotesCount,
        settings.interfaceIcons,
        recentNotes,
        fileVisibility,
        recentNotesExpanded,
        recentNotesHiddenFileMatcher
    ]);

    const shouldPinRecentNotes = pinShortcuts && settings.pinRecentNotesWithShortcuts && settings.showRecentNotes;

    // Sanitize section order from local storage and ensure defaults are present
    const normalizedSectionOrder = useMemo(() => sanitizeNavigationSectionOrder(sectionOrder), [sectionOrder]);

    /**
     * Combine shortcut, folder, and tag items based on display order settings
     */
    // Combine all navigation items in the correct order with spacers
    const { items, sectionSpacerMap, firstSectionId } = useMemo(() => {
        const allItems: CombinedNavigationItem[] = [];
        const sectionSpacerMap = new Map<NavigationSectionId, string>();
        let firstVisibleSectionId: NavigationSectionId | null = null;

        // Navigation banners are rendered outside the virtualized items (either pinned in the chrome stack
        // or as scroll content above the tree). Keeping them out of the virtualized rows avoids mixing
        // chrome elements into the tree/list semantics.

        // Add top spacer for visual separation between pinned content and tree items
        allItems.push({
            type: NavigationPaneItemType.TOP_SPACER,
            key: 'top-spacer'
        });

        // Determines which sections should be displayed based on settings and available items
        const shouldIncludeShortcutsSection = settings.showShortcuts && shortcutItems.length > 0 && !pinShortcuts;
        const shouldIncludeRecentSection = settings.showRecentNotes && recentNotesItems.length > 0 && !shouldPinRecentNotes;
        const shouldIncludeFoldersSection = folderItems.length > 0;
        const shouldIncludeTagsSection = settings.showTags && tagItems.length > 0;
        const shouldIncludePropertiesSection = propertiesSectionActive && propertyItems.length > 0;

        // Builds sections in the user-specified order
        const orderedSections: { id: NavigationSectionId; items: CombinedNavigationItem[] }[] = [];

        // Adds sections to the display based on user-specified order and visibility conditions
        normalizedSectionOrder.forEach(identifier => {
            switch (identifier) {
                case NavigationSectionId.SHORTCUTS:
                    if (shouldIncludeShortcutsSection) {
                        orderedSections.push({ id: NavigationSectionId.SHORTCUTS, items: shortcutItems });
                    }
                    break;
                case NavigationSectionId.RECENT:
                    if (shouldIncludeRecentSection) {
                        orderedSections.push({ id: NavigationSectionId.RECENT, items: recentNotesItems });
                    }
                    break;
                case NavigationSectionId.FOLDERS:
                    if (shouldIncludeFoldersSection) {
                        orderedSections.push({ id: NavigationSectionId.FOLDERS, items: folderItems });
                    }
                    break;
                case NavigationSectionId.TAGS:
                    if (shouldIncludeTagsSection) {
                        orderedSections.push({ id: NavigationSectionId.TAGS, items: tagItems });
                    }
                    break;
                case NavigationSectionId.PROPERTIES:
                    if (shouldIncludePropertiesSection) {
                        orderedSections.push({ id: NavigationSectionId.PROPERTIES, items: propertyItems });
                    }
                    break;
                default:
                    break;
            }
        });

        // Filters out empty sections that have no items to display
        const visibleSections = orderedSections.filter(section => section.items.length > 0);

        if (visibleSections.length > 0) {
            firstVisibleSectionId = visibleSections[0].id;
            // Track the spacer key used for the first section so pinned shortcuts can hide its separator
            sectionSpacerMap.set(visibleSections[0].id, 'top-spacer');
        }

        // Assembles final item list with spacers between sections
        visibleSections.forEach((section, index) => {
            allItems.push(...section.items);
            if (index < visibleSections.length - 1) {
                const nextSection = visibleSections[index + 1];
                const spacerKey = buildSectionSeparatorKey(nextSection.id);
                sectionSpacerMap.set(nextSection.id, spacerKey);
                allItems.push({
                    type: NavigationPaneItemType.LIST_SPACER,
                    key: spacerKey
                });
            }
        });

        allItems.push({
            type: NavigationPaneItemType.BOTTOM_SPACER,
            key: 'bottom-spacer'
        });

        return { items: allItems, sectionSpacerMap, firstSectionId: firstVisibleSectionId };
    }, [
        folderItems,
        tagItems,
        shortcutItems,
        recentNotesItems,
        propertyItems,
        propertiesSectionActive,
        normalizedSectionOrder,
        settings.showShortcuts,
        shouldPinRecentNotes,
        settings.showRecentNotes,
        settings.showTags,
        pinShortcuts
    ]);

    const [navigationSeparatorVersion, setNavigationSeparatorVersion] = useState(() => metadataService.getNavigationSeparatorsVersion());

    useEffect(() => {
        return metadataService.subscribeToNavigationSeparatorChanges(version => {
            setNavigationSeparatorVersion(version);
        });
    }, [metadataService]);
    const navigationSeparatorSnapshot = useMemo(() => {
        return {
            version: navigationSeparatorVersion,
            record: settings.navigationSeparators || {}
        };
    }, [navigationSeparatorVersion, settings.navigationSeparators]);

    const parsedNavigationSeparators = useMemo(() => {
        const separatorRecord = navigationSeparatorSnapshot.record;
        const folderSeparators = new Set<string>();
        const tagSeparators = new Set<string>();
        const propertySeparators = new Set<string>();
        const sectionSeparatorIds = new Set<NavigationSectionId>();
        let useSectionSpacerForRootFolder = false;

        Object.entries(separatorRecord || {}).forEach(([key, enabled]) => {
            if (!enabled) {
                return;
            }

            const descriptor = parseNavigationSeparatorKey(key);
            if (!descriptor) {
                return;
            }

            if (descriptor.type === 'section') {
                if (descriptor.id === NavigationSectionId.TAGS && !settings.showAllTagsFolder) {
                    return;
                }
                if (descriptor.id === NavigationSectionId.PROPERTIES && !propertiesSectionActive) {
                    return;
                }
                sectionSeparatorIds.add(descriptor.id);
                return;
            }

            if (descriptor.type === 'folder') {
                if (descriptor.path === '/') {
                    useSectionSpacerForRootFolder = settings.showRootFolder;
                } else {
                    folderSeparators.add(descriptor.path);
                }
                return;
            }

            if (descriptor.type === 'tag') {
                tagSeparators.add(descriptor.path);
                return;
            }

            if (descriptor.type === 'property') {
                const normalizedNodeId = normalizePropertyNodeId(descriptor.nodeId);
                if (normalizedNodeId) {
                    propertySeparators.add(normalizedNodeId);
                }
            }
        });

        const hasAnySeparators =
            folderSeparators.size > 0 ||
            tagSeparators.size > 0 ||
            propertySeparators.size > 0 ||
            sectionSeparatorIds.size > 0 ||
            useSectionSpacerForRootFolder;

        return {
            folderSeparators,
            tagSeparators,
            propertySeparators,
            sectionSeparatorIds,
            useSectionSpacerForRootFolder,
            hasAnySeparators
        };
    }, [navigationSeparatorSnapshot, propertiesSectionActive, settings.showRootFolder, settings.showAllTagsFolder]);

    const itemsWithSeparators = useMemo(() => {
        const {
            folderSeparators,
            tagSeparators,
            propertySeparators,
            sectionSeparatorIds,
            useSectionSpacerForRootFolder,
            hasAnySeparators
        } = parsedNavigationSeparators;

        if (!hasAnySeparators) {
            return items;
        }

        const spacerKeysWithSeparators = new Set<string>();
        const effectiveSectionIds = new Set(sectionSeparatorIds);
        if (pinShortcuts) {
            effectiveSectionIds.delete(NavigationSectionId.SHORTCUTS);
            if (firstSectionId) {
                // When shortcuts are pinned the first inlined section should never draw its separator line
                effectiveSectionIds.delete(firstSectionId);
            }
        }

        effectiveSectionIds.forEach(sectionId => {
            const spacerKey = sectionSpacerMap.get(sectionId);
            if (spacerKey) {
                spacerKeysWithSeparators.add(spacerKey);
            }
        });

        // Include root section separator when:
        // - Section spacer for root folder is enabled AND
        // - Either shortcuts are not pinned OR the first section is not NOTES
        // This ensures proper separation between pinned shortcuts and main navigation sections
        const shouldIncludeRootSectionSeparator =
            useSectionSpacerForRootFolder && (!pinShortcuts || firstSectionId !== NavigationSectionId.FOLDERS);
        if (shouldIncludeRootSectionSeparator) {
            const spacerKey = sectionSpacerMap.get(NavigationSectionId.FOLDERS);
            if (spacerKey) {
                spacerKeysWithSeparators.add(spacerKey);
            }
        }

        if (
            spacerKeysWithSeparators.size === 0 &&
            folderSeparators.size === 0 &&
            tagSeparators.size === 0 &&
            propertySeparators.size === 0
        ) {
            return items;
        }

        const createCustomSeparator = (key: string): CombinedNavigationItem => ({
            type: NavigationPaneItemType.LIST_SPACER,
            key,
            hasSeparator: true
        });

        const result: CombinedNavigationItem[] = [];

        items.forEach(item => {
            if (item.type === NavigationPaneItemType.TOP_SPACER || item.type === NavigationPaneItemType.LIST_SPACER) {
                if (spacerKeysWithSeparators.has(item.key)) {
                    result.push({ ...item, hasSeparator: true });
                } else {
                    result.push(item);
                }
                return;
            }

            const shouldHideFolderSeparator = item.type === NavigationPaneItemType.FOLDER && item.isExcluded && !showHiddenItems;

            if (item.type === NavigationPaneItemType.FOLDER) {
                if (!shouldHideFolderSeparator && folderSeparators.has(item.data.path)) {
                    result.push(createCustomSeparator(buildFolderSeparatorKey(item.data.path)));
                }
            } else if (
                (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) &&
                tagSeparators.has(item.data.path)
            ) {
                result.push(createCustomSeparator(buildTagSeparatorKey(item.data.path)));
            } else if (
                (item.type === NavigationPaneItemType.PROPERTY_KEY || item.type === NavigationPaneItemType.PROPERTY_VALUE) &&
                propertySeparators.has(item.data.id)
            ) {
                result.push(createCustomSeparator(buildPropertySeparatorKey(item.data.id)));
            }

            result.push(item);
        });

        return result;
    }, [firstSectionId, items, parsedNavigationSeparators, sectionSpacerMap, showHiddenItems, pinShortcuts]);

    const decorateItems = useCallback(
        (sourceItems: CombinedNavigationItem[]) =>
            decorateNavigationItems(
                sourceItems,
                app,
                settings,
                fileNameIconNeedles,
                getFileDisplayName,
                metadataService,
                parsedExcludedFolders,
                metadataDecorationVersion
            ),
        [app, settings, fileNameIconNeedles, getFileDisplayName, metadataService, parsedExcludedFolders, metadataDecorationVersion]
    );

    /**
     * Add metadata (colors, icons) and excluded folders to items
     * This pre-computation avoids calling these functions during render
     */
    const itemsWithMetadata = useMemo(() => decorateItems(itemsWithSeparators), [decorateItems, itemsWithSeparators]);

    const decoratedRecentNotes = useMemo(() => itemsWithMetadata.filter(isRecentNavigationItem), [itemsWithMetadata]);

    // Extract shortcut items when pinning is enabled for display in pinned area
    const shortcutItemsWithMetadata = useMemo((): CombinedNavigationItem[] => {
        if (!pinShortcuts) {
            return [];
        }
        return decorateItems(shortcutItems);
    }, [decorateItems, pinShortcuts, shortcutItems]);

    const pinnedRecentNotesItems = useMemo((): CombinedNavigationItem[] => {
        if (!shouldPinRecentNotes) {
            return [];
        }
        if (decoratedRecentNotes.length > 0) {
            return decoratedRecentNotes;
        }
        return decorateItems(recentNotesItems);
    }, [decorateItems, decoratedRecentNotes, recentNotesItems, shouldPinRecentNotes]);

    /**
     * Filter items based on showHiddenItems setting
     * When showHiddenItems is false, filter out folders marked as excluded
     */
    const filteredItems = useMemo(() => {
        // When pinning shortcuts, exclude them from main tree (they're rendered separately)
        const baseItems = itemsWithMetadata.filter(current => {
            if (pinShortcuts && isShortcutNavigationItem(current)) {
                return false;
            }
            if (shouldPinRecentNotes && isRecentNavigationItem(current)) {
                return false;
            }
            return true;
        });

        if (showHiddenItems) {
            // Show all items including excluded ones
            return baseItems;
        }

        return baseItems.filter(item => {
            if (item.type === NavigationPaneItemType.FOLDER && item.isExcluded) {
                return false;
            }
            return true;
        });
    }, [itemsWithMetadata, showHiddenItems, pinShortcuts, shouldPinRecentNotes]);

    /**
     * Find the first folder that appears inline (not in the pinned area) when shortcuts are pinned.
     *
     * Special behavior when shortcuts are pinned:
     * - Shortcuts themselves cannot have separators added/removed (no context menu separator options)
     * - The first item after pinned shortcuts cannot have separators added/removed
     * - This maintains clean visual separation between pinned area and main navigation
     * - Users must disable pinned shortcuts to manage separators on these items
     */
    const firstInlineFolderPath = useMemo(() => {
        if (!pinShortcuts) {
            return null;
        }

        // Skip spacer items to find the first actual navigation item
        let firstInlineItem: CombinedNavigationItem | null = null;
        for (const item of filteredItems) {
            if (SPACER_ITEM_TYPES.has(item.type)) {
                continue;
            }
            firstInlineItem = item;
            break;
        }

        if (!firstInlineItem) {
            return null;
        }

        // Only return path if it's a folder (not a tag or other item type)
        if (firstInlineItem.type === NavigationPaneItemType.FOLDER) {
            return firstInlineItem.data.path;
        }

        return null;
    }, [filteredItems, pinShortcuts]);

    // Suppress the separator for the first inline folder when shortcuts are pinned
    // This prevents visual separation between pinned shortcuts and the main navigation list
    const filteredItemsForDisplay = useMemo(() => {
        if (!pinShortcuts) {
            return filteredItems;
        }
        if (!firstInlineFolderPath) {
            return filteredItems;
        }

        const { folderSeparators } = parsedNavigationSeparators;
        const hasSeparator = folderSeparators.has(firstInlineFolderPath);
        if (!hasSeparator) {
            return filteredItems;
        }

        // Remove the separator spacer item for the first inline folder
        const suppressedKey = buildFolderSeparatorKey(firstInlineFolderPath);
        let matchIndex = -1;
        for (let i = 0; i < filteredItems.length; i += 1) {
            const item = filteredItems[i];
            if (item.type === NavigationPaneItemType.LIST_SPACER && item.key === suppressedKey) {
                matchIndex = i;
                break;
            }
        }

        if (matchIndex === -1) {
            return filteredItems;
        }

        // Create new array without the suppressed separator
        const nextItems = filteredItems.slice();
        nextItems.splice(matchIndex, 1);
        return nextItems;
    }, [filteredItems, firstInlineFolderPath, parsedNavigationSeparators, pinShortcuts]);

    /**
     * Create a map for O(1) item lookups by path
     * Build from filtered items so indices match what's displayed
     */
    const itemsWithRootSpacing = useMemo(() => {
        const tagRootLevel = settings.showAllTagsFolder ? 1 : 0;
        return insertRootSpacing(filteredItemsForDisplay, settings.rootLevelSpacing, {
            showRootFolder: settings.showRootFolder,
            tagRootLevel
        });
    }, [filteredItemsForDisplay, settings.rootLevelSpacing, settings.showRootFolder, settings.showAllTagsFolder]);

    const pathToIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        itemsWithRootSpacing.forEach((item, index) => {
            if (item.type === NavigationPaneItemType.FOLDER) {
                setNavigationIndex(indexMap, ItemType.FOLDER, item.data.path, index);
            } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
                const tagNode = item.data;
                setNavigationIndex(indexMap, ItemType.TAG, tagNode.path, index);
            } else if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER && item.tagCollectionId) {
                setNavigationIndex(indexMap, ItemType.TAG, item.tagCollectionId, index);
            } else if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER && item.propertyCollectionId) {
                setNavigationIndex(indexMap, ItemType.PROPERTY, item.key, index);
            } else if (item.type === NavigationPaneItemType.PROPERTY_KEY || item.type === NavigationPaneItemType.PROPERTY_VALUE) {
                setNavigationIndex(indexMap, ItemType.PROPERTY, item.data.id, index);
            }
        });

        return indexMap;
    }, [itemsWithRootSpacing]);

    // Build index map for shortcuts to enable scrolling to specific shortcuts
    const shortcutIndex = useMemo(() => {
        const indexMap = new Map<string, number>();

        const source = pinShortcuts ? shortcutItemsWithMetadata : itemsWithRootSpacing;

        source.forEach((item, index) => {
            if (
                item.type === NavigationPaneItemType.SHORTCUT_FOLDER ||
                item.type === NavigationPaneItemType.SHORTCUT_NOTE ||
                item.type === NavigationPaneItemType.SHORTCUT_SEARCH ||
                item.type === NavigationPaneItemType.SHORTCUT_TAG ||
                item.type === NavigationPaneItemType.SHORTCUT_PROPERTY
            ) {
                indexMap.set(item.key, index);
            }
        });

        return indexMap;
    }, [itemsWithRootSpacing, pinShortcuts, shortcutItemsWithMetadata]);

    const lastTagCountsRef = useRef<Map<string, NoteCountInfo>>(new Map());
    const lastPropertyCountsRef = useRef<Map<string, NoteCountInfo>>(new Map());
    const lastFolderCountsRef = useRef<Map<string, NoteCountInfo>>(new Map());

    /**
     * Pre-compute tag counts to avoid expensive calculations during render
     */
    const computedTagCounts = useMemo((): Map<string, NoteCountInfo> | null => {
        // Skip computation if pane is not visible or not showing tags
        if (!isVisible || !settings.showTags) {
            return null;
        }

        const counts = new Map<string, NoteCountInfo>();

        const taggedCollectionCurrent = includeDescendantNotes ? visibleTaggedCount : 0;

        counts.set(TAGGED_TAG_ID, {
            current: taggedCollectionCurrent,
            descendants: 0,
            total: taggedCollectionCurrent
        });

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
                if (includeDescendantNotes) {
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
    }, [itemsWithMetadata, settings.showTags, settings.showUntagged, includeDescendantNotes, visibleTaggedCount, untaggedCount, isVisible]);

    const tagCounts = useMemo(() => {
        if (!settings.showTags) {
            return new Map<string, NoteCountInfo>();
        }
        return computedTagCounts ?? lastTagCountsRef.current;
    }, [computedTagCounts, settings.showTags]);

    useEffect(() => {
        if (!settings.showTags) {
            lastTagCountsRef.current = new Map();
            return;
        }
        if (computedTagCounts) {
            lastTagCountsRef.current = computedTagCounts;
        }
    }, [computedTagCounts, settings.showTags]);

    const computedPropertyCounts = useMemo((): Map<string, NoteCountInfo> | null => {
        if (!isVisible || !propertiesSectionActive || !settings.showNoteCount) {
            return null;
        }

        const counts = new Map<string, NoteCountInfo>();
        if (propertySectionBase.collectionCount) {
            counts.set(PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, propertySectionBase.collectionCount);
        }
        const visiblePropertyNodes = new Map<string, PropertyTreeNode>();

        itemsWithMetadata.forEach(item => {
            if (item.type === NavigationPaneItemType.PROPERTY_KEY || item.type === NavigationPaneItemType.PROPERTY_VALUE) {
                visiblePropertyNodes.set(item.data.id, item.data);
            }
        });

        if (visiblePropertyNodes.size === 0) {
            return counts;
        }

        const propertyTree = fileData.propertyTree ?? new Map<string, PropertyTreeNode>();

        visiblePropertyNodes.forEach(node => {
            if (node.kind === 'key') {
                const current = getDirectPropertyKeyNoteCount(node);
                if (!includeDescendantNotes) {
                    counts.set(node.id, { current, descendants: 0, total: current });
                    return;
                }

                const total = node.notesWithValue.size;
                const descendants = Math.max(total - current, 0);
                counts.set(node.id, { current, descendants, total });
                return;
            }

            const current = node.notesWithValue.size;
            if (!includeDescendantNotes || !node.valuePath) {
                counts.set(node.id, { current, descendants: 0, total: current });
                return;
            }

            const keyNode = propertyTree.get(node.key);
            if (!keyNode) {
                counts.set(node.id, { current, descendants: 0, total: current });
                return;
            }

            const total = getTotalPropertyNoteCount(keyNode, node.valuePath);
            const descendants = Math.max(total - current, 0);
            counts.set(node.id, { current, descendants, total });
        });

        return counts;
    }, [
        isVisible,
        itemsWithMetadata,
        propertiesSectionActive,
        settings.showNoteCount,
        fileData.propertyTree,
        includeDescendantNotes,
        propertySectionBase.collectionCount
    ]);

    const propertyCounts = useMemo(() => {
        if (!propertiesSectionActive || !settings.showNoteCount) {
            return new Map<string, NoteCountInfo>();
        }
        return computedPropertyCounts ?? lastPropertyCountsRef.current;
    }, [computedPropertyCounts, propertiesSectionActive, settings.showNoteCount]);

    useEffect(() => {
        if (!propertiesSectionActive || !settings.showNoteCount) {
            lastPropertyCountsRef.current = new Map();
            return;
        }
        if (computedPropertyCounts) {
            lastPropertyCountsRef.current = computedPropertyCounts;
        }
    }, [computedPropertyCounts, propertiesSectionActive, settings.showNoteCount]);

    /**
     * Pre-compute folder file counts to avoid recursive counting during render
     */
    const computedFolderCounts = useMemo((): Map<string, NoteCountInfo> | null => {
        // Skip computation if pane is not visible or not showing note counts
        if (!isVisible || !settings.showNoteCount) {
            return null;
        }

        const counts = new Map<string, NoteCountInfo>();

        const excludedProperties = effectiveFrontmatterExclusions;
        const excludedFileMatcher = createFrontmatterPropertyExclusionMatcher(excludedProperties);
        const excludedFolderPatterns = hiddenFolders;
        const hiddenFileTagVisibility = showHiddenItems ? null : createHiddenTagVisibility(hiddenFileTags, false);
        const db = hiddenFileTagVisibility && hiddenFileTagVisibility.hasHiddenRules ? getDBInstanceOrNull() : null;
        const folderNoteSettings = getFolderNoteDetectionSettings(settings);
        const includeDescendants = includeDescendantNotes;
        const showHiddenFolders = showHiddenItems;
        const countOptions = {
            app,
            db,
            fileVisibility,
            excludedFiles: excludedProperties,
            excludedFileMatcher,
            excludedFolders: excludedFolderPatterns,
            fileNameMatcher: folderCountFileNameMatcher,
            hiddenFileTagVisibility,
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
        includeDescendantNotes,
        effectiveFrontmatterExclusions,
        hiddenFolders,
        hiddenFileNames,
        hiddenFileTags,
        showHiddenItems,
        folderCountFileNameMatcher,
        fileVisibility,
        settings.enableFolderNotes,
        settings.folderNoteName,
        settings.folderNoteNamePattern,
        settings.hideFolderNoteInList,
        app,
        isVisible,
        fileChangeVersion
    ]);

    const folderCounts = useMemo(() => {
        if (!settings.showNoteCount) {
            return new Map<string, NoteCountInfo>();
        }
        return computedFolderCounts ?? lastFolderCountsRef.current;
    }, [computedFolderCounts, settings.showNoteCount]);

    useEffect(() => {
        if (!settings.showNoteCount) {
            lastFolderCountsRef.current = new Map();
            return;
        }
        if (computedFolderCounts) {
            lastFolderCountsRef.current = computedFolderCounts;
        }
    }, [computedFolderCounts, settings.showNoteCount]);

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
        items: itemsWithRootSpacing,
        firstSectionId,
        firstInlineFolderPath,
        shortcutItems: shortcutItemsWithMetadata,
        pinnedRecentNotesItems,
        shouldPinRecentNotes,
        tagsVirtualFolderHasChildren,
        propertiesSectionActive,
        pathToIndex,
        shortcutIndex,
        tagCounts,
        propertyCounts,
        folderCounts,
        rootLevelFolders,
        missingRootFolderPaths,
        resolvedRootTagKeys,
        rootOrderingTagTree: tagTreeForOrdering,
        rootTagOrderMap,
        missingRootTagPaths,
        resolvedRootPropertyKeys: propertySectionBase.resolvedRootPropertyKeys,
        rootOrderingPropertyTree: propertyTree,
        rootPropertyOrderMap,
        missingRootPropertyKeys,
        vaultChangeVersion: fileChangeVersion,
        navigationBannerPath
    };
}
