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

import { useCallback, useRef, type RefObject } from 'react';
import { TFile, type App } from 'obsidian';
import type { FileContentType } from '../../interfaces/IContentProvider';
import { strings } from '../../i18n';
import { getDBInstance } from '../../storage/fileOperations';
import { showNotice } from '../../utils/noticeUtils';
import { isMarkdownPath } from '../../utils/fileTypeUtils';

const CACHE_REBUILD_NOTICE_DELAY_MS = 500;
const CACHE_REBUILD_PROGRESS_POLL_INTERVAL_MS = 2_000;
const CACHE_REBUILD_INITIAL_WAIT_TIMEOUT_MS = 60_000;
const CACHE_REBUILD_EMPTY_TICK_THRESHOLD = 2;
const CACHE_REBUILD_MAX_NOTICE_RECREATE_ATTEMPTS = 2;

/**
 * Shows a persistent notice with a progress bar during a cache rebuild.
 *
 * The rebuild itself is performed by other hooks. This hook only:
 * - Creates a notice UI with a progress element.
 * - Periodically scans the database to estimate how much derived content remains.
 * - Hides the notice once the tracked content types no longer have pending work.
 *
 * The polling interval is intentionally coarse because scanning the cache is O(number of files).
 */
export function useCacheRebuildNotice(params: { app: App; stoppedRef: RefObject<boolean>; onRebuildComplete?: () => void }): {
    clearCacheRebuildNotice: () => void;
    startCacheRebuildNotice: (total: number, enabledTypes: FileContentType[]) => void;
} {
    const { app, stoppedRef, onRebuildComplete } = params;

    const cacheRebuildNoticeRef = useRef<ReturnType<typeof showNotice> | null>(null);
    const cacheRebuildIntervalRef = useRef<number | null>(null);
    // Tracks the delayed start so it can be cancelled when a run is replaced or stopped.
    const cacheRebuildStartTimeoutRef = useRef<number | null>(null);
    // Increments each time notice tracking is cleared, invalidating stale callbacks from older runs.
    const cacheRebuildRunTokenRef = useRef(0);
    const noticeRecreateAttemptsRef = useRef(0);

    const clearCacheRebuildNotice = useCallback(() => {
        cacheRebuildRunTokenRef.current += 1;

        if (cacheRebuildStartTimeoutRef.current !== null) {
            if (typeof window !== 'undefined') {
                window.clearTimeout(cacheRebuildStartTimeoutRef.current);
            }
            cacheRebuildStartTimeoutRef.current = null;
        }
        if (cacheRebuildIntervalRef.current !== null) {
            if (typeof window !== 'undefined') {
                window.clearInterval(cacheRebuildIntervalRef.current);
            }
            cacheRebuildIntervalRef.current = null;
        }
        if (cacheRebuildNoticeRef.current) {
            try {
                cacheRebuildNoticeRef.current.hide();
            } catch {
                // ignore
            }
            cacheRebuildNoticeRef.current = null;
        }
        noticeRecreateAttemptsRef.current = 0;
    }, []);

    const startCacheRebuildNotice = useCallback(
        (total: number, enabledTypes: FileContentType[]) => {
            clearCacheRebuildNotice();

            if (stoppedRef.current || typeof window === 'undefined' || total <= 0 || enabledTypes.length === 0) {
                return;
            }

            const runToken = cacheRebuildRunTokenRef.current;
            const title = strings.settings.items.rebuildCache.indexingTitle;
            const description = strings.settings.items.rebuildCache.progress;
            const trackPreview = enabledTypes.includes('preview');
            const trackTags = enabledTypes.includes('tags');
            const trackFeatureImage = enabledTypes.includes('featureImage');
            const trackMetadata = enabledTypes.includes('metadata');
            const trackWordCount = enabledTypes.includes('wordCount');
            const trackTasks = enabledTypes.includes('tasks');
            const trackProperties = enabledTypes.includes('properties');

            let progressBarEl: HTMLProgressElement | null = null;
            let lastProgressValue: number | null = null;
            let lastProgressMax: number | null = null;
            let maxTotal = Math.max(0, total);

            const clampProgress = (value: number): number => {
                return Math.min(maxTotal, Math.max(0, value));
            };

            const updateProgress = (value: number): void => {
                const nextValue = clampProgress(value);

                if (!progressBarEl) {
                    return;
                }

                if (lastProgressValue === nextValue && lastProgressMax === maxTotal) {
                    return;
                }

                lastProgressValue = nextValue;
                lastProgressMax = maxTotal;

                progressBarEl.max = maxTotal;
                progressBarEl.value = nextValue;
            };

            const createCacheRebuildNotice = (): void => {
                lastProgressValue = null;
                lastProgressMax = null;

                const fragment = document.createDocumentFragment();
                const wrapper = fragment.createDiv({ cls: 'nn-cache-rebuild-notice' });
                wrapper.createDiv({ cls: 'nn-cache-rebuild-notice-title', text: title });
                wrapper.createDiv({ cls: 'nn-cache-rebuild-notice-description', text: description });

                progressBarEl = wrapper.createEl('progress', { cls: 'nn-cache-rebuild-notice-progress-bar' });

                const notice = showNotice(fragment, { timeout: 0 });
                notice.containerEl.addClass('nn-cache-rebuild-notice-container');
                notice.messageEl.addClass('nn-cache-rebuild-notice-message');
                cacheRebuildNoticeRef.current = notice;
            };

            const db = getDBInstance();
            let hasSeenPending = false;
            let emptyTicks = 0;
            const startedAt = Date.now();
            // If the database never reports pending work (or metadata cache never becomes available), avoid leaving
            // a sticky notice on screen forever.
            const maxInitialWaitMs = CACHE_REBUILD_INITIAL_WAIT_TIMEOUT_MS;

            noticeRecreateAttemptsRef.current = 0;

            const pollCacheRebuildProgress = (): void => {
                if (stoppedRef.current) {
                    clearCacheRebuildNotice();
                    return;
                }

                if (cacheRebuildRunTokenRef.current !== runToken) {
                    return;
                }

                const getFileByPath = (path: string): TFile | null => {
                    const abstract = app.vault.getAbstractFileByPath(path);
                    if (!(abstract instanceof TFile)) {
                        return null;
                    }
                    return abstract;
                };

                let readyRemainingCount = 0;
                let rawRemainingCount = 0;

                db.forEachFile((path, data) => {
                    const isMarkdown = isMarkdownPath(path);
                    const needsPreview = trackPreview && isMarkdown && data.previewStatus === 'unprocessed';
                    const needsTags = trackTags && isMarkdown && data.tags === null;
                    const needsFeatureImage =
                        trackFeatureImage && (data.featureImageKey === null || data.featureImageStatus === 'unprocessed');
                    const needsMetadata = trackMetadata && isMarkdown && data.metadata === null;
                    const needsWordCount = trackWordCount && isMarkdown && data.wordCount === null;
                    const needsTasks = trackTasks && isMarkdown && (data.taskTotal === null || data.taskUnfinished === null);
                    const needsProperties = trackProperties && isMarkdown && data.properties === null;

                    if (
                        !needsPreview &&
                        !needsTags &&
                        !needsFeatureImage &&
                        !needsMetadata &&
                        !needsWordCount &&
                        !needsTasks &&
                        !needsProperties
                    ) {
                        return;
                    }

                    // `rawRemainingCount` counts everything still missing, even if it can't be processed yet because
                    // Obsidian metadata hasn't been indexed for the file.
                    rawRemainingCount += 1;

                    const readyWithoutMetadata = needsFeatureImage && !isMarkdown;
                    if (readyWithoutMetadata) {
                        readyRemainingCount += 1;
                        return;
                    }

                    const file = getFileByPath(path);
                    if (!file) {
                        return;
                    }

                    const hasMetadataCache = Boolean(app.metadataCache.getFileCache(file));
                    const isMetadataReady =
                        hasMetadataCache &&
                        (needsPreview ||
                            needsWordCount ||
                            needsTasks ||
                            needsProperties ||
                            (needsFeatureImage && isMarkdown) ||
                            needsTags ||
                            needsMetadata);

                    if (isMetadataReady) {
                        // Track only work that can be queued immediately. Before metadata is ready, providers that
                        // depend on metadata cache entries are intentionally gated.
                        readyRemainingCount += 1;
                    }
                });

                if (rawRemainingCount > maxTotal) {
                    maxTotal = rawRemainingCount;
                }

                const elapsedMs = Date.now() - startedAt;
                const shouldShowNotice = elapsedMs >= CACHE_REBUILD_NOTICE_DELAY_MS && rawRemainingCount > 0;
                if (shouldShowNotice && !cacheRebuildNoticeRef.current) {
                    createCacheRebuildNotice();
                }

                const notice = cacheRebuildNoticeRef.current;
                const container = notice?.containerEl;
                if (notice && (!container || !container.isConnected)) {
                    if (noticeRecreateAttemptsRef.current < CACHE_REBUILD_MAX_NOTICE_RECREATE_ATTEMPTS) {
                        noticeRecreateAttemptsRef.current += 1;
                        createCacheRebuildNotice();
                    }
                } else if (notice && noticeRecreateAttemptsRef.current !== 0) {
                    noticeRecreateAttemptsRef.current = 0;
                }

                if (readyRemainingCount > 0) {
                    hasSeenPending = true;
                    emptyTicks = 0;
                }

                if (!hasSeenPending) {
                    if (Date.now() - startedAt >= maxInitialWaitMs) {
                        clearCacheRebuildNotice();
                        return;
                    }

                    if (rawRemainingCount === 0) {
                        emptyTicks += 1;
                        // Require a couple of consecutive empty ticks before hiding the notice. This avoids flicker
                        // if the rebuild is still seeding the database.
                        if (emptyTicks >= CACHE_REBUILD_EMPTY_TICK_THRESHOLD) {
                            if (db.getFileCount() > 0) {
                                // Let callers clear persisted rebuild state only after the database has been seeded.
                                onRebuildComplete?.();
                                clearCacheRebuildNotice();
                                return;
                            }
                        }
                    }
                    updateProgress(0);
                    return;
                }

                const done = Math.max(0, maxTotal - rawRemainingCount);
                updateProgress(done);

                if (rawRemainingCount === 0) {
                    // Notify completion so callers can clear any persisted rebuild markers.
                    onRebuildComplete?.();
                    clearCacheRebuildNotice();
                }
            };

            // Delay the first poll so short rebuilds can finish without showing the persistent notice.
            cacheRebuildStartTimeoutRef.current = window.setTimeout(() => {
                if (stoppedRef.current || cacheRebuildRunTokenRef.current !== runToken) {
                    return;
                }

                cacheRebuildStartTimeoutRef.current = null;
                pollCacheRebuildProgress();

                if (stoppedRef.current || cacheRebuildRunTokenRef.current !== runToken) {
                    return;
                }

                cacheRebuildIntervalRef.current = window.setInterval(pollCacheRebuildProgress, CACHE_REBUILD_PROGRESS_POLL_INTERVAL_MS);
            }, CACHE_REBUILD_NOTICE_DELAY_MS);
        },
        [app.metadataCache, app.vault, clearCacheRebuildNotice, onRebuildComplete, stoppedRef]
    );

    return { clearCacheRebuildNotice, startCacheRebuildNotice };
}
