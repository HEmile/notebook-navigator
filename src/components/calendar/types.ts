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

import type { TFile } from 'obsidian';
import type { CalendarNoteConfig, CalendarNoteKind } from '../../utils/calendarNotes';
import type { MomentInstance } from '../../utils/moment';

export interface CalendarHoverTooltipData {
    imageUrl: string | null;
    title: string;
    dateTimestamp: number;
    previewPath: string | null;
    previewEnabled: boolean;
    showDate: boolean;
}

export interface CalendarHoverTooltipState {
    anchorEl: HTMLElement;
    tooltipData: CalendarHoverTooltipData;
}

export interface CalendarDay {
    date: MomentInstance;
    iso: string;
    inMonth: boolean;
    file: TFile | null;
}

export interface CalendarWeek {
    key: string;
    weekNumber: number;
    days: CalendarDay[];
}

export interface CalendarYearMonthEntry {
    date: MomentInstance;
    fullLabel: string;
    key: string;
    monthIndex: number;
    noteCount: number;
    shortLabel: string;
}

export interface CalendarHeaderPeriodNoteFiles {
    month: TFile | null;
    quarter: TFile | null;
    year: TFile | null;
}

export interface CalendarNoteContextMenuTarget {
    kind: CustomCalendarNoteKind;
    date: MomentInstance;
    existingFile: TFile | null;
    canCreate: boolean;
    monthKey?: string | null;
    dayIso?: string | null;
    hasFeatureImage?: boolean;
    currentMonthHighlightDayIso?: string | null;
}

export type CustomCalendarNoteKind = CalendarNoteKind;
export type CustomCalendarNoteConfig = CalendarNoteConfig;
