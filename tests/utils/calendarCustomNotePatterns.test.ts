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
    doesCalendarCustomWeekPatternOverrideLocaleWeekStart,
    escapeMomentLiteralPath,
    isCalendarCustomWeekPatternValid
} from '../../src/utils/calendarCustomNotePatterns';

describe('calendar custom note patterns', () => {
    type MomentStub = {
        isValid: () => boolean;
        format: (format?: string) => string;
        clone: () => MomentStub;
        startOf: (unit: string) => MomentStub;
    };

    const createMomentApi = (context: { lastStartOfUnit: string | null }) => {
        return (_input?: string, _format?: string, _strict?: boolean): MomentStub => {
            const stub: MomentStub = {
                isValid: () => true,
                format: (format?: string) => format ?? '',
                clone: () => stub,
                startOf: (unit: string) => {
                    context.lastStartOfUnit = unit;
                    return stub;
                }
            };
            return stub;
        };
    };

    test('accepts nested weekly paths with quarter and month folders', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        const pattern = 'YYYY/YYYY-[Q]Q/YYYY-MM/YYYY-[W]ww/YYYY-[W]ww';
        expect(isCalendarCustomWeekPatternValid(pattern, momentApi)).toBe(true);
        expect(context.lastStartOfUnit).toBe('week');
    });

    test('accepts simple weekly paths', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('gggg/[W]ww', momentApi)).toBe(true);
        expect(context.lastStartOfUnit).toBe('week');
    });

    test('anchors ISO week patterns to isoWeek', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('GGGG-[W]WW', momentApi)).toBe(true);
        expect(context.lastStartOfUnit).toBe('isoWeek');
    });

    test('marks ISO week patterns as incompatible with non-Monday locales', () => {
        expect(doesCalendarCustomWeekPatternOverrideLocaleWeekStart('GGGG-[W]WW', 0)).toBe(true);
    });

    test('does not mark locale week patterns as incompatible with non-Monday locales', () => {
        expect(doesCalendarCustomWeekPatternOverrideLocaleWeekStart('gggg/[W]ww', 0)).toBe(false);
    });

    test('does not mark ISO week patterns as incompatible with Monday locales', () => {
        expect(doesCalendarCustomWeekPatternOverrideLocaleWeekStart('GGGG-[W]WW', 1)).toBe(false);
    });

    test('rejects weekly pattern without week number token', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('YYYY/YYYY-MM', momentApi)).toBe(false);
    });

    test('rejects weekly pattern without year token', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('[W]ww', momentApi)).toBe(false);
    });

    test('rejects patterns that format to invalid path segments', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('YYYY/<bad>/(gggg)/[W]ww', momentApi)).toBe(false);
    });

    test('rejects Windows reserved device names in path segments', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('YYYY/CON/[W]ww', momentApi)).toBe(false);
        expect(isCalendarCustomWeekPatternValid('YYYY/con.txt/[W]ww', momentApi)).toBe(false);
    });

    test('rejects path segments ending with a dot', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('YYYY/foo./[W]ww', momentApi)).toBe(false);
    });

    test('rejects patterns with unbalanced moment literal brackets', () => {
        const context = { lastStartOfUnit: null as string | null };
        const momentApi = createMomentApi(context);
        expect(isCalendarCustomWeekPatternValid('YYYY/[Www', momentApi)).toBe(false);
        expect(context.lastStartOfUnit).toBe(null);
    });

    test('escapes square brackets inside literal path segments', () => {
        expect(escapeMomentLiteralPath('Daily[Notes]/[2026]')).toBe('[Daily]\\[[Notes]\\]/\\[[2026]\\]');
    });
});
