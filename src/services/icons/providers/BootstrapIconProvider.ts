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

/**
 * Icon provider for Bootstrap Icons web font.
 */
export class BootstrapIconProvider extends BaseFontIconProvider {
    readonly id = 'bootstrap-icons';
    readonly name = 'Bootstrap Icons';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-bootstrap-icons';
    }

    /**
     * Parses Bootstrap Icons JSON metadata into icon definitions.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, string | number>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            Object.entries(parsed).forEach(([iconId, unicodeValue]) => {
                const normalizedUnicode = this.normalizeUnicodeValue(unicodeValue);
                if (!normalizedUnicode) {
                    return;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);
                iconId.split('-').forEach(part => {
                    if (part) {
                        keywords.add(part.toLowerCase());
                    }
                });

                const displayName = this.formatDisplayName(iconId);

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: Array.from(keywords)
                });
                lookup.set(iconId, {
                    unicode: normalizedUnicode,
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
     * Normalizes unicode values from JSON metadata to hex strings.
     */
    private normalizeUnicodeValue(value: string | number): string | null {
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || value <= 0) {
                return null;
            }
            return value.toString(16);
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        if (/^[0-9]+$/.test(trimmed)) {
            const parsed = parseInt(trimmed, 10);
            if (Number.isNaN(parsed) || parsed <= 0) {
                return null;
            }
            return parsed.toString(16);
        }

        if (/^0x[0-9a-f]+$/i.test(trimmed)) {
            return trimmed.slice(2).toLowerCase();
        }

        if (/^[0-9a-f]+$/i.test(trimmed)) {
            return trimmed.toLowerCase();
        }

        return null;
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
