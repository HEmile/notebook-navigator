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

import { casefold } from '../../utils/recordUtils';

export interface FrontmatterTagField {
    key: string;
    lowerKey: string;
    isAlias: boolean;
    value: string | unknown[];
    set(nextValue: string | unknown[]): void;
    remove(): void;
}

export type FrontmatterTagMutator = (field: FrontmatterTagField) => void;

/**
 * Visits all frontmatter fields that may store tags or tag aliases.
 * Provides helpers to update or remove values without duplicating traversal logic.
 *
 * @param frontmatter - The YAML frontmatter object supplied by Obsidian
 * @param mutator - Called for each tag/alias field with helpers to mutate the value
 * @returns True when any field was changed
 */
export function mutateFrontmatterTagFields(frontmatter: Record<string, unknown>, mutator: FrontmatterTagMutator): boolean {
    let changed = false;

    // Creates field descriptor with set/remove helpers and invokes the mutator
    const mutateValue = (key: string, lowerKey: string, current: string | unknown[]) => {
        const field: FrontmatterTagField = {
            key,
            lowerKey,
            isAlias: lowerKey === 'aliases' || lowerKey === 'alias',
            value: current,
            set: (nextValue: string | unknown[]) => {
                const existing = frontmatter[key];
                if (Array.isArray(existing) && Array.isArray(nextValue)) {
                    if (existing.length === nextValue.length && existing.every((entry, index) => entry === nextValue[index])) {
                        return;
                    }
                } else if (existing === nextValue) {
                    return;
                }
                frontmatter[key] = nextValue;
                changed = true;
            },
            remove: () => {
                if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
                    delete frontmatter[key];
                    changed = true;
                }
            }
        };

        mutator(field);
    };

    for (const key of Object.keys(frontmatter)) {
        const value = frontmatter[key];
        if (typeof value !== 'string' && !Array.isArray(value)) {
            continue;
        }

        const lowerKey = casefold(key);
        if (lowerKey === 'tags' || lowerKey === 'tag' || lowerKey === 'aliases' || lowerKey === 'alias') {
            mutateValue(key, lowerKey, value);
        }
    }

    return changed;
}
