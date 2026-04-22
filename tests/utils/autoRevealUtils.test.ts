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

import { WorkspaceLeaf } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandQueueService } from '../../src/services/CommandQueueService';
import { isLeafInNavigatorWindow, shouldSkipNavigatorAutoReveal } from '../../src/utils/autoRevealUtils';
import { createTestTFile } from './createTestTFile';

function createMockLeaf(win: Window): WorkspaceLeaf {
    return {
        getContainer: () => ({ win })
    } as unknown as WorkspaceLeaf;
}

describe('shouldSkipNavigatorAutoReveal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('skips auto-reveal for navigator preview opens (active: false)', async () => {
        const commandQueue = new CommandQueueService();
        const file = createTestTFile('notes/note.md');

        let resolveOpenFile: () => void = () => {
            throw new Error('resolveOpenFile not set');
        };
        const openFilePromise = new Promise<void>(resolve => {
            resolveOpenFile = () => resolve();
        });

        const openTask = commandQueue.executeOpenActiveFile(file, () => openFilePromise, { active: false });

        try {
            await Promise.resolve();

            expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(true);

            expect(
                shouldSkipNavigatorAutoReveal({
                    hasNavigatorFocus: true,
                    isOpeningVersionHistory: false,
                    isOpeningInNewContext: false,
                    isNavigatorOpeningSelectedFile: false,
                    ignoreNavigatorPreviewOpen: commandQueue.isOpeningActiveFileInBackground(file.path)
                })
            ).toBe(true);
        } finally {
            resolveOpenFile();
            await openTask;
        }

        expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(true);
        vi.advanceTimersByTime(500);
        expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(false);
    });

    it('does not treat active opens as preview opens (active: true)', async () => {
        const commandQueue = new CommandQueueService();
        const file = createTestTFile('notes/note.md');

        let resolveOpenFile: () => void = () => {
            throw new Error('resolveOpenFile not set');
        };
        const openFilePromise = new Promise<void>(resolve => {
            resolveOpenFile = () => resolve();
        });

        const openTask = commandQueue.executeOpenActiveFile(file, () => openFilePromise, { active: true });

        try {
            await Promise.resolve();

            expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(false);

            expect(
                shouldSkipNavigatorAutoReveal({
                    hasNavigatorFocus: true,
                    isOpeningVersionHistory: false,
                    isOpeningInNewContext: false,
                    isNavigatorOpeningSelectedFile: false,
                    ignoreNavigatorPreviewOpen: commandQueue.isOpeningActiveFileInBackground(file.path)
                })
            ).toBe(false);
        } finally {
            resolveOpenFile();
            await openTask;
        }
    });

    it('matches active leaves against navigator windows', () => {
        const primaryWindow = { name: 'primary' } as unknown as Window;
        const secondaryWindow = { name: 'secondary' } as unknown as Window;
        const activeLeaf = createMockLeaf(primaryWindow);
        const navigatorLeaf = createMockLeaf(primaryWindow);
        const otherNavigatorLeaf = createMockLeaf(secondaryWindow);

        expect(isLeafInNavigatorWindow(activeLeaf, [navigatorLeaf])).toBe(true);
        expect(isLeafInNavigatorWindow(activeLeaf, [otherNavigatorLeaf])).toBe(false);
        expect(isLeafInNavigatorWindow(null, [navigatorLeaf])).toBe(false);
    });
});
