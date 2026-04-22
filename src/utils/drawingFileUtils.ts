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

import { App, Plugin, TFile, TFolder } from 'obsidian';
import { EXCALIDRAW_PLUGIN_ID, TLDRAW_PLUGIN_ID } from '../constants/pluginIds';
import { EXCALIDRAW_BASENAME_SUFFIX, stripInvalidLinkCharacters } from './fileNameUtils';
import { buildFilePathInFolder, generateUniqueFilename } from './fileCreationUtils';
import { getMomentApi } from './moment';
import { ensureRecord, isBooleanRecordValue, isStringRecordValue } from './recordUtils';
import { getPluginById } from './typeGuards';

export type DrawingType = 'excalidraw' | 'tldraw';

/**
 * Excalidraw plugin API for creating and opening drawings.
 *
 * createDrawing expectations:
 * - filename: Must include extension (.excalidraw.md, .excalidraw, or .md). No folder path.
 * - foldername: Empty string for vault root, otherwise path without trailing slash.
 * - Plugin handles collision detection internally, appending _0, _1, etc.
 * - Plugin does NOT sanitize invalid characters - caller must sanitize.
 *
 * openDrawing expectations:
 * - file: TFile object (not a path string)
 * - location: "active-pane", "new-pane", "new-tab", or "popout-window"
 * - justCreated: Set true to trigger onFileCreateHook callback
 */
interface ExcalidrawPluginApi extends Plugin {
    createDrawing: (filename: string, foldername?: string, initData?: string) => Promise<TFile>;
    openDrawing?: (
        file: TFile,
        location: string,
        active?: boolean,
        subpath?: string,
        justCreated?: boolean,
        popoutLocation?: string
    ) => void;
    settings?: Record<string, unknown>;
}

/**
 * Tldraw plugin API for creating and opening drawings.
 *
 * createTldrFile expectations:
 * - filename: Base name only, no folder path. Extension optional (plugin appends .md if missing).
 * - foldername: Folder path string, can be empty for root. Plugin calls normalizePath() internally.
 * - inMarkdown: true for .md with tldraw code block, false for raw .tldr JSON file.
 * - Plugin handles collision detection internally, appending (1), (2), etc.
 * - Plugin does NOT sanitize invalid characters - caller must sanitize.
 *
 * openTldrFile expectations:
 * - file: TFile object (not a path string)
 * - location: "current-tab", "new-tab", "new-window", or "split-tab"
 * - viewType: "tldraw-view", "tldraw-read-only", or "markdown"
 */
interface TldrawPluginApi extends Plugin {
    createDefaultFilename?: (options: { currentFile?: Pick<TFile, 'basename'> }) => string;
    createTldrFile: (filename: string, options: { foldername: string; inMarkdown: boolean; tlStore?: unknown }) => Promise<TFile>;
    openTldrFile?: (file: TFile, location: string, viewType?: string, openState?: unknown) => Promise<void>;
    settings?: Record<string, unknown>;
}

interface DrawingFilePathOptions {
    allowCompatibilitySuffix?: boolean;
}

/** Type guard checking if a plugin exposes a settings object */
function pluginHasSettings(plugin: Plugin): plugin is Plugin & { settings?: Record<string, unknown> } {
    return typeof plugin === 'object' && plugin !== null && 'settings' in plugin;
}

/** Returns the settings object of a plugin by id, or null if unavailable */
function getPluginSettings(app: App, pluginId: string): Record<string, unknown> | null {
    const plugin = getPluginById(app, pluginId);
    if (!plugin || !pluginHasSettings(plugin)) {
        return null;
    }

    const settings = plugin.settings;
    if (!settings) {
        return null;
    }

    return ensureRecord(settings);
}

/** Formats the current date using the given moment format string */
function formatDatePart(format: string): string {
    const trimmed = format.trim();
    if (trimmed === '') {
        return '';
    }

    const momentApi = getMomentApi();
    if (!momentApi) {
        return getFallbackTimestamp();
    }

    return momentApi().format(trimmed);
}

/**
 * Builds a filename using Excalidraw plugin settings, or null if plugin unavailable.
 * Reads drawingFilenamePrefix, drawingFilenameDateTime, useExcalidrawExtension, and compatibilityMode.
 * Returns filename WITH extension (Excalidraw requires extension in filename parameter).
 */
function getExcalidrawFileNameFromPlugin(app: App, allowCompatibility: boolean = true): string | null {
    const settings = getPluginSettings(app, EXCALIDRAW_PLUGIN_ID);
    if (!settings) {
        return null;
    }

    const prefixValue = settings['drawingFilenamePrefix'];
    const dateFormatValue = settings['drawingFilenameDateTime'];
    const useExcalidrawExtensionValue = settings['useExcalidrawExtension'];
    const compatibilityModeValue = settings['compatibilityMode'];

    const prefix = isStringRecordValue(prefixValue) ? prefixValue : 'Drawing ';
    const dateFormat = isStringRecordValue(dateFormatValue) ? dateFormatValue : '';
    const useExcalidrawExtension = isBooleanRecordValue(useExcalidrawExtensionValue) ? useExcalidrawExtensionValue : true;
    const compatibilityMode = allowCompatibility && isBooleanRecordValue(compatibilityModeValue) ? compatibilityModeValue : false;

    const datePart = formatDatePart(dateFormat);
    const suffix = compatibilityMode ? '.excalidraw' : useExcalidrawExtension ? '.excalidraw.md' : '.md';

    return `${prefix}${datePart}${suffix}`;
}

/**
 * Builds a filename using Tldraw plugin settings, or null if plugin unavailable.
 * Reads newFilePrefix and newFileTimeFormat settings.
 * Returns filename WITHOUT extension (Tldraw auto-appends .md when inMarkdown=true).
 */
function getTldrawFileNameFromPlugin(app: App): string | null {
    const settings = getPluginSettings(app, TLDRAW_PLUGIN_ID);
    if (!settings) {
        return null;
    }
    const prefixValue = settings['newFilePrefix'];
    const dateFormatValue = settings['newFileTimeFormat'];

    const prefix = isStringRecordValue(prefixValue) ? prefixValue : '';
    const dateFormat = isStringRecordValue(dateFormatValue) ? dateFormatValue : '';

    const datePart = formatDatePart(dateFormat);
    const baseName = `${prefix}${datePart}`;

    if (baseName.trim() !== '') {
        return baseName;
    }

    const defaultPrefix = 'Tldraw ';
    const defaultFormat = 'YYYY-MM-DD h.mmA';
    return `${defaultPrefix}${formatDatePart(defaultFormat)}`;
}

/**
 * Appends .md extension if the filename lacks a recognized extension.
 * Tldraw auto-appends .md when inMarkdown=true, but we ensure it here
 * for consistent filename handling before uniqueness checks.
 */
function ensureMarkdownExtension(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.tldr')) {
        return fileName;
    }
    return `${fileName}.md`;
}

/**
 * Removes invalid characters and path traversal sequences from a filename.
 * Required because neither Excalidraw nor Tldraw sanitize filenames - they pass them directly
 * to Obsidian's vault.create() which will fail on invalid characters.
 */
function sanitizeDrawingFileName(fileName: string, type: DrawingType): string {
    const withoutInvalidCharacters = stripInvalidLinkCharacters(fileName);
    const withoutSeparators = withoutInvalidCharacters.replace(/[\\/]/g, ' ');
    const withoutTraversal = withoutSeparators.replace(/\.\.(\/|\\)?/g, '');
    const normalizedSpaces = withoutTraversal.replace(/\s+/g, ' ').trim();

    if (normalizedSpaces === '') {
        return getFallbackDrawingFileName(type);
    }

    return normalizedSpaces;
}

/** Returns an ISO timestamp with colons and periods replaced by dashes */
function getFallbackTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/** Returns a default timestamped filename when plugin settings are unavailable */
function getFallbackDrawingFileName(type: DrawingType): string {
    const timestamp = getFallbackTimestamp();
    if (type === 'excalidraw') {
        return `Drawing ${timestamp}${EXCALIDRAW_BASENAME_SUFFIX}.md`;
    }
    return `Drawing ${timestamp}.md`;
}

/** Returns a sanitized filename from plugin settings or falls back to defaults */
function getDrawingFileName(app: App, type: DrawingType, allowCompatibility: boolean = true): string {
    if (type === 'excalidraw') {
        const baseName = getExcalidrawFileNameFromPlugin(app, allowCompatibility) ?? getFallbackDrawingFileName('excalidraw');
        return sanitizeDrawingFileName(baseName, 'excalidraw');
    }

    const pluginFileName = getTldrawFileNameFromPlugin(app);
    const baseName = pluginFileName ?? getFallbackDrawingFileName('tldraw');
    const ensured = ensureMarkdownExtension(baseName);
    return sanitizeDrawingFileName(ensured, 'tldraw');
}

/**
 * Ensures Excalidraw filenames have a valid extension.
 * Excalidraw requires the extension in the filename parameter - it does not append one.
 * Valid extensions: .excalidraw.md, .excalidraw, or .md
 */
function normalizeDrawingFileName(fileName: string, type: DrawingType): string {
    if (type !== 'excalidraw') {
        return fileName;
    }

    const lower = fileName.toLowerCase();
    const hasAllowedExtension = lower.endsWith('.excalidraw') || lower.endsWith('.excalidraw.md') || lower.endsWith('.md');
    if (hasAllowedExtension) {
        return fileName;
    }

    return `${fileName}.md`;
}

/** Applies extension normalization and sanitization to a filename */
function normalizeAndSanitizeDrawingFileName(fileName: string, type: DrawingType): string {
    const ensured = type === 'tldraw' ? ensureMarkdownExtension(fileName) : fileName;
    const sanitized = sanitizeDrawingFileName(ensured, type);
    return normalizeDrawingFileName(sanitized, type);
}

/** Extracts the filename component from a path */
function getFileNameFromPath(path: string): string {
    const separatorIndex = path.lastIndexOf('/');
    if (separatorIndex === -1) {
        return path;
    }
    return path.slice(separatorIndex + 1);
}

/**
 * Returns the folder path normalized for Excalidraw plugin API.
 * Excalidraw expects empty string for vault root (not "/" which creates double-slash paths).
 * Paths should not have trailing slashes.
 */
function getPluginFolderPath(folder: TFolder): string {
    if (folder.path === '/' || folder.path === '') {
        return '';
    }
    return folder.path;
}

/**
 * Generates a unique file path by appending a number suffix if the file already exists.
 * Both Excalidraw and Tldraw have their own collision handling (_0 vs (1) suffixes),
 * but we pre-compute uniqueness to ensure consistent behavior after sanitization.
 */
function getUniqueDrawingFilePath(app: App, parent: TFolder, fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    const hasExtension = dotIndex > 0 && dotIndex < fileName.length - 1;
    const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
    const extension = hasExtension ? fileName.slice(dotIndex + 1) : '';
    const uniqueBaseName = generateUniqueFilename(parent.path, baseName, extension, app);
    return buildFilePathInFolder(parent.path, uniqueBaseName, extension);
}

/** Type guard checking if a plugin exposes the Excalidraw API */
function isExcalidrawPlugin(plugin: Plugin | null): plugin is ExcalidrawPluginApi {
    if (!plugin) {
        return false;
    }

    const createDrawing: unknown = Reflect.get(plugin, 'createDrawing');
    return typeof createDrawing === 'function';
}

/** Type guard checking if a plugin exposes the Tldraw API */
function isTldrawPlugin(plugin: Plugin | null): plugin is TldrawPluginApi {
    if (!plugin) {
        return false;
    }

    const createTldrFile: unknown = Reflect.get(plugin, 'createTldrFile');

    return typeof createTldrFile === 'function';
}

/**
 * Creates a drawing using the Excalidraw plugin API.
 *
 * Excalidraw createDrawing expects:
 * - filename with extension included (.excalidraw.md, .excalidraw, or .md)
 * - filename without folder path (just the name)
 * - foldername as empty string for root, otherwise path without trailing slash
 *
 * We pre-compute uniqueness because we sanitize the filename (which Excalidraw doesn't do),
 * and we want consistent collision suffix style across both plugins.
 */
async function createDrawingWithExcalidrawPlugin(app: App, parent: TFolder): Promise<TFile | null> {
    const plugin = getPluginById(app, EXCALIDRAW_PLUGIN_ID);
    if (!isExcalidrawPlugin(plugin)) {
        return null;
    }

    const rawFileName = getExcalidrawFileNameFromPlugin(app) ?? getFallbackDrawingFileName('excalidraw');
    const safeFileName = normalizeAndSanitizeDrawingFileName(rawFileName, 'excalidraw');
    const uniquePath = getUniqueDrawingFilePath(app, parent, safeFileName);
    const uniqueFileName = getFileNameFromPath(uniquePath);
    const folderPath = getPluginFolderPath(parent);

    // Pass filename with extension, folder as separate param (empty string for root)
    const file = await plugin.createDrawing(uniqueFileName, folderPath);
    if (typeof plugin.openDrawing === 'function') {
        // justCreated=true triggers the plugin's onFileCreateHook callback
        plugin.openDrawing(file, 'active-pane', true, undefined, true);
    }

    return file;
}

/**
 * Creates a drawing using the Tldraw plugin API.
 *
 * Tldraw createTldrFile expects:
 * - filename as base name only (no folder path)
 * - extension is optional (plugin appends .md if missing when inMarkdown=true)
 * - foldername as folder path string (plugin calls normalizePath internally)
 * - inMarkdown=true creates .md with tldraw code block, false creates raw .tldr
 *
 * We pre-compute uniqueness because we sanitize the filename (which Tldraw doesn't do),
 * and we want consistent collision suffix style across both plugins.
 */
async function createDrawingWithTldrawPlugin(app: App, parent: TFolder): Promise<TFile | null> {
    const plugin = getPluginById(app, TLDRAW_PLUGIN_ID);
    if (!isTldrawPlugin(plugin)) {
        return null;
    }

    const rawFileName = (() => {
        const fileNameFromSettings = getTldrawFileNameFromPlugin(app);

        if (typeof plugin.createDefaultFilename === 'function') {
            const activeFile = app.workspace.getActiveFile();
            const currentFile = activeFile ?? undefined;
            try {
                return plugin.createDefaultFilename({ currentFile });
            } catch (error) {
                console.error('Failed to generate default Tldraw filename via plugin API', error);
            }
        }

        return fileNameFromSettings ?? getFallbackDrawingFileName('tldraw');
    })();
    const safeFileName = normalizeAndSanitizeDrawingFileName(rawFileName, 'tldraw');
    const uniquePath = getUniqueDrawingFilePath(app, parent, safeFileName);
    const uniqueFileName = getFileNameFromPath(uniquePath);

    // Pass filename (with or without extension) and folder path separately
    const folderPath = parent.path;
    const file = await plugin.createTldrFile(uniqueFileName, { foldername: folderPath, inMarkdown: true });

    if (typeof plugin.openTldrFile === 'function') {
        // "current-tab" opens in active pane, "tldraw-view" uses the drawing editor
        await plugin.openTldrFile(file, 'current-tab', 'tldraw-view');
    }

    return file;
}

/** Creates a drawing using the appropriate plugin API based on type */
export async function createDrawingWithPlugin(app: App, parent: TFolder, type: DrawingType): Promise<TFile | null> {
    if (type === 'excalidraw') {
        return await createDrawingWithExcalidrawPlugin(app, parent);
    }
    return await createDrawingWithTldrawPlugin(app, parent);
}

/** Returns a unique file path for a new drawing in the specified folder */
export function getDrawingFilePath(app: App, parent: TFolder, type: DrawingType, options?: DrawingFilePathOptions): string {
    const allowCompatibility = options?.allowCompatibilitySuffix ?? true;
    const rawFileName = getDrawingFileName(app, type, allowCompatibility);
    const fileName = normalizeDrawingFileName(rawFileName, type);
    return getUniqueDrawingFilePath(app, parent, fileName);
}

/** Returns the frontmatter template for the specified drawing type */
export function getDrawingTemplate(type: DrawingType): string {
    if (type === 'tldraw') {
        return `---
tldraw-file: true
---\n`;
    }

    return `---

excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==


# Text Elements
# Embedded files
# Drawing
\`\`\`json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.0.0",
  "elements": [],
  "appState": {
    "gridSize": null,
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
\`\`\`
%%`;
}
