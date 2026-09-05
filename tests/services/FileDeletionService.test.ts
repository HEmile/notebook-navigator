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
import { App, type TFile, type TFolder, type WorkspaceLeaf } from 'obsidian';
import { FileDeletionService } from '../../src/services/fileSystem/FileDeletionService';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { ItemType } from '../../src/types';
import { createTestTFile } from '../utils/createTestTFile';

vi.mock('../../src/modals/ConfirmModal', () => ({
    ConfirmModal: class ConfirmModal {
        open(): void {}
    }
}));

function createLeaf() {
    const openFileMock = vi.fn(async () => undefined);
    const setViewStateMock = vi.fn(async () => undefined);
    const detachMock = vi.fn();
    const leaf = {
        openFile: openFileMock,
        setViewState: setViewStateMock,
        detach: detachMock
    } as unknown as WorkspaceLeaf;
    return { detachMock, leaf, openFileMock, setViewStateMock };
}

function createService() {
    const app = new App();

    return new FileDeletionService({
        app,
        settingsProvider: {
            settings: DEFAULT_SETTINGS,
            saveSettingsAndUpdate: vi.fn().mockResolvedValue(undefined),
            notifySettingsUpdate: vi.fn(),
            getRecentNotes: () => [],
            setRecentNotes: vi.fn(),
            getRecentIcons: () => ({}),
            setRecentIcons: vi.fn(),
            getRecentColors: () => [],
            setRecentColors: vi.fn()
        },
        getTagTreeService: () => null,
        getPropertyTreeService: () => null,
        getCommandQueue: () => null,
        getVisibilityPreferences: () => ({ includeDescendantNotes: false, showHiddenItems: false }),
        resolveFolderDisplayLabel: (folder: TFolder) => folder.name,
        notifyError: vi.fn(),
        folderPathSettingsSync: {
            removeHiddenFolderPathMatch: vi.fn(async () => undefined)
        } as never
    });
}

type FileDeletionServiceTestAccess = {
    readonly app: App;
    hasOpenLeafForFiles(files: readonly TFile[]): boolean;
    getLeavesDisplayingFile(file: TFile): WorkspaceLeaf[];
    getActiveFileViewLeaf(): WorkspaceLeaf | null;
    clearOpenLeavesForFileDelete(file: TFile): Promise<void>;
    replaceOpenLeavesForFileDelete(fileToReplace: TFile, replacement: TFile): Promise<void>;
    replaceOpenLeavesForFilesDelete(filesToReplace: readonly TFile[], replacement: TFile): Promise<void>;
};

function getTestAccess(service: FileDeletionService): FileDeletionServiceTestAccess {
    return service as unknown as FileDeletionServiceTestAccess;
}

describe('FileDeletionService replacement file activation', () => {
    it('uses open-leaf cleanup when trashing files directly', async () => {
        const first = createTestTFile('daily/2026-03-24.md');
        const second = createTestTFile('daily/2026-03-25.md');
        const service = createService();
        const serviceAccess = getTestAccess(service);
        const app = serviceAccess.app;
        const trashFile = vi.fn(async () => undefined);
        const hasOpenLeafSpy = vi.spyOn(serviceAccess, 'hasOpenLeafForFiles').mockReturnValue(true);
        const clearOpenLeavesSpy = vi.spyOn(serviceAccess, 'clearOpenLeavesForFileDelete').mockResolvedValue(undefined);

        Object.defineProperty(app, 'fileManager', {
            configurable: true,
            value: {
                trashFile
            }
        });

        const result = await service.trashFilesWithOpenLeafCleanup([first, second]);

        expect(result).toMatchObject({
            trashedCount: 2,
            failedCount: 0,
            trashedSourcePaths: [first.path, second.path],
            errors: []
        });
        expect(hasOpenLeafSpy).toHaveBeenCalledWith([first, second]);
        expect(clearOpenLeavesSpy).toHaveBeenNthCalledWith(1, first);
        expect(clearOpenLeavesSpy).toHaveBeenNthCalledWith(2, second);
        expect(trashFile).toHaveBeenNthCalledWith(1, first);
        expect(trashFile).toHaveBeenNthCalledWith(2, second);
    });

    it('opens the replacement file as active in a fallback leaf when the deleted file is not open', async () => {
        const deletedFile = createTestTFile('daily/2026-03-24.md');
        const replacementFile = createTestTFile('daily/2026-03-25.md');
        const { leaf: fallbackLeaf, openFileMock } = createLeaf();
        const service = createService();
        const serviceAccess = getTestAccess(service);
        const app = serviceAccess.app;
        const getLeafMock = vi.fn().mockReturnValue(fallbackLeaf);

        vi.spyOn(serviceAccess, 'getLeavesDisplayingFile').mockReturnValue([]);
        Object.defineProperty(app, 'workspace', {
            configurable: true,
            value: {
                getLeaf: getLeafMock
            }
        });

        await serviceAccess.replaceOpenLeavesForFileDelete(deletedFile, replacementFile);

        expect(getLeafMock).toHaveBeenCalledWith(false);
        expect(openFileMock).toHaveBeenCalledTimes(1);
        expect(openFileMock).toHaveBeenCalledWith(replacementFile, { active: true });
    });

    it('opens the replacement file in the deleted file leaf when no file leaf is active', async () => {
        const deletedFile = createTestTFile('daily/2026-03-24.md');
        const replacementFile = createTestTFile('daily/2026-03-25.md');
        const { leaf: deletedFileLeaf, openFileMock } = createLeaf();
        const service = createService();
        const serviceAccess = getTestAccess(service);

        vi.spyOn(serviceAccess, 'getLeavesDisplayingFile').mockReturnValue([deletedFileLeaf]);
        vi.spyOn(serviceAccess, 'getActiveFileViewLeaf').mockReturnValue(null);

        await serviceAccess.replaceOpenLeavesForFileDelete(deletedFile, replacementFile);

        expect(openFileMock).toHaveBeenCalledTimes(1);
        expect(openFileMock).toHaveBeenCalledWith(replacementFile, { active: true });
    });

    it('opens the replacement file as active when replacing the active leaf after single delete', async () => {
        const deletedFile = createTestTFile('daily/2026-03-24.md');
        const replacementFile = createTestTFile('daily/2026-03-25.md');
        const { leaf: activeLeaf, openFileMock } = createLeaf();
        const service = createService();
        const serviceAccess = getTestAccess(service);

        vi.spyOn(serviceAccess, 'getLeavesDisplayingFile').mockReturnValue([activeLeaf]);
        vi.spyOn(serviceAccess, 'getActiveFileViewLeaf').mockReturnValue(activeLeaf);

        await serviceAccess.replaceOpenLeavesForFileDelete(deletedFile, replacementFile);

        expect(openFileMock).toHaveBeenCalledTimes(1);
        expect(openFileMock).toHaveBeenCalledWith(replacementFile, { active: true });
    });

    it('opens the replacement file as active when replacing the active leaf after multi-delete', async () => {
        const deletedFileOne = createTestTFile('daily/2026-03-24.md');
        const deletedFileTwo = createTestTFile('daily/2026-03-25.md');
        const replacementFile = createTestTFile('daily/2026-03-26.md');
        const { leaf: activeLeaf, openFileMock } = createLeaf();
        const { leaf: secondLeaf } = createLeaf();
        const service = createService();
        const serviceAccess = getTestAccess(service);

        vi.spyOn(serviceAccess, 'getLeavesDisplayingFile').mockReturnValueOnce([activeLeaf]).mockReturnValueOnce([secondLeaf]);
        vi.spyOn(serviceAccess, 'getActiveFileViewLeaf').mockReturnValue(activeLeaf);

        await serviceAccess.replaceOpenLeavesForFilesDelete([deletedFileOne, deletedFileTwo], replacementFile);

        expect(openFileMock).toHaveBeenCalledTimes(1);
        expect(openFileMock).toHaveBeenCalledWith(replacementFile, { active: true });
    });

    it('uses the supplied visible file order when selecting after single delete', async () => {
        const firstVisibleFile = createTestTFile('Folder/direct.md');
        const deletedFile = createTestTFile('Folder/Child/deleted.md');
        const nextVisibleFile = createTestTFile('Folder/Other/next.md');
        const service = createService();
        const serviceAccess = getTestAccess(service);
        const app = serviceAccess.app;
        const trashFile = vi.fn(async () => undefined);
        const selectionDispatch = vi.fn();
        const filesByPath = new Map([
            [firstVisibleFile.path, firstVisibleFile],
            [deletedFile.path, deletedFile],
            [nextVisibleFile.path, nextVisibleFile]
        ]);

        vi.spyOn(app.vault, 'getFileByPath').mockImplementation(path => filesByPath.get(path) ?? null);
        vi.spyOn(serviceAccess, 'replaceOpenLeavesForFileDelete').mockResolvedValue(undefined);
        Object.defineProperty(app, 'fileManager', {
            configurable: true,
            value: {
                trashFile
            }
        });

        await service.deleteSelectedFile(
            deletedFile,
            DEFAULT_SETTINGS,
            {
                selectionType: ItemType.FOLDER
            },
            selectionDispatch,
            false,
            [firstVisibleFile, deletedFile, nextVisibleFile]
        );

        expect(selectionDispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_FILE', file: nextVisibleFile });
        expect(trashFile).toHaveBeenCalledWith(deletedFile);
    });
});
