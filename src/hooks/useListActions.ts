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

import { useCallback, useMemo } from 'react';
import { Menu } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useUXPreferenceActions, useUXPreferences } from '../context/UXPreferencesContext';
import { strings } from '../i18n';
import type { SortOption } from '../settings';
import { ItemType, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';
import { getEffectiveSortOption, getSortIcon as getSortIconName, isPropertySortOption, SORT_OPTIONS } from '../utils/sortUtils';
import { showListPaneAppearanceMenu } from '../components/ListPaneAppearanceMenu';
import { getDefaultListMode } from './useListPaneAppearance';
import type { FolderAppearance } from './useListPaneAppearance';
import { getFilesForFolder } from '../utils/fileFinder';
import { runAsyncAction } from '../utils/async';
import { FILE_VISIBILITY } from '../utils/fileTypeUtils';
import { findVaultProfileById } from '../utils/vaultProfiles';

type SelectionSortTarget =
    | { type: typeof ItemType.FOLDER; key: string }
    | { type: typeof ItemType.TAG; key: string }
    | { type: typeof ItemType.PROPERTY; key: string };

/**
 * Custom hook that provides shared actions for list pane toolbars.
 * Used by both ListPaneHeader (desktop) and ListToolbar (mobile) to avoid code duplication.
 *
 * @returns Object containing action handlers and computed values for list pane operations
 */
export function useListActions() {
    const { app } = useServices();
    const settings = useSettingsState();
    const vaultProfileId = settings.vaultProfile;
    const vaultProfiles = settings.vaultProfiles;
    const uxPreferences = useUXPreferences();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;
    const showHiddenItems = uxPreferences.showHiddenItems;
    const { setIncludeDescendantNotes } = useUXPreferenceActions();
    const updateSettings = useSettingsUpdate();
    const selectionState = useSelectionState();
    const selectionDispatch = useSelectionDispatch();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();
    const hasFolderSelection = selectionState.selectionType === ItemType.FOLDER && Boolean(selectionState.selectedFolder);
    const hasTagSelection = selectionState.selectionType === ItemType.TAG && Boolean(selectionState.selectedTag);
    const hasCreatableTagSelection =
        hasTagSelection && selectionState.selectedTag !== TAGGED_TAG_ID && selectionState.selectedTag !== UNTAGGED_TAG_ID;
    const hasPropertySelection = selectionState.selectionType === ItemType.PROPERTY && Boolean(selectionState.selectedProperty);
    const hasCreatablePropertySelection = hasPropertySelection && selectionState.selectedProperty !== PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
    const hasAppearanceOrSortSelection = hasFolderSelection || hasTagSelection || hasPropertySelection;
    const canCreateNewFile = Boolean(selectionState.selectedFolder) || hasCreatableTagSelection || hasCreatablePropertySelection;
    const getSelectionSortTarget = useCallback((): SelectionSortTarget | null => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            return { type: ItemType.FOLDER, key: selectionState.selectedFolder.path };
        }
        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return { type: ItemType.TAG, key: selectionState.selectedTag };
        }
        if (selectionState.selectionType === ItemType.PROPERTY && selectionState.selectedProperty) {
            return { type: ItemType.PROPERTY, key: selectionState.selectedProperty };
        }
        return null;
    }, [selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag, selectionState.selectedProperty]);

    const handleNewFile = useCallback(async () => {
        try {
            if (selectionState.selectedFolder) {
                await fileSystemOps.createNewFile(selectionState.selectedFolder, settings.createNewNotesInNewTab);
                return;
            }

            if (hasCreatableTagSelection && selectionState.selectedTag) {
                const sourcePath = selectionState.selectedFile?.path ?? app.workspace.getActiveFile()?.path ?? '';
                await fileSystemOps.createNewFileForTag(selectionState.selectedTag, sourcePath, settings.createNewNotesInNewTab);
                return;
            }

            if (hasCreatablePropertySelection && selectionState.selectedProperty) {
                const sourcePath = selectionState.selectedFile?.path ?? app.workspace.getActiveFile()?.path ?? '';
                await fileSystemOps.createNewFileForProperty(selectionState.selectedProperty, sourcePath, settings.createNewNotesInNewTab);
            }
        } catch {
            // Error is handled by FileSystemOperations with user notification
        }
    }, [
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectedProperty,
        selectionState.selectedFile,
        hasCreatableTagSelection,
        hasCreatablePropertySelection,
        settings.createNewNotesInNewTab,
        fileSystemOps,
        app
    ]);

    const getCurrentSortOption = useCallback((): SortOption => {
        return getEffectiveSortOption(
            settings,
            selectionState.selectionType,
            selectionState.selectedFolder,
            selectionState.selectedTag,
            selectionState.selectedProperty
        );
    }, [
        settings,
        selectionState.selectionType,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectedProperty
    ]);

    const getSortIcon = useCallback(() => {
        return getSortIconName(getCurrentSortOption());
    }, [getCurrentSortOption]);

    const getSelectionSortOverride = useCallback((): SortOption | undefined => {
        const target = getSelectionSortTarget();
        if (!target) {
            return undefined;
        }
        if (target.type === ItemType.FOLDER) {
            return metadataService.getFolderSortOverride(target.key);
        }
        if (target.type === ItemType.TAG) {
            return metadataService.getTagSortOverride(target.key);
        }
        return metadataService.getPropertySortOverride(target.key);
    }, [getSelectionSortTarget, metadataService]);

    const removeSelectionSortOverride = useCallback(async () => {
        const target = getSelectionSortTarget();
        if (!target) {
            return;
        }
        if (target.type === ItemType.FOLDER) {
            await metadataService.removeFolderSortOverride(target.key);
            return;
        }
        if (target.type === ItemType.TAG) {
            await metadataService.removeTagSortOverride(target.key);
            return;
        }
        await metadataService.removePropertySortOverride(target.key);
    }, [getSelectionSortTarget, metadataService]);

    const setSelectionSortOverride = useCallback(
        async (sortOption: SortOption) => {
            const target = getSelectionSortTarget();
            if (!target) {
                return;
            }
            if (target.type === ItemType.FOLDER) {
                await metadataService.setFolderSortOverride(target.key, sortOption);
                return;
            }
            if (target.type === ItemType.TAG) {
                await metadataService.setTagSortOverride(target.key, sortOption);
                return;
            }
            await metadataService.setPropertySortOverride(target.key, sortOption);
        },
        [getSelectionSortTarget, metadataService]
    );

    const handleAppearanceMenu = useCallback(
        (event: React.MouseEvent) => {
            if (!hasAppearanceOrSortSelection) {
                return;
            }

            showListPaneAppearanceMenu({
                event: event.nativeEvent,
                settings,
                selectedFolder: selectionState.selectedFolder,
                selectedTag: selectionState.selectedTag,
                selectedProperty: selectionState.selectedProperty,
                selectionType: selectionState.selectionType,
                updateSettings
            });
        },
        [
            hasAppearanceOrSortSelection,
            settings,
            selectionState.selectedFolder,
            selectionState.selectedTag,
            selectionState.selectedProperty,
            selectionState.selectionType,
            updateSettings
        ]
    );

    const handleSortMenu = useCallback(
        (event: React.MouseEvent) => {
            if (!hasAppearanceOrSortSelection) {
                return;
            }

            const menu = new Menu();
            const currentSort = getCurrentSortOption();
            const propertySortKey = settings.propertySortKey.trim();

            const getSortOptionLabel = (option: SortOption): string => {
                if (isPropertySortOption(option) && propertySortKey.length > 0) {
                    const template =
                        option === 'property-asc'
                            ? strings.settings.items.sortNotesBy.propertyOverride.asc
                            : strings.settings.items.sortNotesBy.propertyOverride.desc;
                    return template.replace('{property}', propertySortKey);
                }
                return strings.settings.items.sortNotesBy.options[option];
            };

            const hasSelectionSortOverride = Boolean(getSelectionSortOverride());

            menu.addItem(item => {
                item.setTitle(`${strings.paneHeader.defaultSort}: ${getSortOptionLabel(settings.defaultFolderSort)}`)
                    .setChecked(!hasSelectionSortOverride)
                    .onClick(() => {
                        // Reset to default sort
                        runAsyncAction(async () => {
                            await removeSelectionSortOverride();
                            app.workspace.requestSaveLayout();
                        });
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
                    item.setTitle(getSortOptionLabel(option))
                        .setChecked(hasSelectionSortOverride && currentSort === option)
                        .onClick(() => {
                            // Apply sort option
                            runAsyncAction(async () => {
                                await setSelectionSortOverride(option);
                                app.workspace.requestSaveLayout();
                            });
                        });
                });
            });

            menu.showAtMouseEvent(event.nativeEvent);
        },
        [
            hasAppearanceOrSortSelection,
            app,
            getCurrentSortOption,
            getSelectionSortOverride,
            removeSelectionSortOverride,
            setSelectionSortOverride,
            settings
        ]
    );

    /**
     * Toggles the display of notes from descendants.
     * When enabling descendants, automatically selects the active file if it's within the current folder/tag hierarchy.
     */
    const handleToggleDescendants = useCallback(() => {
        const wasShowingDescendants = includeDescendantNotes;
        const activeFile = app.workspace.getActiveFile();

        // Toggle descendant notes preference using UX action
        setIncludeDescendantNotes(!wasShowingDescendants);

        // Special case: When enabling descendants, auto-select the active file if it's in the folder
        if (!wasShowingDescendants && selectionState.selectedFolder && !selectionState.selectedFile) {
            if (activeFile) {
                // Check if the active file would be visible with descendants enabled
                const filesInFolder = getFilesForFolder(
                    selectionState.selectedFolder,
                    settings,
                    { includeDescendantNotes: true, showHiddenItems },
                    app
                );

                if (filesInFolder.some(f => f.path === activeFile.path)) {
                    selectionDispatch({ type: 'SET_SELECTED_FILE', file: activeFile });
                }
            }
        }
    }, [
        setIncludeDescendantNotes,
        includeDescendantNotes,
        showHiddenItems,
        selectionState.selectedFolder,
        selectionState.selectedFile,
        app,
        selectionDispatch,
        settings
    ]);

    const isCustomSort = Boolean(getSelectionSortOverride());

    const defaultMode = getDefaultListMode(settings);
    const hasMeaningfulOverrides = (appearance: FolderAppearance | undefined) => {
        if (!appearance) {
            return false;
        }

        const hasModeOverride = (appearance.mode === 'compact' || appearance.mode === 'standard') && appearance.mode !== defaultMode;
        const otherOverrides =
            appearance.titleRows !== undefined ||
            appearance.previewRows !== undefined ||
            appearance.notePropertyType !== undefined ||
            appearance.groupBy !== undefined;

        return hasModeOverride || otherOverrides;
    };

    // Check if folder, tag, or property has custom appearance settings
    const hasCustomAppearance =
        (hasFolderSelection &&
            selectionState.selectedFolder &&
            hasMeaningfulOverrides(settings.folderAppearances?.[selectionState.selectedFolder.path])) ||
        (hasTagSelection && selectionState.selectedTag && hasMeaningfulOverrides(settings.tagAppearances?.[selectionState.selectedTag])) ||
        (hasPropertySelection &&
            selectionState.selectedProperty &&
            hasMeaningfulOverrides(settings.propertyAppearances?.[selectionState.selectedProperty]));

    const activeFileVisibility = useMemo(() => {
        return findVaultProfileById(vaultProfiles, vaultProfileId).fileVisibility;
    }, [vaultProfileId, vaultProfiles]);

    const descendantsTooltip = useMemo(() => {
        const showNotes = activeFileVisibility === FILE_VISIBILITY.DOCUMENTS;

        if (selectionState.selectionType === ItemType.TAG) {
            return showNotes ? strings.paneHeader.showNotesFromDescendants : strings.paneHeader.showFilesFromDescendants;
        }

        if (selectionState.selectionType === ItemType.PROPERTY) {
            return showNotes ? strings.paneHeader.showNotesFromDescendants : strings.paneHeader.showFilesFromDescendants;
        }

        if (selectionState.selectionType === ItemType.FOLDER) {
            return showNotes ? strings.paneHeader.showNotesFromSubfolders : strings.paneHeader.showFilesFromSubfolders;
        }

        return showNotes ? strings.paneHeader.showNotesFromSubfolders : strings.paneHeader.showFilesFromSubfolders;
    }, [activeFileVisibility, selectionState.selectionType]);

    return {
        handleNewFile,
        canCreateNewFile,
        handleAppearanceMenu,
        handleSortMenu,
        handleToggleDescendants,
        getCurrentSortOption,
        getSortIcon,
        hasAppearanceOrSortSelection,
        isCustomSort,
        hasCustomAppearance,
        descendantsTooltip
    };
}
