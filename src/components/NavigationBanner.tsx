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

import { useMemo, useLayoutEffect, useRef } from 'react';
import { TFile } from 'obsidian';
import { useServices } from '../context/ServicesContext';

interface NavigationBannerProps {
    path: string;
    onHeightChange?: (height: number) => void;
}

/**
 * Displays an optional image banner above the navigation tree.
 * Falls back to a helper message if the configured file cannot be loaded.
 */
export function NavigationBanner({ path, onHeightChange }: NavigationBannerProps) {
    const { app } = useServices();
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Resolve the banner file and get its resource path if it exists
    const bannerData = useMemo(() => {
        const file = app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            try {
                const resourcePath = app.vault.getResourcePath(file);
                return { resourcePath, missing: false };
            } catch {
                return { resourcePath: null, missing: true };
            }
        }
        return { resourcePath: null, missing: true };
    }, [app, path]);

    // Measure banner height and notify parent component when it changes
    useLayoutEffect(() => {
        const element = containerRef.current;
        if (!element || !onHeightChange) {
            return;
        }

        const emitHeight = () => {
            onHeightChange(element.getBoundingClientRect().height);
        };

        // Emit initial height
        emitHeight();

        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        // Watch for size changes and update height
        const observer = new ResizeObserver(() => {
            emitHeight();
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [onHeightChange, path]);

    if (!bannerData.resourcePath) {
        return null;
    }

    return (
        <div className="nn-nav-banner" aria-hidden="true" ref={containerRef}>
            <img className="nn-nav-banner-image" src={bannerData.resourcePath} alt="" />
        </div>
    );
}
