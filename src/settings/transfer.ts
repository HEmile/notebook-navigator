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

import { DEFAULT_SETTINGS } from './defaultSettings';
import type { NotebookNavigatorSettings } from './types';
import { isRecord } from '../utils/typeGuards';

// These keys are stored locally or regenerated from local state and are intentionally excluded
// from transfer exports and imports.
const NON_TRANSFERABLE_SETTING_KEYS = new Set([
    'hiddenTags',
    'fileVisibility',
    'recentColors',
    'lastReleaseCheckAt',
    'latestKnownRelease',
    'searchProvider',
    'showCalendar',
    'calendarCustomPromptForTitle',
    'saveMetadataToFrontmatter',
    'propertyFields'
]);

export const SETTINGS_TRANSFER_FILENAME = 'notebook-navigator-settings.json';

function createFilteredTransferValue(base: unknown, current: unknown): unknown {
    if (Array.isArray(base)) {
        return Array.isArray(current) ? structuredClone(current) : structuredClone(base);
    }

    if (isRecord(base)) {
        if (!isRecord(current)) {
            return structuredClone(base);
        }

        const baseKeys = Object.keys(base);
        if (baseKeys.length === 0) {
            return structuredClone(current);
        }

        const result: Record<string, unknown> = {};
        baseKeys.forEach(key => {
            if (!hasOwnKey(current, key)) {
                result[key] = structuredClone(base[key]);
                return;
            }

            result[key] = createFilteredTransferValue(base[key], current[key]);
        });

        return result;
    }

    return structuredClone(current);
}

function createTransferableSettingsSnapshot(settings: NotebookNavigatorSettings): Record<string, unknown> {
    const snapshotRecord: Record<string, unknown> = {};
    const settingsRecord = settings as unknown as Record<string, unknown>;
    const defaultRecord = DEFAULT_SETTINGS as unknown as Record<string, unknown>;

    Object.keys(defaultRecord).forEach(key => {
        if (NON_TRANSFERABLE_SETTING_KEYS.has(key)) {
            return;
        }

        snapshotRecord[key] = createFilteredTransferValue(defaultRecord[key], settingsRecord[key]);
    });

    return snapshotRecord;
}

function hasOwnKey(record: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key) === true;
}

function areEquivalentValues(left: unknown, right: unknown): boolean {
    if (left === right) {
        return true;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }

        return left.every((value, index) => areEquivalentValues(value, right[index]));
    }

    if (isRecord(left) || isRecord(right)) {
        if (!isRecord(left) || !isRecord(right)) {
            return false;
        }

        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) {
            return false;
        }

        return leftKeys.every(key => hasOwnKey(right, key) && areEquivalentValues(left[key], right[key]));
    }

    return false;
}

function createSettingsDiff(base: unknown, current: unknown): unknown {
    if (areEquivalentValues(base, current)) {
        return undefined;
    }

    if (Array.isArray(base) || Array.isArray(current)) {
        return structuredClone(current);
    }

    if (isRecord(base) && isRecord(current)) {
        const baseKeys = Object.keys(base);
        const currentKeys = Object.keys(current);
        const currentHasRemovedKeys = baseKeys.some(key => !hasOwnKey(current, key));

        if (currentHasRemovedKeys) {
            return structuredClone(current);
        }

        const diff: Record<string, unknown> = {};
        const keys = new Set([...baseKeys, ...currentKeys]);

        keys.forEach(key => {
            const nextValue = createSettingsDiff(base[key], current[key]);
            if (nextValue !== undefined) {
                diff[key] = nextValue;
            }
        });

        return Object.keys(diff).length > 0 ? diff : undefined;
    }

    return structuredClone(current);
}

function mergeSettingsDiff(base: unknown, override: unknown): unknown {
    if (override === undefined) {
        return structuredClone(base);
    }

    if (Array.isArray(base)) {
        if (!Array.isArray(override)) {
            return structuredClone(base);
        }

        if (base.length === 0) {
            return structuredClone(override);
        }

        return override.map(value => mergeSettingsDiff(base[0], value));
    }

    if (isRecord(base)) {
        if (!isRecord(override)) {
            return structuredClone(base);
        }

        const baseKeys = Object.keys(base);
        if (baseKeys.length === 0) {
            return structuredClone(override);
        }

        const result = structuredClone(base);

        baseKeys.forEach(key => {
            if (!hasOwnKey(override, key)) {
                return;
            }

            result[key] = mergeSettingsDiff(result[key], override[key]);
        });

        return result;
    }

    if (base === null) {
        return override === null || typeof override === 'string' ? structuredClone(override) : null;
    }

    return typeof override === typeof base ? structuredClone(override) : structuredClone(base);
}

export function createModifiedSettingsTransfer(settings: NotebookNavigatorSettings): Record<string, unknown> {
    // Export only the transferable settings that differ from defaults.
    // Import reconstructs the transferable settings state from this diff plus defaults.
    const currentSnapshot = createTransferableSettingsSnapshot(settings);
    const defaultSnapshot = createTransferableSettingsSnapshot(DEFAULT_SETTINGS);
    const diff = createSettingsDiff(defaultSnapshot, currentSnapshot);

    return isRecord(diff) ? diff : {};
}

export function applyModifiedSettingsTransfer(
    currentSettings: NotebookNavigatorSettings,
    transferData: unknown
): NotebookNavigatorSettings {
    if (!isRecord(transferData)) {
        throw new Error('Settings import must be a JSON object.');
    }

    // Import is state restore, not patch merge.
    // Missing transferable keys are restored to their default values.
    const defaultSnapshot = createTransferableSettingsSnapshot(DEFAULT_SETTINGS);
    const mergedSnapshot = mergeSettingsDiff(defaultSnapshot, transferData);
    if (!isRecord(mergedSnapshot)) {
        throw new Error('Settings import must be a JSON object.');
    }

    const nextSettings = structuredClone(currentSettings);
    const nextSettingsRecord = nextSettings as unknown as Record<string, unknown>;

    Object.entries(defaultSnapshot).forEach(([key]) => {
        nextSettingsRecord[key] = mergedSnapshot[key];
    });

    return nextSettings;
}
