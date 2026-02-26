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
 * OPTIMIZATIONS:
 *
 * 1. React.memo with forwardRef - Only re-renders on prop changes
 *
 * 2. Virtualization:
 *    - TanStack Virtual for rendering only visible items
 *    - Single virtualizer handles both folders and tags
 *    - Dynamic item heights with efficient measurement
 *    - Scroll position preserved during updates
 *
 * 3. Tree building optimization:
 *    - useMemo rebuilds navigation items only when structure changes
 *    - Efficient tree flattening with level tracking
 *    - Virtual folders injected at correct positions
 *    - Tag virtualization and hidden-tag handling
 *
 * 4. Pre-computed values:
 *    - Folder counts calculated once during tree build
 *    - Tag counts from pre-built tag tree
 *    - Metadata (colors/icons) passed as props to avoid lookups
 *
 * 5. Event handling:
 *    - Vault events trigger selective rebuilds
 *    - Expansion state managed efficiently with Sets
 *    - Keyboard navigation with minimal re-renders
 *
 * 6. Search optimization:
 *    - Search filtering at tree build time
 *    - Automatic expansion of search results
 *    - Minimal impact on non-search performance
 *
 * 7. Stable callbacks:
 *    - All event handlers memoized
 *    - Props passed to child components are stable
 *    - Prevents unnecessary child re-renders
 */

import React, {
    useRef,
    useEffect,
    useCallback,
    useImperativeHandle,
    forwardRef,
    useMemo,
    useState,
    useReducer,
    useLayoutEffect
} from 'react';
import { TFolder, TFile, Menu, Platform, requireApiVersion } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { DndContext, PointerSensor, closestCenter, type DragEndEvent, type DragStartEvent, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import {
    useServices,
    useCommandQueue,
    useFileSystemOps,
    useMetadataService,
    useTagOperations,
    usePropertyOperations
} from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate, useActiveProfile } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { showNotice } from '../utils/noticeUtils';
import { executeCommand } from '../utils/typeGuards';
import { resolveUXIcon, resolveUXIconForMenu } from '../utils/uxIcons';
import { useFileCache } from '../context/StorageContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useNavigationPaneKeyboard } from '../hooks/useNavigationPaneKeyboard';
import { useNavigationPaneData } from '../hooks/useNavigationPaneData';
import { useNavigationPaneScroll } from '../hooks/useNavigationPaneScroll';
import { useNavigationRootReorder } from '../hooks/useNavigationRootReorder';
import { usePointerDrag } from '../hooks/usePointerDrag';
import type { ListReorderHandlers } from '../types/listReorder';
import type { CombinedNavigationItem } from '../types/virtualization';
import {
    IOS_OBSIDIAN_1_11_PLUS_GLASS_TOOLBAR_HEIGHT_PX,
    NavigationPaneItemType,
    ItemType,
    PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
    TAGS_ROOT_VIRTUAL_FOLDER_ID,
    TAGGED_TAG_ID,
    UNTAGGED_TAG_ID,
    type CSSPropertiesWithVars
} from '../types';
import { getSelectedPath } from '../utils/selectionUtils';
import { PropertyTreeNode, TagTreeNode } from '../types/storage';
import { getFolderNote, getFolderNoteDetectionSettings, openFolderNoteFile } from '../utils/folderNotes';
import { collectAllTagPaths, findTagNode, getTotalNoteCount } from '../utils/tagTree';
import { FILE_VISIBILITY, getExtensionSuffix, shouldShowExtensionSuffix } from '../utils/fileTypeUtils';
import { getTagSearchModifierOperator, resolveCanonicalTagPath } from '../utils/tagUtils';
import { foldSearchText } from '../utils/recordUtils';
import { FolderItem } from './FolderItem';
import { NavigationPaneHeader } from './NavigationPaneHeader';
import { NavigationToolbar } from './NavigationToolbar';
import { Calendar } from './calendar';
import { TagTreeItem } from './TagTreeItem';
import { PropertyTreeItem } from './PropertyTreeItem';
import { VaultTitleArea } from './VaultTitleArea';
import { VirtualFolderComponent, type VirtualFolderTrailingAction } from './VirtualFolderItem';
import { buildIndentGuideLevelsMap, getNavigationIndex, normalizeNavigationPath } from '../utils/navigationIndex';
import {
    STORAGE_KEYS,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    RECENT_NOTES_VIRTUAL_FOLDER_ID,
    NavigationSectionId,
    NAVIGATION_PANE_DIMENSIONS
} from '../types';
import { localStorage } from '../utils/localStorage';
import { runAsyncAction } from '../utils/async';
import { extractFilePathsFromDataTransfer, parsePropertyDragPayload, parseTagDragPayload } from '../utils/dragData';
import { resolveFolderNoteClickOpenContext } from '../utils/keyboardOpenContext';
import { openFileInContext } from '../utils/openFileInContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { ShortcutItem } from './ShortcutItem';
import { ConfirmModal } from '../modals/ConfirmModal';
import { PropertyKeyVisibilityModal } from '../modals/PropertyKeyVisibilityModal';
import {
    ShortcutEntry,
    ShortcutType,
    SearchShortcut,
    SHORTCUT_DRAG_MIME,
    isFolderShortcut,
    isNoteShortcut,
    isSearchShortcut,
    isTagShortcut,
    isPropertyShortcut
} from '../types/shortcuts';
import { strings } from '../i18n';
import { NavigationBanner } from './NavigationBanner';
import { NavigationRootReorderPanel } from './NavigationRootReorderPanel';
import {
    buildFolderMenu,
    buildFileMenu,
    buildTagMenu,
    buildPropertyMenu,
    type MenuServices,
    type MenuState,
    type MenuDispatchers
} from '../utils/contextMenu';
import type { NoteCountInfo } from '../types/noteCounts';
import type { SearchNavFilterState } from '../types/search';
import type { InclusionOperator } from '../utils/filterSearch';
import { calculateFolderNoteCounts } from '../utils/noteCountUtils';
import { getEffectiveFrontmatterExclusions } from '../utils/exclusionUtils';
import { normalizeNavigationSectionOrderInput } from '../utils/navigationSections';
import { getPathBaseName } from '../utils/pathUtils';
import type { NavigateToFolderOptions, RevealPropertyOptions, RevealTagOptions } from '../hooks/useNavigatorReveal';
import { isVirtualTagCollectionId } from '../utils/virtualTagCollections';
import { compositeWithBase } from '../utils/colorUtils';
import { useMeasuredElementHeight } from '../hooks/useMeasuredElementHeight';
import { useSurfaceColorVariables } from '../hooks/useSurfaceColorVariables';
import { NAVIGATION_PANE_SURFACE_COLOR_MAPPINGS } from '../constants/surfaceColorMappings';
import { PROPERTY_DRAG_MIME, TAG_DRAG_MIME } from '../types/obsidian-extended';
import { SHORTCUT_POINTER_CONSTRAINT, verticalAxisOnly } from '../utils/dndConfig';
import { createFrontmatterPropertyExclusionMatcher, createHiddenFileNameMatcherForVisibility } from '../utils/fileFilters';
import { createHiddenTagVisibility } from '../utils/tagPrefixMatcher';
import { getDBInstanceOrNull } from '../storage/fileOperations';
import { getActiveVaultProfile } from '../utils/vaultProfiles';
import {
    buildPropertyKeyNodeId,
    buildPropertyValueNodeId,
    getDirectPropertyKeyNoteCount,
    parsePropertyNodeId,
    getTotalPropertyNoteCount,
    resolvePropertyShortcutNodeId,
    resolvePropertyTreeNode
} from '../utils/propertyTree';

export interface NavigationPaneHandle {
    getIndexOfPath: (itemType: ItemType, path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
    requestScroll: (path: string, options: { align?: 'auto' | 'center' | 'start' | 'end'; itemType: ItemType }) => void;
    openShortcutByNumber: (shortcutNumber: number) => Promise<boolean>;
}

interface NavigationPaneProps {
    style?: React.CSSProperties;
    uiScale: number;
    /**
     * Reference to the root navigator container (.nn-split-container).
     * This is passed from NotebookNavigatorComponent to ensure keyboard events
     * are captured at the navigator level, not globally. This allows proper
     * keyboard navigation between panes while preventing interference with
     * other Obsidian views.
     */
    rootContainerRef: React.RefObject<HTMLDivElement | null>;
    searchNavFilters?: SearchNavFilterState;
    onExecuteSearchShortcut?: (shortcutKey: string, searchShortcut: SearchShortcut) => Promise<void> | void;
    onNavigateToFolder: (folderPath: string, options?: NavigateToFolderOptions) => void;
    onRevealTag: (tagPath: string, options?: RevealTagOptions) => void;
    onRevealProperty: (propertyNodeId: string, options?: RevealPropertyOptions) => boolean;
    onRevealFile: (file: TFile) => void;
    onRevealShortcutFile?: (file: TFile) => void;
    onModifySearchWithTag: (tag: string, operator: InclusionOperator) => void;
    onModifySearchWithProperty: (key: string, value: string | null, operator: InclusionOperator) => void;
    onModifySearchWithDateFilter: (dateToken: string) => void;
}

// Default note count object used when counts are disabled or unavailable
const ZERO_NOTE_COUNT: NoteCountInfo = { current: 0, descendants: 0, total: 0 };
const EMPTY_TAG_TOKENS: string[] = [];
const EMPTY_INDENT_GUIDE_MAP = new Map<string, number[]>();
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
        // The caller controls normalization strategy (plain fold vs property-node parsing + fold).
        const normalizedToken = normalizeToken(token);
        if (!normalizedToken) {
            return;
        }
        normalizedTokens.add(normalizedToken);
    });

    return normalizedTokens.size > 0 ? normalizedTokens : null;
};

const setBoundedFoldedSearchCacheEntry = (cache: Map<string, string>, key: string, value: string): void => {
    // Keep the oldest insertion order entry bounded out of the cache.
    // This keeps memory usage stable while preserving fast-path hits for recently rendered nodes.
    if (!cache.has(key) && cache.size >= MAX_FOLDED_SEARCH_CACHE_ENTRIES) {
        for (const oldestKey of cache.keys()) {
            cache.delete(oldestKey);
            break;
        }
    }

    cache.set(key, value);
};

// Converts property node IDs into folded key/value IDs used by search token matching.
const normalizePropertyNodeIdForSearchMatch = (propertyNodeId: string): string => {
    const parsed = parsePropertyNodeId(propertyNodeId);
    if (!parsed) {
        // Fallback for non-standard IDs: fold raw ID and compare directly.
        return foldSearchText(propertyNodeId);
    }

    // IDs are rebuilt from folded key/value segments so query tokens and rendered nodes use the same representation.
    const foldedKey = foldSearchText(parsed.key);
    if (!parsed.valuePath) {
        return buildPropertyKeyNodeId(foldedKey);
    }

    return buildPropertyValueNodeId(foldedKey, foldSearchText(parsed.valuePath));
};

interface SortableShortcutItemProps extends React.ComponentProps<typeof ShortcutItem> {
    sortableId: string;
    canReorder: boolean;
    dragHandlers?: ListReorderHandlers;
}

function SortableShortcutItem({ sortableId, canReorder, dragHandlers, ...rest }: SortableShortcutItemProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isSorting } = useSortable({
        id: sortableId,
        disabled: !canReorder
    });
    const dragStyle = transform ? { transform: CSS.Transform.toString(transform), transition } : undefined;

    return (
        <ShortcutItem
            {...rest}
            dragHandlers={dragHandlers}
            dragRef={setNodeRef}
            dragHandleRef={setActivatorNodeRef}
            dragAttributes={attributes}
            dragListeners={listeners}
            dragStyle={dragStyle}
            isSorting={isSorting}
        />
    );
}

export const NavigationPane = React.memo(
    forwardRef<NavigationPaneHandle, NavigationPaneProps>(function NavigationPane(props, ref) {
        const { app, isMobile, plugin, tagTreeService, propertyTreeService } = useServices();
        const {
            onExecuteSearchShortcut,
            rootContainerRef,
            searchNavFilters,
            onNavigateToFolder,
            onRevealTag,
            onRevealProperty,
            onRevealFile,
            onRevealShortcutFile,
            onModifySearchWithTag,
            onModifySearchWithProperty,
            onModifySearchWithDateFilter,
            uiScale
        } = props;
        const commandQueue = useCommandQueue();
        const fileSystemOps = useFileSystemOps();
        const metadataService = useMetadataService();
        const tagOperations = useTagOperations();
        const propertyOperations = usePropertyOperations();
        const expansionState = useExpansionState();
        const expansionDispatch = useExpansionDispatch();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const activeProfile = useActiveProfile();
        const uxPreferences = useUXPreferences();
        const includeDescendantNotes = uxPreferences.includeDescendantNotes;
        const showHiddenItems = uxPreferences.showHiddenItems;
        const showCalendar = uxPreferences.showCalendar;
        // The calendar height depends on how many week rows it renders; expose that number as a CSS var for layout sizing.
        const [calendarWeekCount, setCalendarWeekCount] = useState<number>(() => settings.calendarWeeksToShow);
        useEffect(() => {
            if (settings.calendarWeeksToShow !== 6) {
                setCalendarWeekCount(settings.calendarWeeksToShow);
            }
        }, [settings.calendarWeeksToShow]);
        const { hiddenFolders, hiddenFileNames, hiddenFileTags, fileVisibility } = activeProfile;
        // Resolves frontmatter exclusions, returns empty array when hidden items are shown
        const effectiveFrontmatterExclusions = getEffectiveFrontmatterExclusions(settings, showHiddenItems);
        const effectiveFrontmatterExclusionMatcher = useMemo(() => {
            return createFrontmatterPropertyExclusionMatcher(effectiveFrontmatterExclusions);
        }, [effectiveFrontmatterExclusions]);
        const folderCountFileNameMatcher = useMemo(() => {
            return createHiddenFileNameMatcherForVisibility(hiddenFileNames, showHiddenItems);
        }, [hiddenFileNames, showHiddenItems]);
        const hiddenFileTagVisibility = useMemo(() => {
            if (showHiddenItems) {
                return null;
            }
            return createHiddenTagVisibility(hiddenFileTags, false);
        }, [hiddenFileTags, showHiddenItems]);
        const noteCountDB = useMemo(() => {
            if (showHiddenItems || !hiddenFileTagVisibility || !hiddenFileTagVisibility.hasHiddenRules) {
                return null;
            }
            return getDBInstanceOrNull();
        }, [hiddenFileTagVisibility, showHiddenItems]);
        const updateSettings = useSettingsUpdate();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();
        const isVerticalDualPane = !uiState.singlePane && settings.dualPaneOrientation === 'vertical';
        const calendarPlacement = settings.calendarPlacement;
        const isLeftSidebarCalendar = calendarPlacement === 'left-sidebar';
        const shouldShowCalendarInDualPaneOverlay = !uiState.singlePane && !isVerticalDualPane;
        const shouldShowCalendarInSinglePaneNavigation =
            uiState.singlePane && settings.calendarLeftPlacement === 'navigation' && uiState.currentSinglePaneView === 'navigation';
        const shouldRenderCalendarOverlay =
            isLeftSidebarCalendar && showCalendar && (shouldShowCalendarInDualPaneOverlay || shouldShowCalendarInSinglePaneNavigation);
        const shortcuts = useShortcuts();
        const {
            shortcuts: shortcutsList,
            shortcutMap,
            tagShortcutKeysByPath,
            propertyShortcutKeysByNodeId,
            removeShortcut,
            clearShortcuts,
            hydratedShortcuts,
            reorderShortcuts,
            addTagShortcut,
            addPropertyShortcut,
            addShortcutsBatch,
            hasFolderShortcut,
            hasNoteShortcut
        } = shortcuts;
        const effectiveShortcutBadgeDisplay = settings.shortcutBadgeDisplay;
        const shouldShowShortcutCounts = effectiveShortcutBadgeDisplay === 'count';
        const shortcutNumberBadgesByKey = useMemo(() => {
            if (effectiveShortcutBadgeDisplay !== 'index') {
                return new Map<string, string>();
            }

            const badgeMap = new Map<string, string>();
            hydratedShortcuts.slice(0, 9).forEach((shortcut, index) => {
                badgeMap.set(shortcut.key, String(index + 1));
            });
            return badgeMap;
        }, [effectiveShortcutBadgeDisplay, hydratedShortcuts]);
        const { fileData, getFileDisplayName, isStorageReady } = useFileCache();
        // Detect Android platform for toolbar placement
        const isAndroid = Platform.isAndroidApp;
        const vaultTitlePreference = settings.vaultTitle ?? 'navigation';
        const hasMultipleVaultProfiles = (settings.vaultProfiles ?? []).length > 1;
        const shouldShowVaultTitleInHeader = !isMobile && hasMultipleVaultProfiles && vaultTitlePreference === 'header';
        const shouldShowVaultTitleInNavigationPane = !isMobile && hasMultipleVaultProfiles && vaultTitlePreference === 'navigation';
        const navigationPaneRef = useRef<HTMLDivElement>(null);
        const navigationBannerRef = useRef<HTMLDivElement>(null);
        const pinnedShortcutsContainerRef = useRef<HTMLDivElement>(null);
        const [pinnedShortcutsScrollElement, setPinnedShortcutsScrollElement] = useState<HTMLDivElement | null>(null);
        const [pinnedShortcutsHasOverflow, setPinnedShortcutsHasOverflow] = useState(false);
        const pinnedShortcutsResizeFrameRef = useRef<number | null>(null);
        const pinnedShortcutsResizeHeightRef = useRef<number>(0);
        const { startPointerDrag } = usePointerDrag();

        // Resolves scale factor with fallback to prevent division by zero or invalid values
        const scaleFactor = Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 1;

        // Ref callback to capture the scrollable container for pinned shortcuts
        const pinnedShortcutsScrollRefCallback = useCallback((node: HTMLDivElement | null) => {
            setPinnedShortcutsScrollElement(node);
        }, []);

        // Loads persisted max height for pinned shortcuts or null for auto-sizing
        const [pinnedShortcutsMaxHeight, setPinnedShortcutsMaxHeight] = useState<number | null>(() => {
            const stored = localStorage.get<number>(STORAGE_KEYS.pinnedShortcutsMaxHeightKey);
            if (typeof stored !== 'number' || !Number.isFinite(stored) || stored <= 0) {
                return null;
            }
            return Math.max(NAVIGATION_PANE_DIMENSIONS.pinnedShortcutsMinHeight, Math.round(stored));
        });

        const [isPinnedShortcutsResizing, setIsPinnedShortcutsResizing] = useState(false);

        // Checks if pinned shortcuts content exceeds container height
        const updatePinnedShortcutsOverflow = useCallback(
            (element?: HTMLDivElement | null) => {
                const target = element ?? pinnedShortcutsScrollElement;
                if (!target) {
                    setPinnedShortcutsHasOverflow(false);
                    return;
                }

                const hasOverflow = target.scrollHeight - target.clientHeight > 1;
                setPinnedShortcutsHasOverflow(prev => (prev === hasOverflow ? prev : hasOverflow));
            },
            [pinnedShortcutsScrollElement]
        );

        // Throttles max height updates using requestAnimationFrame to avoid layout thrashing
        const schedulePinnedShortcutsHeightUpdate = useCallback((height: number) => {
            pinnedShortcutsResizeHeightRef.current = height;
            if (pinnedShortcutsResizeFrameRef.current !== null) {
                return;
            }
            pinnedShortcutsResizeFrameRef.current = window.requestAnimationFrame(() => {
                pinnedShortcutsResizeFrameRef.current = null;
                setPinnedShortcutsMaxHeight(pinnedShortcutsResizeHeightRef.current);
            });
        }, []);

        // Cancels any pending animation frame on unmount
        useEffect(() => {
            return () => {
                if (pinnedShortcutsResizeFrameRef.current !== null) {
                    cancelAnimationFrame(pinnedShortcutsResizeFrameRef.current);
                    pinnedShortcutsResizeFrameRef.current = null;
                }
            };
        }, []);

        // Monitors pinned shortcuts container size changes to update overflow state
        useLayoutEffect(() => {
            const element = pinnedShortcutsScrollElement;
            if (!element) {
                setPinnedShortcutsHasOverflow(false);
                return;
            }

            updatePinnedShortcutsOverflow(element);

            if (typeof ResizeObserver === 'undefined') {
                return;
            }

            const resizeObserver = new ResizeObserver(() => {
                updatePinnedShortcutsOverflow(element);
            });
            resizeObserver.observe(element);

            return () => {
                resizeObserver.disconnect();
            };
        }, [pinnedShortcutsScrollElement, updatePinnedShortcutsOverflow]);

        // Handles drag-to-resize for the pinned shortcuts section
        const handlePinnedShortcutsResizePointerDown = useCallback(
            (event: React.PointerEvent<HTMLDivElement>) => {
                if (event.pointerType === 'mouse' && event.button !== 0) {
                    return;
                }

                const pinnedElement = pinnedShortcutsContainerRef.current;
                const scrollElement = pinnedShortcutsScrollElement;
                if (!pinnedElement) {
                    return;
                }
                if (!scrollElement) {
                    return;
                }

                const shouldTrackResizeState = !isMobile;
                const handleHeight = Math.round(event.currentTarget.getBoundingClientRect().height / scaleFactor);
                const maxAllowed = Math.round(scrollElement.scrollHeight + handleHeight);
                const minAllowed = Math.min(NAVIGATION_PANE_DIMENSIONS.pinnedShortcutsMinHeight, maxAllowed);
                const startMaxHeight = Math.min(Math.round(pinnedElement.getBoundingClientRect().height / scaleFactor), maxAllowed);
                const startY = event.clientY;
                let currentMaxHeight = startMaxHeight;

                event.preventDefault();
                event.stopPropagation();

                if (shouldTrackResizeState) {
                    setIsPinnedShortcutsResizing(true);
                }

                const clamp = (value: number) => Math.min(Math.max(value, minAllowed), maxAllowed);

                schedulePinnedShortcutsHeightUpdate(currentMaxHeight);

                startPointerDrag({
                    event,
                    onMove: (moveEvent: PointerEvent) => {
                        const deltaY = (moveEvent.clientY - startY) / scaleFactor;
                        currentMaxHeight = clamp(startMaxHeight + deltaY);
                        schedulePinnedShortcutsHeightUpdate(currentMaxHeight);
                    },
                    onEnd: () => {
                        if (pinnedShortcutsResizeFrameRef.current !== null) {
                            cancelAnimationFrame(pinnedShortcutsResizeFrameRef.current);
                            pinnedShortcutsResizeFrameRef.current = null;
                        }
                        const contentFitHeight = Math.round(scrollElement.scrollHeight + handleHeight);
                        if (currentMaxHeight >= contentFitHeight - 2) {
                            setPinnedShortcutsMaxHeight(null);
                            localStorage.remove(STORAGE_KEYS.pinnedShortcutsMaxHeightKey);
                        } else {
                            localStorage.set(STORAGE_KEYS.pinnedShortcutsMaxHeightKey, currentMaxHeight);
                            setPinnedShortcutsMaxHeight(currentMaxHeight);
                        }
                        if (shouldTrackResizeState) {
                            setIsPinnedShortcutsResizing(false);
                        }
                    }
                });
            },
            [isMobile, pinnedShortcutsScrollElement, scaleFactor, schedulePinnedShortcutsHeightUpdate, startPointerDrag]
        );
        /** Maps semi-transparent theme color variables to computed opaque equivalents (see constants/surfaceColorMappings). */
        const { color: navSurfaceColor, version: navSurfaceVersion } = useSurfaceColorVariables(navigationPaneRef, {
            app,
            rootContainerRef,
            variables: NAVIGATION_PANE_SURFACE_COLOR_MAPPINGS
        });
        const solidBackgroundCacheRef = useRef<Map<string, string | undefined>>(new Map());
        // Invalidates the solid background cache when surface color changes
        useEffect(() => {
            solidBackgroundCacheRef.current.clear();
        }, [navSurfaceColor, navSurfaceVersion]);

        // Extract included tag tokens from search filters for highlighting
        const searchIncludeTokens = useMemo(() => {
            const includeTokens = searchNavFilters?.tags.include;
            if (!includeTokens || includeTokens.length === 0) {
                return EMPTY_TAG_TOKENS;
            }
            return includeTokens;
        }, [searchNavFilters]);

        // Extract excluded tag tokens from search filters for highlighting
        const searchExcludeTokens = useMemo(() => {
            const excludeTokens = searchNavFilters?.tags.exclude;
            if (!excludeTokens || excludeTokens.length === 0) {
                return EMPTY_TAG_TOKENS;
            }
            return excludeTokens;
        }, [searchNavFilters]);

        // Flags indicating if untagged or tagged filters are active in search
        const highlightRequireTagged = searchNavFilters?.tags.requireTagged ?? false;
        const highlightExcludeTagged = searchNavFilters?.tags.excludeTagged ?? false;
        const highlightIncludeUntagged = searchNavFilters?.tags.includeUntagged ?? false;

        // Convert tag filter arrays to sets for faster membership checks while rendering
        const searchIncludeTokenSet = useMemo(() => {
            // Tags from search filters are normalized before tree-node comparisons.
            return buildNormalizedSearchTokenSet(searchIncludeTokens, foldSearchText);
        }, [searchIncludeTokens]);

        const searchExcludeTokenSet = useMemo(() => {
            // Excluded tag tokens use the same folded representation.
            return buildNormalizedSearchTokenSet(searchExcludeTokens, foldSearchText);
        }, [searchExcludeTokens]);
        const hasTagTokenSearchHighlights = searchIncludeTokenSet !== null || searchExcludeTokenSet !== null;

        const propertyIncludeTokenSet = useMemo(() => {
            // Property filters are normalized as property node IDs (`key:...` / `key:...=...`) in folded form.
            return buildNormalizedSearchTokenSet(searchNavFilters?.properties.include, normalizePropertyNodeIdForSearchMatch);
        }, [searchNavFilters]);

        const propertyExcludeTokenSet = useMemo(() => {
            // Excluded property filters share the same normalized node ID shape.
            return buildNormalizedSearchTokenSet(searchNavFilters?.properties.exclude, normalizePropertyNodeIdForSearchMatch);
        }, [searchNavFilters]);
        const hasPropertyTokenSearchHighlights = propertyIncludeTokenSet !== null || propertyExcludeTokenSet !== null;
        const foldedTagPathCacheRef = useRef<Map<string, string>>(new Map());
        const foldedPropertyNodeIdCacheRef = useRef<Map<string, string>>(new Map());

        const getFoldedTagPath = useCallback((tagPath: string): string => {
            const cached = foldedTagPathCacheRef.current.get(tagPath);
            if (cached !== undefined) {
                return cached;
            }

            // Fold once per distinct path rendered in the current highlight state.
            const normalizedTagPath = foldSearchText(tagPath);
            setBoundedFoldedSearchCacheEntry(foldedTagPathCacheRef.current, tagPath, normalizedTagPath);
            return normalizedTagPath;
        }, []);

        const getFoldedPropertyNodeId = useCallback((propertyNodeId: string): string => {
            const cached = foldedPropertyNodeIdCacheRef.current.get(propertyNodeId);
            if (cached !== undefined) {
                return cached;
            }

            // Parse/fold/rebuild once per distinct property node ID rendered in the current highlight state.
            const normalizedPropertyNodeId = normalizePropertyNodeIdForSearchMatch(propertyNodeId);
            setBoundedFoldedSearchCacheEntry(foldedPropertyNodeIdCacheRef.current, propertyNodeId, normalizedPropertyNodeId);
            return normalizedPropertyNodeId;
        }, []);

        useEffect(() => {
            // Search token sets changed; previous folded path cache no longer matches the active highlight context.
            foldedTagPathCacheRef.current.clear();
        }, [searchIncludeTokenSet, searchExcludeTokenSet]);

        useEffect(() => {
            // Property token sets changed; clear cached folded property IDs.
            foldedPropertyNodeIdCacheRef.current.clear();
        }, [propertyIncludeTokenSet, propertyExcludeTokenSet]);

        const menuServices = useMemo<MenuServices>(
            () => ({
                app,
                plugin,
                isMobile,
                fileSystemOps,
                metadataService,
                tagOperations,
                propertyOperations,
                tagTreeService,
                propertyTreeService,
                commandQueue,
                shortcuts,
                visibility: { includeDescendantNotes, showHiddenItems }
            }),
            [
                app,
                plugin,
                isMobile,
                fileSystemOps,
                metadataService,
                tagOperations,
                propertyOperations,
                tagTreeService,
                propertyTreeService,
                commandQueue,
                shortcuts,
                includeDescendantNotes,
                showHiddenItems
            ]
        );

        // Track which shortcut is currently active/selected
        const [activeShortcutKey, setActiveShortcut] = useState<string | null>(null);
        // Track expansion state of shortcuts virtual folder
        const [shortcutsExpanded, setShortcutsExpanded] = useState<boolean>(() => {
            const stored = localStorage.get<string>(STORAGE_KEYS.shortcutsExpandedKey);
            return stored !== '0';
        });
        const [isShortcutContextMenuOpen, setIsShortcutContextMenuOpen] = useState(false);
        // Track expansion state of recent notes virtual folder
        const [recentNotesExpanded, setRecentNotesExpanded] = useState<boolean>(() => {
            const stored = localStorage.get<string>(STORAGE_KEYS.recentNotesExpandedKey);
            if (stored === '1') {
                return true;
            }
            if (stored === '0') {
                return false;
            }
            return false;
        });
        // Manages the display order of navigation sections (folders vs tags)
        const [sectionOrder, setSectionOrder] = useState<NavigationSectionId[]>(() => {
            const stored = localStorage.get<unknown>(STORAGE_KEYS.navigationSectionOrderKey);
            return normalizeNavigationSectionOrderInput(stored);
        });
        // Tracks whether the folders section is expanded or collapsed
        const [foldersSectionExpanded, setFoldersSectionExpanded] = useState(true);
        // Tracks whether the tags section is expanded or collapsed
        const [tagsSectionExpanded, setTagsSectionExpanded] = useState(true);
        // Tracks whether the properties section is expanded or collapsed
        const [propertiesSectionExpanded, setPropertiesSectionExpanded] = useState(true);
        // Toggles the expanded state of the folders section
        const handleToggleFoldersSection = useCallback(() => {
            setFoldersSectionExpanded(prev => !prev);
        }, []);

        // Toggles the expanded state of the tags section
        const handleToggleTagsSection = useCallback(() => {
            setTagsSectionExpanded(prev => !prev);
        }, []);

        // Toggles the expanded state of the properties section
        const handleTogglePropertiesSection = useCallback(() => {
            setPropertiesSectionExpanded(prev => !prev);
        }, []);
        // Trigger for forcing a re-render when shortcut note metadata changes in frontmatter
        const [, forceMetadataRefresh] = useReducer((value: number) => value + 1, 0);
        const [isRootReorderMode, setRootReorderMode] = useState(false);
        const [activeShortcutId, setActiveShortcutId] = useState<string | null>(null);

        // Subscribe to metadata cache changes for shortcut notes when using frontmatter metadata
        // This ensures shortcut note display names update when frontmatter changes
        useEffect(() => {
            if (!settings.useFrontmatterMetadata) {
                return;
            }

            const metadataCache = app.metadataCache;
            // Build set of paths for all notes in shortcuts
            const relevantNotePaths = new Set(
                hydratedShortcuts.map(entry => entry.note?.path).filter((path): path is string => Boolean(path))
            );

            if (relevantNotePaths.size === 0) {
                return;
            }

            // Trigger refresh when metadata cache is fully resolved
            const handleResolved = () => {
                forceMetadataRefresh();
            };

            // Trigger refresh when a shortcut note's metadata changes
            const handleChanged = (file: TFile) => {
                if (relevantNotePaths.has(file.path)) {
                    forceMetadataRefresh();
                }
            };

            const resolvedRef = metadataCache.on('resolved', handleResolved);
            const changedRef = metadataCache.on('changed', file => {
                if (file instanceof TFile) {
                    handleChanged(file);
                }
            });

            return () => {
                metadataCache.offref(resolvedRef);
                metadataCache.offref(changedRef);
            };
        }, [app.metadataCache, hydratedShortcuts, settings.useFrontmatterMetadata, forceMetadataRefresh]);

        // Determine if drag and drop should be enabled for shortcuts
        const shortcutCount = hydratedShortcuts.length;
        const isShortcutDnDEnabled = shortcutsExpanded && shortcutCount > 0 && settings.showShortcuts;
        const shortcutIds = useMemo(() => hydratedShortcuts.map(entry => entry.key), [hydratedShortcuts]);
        const shortcutSensors = useSensors(useSensor(PointerSensor, { activationConstraint: SHORTCUT_POINTER_CONSTRAINT }));
        const shouldUseShortcutDnd = isShortcutDnDEnabled && shortcutIds.length > 1 && !isRootReorderMode && !isShortcutContextMenuOpen;
        const isShortcutSorting = shouldUseShortcutDnd && Boolean(activeShortcutId);

        // Show drag handles on mobile when drag and drop is enabled
        const showShortcutDragHandles = isMobile && isShortcutDnDEnabled;

        const shortcutDragHandleConfig = useMemo(() => {
            if (!showShortcutDragHandles) {
                return undefined;
            }
            return {
                visible: true,
                only: true
            } as const;
        }, [showShortcutDragHandles]);

        // Map shortcut keys to their position in the list for efficient lookups
        const shortcutPositionMap = useMemo(() => {
            const map = new Map<string, number>();
            hydratedShortcuts.forEach((entry, index) => {
                map.set(entry.key, index);
            });
            return map;
        }, [hydratedShortcuts]);

        const handleShortcutDragStart = useCallback((event: DragStartEvent) => {
            setActiveShortcutId(event.active.id as string);
        }, []);

        const handleShortcutDragEnd = useCallback(
            (event: DragEndEvent) => {
                const activeId = event.active.id as string;
                const overId = event.over?.id as string | undefined;
                setActiveShortcutId(null);

                if (!overId || activeId === overId) {
                    return;
                }

                const oldIndex = shortcutIds.indexOf(activeId);
                const newIndex = shortcutIds.indexOf(overId);
                if (oldIndex === -1 || newIndex === -1) {
                    return;
                }

                const nextOrder = arrayMove(shortcutIds, oldIndex, newIndex);
                runAsyncAction(async () => {
                    await reorderShortcuts(nextOrder);
                });
            },
            [reorderShortcuts, shortcutIds]
        );

        const handleShortcutDragCancel = useCallback(() => {
            setActiveShortcutId(null);
        }, []);

        // Calculates the insertion index for dropped shortcuts based on drop position
        const computeShortcutInsertIndex = useCallback(
            (event: React.DragEvent<HTMLElement> | DragEvent, key: string) => {
                const shortcutIndex = shortcutPositionMap.get(key);
                if (shortcutIndex === undefined) {
                    return hydratedShortcuts.length;
                }

                const element = event.currentTarget;
                if (!(element instanceof HTMLElement)) {
                    return shortcutIndex;
                }

                const bounds = element.getBoundingClientRect();
                const offset = event.clientY - bounds.top;
                const shouldInsertBefore = offset < bounds.height / 2;
                return shouldInsertBefore ? shortcutIndex : shortcutIndex + 1;
            },
            [hydratedShortcuts.length, shortcutPositionMap]
        );

        // Unique key for the root shortcuts virtual folder to enable drop on empty shortcuts list
        const shortcutRootDropKey = '__shortcuts-root__';

        const handleShortcutDragOver = useCallback(
            (event: React.DragEvent<HTMLElement> | DragEvent) => {
                const { dataTransfer } = event;
                if (!dataTransfer) {
                    return false;
                }

                if (!shortcutsExpanded || !settings.showShortcuts) {
                    return false;
                }

                const types = Array.from(dataTransfer.types ?? []);
                if (types.includes(SHORTCUT_DRAG_MIME)) {
                    return false;
                }

                const hasObsidianFiles = types.includes('obsidian/file') || types.includes('obsidian/files');
                const hasTagPayload = types.includes(TAG_DRAG_MIME);
                const hasPropertyPayload = types.includes(PROPERTY_DRAG_MIME);
                if (!hasObsidianFiles && !hasTagPayload && !hasPropertyPayload) {
                    return false;
                }

                event.preventDefault();
                dataTransfer.dropEffect = 'copy';
                return true;
            },
            [shortcutsExpanded, settings.showShortcuts]
        );

        const handleShortcutDrop = useCallback(
            (event: React.DragEvent<HTMLElement> | DragEvent, key: string) => {
                const { dataTransfer } = event;
                if (!dataTransfer) {
                    return false;
                }

                if (!shortcutsExpanded || !settings.showShortcuts) {
                    return false;
                }

                const types = Array.from(dataTransfer.types ?? []);
                if (types.includes(SHORTCUT_DRAG_MIME)) {
                    return false;
                }

                const tagPayloadRaw = dataTransfer.getData(TAG_DRAG_MIME);
                if (tagPayloadRaw) {
                    const droppedTagPath = parseTagDragPayload(tagPayloadRaw);
                    if (droppedTagPath) {
                        event.preventDefault();
                        event.stopPropagation();

                        const baseInsertIndex = computeShortcutInsertIndex(event, key);
                        runAsyncAction(async () => {
                            await addTagShortcut(droppedTagPath, { index: Math.max(0, baseInsertIndex) });
                        });

                        return true;
                    }
                }

                const propertyPayloadRaw = dataTransfer.getData(PROPERTY_DRAG_MIME);
                if (propertyPayloadRaw) {
                    const droppedNodeId = parsePropertyDragPayload(propertyPayloadRaw);
                    if (droppedNodeId) {
                        event.preventDefault();
                        event.stopPropagation();

                        const baseInsertIndex = computeShortcutInsertIndex(event, key);
                        runAsyncAction(async () => {
                            await addPropertyShortcut(droppedNodeId, { index: Math.max(0, baseInsertIndex) });
                        });

                        return true;
                    }
                }

                const rawPaths = extractFilePathsFromDataTransfer(dataTransfer);
                if (!rawPaths) {
                    return false;
                }
                if (rawPaths.length === 0) {
                    return false;
                }

                const seen = new Set<string>();
                const orderedPaths = rawPaths.filter(path => {
                    if (seen.has(path)) {
                        return false;
                    }
                    seen.add(path);
                    return true;
                });

                if (orderedPaths.length === 0) {
                    return false;
                }

                // Track valid additions and count duplicates
                const additions: ShortcutEntry[] = [];
                let duplicateFolderCount = 0;
                let duplicateNoteCount = 0;
                orderedPaths.forEach(path => {
                    const target = app.vault.getAbstractFileByPath(path);
                    if (target instanceof TFolder) {
                        // Skip root folder
                        if (target.path === '/') {
                            return;
                        }
                        if (hasFolderShortcut(target.path)) {
                            duplicateFolderCount += 1;
                            return;
                        }
                        additions.push({ type: ShortcutType.FOLDER, path: target.path });
                    } else if (target instanceof TFile) {
                        if (hasNoteShortcut(target.path)) {
                            duplicateNoteCount += 1;
                            return;
                        }
                        additions.push({ type: ShortcutType.NOTE, path: target.path });
                    }
                });

                // Notify user of duplicate shortcuts
                if (duplicateFolderCount > 0) {
                    showNotice(strings.shortcuts.folderExists, { variant: 'warning' });
                }
                if (duplicateNoteCount > 0) {
                    showNotice(strings.shortcuts.noteExists, { variant: 'warning' });
                }

                if (additions.length === 0) {
                    return false;
                }

                event.preventDefault();
                event.stopPropagation();

                const baseInsertIndex = computeShortcutInsertIndex(event, key);

                runAsyncAction(async () => {
                    await addShortcutsBatch(additions, { index: Math.max(0, baseInsertIndex) });
                });

                return true;
            },
            [
                addShortcutsBatch,
                addTagShortcut,
                addPropertyShortcut,
                app.vault,
                computeShortcutInsertIndex,
                shortcutsExpanded,
                settings.showShortcuts,
                hasFolderShortcut,
                hasNoteShortcut
            ]
        );

        // Allow dragging files/folders onto empty shortcuts list when shortcuts are shown and expanded
        const allowEmptyShortcutDrop = shortcutsExpanded && settings.showShortcuts && hydratedShortcuts.length === 0;

        // Handles drag over events on the shortcuts virtual folder root when the list is empty
        const handleShortcutRootDragOver = useCallback(
            (event: React.DragEvent<HTMLElement>) => {
                if (!allowEmptyShortcutDrop) {
                    return;
                }
                handleShortcutDragOver(event);
            },
            [allowEmptyShortcutDrop, handleShortcutDragOver]
        );

        // Handles drop events on the shortcuts virtual folder root when the list is empty
        const handleShortcutRootDrop = useCallback(
            (event: React.DragEvent<HTMLElement>) => {
                if (!allowEmptyShortcutDrop) {
                    return;
                }
                handleShortcutDrop(event, shortcutRootDropKey);
            },
            [allowEmptyShortcutDrop, handleShortcutDrop, shortcutRootDropKey]
        );

        // Builds drag handlers for external drops onto shortcut items (files, folders, tags from outside)
        const buildShortcutExternalHandlers = useCallback(
            (key: string): ListReorderHandlers => ({
                onDragOver: event => {
                    handleShortcutDragOver(event);
                },
                onDrop: event => {
                    handleShortcutDrop(event, key);
                }
            }),
            [handleShortcutDragOver, handleShortcutDrop]
        );

        // Track previous settings for smart auto-expand
        const prevShowAllTagsFolder = useRef(settings.showAllTagsFolder);
        const expandedTagsRef = useRef(expansionState.expandedTags);
        const expandedPropertiesRef = useRef(expansionState.expandedProperties);

        // Determine if navigation pane is visible early for optimization
        const isVisible = uiState.dualPane || uiState.currentSinglePaneView === 'navigation';

        // Get tag tree from file data cache
        const tagTree = fileData.tagTree;
        const propertyTree = fileData.propertyTree;

        useEffect(() => {
            expandedTagsRef.current = expansionState.expandedTags;
        }, [expansionState.expandedTags]);

        useEffect(() => {
            expandedPropertiesRef.current = expansionState.expandedProperties;
        }, [expansionState.expandedProperties]);

        useEffect(() => {
            if (!isStorageReady) {
                return;
            }

            const shouldCleanupTags = expandedTagsRef.current.size > 0;
            const shouldCleanupProperties = expandedPropertiesRef.current.size > 0;
            if (!shouldCleanupTags && !shouldCleanupProperties) {
                return;
            }

            const existingTags = shouldCleanupTags ? new Set<string>() : null;
            const existingPropertyNodeIds = shouldCleanupProperties ? new Set<string>() : null;

            if (existingTags && tagTree) {
                const visitedTagNodes = new Set<TagTreeNode>();
                tagTree.forEach(rootTagNode => {
                    collectAllTagPaths(rootTagNode, existingTags, visitedTagNodes);
                });
            }

            if (existingPropertyNodeIds && propertyTree) {
                propertyTree.forEach(keyNode => {
                    existingPropertyNodeIds.add(keyNode.id);
                    keyNode.children.forEach(valueNode => {
                        existingPropertyNodeIds.add(valueNode.id);
                    });
                });
            }

            if (existingTags) {
                expansionDispatch({ type: 'CLEANUP_DELETED_TAGS', existingTags });
            }

            if (existingPropertyNodeIds) {
                expansionDispatch({ type: 'CLEANUP_DELETED_PROPERTIES', existingPropertyNodeIds });
            }
        }, [expansionDispatch, isStorageReady, propertyTree, tagTree]);

        // Use the new data hook - now returns filtered items and pathToIndex
        // Determine if shortcuts should be pinned based on UI state and settings
        const shouldPinShortcuts = uiState.pinShortcuts && settings.showShortcuts;

        const {
            items,
            firstSectionId,
            firstInlineFolderPath,
            shortcutItems,
            pinnedRecentNotesItems,
            shouldPinRecentNotes,
            tagsVirtualFolderHasChildren,
            propertiesSectionActive,
            pathToIndex,
            tagCounts,
            propertyCounts,
            folderCounts,
            rootLevelFolders,
            missingRootFolderPaths,
            resolvedRootTagKeys,
            rootOrderingTagTree,
            missingRootTagPaths,
            resolvedRootPropertyKeys,
            rootOrderingPropertyTree,
            missingRootPropertyKeys,
            vaultChangeVersion,
            navigationBannerPath
        } = useNavigationPaneData({
            settings,
            activeProfile,
            isVisible,
            shortcutsExpanded,
            recentNotesExpanded,
            pinShortcuts: shouldPinShortcuts,
            sectionOrder
        });

        const indentGuideLevelsByKey = useMemo(
            () => (settings.showIndentGuides ? buildIndentGuideLevelsMap(items) : EMPTY_INDENT_GUIDE_MAP),
            [items, settings.showIndentGuides]
        );

        // Extract shortcut items to display in pinned area when pinning is enabled
        const pinnedNavigationItems = useMemo(() => {
            const pinnedShortcutItems = shouldPinShortcuts ? shortcutItems : [];
            const pinnedRecentItems = shouldPinRecentNotes ? pinnedRecentNotesItems : [];
            const pinnedNavigationOrder = normalizeNavigationSectionOrderInput(sectionOrder);

            const ordered: CombinedNavigationItem[] = [];
            pinnedNavigationOrder.forEach(sectionId => {
                if (sectionId === NavigationSectionId.RECENT && shouldPinRecentNotes) {
                    ordered.push(...pinnedRecentItems);
                }
                if (sectionId === NavigationSectionId.SHORTCUTS && shouldPinShortcuts) {
                    ordered.push(...pinnedShortcutItems);
                }
            });
            return ordered;
        }, [pinnedRecentNotesItems, sectionOrder, shortcutItems, shouldPinRecentNotes, shouldPinShortcuts]);
        const shouldRenderNavigationBanner = Boolean(navigationBannerPath && !isRootReorderMode);
        const navigationBannerContent =
            shouldRenderNavigationBanner && navigationBannerPath ? <NavigationBanner path={navigationBannerPath} /> : null;
        // Pinned shortcuts are shown in normal navigation mode (but hidden during reorder mode).
        const shouldRenderPinnedShortcuts = pinnedNavigationItems.length > 0 && !isRootReorderMode;

        // Recalculates overflow when pinned items or banner visibility changes
        useLayoutEffect(() => {
            updatePinnedShortcutsOverflow(pinnedShortcutsScrollElement);
        }, [pinnedNavigationItems, pinnedShortcutsScrollElement, updatePinnedShortcutsOverflow]);

        // When the navigation banner is not pinned, it is rendered above the tree as normal scroll content.
        // Its height must be included in the TanStack Virtual scrollMargin so item positions match scrollTop.
        const navigationBannerHeight = useMeasuredElementHeight(navigationBannerRef, {
            enabled: Boolean(navigationBannerContent) && !settings.pinNavigationBanner
        });
        const navigationScrollMargin = navigationBannerHeight;

        // We only reserve gutter space when a banner exists because Windows scrollbars
        // change container width by ~7px when they appear. That width change used to
        // feed back into the virtualizer via ResizeObserver and trigger infinite reflows.
        const hasNavigationBannerConfigured = Boolean(navigationBannerPath);

        const shouldIncludeRecentInPinLabel = settings.pinRecentNotesWithShortcuts && settings.showRecentNotes;
        const useRecentFilesLabel = fileVisibility !== FILE_VISIBILITY.DOCUMENTS;
        const pinShortcutsLabel = shouldIncludeRecentInPinLabel
            ? useRecentFilesLabel
                ? strings.navigationPane.pinShortcutsAndRecentFiles
                : strings.navigationPane.pinShortcutsAndRecentNotes
            : strings.navigationPane.pinShortcuts;
        const unpinShortcutsLabel = shouldIncludeRecentInPinLabel
            ? useRecentFilesLabel
                ? strings.navigationPane.unpinShortcutsAndRecentFiles
                : strings.navigationPane.unpinShortcutsAndRecentNotes
            : strings.navigationPane.unpinShortcuts;
        const pinToggleLabel = uiState.pinShortcuts ? unpinShortcutsLabel : pinShortcutsLabel;

        const {
            reorderableRootFolders,
            reorderableRootTags,
            reorderableRootProperties,
            sectionReorderItems,
            folderReorderItems,
            tagReorderItems,
            propertyReorderItems,
            canReorderSections,
            canReorderRootFolders,
            canReorderRootTags,
            canReorderRootProperties,
            canReorderRootItems,
            showRootFolderSection,
            showRootTagSection,
            showRootPropertySection,
            resetRootTagOrderLabel,
            resetRootPropertyOrderLabel,
            handleResetRootFolderOrder,
            handleResetRootTagOrder,
            handleResetRootPropertyOrder,
            reorderSectionOrder,
            reorderRootFolderOrder,
            reorderRootTagOrder,
            reorderRootPropertyOrder
        } = useNavigationRootReorder({
            app,
            items,
            settings,
            showHiddenItems,
            updateSettings,
            sectionOrder,
            setSectionOrder,
            rootLevelFolders,
            missingRootFolderPaths,
            resolvedRootTagKeys,
            rootOrderingTagTree,
            missingRootTagPaths,
            resolvedRootPropertyKeys,
            rootOrderingPropertyTree,
            missingRootPropertyKeys,
            metadataService,
            foldersSectionExpanded,
            tagsSectionExpanded,
            propertiesSectionExpanded,
            propertiesSectionActive,
            handleToggleFoldersSection,
            handleToggleTagsSection,
            handleTogglePropertiesSection,
            activeProfile
        });

        useEffect(() => {
            if (isRootReorderMode && !canReorderRootItems) {
                setRootReorderMode(false);
            }
        }, [isRootReorderMode, canReorderRootItems]);

        // Toggle root folder reorder mode on/off
        const handleToggleRootReorder = useCallback(() => {
            if (!canReorderRootItems) {
                return;
            }
            setRootReorderMode(prev => !prev);
        }, [canReorderRootItems]);

        const isIosObsidian111Plus = Platform.isIosApp && requireApiVersion('1.11.0');
        const shouldUseFloatingToolbars = isIosObsidian111Plus && settings.useFloatingToolbars;
        const scrollPaddingEnd = useMemo(() => {
            if (!shouldUseFloatingToolbars || !isMobile || isAndroid) {
                return 0;
            }

            // Keep in sync with `--nn-ios-pane-bottom-overlay-height` in `src/styles/sections/platform-ios-obsidian-1-11.css`.
            // The calendar overlay is outside the scroller, so it is intentionally not included here.
            return IOS_OBSIDIAN_1_11_PLUS_GLASS_TOOLBAR_HEIGHT_PX;
        }, [isAndroid, isMobile, shouldUseFloatingToolbars]);

        const { rowVirtualizer, scrollContainerRef, scrollContainerRefCallback, requestScroll } = useNavigationPaneScroll({
            items,
            pathToIndex,
            isVisible,
            activeShortcutKey,
            scrollMargin: navigationScrollMargin,
            scrollPaddingEnd
        });

        /** Converts a potentially transparent background color into a solid color by compositing with the pane surface. */
        const getSolidBackground = useCallback(
            (color?: string | null) => {
                if (!color) {
                    return undefined;
                }
                const trimmed = color.trim();
                if (!trimmed) {
                    return undefined;
                }
                const cache = solidBackgroundCacheRef.current;
                if (cache.has(trimmed)) {
                    return cache.get(trimmed);
                }
                const pane = navigationPaneRef.current;
                const solidColor = compositeWithBase(navSurfaceColor, trimmed, { container: pane ?? null });
                cache.set(trimmed, solidColor);
                return solidColor;
            },
            [navSurfaceColor]
        );

        useEffect(() => {
            if (isRootReorderMode) {
                return;
            }
            rowVirtualizer.measure();
        }, [
            isRootReorderMode,
            rowVirtualizer,
            sectionOrder,
            reorderableRootFolders,
            reorderableRootTags,
            reorderableRootProperties,
            navigationScrollMargin
        ]);

        // Scroll to top when entering root reorder mode for better UX
        useEffect(() => {
            if (!isRootReorderMode) {
                return;
            }

            rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });

            const scroller = scrollContainerRef.current;
            if (scroller) {
                scroller.scrollTo({ top: 0, behavior: 'auto' });
            }
        }, [isRootReorderMode, rowVirtualizer, scrollContainerRef]);

        // Callback for after expand/collapse operations
        const handleTreeUpdateComplete = useCallback(() => {
            const selectedPath = getSelectedPath(selectionState);
            if (selectedPath) {
                const itemType =
                    selectionState.selectionType === ItemType.TAG
                        ? ItemType.TAG
                        : selectionState.selectionType === ItemType.PROPERTY
                          ? ItemType.PROPERTY
                          : ItemType.FOLDER;
                const normalizedPath = normalizeNavigationPath(itemType, selectedPath);
                requestScroll(normalizedPath, { align: 'auto', itemType });
            }
        }, [selectionState, requestScroll]);

        const prevCalendarOverlayVisibleRef = useRef<boolean>(shouldRenderCalendarOverlay);
        const prevCalendarWeekCountRef = useRef<number>(calendarWeekCount);

        useEffect(() => {
            const wasVisible = prevCalendarOverlayVisibleRef.current;
            const prevWeekCount = prevCalendarWeekCountRef.current;

            const becameVisible = shouldRenderCalendarOverlay && !wasVisible;
            const weekCountChanged = shouldRenderCalendarOverlay && calendarWeekCount !== prevWeekCount;

            prevCalendarOverlayVisibleRef.current = shouldRenderCalendarOverlay;
            prevCalendarWeekCountRef.current = calendarWeekCount;

            if (!becameVisible && !weekCountChanged) {
                return;
            }

            const scheduleScroll = () => handleTreeUpdateComplete();

            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    requestAnimationFrame(scheduleScroll);
                });
                return;
            }

            setTimeout(scheduleScroll, 0);
        }, [calendarWeekCount, handleTreeUpdateComplete, shouldRenderCalendarOverlay]);

        // Handle folder toggle
        const handleFolderToggle = useCallback(
            (path: string) => {
                expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: path });
            },
            [expansionDispatch]
        );

        // Handle folder click
        const handleFolderClick = useCallback(
            (folder: TFolder, options?: { fromShortcut?: boolean }) => {
                if (!options?.fromShortcut) {
                    setActiveShortcut(null);
                }

                // Auto-expand behavior in single-pane mode:
                // When autoExpandNavItems is enabled:
                //   1. First click on a collapsed folder with children → Expands it, stays in navigation pane
                //   2. Second click (now expanded) or click on folder without children → Shows files pane
                // When autoExpandNavItems is disabled:
                //   - Click always shows files pane immediately
                const hasChildFolders = folder.children.some(child => child instanceof TFolder);
                const isExpanded = expansionState.expandedFolders.has(folder.path);
                const isSelectedFolder =
                    selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder?.path === folder.path;
                const shouldCollapseOnSelect =
                    settings.autoExpandNavItems && !uiState.singlePane && hasChildFolders && isExpanded && isSelectedFolder;
                const shouldExpandOnly = uiState.singlePane && settings.autoExpandNavItems && hasChildFolders && !isExpanded;

                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder });

                if (shouldCollapseOnSelect) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    return;
                }

                // Expand collapsed folder when auto-expand is enabled
                if (settings.autoExpandNavItems && hasChildFolders && !isExpanded) {
                    expansionDispatch({ type: 'TOGGLE_FOLDER_EXPANDED', folderPath: folder.path });
                }

                // In single-pane mode: either expand-only or show files
                if (uiState.singlePane) {
                    if (shouldExpandOnly) {
                        // First click on collapsed folder: expand and stay in navigation pane
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    } else {
                        // Second click or folder without children: show files pane
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    }
                } else {
                    // In dual-pane mode: always stay focused on navigation
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                }
            },
            [
                selectionDispatch,
                uiDispatch,
                uiState.singlePane,
                settings.autoExpandNavItems,
                expansionDispatch,
                setActiveShortcut,
                expansionState.expandedFolders,
                selectionState.selectionType,
                selectionState.selectedFolder?.path
            ]
        );

        // Handle folder name click (for folder notes)
        const handleFolderNameClick = useCallback(
            (folder: TFolder, event?: React.MouseEvent<HTMLSpanElement>) => {
                if (!settings.enableFolderNotes || !settings.enableFolderNoteLinks) {
                    handleFolderClick(folder);
                    return;
                }

                const folderNote = getFolderNote(folder, settings);
                if (!folderNote) {
                    handleFolderClick(folder);
                    return;
                }

                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder, autoSelectedFile: null });

                // Uses the same click-to-open rules as list pane header/title folder note links.
                const openContext = event
                    ? resolveFolderNoteClickOpenContext(event, settings.openFolderNotesInNewTab, settings.multiSelectModifier, isMobile)
                    : settings.openFolderNotesInNewTab
                      ? 'tab'
                      : null;

                runAsyncAction(() => openFolderNoteFile({ app, commandQueue, folder, folderNote, context: openContext }));
            },
            [settings, handleFolderClick, selectionDispatch, isMobile, app, commandQueue]
        );

        const handleFolderNameMouseDown = useCallback(
            (folder: TFolder, event: React.MouseEvent<HTMLSpanElement>) => {
                if (event.button !== 1 || !settings.enableFolderNotes || !settings.enableFolderNoteLinks) {
                    return;
                }

                const folderNote = getFolderNote(folder, settings);
                if (!folderNote) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder, autoSelectedFile: null });

                runAsyncAction(() => openFolderNoteFile({ app, commandQueue, folder, folderNote, context: 'tab' }));
            },
            [settings, selectionDispatch, app, commandQueue]
        );

        // Handle tag toggle
        const handleTagToggle = useCallback(
            (path: string) => {
                expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: path });
            },
            [expansionDispatch]
        );

        const handlePropertyToggle = useCallback(
            (nodeId: string) => {
                expansionDispatch({ type: 'TOGGLE_PROPERTY_EXPANDED', propertyNodeId: nodeId });
            },
            [expansionDispatch]
        );

        // Handle virtual folder toggle
        const handleVirtualFolderToggle = useCallback(
            (folderId: string) => {
                if (folderId === SHORTCUTS_VIRTUAL_FOLDER_ID) {
                    setShortcutsExpanded(prev => {
                        const next = !prev;
                        localStorage.set(STORAGE_KEYS.shortcutsExpandedKey, next ? '1' : '0');
                        return next;
                    });
                    return;
                }
                if (folderId === RECENT_NOTES_VIRTUAL_FOLDER_ID) {
                    setRecentNotesExpanded(prev => {
                        const next = !prev;
                        localStorage.set(STORAGE_KEYS.recentNotesExpandedKey, next ? '1' : '0');
                        return next;
                    });
                    return;
                }
                expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId });
            },
            [expansionDispatch, setRecentNotesExpanded, setShortcutsExpanded]
        );

        // Recursively collects all descendant folder paths from a given folder
        const getAllDescendantFolders = useCallback((folder: TFolder): string[] => {
            const descendants: string[] = [];

            const collectDescendants = (currentFolder: TFolder) => {
                currentFolder.children.forEach(child => {
                    if (child instanceof TFolder) {
                        descendants.push(child.path);
                        collectDescendants(child);
                    }
                });
            };

            collectDescendants(folder);
            return descendants;
        }, []);

        // Recursively collects all descendant tag paths from a given tag
        const getAllDescendantTags = useCallback(
            (tagPath: string): string[] => {
                if (tagTreeService) {
                    return Array.from(tagTreeService.collectDescendantTagPaths(tagPath));
                }

                const descendants: string[] = [];
                const tagNode = findTagNode(tagTree, tagPath);

                if (!tagNode) {
                    return descendants;
                }

                const collectDescendants = (node: TagTreeNode) => {
                    node.children.forEach(child => {
                        descendants.push(child.path);
                        collectDescendants(child);
                    });
                };

                collectDescendants(tagNode);
                return descendants;
            },
            [tagTree, tagTreeService]
        );

        const getAllDescendantPropertyNodeIds = useCallback(
            (propertyNode: PropertyTreeNode): string[] => {
                if (propertyTreeService) {
                    return Array.from(propertyTreeService.collectDescendantNodeIds(propertyNode.id));
                }

                const descendants: string[] = [];
                const collectDescendants = (node: PropertyTreeNode) => {
                    node.children.forEach(child => {
                        descendants.push(child.id);
                        collectDescendants(child);
                    });
                };
                collectDescendants(propertyNode);
                return descendants;
            },
            [propertyTreeService]
        );

        const focusAfterTreeSelection = useCallback(
            (keepNavigationFocus: boolean) => {
                if (uiState.singlePane) {
                    if (keepNavigationFocus) {
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    } else {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                    }
                    return;
                }

                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
            },
            [uiDispatch, uiState.singlePane]
        );

        const applyTreeSelection = useCallback(
            (params: {
                hasChildren: boolean;
                isExpanded: boolean;
                isSelected: boolean;
                fromShortcut?: boolean;
                onSelect: () => void;
                onToggleExpand: () => void;
            }) => {
                const { hasChildren, isExpanded, isSelected, fromShortcut, onSelect, onToggleExpand } = params;

                if (!fromShortcut) {
                    setActiveShortcut(null);
                }

                onSelect();

                const shouldCollapseOnSelect =
                    settings.autoExpandNavItems && !uiState.singlePane && hasChildren && isExpanded && isSelected;
                if (shouldCollapseOnSelect) {
                    onToggleExpand();
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    return;
                }

                const shouldExpandOnly = uiState.singlePane && settings.autoExpandNavItems && hasChildren && !isExpanded;
                if (settings.autoExpandNavItems && hasChildren && !isExpanded) {
                    onToggleExpand();
                }

                focusAfterTreeSelection(shouldExpandOnly);
            },
            [focusAfterTreeSelection, setActiveShortcut, settings.autoExpandNavItems, uiDispatch, uiState.singlePane]
        );

        // Handle tag click
        const handleTagClick = useCallback(
            (tagPath: string, event?: React.MouseEvent, options?: { fromShortcut?: boolean }) => {
                const tagNode = findTagNode(tagTree, tagPath);
                const canonicalPath = resolveCanonicalTagPath(tagPath, tagTree);
                if (!canonicalPath) {
                    return;
                }

                const isVirtualCollection = isVirtualTagCollectionId(canonicalPath);
                const operator = getTagSearchModifierOperator(event ?? null, settings.multiSelectModifier, isMobile);
                if (operator && !isVirtualCollection && canonicalPath !== UNTAGGED_TAG_ID) {
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    onModifySearchWithTag(canonicalPath, operator);
                    return;
                }

                const isVirtualTagRoot = settings.showAllTagsFolder && canonicalPath === TAGGED_TAG_ID;
                const isExpanded = isVirtualTagRoot
                    ? expansionState.expandedVirtualFolders.has(TAGS_ROOT_VIRTUAL_FOLDER_ID)
                    : Boolean(tagNode && expansionState.expandedTags.has(tagNode.path));
                const isSelectedTag = selectionState.selectionType === ItemType.TAG && selectionState.selectedTag === canonicalPath;
                const hasChildren = isVirtualTagRoot ? tagsVirtualFolderHasChildren : Boolean(tagNode && tagNode.children.size > 0);
                applyTreeSelection({
                    hasChildren,
                    isExpanded,
                    isSelected: isSelectedTag,
                    fromShortcut: options?.fromShortcut,
                    onSelect: () => {
                        selectionDispatch({ type: 'SET_SELECTED_TAG', tag: canonicalPath });
                    },
                    onToggleExpand: () => {
                        if (isVirtualTagRoot) {
                            expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId: TAGS_ROOT_VIRTUAL_FOLDER_ID });
                        } else if (tagNode) {
                            expansionDispatch({ type: 'TOGGLE_TAG_EXPANDED', tagPath: tagNode.path });
                        }
                    }
                });
            },
            [
                applyTreeSelection,
                selectionDispatch,
                tagTree,
                expansionDispatch,
                expansionState.expandedTags,
                selectionState.selectedTag,
                selectionState.selectionType,
                onModifySearchWithTag,
                isMobile,
                settings.multiSelectModifier,
                settings.showAllTagsFolder,
                tagsVirtualFolderHasChildren,
                expansionState.expandedVirtualFolders
            ]
        );

        // Forward tag collection clicks to the main tag click handler
        const handleTagCollectionClick = useCallback(
            (tagCollectionId: string, event: React.MouseEvent<HTMLDivElement>) => {
                handleTagClick(tagCollectionId, event);
            },
            [handleTagClick]
        );

        const handlePropertyCollectionClick = useCallback(
            (event: React.MouseEvent<HTMLDivElement>) => {
                void event;

                const rootId = PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
                const selectedPropertyNodeId = selectionState.selectionType === ItemType.PROPERTY ? selectionState.selectedProperty : null;

                applyTreeSelection({
                    hasChildren: propertyTree.size > 0,
                    isExpanded: expansionState.expandedVirtualFolders.has(rootId),
                    isSelected: selectedPropertyNodeId === rootId,
                    onSelect: () => {
                        selectionDispatch({
                            type: 'SET_SELECTED_PROPERTY',
                            nodeId: rootId
                        });
                    },
                    onToggleExpand: () => {
                        handleVirtualFolderToggle(rootId);
                    }
                });
            },
            [
                applyTreeSelection,
                expansionState.expandedVirtualFolders,
                handleVirtualFolderToggle,
                propertyTree,
                selectionDispatch,
                selectionState.selectedProperty,
                selectionState.selectionType
            ]
        );

        const handlePropertyClick = useCallback(
            (propertyNode: PropertyTreeNode, event?: React.MouseEvent, options?: { fromShortcut?: boolean }) => {
                const operator = getTagSearchModifierOperator(event ?? null, settings.multiSelectModifier, isMobile);
                if (operator) {
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    const valuePath = propertyNode.kind === 'value' && propertyNode.valuePath ? propertyNode.valuePath : null;
                    onModifySearchWithProperty(propertyNode.key, valuePath, operator);
                    return;
                }

                const hasChildren = propertyNode.children.size > 0;
                const isExpanded = expansionState.expandedProperties.has(propertyNode.id);
                const selectedPropertyNodeId = selectionState.selectionType === ItemType.PROPERTY ? selectionState.selectedProperty : null;
                applyTreeSelection({
                    hasChildren,
                    isExpanded,
                    isSelected: selectedPropertyNodeId === propertyNode.id,
                    fromShortcut: options?.fromShortcut,
                    onSelect: () => {
                        selectionDispatch({
                            type: 'SET_SELECTED_PROPERTY',
                            nodeId: propertyNode.id,
                            source: options?.fromShortcut ? 'shortcut' : undefined
                        });
                    },
                    onToggleExpand: () => {
                        expansionDispatch({ type: 'TOGGLE_PROPERTY_EXPANDED', propertyNodeId: propertyNode.id });
                    }
                });
            },
            [
                applyTreeSelection,
                expansionDispatch,
                expansionState.expandedProperties,
                isMobile,
                onModifySearchWithProperty,
                selectionDispatch,
                selectionState.selectedProperty,
                selectionState.selectionType,
                settings.multiSelectModifier
            ]
        );

        // Toggles shortcuts between pinned (always visible) and inline (in main list) display
        const handleShortcutSplitToggle = useCallback(() => {
            uiDispatch({ type: 'SET_PIN_SHORTCUTS', value: !uiState.pinShortcuts });
        }, [uiDispatch, uiState.pinShortcuts]);

        // Clears active shortcut after two animation frames to allow visual feedback
        const scheduleShortcutRelease = useCallback(() => {
            const release = () => setActiveShortcut(null);

            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    requestAnimationFrame(release);
                });
                return;
            }

            setTimeout(release, 0);
        }, [setActiveShortcut]);

        // Handles folder shortcut activation - navigates to folder and provides visual feedback
        const handleShortcutFolderActivate = useCallback(
            (folder: TFolder, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                onNavigateToFolder(folder.path, { skipScroll: settings.skipAutoScroll, source: 'shortcut' });
                scheduleShortcutRelease();
                const container = rootContainerRef.current;
                if (container && !uiState.singlePane) {
                    container.focus();
                }
            },
            [setActiveShortcut, onNavigateToFolder, scheduleShortcutRelease, rootContainerRef, uiState.singlePane, settings.skipAutoScroll]
        );

        // Opens folder note when clicking on a shortcut label with an associated folder note
        const handleShortcutFolderNoteClick = useCallback(
            (folder: TFolder, shortcutKey: string, event: React.MouseEvent<HTMLSpanElement>) => {
                setActiveShortcut(shortcutKey);
                handleFolderNameClick(folder, event);
                scheduleShortcutRelease();
            },
            [handleFolderNameClick, scheduleShortcutRelease, setActiveShortcut]
        );

        const handleShortcutFolderNoteMouseDown = useCallback(
            (folder: TFolder, event: React.MouseEvent<HTMLSpanElement>) => {
                handleFolderNameMouseDown(folder, event);
            },
            [handleFolderNameMouseDown]
        );

        // Handles note shortcut activation - reveals file in list pane
        const handleShortcutNoteActivate = useCallback(
            (note: TFile, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                if (selectionState.selectionType === ItemType.TAG && onRevealShortcutFile) {
                    onRevealShortcutFile(note);
                } else {
                    onRevealFile(note);
                }

                // Open file in background leaf without activating it
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    runAsyncAction(() => leaf.openFile(note, { active: false }));
                }
                if (isMobile && app.workspace.leftSplit) {
                    app.workspace.leftSplit.collapse();
                }

                const focusPane = uiState.singlePane ? uiState.currentSinglePaneView : 'files';
                // Keep shortcut note reveals from shifting focus away from the visible pane in single-pane mode.
                // This pairs with useNavigatorReveal's implicit reveal behavior which keeps the current single-pane view.
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: focusPane });
                scheduleShortcutRelease();
            },
            [
                selectionState.selectionType,
                setActiveShortcut,
                onRevealFile,
                onRevealShortcutFile,
                scheduleShortcutRelease,
                app,
                isMobile,
                uiDispatch,
                uiState.currentSinglePaneView,
                uiState.singlePane
            ]
        );

        // Handle middle-click on note items to open in a new tab
        const handleShortcutNoteMouseDown = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, note: TFile) => {
                // Check if middle mouse button (button 1) was clicked
                if (event.button !== 1) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                runAsyncAction(() => openFileInContext({ app, commandQueue, file: note, context: 'tab' }));
            },
            [app, commandQueue]
        );

        const handleRecentNoteActivate = useCallback(
            (note: TFile) => {
                if (selectionState.selectionType === ItemType.TAG && onRevealShortcutFile) {
                    onRevealShortcutFile(note);
                } else {
                    onRevealFile(note);
                }

                // Open file in background leaf without activating it
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    runAsyncAction(() => leaf.openFile(note, { active: false }));
                }
                if (isMobile && app.workspace.leftSplit) {
                    app.workspace.leftSplit.collapse();
                }

                const focusPane = uiState.singlePane ? uiState.currentSinglePaneView : 'files';
                // Keep recent note reveals from shifting focus away from the visible pane in single-pane mode.
                // This pairs with useNavigatorReveal's implicit reveal behavior which keeps the current single-pane view.
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: focusPane });
            },
            [
                selectionState.selectionType,
                onRevealFile,
                onRevealShortcutFile,
                app.workspace,
                isMobile,
                uiDispatch,
                uiState.currentSinglePaneView,
                uiState.singlePane
            ]
        );

        // Handles search shortcut activation - executes saved search query
        const handleShortcutSearchActivate = useCallback(
            (shortcutKey: string, searchShortcut: SearchShortcut) => {
                setActiveShortcut(shortcutKey);
                if (onExecuteSearchShortcut) {
                    runAsyncAction(() => onExecuteSearchShortcut(shortcutKey, searchShortcut));
                }
                scheduleShortcutRelease();
            },
            [setActiveShortcut, onExecuteSearchShortcut, scheduleShortcutRelease]
        );

        // Handles tag shortcut activation - navigates to tag and shows its files
        const handleShortcutTagActivate = useCallback(
            (tagPath: string, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                const canonicalPath = resolveCanonicalTagPath(tagPath, tagTree);
                if (!canonicalPath) {
                    scheduleShortcutRelease();
                    return;
                }
                onRevealTag(canonicalPath, { skipScroll: settings.skipAutoScroll, source: 'shortcut' });

                if (!uiState.singlePane) {
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    const container = rootContainerRef.current;
                    if (container) {
                        container.focus();
                    }
                }

                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });

                scheduleShortcutRelease();
            },
            [
                setActiveShortcut,
                onRevealTag,
                uiState.singlePane,
                uiDispatch,
                rootContainerRef,
                selectionDispatch,
                scheduleShortcutRelease,
                tagTree,
                settings.skipAutoScroll
            ]
        );

        const handleShortcutPropertyActivate = useCallback(
            (propertyNodeId: string, shortcutKey: string) => {
                setActiveShortcut(shortcutKey);
                const didReveal = onRevealProperty(propertyNodeId, { skipScroll: settings.skipAutoScroll, source: 'shortcut' });
                if (!didReveal) {
                    scheduleShortcutRelease();
                    return false;
                }

                if (!uiState.singlePane) {
                    uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                    const container = rootContainerRef.current;
                    if (container) {
                        container.focus();
                    }
                }

                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });

                scheduleShortcutRelease();
                return true;
            },
            [
                onRevealProperty,
                rootContainerRef,
                scheduleShortcutRelease,
                selectionDispatch,
                settings.skipAutoScroll,
                setActiveShortcut,
                uiDispatch,
                uiState.singlePane
            ]
        );

        type ShortcutContextMenuTarget =
            | { type: 'folder'; key: string; folder: TFolder }
            | { type: 'note'; key: string; file: TFile }
            | { type: 'tag'; key: string; tagPath: string }
            | { type: 'property'; key: string; propertyNodeId: string }
            | { type: 'search'; key: string }
            | { type: 'missing'; key: string; kind: 'folder' | 'note' | 'tag' | 'property' };

        const handleShortcutContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, target: ShortcutContextMenuTarget) => {
                if (!settings.showShortcuts) {
                    return;
                }

                // Prevent context menu on drag handle elements
                const targetElement = event.target;
                if (targetElement instanceof HTMLElement && targetElement.closest('.nn-drag-handle')) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                const menu = new Menu();
                menu.onHide(() => {
                    setIsShortcutContextMenuOpen(false);
                });
                setIsShortcutContextMenuOpen(true);

                if (target.type === 'missing') {
                    menu.addItem(item => {
                        item.setTitle(strings.shortcuts.remove)
                            .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star-off'))
                            .onClick(() => {
                                runAsyncAction(() => removeShortcut(target.key));
                            });
                    });
                    menu.showAtMouseEvent(event.nativeEvent);
                    return;
                }

                if (target.type === 'search') {
                    menu.addItem(item => {
                        item.setTitle(strings.shortcuts.remove)
                            .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star-off'))
                            .onClick(() => {
                                runAsyncAction(() => removeShortcut(target.key));
                            });
                    });
                    menu.showAtMouseEvent(event.nativeEvent);
                    return;
                }

                const state: MenuState = {
                    selectionState,
                    expandedFolders: expansionState.expandedFolders,
                    expandedTags: expansionState.expandedTags,
                    expandedProperties: expansionState.expandedProperties
                };

                const dispatchers: MenuDispatchers = {
                    selectionDispatch,
                    expansionDispatch,
                    uiDispatch
                };

                if (target.type === 'folder') {
                    buildFolderMenu({
                        folder: target.folder,
                        menu,
                        services: menuServices,
                        settings,
                        state,
                        dispatchers,
                        options: { disableNavigationSeparatorActions: true }
                    });
                } else if (target.type === 'note') {
                    buildFileMenu({
                        file: target.file,
                        menu,
                        services: menuServices,
                        settings,
                        state,
                        dispatchers
                    });

                    if (target.file.extension !== 'md') {
                        menu.addSeparator();
                        menu.addItem(item => {
                            item.setTitle(strings.shortcuts.remove)
                                .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star-off'))
                                .onClick(() => {
                                    runAsyncAction(() => removeShortcut(target.key));
                                });
                        });
                    }
                } else if (target.type === 'tag') {
                    buildTagMenu({
                        tagPath: target.tagPath,
                        menu,
                        services: menuServices,
                        settings,
                        state,
                        dispatchers,
                        options: { disableNavigationSeparatorActions: true }
                    });
                } else if (target.type === 'property') {
                    buildPropertyMenu({
                        propertyNodeId: target.propertyNodeId,
                        menu,
                        services: menuServices,
                        settings,
                        state,
                        dispatchers,
                        options: { disableNavigationSeparatorActions: true }
                    });
                }

                menu.showAtMouseEvent(event.nativeEvent);
            },
            [
                settings,
                menuServices,
                selectionState,
                expansionState.expandedFolders,
                expansionState.expandedTags,
                expansionState.expandedProperties,
                selectionDispatch,
                expansionDispatch,
                uiDispatch,
                removeShortcut
            ]
        );

        const handleRecentFileContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, file: TFile) => {
                event.preventDefault();
                event.stopPropagation();

                const menu = new Menu();

                const state: MenuState = {
                    selectionState,
                    expandedFolders: expansionState.expandedFolders,
                    expandedTags: expansionState.expandedTags,
                    expandedProperties: expansionState.expandedProperties
                };

                const dispatchers: MenuDispatchers = {
                    selectionDispatch,
                    expansionDispatch,
                    uiDispatch
                };

                buildFileMenu({
                    file,
                    menu,
                    services: menuServices,
                    settings,
                    state,
                    dispatchers
                });

                menu.showAtMouseEvent(event.nativeEvent);
            },
            [
                menuServices,
                settings,
                selectionState,
                expansionState.expandedFolders,
                expansionState.expandedTags,
                expansionState.expandedProperties,
                selectionDispatch,
                expansionDispatch,
                uiDispatch
            ]
        );

        const handleConfigurePropertyKeysFromSectionMenu = useCallback(() => {
            const profile = getActiveVaultProfile(plugin.settings);
            const modal = new PropertyKeyVisibilityModal(app, {
                initialKeys: profile.propertyKeys,
                onSave: async nextKeys => {
                    profile.propertyKeys = nextKeys;
                    await plugin.saveSettingsAndUpdate();
                }
            });
            modal.open();
        }, [app, plugin]);

        // Shows a context menu for navigation section headers with separator and shortcut actions
        const handleSectionContextMenu = useCallback(
            (event: React.MouseEvent<HTMLDivElement>, sectionId: NavigationSectionId, options?: { allowSeparator?: boolean }) => {
                event.preventDefault();
                event.stopPropagation();

                const isShortcutsSection = sectionId === NavigationSectionId.SHORTCUTS;
                const isTagSection = sectionId === NavigationSectionId.TAGS;
                const isPropertySection = sectionId === NavigationSectionId.PROPERTIES;
                const target = { type: 'section', id: sectionId } as const;
                const allowSeparator = options?.allowSeparator ?? true;
                const hasSeparator = allowSeparator ? metadataService.hasNavigationSeparator(target) : false;
                const menu = new Menu();
                let hasActions = false;
                const tagRootShortcutKey = isTagSection ? tagShortcutKeysByPath.get(TAGGED_TAG_ID) : undefined;
                const propertyRootShortcutKey = isPropertySection
                    ? propertyShortcutKeysByNodeId.get(PROPERTIES_ROOT_VIRTUAL_FOLDER_ID)
                    : undefined;
                const rootShortcutKey = tagRootShortcutKey ?? propertyRootShortcutKey;

                if (isPropertySection) {
                    menu.addItem(item => {
                        item.setTitle(strings.contextMenu.property.addKey)
                            .setIcon('lucide-settings-2')
                            .onClick(() => {
                                handleConfigurePropertyKeysFromSectionMenu();
                            });
                    });
                    hasActions = true;
                    menu.addSeparator();
                }

                if (isTagSection || isPropertySection) {
                    menu.addItem(item => {
                        if (rootShortcutKey) {
                            item.setTitle(strings.shortcuts.remove)
                                .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star-off'))
                                .onClick(() => {
                                    runAsyncAction(() => removeShortcut(rootShortcutKey));
                                });
                            return;
                        }

                        item.setTitle(strings.shortcuts.add)
                            .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star'))
                            .onClick(() => {
                                runAsyncAction(async () => {
                                    if (isTagSection) {
                                        await addTagShortcut(TAGGED_TAG_ID);
                                        return;
                                    }
                                    await addPropertyShortcut(PROPERTIES_ROOT_VIRTUAL_FOLDER_ID);
                                });
                            });
                    });
                    hasActions = true;
                }

                if (isShortcutsSection) {
                    menu.addItem(item => {
                        item.setTitle(pinToggleLabel)
                            .setIcon(uiState.pinShortcuts ? 'lucide-pin-off' : 'lucide-pin')
                            .onClick(() => {
                                handleShortcutSplitToggle();
                            });
                    });
                    hasActions = true;

                    const shouldShowSeparatorAction = allowSeparator && !uiState.pinShortcuts;
                    const shouldShowRemoveAll = shortcutsList.length > 0;
                    const shouldRenderSecondarySection = shouldShowSeparatorAction || shouldShowRemoveAll;

                    if (shouldRenderSecondarySection) {
                        menu.addSeparator();
                    }

                    // Add separator toggle option when shortcuts are not pinned
                    if (shouldShowSeparatorAction) {
                        menu.addItem(item => {
                            item.setTitle(
                                hasSeparator ? strings.contextMenu.navigation.removeSeparator : strings.contextMenu.navigation.addSeparator
                            )
                                .setIcon('lucide-separator-horizontal')
                                .onClick(() => {
                                    runAsyncAction(async () => {
                                        if (hasSeparator) {
                                            await metadataService.removeNavigationSeparator(target);
                                            return;
                                        }
                                        await metadataService.addNavigationSeparator(target);
                                    });
                                });
                        });
                        hasActions = true;
                    }

                    // Add "remove all shortcuts" option
                    if (shouldShowRemoveAll) {
                        if (shouldShowSeparatorAction) {
                            menu.addSeparator();
                        }

                        menu.addItem(item => {
                            item.setTitle(strings.shortcuts.removeAll)
                                .setIcon('lucide-trash-2')
                                .onClick(() => {
                                    const confirmModal = new ConfirmModal(
                                        app,
                                        strings.shortcuts.removeAll,
                                        strings.shortcuts.removeAllConfirm,
                                        () => clearShortcuts(),
                                        strings.common.remove
                                    );
                                    confirmModal.open();
                                });
                        });

                        hasActions = true;
                    }
                } else if (allowSeparator) {
                    // Add separator toggle option for other sections
                    menu.addItem(item => {
                        item.setTitle(
                            hasSeparator ? strings.contextMenu.navigation.removeSeparator : strings.contextMenu.navigation.addSeparator
                        )
                            .setIcon('lucide-separator-horizontal')
                            .onClick(() => {
                                runAsyncAction(async () => {
                                    if (hasSeparator) {
                                        await metadataService.removeNavigationSeparator(target);
                                        return;
                                    }
                                    await metadataService.addNavigationSeparator(target);
                                });
                            });
                    });
                    hasActions = true;
                }

                if (isTagSection || isPropertySection) {
                    if (hasActions) {
                        menu.addSeparator();
                    }

                    const commandId = isTagSection ? 'navigate-to-tag' : 'navigate-to-property';
                    const commandTitle = isTagSection ? strings.commands.navigateToTag : strings.commands.navigateToProperty;
                    const commandIcon = isTagSection
                        ? resolveUXIconForMenu(settings.interfaceIcons, 'nav-tag', 'lucide-hash')
                        : resolveUXIconForMenu(settings.interfaceIcons, 'nav-property', 'lucide-list-filter');
                    menu.addItem(item => {
                        item.setTitle(commandTitle)
                            .setIcon(commandIcon)
                            .onClick(() => {
                                executeCommand(app, `${plugin.manifest.id}:${commandId}`);
                            });
                    });
                    hasActions = true;
                }

                // Skip showing empty menu
                if (!hasActions) {
                    return;
                }

                menu.showAtMouseEvent(event.nativeEvent);
            },
            [
                app,
                clearShortcuts,
                handleShortcutSplitToggle,
                handleConfigurePropertyKeysFromSectionMenu,
                metadataService,
                pinToggleLabel,
                plugin.manifest.id,
                settings.interfaceIcons,
                tagShortcutKeysByPath,
                propertyShortcutKeysByNodeId,
                shortcutsList.length,
                uiState.pinShortcuts,
                removeShortcut,
                addTagShortcut,
                addPropertyShortcut
            ]
        );

        // Calculates the note count for a folder shortcut, using cache when available
        const getFolderShortcutCount = useCallback(
            (folder: TFolder): NoteCountInfo => {
                if (!settings.showNoteCount) {
                    return ZERO_NOTE_COUNT;
                }

                const precomputed = folderCounts.get(folder.path);
                if (precomputed) {
                    return precomputed;
                }

                // Extract folder note settings for the note count calculation
                const folderNoteSettings = getFolderNoteDetectionSettings({
                    enableFolderNotes: settings.enableFolderNotes,
                    folderNoteName: settings.folderNoteName,
                    folderNoteNamePattern: settings.folderNoteNamePattern
                });

                return calculateFolderNoteCounts(folder, {
                    app,
                    db: noteCountDB,
                    fileVisibility,
                    excludedFiles: effectiveFrontmatterExclusions,
                    excludedFileMatcher: effectiveFrontmatterExclusionMatcher,
                    excludedFolders: hiddenFolders,
                    fileNameMatcher: folderCountFileNameMatcher,
                    hiddenFileTagVisibility,
                    includeDescendants: includeDescendantNotes,
                    showHiddenFolders: showHiddenItems,
                    hideFolderNoteInList: settings.hideFolderNoteInList,
                    folderNoteSettings
                });
            },
            [
                app,
                folderCounts,
                settings.showNoteCount,
                fileVisibility,
                effectiveFrontmatterExclusions,
                effectiveFrontmatterExclusionMatcher,
                hiddenFolders,
                noteCountDB,
                includeDescendantNotes,
                hiddenFileTagVisibility,
                showHiddenItems,
                settings.hideFolderNoteInList,
                settings.enableFolderNotes,
                settings.folderNoteName,
                settings.folderNoteNamePattern,
                folderCountFileNameMatcher
            ]
        );

        // Calculates the note count for a tag shortcut, using cache when available
        const getTagShortcutCount = useCallback(
            (tagPath: string): NoteCountInfo => {
                const canonicalPath = resolveCanonicalTagPath(tagPath, tagTree);
                if (!canonicalPath) {
                    return ZERO_NOTE_COUNT;
                }
                if (!settings.showNoteCount) {
                    return ZERO_NOTE_COUNT;
                }

                const precomputed = tagCounts.get(canonicalPath);
                if (precomputed) {
                    return precomputed;
                }

                const tagNode = findTagNode(tagTree, canonicalPath);
                if (!tagNode) {
                    return ZERO_NOTE_COUNT;
                }

                // Calculate note counts for the tag and its descendants
                const current = tagNode.notesWithTag.size;
                if (!includeDescendantNotes) {
                    // Return only current tag's note count when descendants are disabled
                    return {
                        current,
                        descendants: 0,
                        total: current
                    };
                }

                // Calculate total notes including all descendant tags
                const total = getTotalNoteCount(tagNode);
                // Descendant count is the difference between total and current
                const descendants = Math.max(total - current, 0);
                return {
                    current,
                    descendants,
                    total
                };
            },
            [settings.showNoteCount, includeDescendantNotes, tagCounts, tagTree]
        );

        const getPropertyShortcutCount = useCallback(
            (propertyNodeId: string): NoteCountInfo => {
                if (!settings.showNoteCount) {
                    return ZERO_NOTE_COUNT;
                }

                const precomputed = propertyCounts.get(propertyNodeId);
                if (precomputed) {
                    return precomputed;
                }
                if (propertyNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
                    return ZERO_NOTE_COUNT;
                }

                const resolved = resolvePropertyTreeNode({
                    nodeId: propertyNodeId,
                    propertyTreeService,
                    propertyTree
                });
                const resolvedNode = resolved?.node ?? null;

                if (!resolvedNode) {
                    return ZERO_NOTE_COUNT;
                }

                if (resolvedNode.kind === 'key') {
                    const current = getDirectPropertyKeyNoteCount(resolvedNode);
                    if (!includeDescendantNotes) {
                        return { current, descendants: 0, total: current };
                    }

                    const total = resolvedNode.notesWithValue.size;
                    const descendants = Math.max(total - current, 0);
                    return { current, descendants, total };
                }

                const current = resolvedNode.notesWithValue.size;
                if (!includeDescendantNotes || !resolvedNode.valuePath) {
                    return { current, descendants: 0, total: current };
                }

                const keyNode = propertyTreeService?.getKeyNode(resolvedNode.key) ?? propertyTree?.get(resolvedNode.key) ?? null;
                if (!keyNode) {
                    return { current, descendants: 0, total: current };
                }

                const total = getTotalPropertyNoteCount(keyNode, resolvedNode.valuePath);
                const descendants = Math.max(total - current, 0);
                return { current, descendants, total };
            },
            [settings.showNoteCount, propertyCounts, propertyTreeService, propertyTree, includeDescendantNotes]
        );

        // Generates display label for missing note shortcuts, stripping .md extension
        const getMissingNoteLabel = useCallback((path: string): string => {
            const baseName = getPathBaseName(path);
            if (!baseName) {
                return '';
            }
            const dotIndex = baseName.lastIndexOf('.');
            if (dotIndex <= 0) {
                return baseName;
            }
            const namePart = baseName.substring(0, dotIndex);
            const extension = baseName.substring(dotIndex + 1);
            if (extension.toLowerCase() === 'md') {
                return namePart;
            }
            return baseName;
        }, []);

        useEffect(() => {
            if (!activeShortcutKey) {
                return;
            }

            const shortcut = shortcutMap.get(activeShortcutKey);
            if (!shortcut) {
                setActiveShortcut(null);
                return;
            }

            if (shortcut.type === ShortcutType.FOLDER) {
                const selectedPath = selectionState.selectedFolder?.path;
                if (!selectedPath || selectedPath !== shortcut.path) {
                    setActiveShortcut(null);
                }
                return;
            }

            if (shortcut.type === ShortcutType.NOTE) {
                const selectedPath = selectionState.selectedFile?.path;
                if (!selectedPath || selectedPath !== shortcut.path) {
                    setActiveShortcut(null);
                }
                return;
            }

            if (shortcut.type === ShortcutType.TAG) {
                const selectedTag = selectionState.selectedTag;
                if (!selectedTag || selectedTag !== shortcut.tagPath) {
                    setActiveShortcut(null);
                }
                return;
            }

            if (shortcut.type === ShortcutType.PROPERTY) {
                const selectedProperty = selectionState.selectedProperty;
                const resolvedNodeId = resolvePropertyShortcutNodeId(null, shortcut.nodeId);
                if (!selectedProperty || !resolvedNodeId || selectedProperty !== resolvedNodeId) {
                    setActiveShortcut(null);
                }
            }
        }, [
            activeShortcutKey,
            shortcutMap,
            selectionState.selectedFolder,
            selectionState.selectedFile,
            selectionState.selectedTag,
            selectionState.selectedProperty,
            setActiveShortcut
        ]);

        const shortcutHeaderTrailingAction = useMemo<VirtualFolderTrailingAction>(
            () => ({
                actionLabel: pinToggleLabel,
                icon: uiState.pinShortcuts ? 'lucide-pin-off' : 'lucide-pin',
                onClick: handleShortcutSplitToggle
            }),
            [handleShortcutSplitToggle, pinToggleLabel, uiState.pinShortcuts]
        );

        const propertiesHeaderTrailingAction = useMemo<VirtualFolderTrailingAction>(
            () => ({
                actionLabel: strings.contextMenu.property.addKey,
                icon: 'lucide-settings-2',
                onClick: handleConfigurePropertyKeysFromSectionMenu,
                labelMode: 'note-count'
            }),
            [handleConfigurePropertyKeysFromSectionMenu]
        );

        // Renders individual navigation items based on their type
        const renderItem = useCallback(
            (item: CombinedNavigationItem): React.ReactNode => {
                switch (item.type) {
                    case NavigationPaneItemType.SHORTCUT_FOLDER: {
                        const folder = item.folder;
                        const isMissing = Boolean(item.isMissing);
                        const canInteract = Boolean(folder) && !isMissing;
                        if (!canInteract && !isMissing) {
                            return null;
                        }

                        const folderPath = isFolderShortcut(item.shortcut) ? item.shortcut.path : '';
                        const isRootShortcut = folderPath === '/';
                        const folderName = (() => {
                            if (isRootShortcut) {
                                return settings.customVaultName || app.vault.getName();
                            }
                            if (canInteract && folder) {
                                return item.displayName || folder.name;
                            }
                            return getPathBaseName(folderPath);
                        })();
                        const folderCountInfo =
                            canInteract && folder && shouldShowShortcutCounts ? getFolderShortcutCount(folder) : ZERO_NOTE_COUNT;
                        const folderNote =
                            canInteract && folder && settings.enableFolderNotes && settings.enableFolderNoteLinks
                                ? getFolderNote(folder, settings)
                                : null;
                        const folderAlias = isFolderShortcut(item.shortcut) ? item.shortcut.alias : undefined;
                        const folderLabel = folderAlias && folderAlias.length > 0 ? folderAlias : folderName;

                        const dragHandlers = buildShortcutExternalHandlers(item.key);
                        const isDragSource = shouldUseShortcutDnd && activeShortcutId === item.key;

                        const contextTarget: ShortcutContextMenuTarget =
                            canInteract && folder
                                ? { type: 'folder', key: item.key, folder }
                                : { type: 'missing', key: item.key, kind: 'folder' };
                        const shortcutBackground = isMissing ? undefined : getSolidBackground(item.backgroundColor);

                        const shortcutProps = {
                            icon: isMissing
                                ? 'lucide-alert-triangle'
                                : item.isExcluded && !showHiddenItems
                                  ? 'lucide-eye-off'
                                  : (item.icon ?? 'lucide-folder'),
                            color: isMissing ? undefined : item.color,
                            backgroundColor: shortcutBackground,
                            label: folderLabel,
                            description: undefined,
                            level: item.level,
                            type: 'folder' as const,
                            countInfo: !isMissing && shouldShowShortcutCounts ? folderCountInfo : undefined,
                            badge: shortcutNumberBadgesByKey.get(item.key),
                            forceShowCount: shouldShowShortcutCounts,
                            isExcluded: !isMissing ? item.isExcluded : undefined,
                            isDisabled: isMissing,
                            isMissing,
                            onClick: () => {
                                if (!folder) {
                                    return;
                                }
                                handleShortcutFolderActivate(folder, item.key);
                            },
                            onRemove: () => {
                                runAsyncAction(() => removeShortcut(item.key));
                            },
                            onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => handleShortcutContextMenu(event, contextTarget),
                            dragHandlers,
                            dragHandleConfig: shortcutDragHandleConfig,
                            hasFolderNote: !isMissing && Boolean(folderNote),
                            onLabelClick:
                                folder && folderNote
                                    ? (event: React.MouseEvent<HTMLSpanElement>) => {
                                          handleShortcutFolderNoteClick(folder, item.key, event);
                                      }
                                    : undefined,
                            onLabelMouseDown:
                                folder && folderNote
                                    ? (event: React.MouseEvent<HTMLSpanElement>) => handleShortcutFolderNoteMouseDown(folder, event)
                                    : undefined
                        };

                        if (shouldUseShortcutDnd) {
                            return (
                                <SortableShortcutItem
                                    sortableId={item.key}
                                    canReorder={shouldUseShortcutDnd}
                                    isDragSource={isDragSource}
                                    {...shortcutProps}
                                />
                            );
                        }

                        return <ShortcutItem {...shortcutProps} isDragSource={isDragSource} />;
                    }

                    case NavigationPaneItemType.SHORTCUT_NOTE: {
                        const note = item.note;
                        const isMissing = Boolean(item.isMissing);
                        const canInteract = Boolean(note) && !isMissing;
                        const notePath = isNoteShortcut(item.shortcut) ? item.shortcut.path : '';

                        const dragHandlers = buildShortcutExternalHandlers(item.key);
                        const isDragSource = shouldUseShortcutDnd && activeShortcutId === item.key;

                        const defaultLabel = (() => {
                            if (!note || !canInteract) {
                                return getMissingNoteLabel(notePath);
                            }
                            const displayName = getFileDisplayName(note);
                            const extensionSuffix = shouldShowExtensionSuffix(note) ? getExtensionSuffix(note) : '';
                            return extensionSuffix ? `${displayName}${extensionSuffix}` : displayName;
                        })();
                        const noteAlias = isNoteShortcut(item.shortcut) ? item.shortcut.alias : undefined;
                        const label = noteAlias && noteAlias.length > 0 ? noteAlias : defaultLabel;

                        const contextTarget: ShortcutContextMenuTarget =
                            canInteract && note
                                ? { type: 'note', key: item.key, file: note }
                                : { type: 'missing', key: item.key, kind: 'note' };

                        const shortcutProps = {
                            icon: isMissing
                                ? 'lucide-alert-triangle'
                                : item.isExcluded && !showHiddenItems
                                  ? 'lucide-eye-off'
                                  : (item.icon ?? 'lucide-file-text'),
                            color: isMissing ? undefined : item.color,
                            label,
                            description: undefined,
                            level: item.level,
                            type: 'note' as const,
                            badge: shortcutNumberBadgesByKey.get(item.key),
                            forceShowCount: shouldShowShortcutCounts,
                            isExcluded: !isMissing ? item.isExcluded : undefined,
                            isDisabled: isMissing,
                            isMissing,
                            onClick: () => {
                                if (!note) {
                                    return;
                                }
                                handleShortcutNoteActivate(note, item.key);
                            },
                            onRemove: () => {
                                runAsyncAction(() => removeShortcut(item.key));
                            },
                            onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
                                if (!note || !canInteract) {
                                    return;
                                }
                                handleShortcutNoteMouseDown(event, note);
                            },
                            onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => handleShortcutContextMenu(event, contextTarget),
                            dragHandlers,
                            dragHandleConfig: shortcutDragHandleConfig
                        };

                        if (shouldUseShortcutDnd) {
                            return (
                                <SortableShortcutItem
                                    sortableId={item.key}
                                    canReorder={shouldUseShortcutDnd}
                                    isDragSource={isDragSource}
                                    {...shortcutProps}
                                />
                            );
                        }

                        return <ShortcutItem {...shortcutProps} isDragSource={isDragSource} />;
                    }

                    case NavigationPaneItemType.SHORTCUT_SEARCH: {
                        const searchShortcut = item.searchShortcut;

                        const dragHandlers = buildShortcutExternalHandlers(item.key);
                        const isDragSource = shouldUseShortcutDnd && activeShortcutId === item.key;

                        const shortcutProps = {
                            icon: 'lucide-search',
                            color: item.color,
                            label: searchShortcut.name,
                            level: item.level,
                            type: 'search' as const,
                            badge: shortcutNumberBadgesByKey.get(item.key),
                            forceShowCount: shouldShowShortcutCounts,
                            onRemove: () => {
                                runAsyncAction(() => removeShortcut(item.key));
                            },
                            onClick: () => handleShortcutSearchActivate(item.key, searchShortcut),
                            onContextMenu: (event: React.MouseEvent<HTMLDivElement>) =>
                                handleShortcutContextMenu(event, {
                                    type: 'search',
                                    key: item.key
                                }),
                            dragHandlers,
                            dragHandleConfig: shortcutDragHandleConfig
                        };

                        if (shouldUseShortcutDnd) {
                            return (
                                <SortableShortcutItem
                                    sortableId={item.key}
                                    canReorder={shouldUseShortcutDnd}
                                    isDragSource={isDragSource}
                                    {...shortcutProps}
                                />
                            );
                        }

                        return <ShortcutItem {...shortcutProps} isDragSource={isDragSource} />;
                    }

                    case NavigationPaneItemType.SHORTCUT_TAG: {
                        const isMissing = Boolean(item.isMissing);
                        const tagPath = isTagShortcut(item.shortcut) ? item.shortcut.tagPath : item.tagPath;
                        const tagCountInfo = !isMissing && shouldShowShortcutCounts ? getTagShortcutCount(tagPath) : ZERO_NOTE_COUNT;
                        const tagAlias = isTagShortcut(item.shortcut) ? item.shortcut.alias : undefined;
                        const tagLabel = tagAlias && tagAlias.length > 0 ? tagAlias : item.displayName;

                        const dragHandlers = buildShortcutExternalHandlers(item.key);
                        const isDragSource = shouldUseShortcutDnd && activeShortcutId === item.key;

                        const contextTarget: ShortcutContextMenuTarget = !isMissing
                            ? { type: 'tag', key: item.key, tagPath }
                            : { type: 'missing', key: item.key, kind: 'tag' };
                        const shortcutBackground = isMissing ? undefined : getSolidBackground(item.backgroundColor);

                        const shortcutProps = {
                            icon: isMissing
                                ? 'lucide-alert-triangle'
                                : item.isExcluded && !showHiddenItems
                                  ? 'lucide-eye-off'
                                  : (item.icon ?? 'lucide-tags'),
                            color: isMissing ? undefined : item.color,
                            backgroundColor: shortcutBackground,
                            label: tagLabel,
                            description: undefined,
                            level: item.level,
                            type: 'tag' as const,
                            countInfo: !isMissing && shouldShowShortcutCounts ? tagCountInfo : undefined,
                            badge: shortcutNumberBadgesByKey.get(item.key),
                            forceShowCount: shouldShowShortcutCounts,
                            isExcluded: !isMissing ? item.isExcluded : undefined,
                            isDisabled: isMissing,
                            isMissing,
                            onClick: () => {
                                if (isMissing) {
                                    return;
                                }
                                handleShortcutTagActivate(tagPath, item.key);
                            },
                            onRemove: () => {
                                runAsyncAction(() => removeShortcut(item.key));
                            },
                            onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => handleShortcutContextMenu(event, contextTarget),
                            dragHandlers,
                            dragHandleConfig: shortcutDragHandleConfig
                        };

                        if (shouldUseShortcutDnd) {
                            return (
                                <SortableShortcutItem
                                    sortableId={item.key}
                                    canReorder={shouldUseShortcutDnd}
                                    isDragSource={isDragSource}
                                    {...shortcutProps}
                                />
                            );
                        }

                        return <ShortcutItem {...shortcutProps} isDragSource={isDragSource} />;
                    }

                    case NavigationPaneItemType.SHORTCUT_PROPERTY: {
                        const isMissing = Boolean(item.isMissing);
                        const propertyNodeId = item.propertyNodeId;
                        const propertyCountInfo =
                            !isMissing && shouldShowShortcutCounts ? getPropertyShortcutCount(propertyNodeId) : ZERO_NOTE_COUNT;
                        const propertyAlias = isPropertyShortcut(item.shortcut) ? item.shortcut.alias : undefined;
                        const propertyLabel = propertyAlias && propertyAlias.length > 0 ? propertyAlias : item.displayName;

                        const dragHandlers = buildShortcutExternalHandlers(item.key);
                        const isDragSource = shouldUseShortcutDnd && activeShortcutId === item.key;

                        const contextTarget: ShortcutContextMenuTarget = !isMissing
                            ? { type: 'property', key: item.key, propertyNodeId }
                            : { type: 'missing', key: item.key, kind: 'property' };
                        const shortcutBackground = isMissing ? undefined : getSolidBackground(item.backgroundColor);

                        const shortcutProps = {
                            icon: isMissing
                                ? 'lucide-alert-triangle'
                                : (item.icon ?? resolveUXIcon(settings.interfaceIcons, 'nav-property')),
                            color: isMissing ? undefined : item.color,
                            backgroundColor: shortcutBackground,
                            label: propertyLabel,
                            description: undefined,
                            level: item.level,
                            type: 'property' as const,
                            countInfo: !isMissing && shouldShowShortcutCounts ? propertyCountInfo : undefined,
                            badge: shortcutNumberBadgesByKey.get(item.key),
                            forceShowCount: shouldShowShortcutCounts,
                            isDisabled: isMissing,
                            isMissing,
                            onClick: () => {
                                if (isMissing) {
                                    return;
                                }
                                handleShortcutPropertyActivate(propertyNodeId, item.key);
                            },
                            onRemove: () => {
                                runAsyncAction(() => removeShortcut(item.key));
                            },
                            onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => handleShortcutContextMenu(event, contextTarget),
                            dragHandlers,
                            dragHandleConfig: shortcutDragHandleConfig
                        };

                        if (shouldUseShortcutDnd) {
                            return (
                                <SortableShortcutItem
                                    sortableId={item.key}
                                    canReorder={shouldUseShortcutDnd}
                                    isDragSource={isDragSource}
                                    {...shortcutProps}
                                />
                            );
                        }

                        return <ShortcutItem {...shortcutProps} isDragSource={isDragSource} />;
                    }

                    case NavigationPaneItemType.FOLDER: {
                        const folderPath = item.data.path;
                        const countInfo = folderCounts.get(folderPath);
                        const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
                        // Hide separator actions for the first inline folder when shortcuts are pinned
                        // This prevents users from adding/removing separators on the first item after pinned shortcuts
                        const shouldHideFolderSeparatorActions =
                            shouldPinShortcuts && firstInlineFolderPath !== null && folderPath === firstInlineFolderPath;

                        return (
                            <FolderItem
                                folder={item.data}
                                displayName={item.displayName}
                                level={item.level}
                                indentGuideLevels={indentGuideLevels}
                                isExpanded={expansionState.expandedFolders.has(item.data.path)}
                                isSelected={
                                    selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder?.path === folderPath
                                }
                                isExcluded={item.isExcluded}
                                onToggle={() => handleFolderToggle(item.data.path)}
                                onClick={() => handleFolderClick(item.data)}
                                onNameClick={event => handleFolderNameClick(item.data, event)}
                                onNameMouseDown={event => handleFolderNameMouseDown(item.data, event)}
                                onToggleAllSiblings={() => {
                                    const isCurrentlyExpanded = expansionState.expandedFolders.has(item.data.path);

                                    if (isCurrentlyExpanded) {
                                        // If expanded, collapse everything (parent and all descendants)
                                        handleFolderToggle(item.data.path);
                                        const descendantPaths = getAllDescendantFolders(item.data);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_FOLDERS', descendantPaths, expand: false });
                                        }
                                    } else {
                                        // If collapsed, expand parent and all descendants
                                        handleFolderToggle(item.data.path);
                                        const descendantPaths = getAllDescendantFolders(item.data);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_FOLDERS', descendantPaths, expand: true });
                                        }
                                    }
                                }}
                                icon={item.icon}
                                color={item.color}
                                backgroundColor={getSolidBackground(item.backgroundColor)}
                                countInfo={countInfo}
                                excludedFolders={item.parsedExcludedFolders || []}
                                vaultChangeVersion={vaultChangeVersion}
                                disableNavigationSeparatorActions={shouldHideFolderSeparatorActions}
                            />
                        );
                    }

                    case NavigationPaneItemType.VIRTUAL_FOLDER: {
                        const virtualFolder = item.data;
                        const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
                        const isShortcutsGroup = virtualFolder.id === SHORTCUTS_VIRTUAL_FOLDER_ID;
                        const isRecentNotesGroup = virtualFolder.id === RECENT_NOTES_VIRTUAL_FOLDER_ID;
                        // `hasChildren` is computed when building the navigation items so it reflects actual renderable children
                        // (e.g. recent paths that still resolve to `TFile`).
                        const hasChildren = item.hasChildren ?? false;

                        const isExpanded = isShortcutsGroup
                            ? shortcutsExpanded
                            : isRecentNotesGroup
                              ? recentNotesExpanded
                              : expansionState.expandedVirtualFolders.has(virtualFolder.id);

                        const tagCollectionId = item.tagCollectionId ?? null;
                        const propertyCollectionId = item.propertyCollectionId ?? null;
                        const isTagCollection = Boolean(tagCollectionId);
                        const isPropertyCollection = Boolean(propertyCollectionId);
                        const isPropertyCollectionSelected =
                            isPropertyCollection &&
                            selectionState.selectionType === ItemType.PROPERTY &&
                            selectionState.selectedProperty === propertyCollectionId;
                        const isSelected =
                            (isTagCollection &&
                                selectionState.selectionType === ItemType.TAG &&
                                selectionState.selectedTag === tagCollectionId) ||
                            isPropertyCollectionSelected;
                        const collectionCountInfo = item.noteCount ?? (tagCollectionId ? tagCounts.get(tagCollectionId) : undefined);
                        const showFileCount = item.showFileCount ?? false;
                        let collectionSearchMatch: 'include' | 'exclude' | undefined;
                        if (tagCollectionId === TAGGED_TAG_ID) {
                            if (highlightExcludeTagged) {
                                collectionSearchMatch = 'exclude';
                            } else if (highlightRequireTagged) {
                                collectionSearchMatch = 'include';
                            }
                        }

                        const dropConfig =
                            virtualFolder.id === TAGS_ROOT_VIRTUAL_FOLDER_ID
                                ? {
                                      zone: 'tag-root',
                                      path: '__nn-tag-root__',
                                      allowExternalDrop: false
                                  }
                                : undefined;

                        const sectionId = isShortcutsGroup
                            ? NavigationSectionId.SHORTCUTS
                            : isRecentNotesGroup
                              ? NavigationSectionId.RECENT
                              : virtualFolder.id === TAGS_ROOT_VIRTUAL_FOLDER_ID
                                ? NavigationSectionId.TAGS
                                : virtualFolder.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID
                                  ? NavigationSectionId.PROPERTIES
                                  : null;

                        const shouldDisableFirstSectionMenu =
                            shouldPinShortcuts && sectionId !== null && firstSectionId !== null && sectionId === firstSectionId;
                        const allowSeparatorActions = !isShortcutsGroup || !shouldPinShortcuts;
                        const hasShortcutMenuActions = isShortcutsGroup && shortcutsList.length > 0;
                        const hasShortcutsPinAction = isShortcutsGroup;
                        // When shortcuts are pinned they render in their own panel, so separator actions are disabled for that section.
                        // Shortcuts have to be unpinned to edit the first inline section separator.
                        const sectionContextMenu =
                            sectionId !== null &&
                            (!shouldDisableFirstSectionMenu || isShortcutsGroup) &&
                            (allowSeparatorActions || hasShortcutMenuActions || hasShortcutsPinAction)
                                ? (event: React.MouseEvent<HTMLDivElement>) =>
                                      handleSectionContextMenu(event, sectionId, { allowSeparator: allowSeparatorActions })
                                : undefined;

                        const isPropertiesGroup = virtualFolder.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
                        const trailingAction: VirtualFolderTrailingAction | undefined = isShortcutsGroup
                            ? shortcutHeaderTrailingAction
                            : isPropertiesGroup
                              ? propertiesHeaderTrailingAction
                              : undefined;

                        return (
                            <VirtualFolderComponent
                                virtualFolder={virtualFolder}
                                level={item.level}
                                indentGuideLevels={indentGuideLevels}
                                isExpanded={isExpanded}
                                hasChildren={hasChildren}
                                isSelected={Boolean(isSelected)}
                                showFileCount={showFileCount}
                                countInfo={collectionCountInfo}
                                searchMatch={collectionSearchMatch}
                                trailingAction={trailingAction}
                                onSelect={
                                    isTagCollection && tagCollectionId
                                        ? event => handleTagCollectionClick(tagCollectionId, event)
                                        : isPropertyCollection
                                          ? handlePropertyCollectionClick
                                          : undefined
                                }
                                onToggle={() => handleVirtualFolderToggle(virtualFolder.id)}
                                onDragOver={isShortcutsGroup && allowEmptyShortcutDrop ? handleShortcutRootDragOver : undefined}
                                onDrop={isShortcutsGroup && allowEmptyShortcutDrop ? handleShortcutRootDrop : undefined}
                                dropConfig={dropConfig}
                                onContextMenu={sectionContextMenu}
                            />
                        );
                    }

                    case NavigationPaneItemType.RECENT_NOTE: {
                        const note = item.note;
                        const displayName = getFileDisplayName(note);
                        const extensionSuffix = shouldShowExtensionSuffix(note) ? getExtensionSuffix(note) : '';
                        const label = extensionSuffix ? `${displayName}${extensionSuffix}` : displayName;
                        return (
                            <ShortcutItem
                                icon={item.icon ?? 'lucide-file-text'}
                                color={item.color}
                                label={label}
                                level={item.level}
                                type="note"
                                onClick={() => handleRecentNoteActivate(note)}
                                onMouseDown={event => handleShortcutNoteMouseDown(event, note)}
                                onContextMenu={event => handleRecentFileContextMenu(event, note)}
                            />
                        );
                    }

                    case NavigationPaneItemType.TAG:
                    case NavigationPaneItemType.UNTAGGED: {
                        const tagNode = item.data;
                        const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
                        let searchMatch: 'include' | 'exclude' | undefined;
                        if (tagNode.path === UNTAGGED_TAG_ID) {
                            if (highlightIncludeUntagged) {
                                searchMatch = 'include';
                            } else if (highlightExcludeTagged) {
                                searchMatch = 'exclude';
                            }
                        } else if (hasTagTokenSearchHighlights) {
                            const normalizedTagPath = getFoldedTagPath(tagNode.path);
                            if (searchExcludeTokenSet?.has(normalizedTagPath)) {
                                searchMatch = 'exclude';
                            } else if (searchIncludeTokenSet?.has(normalizedTagPath)) {
                                searchMatch = 'include';
                            }
                        }
                        return (
                            <TagTreeItem
                                tagNode={tagNode}
                                level={item.level ?? 0}
                                indentGuideLevels={indentGuideLevels}
                                isExpanded={expansionState.expandedTags.has(tagNode.path)}
                                isSelected={selectionState.selectionType === ItemType.TAG && selectionState.selectedTag === tagNode.path}
                                isHidden={'isHidden' in item ? item.isHidden : false}
                                onToggle={() => handleTagToggle(tagNode.path)}
                                onClick={event => handleTagClick(tagNode.path, event)}
                                color={item.color}
                                backgroundColor={getSolidBackground(item.backgroundColor)}
                                icon={item.icon}
                                searchMatch={searchMatch}
                                isDraggable={!isMobile && tagNode.path !== UNTAGGED_TAG_ID && tagNode.path !== TAGGED_TAG_ID}
                                onToggleAllSiblings={() => {
                                    const isCurrentlyExpanded = expansionState.expandedTags.has(tagNode.path);

                                    if (isCurrentlyExpanded) {
                                        // If expanded, collapse everything (parent and all descendants)
                                        handleTagToggle(tagNode.path);
                                        const descendantPaths = getAllDescendantTags(tagNode.path);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_TAGS', descendantPaths, expand: false });
                                        }
                                    } else {
                                        // If collapsed, expand parent and all descendants
                                        handleTagToggle(tagNode.path);
                                        const descendantPaths = getAllDescendantTags(tagNode.path);
                                        if (descendantPaths.length > 0) {
                                            expansionDispatch({ type: 'TOGGLE_DESCENDANT_TAGS', descendantPaths, expand: true });
                                        }
                                    }
                                }}
                                countInfo={tagCounts.get(tagNode.path)}
                                showFileCount={settings.showNoteCount}
                            />
                        );
                    }

                    case NavigationPaneItemType.PROPERTY_KEY:
                    case NavigationPaneItemType.PROPERTY_VALUE: {
                        const propertyNode = item.data;
                        const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
                        const selectedPropertyNodeId =
                            selectionState.selectionType === ItemType.PROPERTY ? selectionState.selectedProperty : null;
                        let searchMatch: 'include' | 'exclude' | undefined;
                        if (hasPropertyTokenSearchHighlights) {
                            const normalizedPropertyNodeId = getFoldedPropertyNodeId(propertyNode.id);
                            if (propertyExcludeTokenSet?.has(normalizedPropertyNodeId)) {
                                searchMatch = 'exclude';
                            } else if (propertyIncludeTokenSet?.has(normalizedPropertyNodeId)) {
                                searchMatch = 'include';
                            }
                        }

                        return (
                            <PropertyTreeItem
                                propertyNode={propertyNode}
                                level={item.level ?? 0}
                                indentGuideLevels={indentGuideLevels}
                                isExpanded={expansionState.expandedProperties.has(propertyNode.id)}
                                isSelected={selectedPropertyNodeId === propertyNode.id}
                                onToggle={() => handlePropertyToggle(propertyNode.id)}
                                onClick={event => handlePropertyClick(propertyNode, event)}
                                onToggleAllSiblings={() => {
                                    const isCurrentlyExpanded = expansionState.expandedProperties.has(propertyNode.id);

                                    if (isCurrentlyExpanded) {
                                        handlePropertyToggle(propertyNode.id);
                                        const descendantNodeIds = getAllDescendantPropertyNodeIds(propertyNode);
                                        if (descendantNodeIds.length > 0) {
                                            expansionDispatch({
                                                type: 'TOGGLE_DESCENDANT_PROPERTIES',
                                                descendantNodeIds,
                                                expand: false
                                            });
                                        }
                                    } else {
                                        handlePropertyToggle(propertyNode.id);
                                        const descendantNodeIds = getAllDescendantPropertyNodeIds(propertyNode);
                                        if (descendantNodeIds.length > 0) {
                                            expansionDispatch({
                                                type: 'TOGGLE_DESCENDANT_PROPERTIES',
                                                descendantNodeIds,
                                                expand: true
                                            });
                                        }
                                    }
                                }}
                                color={item.color}
                                backgroundColor={getSolidBackground(item.backgroundColor)}
                                icon={item.icon}
                                searchMatch={searchMatch}
                                isDraggable={!isMobile}
                                countInfo={propertyCounts.get(propertyNode.id)}
                                showFileCount={settings.showNoteCount}
                            />
                        );
                    }

                    case NavigationPaneItemType.TOP_SPACER: {
                        const spacerClass = item.hasSeparator ? 'nn-nav-top-spacer nn-nav-spacer--with-separator' : 'nn-nav-top-spacer';
                        return <div className={spacerClass} />;
                    }

                    case NavigationPaneItemType.BOTTOM_SPACER: {
                        return <div className="nn-nav-bottom-spacer" />;
                    }

                    case NavigationPaneItemType.LIST_SPACER: {
                        const spacerClass = item.hasSeparator ? 'nn-nav-list-spacer nn-nav-spacer--with-separator' : 'nn-nav-list-spacer';
                        return <div className={spacerClass} />;
                    }

                    case NavigationPaneItemType.ROOT_SPACER: {
                        return <div className="nn-nav-root-spacer" style={{ height: `${item.spacing}px` }} aria-hidden="true" />;
                    }

                    default:
                        return null;
                }
            },
            [
                expansionState.expandedFolders,
                expansionState.expandedTags,
                expansionState.expandedProperties,
                expansionState.expandedVirtualFolders,
                selectionState.selectionType,
                selectionState.selectedFolder?.path,
                selectionState.selectedTag,
                selectionState.selectedProperty,
                handleFolderToggle,
                handleFolderClick,
                handleFolderNameClick,
                handleFolderNameMouseDown,
                handleTagToggle,
                handlePropertyToggle,
                handleTagClick,
                handlePropertyClick,
                handleTagCollectionClick,
                handlePropertyCollectionClick,
                handleSectionContextMenu,
                firstSectionId,
                firstInlineFolderPath,
                handleVirtualFolderToggle,
                shortcutsList.length,
                getAllDescendantFolders,
                getAllDescendantTags,
                getAllDescendantPropertyNodeIds,
                expansionDispatch,
                app.vault,
                settings,
                folderCounts,
                tagCounts,
                propertyCounts,
                getFolderShortcutCount,
                getTagShortcutCount,
                getPropertyShortcutCount,
                handleShortcutFolderActivate,
                handleShortcutNoteActivate,
                handleShortcutNoteMouseDown,
                handleShortcutSearchActivate,
                handleShortcutTagActivate,
                handleShortcutPropertyActivate,
                handleRecentNoteActivate,
                handleRecentFileContextMenu,
                handleShortcutContextMenu,
                removeShortcut,
                buildShortcutExternalHandlers,
                shortcutNumberBadgesByKey,
                shouldShowShortcutCounts,
                shortcutsExpanded,
                shouldPinShortcuts,
                shortcutHeaderTrailingAction,
                propertiesHeaderTrailingAction,
                showHiddenItems,
                recentNotesExpanded,
                getFileDisplayName,
                shortcutDragHandleConfig,
                activeShortcutId,
                shouldUseShortcutDnd,
                handleShortcutRootDragOver,
                handleShortcutRootDrop,
                allowEmptyShortcutDrop,
                getMissingNoteLabel,
                handleShortcutFolderNoteClick,
                handleShortcutFolderNoteMouseDown,
                isMobile,
                hasTagTokenSearchHighlights,
                hasPropertyTokenSearchHighlights,
                getFoldedTagPath,
                getFoldedPropertyNodeId,
                searchIncludeTokenSet,
                searchExcludeTokenSet,
                propertyIncludeTokenSet,
                propertyExcludeTokenSet,
                highlightRequireTagged,
                highlightExcludeTagged,
                highlightIncludeUntagged,
                indentGuideLevelsByKey,
                getSolidBackground,
                vaultChangeVersion
            ]
        );

        useEffect(() => {
            if (settings.showAllTagsFolder) {
                const shouldAutoExpandTags = !prevShowAllTagsFolder.current && settings.showAllTagsFolder;

                if (shouldAutoExpandTags && !expansionState.expandedVirtualFolders.has(TAGS_ROOT_VIRTUAL_FOLDER_ID)) {
                    expansionDispatch({ type: 'TOGGLE_VIRTUAL_FOLDER_EXPANDED', folderId: TAGS_ROOT_VIRTUAL_FOLDER_ID });
                }
            }

            prevShowAllTagsFolder.current = settings.showAllTagsFolder;
        }, [settings.showAllTagsFolder, expansionState.expandedVirtualFolders, expansionDispatch]);

        // Expose the virtualizer instance, path lookup method, and scroll container via the ref
        useImperativeHandle(
            ref,
            () => ({
                getIndexOfPath: (itemType: ItemType, path: string) => {
                    const index = getNavigationIndex(pathToIndex, itemType, path);
                    return index ?? -1;
                },
                virtualizer: rowVirtualizer,
                scrollContainerRef: scrollContainerRef.current,
                requestScroll,
                openShortcutByNumber: async (shortcutNumber: number) => {
                    if (!Number.isInteger(shortcutNumber) || shortcutNumber < 1) {
                        return false;
                    }

                    const entry = hydratedShortcuts[shortcutNumber - 1];
                    if (!entry || entry.isMissing) {
                        return false;
                    }

                    const { key, shortcut, folder, note, search, tagPath, propertyNodeId } = entry;

                    if (isFolderShortcut(shortcut) && folder) {
                        handleShortcutFolderActivate(folder, key);
                        return true;
                    }

                    if (isNoteShortcut(shortcut) && note) {
                        handleShortcutNoteActivate(note, key);
                        return true;
                    }

                    if (isSearchShortcut(shortcut)) {
                        handleShortcutSearchActivate(key, search ?? shortcut);
                        return true;
                    }

                    if (isTagShortcut(shortcut)) {
                        const resolvedTagPath = tagPath ?? shortcut.tagPath;
                        if (!resolvedTagPath) {
                            return false;
                        }
                        handleShortcutTagActivate(resolvedTagPath, key);
                        return true;
                    }

                    if (isPropertyShortcut(shortcut)) {
                        const resolvedNodeId = resolvePropertyShortcutNodeId(propertyNodeId, shortcut.nodeId);
                        if (!resolvedNodeId) {
                            return false;
                        }
                        return handleShortcutPropertyActivate(resolvedNodeId, key);
                    }

                    return false;
                }
            }),
            [
                pathToIndex,
                rowVirtualizer,
                requestScroll,
                scrollContainerRef,
                hydratedShortcuts,
                handleShortcutFolderActivate,
                handleShortcutNoteActivate,
                handleShortcutSearchActivate,
                handleShortcutTagActivate,
                handleShortcutPropertyActivate
            ]
        );

        // Add keyboard navigation
        // Note: We pass the root container ref, not the scroll container ref.
        // This ensures keyboard events work across the entire navigator, allowing
        // users to navigate between panes (navigation <-> files) with Tab/Arrow keys.
        const keyboardItems = isRootReorderMode ? [] : items;
        const keyboardPathToIndex = isRootReorderMode ? new Map<string, number>() : pathToIndex;

        useNavigationPaneKeyboard({
            items: keyboardItems,
            virtualizer: rowVirtualizer,
            containerRef: props.rootContainerRef,
            pathToIndex: keyboardPathToIndex
        });

        const navigationPaneStyle = useMemo<CSSPropertiesWithVars>(() => {
            return {
                ...(props.style ?? {}),
                // Used by `src/styles/sections/calendar.css` to size the rendered week rows.
                '--nn-calendar-week-count': calendarWeekCount
            };
        }, [calendarWeekCount, props.style]);

        const navigationToolbar = useMemo(() => {
            return (
                <NavigationToolbar
                    onTreeUpdateComplete={handleTreeUpdateComplete}
                    onToggleRootFolderReorder={handleToggleRootReorder}
                    rootReorderActive={isRootReorderMode}
                    rootReorderDisabled={!canReorderRootItems}
                />
            );
        }, [canReorderRootItems, handleToggleRootReorder, handleTreeUpdateComplete, isRootReorderMode]);

        const shouldRenderBottomToolbar = isMobile && !isAndroid;
        const shouldRenderBottomToolbarInsidePanel = shouldRenderBottomToolbar && shouldUseFloatingToolbars;
        const shouldRenderBottomToolbarOutsidePanel = shouldRenderBottomToolbar && !shouldUseFloatingToolbars;

        const navigationContent = (
            <div
                ref={navigationPaneRef}
                className="nn-navigation-pane"
                style={navigationPaneStyle}
                data-calendar={shouldRenderCalendarOverlay ? 'true' : undefined}
                data-shortcut-sorting={isShortcutSorting ? 'true' : undefined}
                data-shortcuts-resizing={!isMobile && isPinnedShortcutsResizing ? 'true' : undefined}
            >
                <div className="nn-navigation-pane-chrome">
                    <NavigationPaneHeader
                        onTreeUpdateComplete={handleTreeUpdateComplete}
                        onToggleRootFolderReorder={handleToggleRootReorder}
                        rootReorderActive={isRootReorderMode}
                        rootReorderDisabled={!canReorderRootItems}
                        showVaultTitleInHeader={shouldShowVaultTitleInHeader}
                    />
                    {shouldShowVaultTitleInNavigationPane ? <VaultTitleArea /> : null}
                    {/* Android - toolbar at top */}
                    {isMobile && isAndroid ? navigationToolbar : null}
                    {settings.pinNavigationBanner ? navigationBannerContent : null}
                    {shouldRenderPinnedShortcuts ? (
                        <div
                            className="nn-shortcut-pinned"
                            ref={pinnedShortcutsContainerRef}
                            role="presentation"
                            data-scroll={pinnedShortcutsHasOverflow ? 'true' : undefined}
                            style={pinnedShortcutsMaxHeight !== null ? { maxHeight: pinnedShortcutsMaxHeight } : undefined}
                            onDragOver={allowEmptyShortcutDrop ? handleShortcutRootDragOver : undefined}
                            onDrop={allowEmptyShortcutDrop ? handleShortcutRootDrop : undefined}
                        >
                            <div className="nn-shortcut-pinned-scroll" ref={pinnedShortcutsScrollRefCallback}>
                                <div className="nn-shortcut-pinned-inner">
                                    {pinnedNavigationItems.map(pinnedItem => (
                                        <React.Fragment key={pinnedItem.key}>{renderItem(pinnedItem)}</React.Fragment>
                                    ))}
                                </div>
                            </div>
                            <div
                                className="nn-shortcuts-resize-handle"
                                role="separator"
                                aria-orientation="horizontal"
                                aria-label="Resize pinned shortcuts"
                                onPointerDown={handlePinnedShortcutsResizePointerDown}
                            />
                        </div>
                    ) : null}
                </div>
                <div className="nn-navigation-pane-panel">
                    <div
                        ref={scrollContainerRefCallback}
                        className="nn-navigation-pane-scroller"
                        // Reserve permanent gutter width when a banner is visible so the scrollbar
                        // never changes clientWidth mid-resize (prevents RO feedback loops).
                        data-banner={hasNavigationBannerConfigured ? 'true' : undefined}
                        data-pane="navigation"
                        tabIndex={-1}
                    >
                        <div className="nn-navigation-pane-content">
                            {!settings.pinNavigationBanner && navigationBannerContent ? (
                                <div className="nn-navigation-pane-banner" ref={navigationBannerRef}>
                                    {navigationBannerContent}
                                </div>
                            ) : null}
                            <div role={isRootReorderMode ? 'list' : 'tree'}>
                                {isRootReorderMode ? (
                                    <NavigationRootReorderPanel
                                        sectionItems={sectionReorderItems}
                                        folderItems={folderReorderItems}
                                        tagItems={tagReorderItems}
                                        propertyItems={propertyReorderItems}
                                        showRootFolderSection={showRootFolderSection}
                                        showRootTagSection={showRootTagSection}
                                        showRootPropertySection={showRootPropertySection}
                                        foldersSectionExpanded={foldersSectionExpanded}
                                        tagsSectionExpanded={tagsSectionExpanded}
                                        propertiesSectionExpanded={propertiesSectionExpanded}
                                        showRootFolderReset={settings.rootFolderOrder.length > 0}
                                        showRootTagReset={settings.rootTagOrder.length > 0}
                                        showRootPropertyReset={settings.rootPropertyOrder.length > 0}
                                        resetRootTagOrderLabel={resetRootTagOrderLabel}
                                        resetRootPropertyOrderLabel={resetRootPropertyOrderLabel}
                                        onResetRootFolderOrder={handleResetRootFolderOrder}
                                        onResetRootTagOrder={handleResetRootTagOrder}
                                        onResetRootPropertyOrder={handleResetRootPropertyOrder}
                                        onReorderSections={reorderSectionOrder}
                                        onReorderFolders={reorderRootFolderOrder}
                                        onReorderTags={reorderRootTagOrder}
                                        onReorderProperties={reorderRootPropertyOrder}
                                        canReorderSections={canReorderSections}
                                        canReorderFolders={canReorderRootFolders}
                                        canReorderTags={canReorderRootTags}
                                        canReorderProperties={canReorderRootProperties}
                                        isMobile={isMobile}
                                    />
                                ) : (
                                    items.length > 0 && (
                                        <div
                                            className="nn-virtual-container"
                                            style={{
                                                height: `${rowVirtualizer.getTotalSize()}px`
                                            }}
                                        >
                                            {rowVirtualizer.getVirtualItems().map(virtualItem => {
                                                // Safe array access
                                                const item =
                                                    virtualItem.index >= 0 && virtualItem.index < items.length
                                                        ? items[virtualItem.index]
                                                        : null;
                                                if (!item) return null;

                                                return (
                                                    <div
                                                        key={virtualItem.key}
                                                        data-index={virtualItem.index}
                                                        className="nn-virtual-nav-item"
                                                        style={{
                                                            // When a non-pinned banner is rendered above the virtual list inside the scroller,
                                                            // TanStack Virtual scrollMargin includes its height. The virtual container sits below the
                                                            // banner in normal flow, so subtract the scrollMargin to position rows correctly.
                                                            transform: `translateY(${Math.max(0, virtualItem.start - navigationScrollMargin)}px)`
                                                        }}
                                                    >
                                                        {renderItem(item)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                    {/* iOS (Obsidian 1.11+): keep the floating toolbar inside the panel */}
                    {shouldRenderBottomToolbarInsidePanel ? <div className="nn-pane-bottom-toolbar">{navigationToolbar}</div> : null}
                </div>
                {shouldRenderCalendarOverlay ? (
                    <div className="nn-navigation-calendar-overlay">
                        <Calendar onWeekCountChange={setCalendarWeekCount} onAddDateFilter={onModifySearchWithDateFilter} />
                    </div>
                ) : null}
                {shouldRenderBottomToolbarOutsidePanel ? <div className="nn-pane-bottom-toolbar">{navigationToolbar}</div> : null}
            </div>
        );

        // Shortcuts stay virtualized while sorting to avoid rebuilding the navigator tree.
        // Only visible shortcut rows mount useSortable, so off-screen shortcuts are not drop targets and scrolling mid-drag can unmount the active row.
        // Auto-scroll remains disabled during shortcut sorting to prevent virtualizer thrash while items mount/unmount during drag.
        return (
            <DndContext
                sensors={shouldUseShortcutDnd ? shortcutSensors : []}
                collisionDetection={shouldUseShortcutDnd ? closestCenter : undefined}
                modifiers={shouldUseShortcutDnd ? [verticalAxisOnly] : undefined}
                onDragStart={shouldUseShortcutDnd ? handleShortcutDragStart : undefined}
                onDragEnd={shouldUseShortcutDnd ? handleShortcutDragEnd : undefined}
                onDragCancel={shouldUseShortcutDnd ? handleShortcutDragCancel : undefined}
                autoScroll={shouldUseShortcutDnd ? false : undefined}
            >
                <SortableContext items={shouldUseShortcutDnd ? shortcutIds : []} strategy={verticalListSortingStrategy}>
                    {navigationContent}
                </SortableContext>
            </DndContext>
        );
    })
);
