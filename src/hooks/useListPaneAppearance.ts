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

import { useMemo } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState } from '../context/SelectionContext';
import type { NotePropertyType, ListDisplayMode, ListNoteGroupingOption } from '../settings/types';
import type { NotebookNavigatorSettings } from '../settings';
import { ItemType } from '../types';
import { resolveListGrouping } from '../utils/listGrouping';

export interface FolderAppearance {
    mode?: ListDisplayMode;
    titleRows?: number;
    previewRows?: number;
    notePropertyType?: NotePropertyType;
    groupBy?: ListNoteGroupingOption;
}

export type TagAppearance = FolderAppearance;

export interface ListPaneAppearanceSettings {
    mode: ListDisplayMode;
    titleRows: number;
    previewRows: number;
    notePropertyType: NotePropertyType;
    showDate: boolean;
    showPreview: boolean;
    showImage: boolean;
    groupBy: ListNoteGroupingOption;
}

export function getDefaultListMode(settings: NotebookNavigatorSettings): ListDisplayMode {
    return settings.defaultListMode === 'compact' ? 'compact' : 'standard';
}

/**
 * Resolve the effective list mode for a folder/tag appearance.
 */
export function resolveListMode({
    appearance,
    defaultMode
}: {
    appearance?: FolderAppearance;
    defaultMode: ListDisplayMode;
}): ListDisplayMode {
    if (appearance?.mode === 'compact' || appearance?.mode === 'standard') {
        return appearance.mode;
    }

    return defaultMode;
}

/** Return visibility flags for a given list mode */
function getVisibilityForMode(mode: ListDisplayMode, settings: NotebookNavigatorSettings) {
    if (mode === 'compact') {
        return {
            showDate: false,
            showPreview: false,
            showImage: false
        };
    }

    return {
        showDate: settings.showFileDate,
        showPreview: settings.showFilePreview,
        showImage: settings.showFeatureImage
    };
}

/**
 * Hook to get effective appearance settings for the current selection (folder or tag)
 * Merges folder/tag-specific settings with defaults
 */
export function useListPaneAppearance() {
    const settings = useSettingsState();
    const { selectedFolder, selectedTag, selectedProperty, selectionType } = useSelectionState();

    return useMemo<ListPaneAppearanceSettings>(() => {
        const defaultMode = getDefaultListMode(settings);

        const buildAppearance = (appearance: FolderAppearance | undefined) => {
            const mode = resolveListMode({ appearance, defaultMode });
            const visibility = getVisibilityForMode(mode, settings);

            return {
                mode,
                titleRows: appearance?.titleRows ?? settings.fileNameRows,
                previewRows: appearance?.previewRows ?? settings.previewRows,
                notePropertyType: appearance?.notePropertyType ?? settings.notePropertyType,
                showDate: visibility.showDate,
                showPreview: visibility.showPreview,
                showImage: visibility.showImage
            };
        };

        // For folders
        if (selectionType === ItemType.FOLDER && selectedFolder) {
            const folderPath = selectedFolder.path;
            const folderAppearance = settings.folderAppearances?.[folderPath];
            // Resolve effective grouping mode for this folder
            const grouping = resolveListGrouping({
                settings,
                selectionType,
                folderPath
            });

            const appearance = buildAppearance(folderAppearance);

            return {
                ...appearance,
                groupBy: grouping.effectiveGrouping
            };
        }

        // For tags
        if (selectionType === ItemType.TAG && selectedTag) {
            const tagAppearance = settings.tagAppearances?.[selectedTag];
            // Resolve effective grouping mode for this tag
            const grouping = resolveListGrouping({
                settings,
                selectionType,
                tag: selectedTag
            });

            const appearance = buildAppearance(tagAppearance);

            return {
                ...appearance,
                groupBy: grouping.effectiveGrouping
            };
        }

        // For properties
        if (selectionType === ItemType.PROPERTY && selectedProperty) {
            const propertyAppearance = settings.propertyAppearances?.[selectedProperty];
            const grouping = resolveListGrouping({
                settings,
                selectionType,
                propertyNodeId: selectedProperty
            });

            const appearance = buildAppearance(propertyAppearance);

            return {
                ...appearance,
                groupBy: grouping.effectiveGrouping
            };
        }

        // Default (no selection or other selection types)
        // Resolve default grouping mode when no folder or tag is selected
        const grouping = resolveListGrouping({ settings });
        const appearance = buildAppearance(undefined);
        return {
            ...appearance,
            groupBy: grouping.effectiveGrouping
        };
    }, [settings, selectedFolder, selectedTag, selectedProperty, selectionType]);
}
