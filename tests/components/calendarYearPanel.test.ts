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

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarYearPanel } from '../../src/components/calendar/CalendarYearPanel';
import type { CalendarYearMonthEntry } from '../../src/components/calendar/types';

function createEntry(patch?: Partial<CalendarYearMonthEntry>): CalendarYearMonthEntry {
    return {
        date: {} as CalendarYearMonthEntry['date'],
        fullLabel: 'January',
        hasDailyNote: false,
        hasUnfinishedTasks: false,
        key: '2026-01',
        monthIndex: 0,
        shortLabel: 'Jan',
        ...(patch ?? {})
    };
}

describe('CalendarYearPanel', () => {
    it('renders month markers without the note-count suffix', () => {
        const html = renderToStaticMarkup(
            React.createElement(CalendarYearPanel, {
                showYearCalendar: true,
                currentMonthKey: null,
                displayedYearValue: 2026,
                activeYearValue: 2026,
                activeMonthIndex: 2,
                hasYearPeriodNote: false,
                yearMonthEntries: [createEntry({ hasDailyNote: true, hasUnfinishedTasks: true })],
                highlightedMonthFeatureImageKeys: new Set<string>(),
                highlightedMonthImageUrls: {},
                onNavigateYear: () => {},
                onYearPeriodClick: () => {},
                onYearPeriodContextMenu: () => {},
                onSelectYearMonth: () => {}
            })
        );

        expect(html).toContain('aria-label="January 2026"');
        expect(html).toContain('>Jan<');
        expect(html).not.toContain('Jan (');
        expect(html).toMatch(/class="[^"]*has-daily-note[^"]*has-unfinished-tasks[^"]*"/);
        expect(html).toContain('nn-navigation-calendar-year-month-unfinished-task-indicator');
    });

    it('renders feature-image month state through the same month button classes', () => {
        const html = renderToStaticMarkup(
            React.createElement(CalendarYearPanel, {
                showYearCalendar: true,
                currentMonthKey: null,
                displayedYearValue: 2026,
                activeYearValue: 2026,
                activeMonthIndex: 0,
                hasYearPeriodNote: false,
                yearMonthEntries: [createEntry({ hasDailyNote: true, hasUnfinishedTasks: true })],
                highlightedMonthFeatureImageKeys: new Set<string>(['2026-01']),
                highlightedMonthImageUrls: { '2026-01': 'blob:month-image' },
                onNavigateYear: () => {},
                onYearPeriodClick: () => {},
                onYearPeriodContextMenu: () => {},
                onSelectYearMonth: () => {}
            })
        );

        expect(html).toMatch(/class="[^"]*has-feature-image-key[^"]*has-feature-image[^"]*"/);
        expect(html).toContain('background-image:url(blob:month-image)');
        expect(html).not.toContain('(1)');
    });

    it('does not keep the selected-month outline when browsing a different year', () => {
        const html = renderToStaticMarkup(
            React.createElement(CalendarYearPanel, {
                showYearCalendar: true,
                currentMonthKey: null,
                displayedYearValue: 2025,
                activeYearValue: 2026,
                activeMonthIndex: 0,
                hasYearPeriodNote: false,
                yearMonthEntries: [createEntry()],
                highlightedMonthFeatureImageKeys: new Set<string>(),
                highlightedMonthImageUrls: {},
                onNavigateYear: () => {},
                onYearPeriodClick: () => {},
                onYearPeriodContextMenu: () => {},
                onSelectYearMonth: () => {}
            })
        );

        expect(html).not.toContain('is-selected-month');
        expect(html).toContain('aria-label="January 2025"');
    });
});
