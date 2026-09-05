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

import type { App, TFile } from 'obsidian';

const RESOURCE_VERSION_QUERY_KEY = 'nn-mtime';

export function appendResourcePathVersion(resourcePath: string, version: number | null | undefined): string {
    if (!resourcePath || typeof version !== 'number' || !Number.isFinite(version) || version <= 0) {
        return resourcePath;
    }

    const hashIndex = resourcePath.indexOf('#');
    const basePath = hashIndex === -1 ? resourcePath : resourcePath.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : resourcePath.slice(hashIndex);
    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}${RESOURCE_VERSION_QUERY_KEY}=${Math.trunc(version)}${hash}`;
}

export function getVersionedResourcePath(app: App, file: TFile, version: number = file.stat.mtime): string {
    return appendResourcePathVersion(app.vault.getResourcePath(file), version);
}
