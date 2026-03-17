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
import { extractMetadataFromCache } from '../../src/utils/metadataExtractor';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';

type CachedMetadata = {
    frontmatter?: Record<string, unknown>;
};

/**
 * Creates test settings with frontmatter metadata enabled
 * @param overrides - Optional settings to override defaults
 * @returns NotebookNavigatorSettings configured for testing
 */
function createSettings(overrides: Partial<NotebookNavigatorSettings> = {}): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        useFrontmatterMetadata: true,
        frontmatterIconField: 'icon',
        ...overrides
    };
}

describe('extractMetadataFromCache - icon extraction', () => {
    it('normalizes plain emoji values to emoji provider format', () => {
        const settings = createSettings();
        const metadata: CachedMetadata = {
            frontmatter: {
                icon: '🔭'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.icon).toBe('emoji:🔭');
    });

    it('accepts legacy provider-prefixed icon values', () => {
        const settings = createSettings();
        const metadata: CachedMetadata = {
            frontmatter: {
                icon: 'emoji:🔭'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.icon).toBe('emoji:🔭');
    });

    it('retains non-emoji icon values', () => {
        const settings = createSettings();
        const metadata: CachedMetadata = {
            frontmatter: {
                icon: 'SiGithub'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.icon).toBe('simple-icons:github');
    });

    it('accepts wikilinked vault svg icon values', () => {
        const settings = createSettings();
        const metadata: CachedMetadata = {
            frontmatter: {
                icon: '[[_resources/icons/TokenTek_Symbol_Black.svg]]'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.icon).toBe('vault:_resources/icons/TokenTek_Symbol_Black.svg');
    });
});

describe('extractMetadataFromCache - name extraction', () => {
    it('uses the first non-empty field from a comma-separated list', () => {
        const settings = createSettings({
            frontmatterNameField: 'title, name'
        });
        const metadata: CachedMetadata = {
            frontmatter: {
                title: '   ',
                name: 'Project X'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.fn).toBe('Project X');
    });

    it('respects field order in a comma-separated list', () => {
        const settings = createSettings({
            frontmatterNameField: 'title, name'
        });
        const metadata: CachedMetadata = {
            frontmatter: {
                title: 'Title value',
                name: 'Name value'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.fn).toBe('Title value');
    });

    it('supports array values and uses the first non-empty string entry', () => {
        const settings = createSettings({
            frontmatterNameField: 'title, name'
        });
        const metadata: CachedMetadata = {
            frontmatter: {
                title: [null, '  ', 'From array'],
                name: 'Fallback'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.fn).toBe('From array');
    });
});

describe('extractMetadataFromCache - background extraction', () => {
    it('extracts background color from configured frontmatter field', () => {
        const settings = createSettings({
            frontmatterBackgroundField: 'background'
        });
        const metadata: CachedMetadata = {
            frontmatter: {
                background: '#112233'
            }
        };

        const result = extractMetadataFromCache(metadata, settings);

        expect(result.background).toBe('#112233');
    });
});
