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

import { useCallback, type RefObject } from 'react';
import type { App, TFile } from 'obsidian';
import type { NotebookNavigatorSettings } from '../../settings';
import { getFilteredMarkdownAndPdfFiles, getFilteredMarkdownFiles } from '../../utils/fileFilters';

/**
 * Provides file lists used by the storage layer.
 *
 * `StorageContext` needs two related but distinct queries:
 * - Visible markdown files: what the UI can show/count right now (respects "show hidden items").
 * - Indexable files: what should exist in the cache/database (always includes hidden items so toggling visibility
 *   does not require rebuilding the database).
 */
export function useStorageFileQueries(params: {
    app: App;
    latestSettingsRef: RefObject<NotebookNavigatorSettings>;
    showHiddenItems: boolean;
}): { getVisibleMarkdownFiles: () => TFile[]; getIndexableFiles: () => TFile[] } {
    const { app, latestSettingsRef, showHiddenItems } = params;

    // Filters markdown files using the active profile exclusions and the current "show hidden items" UX toggle.
    const getVisibleMarkdownFiles = useCallback((): TFile[] => {
        return getFilteredMarkdownFiles(app, latestSettingsRef.current, { showHiddenItems });
    }, [app, latestSettingsRef, showHiddenItems]);

    // Indexes markdown + PDF regardless of the current UI visibility toggle. Hidden items can still contribute
    // to background content generation and are available immediately if the user enables "show hidden items".
    const getIndexableFiles = useCallback((): TFile[] => {
        return getFilteredMarkdownAndPdfFiles(app, latestSettingsRef.current, { showHiddenItems: true });
    }, [app, latestSettingsRef]);

    return { getVisibleMarkdownFiles, getIndexableFiles };
}
