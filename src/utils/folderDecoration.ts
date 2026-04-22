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

import type { NavRainbowColorMode, NavRainbowScope } from '../settings/types';
import { resolveFolderRainbowDecorationColors, type FolderRainbowColors } from './navigationRainbow';

export interface FolderDecorationColors {
    color: string | undefined;
    backgroundColor: string | undefined;
}

export interface FolderDecorationModel {
    isExcludedPath: (folderPath: string) => boolean;
    folderRainbowColors: FolderRainbowColors;
    navRainbowMode: NavRainbowColorMode;
    folderRainbowScope: NavRainbowScope;
    showRootFolder: boolean;
}

export function resolveFolderDecorationColors(params: {
    model: FolderDecorationModel;
    folderPath: string;
    color: string | null | undefined;
    backgroundColor: string | null | undefined;
}): FolderDecorationColors {
    const { model, folderPath, color, backgroundColor } = params;
    if (model.isExcludedPath(folderPath)) {
        return {
            color: color ?? undefined,
            backgroundColor: backgroundColor ?? undefined
        };
    }

    const resolved = resolveFolderRainbowDecorationColors({
        mode: model.navRainbowMode,
        folderPath,
        scope: model.folderRainbowScope,
        showRootFolder: model.showRootFolder,
        colors: model.folderRainbowColors,
        color,
        backgroundColor
    });

    return {
        color: resolved.color,
        backgroundColor: resolved.backgroundColor
    };
}
