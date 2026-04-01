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
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { applyModifiedSettingsTransfer, createModifiedSettingsTransfer } from '../../src/settings/transfer';

describe('createModifiedSettingsTransfer', () => {
    it('returns an empty object when settings match defaults', () => {
        expect(createModifiedSettingsTransfer(structuredClone(DEFAULT_SETTINGS))).toEqual({});
    });

    it('ignores legacy top-level keys that are not part of current settings', () => {
        const settings = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
        settings.defaultListAppearance = 'slim';
        settings.fileIconColors = {};
        settings.numRecentNotes = 3;

        expect(createModifiedSettingsTransfer(settings as unknown as typeof DEFAULT_SETTINGS)).toEqual({});
    });

    it('exports only transferable settings that differ from defaults', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.folderSortOrder = 'alpha-desc';
        settings.searchProvider = 'omnisearch';

        expect(createModifiedSettingsTransfer(settings)).toEqual({
            folderSortOrder: 'alpha-desc'
        });
    });
});

describe('applyModifiedSettingsTransfer', () => {
    it('applies imported changes onto defaults while preserving non-transferable values from current settings', () => {
        const currentSettings = structuredClone(DEFAULT_SETTINGS);
        currentSettings.folderSortOrder = 'alpha-desc';
        currentSettings.searchProvider = 'omnisearch';

        const nextSettings = applyModifiedSettingsTransfer(currentSettings, {
            tagSortOrder: 'frequency-desc'
        });

        expect(nextSettings.folderSortOrder).toBe(DEFAULT_SETTINGS.folderSortOrder);
        expect(nextSettings.tagSortOrder).toBe('frequency-desc');
        expect(nextSettings.searchProvider).toBe('omnisearch');
    });

    it('rejects non-object transfer payloads', () => {
        expect(() => applyModifiedSettingsTransfer(structuredClone(DEFAULT_SETTINGS), 'invalid')).toThrow(
            'Settings import must be a JSON object.'
        );
    });

    it('ignores unknown top-level keys during import', () => {
        const nextSettings = applyModifiedSettingsTransfer(structuredClone(DEFAULT_SETTINGS), {
            defaultListAppearance: 'slim',
            folderSortOrder: 'alpha-desc'
        });

        expect((nextSettings as unknown as Record<string, unknown>).defaultListAppearance).toBeUndefined();
        expect(nextSettings.folderSortOrder).toBe('alpha-desc');
    });

    it('rejects invalid values for nullable string settings during import', () => {
        const nextSettings = applyModifiedSettingsTransfer(structuredClone(DEFAULT_SETTINGS), {
            homepage: { bad: true },
            folderNoteTemplate: 123
        });

        expect(nextSettings.homepage).toBeNull();
        expect(nextSettings.folderNoteTemplate).toBeNull();
    });

    it('rejects invalid values for nested nullable string settings during import', () => {
        const nextSettings = applyModifiedSettingsTransfer(structuredClone(DEFAULT_SETTINGS), {
            vaultProfiles: [
                {
                    ...structuredClone(DEFAULT_SETTINGS.vaultProfiles[0]),
                    navigationBanner: { bad: true }
                }
            ]
        });

        expect(nextSettings.vaultProfiles[0]?.navigationBanner).toBeNull();
    });
});
