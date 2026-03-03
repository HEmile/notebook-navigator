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
 * useListPaneScroll - Orchestrates scrolling for the ListPane component
 *
 * ## Problem this solves:
 * The list pane rebuilds when navigating folders, changing settings, or applying
 * filters. Without proper synchronization, scrolls would execute before the list
 * updates, causing incorrect positioning or failed scrolls.
 *
 * ## Solution:
 * Priority-based scroll queue with version gating. Scrolls are prioritized by
 * importance and wait for list rebuilds before executing.
 *
 * ## Key concepts:
 * - **Priority system**: Higher priority scrolls override lower ones (reveal > navigation > visibility > config)
 * - **Index versioning**: Tracks list rebuilds for proper timing
 * - **Scroll reasons**: Different intents with specific alignment behaviors
 * - **Stabilization**: Handles rapid consecutive rebuilds gracefully
 *
 * ## Handles:
 * - Virtual list initialization with dynamic heights
 * - Folder/tag navigation with file preservation
 * - Configuration changes (descendants, appearance)
 * - Mobile drawer visibility
 * - Reveal operations (show active file)
 * - Search filter changes
 * - Sticky header tracking for date groups
 */

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { TFile, TFolder } from 'obsidian';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { useServices } from '../context/ServicesContext';
import { useFileCache } from '../context/StorageContext';
import { ListPaneItemType, OVERSCAN } from '../types';
import { Align, ListScrollIntent, getListAlign, rankListPending } from '../types/scroll';
import type { ListPaneItem } from '../types/virtualization';
import type { NotebookNavigatorSettings } from '../settings';
import type { NotePropertyType } from '../settings/types';
import type { SelectionState } from '../context/SelectionContext';
import { getEffectiveSortOption } from '../utils/sortUtils';
import { calculateCompactListMetrics } from '../utils/listPaneMetrics';
import { getPropertyRowCount, getListPaneMeasurements, shouldShowFeatureImageArea } from '../utils/listPaneMeasurements';
import type { PropertySelectionNodeId } from '../utils/propertyTree';

/**
 * Parameters for the useListPaneScroll hook
 */
interface UseListPaneScrollParams {
    /** List items to be rendered in the virtual list */
    listItems: ListPaneItem[];
    /** Map from file paths to their index in listItems */
    filePathToIndex: Map<string, number>;
    /** Currently selected file */
    selectedFile: TFile | null;
    /** Currently selected folder */
    selectedFolder: TFolder | null;
    /** Currently selected tag */
    selectedTag: string | null;
    /** Currently selected property */
    selectedProperty: PropertySelectionNodeId | null;
    /** Plugin settings */
    settings: NotebookNavigatorSettings;
    /** Effective settings for the current folder */
    folderSettings: {
        titleRows: number;
        previewRows: number;
        notePropertyType: NotePropertyType;
        showDate: boolean;
        showPreview: boolean;
        showImage: boolean;
    };
    /** Whether the list pane is currently visible */
    isVisible: boolean;
    /** Current selection state */
    selectionState: SelectionState;
    /** Selection state dispatcher */
    selectionDispatch: (action: { type: string; [key: string]: unknown }) => void;
    /** Current search query (undefined if search is not active) */
    searchQuery?: string;
    /** Suppress scroll-to-top behavior after search filtering (used for mobile shortcuts) */
    suppressSearchTopScrollRef?: { current: boolean } | null;
    /** Height of the synthetic top spacer used ahead of file items */
    topSpacerHeight: number;
    /** Whether descendant notes should be shown */
    includeDescendantNotes: boolean;
    /** Visible frontmatter property keys for file list rows (normalized keys) */
    visiblePropertyKeys: ReadonlySet<string>;
    /** Stable key signature for visible frontmatter property keys */
    visiblePropertyKeySignature: string;
    /** Scroll margin used to offset the visible range and scrollToIndex alignment */
    scrollMargin?: number;
    /**
     * Bottom inset reserved by overlays that sit on top of the scroll content.
     *
     * The list pane can render a mobile floating toolbar at the bottom; scrolling and scrollToIndex
     * should keep the target row above that overlay.
     */
    scrollPaddingEnd?: number;
}

/**
 * Return value of the useListPaneScroll hook
 */
interface UseListPaneScrollResult {
    /** TanStack Virtual virtualizer instance */
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Reference to the scroll container element */
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    /** Callback to set the scroll container ref */
    scrollContainerRefCallback: (element: HTMLDivElement | null) => void;
    /** Handler to scroll to top (mobile header tap) */
    handleScrollToTop: () => void;
}

/**
 * Hook that manages scrolling behavior for the ListPane component.
 * Handles virtualization, scroll position, and various scroll scenarios.
 *
 * @param params - Configuration parameters
 * @returns Virtualizer instance and scroll management utilities
 */
export function useListPaneScroll({
    listItems,
    filePathToIndex,
    selectedFile,
    selectedFolder,
    selectedTag,
    selectedProperty,
    settings,
    folderSettings,
    isVisible,
    selectionState,
    selectionDispatch,
    searchQuery,
    suppressSearchTopScrollRef,
    topSpacerHeight,
    includeDescendantNotes,
    visiblePropertyKeys,
    visiblePropertyKeySignature,
    scrollMargin = 0,
    scrollPaddingEnd = 0
}: UseListPaneScrollParams): UseListPaneScrollResult {
    const { isMobile } = useServices();
    const listMeasurements = getListPaneMeasurements(isMobile);
    const { hasPreview, getDB, isStorageReady } = useFileCache();
    // The list pane only renders after StorageContext marks storage ready.
    const db = getDB();

    // Calculate compact list padding for height estimation in virtualization
    const compactListMetrics = useMemo(
        () =>
            calculateCompactListMetrics({
                compactItemHeight: settings.compactItemHeight,
                scaleText: settings.compactItemHeightScaleText,
                titleLineHeight: listMeasurements.titleLineHeight
            }),
        [listMeasurements.titleLineHeight, settings.compactItemHeight, settings.compactItemHeightScaleText]
    );

    // Reference to the scroll container DOM element
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);
    const [containerVisible, setContainerVisible] = useState<boolean>(false);

    // Track list state changes and pending scroll operations
    const prevListKeyRef = useRef<string>(''); // Previous folder/tag context to detect navigation
    const prevConfigKeyRef = useRef<string>(''); // Track config changes for scroll preservation
    const prevSearchQueryRef = useRef<string | undefined>(undefined); // Track search query changes

    // ========== Scroll Orchestration ==========
    // Scroll reasons determine priority and alignment behavior
    type ScrollReason = ListScrollIntent;

    // Pending scroll stores requests until list is ready
    type PendingScroll = {
        type: 'file' | 'top'; // Scroll to specific file or top of list
        filePath?: string; // Target file path (for type='file')
        reason?: ScrollReason; // Why this scroll was requested
        minIndexVersion?: number; // Don't execute until indexVersion >= this
    };
    const pendingScrollRef = useRef<PendingScroll | null>(null);
    const [pendingScrollVersion, setPendingScrollVersion] = useState(0); // Triggers effect re-run
    // Tracks the currently selected file path to detect stale pending scrolls
    const selectedFilePathRef = useRef<string | null>(selectedFile ? selectedFile.path : null);

    // ========== Index Version Tracking ==========
    // Increments when list rebuilds to ensure scrolls execute with correct indices
    const indexVersionRef = useRef<number>(0);
    const prevIndexMapSizeRef = useRef<number>(filePathToIndex.size);
    const prevIndexMapObjRef = useRef<Map<string, number> | null>(null);

    // Context tracking for index-version based reorder detection within a list context
    const contextIndexVersionRef = useRef<{ key: string; version: number } | null>(null);

    // Check if we're in compact mode
    const isCompactMode = !folderSettings.showDate && !folderSettings.showPreview && !folderSettings.showImage;
    const revealFileOnListChanges = settings.revealFileOnListChanges;
    const hasSelectedFile = Boolean(selectedFile);

    /**
     * Initialize TanStack Virtual virtualizer with dynamic height calculation.
     * Handles different item types (headers, files, spacers) with appropriate heights.
     */
    const effectiveScrollMargin = Number.isFinite(scrollMargin) && scrollMargin > 0 ? scrollMargin : 0;
    const effectiveScrollPaddingEnd = Number.isFinite(scrollPaddingEnd) && scrollPaddingEnd > 0 ? scrollPaddingEnd : 0;
    const rowVirtualizer = useVirtualizer({
        count: listItems.length,
        getScrollElement: () => {
            const element = scrollContainerRef.current;
            if (!element) {
                // No element available yet
            }
            return element;
        },
        // Align virtualizer scroll math with the start of the file rows (excluding overlay chrome).
        scrollMargin: effectiveScrollMargin,
        // Ensure scrollToIndex aligns items below the overlay chrome instead of under it.
        scrollPaddingStart: effectiveScrollMargin,
        estimateSize: index => {
            const item = listItems[index];
            const heights = listMeasurements;

            if (item.type === ListPaneItemType.HEADER) {
                // Date group headers have fixed heights from CSS
                // Index 1 because TOP_SPACER is at index 0
                const isFirstHeader = index === 1;
                if (isFirstHeader) {
                    return heights.firstHeader;
                }
                return heights.subsequentHeader;
            }

            if (item.type === ListPaneItemType.TOP_SPACER) {
                return topSpacerHeight;
            }
            if (item.type === ListPaneItemType.BOTTOM_SPACER) {
                return listMeasurements.bottomSpacer;
            }

            // For file items - calculate height including all components
            const file = item.type === ListPaneItemType.FILE && item.data instanceof TFile ? item.data : null;

            // Visibility for tags row
            const shouldShowFileTags = settings.showTags && settings.showFileTags && (!isCompactMode || settings.showFileTagsInCompactMode);
            const hasTagRow = Boolean(shouldShowFileTags && item.type === ListPaneItemType.FILE && item.hasTags);

            // Height optimization settings
            const heightOptimizationEnabled = settings.optimizeNoteHeight;
            const heightOptimizationDisabled = !settings.optimizeNoteHeight;

            // Get actual preview status for accurate height calculation
            let hasPreviewText = false;
            let hasOmnisearchExcerpt = false;
            if (file && folderSettings.showPreview) {
                if (file.extension === 'md') {
                    // Use synchronous check from cache for markdown preview text
                    hasPreviewText = hasPreview(file.path);
                }
                const excerpt = item.searchMeta?.excerpt;
                hasOmnisearchExcerpt = typeof excerpt === 'string' && excerpt.length > 0;
            }
            const hasPreviewContent = hasPreviewText || hasOmnisearchExcerpt;

            // Keep height estimation aligned with FileItem feature image rendering.
            // getFile reads from the in-memory cache; no IndexedDB reads occur during sizing.
            const fileRecord = file ? db.getFile(file.path) : null;
            const featureImageStatus = fileRecord?.featureImageStatus ?? null;
            const showFeatureImageArea = shouldShowFeatureImageArea({
                showImage: folderSettings.showImage,
                file,
                featureImageStatus
            });

            // Keep the height estimator aligned with FileItem property rendering.
            // `getPropertyRowCount` applies the same trimming rules and separate-row behavior.
            const propertyRowCount = getPropertyRowCount({
                notePropertyType: folderSettings.notePropertyType,
                showFileProperties: settings.showFileProperties,
                showPropertiesOnSeparateRows: settings.showPropertiesOnSeparateRows,
                showFilePropertiesInCompactMode: settings.showFilePropertiesInCompactMode,
                isCompactMode,
                file,
                wordCount: fileRecord?.wordCount ?? undefined,
                properties: fileRecord?.properties ?? undefined,
                visiblePropertyKeys
            });

            const hasVisiblePillRows = hasTagRow || propertyRowCount > 0;
            const shouldSuppressEmptyPreviewLines = !hasPreviewContent && hasVisiblePillRows;

            // Note: Preview rows are calculated differently based on context

            // Layout decision variables (matching FileItem.tsx logic)
            const pinnedItemShouldUseCompactLayout = item.isPinned && heightOptimizationEnabled; // Pinned items get compact treatment only when optimizing
            const shouldShowDateForItem = folderSettings.showDate && !pinnedItemShouldUseCompactLayout;
            const shouldUseSingleLineForDateAndPreview = pinnedItemShouldUseCompactLayout || folderSettings.previewRows < 2;
            const shouldUseMultiLinePreviewLayout = !pinnedItemShouldUseCompactLayout && folderSettings.previewRows >= 2;
            const shouldCollapseEmptyPreviewSpace = heightOptimizationEnabled && !hasPreviewContent && !showFeatureImageArea; // Optimization: compact layout for empty preview
            const shouldAlwaysReservePreviewSpace = heightOptimizationDisabled || hasPreviewContent || showFeatureImageArea; // Show full layout when not optimizing OR has content

            // Start with base padding
            let textContentHeight = 0;

            if (isCompactMode) {
                // Compact mode: only shows file name
                textContentHeight = heights.titleLineHeight * (folderSettings.titleRows || 1);
            } else {
                // Normal mode
                textContentHeight += heights.titleLineHeight * (folderSettings.titleRows || 1); // File name

                // Single row mode - show date+preview, tags, and parent folder
                // Pinned items are treated as single row mode when optimization is enabled (unless using full height)
                if (shouldUseSingleLineForDateAndPreview) {
                    // Date and preview share one line
                    if (shouldShowDateForItem || (folderSettings.showPreview && !shouldSuppressEmptyPreviewLines)) {
                        textContentHeight += heights.singleTextLineHeight;
                    }

                    // Parent folder gets its own line (not when pinned is in compact layout)
                    if (!pinnedItemShouldUseCompactLayout && settings.showParentFolder) {
                        const file = item.data instanceof TFile ? item.data : null;
                        const isInDescendant = file && item.parentFolder && file.parent && file.parent.path !== item.parentFolder;
                        const showParentFolderLine = selectionState.selectionType === 'tag' || (includeDescendantNotes && isInDescendant);
                        if (showParentFolderLine) {
                            textContentHeight += heights.singleTextLineHeight;
                        }
                    }
                } else if (shouldUseMultiLinePreviewLayout) {
                    // Multi-row mode - only when not (optimization enabled AND pinned) AND preview rows >= 2
                    if (shouldCollapseEmptyPreviewSpace) {
                        // Optimization enabled and empty preview: compact layout
                        const file = item.data instanceof TFile ? item.data : null;
                        const isInDescendant = file && item.parentFolder && file.parent && file.parent.path !== item.parentFolder;
                        const showParentFolder =
                            settings.showParentFolder &&
                            !pinnedItemShouldUseCompactLayout &&
                            (selectionState.selectionType === 'tag' || (includeDescendantNotes && isInDescendant));

                        if (folderSettings.showDate || showParentFolder) {
                            textContentHeight += heights.singleTextLineHeight;
                        }
                    } else if (shouldAlwaysReservePreviewSpace) {
                        // Has preview text OR using full height: show full layout
                        if (folderSettings.showPreview) {
                            const previewRows = shouldSuppressEmptyPreviewLines
                                ? 0
                                : heightOptimizationDisabled || showFeatureImageArea
                                  ? folderSettings.previewRows
                                  : hasPreviewContent
                                    ? folderSettings.previewRows
                                    : 0;
                            if (previewRows > 0) {
                                textContentHeight += heights.multilineTextLineHeight * previewRows;
                            }
                        }
                        // Only add metadata line if date is shown OR parent folder is shown
                        const isInDescendant = file && item.parentFolder && file.parent && file.parent.path !== item.parentFolder;
                        const showParentFolder =
                            settings.showParentFolder &&
                            !pinnedItemShouldUseCompactLayout &&
                            (selectionState.selectionType === 'tag' || (includeDescendantNotes && isInDescendant));

                        if (folderSettings.showDate || showParentFolder) {
                            textContentHeight += heights.singleTextLineHeight;
                        }
                    }
                }
            }

            // Add space for tags if file has tags and they are visible in this mode
            if (hasTagRow) {
                textContentHeight += heights.tagRowHeight;
            }

            if (propertyRowCount > 0) {
                // `tagRowHeight` mirrors the combined CSS row height + margin-top gap for pill rows.
                textContentHeight += heights.tagRowHeight * propertyRowCount;
            }

            // Apply min-height constraint AFTER including all content (but not in compact mode)
            // This ensures text content aligns with feature image height when shown
            if (!isCompactMode && textContentHeight < heights.featureImageHeight) {
                textContentHeight = heights.featureImageHeight;
            }

            // Use reduced padding for compact mode (with mobile-specific padding)
            const padding = isCompactMode
                ? isMobile
                    ? compactListMetrics.mobilePaddingTotal
                    : compactListMetrics.desktopPaddingTotal
                : heights.basePadding;
            return padding + textContentHeight;
        },
        overscan: OVERSCAN,
        scrollPaddingEnd: effectiveScrollPaddingEnd
    });

    /**
     * Callback for when scroll container ref is set.
     * Used as a ref callback to capture the DOM element.
     */
    const scrollContainerRefCallback = useCallback((element: HTMLDivElement | null) => {
        scrollContainerRef.current = element as HTMLDivElement;
        setScrollContainerEl(element);
        if (!element) {
            setContainerVisible(false);
        }
    }, []);

    /**
     * Track the rendered visibility of the list scroll container.
     * TanStack Virtual scroll calls should not execute while the container (or parent)
     * is hidden because they will fail internally and emit retry errors.
     */
    useEffect(() => {
        const element = scrollContainerEl;
        if (!element) {
            setContainerVisible(false);
            return;
        }

        const updateVisibility = () => {
            const rect = element.getBoundingClientRect();
            const isContainerVisible = rect.width > 0 && rect.height > 0;
            setContainerVisible(prev => (prev === isContainerVisible ? prev : isContainerVisible));
        };

        updateVisibility();

        if (typeof ResizeObserver === 'undefined') {
            const handleWindowResize = () => updateVisibility();
            window.addEventListener('resize', handleWindowResize);
            return () => {
                window.removeEventListener('resize', handleWindowResize);
            };
        }

        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry) {
                return;
            }
            const { width, height } = entry.contentRect;
            const isContainerVisible = width > 0 && height > 0;
            setContainerVisible(prev => (prev === isContainerVisible ? prev : isContainerVisible));
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, [scrollContainerEl]);

    // Container is ready when both the list pane and the physical container are visible
    const isScrollContainerReady = isVisible && containerVisible;

    /**
     * Scroll to top handler for mobile header tap.
     */
    const handleScrollToTop = useCallback(() => {
        if (isMobile && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isMobile]);

    // Get scroll index for a file, adjusting to show top group header when navigating folders
    // This ensures the top group header (pinned or date) is visible when changing folders/tags
    const getSelectionIndex = useCallback(
        (filePath: string) => {
            const fileIndex = filePathToIndex.get(filePath);

            // File not found in index
            if (fileIndex === undefined || fileIndex === -1) {
                return -1;
            }

            // Check if there's a header immediately before this file
            const hasHeaderBefore = fileIndex > 0 && listItems[fileIndex - 1]?.type === ListPaneItemType.HEADER;
            if (!hasHeaderBefore) {
                return fileIndex;
            }

            // Special case: scroll to header for the very first file to show context
            // Index 0 is TOP_SPACER, Index 1 is first header (if exists), Index 2 is first file
            const isFirstFile = fileIndex <= 2;
            if (isFirstFile) {
                return fileIndex - 1; // Show the header above
            }

            // For all other files with headers, scroll directly to the file
            return fileIndex;
        },
        [filePathToIndex, listItems]
    );

    /**
     * Increment indexVersion when list structure changes.
     * Critical for ensuring scrolls execute after list rebuilds.
     */
    useEffect(() => {
        const sizeChanged = prevIndexMapSizeRef.current !== filePathToIndex.size;
        const identityChanged = prevIndexMapObjRef.current !== filePathToIndex;
        if (sizeChanged || identityChanged) {
            prevIndexMapSizeRef.current = filePathToIndex.size;
            prevIndexMapObjRef.current = filePathToIndex;
            indexVersionRef.current = indexVersionRef.current + 1;
            // Re-measure on any list structure/index change (covers reorders/add/remove)
            if (rowVirtualizer) {
                rowVirtualizer.measure();
            }
        }
    }, [filePathToIndex, filePathToIndex.size, rowVirtualizer]);

    /**
     * Priority-based scroll queue management.
     * Higher priority scrolls override lower priority ones.
     *
     * Priority order (lowest to highest):
     * 0. top - Scroll to top of list
     * 1. list-structure-change - Settings/layout changes within current context
     * 2. visibility-change - Mobile drawer opened
     * 3. folder-navigation - User changed folders
     * 4. reveal - Show active file command
     */
    const clearPending = useCallback(() => {
        // Drop any stale pending request so new context-specific scrolls can be queued
        if (pendingScrollRef.current) {
            pendingScrollRef.current = null;
            setPendingScrollVersion(v => v + 1);
        }
    }, []);

    const setPending = useCallback((next: PendingScroll) => {
        const current = pendingScrollRef.current;
        if (!current) {
            pendingScrollRef.current = next;
            setPendingScrollVersion(v => v + 1);
            return;
        }

        const nextRank = rankListPending(next);
        const currentRank = rankListPending(current);

        if (nextRank >= currentRank) {
            pendingScrollRef.current = next;
            setPendingScrollVersion(v => v + 1);
        }
    }, []);

    /**
     * Keep selectedFilePathRef in sync with the current selected file.
     * Used to detect and skip stale pending scrolls to previous selections.
     */
    useEffect(() => {
        selectedFilePathRef.current = selectedFile?.path ?? null;
    }, [selectedFile?.path]);

    /**
     * Process pending scrolls when conditions are met.
     * Central execution point for all scroll operations.
     *
     * Execution requirements:
     * 1. List must be visible
     * 2. Virtualizer must be ready
     * 3. indexVersion must meet minimum requirement
     *
     * Alignment policy:
     * - folder-navigation: center on mobile, auto on desktop
     * - visibility-change: auto (minimal movement)
     * - reveal: auto (show if not visible)
     * - list-structure-change: auto (maintain position)
     * - list-reorder: auto (maintain selection visibility)
     */
    useEffect(() => {
        if (!rowVirtualizer || !pendingScrollRef.current || !isScrollContainerReady) {
            return;
        }

        const pending = pendingScrollRef.current;
        let shouldClearPending = false;

        // Version gate: Wait for list rebuild if required
        const effectiveMin = pending.minIndexVersion ?? indexVersionRef.current;
        if (indexVersionRef.current < effectiveMin) {
            return;
        }

        if (pending.type === 'file') {
            const isStructuralChange = pending.reason === 'list-structure-change';

            if (!revealFileOnListChanges && isStructuralChange) {
                shouldClearPending = true;
            } else if (
                isStructuralChange &&
                pending.filePath &&
                selectedFilePathRef.current &&
                pending.filePath !== selectedFilePathRef.current
            ) {
                shouldClearPending = true;
            } else if (pending.filePath) {
                const index = getSelectionIndex(pending.filePath);
                if (index >= 0) {
                    let alignment: Align = getListAlign(pending.reason);
                    if (pending.reason === 'reveal' && selectionState.revealSource === 'startup') {
                        alignment = 'center';
                    }
                    rowVirtualizer.scrollToIndex(index, { align: alignment });

                    if (isStructuralChange) {
                        // Stabilization mechanism: Handle rapid consecutive rebuilds
                        const usedIndex = index;
                        const usedPath = pending.filePath;
                        requestAnimationFrame(() => {
                            const newIndex = usedPath ? getSelectionIndex(usedPath) : -1;
                            if (usedPath && newIndex >= 0 && newIndex !== usedIndex && revealFileOnListChanges) {
                                setPending({
                                    type: 'file',
                                    filePath: usedPath,
                                    reason: 'list-structure-change',
                                    minIndexVersion: indexVersionRef.current + 1
                                });
                            }
                        });
                    }

                    shouldClearPending = true;
                } else {
                    // Keep pending until file appears in index
                    shouldClearPending = false;
                }
            }
        } else if (pending.type === 'top') {
            rowVirtualizer.scrollToOffset(0, { align: 'start', behavior: 'auto' });
            shouldClearPending = true;
        }

        if (shouldClearPending) {
            pendingScrollRef.current = null;
        }
    }, [
        rowVirtualizer,
        filePathToIndex,
        isScrollContainerReady,
        pendingScrollVersion,
        getSelectionIndex,
        isMobile,
        setPending,
        revealFileOnListChanges,
        selectionState.revealSource
    ]);

    /**
     * Subscribe to database content changes and re-measure virtualizer when needed.
     * Handles preview text, feature images, tags, and metadata changes.
     */
    useEffect(() => {
        if (!rowVirtualizer) return;

        const db = getDB();
        const unsubscribe = db.onContentChange(changes => {
            // Check if any changes affect item height
            const needsRemeasure = changes.some(change => {
                // Content changes always need remeasure
                if (
                    change.changes.preview !== undefined ||
                    change.changes.featureImageKey !== undefined ||
                    change.changes.featureImageStatus !== undefined ||
                    change.changes.metadata !== undefined ||
                    change.changes.properties !== undefined
                ) {
                    return true;
                }

                // For tag changes, always remeasure to handle height changes
                // When tags are added/removed, the height of the item changes
                if (change.changes.tags !== undefined) {
                    return true;
                }

                return false;
            });

            if (needsRemeasure) {
                rowVirtualizer.measure();
            }
        });

        return () => {
            unsubscribe();
        };
    }, [rowVirtualizer, getDB]);

    /**
     * Listen for mobile drawer visibility events.
     * Ensures selected file is visible when drawer opens.
     * SCROLL_MOBILE_VISIBILITY: Sets pending scroll with 'visibility-change' reason
     */
    useEffect(() => {
        if (!isMobile) return;

        const handleVisible = () => {
            // If we have a selected file, set a pending scroll
            // This works regardless of whether auto-reveal has run yet
            if (selectedFile && rowVirtualizer) {
                setPending({
                    type: 'file',
                    filePath: selectedFile.path,
                    reason: 'visibility-change',
                    minIndexVersion: indexVersionRef.current
                });
            }
        };

        window.addEventListener('notebook-navigator-visible', handleVisible);
        return () => window.removeEventListener('notebook-navigator-visible', handleVisible);
    }, [isMobile, selectedFile, rowVirtualizer, filePathToIndex, setPending]);

    /**
     * Re-measure all items when height-affecting settings change.
     * Includes date display, preview settings, feature images, etc.
     */
    useEffect(() => {
        if (!rowVirtualizer) return;

        rowVirtualizer.measure();
    }, [
        topSpacerHeight,
        settings.showFileDate,
        settings.showFilePreview,
        settings.showFeatureImage,
        settings.fileNameRows,
        settings.previewRows,
        settings.showFileProperties,
        settings.showPropertiesOnSeparateRows,
        settings.showFilePropertiesInCompactMode,
        visiblePropertyKeySignature,
        settings.showParentFolder,
        settings.showTags,
        settings.showFileTags,
        settings.showFileTagsInCompactMode,
        settings.optimizeNoteHeight,
        settings.compactItemHeight,
        settings.compactItemHeightScaleText,
        folderSettings,
        listMeasurements,
        rowVirtualizer
    ]);

    /**
     * Re-measure when storage becomes ready after cold boot.
     * Ensures heights are correct once preview data is available.
     */
    useEffect(() => {
        if (isStorageReady && rowVirtualizer) {
            rowVirtualizer.measure();
        }
    }, [isStorageReady, rowVirtualizer]);

    /**
     * Handle scrolling when list configuration changes (descendants toggle, appearance, grouping, or sort).
     * Maintains scroll position on the selected file.
     * Effect includes all dependencies but only scrolls when config actually changes.
     */
    // Calculate effective sort order based on current selection and custom overrides
    const effectiveSort = useMemo(() => {
        return getEffectiveSortOption(settings, selectionState.selectionType, selectedFolder, selectedTag, selectedProperty);
    }, [settings, selectionState.selectionType, selectedFolder, selectedTag, selectedProperty]);
    useEffect(() => {
        if (!rowVirtualizer || !isScrollContainerReady) {
            return;
        }

        // Build a key from the config values that should trigger scroll preservation
        const configKey = `${includeDescendantNotes}-${settings.optimizeNoteHeight}-${settings.noteGrouping}-${effectiveSort}-${settings.propertySortKey}-${settings.propertySortSecondary}-${JSON.stringify(
            folderSettings
        )}`;

        // Check if config actually changed
        if (prevConfigKeyRef.current === configKey) {
            return; // No config change, don't scroll
        }

        // Detect descendants toggle for special handling
        const wasShowingDescendants = prevConfigKeyRef.current && prevConfigKeyRef.current.startsWith('true');
        const nowShowingDescendants = includeDescendantNotes;

        // Update the ref
        prevConfigKeyRef.current = configKey;

        // Set a pending scroll to maintain position on selected file when config changes
        if (revealFileOnListChanges && selectedFile) {
            setPending({
                type: 'file',
                filePath: selectedFile.path,
                reason: 'list-structure-change',
                minIndexVersion: indexVersionRef.current + 1
            });
        } else if (wasShowingDescendants && !nowShowingDescendants) {
            // Special case: When disabling descendants and no file selected, scroll to top
            setPending({
                type: 'top',
                reason: 'list-structure-change',
                minIndexVersion: indexVersionRef.current + 1
            });
        }
    }, [
        isScrollContainerReady,
        rowVirtualizer,
        selectedFile,
        includeDescendantNotes,
        revealFileOnListChanges,
        settings.optimizeNoteHeight,
        settings.noteGrouping,
        settings.propertySortKey,
        settings.propertySortSecondary,
        folderSettings,
        effectiveSort,
        setPending
    ]);

    /**
     * Preserve scroll when the list index changes within the same context (implicit reorders like pin/unpin).
     * Uses indexVersion changes keyed by current folder/tag context. Avoids duplicate triggers on navigation.
     */
    useEffect(() => {
        if (!rowVirtualizer || !isScrollContainerReady) return;

        const propertySelectionKey = selectedProperty ?? '';
        const contextKey = `${selectedFolder?.path || ''}_${selectedTag || ''}_${propertySelectionKey}`;
        const prev = contextIndexVersionRef.current;

        // Initialize on first run or when context changes
        if (!prev || prev.key !== contextKey) {
            contextIndexVersionRef.current = { key: contextKey, version: indexVersionRef.current };
            return;
        }

        // Same context: if index version advanced, maintain position on selected file
        if (indexVersionRef.current > prev.version) {
            contextIndexVersionRef.current = { key: contextKey, version: indexVersionRef.current };

            // Only queue a file scroll if the selected file exists in the current index
            const inList = !!(selectedFile && filePathToIndex.has(selectedFile.path));
            if (revealFileOnListChanges && inList && selectedFile) {
                setPending({
                    type: 'file',
                    filePath: selectedFile.path,
                    reason: 'list-structure-change',
                    minIndexVersion: indexVersionRef.current
                });
            }
        }
    }, [
        rowVirtualizer,
        isScrollContainerReady,
        selectedFolder?.path,
        selectedTag,
        selectedProperty,
        filePathToIndex,
        filePathToIndex.size,
        selectedFile,
        setPending,
        revealFileOnListChanges
    ]);

    /**
     * Handle scrolling when navigating between folders/tags.
     * Supports both visible and hidden panes (for single-pane mode).
     * Manages folder navigation flags and list context changes.
     * SCROLL_FOLDER_NAVIGATION: Sets pending scroll with 'folder-navigation' reason
     */
    useEffect(() => {
        if (!rowVirtualizer) {
            return;
        }

        // Create a key representing the current list context
        const propertySelectionKey = selectedProperty ?? '';
        const currentListKey = `${selectedFolder?.path || ''}_${selectedTag || ''}_${propertySelectionKey}`;
        const listChanged = prevListKeyRef.current !== currentListKey;

        if (listChanged) {
            // Context changed while a pending scroll might still target the prior folder/tag
            clearPending();
        }

        // Check if this is a folder navigation where we need to scroll to maintain the selected file
        const isFolderNavigation = selectionState.isFolderNavigation;

        // Determine if we should scroll
        // We scroll in these cases:
        // 1. User navigated to a different folder/tag (isFolderNavigation = true)
        // 2. List context changed (folder/tag change)
        const shouldScroll = listChanged || (isFolderNavigation && hasSelectedFile);

        if (!shouldScroll) {
            if (isFolderNavigation) {
                selectionDispatch({ type: 'SET_FOLDER_NAVIGATION', isFolderNavigation: false });
            }
            return;
        }

        // On initial load, wait for list to be populated
        if (listChanged && listItems.length === 0) {
            return;
        }

        // For single-pane mode, always set pending scroll even if not visible
        // It will be processed when the pane becomes visible
        if (!isScrollContainerReady && (isFolderNavigation || listChanged)) {
            // Update the ref
            if (listChanged) {
                prevListKeyRef.current = currentListKey;
            }

            // Clear the folder navigation flag
            if (isFolderNavigation) {
                selectionDispatch({ type: 'SET_FOLDER_NAVIGATION', isFolderNavigation: false });
            }

            setPending(
                selectedFile
                    ? {
                          type: 'file',
                          filePath: selectedFile.path,
                          reason: 'folder-navigation',
                          minIndexVersion: indexVersionRef.current
                      }
                    : { type: 'top', reason: 'folder-navigation', minIndexVersion: indexVersionRef.current }
            );
            return;
        }

        // For folder navigation when visible, perform scroll immediately without RAF
        // RAF was causing issues with component re-renders cancelling the scroll
        if (isFolderNavigation && listItems.length > 0 && isScrollContainerReady) {
            // Update the ref
            if (listChanged) {
                prevListKeyRef.current = currentListKey;
            }

            // Clear the folder navigation flag
            selectionDispatch({ type: 'SET_FOLDER_NAVIGATION', isFolderNavigation: false });

            const pendingScroll = selectedFile
                ? {
                      type: 'file' as const,
                      filePath: selectedFile.path,
                      reason: 'folder-navigation' as const,
                      minIndexVersion: indexVersionRef.current
                  }
                : ({ type: 'top', reason: 'folder-navigation', minIndexVersion: indexVersionRef.current } as const);

            setPending(pendingScroll);
        } else {
            // For other cases (initial load), use pending scroll for consistency
            // RAF was getting canceled due to rapid re-renders

            // Update the ref
            if (listChanged) {
                prevListKeyRef.current = currentListKey;
            }

            setPending(
                selectedFile
                    ? {
                          type: 'file',
                          filePath: selectedFile.path,
                          reason: 'folder-navigation',
                          minIndexVersion: indexVersionRef.current
                      }
                    : { type: 'top', reason: 'folder-navigation', minIndexVersion: indexVersionRef.current }
            );
        }
    }, [
        isScrollContainerReady,
        rowVirtualizer,
        selectedFolder?.path,
        selectedTag,
        selectedProperty,
        selectedFile,
        selectionState.isFolderNavigation,
        selectionDispatch,
        listItems.length,
        setPending,
        clearPending,
        hasSelectedFile
    ]);

    /**
     * Handle reveal operations (e.g., reveal active file command).
     * Uses pending scroll for proper timing and measurement.
     * SCROLL_REVEAL_OPERATION: Sets pending scroll with 'reveal' reason
     */
    useEffect(() => {
        if (selectionState.isRevealOperation && selectedFile && isScrollContainerReady) {
            // Always use pending scroll for reveal operations
            // This ensures proper timing and measurement before scrolling
            setPending({
                type: 'file',
                filePath: selectedFile.path,
                reason: 'reveal',
                minIndexVersion: indexVersionRef.current
            });
        }
    }, [selectionState.isRevealOperation, selectedFile, isScrollContainerReady, selectionDispatch, filePathToIndex, setPending]);

    /**
     * Handle search query changes.
     * Scrolls to top when search filters change and selected file is not in results.
     * SCROLL_SEARCH: Sets pending scroll to top when appropriate
     */
    useEffect(() => {
        // Only handle when search is active (searchQuery is defined)
        if (searchQuery === undefined) {
            prevSearchQueryRef.current = searchQuery;
            return;
        }

        if (!selectedFile) {
            prevSearchQueryRef.current = searchQuery;
            return;
        }

        if (!isScrollContainerReady || !rowVirtualizer) {
            // Defer handling until visible/ready without consuming the query change
            return;
        }

        // Check if selected file exists in the filtered list (based on current index)
        const selectedFileInList = filePathToIndex.has(selectedFile.path);

        const queryChanged = prevSearchQueryRef.current !== searchQuery;
        prevSearchQueryRef.current = searchQuery;

        // Scroll to top when search filters remove the selected file, regardless of whether
        // this happened immediately on query change or after the list rebuilt
        // Check if scroll-to-top should be suppressed (used for mobile search shortcuts)
        const suppressTopScroll = suppressSearchTopScrollRef?.current ?? false;

        if (!selectedFileInList && listItems.length > 0) {
            // Skip scroll-to-top if suppressed (mobile shortcut activation)
            if (suppressTopScroll && suppressSearchTopScrollRef) {
                suppressSearchTopScrollRef.current = false;
                return;
            }
            setPending({ type: 'top', reason: 'list-structure-change', minIndexVersion: indexVersionRef.current });
            return;
        }

        // Reset suppression flag after checking
        if (suppressTopScroll && suppressSearchTopScrollRef) {
            suppressSearchTopScrollRef.current = false;
        }

        // If the selected file remains in the list, folder-navigation effects handle its visibility
        // No action needed here; keep for completeness when queryChanged
        if (queryChanged) {
            // No-op
        }
    }, [
        searchQuery,
        selectedFile,
        filePathToIndex,
        isScrollContainerReady,
        rowVirtualizer,
        listItems.length,
        setPending,
        suppressSearchTopScrollRef
    ]);

    return {
        rowVirtualizer,
        scrollContainerRef,
        scrollContainerRefCallback,
        handleScrollToTop
    };
}
