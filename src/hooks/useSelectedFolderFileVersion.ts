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

function getParentPath(path: string): string {
    // Returns "/" for root-level files and the folder path for nested files.
    const separatorIndex = path.lastIndexOf('/');
    if (separatorIndex <= 0) {
        return '/';
    }

    return path.slice(0, separatorIndex);
}

function isDirectChildPath(path: string, parentPath: string): boolean {
    // Only direct children should invalidate folder note lookup for a folder.
    return getParentPath(path) === parentPath;
}

function isRelevantFileChange(file: TAbstractFile, folderPath: string, oldPath?: string): boolean {
    // Folder notes are files; folder create/delete events are ignored here.
    if (!(file instanceof TFile)) {
        return false;
    }

    if (isDirectChildPath(file.path, folderPath)) {
        return true;
    }

    if (typeof oldPath !== 'string') {
        return false;
    }

    return isDirectChildPath(oldPath, folderPath);
}

export function useSelectedFolderFileVersion(vault: Vault, selectedFolder: TFolder | null, enabled: boolean): number {
    // Monotonic counter used by memo dependencies in header/title components.
    const [version, setVersion] = useState(0);
    const selectedFolderPath = selectedFolder?.path ?? null;

    useEffect(() => {
        if (!enabled || !selectedFolderPath) {
            return;
        }

        // Increments when direct child files are created, deleted, or renamed
        // inside the selected folder.
        const handleFileChange = (file: TAbstractFile, oldPath?: string) => {
            if (!isRelevantFileChange(file, selectedFolderPath, oldPath)) {
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
    }, [enabled, selectedFolderPath, vault]);

    return version;
}
