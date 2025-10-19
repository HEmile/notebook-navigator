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

import { useSelectionState } from '../context/SelectionContext';
import { useSettingsState } from '../context/SettingsContext';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useListActions } from '../hooks/useListActions';

interface ListToolbarProps {
    isSearchActive?: boolean;
    onSearchToggle?: () => void;
}

export function ListToolbar({ isSearchActive, onSearchToggle }: ListToolbarProps) {
    const settings = useSettingsState();
    const selectionState = useSelectionState();

    // Use the shared actions hook
    const { handleNewFile, handleAppearanceMenu, handleSortMenu, handleToggleDescendants, getSortIcon, isCustomSort, hasCustomAppearance } =
        useListActions();

    return (
        <div className="nn-mobile-toolbar">
            <button
                className={`nn-mobile-toolbar-button ${isSearchActive ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.search}
                onClick={onSearchToggle}
                disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopic}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-search" />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${settings.includeDescendantNotes ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.toggleDescendantNotes}
                onClick={handleToggleDescendants}
                disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopic}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-layers" />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${isCustomSort ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.changeSortOrder}
                onClick={handleSortMenu}
                disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopic}
                tabIndex={-1}
            >
                <ObsidianIcon name={getSortIcon()} />
            </button>
            <button
                className={`nn-mobile-toolbar-button ${hasCustomAppearance ? 'nn-mobile-toolbar-button-active' : ''}`}
                aria-label={strings.paneHeader.changeAppearance}
                onClick={handleAppearanceMenu}
                disabled={!selectionState.selectedFolder && !selectionState.selectedTag && !selectionState.selectedTopic}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-palette" />
            </button>
            <button
                className="nn-mobile-toolbar-button"
                aria-label={strings.paneHeader.newNote}
                onClick={handleNewFile}
                disabled={!selectionState.selectedFolder}
                tabIndex={-1}
            >
                <ObsidianIcon name="lucide-pen-box" />
            </button>
        </div>
    );
}
