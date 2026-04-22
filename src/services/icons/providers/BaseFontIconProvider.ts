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

import { IconProvider, IconDefinition, IconRenderResult } from '../types';
import { IconAssetRecord } from '../external/IconAssetDatabase';
import { resetIconContainer } from './providerUtils';

export interface BaseFontIconProviderOptions {
    record: IconAssetRecord;
    fontFamily: string;
}

interface IconLookupEntry {
    unicode: string;
    keywords: string[];
}

/**
 * Base class for icon providers that use web fonts.
 */
export abstract class BaseFontIconProvider implements IconProvider {
    abstract readonly id: string;
    abstract readonly name: string;

    private readonly fontFamily: string;
    private fontFace: FontFace | null = null;
    private fontLoadPromise: Promise<FontFace> | null = null;
    private readonly version: string | null;

    protected iconDefinitions: IconDefinition[] = [];
    protected iconLookup: Map<string, IconLookupEntry> = new Map();

    constructor(options: BaseFontIconProviderOptions) {
        this.fontFamily = options.fontFamily;
        this.version = options.record?.version ?? null;
        this.parseMetadata(options.record.metadata);
        this.ensureFontLoaded(options.record.data);
    }

    /**
     * Cleans up font resources when provider is unregistered.
     */
    dispose(): void {
        if (this.fontFace) {
            try {
                this.removeFontFromDocument(this.fontFace);
            } catch (error) {
                console.error(`${this.getLogPrefix()} Failed to delete font face`, error);
            }
            this.fontFace = null;
        }
    }

    isAvailable(): boolean {
        return this.iconDefinitions.length > 0;
    }

    /**
     * Renders an icon glyph to the container element.
     */
    render(container: HTMLElement, iconId: string, size?: number): IconRenderResult {
        const icon = this.iconLookup.get(iconId);
        resetIconContainer(container);
        if (!icon) {
            return 'not-found';
        }

        container.addClass('nn-iconfont');
        container.addClass(this.getCssClass());
        container.setText(this.unicodeToGlyph(icon.unicode));

        if (size) {
            container.style.fontSize = `${size}px`;
            container.style.width = `${size}px`;
            container.style.height = `${size}px`;
            container.style.lineHeight = `${size}px`;
        } else {
            container.style.removeProperty('font-size');
            container.style.removeProperty('width');
            container.style.removeProperty('height');
            container.style.removeProperty('line-height');
        }

        this.fontLoadPromise?.catch(() => undefined);
        return 'rendered';
    }

    /**
     * Searches icons by display name and keywords.
     */
    search(query: string): IconDefinition[] {
        const normalized = query.trim().toLowerCase();
        if (!normalized) {
            return [];
        }

        // Collect all matching icons with relevance scores
        const matches: { icon: IconDefinition; score: number; name: string; id: string }[] = [];

        for (const icon of this.iconDefinitions) {
            const lookupEntry = this.iconLookup.get(icon.id);
            const keywords = lookupEntry?.keywords ?? [];
            const normalizedKeywords = keywords.map(keyword => keyword.toLowerCase());
            const displayName = icon.displayName?.toLowerCase() ?? '';
            const iconId = icon.id.toLowerCase();
            // Calculate match relevance score (lower score = better match)
            const score = this.resolveMatchScore(normalized, iconId, displayName, normalizedKeywords);

            if (score === null) {
                continue; // No match found
            }

            matches.push({
                icon,
                score,
                name: displayName || iconId,
                id: icon.id
            });
        }

        // Sort matches by relevance score, then alphabetically
        matches.sort((a, b) => {
            // Primary sort: by relevance score (lower is better)
            if (a.score !== b.score) {
                return a.score - b.score;
            }

            // Secondary sort: alphabetically by display name
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) {
                return nameCompare;
            }

            // Tertiary sort: alphabetically by ID
            return a.id.localeCompare(b.id);
        });

        return matches.map(match => match.icon);
    }

    getAll(): IconDefinition[] {
        return this.iconDefinitions;
    }

    /**
     * Returns the provider version from the loaded icon pack metadata
     * @returns Version string or null if no version available
     */
    getVersion(): string | null {
        return this.version;
    }

    protected abstract parseMetadata(raw: string): void;

    protected abstract getCssClass(): string;

    /**
     * Sets the icon definitions and lookup map from parsed metadata.
     */
    protected setIconData(definitions: IconDefinition[], lookup: Map<string, IconLookupEntry>): void {
        this.iconDefinitions = definitions;
        this.iconLookup = lookup;
    }

    /**
     * Clears all icon data when parsing fails.
     */
    protected clearIconData(): void {
        this.iconDefinitions = [];
        this.iconLookup.clear();
    }

    protected logParseError(message: string, error: unknown): void {
        console.error(`${this.getLogPrefix()} ${message}`, error);
    }

    /**
     * Creates and loads the font face from binary data.
     */
    private ensureFontLoaded(data: ArrayBuffer): void {
        if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
            return;
        }

        const fontFace = new FontFace(this.fontFamily, data);
        this.fontLoadPromise = fontFace
            .load()
            .then(loaded => {
                this.addFontToDocument(loaded);
                this.fontFace = loaded;
                return loaded;
            })
            .catch(error => {
                console.error(`${this.getLogPrefix()} Failed to load font`, error);
                throw error;
            });
    }

    /**
     * Converts a hex unicode string to its corresponding character.
     */
    private unicodeToGlyph(unicode: string): string {
        try {
            return String.fromCodePoint(parseInt(unicode, 16));
        } catch {
            return '';
        }
    }

    /**
     * Adds loaded font to the document's font set.
     */
    private addFontToDocument(fontFace: FontFace): void {
        if (typeof document === 'undefined') {
            return;
        }
        const fontSet = document.fonts as unknown as { add?: (font: FontFace) => void };
        fontSet.add?.(fontFace);
    }

    /**
     * Removes font from the document's font set.
     */
    private removeFontFromDocument(fontFace: FontFace): void {
        if (typeof document === 'undefined') {
            return;
        }
        const fontSet = document.fonts as unknown as { delete?: (font: FontFace) => void };
        fontSet.delete?.(fontFace);
    }

    /**
     * Calculates a relevance score for how well an icon matches a search query
     * Lower scores indicate better matches
     * @param query - The search query (normalized to lowercase)
     * @param iconId - The icon ID (normalized to lowercase)
     * @param displayName - The display name (normalized to lowercase)
     * @param keywords - Array of keywords (normalized to lowercase)
     * @returns Score from 0-8 (lower is better) or null if no match
     */
    private resolveMatchScore(query: string, iconId: string, displayName: string, keywords: string[]): number | null {
        // Exact matches (highest priority)
        if (iconId === query) {
            return 0;
        }
        if (displayName && displayName === query) {
            return 1;
        }
        if (keywords.includes(query)) {
            return 2;
        }
        // Prefix matches (high priority)
        if (iconId.startsWith(query)) {
            return 3;
        }
        if (displayName && displayName.startsWith(query)) {
            return 4;
        }
        if (keywords.some(keyword => keyword.startsWith(query))) {
            return 5;
        }
        // Substring matches (lower priority)
        if (iconId.includes(query)) {
            return 6;
        }
        if (displayName && displayName.includes(query)) {
            return 7;
        }
        if (keywords.some(keyword => keyword.includes(query))) {
            return 8;
        }
        // No match found
        return null;
    }

    private getLogPrefix(): string {
        return `[${this.name}]`;
    }
}
