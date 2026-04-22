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

import type { NotebookNavigatorSettings } from '../../settings';

function normalizeFormatValue(value: string): string {
    return value.trim();
}

function looksLikeMomentFormat(value: string): boolean {
    if (!value) {
        return false;
    }
    return value.includes('[') || value.includes(']');
}

function looksLikeDateFnsFormat(value: string): boolean {
    if (!value) {
        return false;
    }
    if (value.includes('yyyy') || value.includes('yy')) {
        return true;
    }
    if (value.includes('XXX') || value.includes('XX')) {
        return true;
    }
    if (value.includes('xxx') || value.includes('xx')) {
        return true;
    }
    if (value.includes('EEEE') || value.includes('EEE')) {
        return true;
    }
    if (value.includes("'")) {
        return true;
    }
    // Common date-fns tokens that don't exist in Moment.
    if (/[Pp]{1,4}/u.test(value)) {
        return true;
    }
    return false;
}

function includesDateFnsDayTokens(value: string): boolean {
    let index = 0;
    let inMomentLiteral = false;

    while (index < value.length) {
        const ch = value[index];
        if (ch === '[') {
            inMomentLiteral = true;
            index += 1;
            continue;
        }
        if (ch === ']') {
            inMomentLiteral = false;
            index += 1;
            continue;
        }
        if (inMomentLiteral) {
            index += 1;
            continue;
        }

        if (!/[A-Za-z]/u.test(ch)) {
            index += 1;
            continue;
        }

        const start = index;
        while (index < value.length && value[index] === ch) {
            index += 1;
        }
        const runLength = index - start;

        if (ch === 'd' && runLength <= 2) {
            return true;
        }
    }

    return false;
}

function convertDateFnsLiteralsToMoment(value: string): { value: string; malformed: boolean } {
    let output = '';
    let index = 0;
    let malformed = false;

    while (index < value.length) {
        const ch = value[index];
        if (ch !== "'") {
            output += ch;
            index += 1;
            continue;
        }

        // Date-fns literal segments are wrapped in single quotes.
        index += 1;
        let literal = '';
        let closed = false;
        while (index < value.length) {
            const inner = value[index];
            if (inner === "'") {
                const next = value[index + 1];
                if (next === "'") {
                    literal += "'";
                    index += 2;
                    continue;
                }
                index += 1;
                closed = true;
                break;
            }
            literal += inner;
            index += 1;
        }

        if (!closed) {
            malformed = true;
        }

        output += `[${literal}]`;
    }

    if (value.includes("'") && !output.includes('[')) {
        malformed = true;
    }

    return { value: output, malformed };
}

function mapDateFnsToken(letter: string, runLength: number): string | null {
    switch (letter) {
        case 'y': {
            if (runLength >= 4) return 'YYYY';
            if (runLength === 2) return 'YY';
            return null;
        }
        case 'd': {
            if (runLength === 2) return 'DD';
            if (runLength === 1) return 'D';
            return null;
        }
        case 'E': {
            if (runLength >= 4) return 'dddd';
            if (runLength === 3) return 'ddd';
            if (runLength === 2) return 'dd';
            if (runLength === 1) return 'd';
            return null;
        }
        case 'X': {
            if (runLength >= 2) return runLength === 2 ? 'ZZ' : 'Z';
            return 'Z';
        }
        case 'x': {
            if (runLength >= 2) return runLength === 2 ? 'ZZ' : 'Z';
            return 'Z';
        }
        default:
            return null;
    }
}

function convertDateFnsTokensToMoment(value: string): { value: string; unsafe: boolean } {
    let output = '';
    let index = 0;
    let inMomentLiteral = false;
    let unsafe = false;

    while (index < value.length) {
        const ch = value[index];
        if (ch === '[') {
            inMomentLiteral = true;
            output += ch;
            index += 1;
            continue;
        }
        if (ch === ']') {
            inMomentLiteral = false;
            output += ch;
            index += 1;
            continue;
        }

        if (inMomentLiteral) {
            output += ch;
            index += 1;
            continue;
        }

        if (ch === 'P' || ch === 'p') {
            unsafe = true;
        }

        if (!/[A-Za-z]/u.test(ch)) {
            output += ch;
            index += 1;
            continue;
        }

        const start = index;
        while (index < value.length && value[index] === ch) {
            index += 1;
        }
        const runLength = index - start;

        const mapped = mapDateFnsToken(ch, runLength);
        output += mapped ?? ch.repeat(runLength);
    }

    return { value: output, unsafe };
}

function convertDateFnsFormatToMoment(value: string): { value: string; migrated: boolean; reset: boolean } {
    const normalized = normalizeFormatValue(value);
    if (!normalized) {
        return { value: normalized, migrated: false, reset: false };
    }

    const shouldMigrate = looksLikeDateFnsFormat(normalized) || includesDateFnsDayTokens(normalized);
    if (!shouldMigrate || looksLikeMomentFormat(normalized)) {
        return { value: normalized, migrated: false, reset: false };
    }

    const literalConverted = convertDateFnsLiteralsToMoment(normalized);
    const tokenConverted = convertDateFnsTokensToMoment(literalConverted.value);

    const converted = tokenConverted.value;
    const unsafe = tokenConverted.unsafe || literalConverted.malformed;
    if (unsafe || looksLikeDateFnsFormat(converted)) {
        return { value: '', migrated: true, reset: true };
    }

    return { value: converted, migrated: true, reset: false };
}

function migrateFormatField(params: { current: string; fallback: string }): { next: string; migrated: boolean } {
    const normalized = normalizeFormatValue(params.current);
    if (!normalized) {
        return { next: params.fallback, migrated: normalized !== params.fallback };
    }

    const converted = convertDateFnsFormatToMoment(normalized);
    if (!converted.migrated) {
        return { next: normalized, migrated: false };
    }

    if (converted.reset) {
        return { next: params.fallback, migrated: true };
    }

    return { next: converted.value, migrated: true };
}

export function migrateMomentDateFormats(params: {
    settings: NotebookNavigatorSettings;
    defaultDateFormat: string;
    defaultTimeFormat: string;
    defaultSettings: NotebookNavigatorSettings;
}): boolean {
    let migrated = false;
    const { settings, defaultDateFormat, defaultTimeFormat, defaultSettings } = params;

    const dateResult = migrateFormatField({ current: settings.dateFormat, fallback: defaultDateFormat || defaultSettings.dateFormat });
    if (dateResult.migrated) {
        settings.dateFormat = dateResult.next;
        migrated = true;
    }

    const timeResult = migrateFormatField({ current: settings.timeFormat, fallback: defaultTimeFormat || defaultSettings.timeFormat });
    if (timeResult.migrated) {
        settings.timeFormat = timeResult.next;
        migrated = true;
    }

    const frontmatterResult = migrateFormatField({ current: settings.frontmatterDateFormat, fallback: '' });
    if (frontmatterResult.migrated) {
        settings.frontmatterDateFormat = frontmatterResult.next;
        migrated = true;
    }

    return migrated;
}
