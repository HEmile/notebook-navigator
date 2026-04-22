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

import React, { useState, useEffect, forwardRef } from 'react';
import { useFileCache } from '../context/StorageContext';
import { useUIState } from '../context/UIStateContext';
import { useSettingsState } from '../context/SettingsContext';
import { useServices } from '../context/ServicesContext';
import { NotebookNavigatorComponent } from './NotebookNavigatorComponent';
import type { NotebookNavigatorHandle } from './NotebookNavigatorComponent';
import { SkeletonView } from './SkeletonView';
import { localStorage } from '../utils/localStorage';
import { getNavigationPaneSizing } from '../utils/paneSizing';
import { getBackgroundClasses } from '../utils/paneLayout';
import { useNavigatorScale } from '../hooks/useNavigatorScale';
import { useUXPreferences } from '../context/UXPreferencesContext';

/**
 * Container component that handles storage initialization.
 * Shows a skeleton view while storage is loading, then renders the full navigator.
 */
export const NotebookNavigatorContainer = React.memo(
    forwardRef<NotebookNavigatorHandle>(function NotebookNavigatorContainer(_, ref) {
        const { isStorageReady } = useFileCache();
        const uiState = useUIState();
        const settings = useSettingsState();
        const uxPreferences = useUXPreferences();
        const { isMobile } = useServices();
        const orientation = settings.dualPaneOrientation;
        // Get background mode for desktop layout
        const desktopBackground = settings.desktopBackground ?? 'separate';
        const { style: scaleWrapperStyle, dataAttr: scaleWrapperDataAttr } = useNavigatorScale({
            isMobile,
            desktopScale: settings.desktopScale,
            mobileScale: settings.mobileScale
        });
        // Get sizing config for current orientation
        const { defaultSize, minSize, storageKey } = getNavigationPaneSizing(orientation);
        const [paneSize, setPaneSize] = useState(defaultSize);

        // Load saved pane size for current orientation
        useEffect(() => {
            const savedValue = localStorage.get<unknown>(storageKey);
            if (typeof savedValue === 'number' && Number.isFinite(savedValue)) {
                setPaneSize(Math.max(minSize, savedValue));
                return;
            }
            if (typeof savedValue === 'string') {
                const parsed = Number(savedValue);
                if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
                    setPaneSize(Math.max(minSize, parsed));
                    return;
                }
            }

            setPaneSize(defaultSize);
        }, [defaultSize, minSize, storageKey]);

        if (!isStorageReady) {
            // Build CSS classes for skeleton view
            const containerClasses = ['nn-split-container'];
            // Apply platform-specific classes and background mode
            if (isMobile) {
                containerClasses.push('nn-mobile');
            } else {
                containerClasses.push('nn-desktop');
                containerClasses.push(...getBackgroundClasses(desktopBackground));
            }
            // Apply pane mode classes
            if (uiState.singlePane) {
                containerClasses.push('nn-single-pane');
                containerClasses.push(uiState.currentSinglePaneView === 'navigation' ? 'show-navigation' : 'show-files');
            } else {
                containerClasses.push('nn-dual-pane');
                containerClasses.push(`nn-orientation-${orientation}`);
            }

            return (
                <div className="nn-scale-wrapper" data-ui-scale={scaleWrapperDataAttr} style={scaleWrapperStyle}>
                    <div className={containerClasses.join(' ')}>
                        <SkeletonView
                            paneSize={paneSize}
                            singlePane={uiState.singlePane}
                            searchActive={uxPreferences.searchActive}
                            orientation={orientation}
                        />
                    </div>
                </div>
            );
        }

        return <NotebookNavigatorComponent ref={ref} />;
    })
);
