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

describe('FileDeletionService replacement file activation', () => {
    it('opens the replacement file as active in a fallback leaf when the deleted file is not open', async () => {
        const deletedFile = createTestTFile('daily/2026-03-24.md');
        const replacementFile = createTestTFile('daily/2026-03-25.md');
        const { leaf: fallbackLeaf, openFileMock } = createLeaf();
        const service = createService();
        const app = (service as unknown as { app: App }).app;
        const getLeafMock = vi.fn().mockReturnValue(fallbackLeaf);

        vi.spyOn(service as never, 'getLeavesDisplayingFile').mockReturnValue([]);
        Object.defineProperty(app, 'workspace', {
            configurable: true,
            value: {
                getLeaf: getLeafMock
            }
        });

        await (
            service as unknown as {
                replaceOpenLeavesForFileDelete: (fileToReplace: TFile, replacement: TFile) => Promise<void>;
            }
        ).replaceOpenLeavesForFileDelete(deletedFile, replacementFile);

        expect(getLeafMock).toHaveBeenCalledWith(false);
        expect(openFileMock).toHaveBeenCalledTimes(1);
        expect(openFileMock).toHaveBeenCalledWith(replacementFile, { active: true });
    });

    it('opens the replacement file in the deleted file leaf when no file leaf is active', async () => {
        const deletedFile = createTestTFile('daily/2026-03-24.md');
        const replacementFile = createTestTFile('daily/2026-03-25.md');
        const { leaf: deletedFileLeaf, openFileMock } = createLeaf();
        const service = createService();

        vi.spyOn(service as never, 'getLeavesDisplayingFile').mockReturnValue([deletedFileLeaf]);
        vi.spyOn(service as never, 'getActiveFileViewLeaf').mockReturnValue(null);

        await (
            service as unknown as {
                replaceOpenLeavesForFileDelete: (fileToReplace: TFile, replacement: TFile) => Promise<void>;
            }
        ).replaceOpenLeavesForFileDelete(deletedFile, replacementFile);

        expect(openFileMock).toHaveBeenCalledTimes(1);
        expect(openFileMock).toHaveBeenCalledWith(replacementFile, { active: true });
    });

    it('opens the replacement file as active when replacing the active leaf after single delete', async () => {
        const deletedFile = createTestTFile('daily/2026-03-24.md');
        const replacementFile = createTestTFile('daily/2026-03-25.md');
        const { leaf: activeLeaf, openFileMock } = createLeaf();
        const service = createService();

        vi.spyOn(service as never, 'getLeavesDisplayingFile').mockReturnValue([activeLeaf]);
        vi.spyOn(service as never, 'getActiveFileViewLeaf').mockReturnValue(activeLeaf);

        await (
            service as unknown as {
                replaceOpenLeavesForFileDelete: (fileToReplace: TFile, replacement: TFile) => Promise<void>;
            }
        ).replaceOpenLeavesForFileDelete(deletedFile, replacementFile);

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

        vi.spyOn(service as never, 'getLeavesDisplayingFile')
            .mockReturnValueOnce([activeLeaf])
            .mockReturnValueOnce([secondLeaf]);
        vi.spyOn(service as never, 'getActiveFileViewLeaf').mockReturnValue(activeLeaf);

        await (
            service as unknown as {
                replaceOpenLeavesForFilesDelete: (filesToReplace: readonly TFile[], replacement: TFile) => Promise<void>;
            }
        ).replaceOpenLeavesForFilesDelete([deletedFileOne, deletedFileTwo], replacementFile);

        expect(openFileMock).toHaveBeenCalledTimes(1);
        expect(openFileMock).toHaveBeenCalledWith(replacementFile, { active: true });
    });
});
