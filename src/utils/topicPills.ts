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
import { getTopicNameFromPath } from './topicGraph';

/** Fork: the topic pill hidden on file rows while that topic is selected, unless selected pills are shown */
export function getSelectedTopicPillToHide(
    selectionType: string | null | undefined,
    selectedTopicPath: string | null | undefined,
    showSelectedNavigationPills: boolean
): string | null {
    if (showSelectedNavigationPills || selectionType !== 'topic' || !selectedTopicPath) {
        return null;
    }
    return getTopicNameFromPath(selectedTopicPath);
}

/** Fork: the topic names shown as pills on a file row */
export function getVisibleTopicPills(topicNames: readonly string[], topicNameToHide: string | null): readonly string[] {
    return topicNameToHide ? topicNames.filter(name => name !== topicNameToHide) : topicNames;
}

export function hasVisibleTopicPills(topicNames: readonly string[], topicNameToHide: string | null): boolean {
    return getVisibleTopicPills(topicNames, topicNameToHide).length > 0;
}
