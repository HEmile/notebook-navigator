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

import type { DateFilterField, DateFilterRange, FilterSearchTokens } from './filterSearchTypes';

// Locale-based date component order for ambiguous day/month parsing
type DayMonthOrder = 'DMY' | 'MDY';

// Recognized relative date keywords for @today, @yesterday, etc.
export const DATE_FILTER_RELATIVE_KEYWORDS = ['today', 'yesterday', 'last7d', 'last30d', 'thisweek', 'thismonth'] as const;
const DATE_FILTER_RELATIVE_KEYWORD_SET = new Set<string>(DATE_FILTER_RELATIVE_KEYWORDS);
const MIN_DATE_FILTER_YEAR = 1;
const MAX_DATE_FILTER_YEAR = 9999;

const isSupportedDateFilterYear = (year: number): boolean => {
    return Number.isFinite(year) && year >= MIN_DATE_FILTER_YEAR && year <= MAX_DATE_FILTER_YEAR;
};

const createLocalDate = (year: number, monthIndex: number, day: number): Date => {
    const date = new Date(0);
    date.setFullYear(year, monthIndex, day);
    date.setHours(0, 0, 0, 0);
    return date;
};

const createUtcDayTimestamp = (year: number, monthIndex: number, day: number): number => {
    const date = new Date(0);
    date.setUTCFullYear(year, monthIndex, day);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
};

// Extracts optional c:/m:/created:/modified: prefix from a date filter token
export const parseDateFieldPrefix = (value: string): { field: DateFilterField; prefix: string; remainder: string } => {
    if (!value) {
        return { field: 'default', prefix: '', remainder: '' };
    }

    const lower = value.toLowerCase();

    if (lower.startsWith('c:')) {
        return { field: 'created', prefix: 'c:', remainder: value.slice(2) };
    }
    if (lower.startsWith('m:')) {
        return { field: 'modified', prefix: 'm:', remainder: value.slice(2) };
    }
    if (lower.startsWith('created:')) {
        return { field: 'created', prefix: 'created:', remainder: value.slice('created:'.length) };
    }
    if (lower.startsWith('modified:')) {
        return { field: 'modified', prefix: 'modified:', remainder: value.slice('modified:'.length) };
    }

    return { field: 'default', prefix: '', remainder: value };
};

// Cached result of locale-based day/month order detection
let cachedDayMonthOrder: DayMonthOrder | null = null;

// Detects whether the user's locale prefers month-day-year or day-month-year ordering
const resolveDayMonthOrder = (): DayMonthOrder => {
    if (cachedDayMonthOrder) {
        return cachedDayMonthOrder;
    }

    try {
        const parts = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(
            new Date(2020, 11, 31)
        );
        const yearIndex = parts.findIndex(part => part.type === 'year');
        const monthIndex = parts.findIndex(part => part.type === 'month');
        const dayIndex = parts.findIndex(part => part.type === 'day');

        const yearLast = yearIndex !== -1 && monthIndex !== -1 && dayIndex !== -1 && yearIndex > monthIndex && yearIndex > dayIndex;
        if (yearLast && monthIndex < dayIndex) {
            cachedDayMonthOrder = 'MDY';
            return cachedDayMonthOrder;
        }
    } catch {
        // Fallback below.
    }

    cachedDayMonthOrder = 'DMY';
    return cachedDayMonthOrder;
};

// Creates a timestamp range for a single calendar day (start inclusive, end exclusive)
const createLocalDayRange = (year: number, month: number, day: number): { startMs: number; endMs: number } | null => {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }

    if (!isSupportedDateFilterYear(year)) {
        return null;
    }
    if (month < 1 || month > 12) {
        return null;
    }
    if (day < 1 || day > 31) {
        return null;
    }

    const start = createLocalDate(year, month - 1, day);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day || Number.isNaN(start.getTime())) {
        return null;
    }

    const end = createLocalDate(year, month - 1, day + 1);
    if (Number.isNaN(end.getTime())) {
        return null;
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
};

// Creates a timestamp range spanning an entire calendar month
const createLocalMonthRange = (year: number, month: number): { startMs: number; endMs: number } | null => {
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return null;
    }

    if (!isSupportedDateFilterYear(year)) {
        return null;
    }
    if (month < 1 || month > 12) {
        return null;
    }

    const start = createLocalDate(year, month - 1, 1);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== 1 || Number.isNaN(start.getTime())) {
        return null;
    }

    const end = createLocalDate(year, month, 1);
    if (Number.isNaN(end.getTime())) {
        return null;
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
};

// Creates a timestamp range spanning an entire calendar quarter (Q1-Q4)
const createLocalQuarterRange = (year: number, quarter: number): { startMs: number; endMs: number } | null => {
    if (!Number.isFinite(year) || !Number.isFinite(quarter)) {
        return null;
    }

    if (!isSupportedDateFilterYear(year)) {
        return null;
    }
    if (quarter < 1 || quarter > 4) {
        return null;
    }

    const startMonthIndex = (quarter - 1) * 3;
    const start = createLocalDate(year, startMonthIndex, 1);
    if (start.getFullYear() !== year || start.getMonth() !== startMonthIndex || start.getDate() !== 1 || Number.isNaN(start.getTime())) {
        return null;
    }

    const end = createLocalDate(year, startMonthIndex + 3, 1);
    if (Number.isNaN(end.getTime())) {
        return null;
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
};

// Creates a timestamp range spanning an entire calendar year
const createLocalYearRange = (year: number): { startMs: number; endMs: number } | null => {
    if (!Number.isFinite(year)) {
        return null;
    }

    if (!isSupportedDateFilterYear(year)) {
        return null;
    }

    const start = createLocalDate(year, 0, 1);
    if (start.getFullYear() !== year || start.getMonth() !== 0 || start.getDate() !== 1 || Number.isNaN(start.getTime())) {
        return null;
    }

    const end = createLocalDate(year + 1, 0, 1);
    if (Number.isNaN(end.getTime())) {
        return null;
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
};

// Returns the Monday at 00:00 local time that starts ISO week 1 of the given year
const getIsoWeek1Start = (isoYear: number): Date | null => {
    if (!Number.isFinite(isoYear)) {
        return null;
    }
    if (!isSupportedDateFilterYear(isoYear)) {
        return null;
    }

    // ISO week 1 is the week containing January 4. This returns the local-time Monday at the start of ISO week 1.
    const jan4 = createLocalDate(isoYear, 0, 4);
    if (Number.isNaN(jan4.getTime())) {
        return null;
    }

    const diffToMonday = (jan4.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(jan4);
    monday.setDate(monday.getDate() - diffToMonday);
    if (Number.isNaN(monday.getTime())) {
        return null;
    }

    return monday;
};

// Returns the number of ISO weeks in the given ISO year (52 or 53)
const getIsoWeeksInYear = (isoYear: number): number | null => {
    const start = getIsoWeek1Start(isoYear);
    const end = getIsoWeek1Start(isoYear + 1);
    if (!start || !end) {
        return null;
    }

    const startDayUtc = createUtcDayTimestamp(start.getFullYear(), start.getMonth(), start.getDate());
    const endDayUtc = createUtcDayTimestamp(end.getFullYear(), end.getMonth(), end.getDate());
    const diffDays = Math.round((endDayUtc - startDayUtc) / (24 * 60 * 60 * 1000));
    if (diffDays <= 0 || diffDays % 7 !== 0) {
        return null;
    }

    const weeks = diffDays / 7;
    return weeks >= 52 && weeks <= 53 ? weeks : null;
};

// Creates a timestamp range spanning an entire ISO week (Monday through Sunday)
const createLocalIsoWeekRange = (isoYear: number, isoWeek: number): { startMs: number; endMs: number } | null => {
    if (!Number.isFinite(isoYear) || !Number.isFinite(isoWeek)) {
        return null;
    }

    if (!isSupportedDateFilterYear(isoYear)) {
        return null;
    }
    if (isoWeek < 1 || isoWeek > 53) {
        return null;
    }

    const isoWeeksInYear = getIsoWeeksInYear(isoYear);
    if (!isoWeeksInYear || isoWeek > isoWeeksInYear) {
        return null;
    }

    const week1Start = getIsoWeek1Start(isoYear);
    if (!week1Start) {
        return null;
    }

    const start = new Date(week1Start);
    start.setDate(start.getDate() + (isoWeek - 1) * 7);
    if (Number.isNaN(start.getTime())) {
        return null;
    }

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    if (Number.isNaN(end.getTime())) {
        return null;
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
};

// Parses ambiguous day/month/year values using locale-aware ordering when both interpretations are valid
const parseDayMonthYear = (first: number, second: number, year: number): { startMs: number; endMs: number } | null => {
    const dmy = createLocalDayRange(year, second, first);
    const mdy = createLocalDayRange(year, first, second);

    if (dmy && !mdy) {
        return dmy;
    }
    if (mdy && !dmy) {
        return mdy;
    }
    if (!dmy || !mdy) {
        return null;
    }

    return resolveDayMonthOrder() === 'MDY' ? mdy : dmy;
};

// Parses a date string representing a specific day in various formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
const parseDayToken = (value: string): { startMs: number; endMs: number } | null => {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const ymdSeparator = trimmed.match(/^(\d{3,4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdSeparator) {
        const year = Number(ymdSeparator[1]);
        const month = Number(ymdSeparator[2]);
        const day = Number(ymdSeparator[3]);
        return createLocalDayRange(year, month, day);
    }

    const ymdCompact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (ymdCompact) {
        const year = Number(ymdCompact[1]);
        const month = Number(ymdCompact[2]);
        const day = Number(ymdCompact[3]);
        return createLocalDayRange(year, month, day);
    }

    const dayMonthYearSeparator = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{3,4})$/);
    if (dayMonthYearSeparator) {
        const first = Number(dayMonthYearSeparator[1]);
        const second = Number(dayMonthYearSeparator[2]);
        const year = Number(dayMonthYearSeparator[3]);
        return parseDayMonthYear(first, second, year);
    }

    const dayMonthYearCompact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (dayMonthYearCompact) {
        const first = Number(dayMonthYearCompact[1]);
        const second = Number(dayMonthYearCompact[2]);
        const year = Number(dayMonthYearCompact[3]);
        return parseDayMonthYear(first, second, year);
    }

    return null;
};

// Parses a date string into a timestamp range (year, month, quarter, week, or day granularity)
const parseDateToken = (value: string): { startMs: number; endMs: number } | null => {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const yearOnly = trimmed.match(/^(\d{3,4})$/);
    if (yearOnly) {
        const year = Number(yearOnly[1]);
        return createLocalYearRange(year);
    }

    const yearMonthSeparator = trimmed.match(/^(\d{3,4})[-/.](\d{1,2})$/);
    if (yearMonthSeparator) {
        const year = Number(yearMonthSeparator[1]);
        const month = Number(yearMonthSeparator[2]);
        return createLocalMonthRange(year, month);
    }

    const yearMonthCompact = trimmed.match(/^(\d{4})(\d{2})$/);
    if (yearMonthCompact) {
        const year = Number(yearMonthCompact[1]);
        const month = Number(yearMonthCompact[2]);
        return createLocalMonthRange(year, month);
    }

    const yearQuarter = trimmed.match(/^(\d{3,4})[-/.]?q([1-4])$/);
    if (yearQuarter) {
        const year = Number(yearQuarter[1]);
        const quarter = Number(yearQuarter[2]);
        return createLocalQuarterRange(year, quarter);
    }

    const yearWeek = trimmed.match(/^(\d{3,4})[-/.]?w(\d{1,2})$/);
    if (yearWeek) {
        const year = Number(yearWeek[1]);
        const week = Number(yearWeek[2]);
        return createLocalIsoWeekRange(year, week);
    }

    return parseDayToken(trimmed);
};

// Converts a relative date keyword (today, yesterday, last7d, etc.) into a timestamp range
const resolveRelativeDateRange = (keyword: string): { startMs: number; endMs: number } | null => {
    if (!keyword) {
        return null;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    switch (keyword) {
        case 'today':
            return { startMs: todayStart.getTime(), endMs: tomorrowStart.getTime() };
        case 'yesterday': {
            const yesterdayStart = new Date(todayStart);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);
            return { startMs: yesterdayStart.getTime(), endMs: todayStart.getTime() };
        }
        case 'last7d': {
            const start = new Date(todayStart);
            start.setDate(start.getDate() - 6);
            return { startMs: start.getTime(), endMs: tomorrowStart.getTime() };
        }
        case 'last30d': {
            const start = new Date(todayStart);
            start.setDate(start.getDate() - 29);
            return { startMs: start.getTime(), endMs: tomorrowStart.getTime() };
        }
        case 'thisweek': {
            const start = new Date(todayStart);
            const day = start.getDay(); // 0 = Sunday
            const diff = (day + 6) % 7; // Monday = 0
            start.setDate(start.getDate() - diff);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            return { startMs: start.getTime(), endMs: end.getTime() };
        }
        case 'thismonth': {
            const start = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
            const end = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);
            return { startMs: start.getTime(), endMs: end.getTime() };
        }
    }

    return null;
};

// Parses a complete @-prefixed date filter token into a DateFilterRange
export const parseDateFilterRange = (token: string): DateFilterRange | null => {
    if (!token.startsWith('@')) {
        return null;
    }

    const raw = token.slice(1);
    const { field, remainder: rawRemainder } = parseDateFieldPrefix(raw);
    const remainder = rawRemainder.trim().toLowerCase();
    if (!remainder) {
        return null;
    }

    if (DATE_FILTER_RELATIVE_KEYWORD_SET.has(remainder)) {
        const relative = resolveRelativeDateRange(remainder);
        if (!relative) {
            return null;
        }
        return { field, startMs: relative.startMs, endMs: relative.endMs };
    }

    const rangeDelimiter = remainder.indexOf('..');
    if (rangeDelimiter !== -1) {
        const left = remainder.slice(0, rangeDelimiter).trim();
        const right = remainder.slice(rangeDelimiter + 2).trim();

        if (!left && !right) {
            return null;
        }

        const leftDay = left ? parseDateToken(left) : null;
        const rightDay = right ? parseDateToken(right) : null;

        if (left && !leftDay) {
            return null;
        }
        if (right && !rightDay) {
            return null;
        }

        const startMs = leftDay ? leftDay.startMs : null;
        const endMs = rightDay ? rightDay.endMs : null;

        if (startMs !== null && endMs !== null && startMs >= endMs) {
            return null;
        }

        return { field, startMs, endMs };
    }

    const day = parseDateToken(remainder);
    if (!day) {
        return null;
    }

    return { field, startMs: day.startMs, endMs: day.endMs };
};

// Checks if a token looks like a date filter (starts with @ followed by digits, dots, or relative keywords)
export const isDateFilterCandidate = (token: string): boolean => {
    if (!token.startsWith('@')) {
        return false;
    }

    const raw = token.slice(1);
    const { remainder } = parseDateFieldPrefix(raw);
    const normalized = remainder.trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    const first = normalized.charAt(0);
    if (first === '.' || (first >= '0' && first <= '9')) {
        return true;
    }

    for (const keyword of DATE_FILTER_RELATIVE_KEYWORDS) {
        if (keyword.startsWith(normalized)) {
            return true;
        }
    }

    return false;
};

// Checks if a timestamp falls within a date range (start inclusive, end exclusive)
const timestampMatchesDateRange = (timestamp: number, range: DateFilterRange): boolean => {
    if (!Number.isFinite(timestamp)) {
        return false;
    }

    if (range.startMs !== null && timestamp < range.startMs) {
        return false;
    }
    if (range.endMs !== null && timestamp >= range.endMs) {
        return false;
    }
    return true;
};

/**
 * Check if a file's timestamps match all date filter tokens.
 * All inclusion ranges must match AND all exclusion ranges must not match.
 */
export function fileMatchesDateFilterTokens(
    date: { created: number; modified: number; defaultField: 'created' | 'modified' },
    tokens: FilterSearchTokens
): boolean {
    if (tokens.dateRanges.length === 0 && tokens.excludeDateRanges.length === 0) {
        return true;
    }

    const resolveTimestamp = (range: DateFilterRange): number => {
        if (range.field === 'created') {
            return date.created;
        }
        if (range.field === 'modified') {
            return date.modified;
        }

        return date.defaultField === 'created' ? date.created : date.modified;
    };

    for (const range of tokens.dateRanges) {
        const timestamp = resolveTimestamp(range);
        if (!timestampMatchesDateRange(timestamp, range)) {
            return false;
        }
    }

    for (const range of tokens.excludeDateRanges) {
        const timestamp = resolveTimestamp(range);
        if (timestampMatchesDateRange(timestamp, range)) {
            return false;
        }
    }

    return true;
}
