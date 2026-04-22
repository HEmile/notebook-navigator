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

import { IconDefinition } from '../types';
import { BaseFontIconProvider, BaseFontIconProviderOptions } from './BaseFontIconProvider';

interface FontAwesomeMetadataItem {
    unicode: string;
    label?: string;
    styles?: string[];
    search?: {
        terms?: string[];
    };
    aliases?: {
        names?: string[];
    };
}

/**
 * Icon provider for Font Awesome solid icons loaded from external assets.
 */
export class FontAwesomeIconProvider extends BaseFontIconProvider {
    readonly id = 'fontawesome-solid';
    readonly name = 'Font Awesome';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-fa-solid';
    }

    /**
     * Parses Font Awesome metadata, filtering for solid style icons.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, FontAwesomeMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            for (const [iconId, data] of Object.entries(parsed)) {
                if (!data || !data.unicode) {
                    continue;
                }
                if (Array.isArray(data.styles) && !data.styles.includes('solid')) {
                    continue;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);
                data.search?.terms?.forEach(term => keywords.add(term.toLowerCase()));
                data.aliases?.names?.forEach(alias => keywords.add(alias.toLowerCase()));

                const displayName = data.label || this.formatDisplayName(iconId);

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: Array.from(keywords)
                });
                lookup.set(iconId, {
                    unicode: data.unicode,
                    keywords: Array.from(keywords)
                });
            }

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    /**
     * Converts kebab-case icon ID to title case display name.
     */
    private formatDisplayName(iconId: string): string {
        return iconId
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
