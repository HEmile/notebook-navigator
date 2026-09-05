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

import { App, Platform, TFile, TFolder } from 'obsidian';
import { buildFilePathInFolder, generateUniqueFilename } from './fileCreationUtils';
import { stripForbiddenNameCharactersAllPlatforms, stripForbiddenNameCharactersWindows, stripLeadingPeriods } from './fileNameUtils';

export type MergeNotesSeparator = 'none' | 'blank-line' | 'horizontal-rule' | 'heading';

export interface MergeNoteSource {
    file: TFile;
    content: string;
}

export interface MergeNotesOptions {
    app: App;
    files: readonly TFile[];
    outputFolder: TFolder;
    outputName: string;
    separator: MergeNotesSeparator;
    moveSourcesToTrash: boolean;
    openOutputFile?: (file: TFile) => Promise<void>;
    trashSourceFiles?: (files: readonly TFile[]) => Promise<number>;
}

export interface MergeNotesResult {
    file: TFile;
    sourceCount: number;
    failedSourceTrashCount: number;
    outputOpenError: Error | null;
}

function getLineEnd(content: string, start: number): number {
    const nextLineEnd = content.indexOf('\n', start);
    return nextLineEnd === -1 ? content.length : nextLineEnd;
}

function getNextLineStart(content: string, lineEnd: number): number {
    return lineEnd >= content.length ? content.length : lineEnd + 1;
}

export function stripLeadingFrontmatter(content: string): string {
    const firstLineEnd = getLineEnd(content, 0);
    const firstLine = content.slice(0, firstLineEnd).trim();
    if (firstLine !== '---') {
        return content;
    }

    let lineStart = getNextLineStart(content, firstLineEnd);
    while (lineStart < content.length) {
        const lineEnd = getLineEnd(content, lineStart);
        const line = content.slice(lineStart, lineEnd).trim();
        if (line === '---' || line === '...') {
            return content.slice(getNextLineStart(content, lineEnd));
        }
        lineStart = getNextLineStart(content, lineEnd);
    }

    return content;
}

function trimLeadingNewlines(content: string): string {
    return content.replace(/^(?:\r?\n)+/u, '');
}

function trimTrailingNewlines(content: string): string {
    return content.replace(/(?:\r?\n)+$/u, '');
}

function trimBoundaryNewlines(content: string): string {
    return trimLeadingNewlines(trimTrailingNewlines(content));
}

function getSeparatorText(separator: MergeNotesSeparator, file: TFile): string {
    switch (separator) {
        case 'none':
            return '\n';
        case 'horizontal-rule':
            return '\n\n---\n\n';
        case 'heading':
            return `\n\n# ${file.basename}\n\n`;
        case 'blank-line':
        default:
            return '\n\n';
    }
}

export function buildMergedNoteContent(sources: readonly MergeNoteSource[], separator: MergeNotesSeparator): string {
    let merged = '';

    sources.forEach((source, index) => {
        merged += buildMergedNoteChunk(source, index, separator);
    });

    return `${trimTrailingNewlines(merged)}\n`;
}

function buildMergedNoteChunk(source: MergeNoteSource, index: number, separator: MergeNotesSeparator): string {
    const sourceContent = index === 0 ? source.content : stripLeadingFrontmatter(source.content);
    const content = index === 0 ? trimTrailingNewlines(sourceContent) : trimBoundaryNewlines(sourceContent);
    const prefix = index > 0 ? getSeparatorText(separator, source.file) : '';

    return `${prefix}${content}`;
}

export function normalizeMergeOutputBaseName(value: string): string {
    const withoutExtension = value.trim().replace(/\.md$/iu, '').trim();
    const withoutLeadingPeriods = stripLeadingPeriods(withoutExtension);
    const withoutForbiddenCharacters = stripForbiddenNameCharactersAllPlatforms(withoutLeadingPeriods);
    const platformSafeName = Platform.isWin ? stripForbiddenNameCharactersWindows(withoutForbiddenCharacters) : withoutForbiddenCharacters;
    return platformSafeName.trim();
}

export function getMarkdownFilesInOrder(files: readonly TFile[]): TFile[] {
    const result: TFile[] = [];
    const seenPaths = new Set<string>();

    files.forEach(file => {
        if (file.extension !== 'md' || seenPaths.has(file.path)) {
            return;
        }

        seenPaths.add(file.path);
        result.push(file);
    });

    return result;
}

async function moveSourceFilesToTrash(app: App, files: readonly TFile[]): Promise<number> {
    const results = await Promise.allSettled(files.map(file => app.fileManager.trashFile(file)));
    let failedCount = 0;

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            return;
        }

        failedCount += 1;
        console.error('Error moving merged source note to trash:', files[index].path, result.reason);
    });

    return failedCount;
}

async function readMergeNoteSources(app: App, files: readonly TFile[]): Promise<MergeNoteSource[]> {
    const sources: MergeNoteSource[] = [];

    for (const file of files) {
        sources.push({
            file,
            content: await app.vault.read(file)
        });
    }

    return sources;
}

function normalizeOutputOpenError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }

    if (typeof error === 'string') {
        const trimmed = error.trim();
        if (trimmed) {
            return new Error(trimmed);
        }
    }

    return new Error('Failed to open merged note.');
}

async function trashMergedSourceFiles(
    app: App,
    files: readonly TFile[],
    trashSourceFiles?: (files: readonly TFile[]) => Promise<number>
): Promise<number> {
    if (trashSourceFiles) {
        try {
            return await trashSourceFiles(files);
        } catch (error) {
            console.error('Error moving merged source notes to trash:', error);
            return files.length;
        }
    }

    return moveSourceFilesToTrash(app, files);
}

export async function mergeNotes({
    app,
    files,
    outputFolder,
    outputName,
    separator,
    moveSourcesToTrash,
    openOutputFile,
    trashSourceFiles
}: MergeNotesOptions): Promise<MergeNotesResult> {
    const markdownFiles = getMarkdownFilesInOrder(files);
    if (markdownFiles.length < 2) {
        throw new Error('At least two markdown notes are required.');
    }

    const outputBaseName = normalizeMergeOutputBaseName(outputName);
    if (!outputBaseName) {
        throw new Error('Output name is required.');
    }

    const sources = await readMergeNoteSources(app, markdownFiles);
    const mergedContent = buildMergedNoteContent(sources, separator);
    const uniqueBaseName = generateUniqueFilename(outputFolder.path, outputBaseName, 'md', app);
    const outputPath = buildFilePathInFolder(outputFolder.path, uniqueBaseName, 'md');
    const createdFile = await app.vault.create(outputPath, mergedContent);
    let failedSourceTrashCount = 0;
    let outputOpenError: Error | null = null;

    if (openOutputFile) {
        try {
            await openOutputFile(createdFile);
        } catch (error) {
            outputOpenError = normalizeOutputOpenError(error);
        }
    }

    if (moveSourcesToTrash && outputOpenError === null) {
        failedSourceTrashCount = await trashMergedSourceFiles(app, markdownFiles, trashSourceFiles);
    }

    return {
        file: createdFile,
        sourceCount: markdownFiles.length,
        failedSourceTrashCount,
        outputOpenError
    };
}
