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

import { useEffect, type RefObject } from 'react';
import type { App } from 'obsidian';
import { ContentProviderRegistry } from '../../services/content/ContentProviderRegistry';
import { ContentReadCache } from '../../services/content/ContentReadCache';
import { MarkdownPipelineContentProvider } from '../../services/content/MarkdownPipelineContentProvider';
import { createFeatureImageThumbnailRuntime, FeatureImageContentProvider } from '../../services/content/FeatureImageContentProvider';
import { MetadataContentProvider } from '../../services/content/MetadataContentProvider';
import { TagContentProvider } from '../../services/content/TagContentProvider';

/**
 * Creates and tears down the `ContentProviderRegistry` used by `StorageContext`.
 *
 * The registry owns background queues that generate derived content (preview text, feature images, tags, metadata).
 * It is stored in a ref so that:
 * - Event handlers and async callbacks can always reach the current registry instance.
 * - We can stop processing synchronously during teardown without waiting for a render cycle.
 *
 * Providers are registered once per `App` instance to avoid duplicating background queues when the view remounts.
 */
export function useInitializeContentProviderRegistry(params: {
    app: App;
    contentRegistryRef: RefObject<ContentProviderRegistry | null>;
    pendingSyncTimeoutIdRef: RefObject<number | null>;
    clearCacheRebuildNotice: () => void;
}): void {
    const { app, contentRegistryRef, pendingSyncTimeoutIdRef, clearCacheRebuildNotice } = params;

    useEffect(() => {
        // Only create the registry once per app instance. `StorageContext` may mount/unmount with the view,
        // but providers should not be duplicated across mounts.
        if (!contentRegistryRef.current) {
            const readCache = new ContentReadCache(app);
            const thumbnailRuntime = createFeatureImageThumbnailRuntime();

            contentRegistryRef.current = new ContentProviderRegistry();
            contentRegistryRef.current.registerProvider(new MarkdownPipelineContentProvider(app, readCache, thumbnailRuntime));
            contentRegistryRef.current.registerProvider(new FeatureImageContentProvider(app, readCache, thumbnailRuntime));
            contentRegistryRef.current.registerProvider(new MetadataContentProvider(app));
            contentRegistryRef.current.registerProvider(new TagContentProvider(app));
        }

        return () => {
            // The rebuild notice is UI state owned by `StorageContext`, but its timer lives in this module.
            // Always clear it during teardown so the interval does not keep running after the view is closed.
            clearCacheRebuildNotice();

            if (contentRegistryRef.current) {
                // Stops provider queues and cancels any in-flight tasks.
                contentRegistryRef.current.stopAllProcessing();
                contentRegistryRef.current = null;
            }

            // Cancel any pending deferred storage sync as an extra safeguard during teardown.
            if (pendingSyncTimeoutIdRef.current !== null) {
                if (typeof window !== 'undefined') {
                    window.clearTimeout(pendingSyncTimeoutIdRef.current);
                }
                pendingSyncTimeoutIdRef.current = null;
            }
        };
    }, [app, clearCacheRebuildNotice, contentRegistryRef, pendingSyncTimeoutIdRef]);
}
