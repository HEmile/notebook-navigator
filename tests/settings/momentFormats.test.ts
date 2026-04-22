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

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { migrateMomentDateFormats } from '../../src/settings/migrations/momentFormats';

describe('migrateMomentDateFormats', () => {
    it('migrates frontmatter timestamp format when safe', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.frontmatterDateFormat = "yyyy-MM-dd'T'HH:mm:ssXXX";

        const migrated = migrateMomentDateFormats({
            settings,
            defaultDateFormat: DEFAULT_SETTINGS.dateFormat,
            defaultTimeFormat: DEFAULT_SETTINGS.timeFormat,
            defaultSettings: DEFAULT_SETTINGS
        });

        expect(migrated).toBe(true);
        expect(settings.frontmatterDateFormat).toBe('YYYY-MM-DD[T]HH:mm:ssZ');
    });

    it('migrates date-fns lowercase timezone tokens (xxx)', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.frontmatterDateFormat = "yyyy-MM-dd'T'HH:mm:ssxxx";

        const migrated = migrateMomentDateFormats({
            settings,
            defaultDateFormat: DEFAULT_SETTINGS.dateFormat,
            defaultTimeFormat: DEFAULT_SETTINGS.timeFormat,
            defaultSettings: DEFAULT_SETTINGS
        });

        expect(migrated).toBe(true);
        expect(settings.frontmatterDateFormat).toBe('YYYY-MM-DD[T]HH:mm:ssZ');
    });

    it('clears frontmatter timestamp format when conversion is unsafe', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.frontmatterDateFormat = 'PPpp';

        const migrated = migrateMomentDateFormats({
            settings,
            defaultDateFormat: DEFAULT_SETTINGS.dateFormat,
            defaultTimeFormat: DEFAULT_SETTINGS.timeFormat,
            defaultSettings: DEFAULT_SETTINGS
        });

        expect(migrated).toBe(true);
        expect(settings.frontmatterDateFormat).toBe('');
    });

    it('leaves moment formats unchanged', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.frontmatterDateFormat = 'YYYY-MM-DD[T]HH:mm:ssZ';

        const migrated = migrateMomentDateFormats({
            settings,
            defaultDateFormat: DEFAULT_SETTINGS.dateFormat,
            defaultTimeFormat: DEFAULT_SETTINGS.timeFormat,
            defaultSettings: DEFAULT_SETTINGS
        });

        expect(migrated).toBe(false);
        expect(settings.frontmatterDateFormat).toBe('YYYY-MM-DD[T]HH:mm:ssZ');
    });

    it('migrates date formats that use lowercase day tokens (dd/MM)', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.dateFormat = 'dd/MM';

        const migrated = migrateMomentDateFormats({
            settings,
            defaultDateFormat: DEFAULT_SETTINGS.dateFormat,
            defaultTimeFormat: DEFAULT_SETTINGS.timeFormat,
            defaultSettings: DEFAULT_SETTINGS
        });

        expect(migrated).toBe(true);
        expect(settings.dateFormat).toBe('DD/MM');
    });

    it('migrates date-fns escaped UTC literal Z', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.frontmatterDateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'";

        const migrated = migrateMomentDateFormats({
            settings,
            defaultDateFormat: DEFAULT_SETTINGS.dateFormat,
            defaultTimeFormat: DEFAULT_SETTINGS.timeFormat,
            defaultSettings: DEFAULT_SETTINGS
        });

        expect(migrated).toBe(true);
        expect(settings.frontmatterDateFormat).toBe('YYYY-MM-DD[T]HH:mm:ss[Z]');
    });

    it('migrates date-fns formats that include DD (day-of-year token)', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.frontmatterDateFormat = 'DD/MM/yyyy';

        const migrated = migrateMomentDateFormats({
            settings,
            defaultDateFormat: DEFAULT_SETTINGS.dateFormat,
            defaultTimeFormat: DEFAULT_SETTINGS.timeFormat,
            defaultSettings: DEFAULT_SETTINGS
        });

        expect(migrated).toBe(true);
        expect(settings.frontmatterDateFormat).toBe('DD/MM/YYYY');
    });
});
