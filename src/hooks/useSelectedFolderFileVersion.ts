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

import { useEffect, useState } from 'react';
import { TAbstractFile, TFile, TFolder, Vault } from 'obsidian';

interface UseSelectedFolderFileVersionOptions {
    includeAncestors?: boolean;
}

const WATCH_PATH_SEPARATOR = '\u0000';

function getParentPath(path: string): string {
    // Returns "/" for root-level files and the folder path for nested files.
    const separatorIndex = path.lastIndexOf('/');
    if (separatorIndex <= 0) {
        return '/';
    }

    return path.slice(0, separatorIndex);
}

export function getSelectedFolderFileWatchPaths(selectedFolder: TFolder, includeAncestors = false): Set<string> {
    const paths = new Set<string>();
    let folder: TFolder | null = selectedFolder;

    while (folder) {
        paths.add(folder.path);

        if (!includeAncestors) {
            break;
        }

        folder = folder.parent instanceof TFolder ? folder.parent : null;
    }

    return paths;
}

export function getSelectedFolderFileWatchPathSignature(selectedFolder: TFolder | null, includeAncestors: boolean): string | null {
    if (!selectedFolder) {
        return null;
    }

    return Array.from(getSelectedFolderFileWatchPaths(selectedFolder, includeAncestors)).join(WATCH_PATH_SEPARATOR);
}

function getWatchPathsFromSignature(signature: string): Set<string> {
    return new Set(signature.split(WATCH_PATH_SEPARATOR));
}

export function isWatchedFolderFileChange(file: TAbstractFile, watchedFolderPaths: ReadonlySet<string>, oldPath?: string): boolean {
    if (file instanceof TFolder) {
        if (typeof oldPath !== 'string') {
            return false;
        }

        return watchedFolderPaths.has(oldPath) || watchedFolderPaths.has(file.path);
    }

    // Folder notes are files; other folder create/delete events are ignored here.
    if (!(file instanceof TFile)) {
        return false;
    }

    if (watchedFolderPaths.has(getParentPath(file.path))) {
        return true;
    }

    if (typeof oldPath !== 'string') {
        return false;
    }

    return watchedFolderPaths.has(getParentPath(oldPath));
}

export function useSelectedFolderFileVersion(
    vault: Vault,
    selectedFolder: TFolder | null,
    enabled: boolean,
    options?: UseSelectedFolderFileVersionOptions
): number {
    // Monotonic counter used by memo dependencies in header/title components.
    const [version, setVersion] = useState(0);
    const includeAncestors = options?.includeAncestors === true;
    const watchedFolderPathSignature = getSelectedFolderFileWatchPathSignature(selectedFolder, includeAncestors);

    useEffect(() => {
        if (!enabled || !watchedFolderPathSignature) {
            return;
        }

        const watchedFolderPaths = getWatchPathsFromSignature(watchedFolderPathSignature);

        // Increments when direct child files are created, deleted, or renamed
        // inside watched folders, or when a watched folder is renamed.
        const handleFileChange = (file: TAbstractFile, oldPath?: string) => {
            if (!isWatchedFolderFileChange(file, watchedFolderPaths, oldPath)) {
                return;
            }

            setVersion(current => current + 1);
        };

        const createRef = vault.on('create', file => {
            handleFileChange(file);
        });
        const deleteRef = vault.on('delete', file => {
            handleFileChange(file);
        });
        const renameRef = vault.on('rename', (file, oldPath) => {
            handleFileChange(file, oldPath);
        });

        return () => {
            vault.offref(createRef);
            vault.offref(deleteRef);
            vault.offref(renameRef);
        };
    }, [enabled, vault, watchedFolderPathSignature]);

    return version;
}
