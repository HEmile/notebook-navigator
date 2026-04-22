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

import { useCallback, useEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { App, debounce, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { Debouncer } from 'obsidian';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { PropertyTreeService } from '../../services/PropertyTreeService';
import { getDBInstance } from '../../storage/fileOperations';
import type { StorageFileData } from './storageFileData';
import type { NotebookNavigatorSettings } from '../../settings';
import type { FileVisibility } from '../../utils/fileTypeUtils';
import {
    buildPropertyKeyNodeId,
    buildPropertyTreeFromDatabase,
    isPropertyFeatureEnabled,
    registerPropertyKeyDirectPaths
} from '../../utils/propertyTree';
import { casefold } from '../../utils/recordUtils';
import type { PropertyTreeNode } from '../../types/storage';
import { clonePropertyKeys, getActivePropertyFields, getActiveVaultProfile } from '../../utils/vaultProfiles';

type SchedulePropertyTreeRebuildOptions = {
    flush?: boolean;
};

function shouldEnablePropertyTree(settings: NotebookNavigatorSettings): boolean {
    return isPropertyFeatureEnabled(settings);
}

function buildConfiguredPropertyDisplayByKey(settings: NotebookNavigatorSettings): Map<string, string> {
    const displayByKey = new Map<string, string>();
    const profile = getActiveVaultProfile(settings);
    const configuredKeys = clonePropertyKeys(profile.propertyKeys);
    configuredKeys.forEach(entry => {
        const displayName = entry.key.trim();
        const normalizedKey = casefold(displayName);
        if (!displayName || !normalizedKey || displayByKey.has(normalizedKey)) {
            return;
        }

        displayByKey.set(normalizedKey, displayName);
    });
    return displayByKey;
}

function includeConfiguredPropertyKeys(tree: Map<string, PropertyTreeNode>, displayByKey: Map<string, string>): void {
    for (const [normalizedKey, displayName] of displayByKey.entries()) {
        if (tree.has(normalizedKey)) {
            continue;
        }

        const keyNode: PropertyTreeNode = {
            id: buildPropertyKeyNodeId(normalizedKey),
            kind: 'key',
            key: normalizedKey,
            valuePath: null,
            name: displayName,
            displayPath: displayName,
            children: new Map(),
            notesWithValue: new Set()
        };
        tree.set(normalizedKey, keyNode);
        registerPropertyKeyDirectPaths(keyNode);
    }
}

export function usePropertyTreeSync(params: {
    app: App;
    settings: NotebookNavigatorSettings;
    showHiddenItems: boolean;
    hiddenFolders: string[];
    hiddenFileProperties: string[];
    hiddenFileNames: string[];
    hiddenFileTags: string[];
    fileVisibility: FileVisibility;
    profileId: string;
    isStorageReady: boolean;
    isStorageReadyRef: RefObject<boolean>;
    latestSettingsRef: RefObject<NotebookNavigatorSettings>;
    stoppedRef: RefObject<boolean>;
    setFileData: Dispatch<SetStateAction<StorageFileData>>;
    getVisibleMarkdownFiles: () => TFile[];
    propertyTreeService: PropertyTreeService | null;
}): {
    rebuildPropertyTree: () => Map<string, PropertyTreeNode>;
    schedulePropertyTreeRebuild: (options?: SchedulePropertyTreeRebuildOptions) => void;
    cancelPropertyTreeRebuildDebouncer: (options?: { reset?: boolean }) => void;
} {
    const {
        app,
        settings,
        showHiddenItems,
        hiddenFolders,
        hiddenFileProperties,
        hiddenFileNames,
        hiddenFileTags,
        fileVisibility,
        profileId,
        isStorageReady,
        isStorageReadyRef,
        latestSettingsRef,
        stoppedRef,
        setFileData,
        getVisibleMarkdownFiles,
        propertyTreeService
    } = params;

    const hiddenFoldersRef = useRef(hiddenFolders);
    const rebuildPropertyTreeFnRef = useRef<(() => Map<string, PropertyTreeNode>) | null>(null);
    const propertyTreeRebuildDebouncerRef = useRef<Debouncer<[], void> | null>(null);
    const isPropertyTreeEnabled = useMemo(() => shouldEnablePropertyTree(settings), [settings]);
    const propertyTreeRebuildReadyGateRef = useRef(false);
    const activePropertyFields = getActivePropertyFields(settings);
    const previousPropertyFieldsRef = useRef(activePropertyFields);
    const previousShowPropertiesRef = useRef(settings.showProperties);

    useEffect(() => {
        hiddenFoldersRef.current = hiddenFolders;
    }, [hiddenFolders]);

    const clearPropertyTree = useCallback(() => {
        const emptyTree = new Map<string, PropertyTreeNode>();
        setFileData(previous => ({ ...previous, propertyTree: emptyTree }));
        propertyTreeService?.updatePropertyTree(emptyTree);
        return emptyTree;
    }, [propertyTreeService, setFileData]);

    const rebuildPropertyTree = useCallback(() => {
        const liveSettings = latestSettingsRef.current;
        const configuredDisplayByKey = buildConfiguredPropertyDisplayByKey(liveSettings);
        const includedPropertyKeys = new Set(configuredDisplayByKey.keys());
        const shouldBuildTree = liveSettings.showProperties && configuredDisplayByKey.size > 0;
        if (!shouldBuildTree) {
            return clearPropertyTree();
        }

        const db = getDBInstance();
        const excludedFolderPatterns = showHiddenItems ? [] : hiddenFoldersRef.current;
        const visibleMarkdownPaths = getVisibleMarkdownFiles().map(file => file.path);
        const propertyTree = buildPropertyTreeFromDatabase(
            {
                forEachFile: callback => {
                    visibleMarkdownPaths.forEach(path => {
                        const fileData = db.getFile(path);
                        if (!fileData) {
                            return;
                        }
                        callback(path, fileData);
                    });
                }
            },
            {
                excludedFolderPatterns,
                includedPropertyKeys
            }
        );
        includeConfiguredPropertyKeys(propertyTree, configuredDisplayByKey);

        setFileData(previous => ({ ...previous, propertyTree }));
        propertyTreeService?.updatePropertyTree(propertyTree);
        return propertyTree;
    }, [clearPropertyTree, getVisibleMarkdownFiles, latestSettingsRef, propertyTreeService, setFileData, showHiddenItems]);

    rebuildPropertyTreeFnRef.current = rebuildPropertyTree;

    const cancelPropertyTreeRebuildDebouncer = useCallback((options?: { reset?: boolean }) => {
        const debouncer = propertyTreeRebuildDebouncerRef.current;
        if (!debouncer) {
            return;
        }
        try {
            debouncer.cancel();
        } catch {
            // ignore
        }

        if (options?.reset) {
            propertyTreeRebuildDebouncerRef.current = null;
        }
    }, []);

    const schedulePropertyTreeRebuild = useCallback(
        (options?: SchedulePropertyTreeRebuildOptions) => {
            const liveSettings = latestSettingsRef.current;
            if (stoppedRef.current || !isStorageReadyRef.current) {
                return;
            }

            if (!shouldEnablePropertyTree(liveSettings)) {
                clearPropertyTree();
                return;
            }

            if (!propertyTreeRebuildDebouncerRef.current) {
                propertyTreeRebuildDebouncerRef.current = debounce(
                    () => {
                        if (stoppedRef.current || !isStorageReadyRef.current) {
                            return;
                        }

                        if (!shouldEnablePropertyTree(latestSettingsRef.current)) {
                            clearPropertyTree();
                            return;
                        }

                        rebuildPropertyTreeFnRef.current?.();
                    },
                    TIMEOUTS.DEBOUNCE_TAG_TREE,
                    true
                );
            }

            propertyTreeRebuildDebouncerRef.current();

            if (options?.flush) {
                try {
                    propertyTreeRebuildDebouncerRef.current.run();
                } catch {
                    // ignore
                }
            }
        },
        [clearPropertyTree, isStorageReadyRef, latestSettingsRef, stoppedRef]
    );

    useEffect(() => {
        const previousPropertyFields = previousPropertyFieldsRef.current;
        const previousShowProperties = previousShowPropertiesRef.current;
        const propertyFieldsChanged = previousPropertyFields !== activePropertyFields;
        const showPropertiesChanged = previousShowProperties !== settings.showProperties;
        const commitCurrentSettingsSnapshot = () => {
            previousPropertyFieldsRef.current = activePropertyFields;
            previousShowPropertiesRef.current = settings.showProperties;
        };

        if (!isStorageReady) {
            // Resets the ready gate so the next ready transition is ignored.
            propertyTreeRebuildReadyGateRef.current = false;
            commitCurrentSettingsSnapshot();
            return;
        }

        if (!propertyTreeRebuildReadyGateRef.current) {
            // Initial cache build creates the property tree before storage is marked ready.
            propertyTreeRebuildReadyGateRef.current = true;
            commitCurrentSettingsSnapshot();
            return;
        }

        if (!isPropertyTreeEnabled) {
            clearPropertyTree();
            commitCurrentSettingsSnapshot();
            return;
        }

        const visibleMarkdownFileCount = getVisibleMarkdownFiles().length;
        // Property-field changes are followed by markdown metadata regeneration.
        // Skip the immediate rebuild here and let the incoming metadata batch trigger it.
        const shouldDeferPropertyFieldRebuild =
            propertyFieldsChanged && !showPropertiesChanged && settings.showProperties && visibleMarkdownFileCount > 0;
        if (shouldDeferPropertyFieldRebuild) {
            commitCurrentSettingsSnapshot();
            return;
        }

        schedulePropertyTreeRebuild();
        commitCurrentSettingsSnapshot();
    }, [
        showHiddenItems,
        isStorageReady,
        isPropertyTreeEnabled,
        schedulePropertyTreeRebuild,
        clearPropertyTree,
        getVisibleMarkdownFiles,
        hiddenFolders,
        hiddenFileProperties,
        hiddenFileNames,
        hiddenFileTags,
        fileVisibility,
        profileId,
        activePropertyFields,
        settings.showProperties
    ]);

    useEffect(() => {
        if (!isStorageReady || !isPropertyTreeEnabled) {
            return;
        }

        const shouldRebuildOnTagVisibilityChanges = !showHiddenItems && hiddenFileTags.length > 0;
        const shouldRebuildOnFrontmatterVisibilityChanges = !showHiddenItems && hiddenFileProperties.length > 0;
        const db = getDBInstance();
        const unsubscribe = db.onContentChange(changes => {
            if (stoppedRef.current) {
                return;
            }

            let hasRelevantChanges = false;
            let shouldFlush = false;
            let activeFilePath: string | null = null;
            let activeFileResolved = false;
            for (const change of changes) {
                const hasPropertyChange = change.changes.properties !== undefined;
                const hasTagVisibilityChange = shouldRebuildOnTagVisibilityChanges && change.changes.tags !== undefined;
                const hasFrontmatterVisibilityChange = shouldRebuildOnFrontmatterVisibilityChanges && change.changes.metadata !== undefined;
                if (!hasPropertyChange && !hasTagVisibilityChange && !hasFrontmatterVisibilityChange) {
                    continue;
                }

                hasRelevantChanges = true;

                if (!activeFileResolved) {
                    activeFilePath = app.workspace.getActiveFile()?.path ?? null;
                    activeFileResolved = true;
                }

                if (activeFilePath && change.path === activeFilePath) {
                    shouldFlush = true;
                    break;
                }
            }

            if (hasRelevantChanges) {
                // Flush only when the active file is the sole file in the batch.
                const shouldFlushNow = shouldFlush && changes.every(change => change.path === activeFilePath);
                schedulePropertyTreeRebuild({ flush: shouldFlushNow });
            }
        });

        return unsubscribe;
    }, [
        app.workspace,
        hiddenFileProperties,
        hiddenFileTags,
        isStorageReady,
        isPropertyTreeEnabled,
        schedulePropertyTreeRebuild,
        showHiddenItems,
        stoppedRef
    ]);

    useEffect(() => {
        if (!isStorageReady || !isPropertyTreeEnabled) {
            return;
        }

        // Rebuild property tree when vault delete/rename events change markdown or folder paths.
        const shouldTriggerRebuild = (file: TAbstractFile): boolean => {
            if (file instanceof TFile) {
                return file.extension === 'md';
            }
            return file instanceof TFolder;
        };

        const handleDelete = (file: TAbstractFile) => {
            if (stoppedRef.current) {
                return;
            }
            if (!shouldTriggerRebuild(file)) {
                return;
            }
            schedulePropertyTreeRebuild();
        };

        const handleRename = (file: TAbstractFile) => {
            if (stoppedRef.current) {
                return;
            }
            if (!shouldTriggerRebuild(file)) {
                return;
            }
            schedulePropertyTreeRebuild();
        };

        const deleteRef = app.vault.on('delete', handleDelete);
        const renameRef = app.vault.on('rename', handleRename);

        return () => {
            app.vault.offref(deleteRef);
            app.vault.offref(renameRef);
        };
    }, [app.vault, isStorageReady, isPropertyTreeEnabled, schedulePropertyTreeRebuild, stoppedRef]);

    return { rebuildPropertyTree, schedulePropertyTreeRebuild, cancelPropertyTreeRebuildDebouncer };
}
