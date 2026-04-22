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

import React from 'react';
import type { DualPaneOrientation } from '../types';

interface SkeletonViewProps {
    paneSize: number;
    singlePane: boolean;
    searchActive: boolean;
    orientation: DualPaneOrientation;
}

export const SkeletonView = React.memo(function SkeletonView({ paneSize, singlePane, searchActive, orientation }: SkeletonViewProps) {
    const listPaneClass = searchActive ? 'nn-skeleton-list-pane nn-search-active' : 'nn-skeleton-list-pane';

    if (singlePane) {
        return (
            <div className={listPaneClass}>
                <div className="nn-skeleton-list-header" />
                {searchActive && <div className="nn-skeleton-search-bar" />}
                <div className="nn-skeleton-content" />
            </div>
        );
    }

    // Render vertical split layout
    if (orientation === 'vertical') {
        return (
            <>
                <div className="nn-skeleton-navigation-pane nn-skeleton-navigation-pane-vertical" style={{ flexBasis: `${paneSize}px` }}>
                    <div className="nn-skeleton-nav-header" />
                    <div className="nn-skeleton-content" />
                </div>
                <div className={`${listPaneClass} nn-skeleton-list-pane-vertical`}>
                    <div className="nn-skeleton-list-header" />
                    {searchActive && <div className="nn-skeleton-search-bar" />}
                    <div className="nn-skeleton-content" />
                </div>
            </>
        );
    }

    // Render horizontal split layout
    return (
        <>
            <div className="nn-skeleton-navigation-pane" style={{ width: `${paneSize}px` }}>
                <div className="nn-skeleton-nav-header" />
                <div className="nn-skeleton-content" />
            </div>
            <div className={listPaneClass}>
                <div className="nn-skeleton-list-header" />
                {searchActive && <div className="nn-skeleton-search-bar" />}
                <div className="nn-skeleton-content" />
            </div>
        </>
    );
});
