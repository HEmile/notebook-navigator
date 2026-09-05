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

import { describe, expect, test } from 'vitest';
import {
    resolveCalendarLocales,
    resolveDailyNoteLocale,
    type MomentApi,
    type MomentInstance,
    type MomentLocaleData
} from '../../src/utils/moment';

function createMomentStub(locales: string[], currentLocale: string): MomentApi {
    const localeData: MomentLocaleData = {
        firstDayOfWeek: () => 1,
        weekdaysMin: () => [],
        weekdaysShort: () => []
    };

    const instance: MomentInstance = {
        clone: () => instance,
        format: () => '',
        isValid: () => true,
        locale: () => instance,
        localeData: () => localeData,
        startOf: () => instance,
        endOf: () => instance,
        add: () => instance,
        subtract: () => instance,
        diff: () => 0,
        week: () => 1,
        weekYear: () => 2026,
        isoWeek: () => 1,
        isoWeekYear: () => 2026,
        month: () => 0,
        year: () => 2026,
        date: () => 1,
        set: () => instance,
        get: () => 0,
        toDate: () => new Date(0)
    };

    const momentApi = (() => instance) as MomentApi;
    momentApi.locales = () => locales;
    momentApi.locale = () => currentLocale;
    momentApi.fn = {};
    momentApi.utc = () => ({});

    return momentApi;
}

describe('resolveCalendarLocales', () => {
    test('keeps the Obsidian language for display and uses the selected calendar locale for calendar rules', () => {
        const momentApi = createMomentStub(['en', 'ar'], 'ar');

        expect(resolveCalendarLocales('en', momentApi, 'ar')).toEqual({
            displayLocale: 'ar',
            calendarRulesLocale: 'en'
        });
    });

    test('uses the Obsidian language when the calendar locale is system default', () => {
        const momentApi = createMomentStub(['en', 'ar'], 'en');

        expect(resolveCalendarLocales('system-default', momentApi, 'ar')).toEqual({
            displayLocale: 'ar',
            calendarRulesLocale: 'ar'
        });
    });

    test('falls back to the closest available moment locale', () => {
        const momentApi = createMomentStub(['en', 'en-gb'], 'en');

        expect(resolveCalendarLocales('en_US', momentApi, 'ar')).toEqual({
            displayLocale: 'en',
            calendarRulesLocale: 'en'
        });
    });

    test('keeps core Daily Notes formatting on the current moment locale', () => {
        const momentApi = createMomentStub(['en', 'en-gb', 'uk'], 'en-gb');

        expect(resolveCalendarLocales('uk', momentApi, 'en')).toEqual({
            displayLocale: 'en',
            calendarRulesLocale: 'uk'
        });
        expect(resolveDailyNoteLocale(momentApi)).toBe('en-gb');
    });
});
