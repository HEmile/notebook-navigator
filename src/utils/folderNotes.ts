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

import { App, type PaneType, TFile, TFolder, normalizePath } from 'obsidian';
import { strings } from '../i18n';
import { FolderNoteType, FOLDER_NOTE_TYPE_EXTENSIONS, FolderNoteCreationPreference } from '../types/folderNote';
import { createDatabaseContent, createMarkdownFileFromTemplate } from './fileCreationUtils';
import { type FolderNoteNameSettings, resolveFolderNoteName } from './folderNoteName';
import { EXCALIDRAW_BASENAME_SUFFIX, isExcalidrawFile, stripExcalidrawSuffix } from './fileNameUtils';
import { CommandQueueService } from '../services/CommandQueueService';
import { promptForFolderNoteType } from '../modals/FolderNoteTypeModal';
import { showNotice } from './noticeUtils';
import { openFileInContext } from './openFileInContext';

interface OpenFolderNoteFileParams {
    app: App;
    commandQueue: CommandQueueService | null;
    folder: TFolder;
    folderNote: TFile;
    context: PaneType | null;
    active?: boolean;
}

/**
 * Settings required for detecting folder notes
 */
export interface FolderNoteDetectionSettings extends FolderNoteNameSettings {
    enableFolderNotes: boolean;
}

/**
 * Settings required for creating folder notes
 */
export interface FolderNoteCreationSettings extends FolderNoteNameSettings {
    folderNoteType: FolderNoteCreationPreference;
    folderNoteTemplate: string | null;
}

interface CreateFolderNoteOptions {
    folderDisplayName?: string;
}

/**
 * Extracts folder note detection settings from a larger settings object.
 */
export function getFolderNoteDetectionSettings(settings: FolderNoteDetectionSettings): FolderNoteDetectionSettings {
    return {
        enableFolderNotes: settings.enableFolderNotes,
        folderNoteName: settings.folderNoteName,
        folderNoteNamePattern: settings.folderNoteNamePattern
    };
}

/** Set of file extensions that are valid for folder notes */
const SUPPORTED_FOLDER_NOTE_EXTENSIONS = new Set<string>(Object.values(FOLDER_NOTE_TYPE_EXTENSIONS));

/**
 * Checks if a file extension is supported for folder notes
 * @param extension - The file extension to check
 * @returns True if the extension is supported
 */
export function isSupportedFolderNoteExtension(extension: string): boolean {
    return SUPPORTED_FOLDER_NOTE_EXTENSIONS.has(extension);
}

/**
 * Gets the folder note for a folder if it exists
 * @param folder - The folder to check for a folder note
 * @param settings - Settings for folder note detection
 * @returns The folder note file or null if not found
 */
export function getFolderNote(folder: TFolder, settings: FolderNoteDetectionSettings): TFile | null {
    if (!settings.enableFolderNotes) {
        return null;
    }

    const expectedName = resolveFolderNoteName(folder.name, settings);
    const prefix = folder.path === '/' ? '' : `${folder.path}/`;
    const exactCandidates: TFile[] = [];

    for (const extension of Object.values(FOLDER_NOTE_TYPE_EXTENSIONS)) {
        const candidatePath = normalizePath(`${prefix}${expectedName}.${extension}`);
        const candidate = folder.vault.getAbstractFileByPath(candidatePath);

        if (!(candidate instanceof TFile) || candidate.parent?.path !== folder.path) {
            continue;
        }

        if (!SUPPORTED_FOLDER_NOTE_EXTENSIONS.has(candidate.extension)) {
            continue;
        }

        if (candidate.basename === expectedName) {
            exactCandidates.push(candidate);
        }
    }

    let excalidrawCandidate: TFile | null = null;
    const excalidrawPath = normalizePath(`${prefix}${expectedName}${EXCALIDRAW_BASENAME_SUFFIX}.md`);
    const abstractExcalidrawCandidate = folder.vault.getAbstractFileByPath(excalidrawPath);
    if (abstractExcalidrawCandidate instanceof TFile && abstractExcalidrawCandidate.parent?.path === folder.path) {
        if (isExcalidrawFile(abstractExcalidrawCandidate) && stripExcalidrawSuffix(abstractExcalidrawCandidate.basename) === expectedName) {
            excalidrawCandidate = abstractExcalidrawCandidate;
        }
    }

    if (exactCandidates.length === 1) {
        return exactCandidates[0];
    }

    if (exactCandidates.length > 1) {
        const candidatePaths = new Set<string>(exactCandidates.map(candidate => candidate.path));
        for (const child of folder.children) {
            if (!(child instanceof TFile)) {
                continue;
            }

            if (child.parent?.path !== folder.path) {
                continue;
            }

            if (!candidatePaths.has(child.path)) {
                continue;
            }

            return child;
        }

        return exactCandidates[0] ?? null;
    }

    return excalidrawCandidate;
}

/**
 * Opens the folder note for a folder, optionally in a new workspace context.
 * Uses CommandQueueService when available to track folder note opens.
 */
export async function openFolderNoteFile({
    app,
    commandQueue,
    folder,
    folderNote,
    context,
    active = true
}: OpenFolderNoteFileParams): Promise<void> {
    const openFile = async () => {
        if (context) {
            await openFileInContext({ app, commandQueue, file: folderNote, context, active });
            return;
        }

        const leaf = app.workspace.getLeaf(false);
        if (!leaf) {
            return;
        }
        await leaf.openFile(folderNote, { active });
    };

    if (commandQueue) {
        await commandQueue.executeOpenFolderNote(folder.path, openFile);
        return;
    }

    await openFile();
}

/**
 * Checks if a file is a folder note for a given folder
 * @param file - The file to check
 * @param folder - The folder to check against
 * @param settings - Settings for folder note detection
 * @returns True if the file is a folder note for the given folder
 */
export function isFolderNote(file: TFile, folder: TFolder, settings: FolderNoteDetectionSettings): boolean {
    if (!settings.enableFolderNotes) {
        return false;
    }

    if (!SUPPORTED_FOLDER_NOTE_EXTENSIONS.has(file.extension)) {
        return false;
    }

    if (file.parent?.path !== folder.path) {
        return false;
    }

    const expectedName = resolveFolderNoteName(folder.name, settings);
    if (file.basename === expectedName) {
        return true;
    }

    if (!isExcalidrawFile(file) || stripExcalidrawSuffix(file.basename) !== expectedName) {
        return false;
    }

    // Use preferred folder note selection so plain notes win over Excalidraw variants.
    const preferred = getFolderNote(folder, settings);
    return preferred?.path === file.path;
}

/**
 * Creates a new folder note for a folder
 * @param app - The Obsidian app instance
 * @param folder - The folder to create a folder note for
 * @param settings - Settings for folder note creation
 * @param commandQueue - Optional command queue service for opening the note
 * @param options - Optional display metadata for folder note UI prompts
 * @returns The created folder note file, or null if creation failed
 */
export async function createFolderNote(
    app: App,
    folder: TFolder,
    settings: FolderNoteCreationSettings,
    commandQueue?: CommandQueueService | null,
    options?: CreateFolderNoteOptions
): Promise<TFile | null> {
    const existingNote = getFolderNote(
        folder,
        getFolderNoteDetectionSettings({
            enableFolderNotes: true,
            folderNoteName: settings.folderNoteName,
            folderNoteNamePattern: settings.folderNoteNamePattern
        })
    );

    if (existingNote) {
        showNotice(strings.fileSystem.errors.folderNoteAlreadyExists, { variant: 'warning' });
        return null;
    }

    let selectedType: FolderNoteType | null = null;

    if (settings.folderNoteType === 'ask') {
        selectedType = await promptForFolderNoteType(app, folder, options?.folderDisplayName);
        if (!selectedType) {
            return null;
        }
    } else {
        selectedType = settings.folderNoteType;
    }

    const extension = FOLDER_NOTE_TYPE_EXTENSIONS[selectedType];
    const baseName = resolveFolderNoteName(folder.name, settings);
    const noteFileName = `${baseName}.${extension}`;
    const notePath = normalizePath(`${folder.path}/${noteFileName}`);

    const conflictingItem = app.vault.getAbstractFileByPath(notePath);
    if (conflictingItem) {
        showNotice(strings.fileSystem.errors.folderNoteAlreadyExists, { variant: 'warning' });
        return null;
    }

    try {
        let file: TFile;
        if (selectedType === 'markdown') {
            file = await createMarkdownFileFromTemplate({
                app,
                folder,
                baseName,
                templatePath: settings.folderNoteTemplate,
                templateErrorContext: 'folder note'
            });
        } else if (selectedType === 'canvas') {
            file = await app.vault.create(notePath, '{}');
        } else {
            file = await app.vault.create(notePath, createDatabaseContent());
        }

        await openFolderNoteFile({
            app,
            commandQueue: commandQueue ?? null,
            folder,
            folderNote: file,
            context: null,
            active: true
        });
        return file;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showNotice(strings.fileSystem.errors.createFile.replace('{error}', message), { variant: 'warning' });
    }
    return null;
}
