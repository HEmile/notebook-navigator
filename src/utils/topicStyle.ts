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
import { TOPICS_ROOT_VIRTUAL_FOLDER_ID } from '../types';

interface TopicStyleSource {
    getTopicColor: (topicName: string) => string | undefined;
    getTopicBackgroundColor: (topicName: string) => string | undefined;
}

interface TopicStyleSettings {
    inheritTopicColors: boolean;
    virtualFolderColors?: Record<string, string>;
    virtualFolderBackgroundColors?: Record<string, string>;
}

export interface TopicStyle {
    color?: string;
    backgroundColor?: string;
}

/**
 * Fork: resolves a topic row's color and background. A topic's own style wins. With Inherit topic colors on, a
 * missing color or background comes from the nearest ancestor on the path the row was reached through, then from
 * the Topics section. Inheriting along the path, not the graph, gives a topic with several parents the color of
 * the branch it is shown in.
 */
export function resolveTopicStyle(source: TopicStyleSource, topicPath: string, settings: TopicStyleSettings): TopicStyle {
    const names = topicPath.split('/');
    const ownName = names[names.length - 1] ?? topicPath;
    let color = source.getTopicColor(ownName);
    let backgroundColor = source.getTopicBackgroundColor(ownName);

    if (!settings.inheritTopicColors) {
        return { color, backgroundColor };
    }

    for (let index = names.length - 2; index >= 0 && (!color || !backgroundColor); index--) {
        color ??= source.getTopicColor(names[index]);
        backgroundColor ??= source.getTopicBackgroundColor(names[index]);
    }
    color ??= settings.virtualFolderColors?.[TOPICS_ROOT_VIRTUAL_FOLDER_ID];
    backgroundColor ??= settings.virtualFolderBackgroundColors?.[TOPICS_ROOT_VIRTUAL_FOLDER_ID];
    return { color, backgroundColor };
}
