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
 * useKeyboardNavigation - Shared base hook for keyboard navigation
 *
 * This hook provides:
 * - Common keyboard event setup and teardown
 * - Event filtering (navigator focus, modal handling, input field detection)
 * - RTL support
 * - Common navigation utilities
 * - Scroll handling through virtualizer
 *
 * This base hook is used by both useNavigationPaneKeyboard and useListPaneKeyboard
 * to provide consistent keyboard behavior across the plugin.
 */

import { useCallback, useEffect } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';
import { useUIState } from '../context/UIStateContext';
import { isKeyboardEventContextBlocked } from '../utils/domUtils';

/**
 * Common item type for virtualized lists
 */
export interface VirtualItem {
    type: string;
    key: string;
    data?: unknown;
}

/**
 * Helper function for safe array access
 */
const safeGetItem = <T>(array: T[], index: number): T | undefined => {
    return index >= 0 && index < array.length ? array[index] : undefined;
};

/**
 * Check if item is selectable based on pane-specific logic
 */
export type IsSelectableFunction<T> = (item: T) => boolean;

/**
 * Find next selectable item in the list
 */
const findNextSelectableIndex = <T>(
    items: T[],
    currentIndex: number,
    isSelectable: IsSelectableFunction<T>,
    includeCurrent: boolean = false
): number => {
    // If no items, return -1
    if (items.length === 0) return -1;

    // If no current selection, find the first selectable item
    if (currentIndex < 0) {
        for (let i = 0; i < items.length; i++) {
            const item = safeGetItem(items, i);
            if (item && isSelectable(item)) {
                return i;
            }
        }
        return -1; // No selectable items found
    }

    const start = includeCurrent ? currentIndex : currentIndex + 1;
    for (let i = start; i < items.length; i++) {
        const item = safeGetItem(items, i);
        if (item && isSelectable(item)) {
            return i;
        }
    }

    return currentIndex; // Stay at current if no next item
};

/**
 * Find previous selectable item in the list
 */
const findPreviousSelectableIndex = <T>(
    items: T[],
    currentIndex: number,
    isSelectable: IsSelectableFunction<T>,
    includeCurrent: boolean = false
): number => {
    // If no items or invalid index, return -1
    if (items.length === 0 || currentIndex < 0) return -1;

    const start = includeCurrent ? currentIndex : currentIndex - 1;
    for (let i = start; i >= 0; i--) {
        const item = safeGetItem(items, i);
        if (item && isSelectable(item)) {
            return i;
        }
    }

    return currentIndex; // Stay at current if no previous item
};

/**
 * Calculates the number of items that fit in the viewport based on geometry.
 * This is the only reliable way to get a consistent page size.
 */
const getVisiblePageSize = (virtualizer: Virtualizer<HTMLDivElement, Element>): number => {
    const virtualItems = virtualizer.getVirtualItems();
    // If the virtualizer or its scroll element isn't ready, return a sensible default.
    if (virtualItems.length === 0 || !virtualizer.scrollElement) {
        return 10;
    }

    // Get the height of the visible scroll area.
    const viewportHeight = virtualizer.scrollElement.offsetHeight;

    // To find the average item height, we measure the total height of all *rendered*
    // items and divide by the number of rendered items.
    if (virtualItems.length === 0) {
        return 10;
    }
    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];
    const totalMeasuredHeight = lastItem.start + lastItem.size - firstItem.start;

    // Avoid division by zero if height is somehow 0.
    if (totalMeasuredHeight <= 0) {
        return 10;
    }

    const averageItemHeight = totalMeasuredHeight / virtualItems.length;

    if (averageItemHeight <= 0) {
        return 10;
    }

    // The true page size is how many average-sized items fit in the viewport.
    const pageSize = Math.floor(viewportHeight / averageItemHeight);

    // Jump by a full page minus one item for visual context, ensuring we jump at least 1.
    return Math.max(1, pageSize > 1 ? pageSize - 1 : 1);
};

/**
 * Parameters for the keyboard navigation hook
 */
export interface UseKeyboardNavigationParams<T> {
    /** Array of items to navigate */
    items: T[];
    /** Virtualizer instance for scroll management */
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    /** Which pane is currently focused */
    focusedPane: 'navigation' | 'files';
    /** Container element for event attachment */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Function to check if an item is selectable */
    isSelectable: IsSelectableFunction<T>;
    /** Function to get the current selection index */
    _getCurrentIndex: () => number;
    /** Keyboard handler provided by the specific pane implementation */
    onKeyDown: (e: KeyboardEvent, helpers: KeyboardNavigationHelpers<T>) => void;
    /** Optional keyup handler provided by the specific pane implementation */
    onKeyUp?: (e: KeyboardEvent, helpers: KeyboardNavigationHelpers<T>) => void;
}

/**
 * Helper functions provided to keyboard handlers
 */
export interface KeyboardNavigationHelpers<T> {
    /** Find next selectable index */
    findNextIndex: (currentIndex: number, includeCurrent?: boolean) => number;
    /** Find previous selectable index */
    findPreviousIndex: (currentIndex: number, includeCurrent?: boolean) => number;
    /** Get page size for PageUp/PageDown */
    getPageSize: () => number;
    /** Scroll to a specific index */
    scrollToIndex: (index: number) => void;
    /** Get item at index safely */
    getItemAt: (index: number) => T | undefined;
    /** Check if RTL mode is active */
    isRTL: () => boolean;
}

/**
 * Shared base hook for keyboard navigation.
 * Handles common keyboard event setup, filtering, and utilities.
 */
export function useKeyboardNavigation<T>({
    items,
    virtualizer,
    focusedPane,
    containerRef,
    isSelectable,
    onKeyDown,
    onKeyUp
}: UseKeyboardNavigationParams<T>) {
    const uiState = useUIState();

    const createHelpers = useCallback((): KeyboardNavigationHelpers<T> => {
        return {
            findNextIndex: (currentIndex: number, includeCurrent = false) =>
                findNextSelectableIndex(items, currentIndex, isSelectable, includeCurrent),
            findPreviousIndex: (currentIndex: number, includeCurrent = false) =>
                findPreviousSelectableIndex(items, currentIndex, isSelectable, includeCurrent),
            getPageSize: () => getVisiblePageSize(virtualizer),
            scrollToIndex: (index: number) => {
                virtualizer.scrollToIndex(index, { align: 'auto' });
            },
            getItemAt: (index: number) => safeGetItem(items, index),
            isRTL: () => document.body.classList.contains('mod-rtl')
        };
    }, [items, isSelectable, virtualizer]);

    /**
     * Main keyboard event handler with common filtering
     */
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // KEYBOARD EVENT FILTERING:

            // 1. Check if the navigator is focused
            const navigatorContainer = containerRef.current;
            const navigatorFocused = navigatorContainer?.getAttribute('data-navigator-focused');
            // Ignore global key events unless navigator focus state is active.
            if (navigatorFocused !== 'true') return;

            // 2. Skip if keyboard handling is blocked in the current context.
            if (isKeyboardEventContextBlocked(e)) {
                // Block typing contexts and modal focus to avoid stealing keystrokes.
                return;
            }

            // 3. Only handle events for the currently focused pane
            // Navigation and file panes share one container; this routes events to active pane only.
            if (uiState.focusedPane !== focusedPane) return;

            // Delegate to pane-specific handler
            onKeyDown(e, createHelpers());
        },
        [containerRef, uiState.focusedPane, focusedPane, onKeyDown, createHelpers]
    );

    const handleKeyUp = useCallback(
        (e: KeyboardEvent) => {
            if (!onKeyUp) {
                return;
            }

            // 1. Check if the navigator is focused
            const navigatorContainer = containerRef.current;
            const navigatorFocused = navigatorContainer?.getAttribute('data-navigator-focused');
            // Ignore keyup unless navigator focus state is active.
            if (navigatorFocused !== 'true') return;

            // 2. Skip if keyboard handling is blocked in the current context.
            if (isKeyboardEventContextBlocked(e)) {
                // Block typing contexts and modal focus to avoid stealing keystrokes.
                return;
            }

            // 3. Only handle events for the currently focused pane
            // Navigation and file panes share one container; this routes events to active pane only.
            if (uiState.focusedPane !== focusedPane) return;

            onKeyUp(e, createHelpers());
        },
        [containerRef, uiState.focusedPane, focusedPane, onKeyUp, createHelpers]
    );

    /**
     * Attach keyboard listener to the navigator container
     */
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('keydown', handleKeyDown);
        container.addEventListener('keyup', handleKeyUp);
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            container.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp, containerRef]);
}
