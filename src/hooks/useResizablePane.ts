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

// src/hooks/useResizablePane.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { type DualPaneOrientation } from '../types';
import { localStorage } from '../utils/localStorage';
import { getNavigationPaneSizing } from '../utils/paneSizing';

interface UseResizablePaneConfig {
    orientation?: DualPaneOrientation;
    initialSize?: number;
    min?: number;
    storageKey?: string;
}

interface UseResizablePaneResult {
    paneSize: number;
    isResizing: boolean;
    resizeHandleProps: {
        onMouseDown: (e: React.MouseEvent) => void;
    };
}

/**
 * Custom hook for managing resizable pane width with optional localStorage persistence.
 * Handles mouse events for dragging the resize handle and constrains the width
 * within specified bounds.
 *
 * @param config - Configuration object with initial width, min bound, and storage key
 * @returns Current pane width and props to spread on the resize handle element
 */
export function useResizablePane({
    orientation = 'horizontal',
    initialSize,
    min,
    storageKey
}: UseResizablePaneConfig = {}): UseResizablePaneResult {
    // Get default sizing parameters for orientation
    const sizing = getNavigationPaneSizing(orientation);

    // Use provided values or fall back to defaults
    const resolvedInitialSize = typeof initialSize === 'number' ? initialSize : sizing.defaultSize;

    const resolvedMin = typeof min === 'number' ? min : sizing.minSize;

    // Track cleanup function for current resize operation
    const cleanupRef = useRef<(() => void) | null>(null);

    // Load initial width from localStorage if storage key is provided
    const [paneSize, setPaneSize] = useState(() => {
        if (storageKey) {
            const savedSize = localStorage.get<number>(storageKey);
            if (typeof savedSize === 'number') {
                return Math.max(resolvedMin, savedSize);
            }
        }
        return resolvedInitialSize;
    });

    // Track resizing state
    const [isResizing, setIsResizing] = useState(false);

    const handleResizeMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // Capture starting position based on orientation
            const startPosition = orientation === 'horizontal' ? e.clientX : e.clientY;
            const startSize = paneSize;
            let currentSize = startSize;

            // Check if RTL mode is active for horizontal dragging
            const isRTL = orientation === 'horizontal' && document.body.classList.contains('mod-rtl');

            // Set resizing state
            setIsResizing(true);

            const handleMouseMove = (moveEvent: MouseEvent) => {
                // Calculate position delta based on orientation
                const currentPosition = orientation === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
                let delta = currentPosition - startPosition;
                // In RTL mode, reverse the delta to make dragging feel natural
                if (isRTL) {
                    delta = -delta;
                }
                currentSize = Math.max(resolvedMin, startSize + delta);
                setPaneSize(currentSize);
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                // Save final width to localStorage on mouseup
                if (storageKey) {
                    localStorage.set(storageKey, currentSize);
                }
                // Clear resizing state
                setIsResizing(false);
                // Clear the cleanup ref since we've already cleaned up
                cleanupRef.current = null;
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Store cleanup function in ref so it can be called on unmount
            cleanupRef.current = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                setIsResizing(false);
            };
        },
        [orientation, paneSize, resolvedMin, storageKey]
    );

    // Reload pane size when orientation changes
    useEffect(() => {
        if (!storageKey) {
            setPaneSize(resolvedInitialSize);
            return;
        }

        const savedSize = localStorage.get<number>(storageKey);
        if (typeof savedSize === 'number') {
            setPaneSize(Math.max(resolvedMin, savedSize));
            return;
        }

        setPaneSize(resolvedInitialSize);
    }, [orientation, resolvedInitialSize, resolvedMin, storageKey]);

    // Cleanup on unmount if resize is in progress
    useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, []);

    return {
        paneSize,
        isResizing,
        resizeHandleProps: {
            onMouseDown: handleResizeMouseDown
        }
    };
}
