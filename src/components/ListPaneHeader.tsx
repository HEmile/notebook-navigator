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

import React, { useEffect, useMemo } from 'react';
import { Platform } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { strings } from '../i18n';
import { getIconService, useIconServiceVersion } from '../services/icons';
import { ObsidianIcon } from './ObsidianIcon';
import { useListActions } from '../hooks/useListActions';
import { useListPaneTitle } from '../hooks/useListPaneTitle';
import { normalizeTagPath } from '../utils/tagUtils';

interface ListPaneHeaderProps {
    onHeaderClick?: () => void;
    isSearchActive?: boolean;
    onSearchToggle?: () => void;
}

export function ListPaneHeader({ onHeaderClick, isSearchActive, onSearchToggle }: ListPaneHeaderProps) {
    const iconRef = React.useRef<HTMLSpanElement>(null);
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const { desktopTitle, breadcrumbSegments, iconName, showIcon } = useListPaneTitle();
    const listPaneTitlePreference = settings.listPaneTitle ?? 'header';
    const iconVersion = useIconServiceVersion();

    // Use the shared actions hook
    const { handleNewFile, handleAppearanceMenu, handleSortMenu, handleToggleDescendants, getSortIcon, isCustomSort, hasCustomAppearance } =
        useListActions();

    const shouldRenderBreadcrumbSegments = isMobile;
    const shouldShowHeaderTitle = !isMobile && listPaneTitlePreference === 'header';
    const shouldShowHeaderIcon = shouldShowHeaderTitle && showIcon;

    const breadcrumbContent = useMemo((): React.ReactNode => {
        if (!shouldRenderBreadcrumbSegments) {
            return desktopTitle;
        }

        const parts: React.ReactNode[] = [];
        breadcrumbSegments.forEach((segment, index) => {
            const key = `${segment.label}-${index}`;

            if (segment.isLast || segment.targetType === 'none' || !segment.targetPath) {
                parts.push(
                    <span key={key} className="nn-path-current">
                        {segment.label}
                    </span>
                );
            } else {
                const handleClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (segment.targetType === 'folder') {
                        const targetPath = segment.targetPath;
                        const targetFolder = targetPath ? app.vault.getFolderByPath(targetPath) : null;
                        if (targetFolder) {
                            selectionDispatch({ type: 'SET_SELECTED_FOLDER', folder: targetFolder });
                        }
                    } else if (segment.targetType === 'tag' && segment.targetPath) {
                        selectionDispatch({ type: 'SET_SELECTED_TAG', tag: normalizeTagPath(segment.targetPath) });
                    }
                };

                parts.push(
                    <span key={key} className="nn-path-segment" onClick={handleClick}>
                        {segment.label}
                    </span>
                );
            }

            if (!segment.isLast) {
                parts.push(
                    <span key={`${key}-separator`} className="nn-path-separator">
                        {' / '}
                    </span>
                );
            }
        });

        return parts;
    }, [app.vault, breadcrumbSegments, desktopTitle, selectionDispatch, shouldRenderBreadcrumbSegments]);

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [showFade, setShowFade] = React.useState(false);

    // Renders the header icon when icon name or version changes
    useEffect(() => {
        if (!shouldShowHeaderIcon || !iconRef.current) {
            return;
        }

        const iconService = getIconService();
        iconService.renderIcon(iconRef.current, iconName);
    }, [iconName, iconVersion, shouldShowHeaderIcon]);

    // Auto-scroll to end when selection changes
    useEffect(() => {
        if (!isMobile) {
            setShowFade(false);
            return;
        }
        if (!scrollContainerRef.current) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({
                    left: scrollContainerRef.current.scrollWidth,
                    behavior: 'instant'
                });
            }
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [selectionState.selectedFolder, selectionState.selectedTag, isMobile]);

    // Updates fade gradient visibility based on scroll position
    const handleScroll = React.useCallback(() => {
        if (!isMobile) {
            return;
        }
        if (scrollContainerRef.current) {
            setShowFade(scrollContainerRef.current.scrollLeft > 0);
        }
    }, [isMobile]);

    if (isMobile) {
        // On mobile, show simplified header with back button and path - actions moved to tab bar
        return (
            <div className="nn-pane-header nn-pane-header-simple" onClick={onHeaderClick}>
                <div className="nn-mobile-header nn-mobile-header-no-icon">
                    <button
                        className="nn-icon-button nn-back-button"
                        aria-label={strings.paneHeader.mobileBackToNavigation}
                        data-pane-toggle="navigation"
                        onClick={e => {
                            e.stopPropagation();
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                        }}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name={Platform.isAndroidApp ? 'lucide-arrow-left' : 'lucide-chevron-left'} />
                    </button>
                    {showFade && <div className="nn-breadcrumb-fade" />}
                    <div ref={scrollContainerRef} className="nn-breadcrumb-scroll" onScroll={handleScroll}>
                        <span className="nn-mobile-title">{breadcrumbContent}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="nn-pane-header">
            <div className="nn-header-actions nn-header-actions--space-between">
                {uiState.singlePane && (
                    <button
                        className="nn-icon-button"
                        data-pane-toggle="navigation"
                        onClick={() => {
                            uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'navigation' });
                            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
                        }}
                        aria-label={strings.paneHeader.showFolders}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-chevron-left" />
                    </button>
                )}
                <span className="nn-pane-header-title">
                    {shouldShowHeaderIcon && <span ref={iconRef} className="nn-pane-header-icon" />}
                    {shouldShowHeaderTitle && <span className="nn-pane-header-text">{breadcrumbContent}</span>}
                </span>
                <div className="nn-header-actions">
                    <button
                        className={`nn-icon-button ${isSearchActive ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.search}
                        onClick={onSearchToggle}
                        disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopicPath}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-search" />
                    </button>
                    <button
                        className={`nn-icon-button ${settings.includeDescendantNotes ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.toggleDescendantNotes}
                        onClick={handleToggleDescendants}
                        disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopicPath}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-layers" />
                    </button>
                    <button
                        className={`nn-icon-button ${isCustomSort ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.changeSortOrder}
                        onClick={handleSortMenu}
                        disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopicPath}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name={getSortIcon()} />
                    </button>
                    <button
                        className={`nn-icon-button ${hasCustomAppearance ? 'nn-icon-button-active' : ''}`}
                        aria-label={strings.paneHeader.changeAppearance}
                        onClick={handleAppearanceMenu}
                        disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopicPath}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-palette" />
                    </button>
                    <button
                        className="nn-icon-button"
                        aria-label={strings.paneHeader.newNote}
                        onClick={handleNewFile}
                        disabled={!selectionState.selectedFolder}
                        tabIndex={-1}
                    >
                        <ObsidianIcon name="lucide-pen-box" />
                    </button>
                </div>
            </div>
        </div>
    );
}
