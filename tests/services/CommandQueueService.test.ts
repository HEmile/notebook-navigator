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
import { createTestTFile } from '../utils/createTestTFile';

function createDeferredVoid(): { promise: Promise<void>; resolve: () => void } {
    let resolveFn: (() => void) | null = null;
    const promise = new Promise<void>(resolve => {
        resolveFn = () => resolve(undefined);
    });
    if (!resolveFn) {
        throw new Error('Deferred promise resolver not initialized');
    }
    return { promise, resolve: resolveFn };
}

describe('CommandQueueService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('tracks recent preview opens after completion', async () => {
        const commandQueue = new CommandQueueService();
        const file = createTestTFile('notes/test.md');

        const openGate = createDeferredVoid();
        const openFile = vi.fn(async () => openGate.promise);

        const task = commandQueue.executeOpenActiveFile(file, openFile, { active: false });
        await Promise.resolve();

        expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(true);

        openGate.resolve();
        await task;

        expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(true);

        vi.advanceTimersByTime(500);
        expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(false);
    });

    it('does not report active:true opens as background', async () => {
        const commandQueue = new CommandQueueService();
        const file = createTestTFile('notes/test.md');

        const openGate = createDeferredVoid();
        const openFile = vi.fn(async () => openGate.promise);

        const task = commandQueue.executeOpenActiveFile(file, openFile, { active: true });
        await Promise.resolve();

        expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(false);

        openGate.resolve();
        await task;

        expect(commandQueue.isOpeningActiveFileInBackground(file.path)).toBe(false);
    });
});
