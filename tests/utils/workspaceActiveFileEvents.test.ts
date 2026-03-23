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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandQueueService } from '../../src/services/CommandQueueService';
import { registerActiveFileWorkspaceListeners } from '../../src/utils/workspaceActiveFileEvents';
import { createTestTFile } from './createTestTFile';

type ActiveLeafChangeHandler = () => void;
type FileOpenHandler = (file: ReturnType<typeof createTestTFile> | null) => void;

class MockWorkspace {
    private activeLeafChangeHandlers = new Set<ActiveLeafChangeHandler>();
    private fileOpenHandlers = new Set<FileOpenHandler>();

    on(name: 'active-leaf-change', callback: ActiveLeafChangeHandler): ActiveLeafChangeHandler;
    on(name: 'file-open', callback: FileOpenHandler): FileOpenHandler;
    on(name: 'active-leaf-change' | 'file-open', callback: ActiveLeafChangeHandler | FileOpenHandler) {
        if (name === 'active-leaf-change') {
            this.activeLeafChangeHandlers.add(callback as ActiveLeafChangeHandler);
            return callback;
        }

        this.fileOpenHandlers.add(callback as FileOpenHandler);
        return callback;
    }

    offref(ref: unknown) {
        this.activeLeafChangeHandlers.delete(ref as ActiveLeafChangeHandler);
        this.fileOpenHandlers.delete(ref as FileOpenHandler);
    }

    emitActiveLeafChange() {
        for (const handler of this.activeLeafChangeHandlers) {
            handler();
        }
    }

    emitFileOpen(file: ReturnType<typeof createTestTFile> | null) {
        for (const handler of this.fileOpenHandlers) {
            handler(file);
        }
    }
}

describe('registerActiveFileWorkspaceListeners', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        vi.stubGlobal('window', globalThis);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('coalesces file-open and active-leaf-change into one callback', () => {
        const workspace = new MockWorkspace();
        const file = createTestTFile('notes/day.md');
        const onChange = vi.fn();

        const cleanup = registerActiveFileWorkspaceListeners({
            workspace,
            onChange
        });

        workspace.emitFileOpen(file);
        workspace.emitActiveLeafChange();

        expect(onChange).not.toHaveBeenCalled();

        vi.runAllTimers();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith({
            candidateFile: file,
            ignoreBackgroundOpen: false
        });

        cleanup();
    });

    it('marks preview opens as background opens', async () => {
        const workspace = new MockWorkspace();
        const commandQueue = new CommandQueueService();
        const file = createTestTFile('notes/day.md');
        const onChange = vi.fn();

        let resolveOpenFile: () => void = () => {
            throw new Error('resolveOpenFile not set');
        };
        const openFilePromise = new Promise<void>(resolve => {
            resolveOpenFile = resolve;
        });

        const cleanup = registerActiveFileWorkspaceListeners({
            workspace,
            commandQueue,
            onChange
        });

        const openTask = commandQueue.executeOpenActiveFile(file, () => openFilePromise, { active: false });

        try {
            await Promise.resolve();

            workspace.emitFileOpen(file);
            vi.runAllTimers();

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith({
                candidateFile: file,
                ignoreBackgroundOpen: true
            });
        } finally {
            resolveOpenFile();
            await openTask;
            cleanup();
        }
    });
});
