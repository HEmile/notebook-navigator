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

import { App, TFile, normalizePath } from 'obsidian';
import {
    EXCALIDRAW_BASENAME_SUFFIX,
    hasExcalidrawFrontmatterFlagValue,
    isExcalidrawFile,
    isTruthyFrontmatterFlagValue
} from './fileNameUtils';
import { getCurrentThemeMode, type ThemeMode } from './themeMode';
import type { NotebookNavigatorSettings } from '../settings/types';

const EXCALIDRAW_COMPANION_IMAGE_EXTENSIONS = ['png', 'dark.png', 'light.png'] as const;
const DRAWING_DIRECT_FEATURE_IMAGE_KEY_PREFIX = 'd:';
const TLDRAW_FRONTMATTER_KEY = 'tldraw-file';

export type DrawingFeatureImageProviderId = 'excalidraw' | 'tldraw';

export interface DrawingFeatureImageSource {
    providerId: DrawingFeatureImageProviderId;
    iconId: string;
    showsFeatureImageBox: boolean;
    supportsCompanionImages: boolean;
}

type DrawingFeatureImageListener = () => void;

interface DrawingFeatureImageProvider {
    id: DrawingFeatureImageProviderId;
    iconId: string;
    showsFeatureImageBox: boolean;
    companionImageExtensions: readonly string[];
    getCompanionImagePath: (file: Pick<TFile, 'path'>, extension: string) => string | null;
    getSourcePathCandidatesForCompanionBasePath: (basePath: string) => string[];
    isSourceFileWithFrontmatter: (file: TFile, frontmatter: unknown) => boolean;
}

const featureImageListenersBySourcePath = new Map<string, Set<DrawingFeatureImageListener>>();

function getPathWithoutFinalExtension(path: string): string | null {
    const dotIndex = path.lastIndexOf('.');
    if (dotIndex <= 0) {
        return null;
    }
    return path.slice(0, dotIndex);
}

function getFileByPath(app: App, path: string): TFile | null {
    const abstractFile = app.vault.getAbstractFileByPath(normalizePath(path));
    return abstractFile instanceof TFile ? abstractFile : null;
}

function hasTldrawFrontmatterFlagValue(frontmatter: unknown): boolean {
    if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
        return false;
    }

    return isTruthyFrontmatterFlagValue((frontmatter as Record<string, unknown>)[TLDRAW_FRONTMATTER_KEY]);
}

function isExcalidrawSourceFileWithFrontmatter(file: TFile, frontmatter: unknown): boolean {
    if (file.extension === 'md') {
        if (isExcalidrawFile(file)) {
            return true;
        }
        return hasExcalidrawFrontmatterFlagValue(frontmatter);
    }

    return file.name.toLowerCase().endsWith(EXCALIDRAW_BASENAME_SUFFIX);
}

function isTldrawSourceFileWithFrontmatter(file: TFile, frontmatter: unknown): boolean {
    const extension = file.extension.toLowerCase();
    if (extension === 'tldr') {
        return true;
    }

    return extension === 'md' && hasTldrawFrontmatterFlagValue(frontmatter);
}

function getCompanionBasePath(path: string): string | null {
    const lowerPath = path.toLowerCase();
    for (const extension of ['.dark.png', '.light.png', '.png']) {
        if (lowerPath.endsWith(extension)) {
            return path.slice(0, -extension.length);
        }
    }
    return null;
}

function getCompanionImagePathFromFinalExtension(file: Pick<TFile, 'path'>, extension: string): string | null {
    const basePath = getPathWithoutFinalExtension(file.path);
    return basePath ? `${basePath}.${extension}` : null;
}

const DRAWING_FEATURE_IMAGE_PROVIDERS: readonly DrawingFeatureImageProvider[] = Object.freeze([
    {
        id: 'excalidraw',
        iconId: 'excalidraw-icon',
        showsFeatureImageBox: true,
        companionImageExtensions: EXCALIDRAW_COMPANION_IMAGE_EXTENSIONS,
        getCompanionImagePath: getCompanionImagePathFromFinalExtension,
        getSourcePathCandidatesForCompanionBasePath: basePath =>
            basePath.toLowerCase().endsWith(EXCALIDRAW_BASENAME_SUFFIX)
                ? [`${basePath}.md`, basePath]
                : [`${basePath}.md`, `${basePath}${EXCALIDRAW_BASENAME_SUFFIX}`],
        isSourceFileWithFrontmatter: isExcalidrawSourceFileWithFrontmatter
    },
    {
        id: 'tldraw',
        iconId: 'brush',
        showsFeatureImageBox: true,
        companionImageExtensions: [],
        getCompanionImagePath: getCompanionImagePathFromFinalExtension,
        getSourcePathCandidatesForCompanionBasePath: basePath => [`${basePath}.md`, `${basePath}.tldr`],
        isSourceFileWithFrontmatter: isTldrawSourceFileWithFrontmatter
    }
]);

function getThemePreferredExtensions(provider: DrawingFeatureImageProvider, themeMode: ThemeMode): readonly string[] {
    const extensions = provider.companionImageExtensions;
    if (extensions.length === 0) {
        return extensions;
    }

    const preferred = themeMode === 'dark' ? 'dark.png' : 'light.png';
    const fallback = themeMode === 'dark' ? 'light.png' : 'dark.png';
    if (!extensions.includes(preferred) || !extensions.includes(fallback) || !extensions.includes('png')) {
        return extensions;
    }

    return [preferred, 'png', fallback];
}

function getDrawingFeatureImageProviderById(providerId: DrawingFeatureImageProviderId): DrawingFeatureImageProvider {
    return DRAWING_FEATURE_IMAGE_PROVIDERS.find(provider => provider.id === providerId) ?? DRAWING_FEATURE_IMAGE_PROVIDERS[0];
}

function getDrawingFeatureImageProviderWithFrontmatter(file: TFile, frontmatter: unknown): DrawingFeatureImageProvider | null {
    return DRAWING_FEATURE_IMAGE_PROVIDERS.find(provider => provider.isSourceFileWithFrontmatter(file, frontmatter)) ?? null;
}

function getDrawingFeatureImageProvider(app: App, file: TFile): DrawingFeatureImageProvider | null {
    const nonMarkdownProvider = getNonMarkdownDrawingFeatureImageProvider(file);
    if (nonMarkdownProvider) {
        return nonMarkdownProvider;
    }

    if (file.extension.toLowerCase() !== 'md') {
        return null;
    }

    return getDrawingFeatureImageProviderWithFrontmatter(file, app.metadataCache.getFileCache(file)?.frontmatter);
}

function getNonMarkdownDrawingFeatureImageProvider(file: TFile): DrawingFeatureImageProvider | null {
    if (file.extension.toLowerCase() === 'md') {
        return null;
    }

    return DRAWING_FEATURE_IMAGE_PROVIDERS.find(provider => provider.isSourceFileWithFrontmatter(file, null)) ?? null;
}

export function getDrawingSourceProviderIdWithFrontmatter(file: TFile, frontmatter: unknown): DrawingFeatureImageProviderId | null {
    return getDrawingFeatureImageProviderWithFrontmatter(file, frontmatter)?.id ?? null;
}

function toDrawingFeatureImageSource(provider: DrawingFeatureImageProvider): DrawingFeatureImageSource {
    return {
        providerId: provider.id,
        iconId: provider.iconId,
        showsFeatureImageBox: provider.showsFeatureImageBox,
        supportsCompanionImages: provider.companionImageExtensions.length > 0
    };
}

export function getDrawingFeatureImageSource(app: App, file: TFile): DrawingFeatureImageSource | null {
    const provider = getDrawingFeatureImageProvider(app, file);
    return provider ? toDrawingFeatureImageSource(provider) : null;
}

export function isNonMarkdownDrawingFeatureImageFile(file: TFile): boolean {
    return getNonMarkdownDrawingFeatureImageProvider(file) !== null;
}

export function getNonMarkdownDrawingFeatureImageProviderId(file: TFile): DrawingFeatureImageProviderId | null {
    return getNonMarkdownDrawingFeatureImageProvider(file)?.id ?? null;
}

export function getDrawingDirectFeatureImageKey(file: Pick<TFile, 'path'>, providerId: DrawingFeatureImageProviderId): string {
    return `${DRAWING_DIRECT_FEATURE_IMAGE_KEY_PREFIX}${providerId}:${file.path}`;
}

export function getDrawingCompanionImagePaths(file: Pick<TFile, 'path'>, providerId: DrawingFeatureImageProviderId): string[] {
    const provider = getDrawingFeatureImageProviderById(providerId);
    return provider.companionImageExtensions
        .map(extension => provider.getCompanionImagePath(file, extension))
        .filter((path): path is string => path !== null);
}

function resolveDrawingFeatureImageFileWithProvider(
    app: App,
    drawingFile: TFile,
    provider: DrawingFeatureImageProvider,
    themeMode: ThemeMode
): TFile | null {
    for (const extension of getThemePreferredExtensions(provider, themeMode)) {
        const path = provider.getCompanionImagePath(drawingFile, extension);
        if (!path) {
            continue;
        }

        const file = getFileByPath(app, path);
        if (file) {
            return file;
        }
    }

    return null;
}

export function resolveDrawingFeatureImageFileForProvider(
    app: App,
    drawingFile: TFile,
    providerId: DrawingFeatureImageProviderId,
    themeMode: ThemeMode = getCurrentThemeMode()
): TFile | null {
    return resolveDrawingFeatureImageFileWithProvider(app, drawingFile, getDrawingFeatureImageProviderById(providerId), themeMode);
}

export function resolveDrawingFeatureImageFile(app: App, drawingFile: TFile, themeMode: ThemeMode = getCurrentThemeMode()): TFile | null {
    const provider = getDrawingFeatureImageProvider(app, drawingFile);
    if (!provider) {
        return null;
    }

    return resolveDrawingFeatureImageFileWithProvider(app, drawingFile, provider, themeMode);
}

export function findDrawingFileForCompanionImage(app: App, imagePath: string): TFile | null {
    const basePath = getCompanionBasePath(imagePath);
    if (!basePath) {
        return null;
    }

    for (const provider of DRAWING_FEATURE_IMAGE_PROVIDERS) {
        if (provider.companionImageExtensions.length === 0) {
            continue;
        }

        const sourcePathCandidates = provider.getSourcePathCandidatesForCompanionBasePath(basePath);
        for (const sourcePath of sourcePathCandidates) {
            const sourceFile = getFileByPath(app, sourcePath);
            if (!sourceFile) {
                continue;
            }

            const frontmatter =
                sourceFile.extension.toLowerCase() === 'md' ? app.metadataCache.getFileCache(sourceFile)?.frontmatter : null;
            if (provider.isSourceFileWithFrontmatter(sourceFile, frontmatter)) {
                return sourceFile;
            }
        }
    }

    return null;
}

export function isDrawingCompanionImageFile(app: App, file: TFile): boolean {
    return file.extension.toLowerCase() === 'png' && findDrawingFileForCompanionImage(app, file.path) !== null;
}

export function shouldHideDrawingCompanionImageFile(
    app: App,
    file: TFile,
    settings: Pick<NotebookNavigatorSettings, 'hideDrawingPreviewImages'>
): boolean {
    return settings.hideDrawingPreviewImages && isDrawingCompanionImageFile(app, file);
}

export function subscribeDrawingFeatureImageChange(sourcePath: string, listener: DrawingFeatureImageListener): () => void {
    const existingListeners = featureImageListenersBySourcePath.get(sourcePath);
    const listeners = existingListeners ?? new Set<DrawingFeatureImageListener>();
    listeners.add(listener);
    if (!existingListeners) {
        featureImageListenersBySourcePath.set(sourcePath, listeners);
    }

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            featureImageListenersBySourcePath.delete(sourcePath);
        }
    };
}

function emitDrawingFeatureImageChange(sourcePath: string): void {
    featureImageListenersBySourcePath.get(sourcePath)?.forEach(listener => listener());
}

export function emitDrawingCompanionImageChange(app: App, imagePath: string): void {
    const sourceFile = findDrawingFileForCompanionImage(app, imagePath);
    if (sourceFile) {
        emitDrawingFeatureImageChange(sourceFile.path);
    }
}
