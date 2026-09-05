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

import { App, Menu, TFile, TFolder } from 'obsidian';
import { getMarkdownFilesInOrder } from '../noteMerge';
import { openMergeNotesModal } from '../mergeNotesModal';
import { setAsyncOnClick } from './menuAsyncHelpers';
import type { CommandQueueService } from '../../services/CommandQueueService';
import type { FileSystemOperations } from '../../services/FileSystemService';

interface AddMergeNotesMenuItemParams {
    menu: Menu;
    app: App;
    commandQueue: CommandQueueService | null;
    fileSystemOps: FileSystemOperations;
    files: readonly TFile[];
    outputFolder: TFolder;
    defaultOutputName: string;
    title: string;
}

export function addMergeNotesMenuItem({
    menu,
    app,
    commandQueue,
    fileSystemOps,
    files,
    outputFolder,
    defaultOutputName,
    title
}: AddMergeNotesMenuItemParams): boolean {
    const markdownFiles = getMarkdownFilesInOrder(files);
    if (markdownFiles.length < 2) {
        return false;
    }

    menu.addItem(item => {
        setAsyncOnClick(item.setTitle(title).setIcon('lucide-git-merge'), async () => {
            await openMergeNotesModal({
                app,
                commandQueue,
                fileSystemOps,
                files: markdownFiles,
                outputFolder,
                defaultOutputName
            });
        });
    });

    return true;
}
