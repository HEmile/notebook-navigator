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

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { PluginSettingsController } from '../../src/services/settings/PluginSettingsController';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { STORAGE_KEYS } from '../../src/types';
import { buildPropertySeparatorKey, buildTagSeparatorKey } from '../../src/utils/navigationSeparators';
import { buildPropertyValueNodeId } from '../../src/utils/propertyTree';

beforeEach(() => {
    mockLocalStorageStore.clear();
    vi.clearAllMocks();
});

describe('PluginSettingsController.normalizeTagSettings', () => {
    it('canonicalizes tag metadata keys and hidden-tag rules across NFC and NFD-equivalent forms', () => {
        const controller = new PluginSettingsController({
            keys: STORAGE_KEYS,
            loadData: vi.fn().mockResolvedValue(null),
            saveData: vi.fn().mockResolvedValue(undefined),
            mirrorUXPreferences: vi.fn()
        });
        const settings = structuredClone(DEFAULT_SETTINGS);

        settings.tagColors = { 're\u0301union': '#112233' };
        settings.tagBackgroundColors = { '#re\u0301union': '#223344' };
        settings.tagTreeSortOverrides = { 're\u0301union': 'alpha-desc' };
        settings.vaultProfiles[0].hiddenTags = ['re\u0301union', 'réunion'];
        settings.vaultProfiles[0].hiddenFileTags = ['#re\u0301union', 'réunion'];

        controller.settings = settings;
        controller.normalizeTagSettings();

        expect(controller.settings.tagColors).toEqual({ réunion: '#112233' });
        expect(controller.settings.tagBackgroundColors).toEqual({ réunion: '#223344' });
        expect(controller.settings.tagTreeSortOverrides).toEqual({ réunion: 'alpha-desc' });
        expect(controller.settings.vaultProfiles[0].hiddenTags).toEqual(['réunion']);
        expect(controller.settings.vaultProfiles[0].hiddenFileTags).toEqual(['réunion']);
    });
});

describe('PluginSettingsController.normalizeNavigationSeparatorSettings', () => {
    it('canonicalizes tag and property separator keys across NFC and NFD-equivalent forms', () => {
        const controller = new PluginSettingsController({
            keys: STORAGE_KEYS,
            loadData: vi.fn().mockResolvedValue(null),
            saveData: vi.fn().mockResolvedValue(undefined),
            mirrorUXPreferences: vi.fn()
        });
        const settings = structuredClone(DEFAULT_SETTINGS);
        const normalizedPropertyKey = buildPropertySeparatorKey(buildPropertyValueNodeId('status', 'todo'));

        settings.navigationSeparators = {
            [buildTagSeparatorKey('re\u0301union')]: true,
            [buildPropertySeparatorKey('key:Status=ToDo')]: true
        };

        controller.settings = settings;
        controller.normalizeNavigationSeparatorSettings();

        expect(controller.settings.navigationSeparators).toEqual({
            [buildTagSeparatorKey('réunion')]: true,
            [normalizedPropertyKey]: true
        });
    });
});

describe('PluginSettingsController.prepareImportedUiScalePersistence', () => {
    it('preserves the opposite-platform scale across an import save and reload when uiScale is local', async () => {
        let storedData: Record<string, unknown> | null = null;

        const controller = new PluginSettingsController({
            keys: STORAGE_KEYS,
            loadData: vi.fn(async () => (storedData ? structuredClone(storedData) : null)),
            saveData: vi.fn(async data => {
                storedData = structuredClone(data) as Record<string, unknown>;
            }),
            mirrorUXPreferences: vi.fn()
        });
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.syncModes.uiScale = 'local';
        settings.desktopScale = 1.3;
        settings.mobileScale = 0.9;

        controller.settings = settings;
        controller.prepareImportedUiScalePersistence();
        controller.mirrorAllSyncModeSettingsToLocalStorage();
        await controller.saveSettings();
        await controller.loadSettings();
        await controller.saveSettings();

        expect(mockLocalStorageStore.get(STORAGE_KEYS.uiScaleKey)).toBe(1.3);
        expect(controller.settings.desktopScale).toBe(1.3);
        expect(controller.settings.mobileScale).toBe(0.9);
        expect(storedData?.['desktopScale']).toBeUndefined();
        expect(storedData?.['mobileScale']).toBe(0.9);
    });
});

describe('PluginSettingsController.saveSettings', () => {
    it('updates local homepage storage when homepage is local', async () => {
        let storedData: Record<string, unknown> | null = null;

        const controller = new PluginSettingsController({
            keys: STORAGE_KEYS,
            loadData: vi.fn(async () => (storedData ? structuredClone(storedData) : null)),
            saveData: vi.fn(async data => {
                storedData = structuredClone(data) as Record<string, unknown>;
            }),
            mirrorUXPreferences: vi.fn()
        });
        const settings = structuredClone(DEFAULT_SETTINGS);

        settings.syncModes.homepage = 'local';
        settings.homepage = {
            source: 'daily-note',
            file: null
        };

        mockLocalStorageStore.set(STORAGE_KEYS.homepageKey, {
            source: 'file',
            file: 'old-note.md'
        });

        controller.settings = settings;
        await controller.saveSettings();

        expect(mockLocalStorageStore.get(STORAGE_KEYS.homepageKey)).toEqual({
            source: 'daily-note',
            file: null
        });
        expect(storedData?.['homepage']).toBeUndefined();

        const reloadedController = new PluginSettingsController({
            keys: STORAGE_KEYS,
            loadData: vi.fn(async () => (storedData ? structuredClone(storedData) : null)),
            saveData: vi.fn().mockResolvedValue(undefined),
            mirrorUXPreferences: vi.fn()
        });

        await reloadedController.loadSettings();

        expect(reloadedController.settings.homepage).toEqual({
            source: 'daily-note',
            file: null
        });
    });
});
