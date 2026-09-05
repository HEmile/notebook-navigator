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
import { buildTagMenu } from '../../src/utils/contextMenu/tagMenuBuilder';
import { buildPropertyMenu } from '../../src/utils/contextMenu/propertyMenuBuilder';
import { INTERNAL_NOTEBOOK_NAVIGATOR_API } from '../../src/api/NotebookNavigatorAPI';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';

type MenuStub = {
    addItem: ReturnType<typeof vi.fn>;
    addSeparator: ReturnType<typeof vi.fn>;
};

function createMenu(): MenuStub {
    return {
        addItem: vi.fn(),
        addSeparator: vi.fn()
    };
}

function createBaseParams() {
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.showTagIcons = false;
    settings.showPropertyIcons = false;

    const selectionDispatch = vi.fn();
    const uiDispatch = vi.fn();

    return {
        settings,
        state: {
            selectionState: {
                selectionType: 'none',
                selectedTag: null,
                selectedProperty: null,
                selectedFile: null
            },
            expandedFolders: new Set<string>(),
            expandedTags: new Set<string>(),
            expandedProperties: new Set<string>()
        },
        dispatchers: {
            selectionDispatch,
            expansionDispatch: vi.fn(),
            uiDispatch
        },
        app: {
            workspace: {
                getActiveFile: () => null,
                requestSaveLayout: vi.fn()
            }
        }
    };
}

describe('navigation menu extension placement', () => {
    it('places tag menu extensions after navigation separator actions', () => {
        const { settings, state, dispatchers, app } = createBaseParams();
        const menu = createMenu();
        const applyTagMenuExtensions = vi.fn(() => 0);
        const hasNavigationSeparator = vi.fn(() => false);

        buildTagMenu({
            tagPath: 'work',
            menu: menu as never,
            settings,
            state: state as never,
            dispatchers: dispatchers,
            services: {
                app: app as never,
                plugin: {
                    settings,
                    api: {
                        [INTERNAL_NOTEBOOK_NAVIGATOR_API]: {
                            menus: {
                                applyTagMenuExtensions
                            }
                        }
                    }
                } as never,
                isMobile: false,
                fileSystemOps: {} as never,
                metadataService: {
                    getTagChildSortOrderOverride: vi.fn(() => undefined),
                    getTagIcon: vi.fn(() => undefined),
                    getTagColorData: vi.fn(() => ({ color: undefined, background: undefined })),
                    hasNavigationSeparator
                } as never,
                tagOperations: {} as never,
                propertyOperations: {} as never,
                tagTreeService: null,
                propertyTreeService: null,
                commandQueue: null,
                shortcuts: null,
                visibility: { includeDescendantNotes: false, showHiddenItems: false }
            }
        });

        expect(hasNavigationSeparator).toHaveBeenCalledTimes(1);
        expect(applyTagMenuExtensions).toHaveBeenCalledTimes(1);
        expect(hasNavigationSeparator.mock.invocationCallOrder[0]).toBeLessThan(applyTagMenuExtensions.mock.invocationCallOrder[0]);
    });

    it('places property menu extensions after navigation separator actions', () => {
        const { settings, state, dispatchers, app } = createBaseParams();
        const menu = createMenu();
        const applyPropertyMenuExtensions = vi.fn(() => 0);
        const hasNavigationSeparator = vi.fn(() => false);

        buildPropertyMenu({
            propertyNodeId: 'key:status',
            menu: menu as never,
            settings,
            state: state as never,
            dispatchers: dispatchers,
            services: {
                app: app as never,
                plugin: {
                    api: {
                        [INTERNAL_NOTEBOOK_NAVIGATOR_API]: {
                            menus: {
                                applyPropertyMenuExtensions
                            }
                        }
                    }
                } as never,
                isMobile: false,
                fileSystemOps: {} as never,
                metadataService: {
                    getPropertyColor: vi.fn(() => undefined),
                    getPropertyBackgroundColor: vi.fn(() => undefined),
                    getPropertyIcon: vi.fn(() => undefined),
                    getPropertyColorData: vi.fn(() => ({ color: undefined, background: undefined })),
                    getSettingsProvider: vi.fn(() => null),
                    hasNavigationSeparator
                } as never,
                propertyOperations: {} as never,
                tagOperations: {} as never,
                tagTreeService: null,
                propertyTreeService: null,
                commandQueue: null,
                shortcuts: null,
                visibility: { includeDescendantNotes: false, showHiddenItems: false }
            }
        });

        expect(hasNavigationSeparator).toHaveBeenCalledTimes(1);
        expect(applyPropertyMenuExtensions).toHaveBeenCalledTimes(1);
        expect(hasNavigationSeparator.mock.invocationCallOrder[0]).toBeLessThan(applyPropertyMenuExtensions.mock.invocationCallOrder[0]);
    });
});
