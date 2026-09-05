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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TFolder, type WorkspaceLeaf } from 'obsidian';
import type NotebookNavigatorPlugin from '../../src/main';
import HomepageController from '../../src/services/workspace/HomepageController';
import type WorkspaceCoordinator from '../../src/services/workspace/WorkspaceCoordinator';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { resetMomentApiCacheForTests } from '../../src/utils/moment';
import { createTestTFile } from '../utils/createTestTFile';

vi.mock('obsidian', async importOriginal => {
    const actual = await importOriginal<typeof import('obsidian')>();

    class FileView {}

    return {
        ...actual,
        FileView
    };
});

function createMomentApiForYear(year: number) {
    class TestMoment {
        constructor(private readonly value: number) {}

        clone(): TestMoment {
            return new TestMoment(this.value);
        }

        format(format?: string): string {
            if (!format) {
                return this.value.toString();
            }
            return format.replace(/YYYY/g, this.value.toString());
        }

        isValid(): boolean {
            return true;
        }

        locale(): TestMoment {
            return this;
        }

        startOf(): TestMoment {
            return this;
        }
    }

    const momentApi = vi.fn((input?: string) => {
        if (typeof input === 'string') {
            const parsedYear = Number.parseInt(input.slice(0, 4), 10);
            return new TestMoment(Number.isFinite(parsedYear) ? parsedYear : year);
        }
        return new TestMoment(year);
    });

    return Object.assign(momentApi, {
        locales: () => ['en'],
        locale: () => 'en',
        fn: {},
        utc: vi.fn()
    });
}

function createMomentApiForDailyNoteLocale() {
    class TestMoment {
        constructor(private readonly localeId: string = 'en-gb') {}

        clone(): TestMoment {
            return new TestMoment(this.localeId);
        }

        format(format?: string): string {
            if (!format) {
                return '';
            }

            const monthName = this.localeId === 'uk' ? 'квітень' : 'April';
            return format.replace(/YYYY/g, '2026').replace(/MMMM/g, monthName).replace(/MM/g, '04').replace(/DD/g, '24');
        }

        isValid(): boolean {
            return true;
        }

        locale(locale: string): TestMoment {
            return new TestMoment(locale);
        }

        startOf(): TestMoment {
            return this;
        }
    }

    const momentApi = vi.fn(() => new TestMoment());

    return Object.assign(momentApi, {
        locales: () => ['en-gb', 'uk'],
        locale: () => 'en-gb',
        fn: {},
        utc: vi.fn()
    });
}

afterEach(() => {
    resetMomentApiCacheForTests();
    vi.unstubAllGlobals();
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
                    file: file.path,
                    createMissingPeriodicNote: false
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

    it('does not create a missing periodic homepage when creation is disabled', async () => {
        const momentApi = createMomentApiForYear(2026);
        vi.stubGlobal('window', { moment: momentApi });
        resetMomentApiCacheForTests();

        const root = new TFolder();
        root.path = '/';
        const createNewMarkdownFile = vi.fn();
        const openLinkText = vi.fn().mockResolvedValue(undefined);
        const app = {
            vault: {
                getAbstractFileByPath: vi.fn(() => null),
                getRoot: () => root,
                createFolder: vi.fn()
            },
            fileManager: {
                createNewMarkdownFile
            },
            workspace: {
                getLeavesOfType: vi.fn(() => []),
                openLinkText
            }
        };

        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.homepage = {
            source: 'yearly-note',
            file: null,
            createMissingPeriodicNote: false
        };

        const plugin = {
            app,
            settings,
            isShuttingDown: () => false
        } as unknown as NotebookNavigatorPlugin;

        const workspaceCoordinator = {
            revealFileInNearestFolder: vi.fn()
        } as unknown as WorkspaceCoordinator;

        const controller = new HomepageController(plugin, workspaceCoordinator);

        const result = await controller.open('startup');

        expect(result).toBe(false);
        expect(createNewMarkdownFile).not.toHaveBeenCalled();
        expect(openLinkText).not.toHaveBeenCalled();
    });

    it('creates and opens a missing yearly homepage when creation is enabled', async () => {
        const momentApi = createMomentApiForYear(2026);
        vi.stubGlobal('window', { moment: momentApi });
        resetMomentApiCacheForTests();

        const root = new TFolder();
        root.path = '/';
        const files = new Map<string, ReturnType<typeof createTestTFile>>();
        const openLinkText = vi.fn().mockResolvedValue(undefined);
        const createNewMarkdownFile = vi.fn(async (_folder: TFolder, baseName: string) => {
            const file = createTestTFile(`${baseName}.md`);
            files.set(file.path, file);
            return file;
        });
        const app = {
            vault: {
                getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
                getRoot: () => root,
                createFolder: vi.fn()
            },
            fileManager: {
                createNewMarkdownFile
            },
            workspace: {
                getLeavesOfType: vi.fn(() => []),
                openLinkText
            }
        };

        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.homepage = {
            source: 'yearly-note',
            file: null,
            createMissingPeriodicNote: true
        };
        settings.calendarCustomYearPattern = 'YYYY';

        const plugin = {
            app,
            settings,
            isShuttingDown: () => false
        } as unknown as NotebookNavigatorPlugin;

        const workspaceCoordinator = {
            revealFileInNearestFolder: vi.fn()
        } as unknown as WorkspaceCoordinator;

        const controller = new HomepageController(plugin, workspaceCoordinator);

        expect(controller.canOpenHomepage()).toBe(true);

        const result = await controller.open('startup');

        expect(result).toBe(true);
        expect(createNewMarkdownFile).toHaveBeenCalledWith(root, '2026');
        expect(openLinkText).toHaveBeenCalledWith('2026.md', '', false);
    });

    it('resolves core Daily Notes using the current moment locale instead of the selected calendar locale', async () => {
        const momentApi = createMomentApiForDailyNoteLocale();
        vi.stubGlobal('window', { moment: momentApi });
        resetMomentApiCacheForTests();

        const file = createTestTFile('Daily/2026-April-24.md');
        const getAbstractFileByPath = vi.fn((path: string) => (path === file.path ? file : null));
        const openLinkText = vi.fn().mockResolvedValue(undefined);
        const app = {
            internalPlugins: {
                getPluginById: vi.fn((pluginId: string) =>
                    pluginId === 'daily-notes'
                        ? {
                              enabled: true,
                              instance: {
                                  options: {
                                      folder: 'Daily',
                                      format: 'YYYY-MMMM-DD',
                                      template: ''
                                  }
                              }
                          }
                        : undefined
                )
            },
            vault: {
                getAbstractFileByPath
            },
            workspace: {
                getLeavesOfType: vi.fn(() => []),
                openLinkText
            }
        };

        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.calendarIntegrationMode = 'daily-notes';
        settings.calendarLocale = 'uk';
        settings.homepage = {
            source: 'daily-note',
            file: null,
            createMissingPeriodicNote: false
        };

        const plugin = {
            app,
            settings,
            isShuttingDown: () => false
        } as unknown as NotebookNavigatorPlugin;

        const workspaceCoordinator = {
            revealFileInNearestFolder: vi.fn()
        } as unknown as WorkspaceCoordinator;

        const controller = new HomepageController(plugin, workspaceCoordinator);

        const result = await controller.open('startup');

        expect(result).toBe(true);
        expect(getAbstractFileByPath).toHaveBeenCalledWith('Daily/2026-April-24.md');
        expect(getAbstractFileByPath).not.toHaveBeenCalledWith('Daily/2026-квітень-24.md');
        expect(openLinkText).toHaveBeenCalledWith(file.path, '', false);
    });
});
