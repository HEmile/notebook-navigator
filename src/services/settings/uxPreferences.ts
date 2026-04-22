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

import { Platform } from 'obsidian';

import { DEFAULT_SETTINGS } from '../../settings/defaultSettings';
import type { UXPreferences } from '../../types';

const UX_PREFERENCES_DEFAULTS = {
    base: {
        searchActive: false,
        showCalendar: false,
        showHiddenItems: false,
        pinShortcuts: true,
        includeDescendantNotes: DEFAULT_SETTINGS.includeDescendantNotes
    },
    platform: {
        mobile: {},
        desktop: {}
    }
} satisfies {
    base: UXPreferences;
    platform: {
        mobile: Partial<UXPreferences>;
        desktop: Partial<UXPreferences>;
    };
};

type UXPreferenceKey = keyof typeof UX_PREFERENCES_DEFAULTS.base;

const UX_PREFERENCE_KEYS = Object.keys(UX_PREFERENCES_DEFAULTS.base).filter((key): key is UXPreferenceKey => {
    return key in UX_PREFERENCES_DEFAULTS.base;
});

export function getDefaultUXPreferences(): UXPreferences {
    const overrides = Platform.isMobile ? UX_PREFERENCES_DEFAULTS.platform.mobile : UX_PREFERENCES_DEFAULTS.platform.desktop;

    return {
        ...UX_PREFERENCES_DEFAULTS.base,
        ...overrides
    };
}

export function isUXPreferencesRecord(value: unknown): value is Partial<UXPreferences> {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const record = value as Record<string, unknown>;
    for (const key of UX_PREFERENCE_KEYS) {
        const entry = record[key];
        if (typeof entry !== 'undefined' && typeof entry !== 'boolean') {
            return false;
        }
    }

    return true;
}
