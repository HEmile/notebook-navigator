/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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

const { localStorageSet } = vi.hoisted(() => ({ localStorageSet: vi.fn(() => true) }));

vi.mock('../../src/utils/localStorage', () => ({
    localStorage: {
        init: vi.fn(),
        get: vi.fn(() => null),
        set: localStorageSet,
        remove: vi.fn(() => true)
    }
}));

vi.stubGlobal('window', activeWindow);

import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { PluginPreferencesController } from '../../src/services/settings/PluginPreferencesController';
import { STORAGE_KEYS } from '../../src/types';

describe('PluginPreferencesController topic sort order', () => {
    let controller: PluginPreferencesController;
    let settings: typeof DEFAULT_SETTINGS;
    let notifySettingsUpdate: ReturnType<typeof vi.fn>;
    let saveSettings: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        settings = { ...DEFAULT_SETTINGS, syncModes: { ...DEFAULT_SETTINGS.syncModes } };
        notifySettingsUpdate = vi.fn();
        saveSettings = vi.fn(async () => undefined);
        controller = new PluginPreferencesController({
            keys: STORAGE_KEYS,
            getSettings: () => settings,
            notifySettingsUpdate,
            saveSettings,
            isShuttingDown: () => false,
            isLocal: vi.fn(() => false),
            persistSyncModeSettingUpdate: vi.fn(),
            persistSyncModeSettingUpdateAsync: vi.fn(async () => undefined),
            isOmnisearchAvailable: vi.fn(() => true),
            refreshMatcherCachesIfNeeded: vi.fn()
        });
    });

    afterEach(() => {
        controller.dispose();
        vi.useRealTimers();
    });

    it('saves and re-renders when the topic sort order changes', () => {
        controller.setTopicSortOrder('frequency-desc');

        expect(settings.topicSortOrder).toBe('frequency-desc');
        expect(notifySettingsUpdate).toHaveBeenCalledTimes(1);
        expect(saveSettings).toHaveBeenCalledTimes(1);
        expect(localStorageSet).not.toHaveBeenCalled();
    });

    it('does nothing when the order is unchanged or invalid', () => {
        controller.setTopicSortOrder(settings.topicSortOrder);
        controller.setTopicSortOrder('sideways' as never);

        expect(notifySettingsUpdate).not.toHaveBeenCalled();
        expect(saveSettings).not.toHaveBeenCalled();
    });
});
