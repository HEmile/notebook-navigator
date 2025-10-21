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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
/**
 * Base interface for items that can be reordered.
 * Items must have a unique key for identification.
 */
interface ReorderItemDescriptor {
    key: string;
}

/**
 * Set of drag and drop event handlers for list reordering.
 * These handlers should be spread onto draggable elements.
 */
export interface ListReorderHandlers {
    draggable: boolean;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: (event: DragEvent<HTMLElement>) => void;
}

/**
 * Parameters for the useListReorder hook
 */
interface UseListReorderParams<T extends ReorderItemDescriptor> {
    items: T[]; // Array of items to be reordered
    isEnabled: boolean; // Whether drag and drop is currently enabled
    reorderItems: (orderedKeys: string[]) => Promise<boolean>; // Callback to persist the new order
}

/**
 * Return value from the useListReorder hook
 */
interface UseListReorderResult {
    getDragHandlers: (key: string) => ListReorderHandlers; // Factory function for drag handlers
    dropIndex: number | null; // Current drop position indicator
    draggingKey: string | null; // Key of the item being dragged
}

function noopHandler() {
    // Intentionally empty - used when drag and drop is disabled
}

/**
 * Hook that manages drag and drop reordering of navigation lists.
 * Returns drag handlers and current drag state for visual feedback.
 */
export function useListReorder<T extends ReorderItemDescriptor>({
    items,
    isEnabled,
    reorderItems
}: UseListReorderParams<T>): UseListReorderResult {
    const [draggingKey, setDraggingKey] = useState<string | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    // Timeout reference for deferred drop index clearing
    const dropClearTimeoutRef = useRef<number | null>(null);

    // Cancel any pending drop index clear operation
    const clearDeferredDropIndex = useCallback(() => {
        if (dropClearTimeoutRef.current !== null) {
            window.clearTimeout(dropClearTimeoutRef.current);
            dropClearTimeoutRef.current = null;
        }
    }, []);

    // Schedule a delayed clearing of drop index to avoid flicker during drag operations
    const scheduleDropIndexClear = useCallback(() => {
        clearDeferredDropIndex();
        dropClearTimeoutRef.current = window.setTimeout(() => {
            setDropIndex(null);
            dropClearTimeoutRef.current = null;
        }, 60);
    }, [clearDeferredDropIndex]);

    // Extracts ordered list of item keys from the items array
    const itemOrder = useMemo(() => items.map(item => item.key), [items]);

    // Builds a map of item keys to their current index for O(1) lookup
    const keyToIndex = useMemo(() => {
        const indexMap = new Map<string, number>();
        itemOrder.forEach((key, index) => {
            indexMap.set(key, index);
        });
        return indexMap;
    }, [itemOrder]);

    // Resets all drag-related state to initial values
    const resetDragState = useCallback(() => {
        setDraggingKey(null);
        setDropIndex(null);
        clearDeferredDropIndex();
    }, [clearDeferredDropIndex]);

    // Clean up any pending timeouts on unmount
    useEffect(() => {
        return () => {
            clearDeferredDropIndex();
        };
    }, [clearDeferredDropIndex]);

    // Clears drag state when drag and drop is disabled
    useEffect(() => {
        if (!isEnabled) {
            resetDragState();
        }
    }, [isEnabled, resetDragState]);

    // Clears drag state if the dragged item is no longer in the list
    useEffect(() => {
        if (!draggingKey) {
            return;
        }
        if (!keyToIndex.has(draggingKey)) {
            resetDragState();
        }
    }, [draggingKey, keyToIndex, resetDragState]);

    // Disables drag and drop when there are fewer than 2 items (nothing to reorder)
    useEffect(() => {
        if (items.length < 2) {
            resetDragState();
        }
    }, [items.length, resetDragState]);

    // Calculates where to insert the dragged item based on mouse position
    // Returns null if the drop position is invalid
    const computeInsertIndex = useCallback(
        (event: DragEvent<HTMLElement>, targetKey: string) => {
            if (!draggingKey) {
                return null;
            }

            const targetIndex = keyToIndex.get(targetKey);
            if (targetIndex === undefined) {
                return null;
            }

            // Check for explicit insertion position from data attributes
            const targetElement = event.currentTarget as HTMLElement;
            const insertMode = targetElement.dataset.reorderInsert;
            if (insertMode === 'before') {
                return targetIndex;
            }
            if (insertMode === 'after') {
                return targetIndex + 1;
            }
            // Check for explicit fixed index position
            const fixedIndex = targetElement.dataset.reorderIndex;
            if (fixedIndex) {
                const parsedIndex = Number(fixedIndex);
                if (!Number.isNaN(parsedIndex)) {
                    return Math.max(0, Math.min(parsedIndex, itemOrder.length));
                }
            }

            // Determine if drop is in top or bottom half of target element
            const bounds = targetElement.getBoundingClientRect();
            const offset = event.clientY - bounds.top;
            const shouldInsertBefore = offset < bounds.height / 2;

            const proposedIndex = shouldInsertBefore ? targetIndex : targetIndex + 1;
            return Math.max(0, Math.min(proposedIndex, itemOrder.length));
        },
        [draggingKey, keyToIndex, itemOrder.length]
    );

    // Applies the reorder operation and updates settings
    // Builds new order array and calls the reorderItems callback
    const finalizeReorder = useCallback(
        async (targetIndex: number | null) => {
            if (draggingKey === null) {
                return;
            }
            if (targetIndex === null) {
                return;
            }

            const fromIndex = keyToIndex.get(draggingKey);
            if (fromIndex === undefined) {
                return;
            }

            let insertIndex = Math.max(0, Math.min(targetIndex, itemOrder.length));

            // Skip reorder if item would end up in the same position
            if (fromIndex === insertIndex || fromIndex + 1 === insertIndex) {
                return;
            }

            // Build new order array with the moved item in its new position
            const nextOrder = [...itemOrder];
            const [moved] = nextOrder.splice(fromIndex, 1);
            if (fromIndex < insertIndex) {
                insertIndex -= 1;
            }
            nextOrder.splice(insertIndex, 0, moved);

            // Check if the order actually changed
            let changed = false;
            for (let index = 0; index < nextOrder.length; index += 1) {
                if (nextOrder[index] !== itemOrder[index]) {
                    changed = true;
                    break;
                }
            }

            if (!changed) {
                return;
            }

            try {
                const success = await reorderItems(nextOrder);
                if (!success) {
                    console.warn('List reorder returned false, no changes applied');
                }
            } catch (error) {
                console.error('Failed to reorder list', error);
            }
        },
        [draggingKey, keyToIndex, reorderItems, itemOrder]
    );

    // Initializes drag operation and sets dragging state
    // Stores the dragged item key in dataTransfer for identification
    const handleDragStart = useCallback(
        (event: DragEvent<HTMLElement>, key: string) => {
            if (!isEnabled) {
                return;
            }

            try {
                // Only set standard MIME type to enable drag on Chrome 128+ Android
                // Custom MIME types break drag and drop on Android Chrome 128+
                event.dataTransfer.setData('text/plain', key);
            } catch (error) {
                console.error('Drag dataTransfer setData failed', error);
            }
            event.dataTransfer.effectAllowed = 'move';
            setDraggingKey(key);
            setDropIndex(keyToIndex.get(key) ?? null);
        },
        [isEnabled, keyToIndex]
    );

    // Updates drop indicator position as drag moves over elements
    // Prevents default to allow drop and updates visual feedback
    const handleDragOver = useCallback(
        (event: DragEvent<HTMLElement>, key: string) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const nextIndex = computeInsertIndex(event, key);
            if (nextIndex === null) {
                scheduleDropIndexClear();
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';

            clearDeferredDropIndex();
            if (dropIndex !== nextIndex) {
                setDropIndex(nextIndex);
            }
        },
        [clearDeferredDropIndex, computeInsertIndex, dropIndex, draggingKey, isEnabled, scheduleDropIndexClear]
    );

    // Completes the drag operation and reorders items
    // Calculates final position and triggers the reorder
    const handleDrop = useCallback(
        async (event: DragEvent<HTMLElement>, key: string) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const targetIndex = computeInsertIndex(event, key);
            event.preventDefault();
            event.stopPropagation();

            await finalizeReorder(targetIndex);
            resetDragState();
        },
        [computeInsertIndex, draggingKey, finalizeReorder, isEnabled, resetDragState]
    );

    // Clears drop indicator when drag leaves the valid drop zone
    // Uses deferred clearing to avoid flicker during drag
    const handleDragLeave = useCallback(
        (event: DragEvent<HTMLElement>) => {
            if (!isEnabled || draggingKey === null) {
                return;
            }

            const relatedTarget = event.relatedTarget as HTMLElement | null;
            if (!relatedTarget) {
                scheduleDropIndexClear();
                return;
            }

            if (event.currentTarget.contains(relatedTarget)) {
                return;
            }

            if (relatedTarget.closest('[data-reorder-draggable="true"]')) {
                return;
            }

            // Prevent clearing drop index when hovering over spacer gaps
            if (relatedTarget.closest('[data-reorder-gap="true"]')) {
                return;
            }

            scheduleDropIndexClear();
        },
        [draggingKey, isEnabled, scheduleDropIndexClear]
    );

    // Cleans up drag state when drag operation ends
    // Called regardless of whether the drop was successful
    const handleDragEnd = useCallback(() => {
        if (!draggingKey) {
            return;
        }
        resetDragState();
    }, [draggingKey, resetDragState]);

    // No-op handlers used when drag and drop is disabled
    const disabledHandlers = useMemo<ListReorderHandlers>(
        () => ({
            draggable: false,
            onDragStart: noopHandler,
            onDragOver: noopHandler,
            onDragLeave: noopHandler,
            onDrop: noopHandler,
            onDragEnd: noopHandler
        }),
        []
    );

    // Factory function to create drag handlers for a specific item
    // Returns disabled handlers when drag and drop is not enabled
    const getDragHandlers = useCallback(
        (key: string): ListReorderHandlers => {
            if (!isEnabled) {
                return disabledHandlers;
            }

            return {
                draggable: true,
                onDragStart: event => handleDragStart(event, key),
                onDragOver: event => handleDragOver(event, key),
                onDragLeave: handleDragLeave,
                onDrop: event => void handleDrop(event, key),
                onDragEnd: handleDragEnd
            };
        },
        [disabledHandlers, handleDragEnd, handleDragLeave, handleDragOver, handleDragStart, handleDrop, isEnabled]
    );

    return {
        getDragHandlers,
        dropIndex,
        draggingKey
    };
}
