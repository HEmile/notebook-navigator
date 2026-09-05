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

import { describe, expect, it, vi } from 'vitest';
import { App, TFile, TFolder } from 'obsidian';
import {
    buildMergedNoteContent,
    getMarkdownFilesInOrder,
    mergeNotes,
    normalizeMergeOutputBaseName,
    stripLeadingFrontmatter
} from '../../src/utils/noteMerge';
import { createTestTFile } from './createTestTFile';

function createFolder(path: string): TFolder {
    return new TFolder(path);
}

function createMergeApp(contents: Map<string, string>, occupiedPaths: ReadonlySet<string> = new Set()) {
    const workingContents = new Map(contents);
    const read = vi.fn(async (file: TFile) => workingContents.get(file.path) ?? '');
    const cachedRead = vi.fn(async (file: TFile) => workingContents.get(file.path) ?? '');
    const create = vi.fn(async (path: string, content: string) => {
        workingContents.set(path, content);
        return createTestTFile(path);
    });
    const modify = vi.fn(async (file: TFile, content: string) => {
        workingContents.set(file.path, content);
    });
    const append = vi.fn(async (file: TFile, content: string) => {
        workingContents.set(file.path, `${workingContents.get(file.path) ?? ''}${content}`);
    });
    const renameFile = vi.fn(async (file: TFile, newPath: string) => {
        const oldPath = file.path;
        const content = workingContents.get(oldPath) ?? '';
        workingContents.delete(oldPath);
        workingContents.set(newPath, content);

        const renamed = createTestTFile(newPath);
        file.path = renamed.path;
        file.name = renamed.name;
        file.basename = renamed.basename;
        file.extension = renamed.extension;
    });
    const trashFile = vi.fn(async () => undefined);
    const app = {
        vault: {
            read,
            cachedRead,
            create,
            modify,
            append,
            getAbstractFileByPath: (path: string) => (occupiedPaths.has(path) || workingContents.has(path) ? createTestTFile(path) : null),
            getFileByPath: (path: string) => (workingContents.has(path) ? createTestTFile(path) : null)
        },
        fileManager: {
            renameFile,
            trashFile
        }
    } as unknown as App;

    return { app, read, cachedRead, create, modify, append, renameFile, trashFile, workingContents };
}

describe('noteMerge', () => {
    it('strips only leading frontmatter blocks', () => {
        expect(stripLeadingFrontmatter('---\ntags: [draft]\n---\nBody')).toBe('Body');
        expect(stripLeadingFrontmatter('---\r\ntitle: Draft\r\n...\r\nBody')).toBe('Body');
        expect(stripLeadingFrontmatter('Intro\n---\nnot frontmatter\n---\nBody')).toBe('Intro\n---\nnot frontmatter\n---\nBody');
    });

    it('keeps first note frontmatter and strips frontmatter from appended notes', () => {
        const first = createTestTFile('First.md');
        const second = createTestTFile('Second.md');

        const merged = buildMergedNoteContent(
            [
                { file: first, content: '---\ntitle: First\n---\nAlpha\n' },
                { file: second, content: '---\ntags: [draft]\n---\n\nBeta\n' }
            ],
            'blank-line'
        );

        expect(merged).toBe('---\ntitle: First\n---\nAlpha\n\nBeta\n');
    });

    it('uses note headings as separators when selected', () => {
        const first = createTestTFile('First.md');
        const second = createTestTFile('Second.md');

        const merged = buildMergedNoteContent(
            [
                { file: first, content: 'Alpha' },
                { file: second, content: 'Beta' }
            ],
            'heading'
        );

        expect(merged).toBe('Alpha\n\n# Second\n\nBeta\n');
    });

    it('dedupes markdown files while preserving order', () => {
        const first = createTestTFile('First.md');
        const image = createTestTFile('Cover.png');
        const second = createTestTFile('Second.md');

        expect(getMarkdownFilesInOrder([first, image, second, first]).map(file => file.path)).toEqual(['First.md', 'Second.md']);
    });

    it('normalizes output names', () => {
        expect(normalizeMergeOutputBaseName('  .Merged: notes.md  ')).toBe('Merged notes');
    });

    it('creates a unique merged note with full content and trashes sources when requested', async () => {
        const first = createTestTFile('Folder/First.md');
        const second = createTestTFile('Folder/Second.md');
        const folder = createFolder('Folder');
        const { app, read, cachedRead, create, append, modify, renameFile, trashFile, workingContents } = createMergeApp(
            new Map([
                [first.path, 'Alpha'],
                [second.path, '---\ntags: [draft]\n---\nBeta']
            ]),
            new Set(['Folder/Merged notes.md'])
        );

        const result = await mergeNotes({
            app,
            files: [first, second],
            outputFolder: folder,
            outputName: 'Merged notes',
            separator: 'horizontal-rule',
            moveSourcesToTrash: true
        });

        expect(result.file.path).toBe('Folder/Merged notes 1.md');
        expect(result.failedSourceTrashCount).toBe(0);
        expect(result.outputOpenError).toBeNull();
        expect(read).toHaveBeenCalledTimes(2);
        expect(cachedRead).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledWith('Folder/Merged notes 1.md', 'Alpha\n\n---\n\nBeta\n');
        expect(append).not.toHaveBeenCalled();
        expect(modify).not.toHaveBeenCalled();
        expect(renameFile).not.toHaveBeenCalled();
        expect(workingContents.get('Folder/Merged notes 1.md')).toBe('Alpha\n\n---\n\nBeta\n');
        expect(trashFile).toHaveBeenCalledTimes(2);
        expect(trashFile).toHaveBeenNthCalledWith(1, first);
        expect(trashFile).toHaveBeenNthCalledWith(2, second);
    });

    it('keeps the merge successful when source trashing fails', async () => {
        const first = createTestTFile('Folder/First.md');
        const second = createTestTFile('Folder/Second.md');
        const folder = createFolder('Folder');
        const { app, create, trashFile, workingContents } = createMergeApp(
            new Map([
                [first.path, 'Alpha'],
                [second.path, 'Beta']
            ])
        );
        trashFile.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Trash unavailable'));
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const result = await mergeNotes({
                app,
                files: [first, second],
                outputFolder: folder,
                outputName: 'Merged notes',
                separator: 'blank-line',
                moveSourcesToTrash: true
            });

            expect(result.file.path).toBe('Folder/Merged notes.md');
            expect(result.failedSourceTrashCount).toBe(1);
            expect(result.outputOpenError).toBeNull();
            expect(create).toHaveBeenCalledWith('Folder/Merged notes.md', 'Alpha\n\nBeta\n');
            expect(workingContents.get('Folder/Merged notes.md')).toBe('Alpha\n\nBeta\n');
            expect(trashFile).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('opens the merged note before trashing sources', async () => {
        const first = createTestTFile('Folder/First.md');
        const second = createTestTFile('Folder/Second.md');
        const folder = createFolder('Folder');
        const { app, create, trashFile } = createMergeApp(
            new Map([
                [first.path, 'Alpha'],
                [second.path, 'Beta']
            ])
        );
        const openOutputFile = vi.fn(async () => undefined);

        const result = await mergeNotes({
            app,
            files: [first, second],
            outputFolder: folder,
            outputName: 'Merged notes',
            separator: 'blank-line',
            moveSourcesToTrash: true,
            openOutputFile
        });

        expect(result.outputOpenError).toBeNull();
        expect(create).toHaveBeenCalledTimes(1);
        expect(openOutputFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'Folder/Merged notes.md' }));
        expect(trashFile).toHaveBeenCalledTimes(2);
        expect(create.mock.invocationCallOrder[0]).toBeLessThan(openOutputFile.mock.invocationCallOrder[0]);
        expect(openOutputFile.mock.invocationCallOrder[0]).toBeLessThan(trashFile.mock.invocationCallOrder[0]);
    });

    it('uses the source trash callback after opening the merged note', async () => {
        const first = createTestTFile('Folder/First.md');
        const second = createTestTFile('Folder/Second.md');
        const folder = createFolder('Folder');
        const { app, create, trashFile } = createMergeApp(
            new Map([
                [first.path, 'Alpha'],
                [second.path, 'Beta']
            ])
        );
        const openOutputFile = vi.fn(async () => undefined);
        const trashSourceFiles = vi.fn(async () => 1);

        const result = await mergeNotes({
            app,
            files: [first, second],
            outputFolder: folder,
            outputName: 'Merged notes',
            separator: 'blank-line',
            moveSourcesToTrash: true,
            openOutputFile,
            trashSourceFiles
        });

        expect(result.failedSourceTrashCount).toBe(1);
        expect(create).toHaveBeenCalledTimes(1);
        expect(openOutputFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'Folder/Merged notes.md' }));
        expect(trashSourceFiles).toHaveBeenCalledWith([first, second]);
        expect(trashFile).not.toHaveBeenCalled();
        expect(create.mock.invocationCallOrder[0]).toBeLessThan(openOutputFile.mock.invocationCallOrder[0]);
        expect(openOutputFile.mock.invocationCallOrder[0]).toBeLessThan(trashSourceFiles.mock.invocationCallOrder[0]);
    });

    it('returns an open error and does not trash sources when opening the merged note fails', async () => {
        const first = createTestTFile('Folder/First.md');
        const second = createTestTFile('Folder/Second.md');
        const folder = createFolder('Folder');
        const { app, create, trashFile, workingContents } = createMergeApp(
            new Map([
                [first.path, 'Alpha'],
                [second.path, 'Beta']
            ])
        );
        const openOutputFile = vi.fn(async () => {
            throw new Error('Open failed');
        });

        const result = await mergeNotes({
            app,
            files: [first, second],
            outputFolder: folder,
            outputName: 'Merged notes',
            separator: 'blank-line',
            moveSourcesToTrash: true,
            openOutputFile
        });

        expect(result.file.path).toBe('Folder/Merged notes.md');
        expect(result.failedSourceTrashCount).toBe(0);
        expect(result.outputOpenError).toBeInstanceOf(Error);
        if (result.outputOpenError instanceof Error) {
            expect(result.outputOpenError.message).toBe('Open failed');
        }
        expect(create).toHaveBeenCalledWith('Folder/Merged notes.md', 'Alpha\n\nBeta\n');
        expect(workingContents.get('Folder/Merged notes.md')).toBe('Alpha\n\nBeta\n');
        expect(trashFile).not.toHaveBeenCalled();
    });
});
