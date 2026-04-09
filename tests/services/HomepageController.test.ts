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
import HomepageController from '../../src/services/workspace/HomepageController';
import type WorkspaceCoordinator from '../../src/services/workspace/WorkspaceCoordinator';
import { createTestTFile } from '../utils/createTestTFile';

vi.mock('obsidian', async importOriginal => {
    const actual = await importOriginal<typeof import('obsidian')>();

    class FileView {}

    return {
        ...actual,
        FileView
    };
});

describe('HomepageController', () => {
    it('reuses an existing homepage leaf on startup without reopening the file', async () => {
        const file = createTestTFile('notes/home.md');
        const existingLeaf = {
            view: {
                getState: () => ({ file: file.path })
            },
            getViewState: () => ({ state: { file: file.path } })
        } as unknown as WorkspaceLeaf;

        const getAbstractFileByPath = vi.fn((path: string) => (path === file.path ? file : null));
        const getLeavesOfType = vi.fn(() => [existingLeaf]);
        const revealLeaf = vi.fn().mockResolvedValue(undefined);
        const setActiveLeaf = vi.fn();
        const openLinkText = vi.fn().mockResolvedValue(undefined);

        const app = {
            vault: {
                getAbstractFileByPath
            },
            workspace: {
                getLeavesOfType,
                revealLeaf,
                setActiveLeaf,
                openLinkText
            }
        };

        const plugin = {
            app,
            settings: {
                homepage: {
                    source: 'file',
                    file: file.path
                },
                autoRevealActiveFile: true,
                startView: 'navigation'
            },
            isShuttingDown: () => false
        } as unknown as NotebookNavigatorPlugin;

        const revealFileInNearestFolder = vi.fn();
        const workspaceCoordinator = {
            revealFileInNearestFolder
        } as unknown as WorkspaceCoordinator;

        const controller = new HomepageController(plugin, workspaceCoordinator);

        const result = await controller.open('startup');

        expect(result).toBe(true);
        expect(revealLeaf).toHaveBeenCalledWith(existingLeaf);
        expect(setActiveLeaf).toHaveBeenCalledWith(existingLeaf, { focus: true });
        expect(revealFileInNearestFolder).toHaveBeenCalledWith(file, {
            source: 'startup',
            isStartupReveal: true,
            preserveNavigationFocus: true
        });
        expect(openLinkText).not.toHaveBeenCalled();
    });
});
