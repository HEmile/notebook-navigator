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
import { PluginSettingsController } from '../../src/services/settings/PluginSettingsController';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { STORAGE_KEYS } from '../../src/types';
import { buildPropertySeparatorKey, buildTagSeparatorKey } from '../../src/utils/navigationSeparators';
import { buildPropertyValueNodeId } from '../../src/utils/propertyTree';

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
