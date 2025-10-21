import { describe, it, expect } from 'vitest';
import { convertIconizeToIconId, convertIconIdToIconize } from '../../src/utils/iconizeFormat';

describe('convertIconizeToIconId', () => {
    it('converts lucide identifiers without provider prefix', () => {
        expect(convertIconizeToIconId('LiHome')).toBe('home');
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

    it('returns null when no valid prefix is present', () => {
        expect(convertIconizeToIconId('Li')).toBeNull();
        expect(convertIconizeToIconId('📝')).toBeNull();
    });
});

describe('convertIconIdToIconize', () => {
    it('converts default provider identifiers', () => {
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

    it('returns null for providers without Iconize mappings', () => {
        expect(convertIconIdToIconize('emoji:📁')).toBeNull();
        expect(convertIconIdToIconize('unknown-provider:icon')).toBeNull();
    });
});
