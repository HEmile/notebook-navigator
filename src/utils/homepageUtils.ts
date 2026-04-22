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

import { TAbstractFile, TFile } from 'obsidian';

/**
 * Set of file extensions supported as homepage files
 * Includes Markdown, Canvas, and Excalidraw files
 */
const SUPPORTED_EXTENSIONS = new Set(['md', 'canvas', 'base']);

/**
 * Checks if a file extension is supported as a homepage target
 * @param extension - The file extension to check (without the dot)
 * @returns True if the extension is supported for homepage use
 */
export function isSupportedHomepageExtension(extension: string): boolean {
    return SUPPORTED_EXTENSIONS.has(extension.toLowerCase());
}

/**
 * Type guard that checks if an abstract file is a valid homepage file
 * Ensures the file is a TFile instance and has a supported extension
 * @param file - The file to check, can be null
 * @returns True if the file is a valid homepage file
 */
export function isSupportedHomepageFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile && isSupportedHomepageExtension(file.extension);
}
