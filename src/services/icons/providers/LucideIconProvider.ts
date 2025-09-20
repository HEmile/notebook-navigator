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
import { getIconIds, setIcon } from 'obsidian';

/**
 * Icon provider for Lucide icons.
 *
 * This provider integrates with Obsidian's built-in Lucide icon set,
 * providing access to hundreds of vector icons. Features include:
 * - Full access to all Lucide icons available in Obsidian
 * - Intelligent keyword-based search with synonyms
 * - Automatic icon name formatting for display
 * - Efficient caching of available icons
 *
 * The provider uses Obsidian's native icon rendering for consistent
 * appearance across the application.
 */
export class LucideIconProvider implements IconProvider {
    id = 'lucide';
    name = 'Lucide';
    private iconCache: string[] | null = null;

    /**
     * Checks if the Lucide provider is available.
     * Verifies that Obsidian's icon APIs are accessible.
     */
    isAvailable(): boolean {
        return typeof getIconIds === 'function' && typeof setIcon === 'function';
    }

    /**
     * Renders a Lucide icon into the specified container.
     *
     * @param container - The HTML element to render the icon into
     * @param iconId - The Lucide icon identifier (e.g., 'folder', 'file-text')
     * @param size - Optional size in pixels for the icon
     */
    render(container: HTMLElement, iconId: string, size?: number): void {
        container.empty();
        setIcon(container, iconId);

        if (size) {
            // Using inline styles here because size is dynamic and passed as parameter
            // CSS classes cannot handle arbitrary pixel values
            container.style.setProperty('--icon-size', `${size}px`);
            container.style.width = `${size}px`;
            container.style.height = `${size}px`;
        }
    }

    /**
     * Searches for Lucide icons based on a query string.
     * Searches both icon names and associated keywords.
     *
     * @param query - The search query
     * @returns Array of matching icon definitions, limited to 50 results
     */
    search(query: string): IconDefinition[] {
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery) {
            return [];
        }

        const allIcons = this.getIconList();
        // Collect all matching icons with relevance scores
        const matches: { icon: IconDefinition; score: number; name: string; id: string }[] = [];

        for (const id of allIcons) {
            const keywords = this.getKeywords(id);
            const normalizedKeywords = keywords.map(keyword => keyword.toLowerCase());
            const displayName = this.formatDisplayName(id);
            const normalizedId = id.toLowerCase();
            const normalizedDisplay = displayName.toLowerCase();
            // Calculate match relevance score (lower score = better match)
            const score = this.resolveMatchScore(normalizedQuery, normalizedId, normalizedDisplay, normalizedKeywords);

            if (score === null) {
                continue; // No match found
            }

            matches.push({
                icon: {
                    id,
                    displayName,
                    keywords
                },
                score,
                name: normalizedDisplay || normalizedId,
                id
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

        // Return top 50 results to avoid overwhelming the UI
        return matches.map(match => match.icon).slice(0, 50);
    }

    /**
     * Gets all available Lucide icons.
     *
     * @returns Array of all Lucide icon definitions with formatted names and keywords
     */
    getAll(): IconDefinition[] {
        const allIcons = this.getIconList();

        return allIcons.map(id => ({
            id,
            displayName: this.formatDisplayName(id),
            keywords: this.getKeywords(id)
        }));
    }

    /**
     * Gets the cached list of available Lucide icons.
     * Lazy-loads the icon list on first access.
     */
    private getIconList(): string[] {
        if (!this.iconCache) {
            this.iconCache = getIconIds();
        }
        return this.iconCache;
    }

    /**
     * Formats an icon ID for user-friendly display.
     * Converts kebab-case to Title Case.
     *
     * @param iconId - The icon identifier (e.g., 'file-text')
     * @returns Formatted name (e.g., 'File Text')
     */
    private formatDisplayName(iconId: string): string {
        return iconId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Generates keywords for an icon based on its ID.
     * Includes synonyms and related terms for better search results.
     *
     * @param iconId - The icon identifier
     * @returns Array of keywords including synonyms
     */
    private getKeywords(iconId: string): string[] {
        const keywords = iconId.split('-');

        const keywordMap: Record<string, string[]> = {
            folder: ['directory', 'container'],
            file: ['document', 'page'],
            tag: ['label', 'category'],
            search: ['find', 'query'],
            star: ['favorite', 'bookmark'],
            heart: ['love', 'like', 'favorite'],
            home: ['house', 'main'],
            settings: ['config', 'preferences', 'gear'],
            user: ['person', 'account', 'profile'],
            calendar: ['date', 'schedule'],
            clock: ['time', 'watch'],
            mail: ['email', 'message', 'envelope'],
            phone: ['call', 'mobile'],
            trash: ['delete', 'bin', 'remove'],
            edit: ['modify', 'change', 'pencil'],
            plus: ['add', 'new', 'create'],
            check: ['done', 'complete', 'tick'],
            x: ['close', 'cancel', 'remove'],
            arrow: ['direction', 'pointer'],
            chevron: ['expand', 'collapse'],
            grid: ['layout', 'dashboard'],
            list: ['items', 'menu'],
            image: ['picture', 'photo'],
            video: ['movie', 'film'],
            music: ['audio', 'sound'],
            book: ['read', 'library'],
            bookmark: ['save', 'mark'],
            download: ['save', 'get'],
            upload: ['send', 'put'],
            share: ['send', 'distribute'],
            link: ['url', 'connection'],
            lock: ['secure', 'private'],
            unlock: ['open', 'public'],
            eye: ['view', 'see', 'visible'],
            alert: ['warning', 'attention'],
            info: ['information', 'help'],
            question: ['help', 'ask'],
            zap: ['lightning', 'fast', 'energy'],
            sun: ['light', 'day', 'bright'],
            moon: ['night', 'dark'],
            cloud: ['weather', 'storage'],
            globe: ['world', 'internet', 'web'],
            map: ['location', 'navigate'],
            pin: ['location', 'mark', 'attach'],
            flag: ['mark', 'country', 'report'],
            bell: ['notification', 'alert', 'ring'],
            message: ['chat', 'talk', 'comment'],
            code: ['programming', 'develop'],
            terminal: ['console', 'command'],
            database: ['storage', 'data'],
            server: ['host', 'backend'],
            cpu: ['processor', 'computer'],
            wifi: ['internet', 'wireless', 'network'],
            battery: ['power', 'charge'],
            printer: ['print', 'document'],
            camera: ['photo', 'capture'],
            mic: ['microphone', 'audio', 'record']
        };

        const additionalKeywords: string[] = [];
        keywords.forEach(keyword => {
            if (keywordMap[keyword]) {
                additionalKeywords.push(...keywordMap[keyword]);
            }
        });

        return [...keywords, ...additionalKeywords];
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
}
