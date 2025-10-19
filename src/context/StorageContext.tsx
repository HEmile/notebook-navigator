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

/**
 * StorageContext - Central state management for storage system
 *
 * What it does:
 * - Monitors vault changes and syncs with database
 * - Builds and maintains the tag tree structure
 * - Coordinates content generation via ContentProviderRegistry
 * - Provides real-time content updates to UI components
 *
 * Relationships:
 * - Uses: IndexedDBStorage, ContentProviderRegistry, FileOperations, DiffCalculator
 * - Provides: StorageContext to all child components
 * - Integrates with: Obsidian vault and metadata APIs
 *
 * Key responsibilities:
 * - Monitor file system events (create, delete, rename, modify)
 * - Calculate diffs and update database accordingly
 * - Rebuild tag tree when tags change
 * - Queue content generation for new/modified files
 * - Handle settings changes and trigger regeneration
 * - Provide metadata extraction methods with frontmatter fallback
 */

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { App, TAbstractFile, TFile, debounce, EventRef } from 'obsidian';
import { TIMEOUTS } from '../types/obsidian-extended';
import { ProcessedMetadata, extractMetadata } from '../utils/metadataExtractor';
import { ContentProviderRegistry } from '../services/content/ContentProviderRegistry';
import { PreviewContentProvider } from '../services/content/PreviewContentProvider';
import { FeatureImageContentProvider } from '../services/content/FeatureImageContentProvider';
import { MetadataContentProvider } from '../services/content/MetadataContentProvider';
import { TagContentProvider } from '../services/content/TagContentProvider';
import { IndexedDBStorage, FileData as DBFileData, METADATA_SENTINEL } from '../storage/IndexedDBStorage';
import { calculateFileDiff } from '../storage/diffCalculator';
import { recordFileChanges, markFilesForRegeneration, removeFilesFromCache, getDBInstance } from '../storage/fileOperations';
import { TagTreeNode } from '../types/storage';
import { getFilteredMarkdownFiles } from '../utils/fileFilters';
import { getFileDisplayName as getDisplayName } from '../utils/fileNameUtils';
import { clearNoteCountCache } from '../utils/tagTree';
import { buildTagTreeFromDatabase, findTagNode, collectAllTagPaths } from '../utils/tagTree';
import { buildTopicGraphFromDatabase, findTopicNode, collectAllTopicPaths } from '../utils/topicGraph';
import { useServices } from './ServicesContext';
import { useSettingsState } from './SettingsContext';
import { NotebookNavigatorSettings } from '../settings';
import type { NotebookNavigatorAPI } from '../api/NotebookNavigatorAPI';
import type { ContentType } from '../interfaces/IContentProvider';

/**
 * Data structure containing the hierarchical tag trees and untagged file count
 */
interface FileData {
    tagTree: Map<string, TagTreeNode>;
    untagged: number;
}

/**
 * Context value providing both file data (tag tree) and the file cache
 */
interface StorageContextValue {
    fileData: FileData;
    // Methods to get file metadata with frontmatter extraction
    getFileDisplayName: (file: TFile) => string;
    getFileCreatedTime: (file: TFile) => number;
    getFileModifiedTime: (file: TFile) => number;
    getFileMetadata: (file: TFile) => { name: string; created: number; modified: number };
    // IndexedDB storage instance for FileItem to use
    getDB: () => IndexedDBStorage;
    // Synchronous database access methods
    getFile: (path: string) => DBFileData | null;
    // Tag tree access methods
    getTagTree: () => Map<string, TagTreeNode>;
    findTagInTree: (tagPath: string) => TagTreeNode | null;
    getAllTagPaths: () => string[];
    getTagDisplayPath: (path: string) => string;
    getFiles: (paths: string[]) => Map<string, DBFileData>;
    hasPreview: (path: string) => boolean;
    // Storage initialization state
    isStorageReady: boolean;
    stopAllProcessing: () => void;
    rebuildCache: () => Promise<void>;
}

const StorageContext = createContext<StorageContextValue | null>(null);

interface StorageProviderProps {
    app: App;
    api: NotebookNavigatorAPI | null;
    children: ReactNode;
}

export function StorageProvider({ app, api, children }: StorageProviderProps) {
    const settings = useSettingsState();
    const { tagTreeService, topicService } = useServices();
    const [fileData, setFileData] = useState<FileData>({ tagTree: new Map(), untagged: 0 });

    // Registry managing all content providers for generating preview text, feature images, metadata, and tags
    const contentRegistry = useRef<ContentProviderRegistry | null>(null);
    const isFirstLoad = useRef(true);
    // ID of any scheduled timeout for deferred processing, used for cancellation on unmount
    const pendingSyncTimeoutId = useRef<number | null>(null);
    // Flag indicating whether all processing should be stopped (plugin disabled or view closed)
    const stoppedRef = useRef<boolean>(false);
    // Cleanup function for current metadata wait operation
    const waitDisposerRef = useRef<(() => void) | null>(null);
    const metadataWaitDisposersRef = useRef<Set<() => void>>(new Set());
    const pendingTagMetadataPathsRef = useRef<Set<string>>(new Set());
    const pendingRenameDataRef = useRef<Map<string, DBFileData>>(new Map());
    const latestSettingsRef = useRef(settings);
    const activeVaultEventRefs = useRef<EventRef[] | null>(null);
    const activeMetadataEventRef = useRef<EventRef | null>(null);
    const rebuildFileCacheRef = useRef<ReturnType<typeof debounce> | null>(null);
    const buildFileCacheFnRef = useRef<((isInitialLoad?: boolean) => Promise<void>) | null>(null);

    // State tracking whether storage system and IndexedDB are fully initialized
    const [isStorageReady, setIsStorageReady] = useState(false);
    const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);

    // Flag preventing duplicate initial cache building during startup
    const hasBuiltInitialCache = useRef(false);

    // Previous settings reference for detecting what changed between renders
    const prevSettings = useRef<NotebookNavigatorSettings | null>(null);

    // Returns all markdown files in vault after applying exclusion filters from settings
    const getFilteredMarkdownFilesCallback = useCallback((): TFile[] => {
        return getFilteredMarkdownFiles(app, settings);
    }, [app, settings]);

    // Rebuilds the complete tag tree structure from database contents
    const rebuildTagTree = useCallback(() => {
        const db = getDBInstance();
        // Hidden items override: when enabled, include all folders in tag tree regardless of exclusions
        const excludedFolderPatterns = settings.showHiddenItems ? [] : settings.excludedFolders;
        // Filter database results to only include files matching current visibility settings
        const includedPaths = new Set(getFilteredMarkdownFilesCallback().map(f => f.path));
        const { tagTree, untagged: newUntagged } = buildTagTreeFromDatabase(db, excludedFolderPatterns, includedPaths);
        clearNoteCountCache();
        const untaggedCount = newUntagged;
        setFileData({ tagTree, untagged: untaggedCount });

        // Propagate updated tag trees to the global TagTreeService for cross-component access
        if (tagTreeService) {
            tagTreeService.updateTagTree(tagTree, untaggedCount);
        }

        return tagTree;
    }, [settings.excludedFolders, settings.showHiddenItems, tagTreeService, getFilteredMarkdownFilesCallback]);

    // Rebuilds the complete topic graph from database contents
    const rebuildTopicTree = useCallback(() => {
        const db = getDBInstance();
        // Hidden items override: when enabled, include all folders in tag tree regardless of exclusions
        const excludedFolderPatterns = settings.showHiddenItems ? [] : settings.excludedFolders;
        // Filter database results to only include files matching current visibility settings
        const includedPaths = new Set(getFilteredMarkdownFilesCallback().map(f => f.path));
        const topicGraph = buildTopicGraphFromDatabase(db, app, excludedFolderPatterns, includedPaths);
        clearNoteCountCache();

        // Propagate updated topic graph to the global TopicService for cross-component access
        if (topicService) {
            topicService.updateTopicGraph(topicGraph);
        }

        return topicGraph;
    }, [settings.excludedFolders, settings.showHiddenItems, tagTreeService, getFilteredMarkdownFilesCallback]);

    /**
     * Effect: Rebuild tag tree when hidden items visibility changes
     *
     * When the user toggles "Show hidden items" in the UI, we need to rebuild
     * the tag tree because:
     * - Hidden items setting affects which folders are excluded from tag counting
     * - Tag tree needs to recalculate note counts with the new exclusion rules
     * - This ensures tag counts stay accurate when showing/hiding excluded folders
     */
    useEffect(() => {
        if (!isStorageReady) return;
        if (settings.showTags) {
            rebuildTagTree();
        }
        if (settings.showTopics) {
            rebuildTopicTree();
        }
    }, [settings.showHiddenItems, settings.showTags, settings.showTopics, isStorageReady, rebuildTagTree, rebuildTopicTree]);

    /**
     * Effect: Keep a ref with the latest settings for use in callbacks
     *
     * This ref is needed because callbacks and async operations may close over
     * stale settings values. By keeping a ref updated with the latest settings,
     * we can always access current settings even in older callback closures.
     */
    useEffect(() => {
        latestSettingsRef.current = settings;
    }, [settings]);

    /**
     * Effect: Clean up tag-related metadata operations when tags are disabled
     *
     * When the user disables tags in settings, we need to:
     * 1. Cancel any pending metadata wait operations for tag extraction
     * 2. Clear the set of files waiting for metadata
     * 3. This prevents unnecessary processing and memory leaks
     *
     * The effect only runs cleanup when tags are disabled (showTags = false).
     * When tags are enabled, we keep existing operations running.
     */
    useEffect(() => {
        if (settings.showTags) {
            return;
        }

        // Clean up all active metadata wait disposers
        if (metadataWaitDisposersRef.current.size > 0) {
            for (const dispose of metadataWaitDisposersRef.current) {
                try {
                    dispose();
                } catch {
                    // ignore cleanup errors
                }
            }
            metadataWaitDisposersRef.current.clear();
        }

        // Clear the set of paths waiting for metadata
        pendingTagMetadataPathsRef.current.clear();
    }, [settings.showTags]);

    /**
     * Waits until all provided markdown files have entries in Obsidian's metadata cache.
     *
     * Why this works:
     * - Obsidian emits a global `resolved` event once the initial index pass completes.
     * - Subsequent metadata recalculations emit `changed` with the affected file.
     * - `getFileCache` returns `null` until the indexer has produced a cache object, even when
     *   the file has malformed frontmatter.
     *
     * Strategy:
     * 1. Filter down to real markdown files and remember their paths.
     * 2. If every tracked file already has cache data (common after the first load), bail out immediately.
     * 3. Otherwise, subscribe to `resolved` and `changed`.
     *    - `resolved` covers the initial indexing burst.
     *    - `changed` lets us react when specific files are recalculated later.
     * 4. On each event, re-check the tracked paths. As soon as every file reports a cache entry,
     *    detach the listeners and run the callback.
     *
     * The callback still only fires when Obsidian surfaces metadata for every tracked file.
     * If any files never resolve (large notes, invalid frontmatter), we log an error after 10s
     * so users know why tags remain disabled, but we do not fall back to partial data.
     */
    const waitForMetadataCache = useCallback(
        (files: TFile[], callback: () => void): (() => void) => {
            if (files.length === 0) {
                callback();
                return () => {};
            }

            // Waiting is only meaningful for real markdown files that still exist in the vault.
            const trackedPaths = new Set(files.filter((file): file is TFile => file instanceof TFile).map(file => file.path));

            // Checks which files have metadata ready and removes them from tracking
            const removeReadyPaths = (paths: Iterable<string>) => {
                for (const path of paths) {
                    // Skip paths not being tracked
                    if (!trackedPaths.has(path)) {
                        continue;
                    }
                    const abstract = app.vault.getAbstractFileByPath(path);
                    // Remove deleted or non-file paths from tracking
                    if (!abstract || !(abstract instanceof TFile)) {
                        trackedPaths.delete(path);
                        continue;
                    }
                    // Check if metadata cache has data for this file
                    const metadata = app.metadataCache.getFileCache(abstract);
                    // Remove from tracking if metadata is available
                    if (metadata !== null && metadata !== undefined) {
                        trackedPaths.delete(path);
                    }
                }
            };

            removeReadyPaths(trackedPaths);

            if (trackedPaths.size === 0) {
                callback();
                return () => {};
            }

            let resolvedEventRef: EventRef | null = null;
            let changedEventRef: EventRef | null = null;
            let disposed = false;
            let warningTimeoutId: number | null = null;

            // Clears the warning timer if it's currently scheduled
            const clearWarningTimer = () => {
                if (warningTimeoutId !== null && typeof window !== 'undefined') {
                    window.clearTimeout(warningTimeoutId);
                    warningTimeoutId = null;
                }
            };

            // Schedules a warning message after 10 seconds if metadata hasn't resolved
            const scheduleWarning = () => {
                // Don't schedule if already scheduled
                if (warningTimeoutId !== null) {
                    return;
                }
                // Skip in non-browser environments
                if (typeof window === 'undefined') {
                    return;
                }
                warningTimeoutId = window.setTimeout(() => {
                    warningTimeoutId = null;
                    // Don't warn if all files resolved
                    if (trackedPaths.size === 0) {
                        return;
                    }
                    // Log first 20 unresolved files for debugging
                    const unresolved = Array.from(trackedPaths).slice(0, 20);
                    console.error(
                        'Notebook Navigator could not resolve metadata for all files. Tags remain disabled until metadata becomes available.',
                        {
                            unresolved,
                            totalPending: trackedPaths.size,
                            hint: 'Reduce file size, fix invalid frontmatter, exclude the files, or disable tags.'
                        }
                    );
                }, 10000);
            };

            const cleanup = () => {
                if (disposed) {
                    return;
                }
                disposed = true;
                clearWarningTimer();
                if (resolvedEventRef) {
                    try {
                        app.metadataCache.offref(resolvedEventRef);
                    } catch {
                        // ignore
                    }
                    resolvedEventRef = null;
                }
                if (changedEventRef) {
                    try {
                        app.metadataCache.offref(changedEventRef);
                    } catch {
                        // ignore
                    }
                    changedEventRef = null;
                }
            };

            const maybeFinish = () => {
                if (!disposed && trackedPaths.size === 0) {
                    cleanup();
                    callback();
                }
            };

            // Listen for Obsidian's initial metadata indexing completion
            resolvedEventRef = app.metadataCache.on('resolved', () => {
                // Clear any existing warning timer since we're checking again
                clearWarningTimer();
                // Check all tracked paths for metadata availability
                removeReadyPaths(trackedPaths);
                // Schedule warning if files remain unresolved
                if (trackedPaths.size > 0) {
                    scheduleWarning();
                }
                // Fire callback if all files are ready
                maybeFinish();
            });
            // Listen for individual file metadata updates
            changedEventRef = app.metadataCache.on('changed', file => {
                // Ignore non-file events
                if (!file || !(file instanceof TFile)) {
                    return;
                }
                // Ignore files we're not tracking
                if (!trackedPaths.has(file.path)) {
                    return;
                }
                // Check if this file's metadata is now ready
                removeReadyPaths([file.path]);
                // Fire callback if all files are ready
                maybeFinish();
            });

            // Schedule a warning in case metadata never resolves after the initial sweep.
            scheduleWarning();

            return cleanup;
        },
        [app]
    );

    /**
     * Queues tag extraction for files once their metadata is ready in Obsidian's cache.
     *
     * This function:
     * 1. Deduplicates the input files to avoid duplicate processing
     * 2. Filters to only markdown files (tags are only in .md files)
     * 3. Waits for Obsidian's metadata cache to be ready for all files
     * 4. Queues tag extraction once metadata is available
     * 5. Tracks the cleanup function to cancel if needed
     */
    const queueTagsWhenMetadataReady = useCallback(
        (files: TFile[]) => {
            // Exit early if tags are disabled in settings
            const currentSettings = latestSettingsRef.current;
            if (!currentSettings.showTags) {
                return;
            }

            // Deduplicate files by path to avoid processing the same file multiple times
            const uniqueFiles = new Map<string, TFile>();
            for (const file of files) {
                if (!uniqueFiles.has(file.path)) {
                    uniqueFiles.set(file.path, file);
                }
            }

            // Filter to only markdown files that aren't already being processed
            // Only .md files can have tags, and we skip files already waiting for metadata
            const tagCandidates = Array.from(uniqueFiles.values()).filter(file => {
                return file.extension === 'md' && !pendingTagMetadataPathsRef.current.has(file.path);
            });

            // Exit early if no files need processing
            if (tagCandidates.length === 0) {
                return;
            }

            // Extract paths and create a function to release them from tracking
            const trackedPaths = tagCandidates.map(file => file.path);
            const releaseTrackedPaths = () => {
                for (const path of trackedPaths) {
                    pendingTagMetadataPathsRef.current.delete(path);
                }
            };

            // Mark these paths as being processed to avoid duplicate operations
            for (const path of trackedPaths) {
                pendingTagMetadataPathsRef.current.add(path);
            }

            // Track whether we need to store a cleanup function and if callback fired sync
            let cleanupWrapper: (() => void) | null = null;
            let firedImmediately = false;

            // Callback executed when metadata is ready for all files
            const handleReady = () => {
                // Mark that callback fired immediately (synchronously)
                firedImmediately = true;
                // Release the paths from tracking since we're done with them
                releaseTrackedPaths();

                // Remove cleanup wrapper from tracking if it exists
                if (cleanupWrapper) {
                    metadataWaitDisposersRef.current.delete(cleanupWrapper);
                    cleanupWrapper = null;
                }

                // Exit early if processing was stopped
                if (stoppedRef.current) {
                    return;
                }

                // Check again if tags are still enabled (settings might have changed)
                const latestSettings = latestSettingsRef.current;
                if (!latestSettings.showTags) {
                    return;
                }

                // Ensure content registry is available
                if (!contentRegistry.current) {
                    return;
                }

                // Queue tag extraction for all candidate files
                contentRegistry.current.queueFilesForAllProviders(tagCandidates, latestSettings, {
                    include: ['tags'] as ContentType[]
                });
            };

            // Start waiting for metadata cache to be ready
            // This returns a cleanup function if the wait is async
            let rawCleanup: (() => void) | null = null;
            try {
                rawCleanup = waitForMetadataCache(tagCandidates, handleReady);
            } catch (error) {
                // If wait setup fails, release tracked paths and re-throw
                releaseTrackedPaths();
                throw error;
            }

            // Handle the cleanup function based on whether callback fired immediately
            if (!firedImmediately && rawCleanup) {
                // Callback didn't fire immediately - we need to track the cleanup function
                // Wrap it to also release tracked paths when cleaned up
                cleanupWrapper = () => {
                    releaseTrackedPaths();
                    try {
                        rawCleanup();
                    } catch {
                        // ignore cleanup errors
                    }
                };
                // Add to our set of tracked disposers for later cleanup
                metadataWaitDisposersRef.current.add(cleanupWrapper);
            } else if (!firedImmediately) {
                // Callback didn't fire but no cleanup function returned
                // Just release the tracked paths
                releaseTrackedPaths();
                if (rawCleanup) {
                    // Clean up immediately if we have a cleanup function
                    try {
                        rawCleanup();
                    } catch {
                        // ignore cleanup errors
                    }
                }
            }
        },
        [waitForMetadataCache]
    );

    /**
     * Clears all cached data and rebuilds the entire cache from scratch.
     * Stops all ongoing processing, clears the database, resets state,
     * and triggers a full initial cache rebuild.
     */
    const rebuildCache = useCallback(async () => {
        // Save the current processing state to restore after rebuild
        const previousStopped = stoppedRef.current;
        stoppedRef.current = true;

        // Stop all content processing operations (previews, feature images, etc.)
        if (contentRegistry.current) {
            contentRegistry.current.stopAllProcessing();
        }

        // Cancel any scheduled background processing
        if (pendingSyncTimeoutId.current !== null) {
            if (typeof window !== 'undefined') {
                window.clearTimeout(pendingSyncTimeoutId.current);
            }
            pendingSyncTimeoutId.current = null;
        }

        // Cancel any debounced file cache rebuild operations
        const rebuildFileCache = rebuildFileCacheRef.current;
        if (rebuildFileCache) {
            try {
                rebuildFileCache.cancel();
            } catch {
                // ignore
            }
        }

        // Clean up any active wait disposers for metadata loading
        if (waitDisposerRef.current) {
            try {
                waitDisposerRef.current();
            } catch {
                // ignore
            }
            waitDisposerRef.current = null;
        }

        // Clean up all tracked metadata wait disposers
        if (metadataWaitDisposersRef.current.size > 0) {
            for (const dispose of metadataWaitDisposersRef.current) {
                try {
                    dispose();
                } catch {
                    // ignore errors during cleanup
                }
            }
            metadataWaitDisposersRef.current.clear();
        }

        pendingTagMetadataPathsRef.current.clear();

        // Clear the entire IndexedDB database
        try {
            const db = getDBInstance();
            await db.clearDatabase();
        } catch (error) {
            console.error('Failed to clear database during cache rebuild:', error);
            stoppedRef.current = previousStopped;
            throw error;
        }

        // Reset in-memory tag tree structures to empty state
        const emptyTagTree = new Map<string, TagTreeNode>();
        setFileData({ tagTree: emptyTagTree, untagged: 0 });
        if (tagTreeService) {
            tagTreeService.updateTagTree(emptyTagTree, 0);
        }
        clearNoteCountCache();

        // Mark storage as not ready while rebuilding
        setIsStorageReady(false);
        api?.setStorageReady(false);
        hasBuiltInitialCache.current = false;

        // Verify the cache building function is available
        const buildCache = buildFileCacheFnRef.current;
        if (!buildCache) {
            stoppedRef.current = previousStopped;
            console.error('Rebuild cache requested before initialization completed.');
            return;
        }

        // Re-enable processing and trigger full cache rebuild
        stoppedRef.current = false;

        try {
            hasBuiltInitialCache.current = true;
            await buildCache(true);
        } catch (error) {
            hasBuiltInitialCache.current = false;
            stoppedRef.current = previousStopped;
            throw error;
        }

        // Restore the original processing state
        stoppedRef.current = previousStopped;
    }, [api, tagTreeService]);

    /**
     * Memoized context value to prevent unnecessary re-renders
     *
     * This memo creates the context value object that will be provided to all child
     * components. It includes:
     * - Helper methods for getting file metadata with frontmatter support
     * - Direct database access methods
     * - Tag tree navigation methods
     * - Storage state information
     *
     * The value is memoized to only recreate when its dependencies change,
     * preventing child components from re-rendering unnecessarily.
     */
    const contextValue = useMemo(() => {
        // Gets the display name for a file, using frontmatter if configured
        const getFileDisplayName = (file: TFile): string => {
            if (settings.useFrontmatterMetadata) {
                const metadata = extractMetadata(app, file, settings);
                if (metadata.fn) {
                    return metadata.fn;
                }
            }
            return getDisplayName(file, undefined, settings);
        };

        // Gets the creation time for a file, using frontmatter if configured
        const getFileCreatedTime = (file: TFile): number => {
            if (settings.useFrontmatterMetadata) {
                const metadata = extractMetadata(app, file, settings);
                if (
                    metadata.fc !== undefined &&
                    metadata.fc !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED &&
                    metadata.fc !== METADATA_SENTINEL.PARSE_FAILED
                ) {
                    return metadata.fc;
                }
            }

            return file.stat.ctime;
        };

        // Gets the modification time for a file, using frontmatter if configured
        const getFileModifiedTime = (file: TFile): number => {
            if (settings.useFrontmatterMetadata) {
                const metadata = extractMetadata(app, file, settings);
                if (
                    metadata.fm !== undefined &&
                    metadata.fm !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED &&
                    metadata.fm !== METADATA_SENTINEL.PARSE_FAILED
                ) {
                    return metadata.fm;
                }
            }

            return file.stat.mtime;
        };

        // Gets all metadata for a file in one call (name, created, modified)
        const getFileMetadata = (file: TFile): { name: string; created: number; modified: number } => {
            let extractedMetadata: ProcessedMetadata | null = null;
            if (settings.useFrontmatterMetadata) {
                extractedMetadata = extractMetadata(app, file, settings);
            }

            return {
                name: extractedMetadata?.fn || getDisplayName(file, undefined, settings),
                created:
                    extractedMetadata?.fc !== undefined && extractedMetadata.fc !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED
                        ? extractedMetadata.fc
                        : file.stat.ctime,
                modified:
                    extractedMetadata?.fm !== undefined && extractedMetadata.fm !== METADATA_SENTINEL.FIELD_NOT_CONFIGURED
                        ? extractedMetadata.fm
                        : file.stat.mtime
            };
        };

        // Direct accessors for tag tree data structures
        const getTagTree = () => fileData.tagTree;

        // Finds a tag node by path in the main tag tree
        const findTagInTree = (tagPath: string) => {
            return findTagNode(fileData.tagTree, tagPath);
        };

        // Collects all tag paths from the tree
        const getAllTagPaths = () => {
            const allPaths: string[] = [];
            for (const rootNode of fileData.tagTree.values()) {
                const paths = collectAllTagPaths(rootNode);
                allPaths.push(...paths);
            }
            return allPaths;
        };

        // Gets the display path for a tag (may differ from actual path due to display settings)
        const getTagDisplayPath = (path: string): string => {
            const tagNode = findTagNode(fileData.tagTree, path);
            return tagNode?.displayPath ?? path;
        };

        return {
            fileData,
            getFileDisplayName,
            getFileCreatedTime,
            getFileModifiedTime,
            getFileMetadata,
            getDB: getDBInstance,
            getFile: (path: string) => getDBInstance().getFile(path),
            getFiles: (paths: string[]) => getDBInstance().getFiles(paths),
            hasPreview: (path: string) => getDBInstance().hasPreview(path),
            isStorageReady,
            getTagTree,
            findTagInTree,
            getAllTagPaths,
            getTagDisplayPath,
            rebuildCache
        };
    }, [fileData, settings, app, isStorageReady, rebuildCache]);

    /**
     * Centralized handler for all content-related settings changes
     * Delegates to the ContentProviderRegistry to determine what needs regeneration
     */
    const handleSettingsChanges = useCallback(
        async (oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings) => {
            const registry = contentRegistry.current;
            if (!registry) {
                return;
            }

            // Let the registry handle settings changes
            await registry.handleSettingsChange(oldSettings, newSettings);

            if (stoppedRef.current || !contentRegistry.current) {
                return;
            }

            // Queue content generation for all files if needed
            const allFiles = getFilteredMarkdownFilesCallback();
            if (stoppedRef.current || !contentRegistry.current) {
                return;
            }
            const options = newSettings.showTags ? { exclude: ['tags'] as ContentType[] } : undefined;
            contentRegistry.current.queueFilesForAllProviders(allFiles, newSettings, options);

            if (newSettings.showTags) {
                queueTagsWhenMetadataReady(allFiles);
            }
        },
        [getFilteredMarkdownFilesCallback, queueTagsWhenMetadataReady]
    );

    // ==================== Effects ====================

    /**
     * Effect: Initialize content provider registry
     *
     * Creates and configures the ContentProviderRegistry with all content providers:
     * - PreviewContentProvider: Generates preview text for files
     * - FeatureImageContentProvider: Extracts feature images from frontmatter
     * - MetadataContentProvider: Extracts custom metadata from frontmatter
     * - TagContentProvider: Extracts tags from file content and frontmatter
     *
     * The registry coordinates all content generation and handles provider lifecycle.
     * On cleanup, it stops all processing and cleans up resources.
     */
    useEffect(() => {
        // Only create registry if it doesn't exist
        if (!contentRegistry.current) {
            // Create content provider registry and register providers
            contentRegistry.current = new ContentProviderRegistry();
            contentRegistry.current.registerProvider(new PreviewContentProvider(app));
            contentRegistry.current.registerProvider(new FeatureImageContentProvider(app));
            contentRegistry.current.registerProvider(new MetadataContentProvider(app));
            contentRegistry.current.registerProvider(new TagContentProvider(app));
        }

        return () => {
            if (contentRegistry.current) {
                contentRegistry.current.stopAllProcessing();
                contentRegistry.current = null;
            }
            // Also cancel any pending idle callback here as an extra safeguard
            if (pendingSyncTimeoutId.current !== null) {
                if (typeof window !== 'undefined') {
                    window.clearTimeout(pendingSyncTimeoutId.current);
                }
                pendingSyncTimeoutId.current = null;
            }
        };
    }, [app]); // Only recreate when app changes, not settings

    /**
     * Effect: Check if IndexedDB is ready and available
     *
     * This effect verifies that the database has been properly initialized by the plugin.
     * The database is initialized early in main.ts during plugin load, but we need to
     * confirm it's ready before attempting any database operations.
     *
     * The 'cancelled' flag prevents state updates if the component unmounts during
     * the async initialization check.
     */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const db = getDBInstance();
                await db.init();
                if (!cancelled) setIsIndexedDBReady(true);
            } catch (error) {
                console.error('Database not available for StorageContext:', error);
                if (!cancelled) setIsIndexedDBReady(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * Effect: Listen for tag changes in the database to rebuild tag tree
     *
     * This subscribes to database content changes specifically for tag updates.
     * When any file's tags are modified (added, removed, or changed), we need to:
     * - Rebuild the entire tag tree structure to reflect the new tag hierarchy
     * - Update note counts for affected tags and their parent tags
     * - Update the untagged notes count if files gained or lost all tags
     *
     * The subscription is only active when storage is ready and tags are enabled.
     */
    useEffect(() => {
        if (!isStorageReady) return;

        const db = getDBInstance();
        const unsubscribe = db.onContentChange(changes => {
            if (stoppedRef.current) return;
            // Check if any changes include tags
            const hasTagChanges = changes.some(change => change.changes.tags !== undefined);

            if (hasTagChanges && settings.showTags) {
                // Rebuild tag tree when tags change
                rebuildTagTree();
            }
        });

        return unsubscribe;
    }, [isStorageReady, settings.showTags, rebuildTagTree]);

    // TODO: Do the above for topics. Not super important, just reload the window. 

    /**
     * Main Effect: Initialize storage system and monitor vault changes
     *
     * This is the core effect that:
     * 1. Performs initial database synchronization on startup
     * 2. Sets up vault event listeners for file changes
     * 3. Manages content generation queuing
     * 4. Handles both cold boot (empty database) and warm boot (existing data)
     *
     * The effect has two main code paths:
     * - Initial load (isInitialLoad=true): Synchronous processing for immediate UI
     * - Background updates: Uses deferred timeouts to avoid blocking the UI and to run on all platforms
     */
    useEffect(() => {
        /**
         * Process vault files and sync with database
         *
         * @param allFiles - All markdown files in the vault (after exclusion filters)
         * @param isInitialLoad - True for initial startup, false for background updates
         *
         * Initial load path (isInitialLoad=true):
         * - Runs synchronously to get UI ready quickly
         * - Calculates diff between vault and database
         * - Updates database with changes
         * - Builds tag tree
         * - Marks storage as ready
         * - Waits for Obsidian metadata cache before extracting tags
         * - Queues content generation for new/modified files
         *
         * Background update path (isInitialLoad=false):
         * - Uses deferred scheduling to avoid blocking UI
         * - Processes changes incrementally
         * - Only rebuilds tag tree if files were deleted
         */
        const processExistingCache = async (allFiles: TFile[], isInitialLoad: boolean = false) => {
            if (stoppedRef.current) return;
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
            }

            if (isInitialLoad) {
                try {
                    // Step 1: Calculate differences between vault and database
                    // This MUST happen first to ensure the database reflects the current vault state
                    // toAdd: Files in vault but not in database (new files)
                    // toUpdate: Files modified since last cached (mtime mismatch)
                    // toRemove: Files in database but not in vault (deleted files)
                    // cachedFiles: Current database state for comparison
                    const { toAdd, toUpdate, toRemove, cachedFiles } = await calculateFileDiff(allFiles);

                    // Step 2: Update database with changes
                    if (toRemove.length > 0) {
                        await removeFilesFromCache(toRemove);
                    }

                    if (toAdd.length > 0 || toUpdate.length > 0) {
                        await recordFileChanges([...toAdd, ...toUpdate], cachedFiles, pendingRenameDataRef.current);
                    }

                    // Step 3: Build tag tree and topic graph from the now-synced database
                    // This ensures the tag tree and topic graph accurately reflect the current vault state
                    rebuildTagTree();
                    rebuildTopicTree();

                    // Step 4: Mark storage as ready
                    setIsStorageReady(true);

                    // Notify API that storage is ready
                    // The API will trigger the storage-ready event internally
                    if (api) {
                        api.setStorageReady(true);
                    }

                    // Step 5: Wait for Obsidian's metadata cache before extracting tags
                    // Tags come from Obsidian's metadata cache, not from reading files directly.
                    // We must wait until Obsidian has parsed the frontmatter and content of each file
                    // before we can extract tags. This is especially important on cold boot when
                    // Obsidian is still indexing the vault.
                    if (settings.showTags) {
                        const filesNeedingTags = allFiles.filter(file => {
                            const fileData = getDBInstance().getFile(file.path);
                            return fileData && fileData.tags === null;
                        });

                        if (filesNeedingTags.length > 0) {
                            // waitForMetadataCache will fire the callback when all files have metadata
                            const disposer = waitForMetadataCache(filesNeedingTags, () => {
                                if (contentRegistry.current) {
                                    contentRegistry.current.queueFilesForAllProviders(filesNeedingTags, settings, {
                                        include: ['tags']
                                    });
                                }
                            });
                            waitDisposerRef.current = disposer;
                        }
                    }

                    // Step 6: Queue remaining content generation for new/modified files
                    const contentEnabled = settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata;

                    if (contentRegistry.current && contentEnabled && (toAdd.length > 0 || toUpdate.length > 0)) {
                        const nonTagOptions = settings.showTags ? { exclude: ['tags'] as ContentType[] } : undefined;

                        contentRegistry.current.queueFilesForAllProviders([...toAdd, ...toUpdate], settings, nonTagOptions);

                        if (settings.showTags && toUpdate.length > 0) {
                            queueTagsWhenMetadataReady(toUpdate);
                        }
                    }
                } catch (error) {
                    console.error('Failed during initial load sequence:', error);
                }
            } else {
                // Background update path: Process changes asynchronously without blocking the UI.
                // This path is used for all vault changes after initial load to batch bursts of events.

                // Cancel any previously scheduled background work before queuing a new one
                // This ensures we don't process stale updates if multiple changes happen quickly
                if (pendingSyncTimeoutId.current !== null) {
                    if (typeof window !== 'undefined') {
                        window.clearTimeout(pendingSyncTimeoutId.current);
                    }
                    pendingSyncTimeoutId.current = null;
                }

                const processDiff = async () => {
                    if (stoppedRef.current) return;
                    try {
                        const { toAdd, toUpdate, toRemove, cachedFiles } = await calculateFileDiff(allFiles);

                        if (toAdd.length > 0 || toUpdate.length > 0 || toRemove.length > 0) {
                            try {
                                const filesToUpdate = [...toAdd, ...toUpdate];
                                if (filesToUpdate.length > 0) {
                                    await recordFileChanges(filesToUpdate, cachedFiles, pendingRenameDataRef.current);
                                }

                                if (toRemove.length > 0) {
                                    await removeFilesFromCache(toRemove);
                                    if (settings.showTags) {
                                        rebuildTagTree();
                                    }
                                    if (settings.showTopics) {
                                        rebuildTopicTree();
                                    }
                                }
                            } catch (error) {
                                console.error('Failed to update IndexedDB cache:', error);
                            }

                            const contentEnabled =
                                settings.showTags ||
                                settings.showFilePreview ||
                                settings.showFeatureImage ||
                                settings.useFrontmatterMetadata;

                            if (contentRegistry.current && contentEnabled) {
                                const db = getDBInstance();
                                let filesToProcess: TFile[] = [];

                                try {
                                    const filesToCheck = [...toAdd, ...toUpdate];
                                    const paths = filesToCheck.map(f => f.path);
                                    const indexedFiles = db.getFiles(paths);

                                    filesToProcess = filesToCheck.filter(file => {
                                        const fileData = indexedFiles.get(file.path);
                                        if (!fileData) {
                                            return true;
                                        }

                                        if (fileData.mtime !== file.stat.mtime) {
                                            return true;
                                        }

                                        return (
                                            (settings.showFilePreview && fileData.preview === null && file.extension === 'md') ||
                                            (settings.showFeatureImage && fileData.featureImage === null) ||
                                            (settings.useFrontmatterMetadata && fileData.metadata === null && file.extension === 'md')
                                        );
                                    });

                                    if (filesToProcess.length === 0) {
                                        const filesNeedingTags = settings.showTags ? db.getFilesNeedingContent('tags') : new Set<string>();
                                        const filesNeedingPreview = settings.showFilePreview
                                            ? db.getFilesNeedingContent('preview')
                                            : new Set<string>();
                                        const filesNeedingImage = settings.showFeatureImage
                                            ? db.getFilesNeedingContent('featureImage')
                                            : new Set<string>();
                                        const filesNeedingMetadata = settings.useFrontmatterMetadata
                                            ? db.getFilesNeedingContent('metadata')
                                            : new Set<string>();

                                        const pathsNeedingContent = new Set([
                                            ...filesNeedingTags,
                                            ...filesNeedingPreview,
                                            ...filesNeedingImage,
                                            ...filesNeedingMetadata
                                        ]);

                                        if (pathsNeedingContent.size > 0) {
                                            filesToProcess = allFiles.filter(file => pathsNeedingContent.has(file.path));
                                        }
                                    }
                                } catch (error) {
                                    console.error('Failed to check content needs from IndexedDB:', error);
                                }

                                if (filesToProcess.length > 0) {
                                    const options = settings.showTags ? { exclude: ['tags'] as ContentType[] } : undefined;
                                    contentRegistry.current.queueFilesForAllProviders(filesToProcess, settings, options);
                                    if (settings.showTags) {
                                        queueTagsWhenMetadataReady(filesToProcess);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error processing file cache diff:', error);
                    }
                };

                if (typeof window !== 'undefined') {
                    pendingSyncTimeoutId.current = window.setTimeout(() => {
                        pendingSyncTimeoutId.current = null;
                        void processDiff();
                    }, 0);
                } else {
                    void processDiff();
                }
            }
        };

        /**
         * Build or rebuild the file cache
         *
         * This is the entry point for all cache building operations.
         * Called with isInitialLoad=true on startup, false for updates.
         */
        const buildFileCache = async (isInitialLoad: boolean = false) => {
            if (stoppedRef.current) return;
            const allFiles = getFilteredMarkdownFilesCallback();
            await processExistingCache(allFiles, isInitialLoad);
        };

        buildFileCacheFnRef.current = buildFileCache;

        /**
         * Debounced cache rebuild for vault events
         *
         * Vault events (create, delete, rename) often come in bursts when:
         * - Multiple files are moved/deleted at once
         * - Sync operations update many files
         * - Plugins modify multiple files
         *
         * The trailing debounce waits for events to stop before processing,
         * extending the delay with each new event. This batches updates efficiently.
         */
        let rebuildFileCache = rebuildFileCacheRef.current;
        if (!rebuildFileCache) {
            rebuildFileCache = debounce(
                () => {
                    if (stoppedRef.current) {
                        return;
                    }
                    const build = buildFileCacheFnRef.current;
                    if (!build) {
                        return;
                    }
                    void build(false);
                },
                TIMEOUTS.FILE_OPERATION_DELAY,
                true
            );
            rebuildFileCacheRef.current = rebuildFileCache;
        }

        // Only build initial cache if IndexedDB is ready and we haven't built it yet
        if (isIndexedDBReady && !hasBuiltInitialCache.current) {
            hasBuiltInitialCache.current = true;
            buildFileCache(true);
        }

        /**
         * Set up vault event listeners
         *
         * These listeners trigger cache updates when files change:
         * - create: New file added to vault
         * - delete: File removed from vault
         * - rename: File moved or renamed
         * - modify: File content changed (special handling for immediate tag updates)
         *
         * Most events use debounced processing except 'modify' which processes
         * immediately to ensure tags update quickly when editing files.
         */
        /**
         * Handles file rename events by preserving metadata from the old path.
         * This ensures that file icons, colors, and other metadata survive renames.
         */
        const handleRename = (file: TAbstractFile, oldPath: string) => {
            if (file instanceof TFile) {
                try {
                    const db = getDBInstance();
                    const existing = db.getFile(oldPath);
                    if (existing) {
                        pendingRenameDataRef.current.set(file.path, existing);
                        // Preload memory cache with existing data to avoid re-fetching after rename
                        db.seedMemoryFile(file.path, existing);
                    }
                } catch (error) {
                    console.error('Failed to capture renamed file data:', error);
                }
            }
            rebuildFileCache();
        };

        const vaultEvents = [
            app.vault.on('create', rebuildFileCache),
            app.vault.on('delete', rebuildFileCache),
            app.vault.on('rename', handleRename),
            app.vault.on('modify', async file => {
                if (stoppedRef.current) return;
                // Check if it's a TFile (not a folder)
                if (file instanceof TFile && file.extension === 'md') {
                    // Get existing data for the file
                    try {
                        const db = getDBInstance();
                        const existingData = db.getFiles([file.path]);
                        // Record the file change (only does something for new files)
                        await recordFileChanges([file], existingData, pendingRenameDataRef.current);
                    } catch (e) {
                        console.error('Failed to record file change on modify:', e);
                        return;
                    }

                    // Content providers will detect the mtime mismatch (db.mtime != file.mtime) and regenerate
                    if (contentRegistry.current) {
                        const options = settings.showTags ? { exclude: ['tags'] as ContentType[] } : undefined;
                        contentRegistry.current.queueFilesForAllProviders([file], settings, options);
                        if (settings.showTags) {
                            queueTagsWhenMetadataReady([file]);
                        }
                    }
                }
            })
        ];
        activeVaultEventRefs.current = vaultEvents;

        /**
         * Listen for metadata cache changes
         *
         * This handles frontmatter changes that might not trigger file modify events:
         * - External tools changing files without updating mtime
         * - Sync conflicts that preserve timestamps
         * - Some plugins that modify frontmatter directly
         *
         * We mark files for regeneration to ensure content stays in sync.
         */
        const metadataEvent = app.metadataCache.on('changed', async file => {
            if (stoppedRef.current) return;
            if (file && file.extension === 'md') {
                // Mark file for regeneration - metadata changes might not update mtime
                try {
                    await markFilesForRegeneration([file]);
                } catch (e) {
                    console.error('Failed to mark file for regeneration:', e);
                    return;
                }

                // Queue content regeneration for the file
                if (contentRegistry.current) {
                    const options = settings.showTags ? { exclude: ['tags'] as ContentType[] } : undefined;
                    contentRegistry.current.queueFilesForAllProviders([file], settings, options);
                    if (settings.showTags) {
                        queueTagsWhenMetadataReady([file]);
                    }
                }

                // Note: We already queued content regeneration above
                // No need to check for specific feature image changes
            }
        });
        activeMetadataEventRef.current = metadataEvent;

        // Cleanup
        const activeMetadataWaitDisposers = metadataWaitDisposersRef.current;

        return () => {
            buildFileCacheFnRef.current = null;
            vaultEvents.forEach(eventRef => app.vault.offref(eventRef));
            app.metadataCache.offref(metadataEvent);
            activeVaultEventRefs.current = null;
            activeMetadataEventRef.current = null;
            // Cancel any pending scheduled background work
            if (pendingSyncTimeoutId.current !== null) {
                if (typeof window !== 'undefined') {
                    window.clearTimeout(pendingSyncTimeoutId.current);
                }
                pendingSyncTimeoutId.current = null;
            }
            // Cancel any pending metadata wait
            if (waitDisposerRef.current) {
                try {
                    waitDisposerRef.current();
                } catch {
                    // ignore
                }
                waitDisposerRef.current = null;
            }

            // Clean up all metadata wait disposers that were queued
            if (activeMetadataWaitDisposers.size > 0) {
                for (const dispose of activeMetadataWaitDisposers) {
                    try {
                        dispose();
                    } catch {
                        // ignore errors during cleanup
                    }
                }
                activeMetadataWaitDisposers.clear();
            }
        };
    }, [
        app,
        api,
        isIndexedDBReady,
        getFilteredMarkdownFilesCallback,
        rebuildTagTree,
        rebuildTopicTree,
        settings,
        waitForMetadataCache,
        queueTagsWhenMetadataReady
    ]);

    /**
     * Effect: Handle settings changes and exclusion updates
     *
     * This effect monitors for two types of changes:
     * 1. Content settings (preview, images, metadata) - handled by ContentProviderRegistry
     * 2. Exclusion settings (excluded folders/files) - requires cache resync
     *
     * When exclusions change, we must:
     * - Recalculate which files should be in the cache
     * - Add newly included files
     * - Remove newly excluded files
     * - Rebuild tag tree with new exclusion rules
     */
    useEffect(() => {
        // Skip on initial mount
        if (!prevSettings.current) {
            prevSettings.current = settings;
            return;
        }

        // Let content providers handle settings changes
        handleSettingsChanges(prevSettings.current, settings);

        // Detect exclusion setting changes and resync cache / tag tree
        const excludedFoldersChanged = JSON.stringify(prevSettings.current.excludedFolders) !== JSON.stringify(settings.excludedFolders);
        const excludedFilesChanged = JSON.stringify(prevSettings.current.excludedFiles) !== JSON.stringify(settings.excludedFiles);

        if (excludedFoldersChanged || excludedFilesChanged) {
            (async () => {
                try {
                    const allFiles = getFilteredMarkdownFilesCallback();
                    const { toAdd, toUpdate, toRemove, cachedFiles } = await calculateFileDiff(allFiles);

                    if (toRemove.length > 0) {
                        await removeFilesFromCache(toRemove);
                    }

                    if (toAdd.length > 0 || toUpdate.length > 0) {
                        await recordFileChanges([...toAdd, ...toUpdate], cachedFiles, pendingRenameDataRef.current);
                    }

                    // Always rebuild tag tree so folder exclusion rule changes take effect immediately
                    if (settings.showTags) {
                        rebuildTagTree();
                    }
                    if (settings.showTopics) {
                        rebuildTopicTree();
                    }

                    // Queue content generation for newly added/updated items if needed
                    const contentEnabled =
                        settings.showTags || settings.showFilePreview || settings.showFeatureImage || settings.useFrontmatterMetadata;

                    if (contentRegistry.current && contentEnabled) {
                        const db = getDBInstance();
                        let filesToProcess: TFile[] = [];

                        try {
                            const filesToCheck = [...toAdd, ...toUpdate];
                            const paths = filesToCheck.map(f => f.path);
                            const indexedFiles = db.getFiles(paths);

                            filesToProcess = filesToCheck.filter(file => {
                                const fileData = indexedFiles.get(file.path);
                                if (!fileData) return true;
                                if (fileData.mtime !== file.stat.mtime) return true;
                                const needsContent =
                                    (settings.showFilePreview && fileData.preview === null && file.extension === 'md') ||
                                    (settings.showFeatureImage && fileData.featureImage === null) ||
                                    (settings.useFrontmatterMetadata && fileData.metadata === null && file.extension === 'md');
                                return needsContent;
                            });

                            if (filesToProcess.length === 0) {
                                const filesNeedingTags = settings.showTags ? db.getFilesNeedingContent('tags') : new Set<string>();
                                const filesNeedingPreview = settings.showFilePreview
                                    ? db.getFilesNeedingContent('preview')
                                    : new Set<string>();
                                const filesNeedingImage = settings.showFeatureImage
                                    ? db.getFilesNeedingContent('featureImage')
                                    : new Set<string>();
                                const filesNeedingMetadata = settings.useFrontmatterMetadata
                                    ? db.getFilesNeedingContent('metadata')
                                    : new Set<string>();

                                const pathsNeedingContent = new Set([
                                    ...filesNeedingTags,
                                    ...filesNeedingPreview,
                                    ...filesNeedingImage,
                                    ...filesNeedingMetadata
                                ]);

                                if (pathsNeedingContent.size > 0) {
                                    filesToProcess = allFiles.filter(file => pathsNeedingContent.has(file.path));
                                }
                            }
                        } catch (err) {
                            console.error('Failed to check content needs from IndexedDB:', err);
                        }

                        if (filesToProcess.length > 0) {
                            const options = settings.showTags ? { exclude: ['tags'] as ContentType[] } : undefined;
                            contentRegistry.current.queueFilesForAllProviders(filesToProcess, settings, options);
                            if (settings.showTags) {
                                queueTagsWhenMetadataReady(filesToProcess);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error resyncing cache after exclusion changes:', error);
                }
            })();
        }

        prevSettings.current = settings;
    }, [settings, handleSettingsChanges, rebuildTagTree, rebuildTopicTree, getFilteredMarkdownFilesCallback, queueTagsWhenMetadataReady]);

    /**
     * Augment context with control methods
     *
     * Adds the stopAllProcessing method to the context value.
     * This method is called when:
     * - The view is being closed
     * - The plugin is being disabled
     * - A cache rebuild is starting (to stop current operations)
     *
     * It ensures clean shutdown by:
     * - Stopping all content providers
     * - Cancelling pending operations
     * - Detaching event listeners
     * - Preventing any new operations from starting
     */
    const contextWithControls = useMemo(() => {
        return {
            ...contextValue,
            stopAllProcessing: () => {
                // Mark stopped to gate any subsequent event handlers
                stoppedRef.current = true;
                // Stop all provider processing
                if (contentRegistry.current) {
                    contentRegistry.current.stopAllProcessing();
                }
                // Cancel any pending scheduled work initiated by StorageContext
                if (pendingSyncTimeoutId.current !== null) {
                    if (typeof window !== 'undefined') {
                        window.clearTimeout(pendingSyncTimeoutId.current);
                    }
                    pendingSyncTimeoutId.current = null;
                }
                // Optionally detach event subscriptions and cancel debouncers
                try {
                    if (activeVaultEventRefs.current) {
                        activeVaultEventRefs.current.forEach(ref => app.vault.offref(ref));
                        activeVaultEventRefs.current = null;
                    }
                    if (activeMetadataEventRef.current) {
                        app.metadataCache.offref(activeMetadataEventRef.current);
                        activeMetadataEventRef.current = null;
                    }
                } catch {
                    // ignore
                }
                try {
                    rebuildFileCacheRef.current?.cancel();
                } catch {
                    // ignore
                }
                rebuildFileCacheRef.current = null;
                // Cancel any pending metadata cache wait
                if (waitDisposerRef.current) {
                    try {
                        waitDisposerRef.current();
                    } catch {
                        // ignore
                    }
                    waitDisposerRef.current = null;
                }
                // Clean up all tracked metadata wait disposers on shutdown
                if (metadataWaitDisposersRef.current.size > 0) {
                    for (const dispose of metadataWaitDisposersRef.current) {
                        try {
                            dispose();
                        } catch {
                            // ignore errors during cleanup
                        }
                    }
                    metadataWaitDisposersRef.current.clear();
                }
                pendingTagMetadataPathsRef.current.clear();
            }
        };
    }, [contextValue, app.vault, app.metadataCache]);

    return <StorageContext.Provider value={contextWithControls}>{children}</StorageContext.Provider>;
}

/**
 * Hook to access file cache and file data
 *
 * Returns:
 * - fileData: Contains the tag tree and untagged file count
 * - Methods to get file metadata from frontmatter
 */
export function useFileCache() {
    const context = useContext(StorageContext);
    if (!context) {
        throw new Error('useFileCache must be used within StorageProvider');
    }
    return context;
}
