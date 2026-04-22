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

import type {
    FolderDisplayData,
    FolderDisplayResolveOptions,
    FolderFrontmatterFields,
    FolderNoteMetadata,
    FolderStyleValues
} from './types';

interface ResolveInheritedFolderStyleValuesArgs {
    folderPath: string;
    inheritFolderColors: boolean;
    needs: {
        color: boolean;
        backgroundColor: boolean;
    };
    getFolderDisplayData: (folderPath: string, options: FolderDisplayResolveOptions) => FolderDisplayData;
}

interface ResolveFolderDisplayDataArgs {
    folderPath: string;
    resolveOptions: FolderDisplayResolveOptions;
    useFrontmatterMetadata: boolean;
    directStyle: FolderStyleValues;
    frontmatterFields: FolderFrontmatterFields;
    getFolderNoteMetadata: (folderPath: string) => FolderNoteMetadata | null;
    resolveInheritedFolderStyleValues: (needs: { color: boolean; backgroundColor: boolean }) => {
        color?: string;
        backgroundColor?: string;
    };
}

export function resolveInheritedFolderStyleValues({
    folderPath,
    inheritFolderColors,
    needs,
    getFolderDisplayData
}: ResolveInheritedFolderStyleValuesArgs): { color?: string; backgroundColor?: string } {
    if (!inheritFolderColors || (!needs.color && !needs.backgroundColor) || folderPath === '/') {
        return {};
    }

    let color: string | undefined;
    let backgroundColor: string | undefined;
    const pathParts = folderPath.split('/');

    for (let index = pathParts.length - 1; index > 0; index -= 1) {
        const ancestorPath = pathParts.slice(0, index).join('/');
        if (!ancestorPath) {
            continue;
        }

        const ancestorDisplayData = getFolderDisplayData(ancestorPath, {
            includeDisplayName: false,
            includeColor: needs.color && !color,
            includeBackgroundColor: needs.backgroundColor && !backgroundColor,
            includeIcon: false,
            includeInheritedColors: false
        });

        if (!color && ancestorDisplayData.color) {
            color = ancestorDisplayData.color;
        }
        if (!backgroundColor && ancestorDisplayData.backgroundColor) {
            backgroundColor = ancestorDisplayData.backgroundColor;
        }

        if ((!needs.color || color) && (!needs.backgroundColor || backgroundColor)) {
            return { color, backgroundColor };
        }
    }

    const rootDisplayData = getFolderDisplayData('/', {
        includeDisplayName: false,
        includeColor: needs.color && !color,
        includeBackgroundColor: needs.backgroundColor && !backgroundColor,
        includeIcon: false,
        includeInheritedColors: false
    });

    if (!color && rootDisplayData.color) {
        color = rootDisplayData.color;
    }
    if (!backgroundColor && rootDisplayData.backgroundColor) {
        backgroundColor = rootDisplayData.backgroundColor;
    }

    return { color, backgroundColor };
}

export function resolveFolderDisplayData({
    folderPath,
    resolveOptions,
    useFrontmatterMetadata,
    directStyle,
    frontmatterFields,
    getFolderNoteMetadata,
    resolveInheritedFolderStyleValues
}: ResolveFolderDisplayDataArgs): FolderDisplayData {
    const shouldResolveDisplayName = resolveOptions.includeDisplayName && useFrontmatterMetadata;
    const shouldReadIconFromFrontmatter = resolveOptions.includeIcon && useFrontmatterMetadata && Boolean(frontmatterFields.iconField);
    const shouldReadColorFromFrontmatter = resolveOptions.includeColor && useFrontmatterMetadata && Boolean(frontmatterFields.colorField);
    const shouldReadBackgroundFromFrontmatter =
        resolveOptions.includeBackgroundColor && useFrontmatterMetadata && Boolean(frontmatterFields.backgroundField);

    const shouldReadFolderNoteMetadata =
        shouldResolveDisplayName || shouldReadIconFromFrontmatter || shouldReadColorFromFrontmatter || shouldReadBackgroundFromFrontmatter;
    const folderNoteMetadata = shouldReadFolderNoteMetadata ? getFolderNoteMetadata(folderPath) : null;

    const frontmatterIcon = shouldReadIconFromFrontmatter ? folderNoteMetadata?.icon : undefined;
    const frontmatterColor = shouldReadColorFromFrontmatter ? folderNoteMetadata?.color : undefined;
    const frontmatterBackground = shouldReadBackgroundFromFrontmatter ? folderNoteMetadata?.backgroundColor : undefined;
    let color = resolveOptions.includeColor ? frontmatterColor || directStyle.color : undefined;
    let backgroundColor = resolveOptions.includeBackgroundColor ? frontmatterBackground || directStyle.backgroundColor : undefined;

    if (
        resolveOptions.includeInheritedColors &&
        ((resolveOptions.includeColor && !color) || (resolveOptions.includeBackgroundColor && !backgroundColor))
    ) {
        const inheritedValues = resolveInheritedFolderStyleValues({
            color: resolveOptions.includeColor && !color,
            backgroundColor: resolveOptions.includeBackgroundColor && !backgroundColor
        });
        if (!color) {
            color = inheritedValues.color;
        }
        if (!backgroundColor) {
            backgroundColor = inheritedValues.backgroundColor;
        }
    }

    return {
        displayName: shouldResolveDisplayName ? folderNoteMetadata?.name : undefined,
        color,
        backgroundColor,
        icon: resolveOptions.includeIcon ? frontmatterIcon || directStyle.icon : undefined
    };
}
