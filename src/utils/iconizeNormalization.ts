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

export type CanonicalDelimiter = 'kebab' | 'snake';

export interface IdentifierNormalizationRule {
    redundantPrefixes?: string[];
    canonicalDelimiter?: CanonicalDelimiter;
}

export const IDENTIFIER_NORMALIZATION_RULES = new Map<string, IdentifierNormalizationRule>([
    [
        'lucide',
        {
            redundantPrefixes: ['lucide-']
        }
    ],
    [
        'phosphor',
        {
            redundantPrefixes: ['ph-']
        }
    ],
    [
        'rpg-awesome',
        {
            redundantPrefixes: ['ra-']
        }
    ],
    [
        'material-icons',
        {
            redundantPrefixes: [],
            canonicalDelimiter: 'snake'
        }
    ]
]);

export function stripAllLeadingPrefixes(identifier: string, prefixes: string[]): string {
    let normalized = identifier;
    if (normalized.length === 0 || prefixes.length === 0) {
        return normalized;
    }

    const loweredPrefixes = prefixes.map(prefix => prefix.toLowerCase());

    let removed = true;
    while (removed && normalized.length > 0) {
        removed = false;
        for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i];
            if (!prefix) {
                continue;
            }
            const loweredPrefix = loweredPrefixes[i];
            if (normalized.toLowerCase().startsWith(loweredPrefix)) {
                normalized = normalized.substring(prefix.length);
                removed = true;
                break;
            }
        }
    }

    return normalized;
}

export function normalizeIdentifierFromIconize(identifier: string, providerId: string): string {
    const rule = IDENTIFIER_NORMALIZATION_RULES.get(providerId);
    if (!rule) {
        return identifier;
    }

    const normalized = stripAllLeadingPrefixes(identifier, rule.redundantPrefixes ?? []);
    if (!rule.canonicalDelimiter) {
        return normalized;
    }

    if (rule.canonicalDelimiter === 'snake') {
        return normalized.replace(/-/g, '_');
    }

    if (rule.canonicalDelimiter === 'kebab') {
        return normalized.replace(/_/g, '-');
    }

    return normalized;
}

export function normalizeIconizeCompactName(value: string): string {
    return value
        .split(/[ -]|[ _]/g)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

export function decodeCompactNameToKebab(value: string): string {
    if (!value) {
        return '';
    }

    return value
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();
}
