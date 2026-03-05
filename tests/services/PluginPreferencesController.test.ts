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

const { mockLocalStorageStore, localStorageInit, localStorageGet, localStorageSet, localStorageRemove } = vi.hoisted(() => {
    const mockLocalStorageStore = new Map<string, unknown>();
    const localStorageInit = vi.fn();
    const localStorageGet = vi.fn((key: string) => (mockLocalStorageStore.has(key) ? (mockLocalStorageStore.get(key) ?? null) : null));
    const localStorageSet = vi.fn((key: string, value: unknown) => {
        mockLocalStorageStore.set(key, value);
        return true;
    });
    const localStorageRemove = vi.fn((key: string) => {
        mockLocalStorageStore.delete(key);
        return true;
    });

    return { mockLocalStorageStore, localStorageInit, localStorageGet, localStorageSet, localStorageRemove };
});

vi.mock('../../src/utils/localStorage', () => {
    return {
        localStorage: {
            init: localStorageInit,
            get: localStorageGet,
            set: localStorageSet,
            remove: localStorageRemove
        }
    };
});

vi.stubGlobal('window', globalThis);

import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { PluginPreferencesController } from '../../src/services/settings/PluginPreferencesController';
import { STORAGE_KEYS } from '../../src/types';

describe('PluginPreferencesController', () => {
    let controller: PluginPreferencesController;
    let isShuttingDown = false;

    beforeEach(() => {
        vi.useFakeTimers();
        mockLocalStorageStore.clear();
        vi.clearAllMocks();
        isShuttingDown = false;

        controller = new PluginPreferencesController({
            keys: STORAGE_KEYS,
            getSettings: () => DEFAULT_SETTINGS,
            notifySettingsUpdate: vi.fn(),
            saveSettings: vi.fn(async () => undefined),
            isShuttingDown: () => isShuttingDown,
            isLocal: vi.fn(() => false),
            persistSyncModeSettingUpdate: vi.fn(),
            persistSyncModeSettingUpdateAsync: vi.fn(async () => undefined),
            isOmnisearchAvailable: vi.fn(() => true),
            refreshMatcherCachesIfNeeded: vi.fn()
        });

        controller.initializeRecentDataManager();
    });

    afterEach(() => {
        controller.dispose();
        vi.useRealTimers();
    });

    it('skips recent-data listeners while shutdown is in progress', () => {
        const listener = vi.fn();
        controller.registerRecentDataListener('test-listener', listener);

        controller.setRecentNotes(['note-a.md']);
        isShuttingDown = true;
        controller.flushPendingPersists();

        expect(listener).not.toHaveBeenCalled();
        expect(localStorageSet).toHaveBeenCalledWith(STORAGE_KEYS.recentNotesKey, {
            [DEFAULT_SETTINGS.vaultProfile]: ['note-a.md']
        });
    });
});
