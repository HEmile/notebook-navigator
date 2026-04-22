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

/**
 * Checks if two string arrays contain the same items in the same order.
 */
export function areStringArraysEqual(first: readonly string[], second: readonly string[]): boolean {
    if (first.length !== second.length) {
        return false;
    }
    for (let index = 0; index < first.length; index += 1) {
        if (first[index] !== second[index]) {
            return false;
        }
    }
    return true;
}

/**
 * Creates a map that stores zero-based index positions for each string in the array.
 */
export function createIndexMap(values: readonly string[]): Map<string, number> {
    const map = new Map<string, number>();
    values.forEach((value, index) => {
        map.set(value, index);
    });
    return map;
}

export interface NumericRange {
    start: number;
    end: number;
}

/**
 * Merges overlapping or adjacent numeric ranges without mutating the input.
 */
export function mergeRanges<T extends NumericRange>(ranges: readonly T[]): T[] {
    if (ranges.length === 0) {
        return [];
    }

    const sorted = [...ranges].sort((first, second) => first.start - second.start || first.end - second.end);
    const merged: T[] = [];

    for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (!last || range.start > last.end) {
            merged.push({ ...range });
        } else if (range.end > last.end) {
            last.end = range.end;
        }
    }

    return merged;
}
