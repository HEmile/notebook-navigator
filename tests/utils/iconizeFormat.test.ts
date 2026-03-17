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
import {
    convertIconizeToIconId,
    convertIconIdToIconize,
    normalizeCanonicalIconId,
    normalizeFileNameIconMapKey,
    normalizeFileTypeIconMapKey,
    parseIconMapText,
    serializeIconMapRecord,
    serializeIconForFrontmatter,
    deserializeIconFromFrontmatter,
    deserializeIconFromFrontmatterCompat
} from '../../src/utils/iconizeFormat';

const ENGLAND_FLAG_TAG_SEQUENCE = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';

describe('convertIconizeToIconId', () => {
    it('converts lucide identifiers without provider prefix', () => {
        expect(convertIconizeToIconId('LiHome')).toBe('home');
    });

    it('strips redundant lucide prefix from icon names when present', () => {
        expect(convertIconizeToIconId('LiLucideUser')).toBe('user');
    });

    it('converts Font Awesome solid identifiers to fontawesome-solid provider', () => {
        expect(convertIconizeToIconId('FasUser')).toBe('fontawesome-solid:user');
    });

    it('converts Font Awesome regular identifiers to canonical provider', () => {
        expect(convertIconizeToIconId('FarUser')).toBe('fontawesome-solid:user');
    });

    it('converts Simple Icons identifiers with numeric prefixes', () => {
        expect(convertIconizeToIconId('Si500Px')).toBe('simple-icons:500px');
        expect(convertIconizeToIconId('Si1Password')).toBe('simple-icons:1password');
    });

    it('converts phosphor identifiers and collapses duplicate prefixes', () => {
        expect(convertIconizeToIconId('PhAppleLogo')).toBe('phosphor:apple-logo');
        expect(convertIconizeToIconId('PhPhAppleLogo')).toBe('phosphor:apple-logo');
    });

    it('converts RPG Awesome identifiers and collapses duplicate prefixes', () => {
        expect(convertIconizeToIconId('RaHarpoonTrident')).toBe('rpg-awesome:harpoon-trident');
        expect(convertIconizeToIconId('RaRaHarpoonTrident')).toBe('rpg-awesome:harpoon-trident');
    });

    it('returns null when no valid prefix is present', () => {
        expect(convertIconizeToIconId('Li')).toBeNull();
        expect(convertIconizeToIconId('📝')).toBeNull();
    });
});

describe('convertIconIdToIconize', () => {
    it('converts default provider identifiers with explicit lucide prefix', () => {
        expect(convertIconIdToIconize('lucide-home')).toBe('LiHome');
    });

    it('converts legacy default provider identifiers without prefix', () => {
        expect(convertIconIdToIconize('home')).toBe('LiHome');
    });

    it('converts fontawesome-solid identifiers using Fas prefix', () => {
        expect(convertIconIdToIconize('fontawesome-solid:user')).toBe('FasUser');
    });

    it('converts Simple Icons identifiers that start with numbers', () => {
        expect(convertIconIdToIconize('simple-icons:500px')).toBe('Si500Px');
        expect(convertIconIdToIconize('simple-icons:1password')).toBe('Si1Password');
    });

    it('converts icon brew identifiers with hyphenated names', () => {
        expect(convertIconIdToIconize('icon-brew:custom-icon')).toBe('IbCustomIcon');
    });

    it('converts phosphor identifiers without repeating provider name', () => {
        expect(convertIconIdToIconize('phosphor:apple-logo')).toBe('PhAppleLogo');
    });

    it('converts RPG Awesome identifiers without repeating provider name', () => {
        expect(convertIconIdToIconize('rpg-awesome:harpoon-trident')).toBe('RaHarpoonTrident');
    });

    it('returns null for providers without Iconize mappings', () => {
        expect(convertIconIdToIconize('emoji:📁')).toBeNull();
        expect(convertIconIdToIconize('unknown-provider:icon')).toBeNull();
    });
});

describe('normalizeCanonicalIconId', () => {
    it('removes redundant lucide prefix', () => {
        expect(normalizeCanonicalIconId('lucide-sun')).toBe('sun');
    });

    it('normalizes phosphor identifiers by stripping provider prefix', () => {
        expect(normalizeCanonicalIconId('phosphor:ph-apple-logo')).toBe('phosphor:apple-logo');
    });

    it('normalizes RPG Awesome identifiers by stripping provider prefix', () => {
        expect(normalizeCanonicalIconId('rpg-awesome:ra-harpoon-trident')).toBe('rpg-awesome:harpoon-trident');
    });

    it('leaves unknown providers unchanged', () => {
        expect(normalizeCanonicalIconId('custom-pack:icon-name')).toBe('custom-pack:icon-name');
    });
});

describe('frontmatter icon helpers', () => {
    it('serializes canonical identifiers to Iconize format', () => {
        expect(serializeIconForFrontmatter('phosphor:ph-apple-logo')).toBe('PhAppleLogo');
    });

    it('returns bare emoji characters when serializing emoji icons', () => {
        expect(serializeIconForFrontmatter('emoji:📁')).toBe('📁');
    });

    it('returns bare keycap emoji characters when serializing emoji icons', () => {
        expect(serializeIconForFrontmatter('emoji:6️⃣')).toBe('6️⃣');
    });

    it('returns null when provider has no Iconize mapping', () => {
        expect(serializeIconForFrontmatter('custom-pack:icon-name')).toBeNull();
    });

    it('deserializes Iconize identifiers with redundant prefixes', () => {
        expect(deserializeIconFromFrontmatter('PhPhAppleLogo')).toBe('phosphor:apple-logo');
    });

    it('deserializes canonical identifiers that still contain redundant provider prefixes', () => {
        expect(deserializeIconFromFrontmatter('phosphor:ph-apple-logo')).toBe('phosphor:apple-logo');
        expect(deserializeIconFromFrontmatter('rpg-awesome:ra-harpoon-trident')).toBe('rpg-awesome:harpoon-trident');
    });

    it('deserializes wikilinked vault svg paths', () => {
        expect(deserializeIconFromFrontmatter('[[_resources/icons/TokenTek_Symbol_Black.svg]]')).toBe(
            'vault:_resources/icons/TokenTek_Symbol_Black.svg'
        );
        expect(deserializeIconFromFrontmatter(' [[_resources/icons/TokenTek_Symbol_Black.svg|TokenTek]] ')).toBe(
            'vault:_resources/icons/TokenTek_Symbol_Black.svg'
        );
    });

    it('deserializes plain emoji strings into canonical emoji identifiers', () => {
        expect(deserializeIconFromFrontmatter('📁')).toBe('emoji:📁');
    });

    it('deserializes keycap emoji strings into canonical emoji identifiers', () => {
        expect(deserializeIconFromFrontmatter('6️⃣')).toBe('emoji:6️⃣');
        expect(deserializeIconFromFrontmatter('#️⃣')).toBe('emoji:#️⃣');
        expect(deserializeIconFromFrontmatter('*️⃣')).toBe('emoji:*️⃣');
    });

    it('deserializes subdivision flag tag sequences into canonical emoji identifiers', () => {
        expect(deserializeIconFromFrontmatter(ENGLAND_FLAG_TAG_SEQUENCE)).toBe(`emoji:${ENGLAND_FLAG_TAG_SEQUENCE}`);
    });

    it('deserializes legacy lucide identifiers', () => {
        expect(deserializeIconFromFrontmatter('lucide-sun')).toBe('sun');
    });

    it('deserializes legacy provider-prefixed emoji values with compat helper', () => {
        expect(deserializeIconFromFrontmatterCompat('emoji:🔭')).toBe('emoji:🔭');
    });

    it('deserializes legacy provider-prefixed keycap emoji values with compat helper', () => {
        expect(deserializeIconFromFrontmatterCompat('emoji:6️⃣')).toBe('emoji:6️⃣');
    });

    it('serializes and deserializes subdivision flag tag sequences with compat helper', () => {
        const canonical = `emoji:${ENGLAND_FLAG_TAG_SEQUENCE}`;
        expect(serializeIconForFrontmatter(canonical)).toBe(ENGLAND_FLAG_TAG_SEQUENCE);
        expect(deserializeIconFromFrontmatterCompat(canonical)).toBe(canonical);
    });
});

describe('parseIconMapText', () => {
    it('normalizes mapping values to frontmatter icon values', () => {
        const parsed = parseIconMapText('pdf=SiGithub', normalizeFileTypeIconMapKey);
        expect(parsed.invalidLines).toEqual([]);
        expect(parsed.map.pdf).toBe('SiGithub');
    });

    it('preserves plain emoji mapping values', () => {
        const parsed = parseIconMapText('pdf=📁', normalizeFileTypeIconMapKey);
        expect(parsed.invalidLines).toEqual([]);
        expect(parsed.map.pdf).toBe('📁');
    });

    it('marks unknown Iconize-style identifiers as invalid', () => {
        const parsed = parseIconMapText('pdf=Si', normalizeFileTypeIconMapKey);
        expect(parsed.map.pdf).toBeUndefined();
        expect(parsed.invalidLines).toEqual(['pdf=Si']);
    });

    it('supports single-quoted file name keys with spaces', () => {
        const parsed = parseIconMapText("'AI '=brain", normalizeFileNameIconMapKey);
        expect(parsed.invalidLines).toEqual([]);
        expect(parsed.map['ai ']).toBe('LiBrain');
    });
});

describe('serializeIconMapRecord', () => {
    it('wraps keys containing whitespace in single quotes', () => {
        const text = serializeIconMapRecord({ 'ai ': 'LiBrain', meeting: 'LiCalendar' });
        expect(text).toBe("'ai '=LiBrain\nmeeting=LiCalendar");
        expect(parseIconMapText(text, normalizeFileNameIconMapKey).map['ai ']).toBe('LiBrain');
    });

    it("wraps keys starting with '#'", () => {
        const text = serializeIconMapRecord({ '#inbox': 'LiCalendar' });
        expect(text).toBe("'#inbox'=LiCalendar");
        expect(parseIconMapText(text, normalizeFileNameIconMapKey).map['#inbox']).toBe('LiCalendar');
    });
});
