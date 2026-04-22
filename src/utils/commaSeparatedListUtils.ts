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

const commaSeparatedListCache = new Map<string, readonly string[]>();
const EMPTY_COMMA_SEPARATED_LIST = Object.freeze<string[]>([]);

export function parseCommaSeparatedList(value: string): string[] {
    return value
        .split(',')
        .map(field => field.trim())
        .filter(field => field.length > 0);
}

export function formatCommaSeparatedList(values: readonly string[]): string {
    return values.join(', ');
}

export function normalizeCommaSeparatedList(value: string): string {
    return formatCommaSeparatedList(parseCommaSeparatedList(value));
}

export function getCachedCommaSeparatedList(value: string): readonly string[] {
    const cached = commaSeparatedListCache.get(value);
    if (cached) {
        return cached;
    }

    const parsed = parseCommaSeparatedList(value);
    const result = parsed.length > 0 ? parsed : EMPTY_COMMA_SEPARATED_LIST;
    commaSeparatedListCache.set(value, result);
    return result;
}
