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
import { describe, it, expect, vi } from 'vitest';
import { NavigationAPI } from '../../src/api/modules/NavigationAPI';
import { TFile, TFolder } from 'obsidian';
import { createTestTFile } from '../utils/createTestTFile';

function createView() {
    return {
        navigateToFile: vi.fn<(file: TFile) => boolean>(() => true),
        navigateToFolder: vi.fn<(folder: TFolder | string, options?: { preserveNavigationFocus?: boolean }) => boolean>(() => true),
        navigateToTag: vi.fn<(tag: string) => string | null>(() => 'work'),
        navigateToProperty: vi.fn<(nodeId: string) => string | null>(() => 'key:status=done'),
        whenReady: vi.fn(async () => true)
    };
}

describe('NavigationAPI', () => {
    it('navigates to a folder via the navigator view', async () => {
        const view = createView();

        const folder = new TFolder();
        folder.path = 'Projects';
        const resolvedFolder = new TFolder();
        resolvedFolder.path = 'Projects';

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: () => null,
                    getFolderByPath: (path: string) => (path === folder.path ? resolvedFolder : null)
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await expect(navigationAPI.navigateToFolder(folder)).resolves.toBe(true);

        expect(view.navigateToFolder).toHaveBeenCalledWith(resolvedFolder, { preserveNavigationFocus: true });
    });

    it('supports folder path strings', async () => {
        const view = createView();
        const resolvedFolder = new TFolder();
        resolvedFolder.path = 'Projects';

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: () => null,
                    getFolderByPath: (path: string) => (path === 'Projects' ? resolvedFolder : null)
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await expect(navigationAPI.navigateToFolder('Projects')).resolves.toBe(true);

        expect(view.navigateToFolder).toHaveBeenCalledWith(resolvedFolder, { preserveNavigationFocus: true });
    });

    it('returns false when the folder does not resolve', async () => {
        const view = createView();
        const activateView = vi.fn(async () => null);

        const folder = new TFolder();
        folder.path = 'Missing';

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: () => null,
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await expect(navigationAPI.navigateToFolder(folder)).resolves.toBe(false);

        expect(view.navigateToFolder).not.toHaveBeenCalled();
        expect(activateView).not.toHaveBeenCalled();
    });

    it('finds the navigator view when multiple leaves exist', async () => {
        const view = createView();

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: () => null,
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view: {} }, { view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await expect(navigationAPI.navigateToTag('#work')).resolves.toBe(true);

        expect(view.navigateToTag).toHaveBeenCalledWith('#work');
    });

    it('returns false when tag navigation does not resolve', async () => {
        const view = createView();
        view.navigateToTag.mockReturnValue(null);

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: () => null,
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await expect(navigationAPI.navigateToTag('#work')).resolves.toBe(false);

        expect(view.navigateToTag).toHaveBeenCalledWith('#work');
    });

    it('returns false when property navigation does not resolve', async () => {
        const view = createView();
        view.navigateToProperty.mockReturnValue(null);

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: () => null,
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await expect(navigationAPI.navigateToProperty('key:status=done')).resolves.toBe(false);

        expect(view.navigateToProperty).toHaveBeenCalledWith('key:status=done');
    });

    it('reveals a file by object or path and reports missing files', async () => {
        const view = createView();
        const file = createTestTFile('Projects/Note.md');
        const activateView = vi.fn(async () => null);

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: (path: string) => (path === file.path ? file : null),
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView
            })
        };

        const navigationAPI = new NavigationAPI(api);

        await expect(navigationAPI.reveal(file)).resolves.toBe(true);
        await expect(navigationAPI.reveal(file.path)).resolves.toBe(true);
        await expect(navigationAPI.reveal('Missing.md')).resolves.toBe(false);

        expect(view.navigateToFile).toHaveBeenCalledTimes(2);
        expect(view.navigateToFile).toHaveBeenNthCalledWith(1, file);
        expect(view.navigateToFile).toHaveBeenNthCalledWith(2, file);
        expect(activateView).not.toHaveBeenCalled();
    });

    it('waits for the navigator view to finish mounting before using return values', async () => {
        const view = createView();
        const whenReady = vi.fn(async () => true);
        view.whenReady = whenReady;

        const api: ConstructorParameters<typeof NavigationAPI>[0] = {
            app: {
                vault: {
                    getFileByPath: () => null,
                    getFolderByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => [{ view }]
                }
            },
            getPlugin: () => ({
                activateView: vi.fn(async () => null)
            })
        };

        const navigationAPI = new NavigationAPI(api);
        await expect(navigationAPI.navigateToTag('#work')).resolves.toBe(true);

        expect(whenReady).toHaveBeenCalledTimes(1);
    });
});
