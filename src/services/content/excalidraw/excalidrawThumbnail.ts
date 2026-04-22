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

import { App, TFile } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { LIMITS } from '../../../constants/limits';
import { isRecord } from '../../../utils/typeGuards';
import { createOnceLogger, createRenderLimiter } from '../thumbnail/thumbnailRuntimeUtils';

export interface ExcalidrawThumbnailOptions {
    scale?: number;
    padding?: number;
}

interface ExcalidrawScene {
    elements: object[];
}

interface ExcalidrawAutomateApi {
    setView?: (view: object) => void;
    getSceneFromFile: (file: TFile) => Promise<ExcalidrawScene>;
    copyViewElementsToEAforEditing: (elements: object[], includeFiles: boolean) => Promise<void>;
    getEmbeddedFilesLoader: (isDark: boolean) => object;
    getExportSettings: (includeBackground: boolean, includeTheme: boolean) => object;
    createPNG: (
        view: undefined,
        scale: number,
        exportSettings: object,
        embeddedFilesLoader: object,
        theme: undefined,
        padding: number
    ) => Promise<Blob | null>;
    destroy: () => void;
}

interface ExcalidrawAutomateGlobal {
    getAPI: () => ExcalidrawAutomateApi;
}

// Excalidraw renders must be serialized to avoid conflicts with its global state
const MAX_PARALLEL_EXCALIDRAW_RENDERS = LIMITS.thumbnails.excalidraw.maxParallelRenders;
const DEFAULT_EXCALIDRAW_EXPORT_SCALE = LIMITS.thumbnails.excalidraw.exportScale.default;
const MIN_EXCALIDRAW_EXPORT_SCALE = LIMITS.thumbnails.excalidraw.exportScale.min;
const MAX_EXCALIDRAW_EXPORT_DIMENSION_PX = LIMITS.thumbnails.excalidraw.maxExportDimensionPx;
const renderLimiter = createRenderLimiter(MAX_PARALLEL_EXCALIDRAW_RENDERS);
const logOnce = createOnceLogger();

// Type guard for the ExcalidrawAutomate global object
function isExcalidrawAutomateGlobal(value: unknown): value is ExcalidrawAutomateGlobal {
    if (!isRecord(value)) {
        return false;
    }
    const getApi: unknown = value['getAPI'];
    return typeof getApi === 'function';
}

// Checks if Obsidian is using dark theme based on body class
function isDarkThemeActive(): boolean {
    if (typeof document === 'undefined') {
        return false;
    }
    return document.body.classList.contains('theme-dark');
}

// Constrains a value to the specified range
function clampNumber(value: number, min: number, max: number): number {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

// Extracts a finite number from a record property, returning null if invalid
function getFiniteNumber(record: Record<string, unknown>, key: string): number | null {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return value;
}

// Calculates the bounding box dimensions for all scene elements
function computeSceneBounds(elements: object[]): { width: number; height: number } | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;

    for (const element of elements) {
        if (!isRecord(element)) {
            continue;
        }

        const x = getFiniteNumber(element, 'x');
        const y = getFiniteNumber(element, 'y');
        const width = getFiniteNumber(element, 'width');
        const height = getFiniteNumber(element, 'height');

        if (x === null || y === null || width === null || height === null) {
            continue;
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
        found = true;
    }

    if (!found) {
        return null;
    }

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight) || boundsWidth <= 0 || boundsHeight <= 0) {
        return null;
    }

    return { width: boundsWidth, height: boundsHeight };
}

// Searches for an open Excalidraw view displaying the specified file
function findActiveLeafViewForFile(app: App, file: TFile): object | null {
    const workspace = app.workspace;
    if (!workspace || typeof workspace.iterateAllLeaves !== 'function') {
        return null;
    }

    let matched: object | null = null;
    try {
        workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
            if (matched) {
                return;
            }

            const view: unknown = Reflect.get(leaf as object, 'view');
            if (!isRecord(view)) {
                return;
            }
            const viewFile: unknown = view['file'];
            if (!isRecord(viewFile)) {
                return;
            }
            const path: unknown = viewFile['path'];
            if (path !== file.path) {
                return;
            }
            matched = view;
        });
    } catch {
        return null;
    }

    return matched;
}

// Attempts to set the active view for embedded file access during export
function trySetTargetView(excalidrawApi: ExcalidrawAutomateApi, app: App, file: TFile): boolean {
    if (typeof excalidrawApi.setView !== 'function') {
        return false;
    }

    const view = findActiveLeafViewForFile(app, file);
    if (!view) {
        return false;
    }

    try {
        excalidrawApi.setView(view);
        return true;
    } catch {
        return false;
    }
}

// Renders an Excalidraw file as a PNG thumbnail using ExcalidrawAutomate
export async function renderExcalidrawThumbnail(app: App, excalidrawFile: TFile, opts?: ExcalidrawThumbnailOptions): Promise<Blob | null> {
    const release = await renderLimiter.acquire();

    let excalidrawApi: ExcalidrawAutomateApi | null = null;

    try {
        const automateValue: unknown = Reflect.get(globalThis, 'ExcalidrawAutomate');
        if (!isExcalidrawAutomateGlobal(automateValue)) {
            return null;
        }

        try {
            excalidrawApi = automateValue.getAPI();
        } catch (error: unknown) {
            logOnce('excalidraw-thumbnail:get-api', '[Excalidraw thumbnail] Failed to get ExcalidrawAutomate API', error);
            return null;
        }

        const scene = await excalidrawApi.getSceneFromFile(excalidrawFile);
        if (!scene || !Array.isArray(scene.elements)) {
            return null;
        }

        if (scene.elements.length === 0) {
            return null;
        }

        const hasTargetView = trySetTargetView(excalidrawApi, app, excalidrawFile);

        try {
            await excalidrawApi.copyViewElementsToEAforEditing(scene.elements, hasTargetView);
        } catch (error: unknown) {
            if (!hasTargetView) {
                throw error;
            }
            // Fallback for ExcalidrawAutomate builds where copyViewElementsToEAforEditing requires an active view.
            await excalidrawApi.copyViewElementsToEAforEditing(scene.elements, false);
        }

        const isDark = isDarkThemeActive();
        const loader = excalidrawApi.getEmbeddedFilesLoader(isDark);
        const exportSettings = excalidrawApi.getExportSettings(true, true);
        const padding = typeof opts?.padding === 'number' && Number.isFinite(opts.padding) ? opts.padding : 0;
        const maxScale =
            typeof opts?.scale === 'number' && Number.isFinite(opts.scale) && opts.scale > 0 ? opts.scale : DEFAULT_EXCALIDRAW_EXPORT_SCALE;

        const bounds = computeSceneBounds(scene.elements);
        const scale = (() => {
            if (!bounds) {
                const fallbackScale = Math.min(maxScale, DEFAULT_EXCALIDRAW_EXPORT_SCALE);
                return Number.isFinite(fallbackScale) && fallbackScale > 0 ? fallbackScale : null;
            }

            const widthScale = MAX_EXCALIDRAW_EXPORT_DIMENSION_PX / bounds.width;
            const heightScale = MAX_EXCALIDRAW_EXPORT_DIMENSION_PX / bounds.height;
            const computed = Math.min(maxScale, widthScale, heightScale);
            if (!Number.isFinite(computed) || computed <= 0) {
                return null;
            }
            if (computed < MIN_EXCALIDRAW_EXPORT_SCALE) {
                return null;
            }
            return clampNumber(computed, 0, maxScale);
        })();

        if (scale === null) {
            return null;
        }

        return await excalidrawApi.createPNG(undefined, scale, exportSettings, loader, undefined, padding);
    } catch (error: unknown) {
        logOnce(`excalidraw-thumbnail:${excalidrawFile.path}`, `[Excalidraw thumbnail] Failed to render: ${excalidrawFile.path}`, error);
        return null;
    } finally {
        try {
            excalidrawApi?.destroy();
        } catch {
            // ignore
        }
        release();
    }
}
