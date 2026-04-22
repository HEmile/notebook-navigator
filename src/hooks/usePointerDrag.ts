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

import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface PointerDragHandlers {
    onMove: (event: PointerEvent) => void;
    onEnd: (event: PointerEvent) => void;
    onCancel?: (event: PointerEvent) => void;
}

interface PointerDragStartOptions<T extends HTMLElement> extends PointerDragHandlers {
    event: ReactPointerEvent<T>;
}

interface PointerDragResult {
    startPointerDrag: <T extends HTMLElement>(options: PointerDragStartOptions<T>) => void;
}

/**
 * Manages pointer drag listeners with pointer capture and cleanup.
 */
export function usePointerDrag(): PointerDragResult {
    const cleanupRef = useRef<(() => void) | null>(null);

    // Initiates pointer tracking with capture, attaching move/end/cancel listeners to window
    const startPointerDrag = useCallback(<T extends HTMLElement>({ event, onMove, onEnd, onCancel }: PointerDragStartOptions<T>) => {
        // Prevent overlapping drag operations
        if (cleanupRef.current) {
            return;
        }

        const target = event.currentTarget;
        const pointerId = event.pointerId;

        // Forwards pointer move events to the provided handler
        function handlePointerMove(moveEvent: PointerEvent) {
            if (moveEvent.pointerId !== pointerId) {
                return;
            }
            onMove(moveEvent);
        }

        // Cleans up listeners and invokes the end callback when pointer is released
        function handlePointerEnd(endEvent: PointerEvent) {
            if (endEvent.pointerId !== pointerId) {
                return;
            }
            cleanup();
            onEnd(endEvent);
        }

        // Handles pointer cancellation (e.g., system gesture interruption)
        function handlePointerCancel(cancelEvent: PointerEvent) {
            if (cancelEvent.pointerId !== pointerId) {
                return;
            }
            cleanup();
            if (onCancel) {
                onCancel(cancelEvent);
                return;
            }
            onEnd(cancelEvent);
        }

        // Removes all listeners and releases pointer capture
        function cleanup() {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerCancel);
            if (target.hasPointerCapture(pointerId)) {
                target.releasePointerCapture(pointerId);
            }
            cleanupRef.current = null;
        }

        // Capture pointer to receive events even when cursor leaves the element
        target.setPointerCapture(pointerId);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerCancel);

        cleanupRef.current = cleanup;
    }, []);

    // Cleans up any active drag operation when the component unmounts
    useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, []);

    return { startPointerDrag };
}
