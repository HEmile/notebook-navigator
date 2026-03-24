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
import { Menu, TFolder } from 'obsidian';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService } from '../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../context/SettingsContext';
import { useUXPreferenceActions, useUXPreferences } from '../context/UXPreferencesContext';
import { strings } from '../i18n';
import { ConfirmModal } from '../modals/ConfirmModal';
import type { SortOption } from '../settings';
import { ItemType, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';
import { getEffectiveSortOption, getSortIcon as getSortIconName, isPropertySortOption, SORT_OPTIONS } from '../utils/sortUtils';
import { showListPaneAppearanceMenu } from '../components/ListPaneAppearanceMenu';
import { getDefaultListMode } from './useListPaneAppearance';
import type { FolderAppearance } from './useListPaneAppearance';
import { getFilesForFolder } from '../utils/fileFinder';
import { runAsyncAction } from '../utils/async';
import { FILE_VISIBILITY } from '../utils/fileTypeUtils';
import { parsePropertyNodeId } from '../utils/propertyTree';
import { findVaultProfileById } from '../utils/vaultProfiles';
import { ensureRecord, sanitizeRecord } from '../utils/recordUtils';

type SelectionSortTarget =
    | { type: typeof ItemType.FOLDER; key: string }
    | { type: typeof ItemType.TAG; key: string }
    | { type: typeof ItemType.PROPERTY; key: string };

function collectFolderDescendantPaths(folder: TFolder): string[] {
    const paths: string[] = [];
    const stack: TFolder[] = [];

    folder.children.forEach(child => {
        if (child instanceof TFolder) {
            stack.push(child);
        }
    });

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }

        paths.push(current.path);
        current.children.forEach(child => {
            if (child instanceof TFolder) {
                stack.push(child);
            }
        });
    }

    return paths;
}

function isFolderDescendantSettingKey(selectedFolderPath: string, candidatePath: string): boolean {
    if (candidatePath === selectedFolderPath) {
        return false;
    }

    // Root uses "/" while child folder paths never start with "//", so every non-root key is a descendant.
    if (selectedFolderPath === '/') {
        return candidatePath !== '/';
    }

    return candidatePath.startsWith(`${selectedFolderPath}/`);
}

function isTagDescendantSettingKey(selectedTagPath: string, candidatePath: string): boolean {
    if (candidatePath === selectedTagPath) {
        return false;
    }

    if (selectedTagPath === UNTAGGED_TAG_ID) {
        return false;
    }

    // The "all tagged" virtual node does not live inside the tag hierarchy.
    // For settings-only scans, treat every real stored tag key as part of its descendant scope.
    if (selectedTagPath === TAGGED_TAG_ID) {
        return candidatePath !== TAGGED_TAG_ID && candidatePath !== UNTAGGED_TAG_ID;
    }

    return candidatePath.startsWith(`${selectedTagPath}/`);
}

function isPropertyDescendantSettingKey(selectedNodeId: string, candidateNodeId: string): boolean {
    if (candidateNodeId === selectedNodeId) {
        return false;
    }

    if (selectedNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
        return candidateNodeId !== PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
    }

    const selectedNode = parsePropertyNodeId(selectedNodeId);
    const candidateNode = parsePropertyNodeId(candidateNodeId);
    if (!selectedNode || !candidateNode || selectedNode.key !== candidateNode.key) {
        return false;
    }

    if (!selectedNode.valuePath) {
        return candidateNode.valuePath !== null;
    }

    if (!candidateNode.valuePath) {
        return false;
    }

    return candidateNode.valuePath.startsWith(`${selectedNode.valuePath}/`);
}

function countRecordEntries<T>(record: Record<string, T> | undefined, predicate: (key: string, value: T) => boolean): number {
    if (!record) {
        return 0;
    }

    let count = 0;
    Object.entries(record).forEach(([key, value]) => {
        if (predicate(key, value)) {
            count += 1;
        }
    });
    return count;
}

function hasStoredAppearanceOverride(appearance: FolderAppearance | undefined): appearance is FolderAppearance {
    return Boolean(appearance && Object.keys(appearance).length > 0);
}

function normalizeAppearanceOverride(
    appearance: FolderAppearance | undefined,
    defaultMode: ReturnType<typeof getDefaultListMode>
): FolderAppearance | null {
    if (!appearance) {
        return null;
    }

    const normalized: FolderAppearance = {};

    if (appearance.mode !== undefined && appearance.mode !== defaultMode) {
        normalized.mode = appearance.mode;
    }

    if (appearance.titleRows !== undefined) {
        normalized.titleRows = appearance.titleRows;
    }

    if (appearance.previewRows !== undefined) {
        normalized.previewRows = appearance.previewRows;
    }

    if (appearance.notePropertyType !== undefined) {
        normalized.notePropertyType = appearance.notePropertyType;
    }

    if (appearance.groupBy !== undefined) {
        normalized.groupBy = appearance.groupBy;
    }

    return Object.keys(normalized).length > 0 ? normalized : null;
}

function areAppearanceOverridesEqual(
    left: FolderAppearance | undefined,
    right: FolderAppearance | undefined,
    defaultMode: ReturnType<typeof getDefaultListMode>
): boolean {
    const normalizedLeft = normalizeAppearanceOverride(left, defaultMode);
    const normalizedRight = normalizeAppearanceOverride(right, defaultMode);

    if (!normalizedLeft || !normalizedRight) {
        return normalizedLeft === normalizedRight;
    }

    return (
        normalizedLeft.mode === normalizedRight.mode &&
        normalizedLeft.titleRows === normalizedRight.titleRows &&
        normalizedLeft.previewRows === normalizedRight.previewRows &&
        normalizedLeft.notePropertyType === normalizedRight.notePropertyType &&
        normalizedLeft.groupBy === normalizedRight.groupBy
    );
}

function collectAllPropertyNodeIds(propertyTreeService: NonNullable<ReturnType<typeof useServices>['propertyTreeService']>): string[] {
    const nodeIds: string[] = [];
    const visited = new Set<string>();

    const collectIds = (nodeId: string) => {
        if (visited.has(nodeId)) {
            return;
        }
        visited.add(nodeId);
        nodeIds.push(nodeId);

        const node = propertyTreeService.findNode(nodeId);
        if (!node) {
            return;
        }

        node.children.forEach(child => {
            collectIds(child.id);
        });
    };

    propertyTreeService.getPropertyTree().forEach(node => {
        collectIds(node.id);
    });

    return nodeIds;
}

/**
 * Custom hook that provides shared actions for list pane toolbars.
 * Used by both ListPaneHeader (desktop) and ListToolbar (mobile) to avoid code duplication.
 *
 * @returns Object containing action handlers and computed values for list pane operations
 */
export function useListActions() {
    const { app, tagTreeService, propertyTreeService } = useServices();
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

    const getSelectionAppearanceOverride = useCallback((): FolderAppearance | undefined => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            return settings.folderAppearances?.[selectionState.selectedFolder.path];
        }
        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return settings.tagAppearances?.[selectionState.selectedTag];
        }
        if (selectionState.selectionType === ItemType.PROPERTY && selectionState.selectedProperty) {
            return settings.propertyAppearances?.[selectionState.selectedProperty];
        }
        return undefined;
    }, [
        selectionState.selectionType,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectedProperty,
        settings.folderAppearances,
        settings.tagAppearances,
        settings.propertyAppearances
    ]);

    const getSelectionDescendantKeys = useCallback((): string[] => {
        // Bulk apply should use the live tree when the user confirms the action so
        // descendants without stored settings still receive the propagated override.
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            return collectFolderDescendantPaths(selectionState.selectedFolder);
        }

        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            if (selectionState.selectedTag === TAGGED_TAG_ID) {
                return Array.from(tagTreeService?.getAllTagPaths() ?? []);
            }
            return Array.from(tagTreeService?.collectDescendantTagPaths(selectionState.selectedTag) ?? []);
        }

        if (selectionState.selectionType === ItemType.PROPERTY && selectionState.selectedProperty && propertyTreeService) {
            if (selectionState.selectedProperty === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
                return collectAllPropertyNodeIds(propertyTreeService);
            }
            return Array.from(propertyTreeService.collectDescendantNodeIds(selectionState.selectedProperty));
        }

        return [];
    }, [
        propertyTreeService,
        selectionState.selectionType,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectedProperty,
        tagTreeService
    ]);

    const isSelectionDescendantSettingKey = useCallback(
        (candidateKey: string): boolean => {
            if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
                return isFolderDescendantSettingKey(selectionState.selectedFolder.path, candidateKey);
            }

            if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
                return isTagDescendantSettingKey(selectionState.selectedTag, candidateKey);
            }

            if (selectionState.selectionType === ItemType.PROPERTY && selectionState.selectedProperty) {
                return isPropertyDescendantSettingKey(selectionState.selectedProperty, candidateKey);
            }

            return false;
        },
        [selectionState.selectionType, selectionState.selectedFolder, selectionState.selectedTag, selectionState.selectedProperty]
    );

    const getSelectionDescendantLabel = useCallback((): string => {
        if (selectionState.selectionType === ItemType.FOLDER) {
            return strings.paneHeader.subfolders;
        }
        if (selectionState.selectionType === ItemType.TAG) {
            return strings.paneHeader.subtags;
        }
        if (selectionState.selectionType === ItemType.PROPERTY) {
            if (selectionState.selectedProperty === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
                return strings.paneHeader.descendants;
            }
            return strings.paneHeader.childValues;
        }
        return strings.paneHeader.descendants;
    }, [selectionState.selectedProperty, selectionState.selectionType]);

    const defaultMode = getDefaultListMode(settings);
    const selectionSortTarget = useMemo(() => getSelectionSortTarget(), [getSelectionSortTarget]);
    const selectionSortOverride = useMemo(() => getSelectionSortOverride(), [getSelectionSortOverride]);
    const selectionAppearanceOverride = useMemo(() => getSelectionAppearanceOverride(), [getSelectionAppearanceOverride]);
    const hasSelectionAppearanceOverride = hasStoredAppearanceOverride(selectionAppearanceOverride);
    const selectionDescendantLabel = useMemo(() => getSelectionDescendantLabel(), [getSelectionDescendantLabel]);
    // Keep the action available for selections that conceptually own descendants.
    // The stored-settings count is computed lazily when the user opens the confirmation flow.
    const canApplyToDescendants =
        hasFolderSelection || (hasTagSelection && selectionState.selectedTag !== UNTAGGED_TAG_ID) || hasPropertySelection;

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

    const getDescendantSortChangeCount = useCallback((): number => {
        const target = selectionSortTarget;
        if (!target) {
            return 0;
        }

        const sortOverrides =
            target.type === ItemType.FOLDER
                ? settings.folderSortOverrides
                : target.type === ItemType.TAG
                  ? settings.tagSortOverrides
                  : settings.propertySortOverrides;

        // Menu state and modal counts only scan stored settings so opening the menus
        // does not traverse the live folder, tag, or property trees.
        return countRecordEntries(sortOverrides, (key, currentOverride) => {
            if (!isSelectionDescendantSettingKey(key)) {
                return false;
            }

            if (selectionSortOverride !== undefined) {
                return currentOverride !== selectionSortOverride;
            }

            return true;
        });
    }, [
        isSelectionDescendantSettingKey,
        selectionSortOverride,
        selectionSortTarget,
        settings.folderSortOverrides,
        settings.propertySortOverrides,
        settings.tagSortOverrides
    ]);

    const promptApplySortToDescendants = useCallback(() => {
        const target = selectionSortTarget;
        if (!target) {
            return;
        }

        const affectedCount = getDescendantSortChangeCount();
        const title = strings.modals.bulkApply.applySortTitle(selectionDescendantLabel);
        const message = strings.modals.bulkApply.affectedCountMessage(affectedCount);

        new ConfirmModal(
            app,
            title,
            message,
            async () => {
                // The confirm step switches to live tree traversal so descendants without
                // stored overrides still receive the propagated sort setting.
                const selectionDescendantKeys = getSelectionDescendantKeys();
                if (selectionDescendantKeys.length === 0) {
                    return;
                }

                await updateSettings(current => {
                    if (target.type === ItemType.FOLDER) {
                        const next = sanitizeRecord(ensureRecord(current.folderSortOverrides));
                        selectionDescendantKeys.forEach(key => {
                            if (selectionSortOverride !== undefined) {
                                next[key] = selectionSortOverride;
                                return;
                            }
                            delete next[key];
                        });
                        current.folderSortOverrides = next;
                        return;
                    }

                    if (target.type === ItemType.TAG) {
                        const next = sanitizeRecord(ensureRecord(current.tagSortOverrides));
                        selectionDescendantKeys.forEach(key => {
                            if (selectionSortOverride !== undefined) {
                                next[key] = selectionSortOverride;
                                return;
                            }
                            delete next[key];
                        });
                        current.tagSortOverrides = next;
                        return;
                    }

                    const next = sanitizeRecord(ensureRecord(current.propertySortOverrides));
                    selectionDescendantKeys.forEach(key => {
                        if (selectionSortOverride !== undefined) {
                            next[key] = selectionSortOverride;
                            return;
                        }
                        delete next[key];
                    });
                    current.propertySortOverrides = next;
                });
                app.workspace.requestSaveLayout();
            },
            strings.modals.bulkApply.applyButton,
            { confirmButtonClass: 'mod-cta' }
        ).open();
    }, [
        app,
        getDescendantSortChangeCount,
        getSelectionDescendantKeys,
        selectionDescendantLabel,
        selectionSortOverride,
        selectionSortTarget,
        updateSettings
    ]);

    const getDescendantAppearanceChangeCount = useCallback((): number => {
        const target = selectionSortTarget;
        if (!target) {
            return 0;
        }

        const appearances =
            target.type === ItemType.FOLDER
                ? settings.folderAppearances
                : target.type === ItemType.TAG
                  ? settings.tagAppearances
                  : settings.propertyAppearances;

        // The modal count intentionally reflects only stored appearance settings that would change.
        return countRecordEntries(appearances, (key, descendantAppearance) => {
            if (!isSelectionDescendantSettingKey(key)) {
                return false;
            }

            if (hasSelectionAppearanceOverride && selectionAppearanceOverride) {
                return !areAppearanceOverridesEqual(descendantAppearance, selectionAppearanceOverride, defaultMode);
            }

            return hasStoredAppearanceOverride(descendantAppearance);
        });
    }, [
        defaultMode,
        hasSelectionAppearanceOverride,
        isSelectionDescendantSettingKey,
        selectionAppearanceOverride,
        selectionSortTarget,
        settings.folderAppearances,
        settings.propertyAppearances,
        settings.tagAppearances
    ]);

    const promptApplyAppearanceToDescendants = useCallback(() => {
        const target = selectionSortTarget;
        if (!target) {
            return;
        }

        const affectedCount = getDescendantAppearanceChangeCount();
        const title = strings.modals.bulkApply.applyAppearanceTitle(selectionDescendantLabel);
        const message = strings.modals.bulkApply.affectedCountMessage(affectedCount);

        new ConfirmModal(
            app,
            title,
            message,
            async () => {
                // The modal count comes from stored settings only, but the confirmed apply
                // still targets the live descendant tree so new descendant overrides can be created.
                const selectionDescendantKeys = getSelectionDescendantKeys();
                if (selectionDescendantKeys.length === 0) {
                    return;
                }

                await updateSettings(current => {
                    if (target.type === ItemType.FOLDER) {
                        const next = sanitizeRecord(ensureRecord(current.folderAppearances));
                        selectionDescendantKeys.forEach(key => {
                            if (hasSelectionAppearanceOverride && selectionAppearanceOverride) {
                                next[key] = { ...selectionAppearanceOverride };
                                return;
                            }
                            delete next[key];
                        });
                        current.folderAppearances = next;
                        return;
                    }

                    if (target.type === ItemType.TAG) {
                        const next = sanitizeRecord(ensureRecord(current.tagAppearances));
                        selectionDescendantKeys.forEach(key => {
                            if (hasSelectionAppearanceOverride && selectionAppearanceOverride) {
                                next[key] = { ...selectionAppearanceOverride };
                                return;
                            }
                            delete next[key];
                        });
                        current.tagAppearances = next;
                        return;
                    }

                    const next = sanitizeRecord(ensureRecord(current.propertyAppearances));
                    selectionDescendantKeys.forEach(key => {
                        if (hasSelectionAppearanceOverride && selectionAppearanceOverride) {
                            next[key] = { ...selectionAppearanceOverride };
                            return;
                        }
                        delete next[key];
                    });
                    current.propertyAppearances = next;
                });
                app.workspace.requestSaveLayout();
            },
            strings.modals.bulkApply.applyButton,
            { confirmButtonClass: 'mod-cta' }
        ).open();
    }, [
        app,
        getDescendantAppearanceChangeCount,
        getSelectionDescendantKeys,
        hasSelectionAppearanceOverride,
        selectionAppearanceOverride,
        selectionDescendantLabel,
        selectionSortTarget,
        updateSettings
    ]);

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
                updateSettings,
                descendantAction: canApplyToDescendants
                    ? {
                          menuTitle: strings.paneHeader.applyAppearanceToDescendants(selectionDescendantLabel),
                          onApply: promptApplyAppearanceToDescendants
                      }
                    : undefined
            });
        },
        [
            canApplyToDescendants,
            hasAppearanceOrSortSelection,
            promptApplyAppearanceToDescendants,
            selectionDescendantLabel,
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

            if (canApplyToDescendants) {
                menu.addSeparator();
                menu.addItem(item => {
                    item.setTitle(strings.paneHeader.applySortToDescendants(selectionDescendantLabel)).onClick(() => {
                        promptApplySortToDescendants();
                    });
                });
            }

            menu.showAtMouseEvent(event.nativeEvent);
        },
        [
            canApplyToDescendants,
            hasAppearanceOrSortSelection,
            app,
            getCurrentSortOption,
            getSelectionSortOverride,
            promptApplySortToDescendants,
            removeSelectionSortOverride,
            selectionDescendantLabel,
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
