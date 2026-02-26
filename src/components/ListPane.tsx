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
 *    - Dynamic height calculation based on content (preview text, tags, metadata)
 *    - Direct memory cache lookups in estimateSize function
 *    - Virtualizer resets only when list order changes (tracked by key)
 *
 * 3. List building optimization:
 *    - useMemo rebuilds list items only when dependencies change
 *    - File filtering happens once during list build
 *    - Sort operations optimized with pre-computed values
 *    - Pinned files handled separately for efficiency
 *
 * 4. Event handling:
 *    - Debounced vault event handlers via forceUpdate
 *    - Selective updates based on file location (folder/tag context)
 *    - Database content changes trigger selective remeasurement
 *
 * 5. Selection handling:
 *    - Stable file index for onClick handlers
 *    - Multi-selection support without re-render
 *    - Keyboard navigation optimized
 */

import React, { useCallback, useRef, useEffect, useImperativeHandle, forwardRef, useState, useMemo } from 'react';
import { TFile, TFolder, Platform, requireApiVersion, debounce } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useSelectionState, useSelectionDispatch, resolvePrimarySelectedFile } from '../context/SelectionContext';
import { useServices } from '../context/ServicesContext';
import { useSettingsState, useActiveProfile } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useMultiSelection } from '../hooks/useMultiSelection';
import { useListPaneKeyboard } from '../hooks/useListPaneKeyboard';
import { useListPaneData } from '../hooks/useListPaneData';
import { useListPaneScroll } from '../hooks/useListPaneScroll';
import { useListPaneTitle } from '../hooks/useListPaneTitle';
import { useListPaneAppearance } from '../hooks/useListPaneAppearance';
import { useContextMenu } from '../hooks/useContextMenu';
import { useFileOpener } from '../hooks/useFileOpener';
import { strings } from '../i18n';
import { TIMEOUTS } from '../types/obsidian-extended';
import {
    IOS_OBSIDIAN_1_11_PLUS_GLASS_TOOLBAR_HEIGHT_PX,
    ListPaneItemType,
    PINNED_SECTION_HEADER_KEY,
    PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
    TAGGED_TAG_ID,
    UNTAGGED_TAG_ID,
    type CSSPropertiesWithVars
} from '../types';
import { getEffectiveSortOption } from '../utils/sortUtils';
import { FileItem } from './FileItem';
import { ListPaneHeader } from './ListPaneHeader';
import { ListToolbar } from './ListToolbar';
import { Calendar } from './calendar';
import { SearchInput } from './SearchInput';
import { ListPaneTitleArea } from './ListPaneTitleArea';
import { InputModal } from '../modals/InputModal';
import { useShortcuts } from '../context/ShortcutsContext';
import {
    ShortcutStartType,
    isShortcutStartFolder,
    isShortcutStartProperty,
    isShortcutStartTag,
    type SearchShortcut,
    type ShortcutStartTarget
} from '../types/shortcuts';
import { EMPTY_SEARCH_NAV_FILTER_STATE, type SearchNavFilterState, type SearchProvider } from '../types/search';
import { EMPTY_LIST_MENU_TYPE } from '../utils/contextMenu';
import { useUXPreferenceActions, useUXPreferences } from '../context/UXPreferencesContext';
import { normalizeTagPath } from '../utils/tagUtils';
import {
    parseFilterSearchTokens,
    updateFilterQueryWithDateToken,
    updateFilterQueryWithTag,
    updateFilterQueryWithProperty,
    type InclusionOperator
} from '../utils/filterSearch';
import { useSurfaceColorVariables } from '../hooks/useSurfaceColorVariables';
import { LIST_PANE_SURFACE_COLOR_MAPPINGS } from '../constants/surfaceColorMappings';
import { runAsyncAction } from '../utils/async';
import { isCmdCtrlModifierPressed, isMultiSelectModifierPressed, resolveFolderNoteClickOpenContext } from '../utils/keyboardOpenContext';
import { openFileInContext } from '../utils/openFileInContext';
import { getListPaneMeasurements } from '../utils/listPaneMeasurements';
import { ServiceIcon } from './ServiceIcon';
import { resolveUXIcon } from '../utils/uxIcons';
import { showNotice } from '../utils/noticeUtils';
import { focusElementPreventScroll, isKeyboardEventContextBlocked } from '../utils/domUtils';
import { buildPropertyKeyNodeId, buildPropertyValueNodeId, parsePropertyNodeId } from '../utils/propertyTree';
import { getFolderNote, openFolderNoteFile } from '../utils/folderNotes';
import { getActivePropertyKeySet } from '../utils/vaultProfiles';
import { DateUtils } from '../utils/dateUtils';
import { normalizeOptionalVaultFolderPath } from '../utils/pathUtils';
import type { NavigateToFolderOptions, RevealPropertyOptions, RevealTagOptions } from '../hooks/useNavigatorReveal';

/**
 * Renders the list pane displaying files from the selected folder.
 * Handles file sorting, grouping by date or folder, pinned notes, and auto-selection.
 * Integrates with the app context to manage file selection and navigation.
 *
 * @returns A scrollable list of files grouped by date or folder with empty state handling
 */
interface ExecuteSearchShortcutParams {
    searchShortcut: SearchShortcut;
}

/**
 * Options for selecting a file programmatically
 */
export interface SelectFileOptions {
    /** Mark the selection as keyboard navigation to prevent scroll interference */
    markKeyboardNavigation?: boolean;
    /** Mark the selection as user-initiated to track explicit user actions */
    markUserSelection?: boolean;
    /** Debounce opening the file after selection */
    debounceOpen?: boolean;
    /** Skip opening the file after selection */
    suppressOpen?: boolean;
}

export interface ListPaneHandle {
    getIndexOfPath: (path: string) => number;
    virtualizer: Virtualizer<HTMLDivElement, Element> | null;
    scrollContainerRef: HTMLDivElement | null;
    selectFile: (file: TFile, options?: SelectFileOptions) => void;
    selectAdjacentFile: (direction: 'next' | 'previous') => boolean;
    modifySearchWithTag: (tag: string, operator: InclusionOperator) => void;
    modifySearchWithProperty: (key: string, value: string | null, operator: InclusionOperator) => void;
    modifySearchWithDateToken: (dateToken: string) => void;
    toggleSearch: () => void;
    executeSearchShortcut: (params: ExecuteSearchShortcutParams) => Promise<void>;
}

interface EnsureSelectionOptions {
    openInEditor?: boolean;
    clearIfEmpty?: boolean;
    selectFallback?: boolean;
    debounceOpen?: boolean;
}

interface EnsureSelectionResult {
    selectionStateChanged: boolean;
}

interface ListPaneProps {
    /**
     * Reference to the root navigator container (.nn-split-container).
     * This is passed from NotebookNavigatorComponent to ensure keyboard events
     * are captured at the navigator level, not globally. This allows proper
     * keyboard navigation between panes while preventing interference with
     * other Obsidian views.
     */
    rootContainerRef: React.RefObject<HTMLDivElement | null>;
    /**
     * Optional resize handle props for dual-pane mode.
     * When provided, renders a resize handle overlay on the list pane boundary.
     */
    resizeHandleProps?: {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    };
    /**
     * Callback invoked whenever tag-related search tokens change.
     */
    onSearchTokensChange?: (state: SearchNavFilterState) => void;
    onNavigateToFolder: (folderPath: string, options?: NavigateToFolderOptions) => void;
    onRevealTag: (tagPath: string, options?: RevealTagOptions) => void;
    onRevealProperty: (propertyNodeId: string, options?: RevealPropertyOptions) => boolean;
}

interface ListPaneTitleChromeProps {
    onHeaderClick?: () => void;
    isSearchActive?: boolean;
    onSearchToggle?: () => void;
    shouldShowDesktopTitleArea: boolean;
    children: React.ReactNode;
}

interface FolderGroupHeaderTarget {
    folder: TFolder;
    folderNote: TFile | null;
}

function formatSearchShortcutFolderLabel(folderPath: string): string {
    if (folderPath === '/' || folderPath.startsWith('/')) {
        return folderPath;
    }

    return `/${folderPath}`;
}

function formatSearchShortcutTagLabel(tagPath: string): string {
    if (tagPath === TAGGED_TAG_ID) {
        return strings.tagList.tags;
    }

    if (tagPath === UNTAGGED_TAG_ID) {
        return strings.common.untagged;
    }

    if (tagPath.startsWith('#')) {
        return tagPath;
    }

    return `#${tagPath}`;
}

function formatSearchShortcutPropertyLabel(nodeId: string): string {
    if (nodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
        return strings.navigationPane.properties;
    }

    const parsed = parsePropertyNodeId(nodeId);
    if (!parsed) {
        return nodeId;
    }

    if (parsed.valuePath) {
        return parsed.valuePath;
    }

    return parsed.key;
}

function formatSearchShortcutStartTargetPath(startTarget: ShortcutStartTarget): string {
    switch (startTarget.type) {
        case ShortcutStartType.FOLDER:
            return formatSearchShortcutFolderLabel(startTarget.path);
        case ShortcutStartType.TAG:
            return formatSearchShortcutTagLabel(startTarget.tagPath);
        case ShortcutStartType.PROPERTY:
            return formatSearchShortcutPropertyLabel(startTarget.nodeId);
    }
}

function ListPaneTitleChrome({
    onHeaderClick,
    isSearchActive,
    onSearchToggle,
    shouldShowDesktopTitleArea,
    children
}: ListPaneTitleChromeProps) {
    const { desktopTitle, breadcrumbSegments, iconName, showIcon } = useListPaneTitle();
    return (
        <>
            <ListPaneHeader
                onHeaderClick={onHeaderClick}
                isSearchActive={isSearchActive}
                onSearchToggle={onSearchToggle}
                desktopTitle={desktopTitle}
                breadcrumbSegments={breadcrumbSegments}
                iconName={iconName}
                showIcon={showIcon}
            />
            {children}
            {shouldShowDesktopTitleArea ? <ListPaneTitleArea desktopTitle={desktopTitle} /> : null}
        </>
    );
}

export const ListPane = React.memo(
    forwardRef<ListPaneHandle, ListPaneProps>(function ListPane(props, ref) {
        const { app, commandQueue, isMobile, plugin } = useServices();
        const { onNavigateToFolder, onRevealTag, onRevealProperty } = props;
        const openFileInWorkspace = useFileOpener();
        const selectionState = useSelectionState();
        const selectionDispatch = useSelectionDispatch();
        const settings = useSettingsState();
        const activeProfile = useActiveProfile();
        const uxPreferences = useUXPreferences();
        const includeDescendantNotes = uxPreferences.includeDescendantNotes;
        const showHiddenItems = uxPreferences.showHiddenItems;
        const showCalendar = uxPreferences.showCalendar;
        const { setSearchActive } = useUXPreferenceActions();
        const appearanceSettings = useListPaneAppearance();
        const uiState = useUIState();
        const uiDispatch = useUIDispatch();
        const isVerticalDualPane = !uiState.singlePane && settings.dualPaneOrientation === 'vertical';
        const calendarPlacement = settings.calendarPlacement;
        const shouldRenderCalendarOverlay = calendarPlacement === 'left-sidebar' && showCalendar && isVerticalDualPane;
        const shortcuts = useShortcuts();
        const { addSearchShortcut, removeSearchShortcut, searchShortcutsByName } = shortcuts;
        const listPaneRef = useRef<HTMLDivElement>(null);
        // Android uses toolbar at top, iOS at bottom
        const isAndroid = Platform.isAndroidApp;
        /** Maps semi-transparent theme color variables to computed opaque equivalents (see constants/surfaceColorMappings). */
        useSurfaceColorVariables(listPaneRef, {
            app,
            rootContainerRef: props.rootContainerRef,
            variables: LIST_PANE_SURFACE_COLOR_MAPPINGS
        });
        const searchShortcuts = useMemo(() => Array.from(searchShortcutsByName.values()), [searchShortcutsByName]);
        const [isSavingSearchShortcut, setIsSavingSearchShortcut] = useState(false);
        const [calendarWeekCount, setCalendarWeekCount] = useState<number>(() => settings.calendarWeeksToShow);
        const listPaneTitle = settings.listPaneTitle ?? 'header';
        const shouldShowDesktopTitleArea = !isMobile && listPaneTitle === 'list';
        const listMeasurements = getListPaneMeasurements(isMobile);
        const pinnedSectionIcon = useMemo(() => resolveUXIcon(settings.interfaceIcons, 'list-pinned'), [settings.interfaceIcons]);
        const topSpacerHeight = shouldShowDesktopTitleArea ? 0 : listMeasurements.topSpacer;
        const iconColumnStyle = useMemo(() => {
            if (settings.showFileIcons) {
                return undefined;
            }
            return {
                '--nn-file-icon-slot-width': '0px',
                '--nn-file-icon-slot-width-mobile': '0px',
                '--nn-file-icon-slot-gap': '0px'
            } as React.CSSProperties;
        }, [settings.showFileIcons]);
        const listPaneStyle = useMemo<CSSPropertiesWithVars>(() => {
            return {
                ...(iconColumnStyle ?? {}),
                '--nn-calendar-week-count': calendarWeekCount
            };
        }, [calendarWeekCount, iconColumnStyle]);

        useEffect(() => {
            if (settings.calendarWeeksToShow !== 6) {
                setCalendarWeekCount(settings.calendarWeeksToShow);
            }
        }, [settings.calendarWeeksToShow]);

        // Search state - use directly from settings for sync across devices
        const isSearchActive = uxPreferences.searchActive;
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
        const [searchQuery, setSearchQuery] = useState('');
        // Debounced search query used for data filtering to avoid per-keystroke spikes
        const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
        const [shouldFocusSearch, setShouldFocusSearch] = useState(false);
        // Callback to notify parent component of tag filter changes
        const { onSearchTokensChange } = props;
        const searchProvider: SearchProvider = settings.searchProvider ?? 'internal';

        // Pre-parsed search tokens matching the debounced query
        const debouncedSearchTokens = useMemo(
            () => parseFilterSearchTokens(isSearchActive ? debouncedSearchQuery : ''),
            [debouncedSearchQuery, isSearchActive]
        );
        const debouncedSearchMode = debouncedSearchTokens.mode;

        // Disable inline highlight when search is operating in tag filter mode
        const searchHighlightQuery = useMemo(() => {
            if (!isSearchActive) {
                return undefined;
            }
            if (debouncedSearchMode === 'tag') {
                return undefined;
            }
            return searchQuery;
        }, [isSearchActive, debouncedSearchMode, searchQuery]);

        // Check if the current search query matches any saved search
        const activeSearchShortcut = useMemo(() => {
            const normalizedQuery = searchQuery.trim();
            if (!normalizedQuery) {
                return null;
            }

            // Prefer exact provider match; otherwise reuse the first shortcut with the same query.
            // This intentionally treats same-query shortcuts across providers as one saved entry.
            const normalizedProvider = searchProvider ?? 'internal';
            let firstMatch: SearchShortcut | null = null;

            for (const saved of searchShortcuts) {
                if (saved.query !== normalizedQuery) {
                    continue;
                }

                if (!firstMatch) {
                    firstMatch = saved;
                }

                const savedProvider = saved.provider ?? 'internal';
                if (savedProvider === normalizedProvider) {
                    return saved;
                }
            }

            return firstMatch;
        }, [searchProvider, searchQuery, searchShortcuts]);

        // Clear search query when search is deactivated externally
        useEffect(() => {
            if (!isSearchActive && searchQuery) {
                setSearchQuery('');
            }
        }, [isSearchActive, searchQuery]);

        // Debounce the query passed into the data hook; keep immediate input for UI/HL
        useEffect(() => {
            if (!isSearchActive) {
                // Clear debounced value when search is not active
                if (debouncedSearchQuery) setDebouncedSearchQuery('');
                return;
            }
            // Skip scheduling if values are already in sync
            if (debouncedSearchQuery === searchQuery) {
                return;
            }
            const id = window.setTimeout(() => {
                setDebouncedSearchQuery(searchQuery);
            }, TIMEOUTS.DEBOUNCE_KEYBOARD);
            return () => window.clearTimeout(id);
        }, [searchQuery, isSearchActive, debouncedSearchQuery]);

        // Extract tag-related tokens from search query and notify parent for navigation pane highlighting
        useEffect(() => {
            if (!onSearchTokensChange) {
                return;
            }

            const trimmed = searchQuery.trim();
            if (!trimmed) {
                onSearchTokensChange(EMPTY_SEARCH_NAV_FILTER_STATE);
                return;
            }

            const tokens = parseFilterSearchTokens(trimmed);
            // Normalize and collect included tag tokens
            const includeSet = new Set<string>();
            tokens.includedTagTokens.forEach(token => {
                const normalized = normalizeTagPath(token);
                if (normalized) {
                    includeSet.add(normalized);
                }
            });

            // Normalize and collect excluded tag tokens
            const excludeSet = new Set<string>();
            tokens.excludeTagTokens.forEach(token => {
                const normalized = normalizeTagPath(token);
                if (normalized) {
                    excludeSet.add(normalized);
                }
            });

            const propertyIncludeSet = new Set<string>();
            tokens.propertyTokens.forEach(token => {
                if (token.value) {
                    propertyIncludeSet.add(buildPropertyValueNodeId(token.key, token.value));
                    return;
                }
                propertyIncludeSet.add(buildPropertyKeyNodeId(token.key));
            });

            const propertyExcludeSet = new Set<string>();
            tokens.excludePropertyTokens.forEach(token => {
                if (token.value) {
                    propertyExcludeSet.add(buildPropertyValueNodeId(token.key, token.value));
                    return;
                }
                propertyExcludeSet.add(buildPropertyKeyNodeId(token.key));
            });

            onSearchTokensChange({
                tags: {
                    include: Array.from(includeSet),
                    exclude: Array.from(excludeSet),
                    excludeTagged: tokens.excludeTagged,
                    includeUntagged: tokens.includeUntagged,
                    requireTagged: tokens.requireTagged
                },
                properties: {
                    include: Array.from(propertyIncludeSet),
                    exclude: Array.from(propertyExcludeSet)
                }
            });
        }, [searchQuery, onSearchTokensChange]);

        // Helper to toggle search state using UX preferences action
        const setIsSearchActive = useCallback(
            (active: boolean) => {
                setSearchActive(active);
            },
            [setSearchActive]
        );

        // Track if the file selection is from user click vs auto-selection
        const isUserSelectionRef = useRef(false);

        /**
         * Debounced keyboard preview-open pipeline (ArrowUp/ArrowDown/PageUp/PageDown).
         *
         * `useListPaneKeyboard` updates selection on keydown, but opening the file is handled here so
         * ListPane can debounce workspace leaf updates during rapid navigation.
         *
         * - `keyboardOpenPendingRef` tracks whether a debounced open is currently scheduled.
         * - `keyboardOpenFileRef` stores the file that should be opened when navigation settles.
         * - `keyboardOpenRequestIdRef` invalidates older scheduled opens when selection changes.
         *
         * The debouncer uses `resetTimer: true` so repeated keydown events keep pushing the open out
         * until the user stops navigating. `commitPendingKeyboardSelectionOpen` cancels the timer and opens
         * immediately on keyup.
         *
         * Safety: if selection changes from any other path (e.g. auto-reveal), cancel pending opens
         * so a stale debounced open cannot override the current selection.
         */
        // True while a debounced keyboard open is waiting to run.
        const keyboardOpenPendingRef = useRef(false);
        // Monotonic token used to invalidate older debounced open requests.
        const keyboardOpenRequestIdRef = useRef(0);
        // File currently targeted by keyboard-driven debounced open.
        const keyboardOpenFileRef = useRef<TFile | null>(null);
        // Tracks whether the current folder/tag change originated from a physical navigation key.
        const navigationPhysicalKeyOpenRef = useRef(false);
        // Stores the latest commit callback so DOM event listeners can call current logic without re-subscribing.
        const commitPendingKeyboardSelectionOpenRef = useRef<() => void>(() => {});
        // Mirrors focused pane for container-level key listeners.
        const focusedPaneRef = useRef(uiState.focusedPane);

        const debouncedOpenFileInWorkspace = useMemo(() => {
            return debounce(
                (file: TFile, requestId: number) => {
                    if (requestId !== keyboardOpenRequestIdRef.current) {
                        return;
                    }

                    keyboardOpenPendingRef.current = false;
                    keyboardOpenFileRef.current = null;
                    openFileInWorkspace(file);
                },
                TIMEOUTS.DEBOUNCE_KEYBOARD_FILE_OPEN,
                true
            );
        }, [openFileInWorkspace]);

        useEffect(() => {
            return () => {
                debouncedOpenFileInWorkspace.cancel();
            };
        }, [debouncedOpenFileInWorkspace]);

        const clearPendingKeyboardOpen = useCallback(() => {
            // Increment request id so any older scheduled callback becomes a no-op.
            keyboardOpenRequestIdRef.current += 1;
            // Reset pending state and file target.
            keyboardOpenPendingRef.current = false;
            keyboardOpenFileRef.current = null;
            // Cancel timer so no delayed open executes after state has moved on.
            debouncedOpenFileInWorkspace.cancel();
        }, [debouncedOpenFileInWorkspace]);

        // Keep track of the last selected file path to maintain visual selection during transitions
        const lastSelectedFilePathRef = useRef<string | null>(null);

        // Initialize multi-selection hook
        const multiSelection = useMultiSelection();

        /**
         * Selects a file from the list pane and opens it in the active leaf.
         * Shared between keyboard navigation and command handlers.
         */
        const selectFileFromList = useCallback(
            (file: TFile, options?: SelectFileOptions) => {
                if (!file) {
                    return;
                }

                // Track whether this selection originated from explicit user interaction
                isUserSelectionRef.current = options?.markUserSelection ?? false;

                // Update the selected file in global state
                selectionDispatch({ type: 'SET_SELECTED_FILE', file });

                // Mark as keyboard-driven to prevent automatic scroll interference
                if (options?.markKeyboardNavigation) {
                    selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: true });
                }

                if (options?.suppressOpen) {
                    // Selection can change without opening editor (for example, new-tab shortcuts).
                    // Cancel pending keyboard opens so this selection does not trigger an unexpected open later.
                    clearPendingKeyboardOpen();
                    return;
                }

                // Open file in the active leaf without moving focus
                if (options?.debounceOpen) {
                    // New selection means new request token; older debounced callbacks are invalidated.
                    keyboardOpenRequestIdRef.current += 1;
                    const requestId = keyboardOpenRequestIdRef.current;
                    // Mark pending state for keyup commit path.
                    keyboardOpenPendingRef.current = true;
                    keyboardOpenFileRef.current = file;
                    debouncedOpenFileInWorkspace(file, requestId);
                    return;
                }

                // Non-debounced selection should clear any pending keyboard timer first.
                clearPendingKeyboardOpen();
                openFileInWorkspace(file);
            },
            [selectionDispatch, openFileInWorkspace, clearPendingKeyboardOpen, debouncedOpenFileInWorkspace]
        );

        const scheduleKeyboardOpen = useCallback(
            (file: TFile) => {
                // Schedules a debounced open for the current keyboard selection.
                // Incrementing the request id invalidates previously scheduled opens.
                // The open is committed on keyup by `useListPaneKeyboard`.
                keyboardOpenRequestIdRef.current += 1;
                const requestId = keyboardOpenRequestIdRef.current;

                keyboardOpenPendingRef.current = true;
                keyboardOpenFileRef.current = file;
                debouncedOpenFileInWorkspace(file, requestId);
            },
            [debouncedOpenFileInWorkspace]
        );

        const scheduleKeyboardSelectionOpen = useCallback(() => {
            if (settings.enterToOpenFiles) {
                // Enter-to-open mode does not preview files while navigating.
                return;
            }

            // Used when navigation keys are pressed but selection cannot move (e.g. at the top/bottom).
            // This keeps the pending debounced open aligned with the current selection.
            const primarySelectedFile = resolvePrimarySelectedFile(app, selectionState);
            const fileToOpen = primarySelectedFile ?? keyboardOpenFileRef.current;
            if (!fileToOpen) {
                // Nothing selected and no pending fallback target.
                return;
            }

            scheduleKeyboardOpen(fileToOpen);
        }, [app, selectionState, settings.enterToOpenFiles, scheduleKeyboardOpen]);

        const scheduleKeyboardSelectionOpenForFile = useCallback(
            (file: TFile) => {
                if (settings.enterToOpenFiles) {
                    // Enter-to-open mode disables navigation-preview opens.
                    return;
                }

                // Used when the selection cursor moves without calling `selectFileAtIndex()` with `debounceOpen`,
                // such as Shift+Arrow range selection.
                scheduleKeyboardOpen(file);
            },
            [settings.enterToOpenFiles, scheduleKeyboardOpen]
        );

        const commitPendingKeyboardSelectionOpen = useCallback(() => {
            if (settings.enterToOpenFiles) {
                // Explicit Enter key is the only open action in this mode.
                return;
            }

            if (!keyboardOpenPendingRef.current) {
                // No pending request means there is nothing to commit on keyup.
                return;
            }

            const selectedFileToOpen = keyboardOpenFileRef.current ?? resolvePrimarySelectedFile(app, selectionState);
            if (!selectedFileToOpen) {
                // Pending state exists but target file was cleared.
                return;
            }

            // Clear timer/request state before opening to avoid duplicate opens.
            clearPendingKeyboardOpen();
            openFileInWorkspace(selectedFileToOpen);
        }, [app, selectionState, settings.enterToOpenFiles, clearPendingKeyboardOpen, openFileInWorkspace]);

        const primarySelectedFilePathForKeyboardOpen = useMemo(() => {
            if (selectionState.selectedFile) {
                return selectionState.selectedFile.path;
            }
            const iterator = selectionState.selectedFiles.values().next();
            return iterator.done ? null : iterator.value;
        }, [selectionState.selectedFile, selectionState.selectedFiles]);

        useEffect(() => {
            // Keep a stable ref to latest callback for external key listeners.
            commitPendingKeyboardSelectionOpenRef.current = commitPendingKeyboardSelectionOpen;
        }, [commitPendingKeyboardSelectionOpen]);

        useEffect(() => {
            if (!keyboardOpenPendingRef.current) {
                return;
            }

            const pendingFilePath = keyboardOpenFileRef.current?.path ?? null;
            if (!pendingFilePath || pendingFilePath !== primarySelectedFilePathForKeyboardOpen) {
                // Selection changed while a debounced open was pending.
                // Invalidate and cancel so we don't open a file that is no longer selected.
                clearPendingKeyboardOpen();
            }
        }, [primarySelectedFilePathForKeyboardOpen, clearPendingKeyboardOpen]);

        useEffect(() => {
            if (!settings.enterToOpenFiles || !keyboardOpenPendingRef.current) {
                return;
            }

            // Enter-to-open disables automatic keyboard commit paths.
            clearPendingKeyboardOpen();
        }, [settings.enterToOpenFiles, clearPendingKeyboardOpen]);

        useEffect(() => {
            focusedPaneRef.current = uiState.focusedPane;
            if (uiState.focusedPane !== 'navigation') {
                // Leaving navigation pane invalidates "physical navigation key" context.
                navigationPhysicalKeyOpenRef.current = false;
            }
        }, [uiState.focusedPane]);

        useEffect(() => {
            const resetPhysicalNavigationKeyState = () => {
                // If window loses focus, keyup may never arrive. Reset physical-key tracking.
                navigationPhysicalKeyOpenRef.current = false;
            };

            window.addEventListener('blur', resetPhysicalNavigationKeyState);
            return () => {
                window.removeEventListener('blur', resetPhysicalNavigationKeyState);
            };
        }, []);

        useEffect(() => {
            const container = props.rootContainerRef.current;
            if (!container) {
                return;
            }

            const isPhysicalNavigationKey = (event: KeyboardEvent) => {
                // These keys can trigger folder/tag traversal and first-file auto-select.
                return event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'PageUp' || event.key === 'PageDown';
            };

            const hasDisallowedModifiers = (event: KeyboardEvent) => {
                // Ctrl/Meta/Alt variants represent command shortcuts, not plain navigation traversal.
                return event.ctrlKey || event.metaKey || event.altKey;
            };

            const handleNavigationKeyDown = (event: KeyboardEvent) => {
                if (focusedPaneRef.current !== 'navigation') {
                    // Ignore events when navigation pane is not active.
                    navigationPhysicalKeyOpenRef.current = false;
                    return;
                }

                if (isKeyboardEventContextBlocked(event)) {
                    // Ignore typing/modal contexts and clear stale physical-key state.
                    navigationPhysicalKeyOpenRef.current = false;
                    return;
                }

                if (hasDisallowedModifiers(event)) {
                    // Modified shortcuts should not mark folder auto-open flow as physical navigation.
                    navigationPhysicalKeyOpenRef.current = false;
                    return;
                }

                // Store whether this keydown is one of the physical traversal keys.
                navigationPhysicalKeyOpenRef.current = isPhysicalNavigationKey(event);
            };

            const handleNavigationKeyUp = (event: KeyboardEvent) => {
                if (focusedPaneRef.current !== 'navigation') {
                    // Ignore events when navigation pane is not active.
                    navigationPhysicalKeyOpenRef.current = false;
                    return;
                }

                if (isKeyboardEventContextBlocked(event)) {
                    // Ignore typing/modal contexts and clear stale physical-key state.
                    navigationPhysicalKeyOpenRef.current = false;
                    return;
                }

                if (hasDisallowedModifiers(event)) {
                    // Modified shortcuts should not commit keyboard preview opens.
                    navigationPhysicalKeyOpenRef.current = false;
                    return;
                }

                if (!isPhysicalNavigationKey(event)) {
                    // Only Arrow/Page keyup commits pending preview-open state.
                    navigationPhysicalKeyOpenRef.current = false;
                    return;
                }

                // Commit the final auto-selected file after keyboard folder/tag navigation settles.
                commitPendingKeyboardSelectionOpenRef.current();
                navigationPhysicalKeyOpenRef.current = false;
            };

            // Capture keydown so keyboard-origin metadata is available before pane handlers update selection.
            container.addEventListener('keydown', handleNavigationKeyDown, true);
            // Keyup is used to commit pending file-open request when navigation settles.
            container.addEventListener('keyup', handleNavigationKeyUp);
            return () => {
                container.removeEventListener('keydown', handleNavigationKeyDown, true);
                container.removeEventListener('keyup', handleNavigationKeyUp);
            };
        }, [props.rootContainerRef]);

        // Track render count
        const renderCountRef = useRef(0);

        const { selectionType, selectedFolder, selectedTag, selectedProperty, selectedFile } = selectionState;

        // Determine if list pane is visible early to optimize
        const isVisible = !uiState.singlePane || uiState.currentSinglePaneView === 'files';

        // Use the new data hook
        const { listItems, orderedFiles, orderedFileIndexMap, filePathToIndex, fileIndexMap, files, localDayKey } = useListPaneData({
            selectionType,
            selectedFolder,
            selectedTag,
            selectedProperty,
            settings,
            activeProfile,
            searchProvider,
            // Use debounced value for filtering
            searchQuery: isSearchActive ? debouncedSearchQuery : undefined,
            searchTokens: isSearchActive ? debouncedSearchTokens : undefined,
            visibility: { includeDescendantNotes, showHiddenItems }
        });
        const localDayReference = useMemo(() => DateUtils.parseLocalDayKey(localDayKey), [localDayKey]);

        // Determine the target folder path for drag-and-drop of external files
        const activeFolderDropPath = useMemo(() => {
            if (selectionType !== 'folder' || !selectedFolder) {
                return null;
            }
            return selectedFolder.path;
        }, [selectionType, selectedFolder]);

        const activeSearchShortcutStartTarget = useMemo<ShortcutStartTarget | undefined>(() => {
            if (selectionType === 'folder' && selectedFolder) {
                return {
                    type: ShortcutStartType.FOLDER,
                    path: selectedFolder.path
                };
            }

            if (selectionType === 'tag' && selectedTag) {
                return {
                    type: ShortcutStartType.TAG,
                    tagPath: selectedTag
                };
            }

            if (selectionType === 'property' && selectedProperty) {
                return {
                    type: ShortcutStartType.PROPERTY,
                    nodeId: selectedProperty
                };
            }

            return undefined;
        }, [selectionType, selectedFolder, selectedTag, selectedProperty]);

        const activeSearchShortcutStartTargetLabel = useMemo(() => {
            if (!activeSearchShortcutStartTarget) {
                return null;
            }

            return strings.searchInput.shortcutStartIn.replace(
                '{path}',
                formatSearchShortcutStartTargetPath(activeSearchShortcutStartTarget)
            );
        }, [activeSearchShortcutStartTarget]);

        // Flag to prevent automatic scroll to top when search is triggered from shortcut
        const suppressSearchTopScrollRef = useRef(false);
        const { visibleListPropertyKeys, visibleNavigationPropertyKeys } = useMemo(() => {
            return {
                visibleListPropertyKeys: getActivePropertyKeySet(settings, 'list'),
                visibleNavigationPropertyKeys: getActivePropertyKeySet(settings, 'navigation')
            };
        }, [settings]);
        const visibleListPropertyKeySignature = useMemo(() => {
            if (visibleListPropertyKeys.size === 0) {
                return '';
            }

            const sortedKeys = Array.from(visibleListPropertyKeys);
            sortedKeys.sort();
            return sortedKeys.join('\u0001');
        }, [visibleListPropertyKeys]);

        // Use the new scroll hook
        const { rowVirtualizer, scrollContainerRef, scrollContainerRefCallback, handleScrollToTop } = useListPaneScroll({
            listItems,
            filePathToIndex,
            selectedFile,
            selectedFolder,
            selectedTag,
            selectedProperty,
            settings,
            folderSettings: appearanceSettings,
            isVisible,
            selectionState,
            selectionDispatch,
            // Use debounced value for scroll orchestration to align with filtering
            searchQuery: isSearchActive ? debouncedSearchQuery : undefined,
            suppressSearchTopScrollRef,
            topSpacerHeight,
            includeDescendantNotes,
            visiblePropertyKeys: visibleListPropertyKeys,
            visiblePropertyKeySignature: visibleListPropertyKeySignature,
            scrollMargin: 0,
            scrollPaddingEnd
        });

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

            if (!selectedFile) {
                return;
            }

            const index = filePathToIndex.get(selectedFile.path);
            if (index === undefined) {
                return;
            }

            const scheduleScroll = () => rowVirtualizer.scrollToIndex(index, { align: 'auto' });

            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    requestAnimationFrame(scheduleScroll);
                });
                return;
            }

            setTimeout(scheduleScroll, 0);
        }, [calendarWeekCount, filePathToIndex, rowVirtualizer, selectedFile, shouldRenderCalendarOverlay]);

        const handleSearchToggle = useCallback(() => {
            if (!isSearchActive) {
                // Opening search - activate with focus
                setShouldFocusSearch(true);
                setIsSearchActive(true);
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                return;
            }

            // Closing search
            setIsSearchActive(false);
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
        }, [isSearchActive, setIsSearchActive, setShouldFocusSearch, uiDispatch]);

        const listToolbar = useMemo(() => {
            return <ListToolbar isSearchActive={isSearchActive} onSearchToggle={handleSearchToggle} />;
        }, [handleSearchToggle, isSearchActive]);

        // Attach context menu to empty areas in the list pane for file creation
        useContextMenu(scrollContainerRef, selectedFolder ? { type: EMPTY_LIST_MENU_TYPE, item: selectedFolder } : null);

        // Check if we're in compact mode
        const isCompactMode = !appearanceSettings.showDate && !appearanceSettings.showPreview && !appearanceSettings.showImage;

        // Ensure the list has a valid selection for the current filter
        const ensureSelectionForCurrentFilter = useCallback(
            (options?: EnsureSelectionOptions): EnsureSelectionResult => {
                // openInEditor means "open selection as part of sync"; enterToOpenFiles can disable that.
                const openInEditor = options?.openInEditor ?? false;
                const shouldOpenInEditor = openInEditor && !settings.enterToOpenFiles;
                // debounceOpen applies only when openInEditor is active.
                const debounceOpen = options?.debounceOpen ?? false;
                // clearIfEmpty allows caller to clear selection when filtered list has no files.
                const clearIfEmpty = options?.clearIfEmpty ?? false;
                // selectFallback allows choosing first file when current selection is missing/invalid.
                const selectFallback = options?.selectFallback ?? true;
                const hasNoSelection = !selectedFile;
                const selectedFileInList = selectedFile ? filePathToIndex.has(selectedFile.path) : false;
                const needsSelection = hasNoSelection || !selectedFileInList;

                if (needsSelection) {
                    if (selectFallback && orderedFiles.length > 0) {
                        // Use first visible file as deterministic fallback selection.
                        const firstFile = orderedFiles[0];
                        selectFileFromList(firstFile, {
                            suppressOpen: !shouldOpenInEditor,
                            debounceOpen: shouldOpenInEditor && debounceOpen
                        });
                        return { selectionStateChanged: true };
                    }

                    if (!selectFallback && clearIfEmpty && orderedFiles.length === 0) {
                        // Caller requested explicit clear when no filtered files are available.
                        selectionDispatch({ type: 'SET_SELECTED_FILE', file: null });
                        return { selectionStateChanged: true };
                    }

                    // No selectable fallback and no explicit clear requested.
                    return { selectionStateChanged: false };
                }

                if (shouldOpenInEditor && selectedFile && selectedFileInList) {
                    if (debounceOpen) {
                        // Schedule open for keyup/timer commit path.
                        scheduleKeyboardOpen(selectedFile);
                        return { selectionStateChanged: false };
                    }
                    // Open immediately when debounce is not requested.
                    openFileInWorkspace(selectedFile);
                }

                return { selectionStateChanged: false };
            },
            [
                selectedFile,
                orderedFiles,
                filePathToIndex,
                selectionDispatch,
                selectFileFromList,
                settings.enterToOpenFiles,
                scheduleKeyboardOpen,
                openFileInWorkspace
            ]
        );

        /**
         * Handles saving the current search query as a shortcut.
         * Opens a modal to get the shortcut name from the user.
         */
        const handleSaveSearchShortcut = useCallback(() => {
            const normalizedQuery = searchQuery.trim();
            if (!normalizedQuery || isSavingSearchShortcut) {
                return;
            }

            const startTarget = activeSearchShortcutStartTarget;
            const startTargetLabel = activeSearchShortcutStartTargetLabel;
            let modal: InputModal | null = null;

            modal = new InputModal(
                app,
                strings.searchInput.shortcutModalTitle,
                strings.searchInput.shortcutNamePlaceholder,
                async (rawName, context) => {
                    const trimmedName = rawName.trim();
                    if (trimmedName.length === 0) {
                        showNotice(strings.shortcuts.emptySearchName, { variant: 'warning' });
                        return;
                    }

                    setIsSavingSearchShortcut(true);
                    try {
                        const saveStartTarget = context?.checkboxValue ? startTarget : undefined;
                        const success = await addSearchShortcut({
                            name: trimmedName,
                            query: normalizedQuery,
                            provider: searchProvider,
                            startTarget: saveStartTarget
                        });
                        if (success) {
                            modal?.close();
                        }
                    } finally {
                        setIsSavingSearchShortcut(false);
                    }
                },
                normalizedQuery,
                {
                    closeOnSubmit: false,
                    checkbox: startTargetLabel
                        ? {
                              label: startTargetLabel,
                              defaultChecked: false
                          }
                        : undefined
                }
            );
            modal.open();
        }, [
            activeSearchShortcutStartTarget,
            activeSearchShortcutStartTargetLabel,
            app,
            addSearchShortcut,
            isSavingSearchShortcut,
            searchProvider,
            searchQuery
        ]);

        /**
         * Handles removing the currently active search shortcut.
         * Called when user clicks the remove button for a saved search.
         */
        const handleRemoveSearchShortcut = useCallback(async () => {
            if (!activeSearchShortcut || isSavingSearchShortcut) {
                return;
            }

            setIsSavingSearchShortcut(true);
            try {
                await removeSearchShortcut(activeSearchShortcut.name);
            } finally {
                setIsSavingSearchShortcut(false);
            }
        }, [activeSearchShortcut, isSavingSearchShortcut, removeSearchShortcut]);

        /**
         * Advances the selection to the next or previous file and syncs scroll position
         */
        const selectAdjacentFile = useCallback(
            (direction: 'next' | 'previous') => {
                if (orderedFiles.length === 0) {
                    return false;
                }

                // Resolve the currently selected file from state
                const currentFile = resolvePrimarySelectedFile(app, selectionState);
                const currentIndex = currentFile ? (orderedFileIndexMap.get(currentFile.path) ?? -1) : -1;

                // Calculate the target index based on direction, wrapping to start or end if no current selection
                const targetIndex =
                    currentIndex === -1
                        ? direction === 'next'
                            ? 0
                            : orderedFiles.length - 1
                        : direction === 'next'
                          ? currentIndex + 1
                          : currentIndex - 1;

                // Return false if target is out of bounds
                if (targetIndex < 0 || targetIndex >= orderedFiles.length) {
                    return false;
                }

                // Select the target file and scroll to it in the virtualized list
                const targetFile = orderedFiles[targetIndex];
                selectFileFromList(targetFile, {
                    markKeyboardNavigation: true,
                    markUserSelection: true,
                    suppressOpen: settings.enterToOpenFiles
                });
                const virtualIndex = filePathToIndex.get(targetFile.path);
                if (virtualIndex !== undefined) {
                    rowVirtualizer?.scrollToIndex(virtualIndex, { align: 'auto' });
                }

                return true;
            },
            [
                orderedFiles,
                orderedFileIndexMap,
                selectFileFromList,
                rowVirtualizer,
                app,
                selectionState,
                filePathToIndex,
                settings.enterToOpenFiles
            ]
        );

        const handleFileClick = useCallback(
            (file: TFile, e: React.MouseEvent, fileIndex?: number, orderedFiles?: TFile[]) => {
                // Ignore middle mouse button clicks - they're handled by onMouseDown
                if (e.button === 1) {
                    return;
                }

                isUserSelectionRef.current = true; // Mark this as a user selection

                const isShiftKey = e.shiftKey;
                const isCmdCtrlClick = isCmdCtrlModifierPressed(e);
                const shouldMultiSelect = !isMobile && isMultiSelectModifierPressed(e, settings.multiSelectModifier);

                const shouldOpenInNewTab =
                    !isMobile && !shouldMultiSelect && settings.multiSelectModifier === 'optionAlt' && isCmdCtrlClick;

                if (shouldMultiSelect) {
                    multiSelection.handleMultiSelectClick(file, fileIndex, orderedFiles);
                } else if (!isMobile && isShiftKey && fileIndex !== undefined && orderedFiles) {
                    multiSelection.handleRangeSelectClick(file, fileIndex, orderedFiles);
                } else {
                    selectFileFromList(file, {
                        markUserSelection: true,
                        suppressOpen: shouldOpenInNewTab
                    });
                }

                // Always ensure list pane has focus when clicking a file
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });

                if (!shouldMultiSelect && !isShiftKey) {
                    if (shouldOpenInNewTab) {
                        runAsyncAction(() => openFileInContext({ app, commandQueue, file, context: 'tab' }));
                    }
                }

                // Collapse left sidebar on mobile after opening file
                if (isMobile && app.workspace.leftSplit && !shouldMultiSelect && !isShiftKey) {
                    app.workspace.leftSplit.collapse();
                }
            },
            [app, commandQueue, isMobile, multiSelection, selectFileFromList, settings.multiSelectModifier, uiDispatch]
        );

        /**
         * Utility to wait for next animation frame for UI updates.
         * Ensures DOM changes are rendered before proceeding.
         */
        const waitForNextFrame = useCallback(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())), []);

        // Wait for mobile pane transition animation to complete
        const waitForMobilePaneTransition = useCallback(async () => {
            if (!isMobile) {
                return;
            }

            const container = props.rootContainerRef.current;
            if (!container) {
                return;
            }

            const targetClass = 'show-files';
            const TRANSITION_MS = settings.paneTransitionDuration;
            const SAFETY_MS = 20;
            const deadline = performance.now() + TRANSITION_MS + SAFETY_MS;

            while (performance.now() < deadline && container.isConnected && !container.classList.contains(targetClass)) {
                await new Promise(requestAnimationFrame);
            }
        }, [isMobile, props.rootContainerRef, settings.paneTransitionDuration]);

        // Move focus to the list pane scroll container
        const focusListScroller = useCallback(() => {
            const scope = props.rootContainerRef.current ?? document;
            const listPaneScroller = scope.querySelector('.nn-list-pane-scroller');
            if (listPaneScroller instanceof HTMLElement) {
                focusElementPreventScroll(listPaneScroller);
            }
        }, [props.rootContainerRef]);

        /**
         * Executes a saved search from a shortcut.
         * Switches search provider if needed and applies the saved query.
         */
        const executeSearchShortcut = useCallback(
            async ({ searchShortcut }: ExecuteSearchShortcutParams) => {
                const normalizedQuery = searchShortcut.query.trim();
                const targetProvider = searchShortcut.provider ?? 'internal';
                const startTarget = searchShortcut.startTarget;

                plugin.setSearchProvider(targetProvider);
                if (startTarget) {
                    if (isShortcutStartFolder(startTarget)) {
                        const normalizedStartFolder = normalizeOptionalVaultFolderPath(startTarget.path);
                        if (normalizedStartFolder) {
                            onNavigateToFolder(normalizedStartFolder, {
                                source: 'shortcut',
                                suppressAutoSelect: true,
                                skipScroll: settings.skipAutoScroll
                            });
                        }
                    } else if (isShortcutStartTag(startTarget)) {
                        onRevealTag(startTarget.tagPath, { source: 'shortcut', skipScroll: settings.skipAutoScroll });
                    } else if (isShortcutStartProperty(startTarget)) {
                        onRevealProperty(startTarget.nodeId, { source: 'shortcut', skipScroll: settings.skipAutoScroll });
                    }
                }

                const needsSearchActivation = !isSearchActive;
                if (uiState.singlePane) {
                    uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                }
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });

                // Prevent scroll to top on mobile when activating from shortcut
                if (isMobile) {
                    suppressSearchTopScrollRef.current = true;
                    await waitForMobilePaneTransition();
                }

                // Activate search
                if (needsSearchActivation) {
                    setIsSearchActive(true);
                }

                // Set the search query
                setShouldFocusSearch(false);
                setSearchQuery(normalizedQuery);
                setDebouncedSearchQuery(normalizedQuery);

                await waitForNextFrame();
                await waitForNextFrame();

                if (!isMobile) {
                    ensureSelectionForCurrentFilter({ openInEditor: false, clearIfEmpty: true, selectFallback: true });
                }

                focusListScroller();
            },
            [
                plugin,
                onNavigateToFolder,
                onRevealTag,
                onRevealProperty,
                settings.skipAutoScroll,
                isSearchActive,
                setIsSearchActive,
                uiState.singlePane,
                uiDispatch,
                isMobile,
                waitForMobilePaneTransition,
                setSearchQuery,
                setDebouncedSearchQuery,
                waitForNextFrame,
                ensureSelectionForCurrentFilter,
                focusListScroller,
                suppressSearchTopScrollRef
            ]
        );

        // Scroll to top handler for mobile header click
        // Get effective sort option for the current view
        const effectiveSortOption = getEffectiveSortOption(settings, selectionType, selectedFolder, selectedTag);

        // Create a stable onClick handler for FileItem that uses pre-calculated fileIndex
        const handleFileItemClick = useCallback(
            (file: TFile, fileIndex: number | undefined, event: React.MouseEvent) => {
                handleFileClick(file, event, fileIndex, orderedFiles);
            },
            [handleFileClick, orderedFiles]
        );

        const folderGroupHeaderTargets = useMemo<Map<string, FolderGroupHeaderTarget>>(() => {
            const targets = new Map<string, FolderGroupHeaderTarget>();

            listItems.forEach(item => {
                if (item.type !== ListPaneItemType.HEADER) {
                    return;
                }

                const folderPath = item.headerFolderPath;
                if (!folderPath || targets.has(folderPath)) {
                    return;
                }

                const folder = app.vault.getFolderByPath(folderPath);
                if (!folder) {
                    return;
                }

                const folderNote =
                    settings.enableFolderNotes && settings.enableFolderNoteLinks
                        ? getFolderNote(folder, {
                              enableFolderNotes: settings.enableFolderNotes,
                              folderNoteName: settings.folderNoteName,
                              folderNoteNamePattern: settings.folderNoteNamePattern
                          })
                        : null;

                targets.set(folderPath, { folder, folderNote });
            });

            return targets;
        }, [
            app.vault,
            listItems,
            settings.enableFolderNotes,
            settings.enableFolderNoteLinks,
            settings.folderNoteName,
            settings.folderNoteNamePattern
        ]);

        const handleFolderGroupHeaderClick = useCallback(
            (event: React.MouseEvent<HTMLSpanElement>, target: FolderGroupHeaderTarget) => {
                event.stopPropagation();
                const folderNote = target.folderNote;
                const navigateOptions: NavigateToFolderOptions = {
                    source: 'manual',
                    suppressAutoSelect: Boolean(folderNote)
                };
                onNavigateToFolder(target.folder.path, navigateOptions);

                if (!folderNote) {
                    return;
                }

                const openContext = resolveFolderNoteClickOpenContext(
                    event,
                    settings.openFolderNotesInNewTab,
                    settings.multiSelectModifier,
                    isMobile
                );

                runAsyncAction(() =>
                    openFolderNoteFile({
                        app,
                        commandQueue,
                        folder: target.folder,
                        folderNote,
                        context: openContext
                    })
                );
            },
            [settings.openFolderNotesInNewTab, settings.multiSelectModifier, isMobile, app, commandQueue, onNavigateToFolder]
        );

        const handleFolderGroupHeaderMouseDown = useCallback(
            (event: React.MouseEvent<HTMLSpanElement>, target: FolderGroupHeaderTarget) => {
                const folderNote = target.folderNote;
                if (event.button !== 1 || !folderNote) {
                    return;
                }

                // Middle-click opens folder notes in a new tab.
                event.preventDefault();
                event.stopPropagation();
                onNavigateToFolder(target.folder.path, { source: 'manual', suppressAutoSelect: true });

                runAsyncAction(() =>
                    openFolderNoteFile({
                        app,
                        commandQueue,
                        folder: target.folder,
                        folderNote,
                        context: 'tab'
                    })
                );
            },
            [app, commandQueue, onNavigateToFolder]
        );

        // Returns array element at index or undefined if out of bounds
        const safeGetItem = <T,>(array: T[], index: number): T | undefined => {
            return index >= 0 && index < array.length ? array[index] : undefined;
        };

        useEffect(() => {
            if (selectedFile) {
                lastSelectedFilePathRef.current = selectedFile.path;
            }
        }, [selectedFile]);

        // Auto-open file when it's selected via folder/tag change (not user click or keyboard navigation)
        useEffect(() => {
            // Check if this is a reveal operation - if so, skip auto-open
            const isRevealOperation = selectionState.isRevealOperation;
            const isFolderChangeWithAutoSelect = selectionState.isFolderChangeWithAutoSelect;
            const isKeyboardNavigation = selectionState.isKeyboardNavigation;

            // Skip auto-open if this is a reveal operation or keyboard navigation
            if (isRevealOperation || isKeyboardNavigation) {
                // Clear the keyboard navigation flag after processing
                if (isKeyboardNavigation) {
                    selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: false });
                }
                return;
            }

            // Debounce only when folder/tag auto-select came from physical navigation keys.
            const shouldDebounceFolderAutoOpen = isFolderChangeWithAutoSelect && navigationPhysicalKeyOpenRef.current;
            // Tracks whether helper updated selection state in this effect pass.
            let selectionStateChangedBySearchSync = false;
            // Tracks whether search-specific folder auto-select branch ran.
            let handledSearchFolderAutoSelect = false;

            // If search is active and auto-select is enabled, we need to select the first filtered file
            if (isSearchActive && settings.autoSelectFirstFileOnFocusChange && !isMobile && isFolderChangeWithAutoSelect) {
                // Ensure selection respects current filter and optionally clear selection if none
                const ensureResult = ensureSelectionForCurrentFilter({
                    openInEditor: true,
                    clearIfEmpty: true,
                    debounceOpen: shouldDebounceFolderAutoOpen
                });
                selectionStateChangedBySearchSync = ensureResult.selectionStateChanged;
                // Prevent generic open branch from re-running in same effect pass.
                handledSearchFolderAutoSelect = true;
            }

            if (
                !handledSearchFolderAutoSelect &&
                !selectionStateChangedBySearchSync &&
                selectedFile &&
                !isUserSelectionRef.current &&
                settings.autoSelectFirstFileOnFocusChange &&
                !isMobile
            ) {
                // Check if we're actively navigating the navigator
                const navigatorEl = document.querySelector('.nn-split-container');
                const hasNavigatorFocus = navigatorEl && navigatorEl.contains(document.activeElement);

                // Open the file if we're not actively using the navigator OR if this is a folder change with auto-select
                if (!hasNavigatorFocus || isFolderChangeWithAutoSelect) {
                    if (!settings.enterToOpenFiles) {
                        if (shouldDebounceFolderAutoOpen) {
                            // During key traversal, delay open so rapid navigation does not reopen every intermediate file.
                            scheduleKeyboardOpen(selectedFile);
                        } else {
                            // Non-physical or already-settled navigation opens immediately.
                            openFileInWorkspace(selectedFile);
                        }
                    }
                }
            }

            if (isFolderChangeWithAutoSelect) {
                // If selection state did not change as part of folder/tag sync, clear the flag explicitly.
                if (!selectionStateChangedBySearchSync) {
                    selectionDispatch({ type: 'SET_FOLDER_CHANGE_WITH_AUTO_SELECT', isFolderChangeWithAutoSelect: false });
                }
                // Auto-select scope is completed for this interaction.
                navigationPhysicalKeyOpenRef.current = false;
            }

            // Reset the flag after processing
            isUserSelectionRef.current = false;
        }, [
            selectedFile,
            settings.autoSelectFirstFileOnFocusChange,
            settings.enterToOpenFiles,
            isMobile,
            selectionState.isRevealOperation,
            selectionState.isFolderChangeWithAutoSelect,
            selectionState.isKeyboardNavigation,
            selectionDispatch,
            isSearchActive,
            files,
            ensureSelectionForCurrentFilter,
            scheduleKeyboardOpen,
            openFileInWorkspace
        ]);

        // Auto-select first file when navigating to files pane with keyboard in dual-pane mode
        useEffect(() => {
            // Only run in dual-pane mode on desktop when using keyboard navigation
            if (uiState.singlePane || isMobile) return;

            // Check if we just gained focus AND it's from keyboard navigation
            if (uiState.focusedPane === 'files' && selectionState.isKeyboardNavigation) {
                // Clear the keyboard navigation flag
                selectionDispatch({ type: 'SET_KEYBOARD_NAVIGATION', isKeyboardNavigation: false });

                // Determine if we need to select a file
                const hasNoSelection = !selectedFile;
                const selectedFileNotInFilteredList = selectedFile && !files.some(f => f.path === selectedFile.path);
                const needsSelection = hasNoSelection || selectedFileNotInFilteredList;

                if (needsSelection && files.length > 0) {
                    // Prefer currently active editor file if visible, otherwise ensure selection using helper
                    const activeFile = app.workspace.getActiveFile();
                    const activeFileInFilteredList = activeFile && files.some(f => f.path === activeFile.path);

                    if (activeFileInFilteredList) {
                        selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
                    } else {
                        ensureSelectionForCurrentFilter({ openInEditor: true });
                    }
                }
            }
        }, [
            uiState.focusedPane,
            uiState.singlePane,
            isMobile,
            selectionState.isKeyboardNavigation,
            selectedFile,
            files,
            selectionDispatch,
            app.workspace,
            ensureSelectionForCurrentFilter
        ]);

        renderCountRef.current++;

        // Expose the virtualizer instance and file lookup method via the ref
        const modifySearchWithTag = useCallback(
            (tag: string, operator: InclusionOperator) => {
                const normalizedTag = normalizeTagPath(tag);
                if (!normalizedTag || normalizedTag === UNTAGGED_TAG_ID) {
                    return;
                }

                if (!isSearchActive) {
                    setIsSearchActive(true);
                    if (uiState.singlePane) {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    }
                }

                setShouldFocusSearch(true);
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });

                let nextQueryValue: string | null = null;

                setSearchQuery(prev => {
                    const result = updateFilterQueryWithTag(prev, normalizedTag, operator);
                    nextQueryValue = result.query;
                    return result.query;
                });

                if (nextQueryValue !== null) {
                    setDebouncedSearchQuery(nextQueryValue);
                }
            },
            [
                setIsSearchActive,
                uiDispatch,
                setShouldFocusSearch,
                setSearchQuery,
                setDebouncedSearchQuery,
                isSearchActive,
                uiState.singlePane
            ]
        );

        const modifySearchWithProperty = useCallback(
            (key: string, value: string | null, operator: InclusionOperator) => {
                const normalizedKey = key.trim();
                if (!normalizedKey) {
                    return;
                }

                if (!isSearchActive) {
                    setIsSearchActive(true);
                    if (uiState.singlePane) {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    }
                }

                setShouldFocusSearch(true);
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });

                let nextQueryValue: string | null = null;

                setSearchQuery(prev => {
                    const result = updateFilterQueryWithProperty(prev, normalizedKey, value, operator);
                    nextQueryValue = result.query;
                    return result.query;
                });

                if (nextQueryValue !== null) {
                    setDebouncedSearchQuery(nextQueryValue);
                }
            },
            [
                setIsSearchActive,
                uiDispatch,
                setShouldFocusSearch,
                setSearchQuery,
                setDebouncedSearchQuery,
                isSearchActive,
                uiState.singlePane
            ]
        );

        const modifySearchWithDateToken = useCallback(
            (dateToken: string) => {
                const normalizedToken = dateToken.trim();
                if (!normalizedToken) {
                    return;
                }

                if (searchProvider !== 'internal') {
                    plugin.setSearchProvider('internal');
                }

                if (!isSearchActive) {
                    setIsSearchActive(true);
                    if (uiState.singlePane) {
                        uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                    }
                }

                setShouldFocusSearch(true);
                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });

                let nextQueryValue: string | null = null;

                setSearchQuery(prev => {
                    const result = updateFilterQueryWithDateToken(prev, normalizedToken);
                    nextQueryValue = result.query;
                    return result.query;
                });

                if (nextQueryValue !== null) {
                    setDebouncedSearchQuery(nextQueryValue);
                }
            },
            [
                setIsSearchActive,
                uiDispatch,
                setShouldFocusSearch,
                setSearchQuery,
                setDebouncedSearchQuery,
                isSearchActive,
                plugin,
                searchProvider,
                uiState.singlePane
            ]
        );

        useImperativeHandle(
            ref,
            () => ({
                getIndexOfPath: (path: string) => filePathToIndex.get(path) ?? -1,
                virtualizer: rowVirtualizer,
                scrollContainerRef: scrollContainerRef.current,
                // Allow parent components to trigger file selection programmatically
                selectFile: selectFileFromList,
                // Provide imperative adjacent navigation for command handlers
                selectAdjacentFile,
                // Toggle or modify search query to include/exclude a tag with AND/OR operator
                modifySearchWithTag,
                // Toggle or modify search query to include/exclude a property with AND/OR operator
                modifySearchWithProperty,
                // Replace the active search query with a date token
                modifySearchWithDateToken,
                // Toggle search mode on/off or focus existing search
                toggleSearch: () => {
                    if (isSearchActive) {
                        // Search is already open - just focus the search input
                        setTimeout(() => {
                            const scope = props.rootContainerRef.current ?? document;
                            const searchInput = scope.querySelector('.nn-search-input') as HTMLInputElement;
                            if (searchInput) {
                                searchInput.focus();
                                uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                            }
                        }, 0);
                    } else {
                        // Opening search - activate with focus
                        setShouldFocusSearch(true);
                        setIsSearchActive(true);
                        if (uiState.singlePane) {
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
                        }
                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'search' });
                    }
                },
                executeSearchShortcut
            }),
            [
                filePathToIndex,
                rowVirtualizer,
                scrollContainerRef,
                isSearchActive,
                uiDispatch,
                setIsSearchActive,
                setShouldFocusSearch,
                props.rootContainerRef,
                uiState.singlePane,
                executeSearchShortcut,
                selectFileFromList,
                selectAdjacentFile,
                modifySearchWithTag,
                modifySearchWithProperty,
                modifySearchWithDateToken
            ]
        );

        // Add keyboard navigation
        // Note: We pass the root container ref, not the scroll container ref.
        // This ensures keyboard events work across the entire navigator, allowing
        // users to navigate between panes (navigation <-> files) with Tab/Arrow keys.
        useListPaneKeyboard({
            items: listItems,
            virtualizer: rowVirtualizer,
            containerRef: props.rootContainerRef,
            pathToIndex: filePathToIndex,
            files,
            fileIndexMap,
            onSelectFile: (file, options) =>
                selectFileFromList(file, {
                    markKeyboardNavigation: true,
                    suppressOpen: settings.enterToOpenFiles || options?.suppressOpen,
                    debounceOpen: options?.debounceOpen
                }),
            onScheduleKeyboardOpen: scheduleKeyboardSelectionOpen,
            onScheduleKeyboardOpenForFile: scheduleKeyboardSelectionOpenForFile,
            onCommitKeyboardOpen: commitPendingKeyboardSelectionOpen
        });

        // Determine if we're showing empty state
        const isEmptySelection = !selectedFolder && !selectedTag && !selectedProperty;
        const hasNoFiles = files.length === 0;

        const shouldRenderBottomToolbar = isMobile && !isAndroid;
        const shouldRenderBottomToolbarInsidePanel = shouldRenderBottomToolbar && shouldUseFloatingToolbars;
        const shouldRenderBottomToolbarOutsidePanel = shouldRenderBottomToolbar && !shouldUseFloatingToolbars;

        // Single return with conditional content
        return (
            <div
                ref={listPaneRef}
                className={`nn-list-pane ${isSearchActive ? 'nn-search-active' : ''}`}
                style={listPaneStyle}
                data-calendar={shouldRenderCalendarOverlay ? 'true' : undefined}
            >
                {props.resizeHandleProps && <div className="nn-resize-handle" {...props.resizeHandleProps} />}
                <div className="nn-list-pane-chrome">
                    <ListPaneTitleChrome
                        onHeaderClick={handleScrollToTop}
                        isSearchActive={isSearchActive}
                        onSearchToggle={handleSearchToggle}
                        shouldShowDesktopTitleArea={shouldShowDesktopTitleArea}
                    >
                        {/* Android - toolbar at top */}
                        {isMobile && isAndroid ? listToolbar : null}
                        {/* Search bar - collapsible */}
                        <div className={`nn-search-bar-container ${isSearchActive ? 'nn-search-bar-visible' : ''}`}>
                            {isSearchActive && (
                                <SearchInput
                                    searchQuery={searchQuery}
                                    onSearchQueryChange={setSearchQuery}
                                    shouldFocus={shouldFocusSearch}
                                    onFocusComplete={() => setShouldFocusSearch(false)}
                                    onClose={() => {
                                        setIsSearchActive(false);
                                        uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'files' });
                                    }}
                                    onFocusFiles={() => {
                                        // Ensure selection exists when focusing list from search (no editor open)
                                        ensureSelectionForCurrentFilter({ openInEditor: false });
                                    }}
                                    containerRef={props.rootContainerRef}
                                    onSaveShortcut={!activeSearchShortcut ? handleSaveSearchShortcut : undefined}
                                    onRemoveShortcut={activeSearchShortcut ? handleRemoveSearchShortcut : undefined}
                                    isShortcutSaved={Boolean(activeSearchShortcut)}
                                    isShortcutDisabled={isSavingSearchShortcut}
                                    searchProvider={searchProvider}
                                />
                            )}
                        </div>
                    </ListPaneTitleChrome>
                </div>
                <div className="nn-list-pane-panel">
                    <div
                        ref={scrollContainerRefCallback}
                        className={`nn-list-pane-scroller ${!isEmptySelection && !hasNoFiles && isCompactMode ? 'nn-compact-mode' : ''}`}
                        // Drop zone type (folder or tag)
                        data-drop-zone={activeFolderDropPath ? 'folder' : undefined}
                        // Target path for the drop operation
                        data-drop-path={activeFolderDropPath ?? undefined}
                        // Block internal file moves to non-item areas
                        data-allow-internal-drop={activeFolderDropPath ? 'false' : undefined}
                        // Allow external file imports to non-item areas
                        data-allow-external-drop={activeFolderDropPath ? 'true' : undefined}
                        data-pane="files"
                        role="list"
                        tabIndex={-1}
                    >
                        <div className="nn-list-pane-content">
                            {isEmptySelection ? (
                                <div className="nn-empty-state">
                                    <div className="nn-empty-message">{strings.listPane.emptyStateNoSelection}</div>
                                </div>
                            ) : hasNoFiles ? (
                                <div className="nn-empty-state">
                                    <div className="nn-empty-message">{strings.listPane.emptyStateNoNotes}</div>
                                </div>
                            ) : (
                                listItems.length > 0 && (
                                    <div
                                        className="nn-virtual-container"
                                        style={{
                                            height: `${rowVirtualizer.getTotalSize()}px`
                                        }}
                                    >
                                        {rowVirtualizer.getVirtualItems().map(virtualItem => {
                                            const item = safeGetItem(listItems, virtualItem.index);
                                            if (!item) return null;
                                            // Check if file is selected
                                            let isSelected = false;
                                            if (item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
                                                isSelected = multiSelection.isFileSelected(item.data);

                                                // During folder navigation transitions, if nothing is selected in the current list,
                                                // maintain the last selected file's visual selection to prevent flicker
                                                if (!isSelected && selectionState.isFolderNavigation && lastSelectedFilePathRef.current) {
                                                    isSelected = item.data.path === lastSelectedFilePathRef.current;
                                                }
                                            }

                                            // Check if this is the last file item
                                            const nextItem = safeGetItem(listItems, virtualItem.index + 1);
                                            const isLastFile =
                                                item.type === ListPaneItemType.FILE &&
                                                (virtualItem.index === listItems.length - 1 ||
                                                    (nextItem &&
                                                        (nextItem.type === ListPaneItemType.HEADER ||
                                                            nextItem.type === ListPaneItemType.TOP_SPACER ||
                                                            nextItem.type === ListPaneItemType.BOTTOM_SPACER)));

                                            // Check if adjacent items are selected (for styling purposes)
                                            const prevItem = safeGetItem(listItems, virtualItem.index - 1);
                                            const hasSelectedAbove =
                                                item.type === ListPaneItemType.FILE &&
                                                prevItem?.type === ListPaneItemType.FILE &&
                                                prevItem.data instanceof TFile &&
                                                multiSelection.isFileSelected(prevItem.data);
                                            const hasSelectedBelow =
                                                item.type === ListPaneItemType.FILE &&
                                                nextItem?.type === ListPaneItemType.FILE &&
                                                nextItem.data instanceof TFile &&
                                                multiSelection.isFileSelected(nextItem.data);

                                            // Check if this is the first header (same logic as in estimateSize)
                                            // Index 1 because TOP_SPACER is at index 0
                                            const isFirstHeader = item.type === ListPaneItemType.HEADER && virtualItem.index === 1;
                                            const isPinnedHeader =
                                                item.type === ListPaneItemType.HEADER && item.key === PINNED_SECTION_HEADER_KEY;
                                            const headerLabel =
                                                item.type === ListPaneItemType.HEADER && typeof item.data === 'string' ? item.data : '';
                                            const headerFolderPath =
                                                item.type === ListPaneItemType.HEADER ? (item.headerFolderPath ?? null) : null;
                                            const folderGroupHeaderTarget =
                                                headerFolderPath !== null ? (folderGroupHeaderTargets.get(headerFolderPath) ?? null) : null;
                                            const isClickableFolderGroupHeader = Boolean(folderGroupHeaderTarget) && !isPinnedHeader;

                                            // Find current date group for file items
                                            let dateGroup: string | null = null;
                                            if (item.type === ListPaneItemType.FILE) {
                                                // Look backwards to find the most recent header
                                                for (let i = virtualItem.index - 1; i >= 0; i--) {
                                                    const prevItem = safeGetItem(listItems, i);
                                                    if (
                                                        prevItem &&
                                                        prevItem.type === ListPaneItemType.HEADER &&
                                                        typeof prevItem.data === 'string'
                                                    ) {
                                                        dateGroup = prevItem.data;
                                                        break;
                                                    }
                                                }
                                            }

                                            // Compute separator visibility (class-based, not relational selectors)
                                            // - Hide the current row's separator when this row is the last in a contiguous
                                            //   selected block (selected && !hasSelectedBelow)
                                            // - Also hide the current row's separator when the next row starts a selected block
                                            //   (!selected && next is selected) to remove the line just before a selection.
                                            const hideSeparator =
                                                item.type === ListPaneItemType.FILE &&
                                                ((isSelected && !hasSelectedBelow) ||
                                                    (!isSelected &&
                                                        nextItem?.type === ListPaneItemType.FILE &&
                                                        nextItem.data instanceof TFile &&
                                                        multiSelection.isFileSelected(nextItem.data)));

                                            return (
                                                <div
                                                    key={virtualItem.key}
                                                    // Apply a lightweight class to control separator visibility
                                                    className={`nn-virtual-item ${
                                                        item.type === ListPaneItemType.FILE ? 'nn-virtual-file-item' : ''
                                                    } ${isLastFile ? 'nn-last-file' : ''} ${
                                                        hideSeparator ? 'nn-hide-separator-selection' : ''
                                                    }`}
                                                    style={
                                                        {
                                                            top: Math.max(0, virtualItem.start),
                                                            '--item-height': `${virtualItem.size}px`
                                                        } as React.CSSProperties
                                                    }
                                                    data-index={virtualItem.index}
                                                >
                                                    {item.type === ListPaneItemType.HEADER ? (
                                                        <div
                                                            className={`nn-date-group-header ${isFirstHeader ? 'nn-first-header' : ''} ${
                                                                isPinnedHeader ? 'nn-pinned-section-header' : ''
                                                            }`}
                                                        >
                                                            {isPinnedHeader ? (
                                                                <>
                                                                    {settings.showPinnedIcon ? (
                                                                        <ServiceIcon
                                                                            iconId={pinnedSectionIcon}
                                                                            className="nn-date-group-header-icon"
                                                                            aria-hidden={true}
                                                                        />
                                                                    ) : null}
                                                                    <span className="nn-date-group-header-text">{headerLabel}</span>
                                                                </>
                                                            ) : (
                                                                <span
                                                                    className={`nn-date-group-header-text ${
                                                                        isClickableFolderGroupHeader
                                                                            ? 'nn-date-group-header-text--folder-note'
                                                                            : ''
                                                                    }`}
                                                                    onClick={
                                                                        folderGroupHeaderTarget
                                                                            ? event =>
                                                                                  handleFolderGroupHeaderClick(
                                                                                      event,
                                                                                      folderGroupHeaderTarget
                                                                                  )
                                                                            : undefined
                                                                    }
                                                                    onMouseDown={
                                                                        folderGroupHeaderTarget
                                                                            ? event =>
                                                                                  handleFolderGroupHeaderMouseDown(
                                                                                      event,
                                                                                      folderGroupHeaderTarget
                                                                                  )
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {headerLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : item.type === ListPaneItemType.TOP_SPACER ? (
                                                        <div className="nn-list-top-spacer" style={{ height: `${topSpacerHeight}px` }} />
                                                    ) : item.type === ListPaneItemType.BOTTOM_SPACER ? (
                                                        <div className="nn-list-bottom-spacer" />
                                                    ) : item.type === ListPaneItemType.FILE && item.data instanceof TFile ? (
                                                        <FileItem
                                                            key={item.key} // Ensures each file gets a fresh component instance, preventing stale data from previous files
                                                            file={item.data}
                                                            isSelected={isSelected}
                                                            hasSelectedAbove={hasSelectedAbove}
                                                            hasSelectedBelow={hasSelectedBelow}
                                                            onFileClick={handleFileItemClick}
                                                            fileIndex={item.fileIndex}
                                                            selectionType={selectionType}
                                                            dateGroup={dateGroup}
                                                            sortOption={effectiveSortOption}
                                                            parentFolder={item.parentFolder}
                                                            isPinned={item.isPinned}
                                                            searchQuery={searchHighlightQuery}
                                                            searchMeta={item.searchMeta}
                                                            // Pass hidden state for muted rendering style
                                                            isHidden={Boolean(item.isHidden)}
                                                            onModifySearchWithTag={modifySearchWithTag}
                                                            onModifySearchWithProperty={modifySearchWithProperty}
                                                            localDayReference={localDayReference}
                                                            fileIconSize={listMeasurements.fileIconSize}
                                                            visiblePropertyKeys={visibleListPropertyKeys}
                                                            visibleNavigationPropertyKeys={visibleNavigationPropertyKeys}
                                                        />
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                    {/* iOS (Obsidian 1.11+): keep the floating toolbar inside the panel */}
                    {shouldRenderBottomToolbarInsidePanel ? <div className="nn-pane-bottom-toolbar">{listToolbar}</div> : null}
                </div>
                {shouldRenderCalendarOverlay ? (
                    <div className="nn-navigation-calendar-overlay">
                        <Calendar onWeekCountChange={setCalendarWeekCount} onAddDateFilter={modifySearchWithDateToken} />
                    </div>
                ) : null}
                {shouldRenderBottomToolbarOutsidePanel ? <div className="nn-pane-bottom-toolbar">{listToolbar}</div> : null}
            </div>
        );
    })
);
