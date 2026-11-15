/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { TFile, type App, type CachedMetadata, type TAbstractFile } from 'obsidian';
import type { NotebookNavigatorSettings } from '../../settings/types';
import type { TopicService } from '../../services/TopicGraphService';
import { getDBInstance } from '../../storage/fileOperations';
import type { FileVisibility } from '../../utils/fileTypeUtils';
import { buildTopicGraphFromDatabase, DEFAULT_TOPIC_TAGS, getTopicNameFromPath, hasTopicTag } from '../../utils/topicGraph';
import { createTopicRebuildScheduler, getTopicRelationSignature } from '../../utils/topicGraphChanges';

function isMarkdownFile(file: TAbstractFile): file is TFile {
    return file instanceof TFile && file.extension === 'md';
}

/**
 * Builds the topic graph and keeps it current without rebuilding on every save.
 *
 * A full build walks every note, which is expensive in large vaults. So the hook keeps, per note, a
 * signature of what the graph reads from it (frontmatter relation links and the topic tag), and only
 * schedules a rebuild when a signature changes, a note with a signature or a topic note is deleted or
 * renamed, or a note gains or loses a topic tag in the index. Body edits never rebuild.
 *
 * Scheduled rebuilds are debounced and rate-limited (see `createTopicRebuildScheduler`). Settings and
 * visibility changes rebuild immediately, because the user asked for them.
 */
export function useTopicGraphSync(params: {
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
    isStorageReadyRef: MutableRefObject<boolean>;
    stoppedRef: MutableRefObject<boolean>;
    getVisibleMarkdownFiles: () => TFile[];
    topicService: TopicService | null;
}): { rebuildTopicTree: () => void } {
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
        stoppedRef,
        getVisibleMarkdownFiles,
        topicService
    } = params;

    const { showTopics } = settings;
    const topicTags = useMemo(() => (settings.topicTags?.length ? settings.topicTags : DEFAULT_TOPIC_TAGS), [settings.topicTags]);

    // Path -> topic relation signature, for notes with a non-empty signature. Null until the first build.
    const signaturesRef = useRef<Map<string, string> | null>(null);

    const buildSignatureIndex = useCallback(() => {
        const signatures = new Map<string, string>();
        for (const file of app.vault.getMarkdownFiles()) {
            const signature = getTopicRelationSignature(app.metadataCache.getFileCache(file), topicTags);
            if (signature) {
                signatures.set(file.path, signature);
            }
        }
        signaturesRef.current = signatures;
    }, [app, topicTags]);

    const buildTopicGraph = useCallback(() => {
        if (!showTopics || !topicService) {
            return;
        }
        if (!signaturesRef.current) {
            buildSignatureIndex();
        }
        const excludedFolderPatterns = showHiddenItems ? [] : hiddenFolders;
        const includedPaths = new Set(getVisibleMarkdownFiles().map(file => file.path));
        const topicGraph = buildTopicGraphFromDatabase(getDBInstance(), app, excludedFolderPatterns, includedPaths, topicTags);
        topicService.updateTopicGraph(topicGraph);
    }, [app, buildSignatureIndex, getVisibleMarkdownFiles, hiddenFolders, showHiddenItems, showTopics, topicService, topicTags]);

    // The latest build function, so the scheduler (created once) always builds with current settings
    const buildRef = useRef(buildTopicGraph);
    useEffect(() => {
        buildRef.current = buildTopicGraph;
    }, [buildTopicGraph]);

    const scheduler = useMemo(
        () =>
            createTopicRebuildScheduler({
                run: () => {
                    if (stoppedRef.current || !isStorageReadyRef.current) {
                        return;
                    }
                    buildRef.current();
                }
            }),
        [isStorageReadyRef, stoppedRef]
    );

    useEffect(() => () => scheduler.cancel(), [scheduler]);

    // Direct rebuild for the initial load. Counts toward the minimum interval.
    const rebuildTopicTree = useCallback(() => {
        scheduler.markRun();
        buildTopicGraph();
    }, [buildTopicGraph, scheduler]);

    // Settings and visibility changes rebuild immediately. Skips the ready transition: the initial load builds.
    const topicTagsKey = topicTags.join('\n');
    const indexedTopicTagsKeyRef = useRef(topicTagsKey);
    const readyGateRef = useRef(false);
    useEffect(() => {
        // The topic tags decide signatures, so new topic tags need a fresh index
        if (indexedTopicTagsKeyRef.current !== topicTagsKey) {
            indexedTopicTagsKeyRef.current = topicTagsKey;
            signaturesRef.current = null;
        }
        if (!isStorageReady) {
            readyGateRef.current = false;
            return;
        }
        if (!readyGateRef.current) {
            readyGateRef.current = true;
            return;
        }
        if (showTopics) {
            scheduler.flush();
        }
    }, [
        isStorageReady,
        scheduler,
        showTopics,
        topicTagsKey,
        showHiddenItems,
        hiddenFolders,
        hiddenFileProperties,
        hiddenFileNames,
        hiddenFileTags,
        fileVisibility,
        profileId
    ]);

    // Vault, metadata and index events schedule a rebuild only when they can change the graph
    useEffect(() => {
        if (!isStorageReady || !showTopics || !topicService) {
            return;
        }

        const isTopicPath = (path: string) => topicService.hasTopicName(getTopicNameFromPath(path));

        const handleMetadataChanged = (file: TFile, _data: string, cache: CachedMetadata) => {
            const signatures = signaturesRef.current;
            if (!signatures || file.extension !== 'md') {
                return;
            }
            const signature = getTopicRelationSignature(cache, topicTags);
            if (signature === (signatures.get(file.path) ?? '')) {
                return;
            }
            if (signature) {
                signatures.set(file.path, signature);
            } else {
                signatures.delete(file.path);
            }
            scheduler.schedule();
        };

        const handleDelete = (file: TAbstractFile) => {
            const signatures = signaturesRef.current;
            if (!signatures || !isMarkdownFile(file)) {
                return;
            }
            const hadSignature = signatures.delete(file.path);
            if (hadSignature || isTopicPath(file.path)) {
                scheduler.schedule();
            }
        };

        const handleRename = (file: TAbstractFile, oldPath: string) => {
            const signatures = signaturesRef.current;
            if (!signatures || !isMarkdownFile(file)) {
                return;
            }
            const signature = signatures.get(oldPath);
            if (signature !== undefined) {
                signatures.delete(oldPath);
                signatures.set(file.path, signature);
            }
            if (signature !== undefined || isTopicPath(oldPath)) {
                scheduler.schedule();
            }
        };

        const metadataRef = app.metadataCache.on('changed', handleMetadataChanged);
        const deleteRef = app.vault.on('delete', handleDelete);
        const renameRef = app.vault.on('rename', handleRename);

        // Topic membership in the first build pass comes from indexed tags, which include frontmatter tags
        // and can arrive after the metadata event (or only during the first index). A note whose topic tag
        // state disagrees with the graph needs a rebuild.
        const unsubscribeContent = getDBInstance().onContentChange(changes => {
            if (stoppedRef.current) {
                return;
            }
            for (const change of changes) {
                const tags = change.changes.tags;
                if (tags === undefined || !change.path.endsWith('.md')) {
                    continue;
                }
                const isTopicNote = Boolean(tags && hasTopicTag(tags, topicTags));
                if (isTopicNote !== isTopicPath(change.path)) {
                    scheduler.schedule();
                    return;
                }
            }
        });

        return () => {
            app.metadataCache.offref(metadataRef);
            app.vault.offref(deleteRef);
            app.vault.offref(renameRef);
            unsubscribeContent();
        };
    }, [app, isStorageReady, scheduler, showTopics, stoppedRef, topicService, topicTags]);

    return { rebuildTopicTree };
}
