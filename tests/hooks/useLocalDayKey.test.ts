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
import { getLocalDayKey, getMsUntilNextLocalMidnight } from '../../src/hooks/useLocalDayKey';

describe('useLocalDayKey helpers', () => {
    it('formats local day key as YYYY-MM-DD', () => {
        const date = new Date(2026, 0, 2, 12, 34, 56, 789);
        expect(getLocalDayKey(date)).toBe('2026-01-02');
    });

    it('pads month and day with leading zeros', () => {
        const date = new Date(2026, 8, 9, 0, 0, 0, 0);
        expect(getLocalDayKey(date)).toBe('2026-09-09');
    });

    it('computes milliseconds until next local midnight', () => {
        const now = new Date(2026, 0, 1, 23, 59, 0, 0);
        const expected = new Date(2026, 0, 2, 0, 0, 0, 0).getTime() - now.getTime();
        expect(getMsUntilNextLocalMidnight(now)).toBe(expected);
    });

    it('returns 0 for invalid dates', () => {
        const now = new Date(NaN);
        expect(getMsUntilNextLocalMidnight(now)).toBe(0);
    });
});
