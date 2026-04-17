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
import type { WorkspaceLeaf } from 'obsidian';
import type NotebookNavigatorPlugin from '../../src/main';
import { NOTEBOOK_NAVIGATOR_CALENDAR_VIEW } from '../../src/types';

vi.mock('../../src/view/NotebookNavigatorView', () => ({
    NotebookNavigatorView: class NotebookNavigatorView {}
}));

import WorkspaceCoordinator from '../../src/services/workspace/WorkspaceCoordinator';

describe('WorkspaceCoordinator', () => {
    it('reuses an existing calendar leaf without creating a new right sidebar leaf', async () => {
        const existingLeaf = {
            detach: vi.fn()
        } as unknown as WorkspaceLeaf;
        const getLeavesOfType = vi.fn(() => [existingLeaf]);
        const revealLeaf = vi.fn().mockResolvedValue(undefined);
        const setActiveLeaf = vi.fn();
        const getRightLeaf = vi.fn();

        const plugin = {
            app: {
                workspace: {
                    getLeavesOfType,
                    revealLeaf,
                    setActiveLeaf,
                    getRightLeaf
                }
            }
        } as unknown as NotebookNavigatorPlugin;

        const coordinator = new WorkspaceCoordinator(plugin);
        const leaf = await coordinator.ensureCalendarViewInRightSidebar();

        expect(leaf).toBe(existingLeaf);
        expect(getLeavesOfType).toHaveBeenCalledWith(NOTEBOOK_NAVIGATOR_CALENDAR_VIEW);
        expect(getRightLeaf).not.toHaveBeenCalled();
        expect(revealLeaf).not.toHaveBeenCalled();
        expect(setActiveLeaf).not.toHaveBeenCalled();
    });

    it('reveals an existing calendar leaf when requested', async () => {
        const existingLeaf = {
            detach: vi.fn()
        } as unknown as WorkspaceLeaf;
        const revealLeaf = vi.fn().mockResolvedValue(undefined);
        const setActiveLeaf = vi.fn();

        const plugin = {
            app: {
                workspace: {
                    getLeavesOfType: vi.fn(() => [existingLeaf]),
                    revealLeaf,
                    setActiveLeaf,
                    getRightLeaf: vi.fn()
                }
            }
        } as unknown as NotebookNavigatorPlugin;

        const coordinator = new WorkspaceCoordinator(plugin);
        const leaf = await coordinator.ensureCalendarViewInRightSidebar({ reveal: true, activate: true });

        expect(leaf).toBe(existingLeaf);
        expect(revealLeaf).toHaveBeenCalledWith(existingLeaf);
        expect(setActiveLeaf).not.toHaveBeenCalled();
    });

    it('creates a right sidebar calendar leaf only when no calendar leaf exists', async () => {
        const setViewState = vi.fn().mockResolvedValue(undefined);
        const createdLeaf = {
            detach: vi.fn(),
            setViewState
        } as unknown as WorkspaceLeaf;
        const revealLeaf = vi.fn().mockResolvedValue(undefined);
        const getRightLeaf = vi.fn(() => createdLeaf);

        const plugin = {
            app: {
                workspace: {
                    getLeavesOfType: vi.fn(() => []),
                    revealLeaf,
                    setActiveLeaf: vi.fn(),
                    getRightLeaf
                }
            }
        } as unknown as NotebookNavigatorPlugin;

        const coordinator = new WorkspaceCoordinator(plugin);
        const leaf = await coordinator.ensureCalendarViewInRightSidebar({ reveal: true, activate: true });

        expect(leaf).toBe(createdLeaf);
        expect(getRightLeaf).toHaveBeenCalledWith(false);
        expect(setViewState).toHaveBeenCalledWith({
            type: NOTEBOOK_NAVIGATOR_CALENDAR_VIEW,
            active: true
        });
        expect(revealLeaf).toHaveBeenCalledWith(createdLeaf);
    });

    it('detaches a newly created leaf when the request is canceled before reveal', async () => {
        const detach = vi.fn();
        const createdLeaf = {
            detach,
            setViewState: vi.fn().mockResolvedValue(undefined)
        } as unknown as WorkspaceLeaf;
        const revealLeaf = vi.fn().mockResolvedValue(undefined);
        const shouldContinue = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);

        const plugin = {
            app: {
                workspace: {
                    getLeavesOfType: vi.fn(() => []),
                    revealLeaf,
                    setActiveLeaf: vi.fn(),
                    getRightLeaf: vi.fn(() => createdLeaf)
                }
            }
        } as unknown as NotebookNavigatorPlugin;

        const coordinator = new WorkspaceCoordinator(plugin);
        const leaf = await coordinator.ensureCalendarViewInRightSidebar({ reveal: true, shouldContinue });

        expect(leaf).toBeNull();
        expect(detach).toHaveBeenCalled();
        expect(revealLeaf).not.toHaveBeenCalled();
    });
});
