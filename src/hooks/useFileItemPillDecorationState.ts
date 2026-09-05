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

import { useMemo } from 'react';

import { useSettingsState } from '../context/SettingsContext';
import type { NavigationPaneSourceState } from './navigationPane/data/useNavigationPaneSourceState';
import type { NavigationRainbowState } from './useNavigationRainbowState';
import {
    buildFileItemPropertyRainbowColors,
    buildFileItemTagRainbowColors,
    type FileItemPillDecorationModel
} from '../utils/fileItemPillDecoration';
import type { NavigationPaneTreeSectionsResult } from './navigationPane/data/useNavigationPaneTreeSections';

interface UseFileItemPillDecorationStateParams {
    sourceState: NavigationPaneSourceState;
    treeSections: Pick<NavigationPaneTreeSectionsResult, 'renderTagTree' | 'renderedRootTagKeys'>;
    includeDescendantNotes: boolean;
    navRainbowState: NavigationRainbowState;
}

export function useFileItemPillDecorationState({
    sourceState,
    treeSections,
    includeDescendantNotes,
    navRainbowState
}: UseFileItemPillDecorationStateParams): FileItemPillDecorationModel {
    const settings = useSettingsState();
    const { navRainbow, navRainbowPalettes } = navRainbowState;

    const tagRainbowColors = useMemo(() => {
        const palette = navRainbowPalettes.tag;
        if (!palette) {
            return {
                colorsByPath: new Map<string, string>(),
                rootColor: undefined,
                getInheritedColor: (_path: string) => undefined
            };
        }

        return buildFileItemTagRainbowColors({
            visibleTagTree: treeSections.renderTagTree,
            rootTagKeys: treeSections.renderedRootTagKeys,
            rootTagOrderMap: sourceState.rootTagOrderMap,
            tagComparator: sourceState.tagComparator,
            palette,
            scope: navRainbow.tags.scope,
            showAllTagsFolder: settings.showAllTagsFolder,
            inheritColors: settings.inheritTagColors,
            childSortOrderOverrides: settings.tagTreeSortOverrides
        });
    }, [
        navRainbow.tags.scope,
        navRainbowPalettes.tag,
        settings.inheritTagColors,
        settings.showAllTagsFolder,
        settings.tagTreeSortOverrides,
        treeSections.renderedRootTagKeys,
        treeSections.renderTagTree,
        sourceState.rootTagOrderMap,
        sourceState.tagComparator
    ]);

    const propertyRainbowColors = useMemo(() => {
        const palette = navRainbowPalettes.property;
        if (!palette) {
            return { colorsByNodeId: new Map<string, string>(), rootColor: undefined, rootColorsByKey: new Map<string, string>() };
        }

        return buildFileItemPropertyRainbowColors({
            propertyTree: sourceState.propertyTree,
            visiblePropertyNavigationKeySet: sourceState.visiblePropertyNavigationKeySet,
            rootPropertyOrderMap: sourceState.rootPropertyOrderMap,
            propertyKeyComparator: sourceState.propertyKeyComparator,
            palette,
            scope: navRainbow.properties.scope,
            showAllPropertiesFolder: settings.showAllPropertiesFolder,
            propertySortOrder: settings.propertySortOrder,
            propertyTreeSortOverrides: settings.propertyTreeSortOverrides,
            includeDescendantNotes
        });
    }, [
        includeDescendantNotes,
        navRainbow.properties.scope,
        navRainbowPalettes.property,
        settings.propertySortOrder,
        settings.propertyTreeSortOverrides,
        settings.showAllPropertiesFolder,
        sourceState.propertyKeyComparator,
        sourceState.propertyTree,
        sourceState.rootPropertyOrderMap,
        sourceState.visiblePropertyNavigationKeySet
    ]);

    return useMemo(
        () => ({
            navRainbowMode: navRainbow.mode,
            tagRainbowColors,
            propertyRainbowColors,
            inheritPropertyColors: settings.inheritPropertyColors
        }),
        [navRainbow.mode, propertyRainbowColors, settings.inheritPropertyColors, tagRainbowColors]
    );
}
