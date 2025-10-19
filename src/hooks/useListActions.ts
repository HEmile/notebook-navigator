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

import { useCallback } from 'react';
import { Menu } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { strings } from '../i18n';
import type { SortOption } from '../settings';
import { ItemType } from '../types';
import { getEffectiveSortOption, getSortIcon as getSortIconName, SORT_OPTIONS } from '../utils/sortUtils';
import { showListPaneAppearanceMenu } from '../components/ListPaneAppearanceMenu';
import { useListPaneAppearance } from './useListPaneAppearance';
import { getFilesForFolder } from '../utils/fileFinder';

/**
 * Custom hook that provides shared actions for list pane toolbars.
 * Used by both ListPaneHeader (desktop) and ListToolbar (mobile) to avoid code duplication.
 *
 * @returns Object containing action handlers and computed values for list pane operations
 */
export function useListActions() {
    const { app } = useServices();
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();
    const appearanceSettings = useListPaneAppearance();

    const handleNewFile = useCallback(async () => {
        if (!selectionState.selectedFolder) return;

        try {
            await fileSystemOps.createNewFile(selectionState.selectedFolder);
        } catch {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [selectionState.selectedFolder, fileSystemOps]);

    const getCurrentSortOption = useCallback((): SortOption => {
        return getEffectiveSortOption(settings, selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag, selectionState.selectedTopic);
    }, [settings, selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag, selectionState.selectedTopic]);

    const getSortIcon = useCallback(() => {
        return getSortIconName(getCurrentSortOption());
    }, [getCurrentSortOption]);

    const handleAppearanceMenu = useCallback(
        (event: React.MouseEvent) => {
            showListPaneAppearanceMenu({
                event: event.nativeEvent,
                titleRows: appearanceSettings.titleRows,
                previewRows: appearanceSettings.previewRows,
                showDate: appearanceSettings.showDate,
                showPreview: appearanceSettings.showPreview,
                showImage: appearanceSettings.showImage,
                settings,
                selectedFolder: selectionState.selectedFolder,
                selectedTag: selectionState.selectedTag,
                selectedTopic: selectionState.selectedTopic,
                selectionType: selectionState.selectionType,
                updateSettings
            });
        },
        [
            appearanceSettings,
            settings,
            selectionState.selectedFolder,
            selectionState.selectedTag,
            selectionState.selectedTopic,
            selectionState.selectionType,
            updateSettings
        ]
    );

    const handleSortMenu = useCallback(
        (event: React.MouseEvent) => {
            const menu = new Menu();
            const currentSort = getCurrentSortOption();
            const isCustomSort =
                (selectionState.selectionType === ItemType.FOLDER &&
                    selectionState.selectedFolder &&
                    metadataService.getFolderSortOverride(selectionState.selectedFolder.path)) ||
                (selectionState.selectionType === ItemType.TAG &&
                    selectionState.selectedTag &&
                    metadataService.getTagSortOverride(selectionState.selectedTag)) ||
                (selectionState.selectionType === ItemType.TOPIC &&
                    selectionState.selectedTopic &&
                    metadataService.getTagSortOverride(selectionState.selectedTopic));

            menu.addItem(item => {
                item.setTitle(
                    `${strings.paneHeader.defaultSort}: ${strings.settings.items.sortNotesBy.options[settings.defaultFolderSort]}`
                )
                    .setChecked(!isCustomSort)
                    .onClick(async () => {
                        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                            await metadataService.removeFolderSortOverride(selectionState.selectedFolder.path);
                        } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                            await metadataService.removeTagSortOverride(selectionState.selectedTag);
                        } else if (selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopic) {
                            await metadataService.removeTagSortOverride(selectionState.selectedTopic);
                        }
                        app.workspace.requestSaveLayout();
                    });
            });

            menu.addSeparator();

            let lastCategory = '';
            SORT_OPTIONS.forEach(option => {
                const category = option.split('-')[0];
                if (lastCategory && lastCategory !== category) {
                    menu.addSeparator();
                }
                lastCategory = category;

                menu.addItem(item => {
                    item.setTitle(strings.settings.items.sortNotesBy.options[option])
                        .setChecked(!!isCustomSort && currentSort === option)
                        .onClick(async () => {
                            if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                                await metadataService.setFolderSortOverride(selectionState.selectedFolder.path, option);
                            } else if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                                await metadataService.setTagSortOverride(selectionState.selectedTag, option);
                            } else if (selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopic) {
                                await metadataService.setTagSortOverride(selectionState.selectedTopic, option);
                            } else {
                                await updateSettings(s => {
                                    s.defaultFolderSort = option;
                                });
                            }
                            app.workspace.requestSaveLayout();
                        });
                });
            });

            menu.showAtMouseEvent(event.nativeEvent);
        },
        [
            selectionState.selectionType,
            selectionState.selectedFolder,
            selectionState.selectedTag,
            selectionState.selectedTopic,
            app,
            getCurrentSortOption,
            updateSettings,
            metadataService,
            settings
        ]
    );

    /**
     * Toggles the display of notes from descendants.
     * When enabling descendants, automatically selects the active file if it's within the current folder/tag/topic hierarchy.
     */
    const handleToggleDescendants = useCallback(async () => {
        const wasShowingDescendants = settings.includeDescendantNotes;

        await updateSettings(s => {
            s.includeDescendantNotes = !s.includeDescendantNotes;
        });

        // Special case: When enabling descendants, auto-select the active file if it's in the folder
        if (!wasShowingDescendants && selectionState.selectedFolder && !selectionState.selectedFile) {
            const activeFile = app.workspace.getActiveFile();
            if (activeFile) {
                // Check if the active file would be visible with descendants enabled
                const filesInFolder = getFilesForFolder(selectionState.selectedFolder, { ...settings, includeDescendantNotes: true }, app);

                if (filesInFolder.some(f => f.path === activeFile.path)) {
                    selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
                }
            }
        }
    }, [updateSettings, settings, selectionState.selectedFolder, selectionState.selectedFile, app, selectionDispatch]);

    const isCustomSort =
        (selectionState.selectionType === ItemType.FOLDER &&
            selectionState.selectedFolder &&
            metadataService.getFolderSortOverride(selectionState.selectedFolder.path)) ||
        (selectionState.selectionType === ItemType.TAG &&
            selectionState.selectedTag &&
            metadataService.getTagSortOverride(selectionState.selectedTag)) ||
        (selectionState.selectionType === ItemType.TOPIC &&
            selectionState.selectedTopic &&
            metadataService.getTagSortOverride(selectionState.selectedTopic));

    // Check if folder, tag, or topic has custom appearance settings
    const hasCustomAppearance =
        (selectionState.selectedFolder &&
            settings.folderAppearances &&
            settings.folderAppearances[selectionState.selectedFolder.path] &&
            Object.keys(settings.folderAppearances[selectionState.selectedFolder.path]).length > 0) ||
        (selectionState.selectedTag &&
            settings.tagAppearances &&
            settings.tagAppearances[selectionState.selectedTag] &&
            Object.keys(settings.tagAppearances[selectionState.selectedTag]).length > 0) ||
        (selectionState.selectedTopic &&
            settings.tagAppearances &&
            settings.tagAppearances[selectionState.selectedTopic] &&
            Object.keys(settings.tagAppearances[selectionState.selectedTopic]).length > 0);

    return {
        handleNewFile,
        handleAppearanceMenu,
        handleSortMenu,
        handleToggleDescendants,
        getCurrentSortOption,
        getSortIcon,
        isCustomSort,
        hasCustomAppearance
    };
}
