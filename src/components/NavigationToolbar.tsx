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

import { useSelectionState } from '../context/SelectionContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferenceActions, useUXPreferences } from '../context/UXPreferencesContext';
import { strings } from '../i18n';
import { ServiceIcon } from './ServiceIcon';
import { useNavigationActions } from '../hooks/useNavigationActions';
import { hasHiddenItemSources } from '../utils/exclusionUtils';
import { runAsyncAction } from '../utils/async';
import { resolveUXIcon } from '../utils/uxIcons';

interface NavigationToolbarProps {
    onTreeUpdateComplete?: () => void;
    onToggleRootFolderReorder?: () => void;
    rootReorderActive?: boolean;
    rootReorderDisabled?: boolean;
}

export function NavigationToolbar({
    onTreeUpdateComplete,
    onToggleRootFolderReorder,
    rootReorderActive,
    rootReorderDisabled
}: NavigationToolbarProps) {
    const settings = useSettingsState();
    const uxPreferences = useUXPreferences();
    const { toggleShowCalendar } = useUXPreferenceActions();
    const showHiddenItems = uxPreferences.showHiddenItems;
    const isCalendarVisible = uxPreferences.showCalendar;
    const selectionState = useSelectionState();
    const navigationVisibility = settings.toolbarVisibility.navigation;

    // Hook providing shared navigation actions (expand/collapse, folder creation, toggle visibility)
    const { shouldCollapseItems, handleExpandCollapseAll, handleNewFolder, handleToggleShowExcludedFolders } = useNavigationActions();
    // Detects if any hidden folders, tags, or files are configured to determine if toggle should be shown
    const hasHiddenItems = hasHiddenItemSources(settings);

    const showExpandCollapseButton = navigationVisibility.expandCollapse;
    const showCalendarButton = navigationVisibility.calendar && settings.calendarEnabled && settings.calendarPlacement !== 'right-sidebar';
    const showHiddenItemsButton = navigationVisibility.hiddenItems && hasHiddenItems;
    const showRootReorderButton = navigationVisibility.rootReorder;
    const showNewFolderButton = navigationVisibility.newFolder;

    const leftButtonCount = [showExpandCollapseButton, showCalendarButton, showHiddenItemsButton, showRootReorderButton].filter(
        Boolean
    ).length;
    const totalButtonCount = leftButtonCount + (showNewFolderButton ? 1 : 0);
    const leftGroupClassName = leftButtonCount === 1 ? 'nn-mobile-toolbar-circle' : 'nn-mobile-toolbar-pill';
    const leftButtonBaseClassName =
        leftButtonCount === 1 ? 'nn-mobile-toolbar-button nn-mobile-toolbar-button-circle' : 'nn-mobile-toolbar-button';

    if (totalButtonCount === 0) {
        return null;
    }

    return (
        <div className="nn-mobile-toolbar">
            <div className="nn-mobile-toolbar-left">
                {leftButtonCount > 0 ? (
                    <div className={leftGroupClassName}>
                        {showExpandCollapseButton ? (
                            <button
                                className={leftButtonBaseClassName}
                                aria-label={
                                    shouldCollapseItems() ? strings.paneHeader.collapseAllFolders : strings.paneHeader.expandAllFolders
                                }
                                onClick={() => {
                                    handleExpandCollapseAll();
                                    if (onTreeUpdateComplete) {
                                        requestAnimationFrame(() => {
                                            onTreeUpdateComplete();
                                        });
                                    }
                                }}
                                tabIndex={-1}
                            >
                                <ServiceIcon
                                    iconId={resolveUXIcon(
                                        settings.interfaceIcons,
                                        shouldCollapseItems() ? 'nav-collapse-all' : 'nav-expand-all'
                                    )}
                                />
                            </button>
                        ) : null}
                        {showHiddenItemsButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${showHiddenItems ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={showHiddenItems ? strings.paneHeader.hideExcludedItems : strings.paneHeader.showExcludedItems}
                                onClick={() => {
                                    handleToggleShowExcludedFolders();
                                    if (onTreeUpdateComplete) {
                                        requestAnimationFrame(() => {
                                            onTreeUpdateComplete();
                                        });
                                    }
                                }}
                                disabled={!hasHiddenItems}
                                tabIndex={-1}
                            >
                                <ServiceIcon iconId={resolveUXIcon(settings.interfaceIcons, 'nav-hidden-items')} />
                            </button>
                        ) : null}
                        {showCalendarButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${isCalendarVisible ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={isCalendarVisible ? strings.paneHeader.hideCalendar : strings.paneHeader.showCalendar}
                                onClick={toggleShowCalendar}
                                tabIndex={-1}
                            >
                                <ServiceIcon iconId={resolveUXIcon(settings.interfaceIcons, 'nav-calendar')} />
                            </button>
                        ) : null}
                        {showRootReorderButton ? (
                            <button
                                className={`${leftButtonBaseClassName}${rootReorderActive ? ' nn-mobile-toolbar-button-active' : ''}`}
                                aria-label={
                                    rootReorderActive ? strings.paneHeader.finishRootFolderReorder : strings.paneHeader.reorderRootFolders
                                }
                                onClick={onToggleRootFolderReorder}
                                disabled={rootReorderDisabled}
                                tabIndex={-1}
                            >
                                <ServiceIcon iconId={resolveUXIcon(settings.interfaceIcons, 'nav-root-reorder')} />
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {showNewFolderButton ? (
                <div className="nn-mobile-toolbar-right">
                    <div className="nn-mobile-toolbar-circle">
                        <button
                            className="nn-mobile-toolbar-button nn-mobile-toolbar-button-circle"
                            aria-label={strings.paneHeader.newFolder}
                            onClick={() => {
                                runAsyncAction(() => handleNewFolder());
                            }}
                            disabled={!selectionState.selectedFolder}
                            tabIndex={-1}
                        >
                            <ServiceIcon iconId={resolveUXIcon(settings.interfaceIcons, 'nav-new-folder')} />
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
