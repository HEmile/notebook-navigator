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

import { describe, it, expect } from 'vitest';
import { extractFirstEmoji, isValidEmoji } from '../../src/utils/emojiUtils';

const ENGLAND_FLAG_TAG_SEQUENCE = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';

describe('isValidEmoji', () => {
    it('accepts keycap emoji sequences', () => {
        expect(isValidEmoji('6️⃣')).toBe(true);
        expect(isValidEmoji('#️⃣')).toBe(true);
        expect(isValidEmoji('*️⃣')).toBe(true);
    });

    it('accepts standard pictographic emoji and flags', () => {
        expect(isValidEmoji('📁')).toBe(true);
        expect(isValidEmoji('🇸🇪')).toBe(true);
    });

    it('accepts subdivision flag tag sequences', () => {
        expect(isValidEmoji(ENGLAND_FLAG_TAG_SEQUENCE)).toBe(true);
    });

    it('rejects plain digits and mixed text content', () => {
        expect(isValidEmoji('6')).toBe(false);
        expect(isValidEmoji('Johan6️⃣Works')).toBe(false);
    });
});

describe('extractFirstEmoji', () => {
    it('extracts keycap emoji when present at the start', () => {
        expect(extractFirstEmoji('6️⃣abc')).toBe('6️⃣');
    });

    it('returns null when emoji appears after leading text', () => {
        expect(extractFirstEmoji('Johan6️⃣Works')).toBeNull();
    });

    it('returns full keycap emoji input unchanged', () => {
        expect(extractFirstEmoji('6️⃣')).toBe('6️⃣');
    });

    it('extracts subdivision flag tag sequence when present at the start', () => {
        expect(extractFirstEmoji(`${ENGLAND_FLAG_TAG_SEQUENCE}abc`)).toBe(ENGLAND_FLAG_TAG_SEQUENCE);
    });
});
