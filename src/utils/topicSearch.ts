/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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
// Matches topic:"Name" and !topic:"Name" tokens, as parseFilterSearchTokens reads them
const TOPIC_TOKEN_PATTERN = /(^|\s)(!)?topic:\s*"([^"]+)"(?=\s|$)/gi;

/**
 * Fork: toggles a topic filter in a search query. Removes an include token for the topic (any case) when present,
 * otherwise appends topic:"Name". Exclude tokens are left alone. Topic filters combine as "any of these topics", so
 * there is no AND/OR choice as for tags.
 */
export function toggleTopicInSearchQuery(query: string, topicName: string): string {
    const name = topicName.trim();
    if (!name || name.includes('"')) {
        return query.trim();
    }

    const lowerName = name.toLowerCase();
    let removed = false;
    const withoutTopic = query.replace(
        TOPIC_TOKEN_PATTERN,
        (match: string, leading: string, bang: string | undefined, tokenName: string) => {
            if (!removed && !bang && tokenName.trim().toLowerCase() === lowerName) {
                removed = true;
                return leading;
            }
            return match;
        }
    );

    if (removed) {
        return withoutTopic.replace(/\s{2,}/g, ' ').trim();
    }

    const trimmed = query.trim();
    const token = `topic:"${name}"`;
    return trimmed ? `${trimmed} ${token}` : token;
}

/** Fork: adds topic:"Name" to a search query unless an include filter for that topic is already there */
export function addTopicToSearchQuery(query: string, topicName: string): string {
    const toggled = toggleTopicInSearchQuery(query, topicName);
    // Toggling removes an existing filter; in that case the query already had it
    return toggled.length < query.trim().length ? query.trim() : toggled;
}
