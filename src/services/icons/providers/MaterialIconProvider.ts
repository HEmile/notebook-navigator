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

interface MaterialIconMetadataItem {
    unicode: string;
    label?: string;
    search?: string[];
}

/**
 * Icon provider for Google Material Icons web font.
 */
export class MaterialIconProvider extends BaseFontIconProvider {
    readonly id = 'material-icons';
    readonly name = 'Material Icons';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-material-icons';
    }

    /**
     * Parses Material Icons JSON metadata into icon definitions.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, MaterialIconMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            Object.entries(parsed).forEach(([iconId, data]) => {
                if (!data || !data.unicode) {
                    return;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);
                data.search?.forEach(term => keywords.add(term.toLowerCase()));
                iconId.split(/[-_]/g).forEach(part => {
                    if (part) {
                        keywords.add(part.toLowerCase());
                    }
                });
                if (data.label) {
                    keywords.add(data.label.toLowerCase());
                }

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
            });

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    /**
     * Converts snake_case or kebab-case icon ID to title case.
     */
    private formatDisplayName(iconId: string): string {
        return iconId
            .split(/[-_]/g)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
