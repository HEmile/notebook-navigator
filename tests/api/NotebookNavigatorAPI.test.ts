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
import { INTERNAL_NOTEBOOK_NAVIGATOR_API, NotebookNavigatorAPI } from '../../src/api/NotebookNavigatorAPI';
import { PropertyNodesAPI } from '../../src/api/modules/PropertyNodesAPI';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';

vi.mock('obsidian', async importOriginal => {
    const actual = await importOriginal<typeof import('obsidian')>();

    class Events {
        private listeners = new Map<string, Set<(data: unknown) => void>>();

        on(event: string, callback: (data: unknown) => void) {
            const listeners = this.listeners.get(event) ?? new Set<(data: unknown) => void>();
            listeners.add(callback);
            this.listeners.set(event, listeners);
            return { event, callback };
        }

        offref(ref: { event: string; callback: (data: unknown) => void }) {
            this.listeners.get(ref.event)?.delete(ref.callback);
        }

        trigger(event: string, data?: unknown) {
            this.listeners.get(event)?.forEach(callback => callback(data));
        }
    }

    return {
        ...actual,
        Events
    };
});

type WhenReadyHost = {
    storageReady: boolean;
    once: (event: 'storage-ready', callback: () => void) => unknown;
};

const invokeWhenReady = (host: WhenReadyHost): Promise<void> =>
    NotebookNavigatorAPI.prototype.whenReady.call(host as unknown as NotebookNavigatorAPI);

describe('NotebookNavigatorAPI', () => {
    it('resolves whenReady immediately when storage is already ready', async () => {
        const once = vi.fn();
        const apiLike = {
            storageReady: true,
            once
        };

        await expect(invokeWhenReady(apiLike)).resolves.toBeUndefined();
        expect(once).not.toHaveBeenCalled();
    });

    it('resolves whenReady after storage-ready fires', async () => {
        let readyCallback: () => void = () => {
            throw new Error('Expected whenReady() to register a storage-ready callback');
        };
        const once = vi.fn<WhenReadyHost['once']>((_event, callback) => {
            readyCallback = callback;
            return {};
        });
        const apiLike = {
            storageReady: false,
            once
        };

        const readyPromise: Promise<void> = invokeWhenReady(apiLike);
        expect(once).toHaveBeenCalledWith('storage-ready', expect.any(Function));

        readyCallback();

        await expect(readyPromise).resolves.toBeUndefined();
    });

    it('builds and parses canonical property node ids', () => {
        const propertyNodes = new PropertyNodesAPI();

        expect(propertyNodes.rootId).toBe('properties-root');
        expect(propertyNodes.buildKey('Status')).toBe('key:status');
        expect(propertyNodes.buildValue('Status', 'Done')).toBe('key:status=done');
        expect(propertyNodes.parse('key:Status=Done')).toEqual({
            kind: 'value',
            key: 'status',
            valuePath: 'done'
        });
        expect(propertyNodes.parse(propertyNodes.rootId)).toEqual({
            kind: 'root',
            key: null,
            valuePath: null
        });
        expect(propertyNodes.normalize('key:Status=Done')).toBe('key:status=done');
    });

    it('exposes public tag collection helpers', () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const api = new NotebookNavigatorAPI(
            {
                settings: structuredClone(DEFAULT_SETTINGS),
                activateView: vi.fn(async () => null)
            } as never,
            {
                vault: {
                    getFolderByPath: () => null,
                    getFileByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => []
                }
            } as never
        );

        expect(api.tagCollections.taggedId).toBe('__tagged__');
        expect(api.tagCollections.untaggedId).toBe('__untagged__');
        expect(api.tagCollections.isCollection('__tagged__')).toBe(true);
        expect(api.tagCollections.isCollection('work')).toBe(false);
        expect(typeof api.tagCollections.getLabel(api.tagCollections.taggedId)).toBe('string');
        expect(consoleLogSpy).not.toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    it('does not throw when tag collection labels are requested with invalid runtime input', () => {
        const api = new NotebookNavigatorAPI(
            {
                settings: structuredClone(DEFAULT_SETTINGS),
                activateView: vi.fn(async () => null)
            } as never,
            {
                vault: {
                    getFolderByPath: () => null,
                    getFileByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => []
                }
            } as never
        );

        expect(() => api.tagCollections.getLabel('work' as never)).not.toThrow();
        expect(api.tagCollections.getLabel('work' as never)).toBe('work');
    });

    it('exposes documented methods publicly and keeps internal controllers behind the internal symbol', () => {
        const api = new NotebookNavigatorAPI(
            {
                settings: structuredClone(DEFAULT_SETTINGS),
                activateView: vi.fn(async () => null)
            } as never,
            {
                vault: {
                    getFolderByPath: () => null,
                    getFileByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => []
                }
            } as never
        );

        expect('updateFromSettings' in api.metadata).toBe(false);
        expect('updateNavigationState' in api.selection).toBe(false);
        expect('applyFileMenuExtensions' in api.menus).toBe(false);
        expect(typeof api[INTERNAL_NOTEBOOK_NAVIGATOR_API].metadata.updateFromSettings).toBe('function');
        expect(typeof api[INTERNAL_NOTEBOOK_NAVIGATOR_API].selection.updateNavigationState).toBe('function');
        expect(typeof api[INTERNAL_NOTEBOOK_NAVIGATOR_API].menus.applyFileMenuExtensions).toBe('function');
    });

    it('keeps public storage readiness monotonic after the initial ready signal', () => {
        const api = new NotebookNavigatorAPI(
            {
                settings: structuredClone(DEFAULT_SETTINGS),
                activateView: vi.fn(async () => null)
            } as never,
            {
                vault: {
                    getFolderByPath: () => null,
                    getFileByPath: () => null
                },
                workspace: {
                    getLeavesOfType: () => []
                }
            } as never
        );

        const onReady = vi.fn();
        api.on('storage-ready', onReady);

        api[INTERNAL_NOTEBOOK_NAVIGATOR_API].setStorageReady(true);
        api[INTERNAL_NOTEBOOK_NAVIGATOR_API].setStorageReady(false);
        api[INTERNAL_NOTEBOOK_NAVIGATOR_API].setStorageReady(true);

        expect(api.isStorageReady()).toBe(true);
        expect(onReady).toHaveBeenCalledTimes(1);
    });
});
