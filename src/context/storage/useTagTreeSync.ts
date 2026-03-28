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

import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { App, debounce, TFile } from 'obsidian';
import type { Debouncer } from 'obsidian';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { TagTreeService } from '../../services/TagTreeService';
import { getDBInstance } from '../../storage/fileOperations';
import type { StorageFileData } from './storageFileData';
import type { TagTreeNode } from '../../types/storage';
import { buildTagTreeFromDatabase } from '../../utils/tagTree';
import type { NotebookNavigatorSettings } from '../../settings';
import type { FileVisibility } from '../../utils/fileTypeUtils';

/**
 * Builds and maintains the in-memory tag tree derived from the database.
 *
 * The tag tree is constructed from IndexedDB cache records (not direct vault reads) so that:
 * - Counts and tag assignments are consistent with what the storage layer has indexed.
 * - Updates can be driven by database change events from content providers.
 *
 * Rebuilds are debounced because tag-related content updates can arrive in bursts (for example when a large batch
 * of files is processed). The active file path is treated specially: if the active file changes tags, the rebuild
 * is flushed so the UI reflects the change immediately.
 */
type ScheduleTagTreeRebuildOptions = {
    // Executes a pending rebuild immediately.
    flush?: boolean;
};

export function useTagTreeSync(params: {
    app: App;
    settings: NotebookNavigatorSettings;
    showHiddenItems: boolean;
    hiddenFolders: string[];
    hiddenTags: string[];
    hiddenFileProperties: string[];
    fileVisibility: FileVisibility;
    profileId: string;
    isStorageReady: boolean;
    isStorageReadyRef: RefObject<boolean>;
    latestSettingsRef: RefObject<NotebookNavigatorSettings>;
    stoppedRef: RefObject<boolean>;
    setFileData: Dispatch<SetStateAction<StorageFileData>>;
    getVisibleMarkdownFiles: () => TFile[];
    tagTreeService: TagTreeService | null;
}): {
    rebuildTagTree: () => Map<string, TagTreeNode>;
    scheduleTagTreeRebuild: (options?: ScheduleTagTreeRebuildOptions) => void;
    cancelTagTreeRebuildDebouncer: (options?: { reset?: boolean }) => void;
} {
    const {
        app,
        settings,
        showHiddenItems,
        hiddenFolders,
        hiddenTags,
        hiddenFileProperties,
        fileVisibility,
        profileId,
        isStorageReady,
        isStorageReadyRef,
        latestSettingsRef,
        stoppedRef,
        setFileData,
        getVisibleMarkdownFiles,
        tagTreeService
    } = params;

    const hiddenFoldersRef = useRef(hiddenFolders);
    const hiddenTagsRef = useRef(hiddenTags);

    useEffect(() => {
        hiddenFoldersRef.current = hiddenFolders;
    }, [hiddenFolders]);

    useEffect(() => {
        hiddenTagsRef.current = hiddenTags;
    }, [hiddenTags]);

    // Holds the latest rebuildTagTree implementation for debounced callbacks.
    const rebuildTagTreeFnRef = useRef<(() => Map<string, TagTreeNode>) | null>(null);

    // Debounces full tag tree rebuilds during bursts of tag updates.
    const tagTreeRebuildDebouncerRef = useRef<Debouncer<[], void> | null>(null);

    // Skips tag tree rebuild effects immediately after storage becomes ready.
    const tagTreeRebuildReadyGateRef = useRef(false);

    // Rebuilds the complete tag tree structure from database contents
    const rebuildTagTree = useCallback(() => {
        const db = getDBInstance();
        // Folder exclusions are handled at the tag-tree level (note counts, untagged counts). When hidden items are
        // shown, we treat excluded folders as visible for counting and tree construction.
        const excludedFolderPatterns = showHiddenItems ? [] : hiddenFoldersRef.current;
        // The database may contain files that are currently hidden by profile settings. The UI tag tree only counts
        // files that would be visible in the current navigation scope.
        const includedPaths = new Set(getVisibleMarkdownFiles().map(f => f.path));
        const { tagTree, tagged, untagged, hiddenRootTags } = buildTagTreeFromDatabase(
            db,
            excludedFolderPatterns,
            includedPaths,
            hiddenTagsRef.current,
            showHiddenItems
        );

        setFileData(previous => ({ ...previous, tagTree, tagged, untagged, hiddenRootTags }));

        // Propagate updated tag trees to the global TagTreeService for cross-component access
        if (tagTreeService) {
            tagTreeService.updateTagTree(tagTree, tagged, untagged);
        }

        return tagTree;
    }, [getVisibleMarkdownFiles, setFileData, showHiddenItems, tagTreeService]);

    // Exposes the latest rebuildTagTree implementation to the debounced scheduler.
    rebuildTagTreeFnRef.current = rebuildTagTree;

    // Cancels any pending scheduled tag tree rebuild.
    const cancelTagTreeRebuildDebouncer = useCallback((options?: { reset?: boolean }) => {
        const debouncer = tagTreeRebuildDebouncerRef.current;
        if (!debouncer) {
            return;
        }

        try {
            debouncer.cancel();
        } catch {
            // ignore
        }

        if (options?.reset) {
            tagTreeRebuildDebouncerRef.current = null;
        }
    }, []);

    // Requests a tag tree rebuild through a shared debouncer.
    const scheduleTagTreeRebuild = useCallback(
        (options?: ScheduleTagTreeRebuildOptions) => {
            if (stoppedRef.current || !isStorageReadyRef.current) {
                return;
            }

            if (!latestSettingsRef.current.showTags) {
                return;
            }

            if (!tagTreeRebuildDebouncerRef.current) {
                tagTreeRebuildDebouncerRef.current = debounce(
                    () => {
                        if (stoppedRef.current || !isStorageReadyRef.current) {
                            return;
                        }

                        if (!latestSettingsRef.current.showTags) {
                            return;
                        }

                        rebuildTagTreeFnRef.current?.();
                    },
                    TIMEOUTS.DEBOUNCE_TAG_TREE,
                    true
                );
            }

            tagTreeRebuildDebouncerRef.current();

            if (options?.flush) {
                try {
                    // Used when a rebuild should happen on the current tick (for example, the active file changed tags).
                    tagTreeRebuildDebouncerRef.current.run();
                } catch {
                    // ignore
                }
            }
        },
        [isStorageReadyRef, latestSettingsRef, stoppedRef]
    );

    /**
     * Effect: Rebuild tag tree when hidden items visibility changes
     */
    useEffect(() => {
        if (!isStorageReady) {
            // Resets the ready gate so the next ready transition is ignored.
            tagTreeRebuildReadyGateRef.current = false;
            return;
        }

        if (!tagTreeRebuildReadyGateRef.current) {
            // Initial cache build creates the tag tree before storage is marked ready.
            tagTreeRebuildReadyGateRef.current = true;
            return;
        }

        if (settings.showTags) {
            scheduleTagTreeRebuild();
        }
    }, [
        showHiddenItems,
        settings.showTags,
        isStorageReady,
        scheduleTagTreeRebuild,
        hiddenFolders,
        hiddenFileProperties,
        hiddenTags,
        fileVisibility,
        profileId
    ]);

    /**
     * Effect: Listen for tag changes in the database to rebuild tag tree
     */
    useEffect(() => {
        if (!isStorageReady || !settings.showTags) {
            return;
        }

        const db = getDBInstance();
        const unsubscribe = db.onContentChange(changes => {
            if (stoppedRef.current) return;
            let hasTagChanges = false;
            let shouldFlush = false;
            let activeFilePath: string | null = null;
            let activeFileResolved = false;

            for (const change of changes) {
                if (change.changes.tags === undefined) {
                    continue;
                }
                hasTagChanges = true;

                if (!activeFileResolved) {
                    activeFilePath = app.workspace.getActiveFile()?.path ?? null;
                    activeFileResolved = true;
                }

                if (activeFilePath && change.path === activeFilePath) {
                    // Flushes the debounce delay when the active file changes tags so the selection + tag tree state
                    // update together in the next render.
                    shouldFlush = true;
                    break;
                }
            }

            if (hasTagChanges) {
                scheduleTagTreeRebuild({ flush: shouldFlush });
            }
        });

        return unsubscribe;
    }, [app.workspace, isStorageReady, settings.showTags, scheduleTagTreeRebuild, stoppedRef]);

    return { rebuildTagTree, scheduleTagTreeRebuild, cancelTagTreeRebuildDebouncer };
}
