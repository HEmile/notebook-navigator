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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TFile } from 'obsidian';
import type { IndexedDBStorage } from '../../storage/IndexedDBStorage';
import { runAsyncAction } from '../../utils/async';

interface UseCalendarFeatureImagesOptions {
    db: IndexedDBStorage | null;
    showFeatureImages: boolean;
    targets: CalendarFeatureImageTarget[];
    maxConcurrentLoads: number;
}

interface FeatureImageUrlEntry {
    key: string;
    url: string;
}

export interface CalendarFeatureImageTarget {
    id: string;
    file: TFile;
    key: string;
}

export function useCalendarFeatureImages({
    db,
    showFeatureImages,
    targets,
    maxConcurrentLoads
}: UseCalendarFeatureImagesOptions): Record<string, string> {
    const featureImageUrlMapRef = useRef<Map<string, FeatureImageUrlEntry>>(new Map());
    const [featureImageUrls, setFeatureImageUrls] = useState<Record<string, string>>({});

    const clearFeatureImageUrls = useCallback((resetState: boolean) => {
        const existing = featureImageUrlMapRef.current;
        if (existing.size === 0) {
            if (resetState) {
                setFeatureImageUrls(previous => (Object.keys(previous).length === 0 ? previous : {}));
            }
            return;
        }

        for (const entry of existing.values()) {
            URL.revokeObjectURL(entry.url);
        }
        existing.clear();

        if (resetState) {
            setFeatureImageUrls(previous => (Object.keys(previous).length === 0 ? previous : {}));
        }
    }, []);

    useEffect(() => {
        return () => {
            // Always release object URLs on unmount to avoid leaking blobs.
            clearFeatureImageUrls(false);
        };
    }, [clearFeatureImageUrls]);

    useEffect(() => {
        let isActive = true;

        if (!db || !showFeatureImages) {
            clearFeatureImageUrls(true);
            return () => {
                isActive = false;
            };
        }

        const previousMap = featureImageUrlMapRef.current;
        const nextMap = new Map<string, FeatureImageUrlEntry>();
        const createdUrls: string[] = [];

        const fetchUrls = async () => {
            try {
                const resolveEntry = async (entry: CalendarFeatureImageTarget) => {
                    // Reuse existing object URLs when the feature image key is unchanged for that target.
                    const existing = previousMap.get(entry.id);
                    if (existing && existing.key === entry.key) {
                        nextMap.set(entry.id, existing);
                        return;
                    }

                    let blob: Blob | null = null;
                    try {
                        blob = await db.getFeatureImageBlob(entry.file.path, entry.key);
                    } catch {
                        return;
                    }

                    if (!blob) {
                        return;
                    }

                    const url = URL.createObjectURL(blob);
                    createdUrls.push(url);
                    nextMap.set(entry.id, { key: entry.key, url });
                };

                const workerCount = Math.min(Math.max(1, maxConcurrentLoads), targets.length || 1);
                let nextIndex = 0;
                const workers: Promise<void>[] = [];
                for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
                    workers.push(
                        (async () => {
                            while (true) {
                                const currentIndex = nextIndex;
                                nextIndex += 1;
                                if (currentIndex >= targets.length) {
                                    return;
                                }

                                await resolveEntry(targets[currentIndex]);
                            }
                        })()
                    );
                }

                await Promise.all(workers);

                if (!isActive) {
                    // Component was unmounted while blobs were loading; release newly created URLs.
                    createdUrls.forEach(url => URL.revokeObjectURL(url));
                    return;
                }

                // Release URLs that are no longer referenced by the next map.
                for (const [iso, entry] of previousMap.entries()) {
                    const next = nextMap.get(iso);
                    if (!next || next.url !== entry.url) {
                        URL.revokeObjectURL(entry.url);
                    }
                }

                featureImageUrlMapRef.current = nextMap;
                setFeatureImageUrls(Object.fromEntries([...nextMap.entries()].map(([iso, entry]) => [iso, entry.url])));
            } catch (error) {
                createdUrls.forEach(url => URL.revokeObjectURL(url));
                if (isActive) {
                    console.error('Failed to load calendar feature images', error);
                }
            }
        };

        runAsyncAction(() => fetchUrls());

        return () => {
            isActive = false;
        };
    }, [clearFeatureImageUrls, db, maxConcurrentLoads, showFeatureImages, targets]);

    return featureImageUrls;
}
