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
import {
    clearCalendarFeatureImageRegenerationSlotsForPath,
    consumeCalendarFeatureImageRegenerationSlot
} from '../../src/components/calendar/useCalendarFeatureImages';

describe('calendar feature images', () => {
    it('deduplicates missing-blob regeneration requests by file and feature image key', () => {
        const regenerationKeys = new Set<string>();

        expect(
            consumeCalendarFeatureImageRegenerationSlot({
                regenerationKeys,
                filePath: 'Daily/2026-05-31.md',
                featureImageKey: 'local:image.png:1'
            })
        ).toBe(true);

        expect(
            consumeCalendarFeatureImageRegenerationSlot({
                regenerationKeys,
                filePath: 'Daily/2026-05-31.md',
                featureImageKey: 'local:image.png:1'
            })
        ).toBe(false);

        expect(
            consumeCalendarFeatureImageRegenerationSlot({
                regenerationKeys,
                filePath: 'Daily/2026-05-31.md',
                featureImageKey: 'local:image.png:2'
            })
        ).toBe(true);
    });

    it('clears missing-blob regeneration slots when feature image content changes', () => {
        const regenerationKeys = new Set<string>();
        consumeCalendarFeatureImageRegenerationSlot({
            regenerationKeys,
            filePath: 'Daily/2026-05-31.md',
            featureImageKey: 'local:image.png:1'
        });
        consumeCalendarFeatureImageRegenerationSlot({
            regenerationKeys,
            filePath: 'Daily/2026-06-01.md',
            featureImageKey: 'local:image.png:1'
        });

        clearCalendarFeatureImageRegenerationSlotsForPath(regenerationKeys, 'Daily/2026-05-31.md');

        expect(regenerationKeys.has('Daily/2026-05-31.md\0local:image.png:1')).toBe(false);
        expect(regenerationKeys.has('Daily/2026-06-01.md\0local:image.png:1')).toBe(true);
    });

    it('ignores malformed missing-blob regeneration requests', () => {
        const regenerationKeys = new Set<string>();

        expect(
            consumeCalendarFeatureImageRegenerationSlot({
                regenerationKeys,
                filePath: '',
                featureImageKey: 'local:image.png:1'
            })
        ).toBe(false);

        expect(
            consumeCalendarFeatureImageRegenerationSlot({
                regenerationKeys,
                filePath: 'Daily/2026-05-31.md',
                featureImageKey: ''
            })
        ).toBe(false);
        expect(regenerationKeys.size).toBe(0);
    });
});
