/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { IconProvider, IconDefinition } from '../types';
import { isValidEmoji, extractFirstEmoji } from '../../../utils/emojiUtils';
import * as emojilib from 'emojilib';

/**
 * Icon provider for emoji icons.
 *
 * This provider allows users to use any emoji as an icon for folders and tags.
 * It supports:
 * - Direct emoji input (e.g., "📁", "🏠", "⭐")
 * - Emoji search by keyword using the emojilib library
 * - Automatic validation and extraction of emojis from mixed input
 *
 * The provider integrates seamlessly with the icon service, rendering emojis
 * as text with appropriate sizing and styling.
 */
export class EmojiIconProvider implements IconProvider {
    id = 'emoji';
    name = 'Emoji';

    /**
     * Checks if the emoji provider is available.
     * Always returns true as emojis are universally supported.
     */
    isAvailable(): boolean {
        return true;
    }

    /**
     * Renders an emoji icon into the specified container.
     *
     * @param container - The HTML element to render the emoji into
     * @param emojiId - The emoji character(s) to render
     * @param size - Optional size in pixels for the emoji
     */
    render(container: HTMLElement, emojiId: string, size?: number): void {
        container.empty();
        container.addClass('nn-emoji-icon');
        container.setText(emojiId);

        if (size) {
            // Using inline styles here because size is dynamic and passed as parameter
            // CSS classes cannot handle arbitrary pixel values
            container.style.fontSize = `${size}px`;
            container.style.width = `${size}px`;
            container.style.height = `${size}px`;
            container.style.lineHeight = `${size}px`;
        }
    }

    /**
     * Searches for emojis based on a query string.
     *
     * @param query - The search query (can be an emoji or keyword)
     * @returns Array of matching emoji definitions, limited to 50 results
     */
    search(query: string): IconDefinition[] {
        if (!query || query.trim().length === 0) {
            return [];
        }

        // Check if the query itself is a valid emoji or can be extracted as one
        const extractedEmoji = extractFirstEmoji(query);
        const isValid = isValidEmoji(query);

        const emoji = extractedEmoji || (isValid ? query : null);

        if (emoji) {
            // Return the emoji as a search result
            return [
                {
                    id: emoji,
                    displayName: emoji,
                    preview: emoji
                }
            ];
        }

        // Search for emojis by keyword using emojilib
        const results: IconDefinition[] = [];
        const searchLower = query.toLowerCase();

        // Search through emojilib
        for (const [emoji, keywords] of Object.entries(emojilib)) {
            // Skip non-emoji entries (like the _lib key)
            if (!Array.isArray(keywords)) continue;

            // Check if any keyword matches the search query
            const matches = keywords.some(keyword => keyword.toLowerCase().includes(searchLower));

            if (matches) {
                // Find the best matching keyword for display
                const bestKeyword = keywords.find(k => k.toLowerCase().includes(searchLower)) || keywords[0];

                results.push({
                    id: emoji,
                    displayName: bestKeyword,
                    preview: emoji
                });
            }
        }

        // Limit results to prevent overwhelming the UI
        return results.slice(0, 50);
    }

    /**
     * Gets all available emoji icons.
     *
     * @returns Empty array - emojis must be searched or typed directly
     */
    getAll(): IconDefinition[] {
        // Return empty array - we don't provide a full list
        // Users must search/type to find emojis
        return [];
    }
}
