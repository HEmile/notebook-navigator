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

import { useLayoutEffect, useState } from 'react';

interface UseMeasuredElementHeightOptions {
    enabled?: boolean;
}

/**
 * Measures the height of a referenced element and keeps it in sync using ResizeObserver.
 * Falls back to window resize events when ResizeObserver is not available.
 */
export function useMeasuredElementHeight(
    elementRef: React.RefObject<HTMLElement | null>,
    options?: UseMeasuredElementHeightOptions
): number {
    const enabled = options?.enabled ?? true;
    const [height, setHeight] = useState<number>(0);

    useLayoutEffect(() => {
        if (!enabled) {
            setHeight(prev => (prev === 0 ? prev : 0));
            return;
        }

        const element = elementRef.current;
        if (!element) {
            setHeight(prev => (prev === 0 ? prev : 0));
            return;
        }

        const updateHeight = () => {
            // Use layout units so scroll math stays consistent under UI scale transforms.
            const nextHeight = element.offsetHeight;
            setHeight(prev => (prev === nextHeight ? prev : nextHeight));
        };

        updateHeight();

        if (typeof ResizeObserver === 'undefined') {
            const handleResize = () => updateHeight();
            window.addEventListener('resize', handleResize);
            return () => {
                window.removeEventListener('resize', handleResize);
            };
        }

        const resizeObserver = new ResizeObserver(() => {
            updateHeight();
        });
        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, [enabled, elementRef]);

    return height;
}
