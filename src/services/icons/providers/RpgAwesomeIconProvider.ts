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

interface RpgAwesomeMetadataEntry {
    id: string;
    name?: string;
    unicode: string;
    keywords?: string[];
    categories?: string[];
}

/**
 * Icon provider for RPG Awesome icons loaded from external assets.
 */
export class RpgAwesomeIconProvider extends BaseFontIconProvider {
    readonly id = 'rpg-awesome';
    readonly name = 'RPG Awesome';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-rpg-awesome';
    }

    /**
     * Parses RPG Awesome metadata, handling both array and object formats.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as RpgAwesomeMetadataEntry[] | Record<string, RpgAwesomeMetadataEntry | string>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            if (Array.isArray(parsed)) {
                parsed.forEach(entry => this.addEntry(entry, definitions, lookup));
            } else {
                Object.entries(parsed).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        this.addEntry({ id: key, unicode: value }, definitions, lookup);
                        return;
                    }

                    const entryValue = value as Partial<RpgAwesomeMetadataEntry>;
                    this.addEntry(
                        {
                            id: entryValue.id ?? key,
                            name: entryValue.name,
                            unicode: entryValue.unicode || '',
                            keywords: entryValue.keywords,
                            categories: entryValue.categories
                        },
                        definitions,
                        lookup
                    );
                });
            }

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    /**
     * Adds a single icon entry to definitions and lookup.
     */
    private addEntry(
        entry: Partial<RpgAwesomeMetadataEntry>,
        definitions: IconDefinition[],
        lookup: Map<string, { unicode: string; keywords: string[] }>
    ): void {
        if (!entry || !entry.id || !entry.unicode) {
            return;
        }

        const keywords = new Set<string>();
        keywords.add(entry.id);
        entry.keywords?.forEach(keyword => keywords.add(keyword.toLowerCase()));
        entry.categories?.forEach(category => keywords.add(category.toLowerCase()));

        const displayName = entry.name || this.formatDisplayName(entry.id);

        definitions.push({
            id: entry.id,
            displayName,
            keywords: Array.from(keywords)
        });

        lookup.set(entry.id, {
            unicode: entry.unicode,
            keywords: Array.from(keywords)
        });
    }

    /**
     * Formats icon ID by removing prefix and converting to title case.
     */
    private formatDisplayName(id: string): string {
        return id
            .replace(/^ra-/, '')
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
