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

import { TFile } from 'obsidian';
import type { App } from 'obsidian';

import {
    NavigationPaneItemType,
    PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    TAGS_ROOT_VIRTUAL_FOLDER_ID
} from '../../types';
import type { NotebookNavigatorSettings } from '../../settings/types';
import type { MetadataService } from '../../services/MetadataService';
import type { CombinedNavigationItem } from '../../types/virtualization';
import { shouldDisplayFile, FILE_VISIBILITY } from '../../utils/fileTypeUtils';
import {
    resolveFileIconId,
    type FileIconFallbackMode,
    type FileIconResolutionSettings,
    type FileNameIconNeedle
} from '../../utils/fileIconUtils';
import { resolveUXIcon } from '../../utils/uxIcons';
import { parsePropertyNodeId } from '../../utils/propertyTree';
import {
    applyRainbowOverlay,
    type FolderRainbowColors,
    type NavigationRainbowPalettes,
    type PropertyRainbowColors,
    type ShortcutRainbowColors,
    type TagRainbowColors
} from '../../utils/navigationRainbow';

type FolderNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.FOLDER }>;
type TagNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.TAG }>;
type UntaggedNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.UNTAGGED }>;
type TagLikeNavigationItem = TagNavigationItem | UntaggedNavigationItem;
type PropertyKeyNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.PROPERTY_KEY }>;
type PropertyValueNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.PROPERTY_VALUE }>;
type PropertyLikeNavigationItem = PropertyKeyNavigationItem | PropertyValueNavigationItem;
type VirtualFolderNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.VIRTUAL_FOLDER }>;
type ShortcutFolderNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_FOLDER }>;
type ShortcutTagNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_TAG }>;
type ShortcutPropertyNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_PROPERTY }>;
type ShortcutNoteNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_NOTE }>;
type ShortcutSearchNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_SEARCH }>;
type RecentNoteNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.RECENT_NOTE }>;

interface FolderRainbowContext {
    isEnabled: boolean;
    scope: NotebookNavigatorSettings['navRainbow']['folders']['scope'];
    rootLevel: number;
    colors: FolderRainbowColors;
}

interface TagRainbowContext {
    isEnabled: boolean;
    scope: NotebookNavigatorSettings['navRainbow']['tags']['scope'];
    rootLevel: number;
    colors: TagRainbowColors;
}

interface PropertyRainbowContext {
    isEnabled: boolean;
    scope: NotebookNavigatorSettings['navRainbow']['properties']['scope'];
    rootLevel: number;
    colors: PropertyRainbowColors;
}

interface ShortcutRainbowContext {
    isEnabled: boolean;
    colors: ShortcutRainbowColors;
}

interface NavigationRainbowContext {
    mode: NotebookNavigatorSettings['navRainbow']['mode'];
    isEnabled: boolean;
    folder: FolderRainbowContext;
    tag: TagRainbowContext;
    property: PropertyRainbowContext;
    shortcut: ShortcutRainbowContext;
}

interface NavigationFileIconContext {
    settings: FileIconResolutionSettings;
    fallbackMode: FileIconFallbackMode;
    fileNameIconNeedles: readonly FileNameIconNeedle[];
    getFileNameForMatch: (file: TFile) => string | undefined;
}

interface NavigationItemDecorationContext {
    app: App;
    settings: NotebookNavigatorSettings;
    metadataService: MetadataService;
    parsedExcludedFolders: string[];
    getFolderDisplayData: (folderPath: string) => ReturnType<MetadataService['getFolderDisplayData']>;
    fileIcons: NavigationFileIconContext;
    rainbow: NavigationRainbowContext;
}

export interface NavigationRainbowColors {
    folder: FolderRainbowColors;
    tag: TagRainbowColors;
    property: PropertyRainbowColors;
    shortcut: ShortcutRainbowColors;
}

function createNavigationItemDecorationContext(params: {
    app: App;
    settings: NotebookNavigatorSettings;
    fileNameIconNeedles: readonly FileNameIconNeedle[];
    getFileDisplayName: (file: TFile) => string;
    metadataService: MetadataService;
    parsedExcludedFolders: string[];
    navRainbowPalettes: NavigationRainbowPalettes;
    navRainbowColors: NavigationRainbowColors;
}): NavigationItemDecorationContext {
    const {
        app,
        settings,
        fileNameIconNeedles,
        getFileDisplayName,
        metadataService,
        parsedExcludedFolders,
        navRainbowPalettes,
        navRainbowColors
    } = params;

    const folderDisplayDataByPath = new Map<string, ReturnType<MetadataService['getFolderDisplayData']>>();
    const getFolderDisplayData = (folderPath: string): ReturnType<MetadataService['getFolderDisplayData']> => {
        const cachedData = folderDisplayDataByPath.get(folderPath);
        if (cachedData) {
            return cachedData;
        }

        const nextData = metadataService.getFolderDisplayData(folderPath);
        folderDisplayDataByPath.set(folderPath, nextData);
        return nextData;
    };

    const fileIconSettings: FileIconResolutionSettings = {
        showFilenameMatchIcons: settings.showFilenameMatchIcons,
        fileNameIconMap: settings.fileNameIconMap,
        showCategoryIcons: true,
        fileTypeIconMap: settings.fileTypeIconMap
    };
    const fileIconFallbackMode: FileIconFallbackMode = 'file';
    const getFileNameForMatch = (file: TFile): string | undefined => {
        if (!settings.showFilenameMatchIcons) {
            return undefined;
        }
        return getFileDisplayName(file);
    };

    const rainbowMode = settings.navRainbow.mode;
    const isRainbowEnabled = rainbowMode !== 'none';

    const folderRootLevel = settings.showRootFolder ? 1 : 0;
    const tagRootLevel = settings.showAllTagsFolder ? 1 : 0;
    const propertyRootLevel = settings.showAllPropertiesFolder ? 1 : 0;

    const folderPalette = navRainbowPalettes.folder;
    const tagPalette = navRainbowPalettes.tag;
    const propertyPalette = navRainbowPalettes.property;
    const shortcutPalette = navRainbowPalettes.shortcut;

    return {
        app,
        settings,
        metadataService,
        parsedExcludedFolders,
        getFolderDisplayData,
        fileIcons: {
            settings: fileIconSettings,
            fallbackMode: fileIconFallbackMode,
            fileNameIconNeedles,
            getFileNameForMatch
        },
        rainbow: {
            mode: rainbowMode,
            isEnabled: isRainbowEnabled,
            folder: {
                isEnabled: Boolean(folderPalette),
                scope: settings.navRainbow.folders.scope,
                rootLevel: folderRootLevel,
                colors: navRainbowColors.folder
            },
            tag: {
                isEnabled: Boolean(tagPalette),
                scope: settings.navRainbow.tags.scope,
                rootLevel: tagRootLevel,
                colors: navRainbowColors.tag
            },
            property: {
                isEnabled: Boolean(propertyPalette),
                scope: settings.navRainbow.properties.scope,
                rootLevel: propertyRootLevel,
                colors: navRainbowColors.property
            },
            shortcut: { isEnabled: Boolean(shortcutPalette), colors: navRainbowColors.shortcut }
        }
    };
}

function applyRainbowOverlayToColors(params: {
    ctx: NavigationItemDecorationContext;
    rainbowColor: string | undefined;
    color: string | undefined;
    backgroundColor: string | undefined;
}): { color?: string; backgroundColor?: string } {
    const { ctx, rainbowColor, color, backgroundColor } = params;

    if (!ctx.rainbow.isEnabled || !rainbowColor) {
        return { color, backgroundColor };
    }

    return applyRainbowOverlay({
        mode: ctx.rainbow.mode,
        rainbowColor,
        color,
        backgroundColor
    });
}

function inheritVirtualFolderStyle(params: {
    ctx: NavigationItemDecorationContext;
    enabled: boolean;
    virtualFolderId: string;
    color: string | undefined;
    backgroundColor: string | undefined;
}): { color: string | undefined; backgroundColor: string | undefined } | null {
    const { ctx, enabled, virtualFolderId, color, backgroundColor } = params;
    if (!enabled) {
        return null;
    }

    if (color && backgroundColor) {
        return null;
    }

    const inheritedColor = color ? undefined : ctx.settings.virtualFolderColors[virtualFolderId];
    const inheritedBackgroundColor = backgroundColor ? undefined : ctx.settings.virtualFolderBackgroundColors[virtualFolderId];

    if (!inheritedColor && !inheritedBackgroundColor) {
        return null;
    }

    return {
        color: color ?? inheritedColor,
        backgroundColor: backgroundColor ?? inheritedBackgroundColor
    };
}

function inheritShortcutsRootStyle(
    ctx: NavigationItemDecorationContext,
    color: string | undefined,
    backgroundColor: string | undefined
): { color: string | undefined; backgroundColor: string | undefined } | null {
    return inheritVirtualFolderStyle({
        ctx,
        enabled: ctx.settings.inheritFolderColors,
        virtualFolderId: SHORTCUTS_VIRTUAL_FOLDER_ID,
        color,
        backgroundColor
    });
}

function overlayItemWithRainbow<T extends { color?: string; backgroundColor?: string }>(
    ctx: NavigationItemDecorationContext,
    item: T,
    rainbowColor: string | undefined
): T {
    if (!ctx.rainbow.isEnabled || !rainbowColor) {
        return item;
    }

    const baseColor = item.color ?? undefined;
    const baseBackgroundColor = item.backgroundColor ?? undefined;
    const next = applyRainbowOverlayToColors({
        ctx,
        rainbowColor,
        color: baseColor,
        backgroundColor: baseBackgroundColor
    });

    if (next.color === baseColor && next.backgroundColor === baseBackgroundColor) {
        return item;
    }

    return { ...item, ...next };
}

function resolveNavigationFileIconId(
    ctx: NavigationItemDecorationContext,
    file: TFile,
    customIconId: string | undefined
): string | undefined {
    const isExternalFile = !shouldDisplayFile(file, FILE_VISIBILITY.SUPPORTED, ctx.app);
    const resolvedIconId = resolveFileIconId(file, ctx.fileIcons.settings, {
        customIconId,
        metadataCache: ctx.app.metadataCache,
        isExternalFile,
        fallbackMode: ctx.fileIcons.fallbackMode,
        fileNameNeedles: ctx.fileIcons.fileNameIconNeedles,
        fileNameForMatch: ctx.fileIcons.getFileNameForMatch(file)
    });

    return resolvedIconId ?? undefined;
}

function resolveShortcutRainbowColor(ctx: NavigationItemDecorationContext, key: string): string | undefined {
    if (!ctx.rainbow.shortcut.isEnabled) {
        return undefined;
    }
    return ctx.rainbow.shortcut.colors.colorsByKey.get(key);
}

function decorateFolderNavigationItem(ctx: NavigationItemDecorationContext, item: FolderNavigationItem): CombinedNavigationItem {
    const folderDisplayData = ctx.getFolderDisplayData(item.data.path);
    let color = folderDisplayData.color;
    let backgroundColor = folderDisplayData.backgroundColor;

    const folderRainbow = ctx.rainbow.folder;
    if (!item.isExcluded && folderRainbow.isEnabled) {
        const isVirtualRootFolder = item.data.path === '/';
        const ownRainbowColor = folderRainbow.colors.colorsByPath.get(item.data.path);
        const inheritedRainbowColor = ownRainbowColor ? undefined : folderRainbow.colors.getInheritedColor(item.data.path);
        const rainbowColor = ownRainbowColor ?? inheritedRainbowColor ?? (isVirtualRootFolder ? folderRainbow.colors.rootColor : undefined);
        const shouldApplyByScope =
            folderRainbow.scope === 'all'
                ? true
                : folderRainbow.scope === 'root'
                  ? isVirtualRootFolder || item.level === folderRainbow.rootLevel || Boolean(inheritedRainbowColor)
                  : item.level > folderRainbow.rootLevel;

        if (shouldApplyByScope && rainbowColor) {
            const next = applyRainbowOverlayToColors({ ctx, rainbowColor, color, backgroundColor });
            color = next.color;
            backgroundColor = next.backgroundColor;
        }
    }

    return {
        ...item,
        displayName: folderDisplayData.displayName,
        color,
        backgroundColor,
        icon: folderDisplayData.icon,
        parsedExcludedFolders: ctx.parsedExcludedFolders
    };
}

function decorateTagLikeNavigationItem(ctx: NavigationItemDecorationContext, item: TagLikeNavigationItem): CombinedNavigationItem {
    const tagNode = item.data;
    const tagColorData = ctx.metadataService.getTagColorData(tagNode.path);

    let color = tagColorData.color;
    let backgroundColor = tagColorData.background;

    const inheritedRoot = inheritVirtualFolderStyle({
        ctx,
        enabled: ctx.settings.showAllTagsFolder && ctx.settings.inheritTagColors,
        virtualFolderId: TAGS_ROOT_VIRTUAL_FOLDER_ID,
        color,
        backgroundColor
    });
    if (inheritedRoot) {
        color = inheritedRoot.color;
        backgroundColor = inheritedRoot.backgroundColor;
    }

    const tagRainbow = ctx.rainbow.tag;
    if (tagRainbow.isEnabled) {
        const ownRainbowColor = tagRainbow.colors.colorsByPath.get(tagNode.path);
        const inheritedRainbowColor = ownRainbowColor ? undefined : tagRainbow.colors.getInheritedColor(tagNode.path);
        const rainbowColor = ownRainbowColor ?? inheritedRainbowColor;
        const shouldApplyByScope =
            tagRainbow.scope === 'all'
                ? true
                : tagRainbow.scope === 'root'
                  ? item.level === tagRainbow.rootLevel || Boolean(inheritedRainbowColor)
                  : item.level > tagRainbow.rootLevel;

        if (shouldApplyByScope && rainbowColor) {
            const next = applyRainbowOverlayToColors({ ctx, rainbowColor, color, backgroundColor });
            color = next.color;
            backgroundColor = next.backgroundColor;
        }
    }

    return {
        ...item,
        color,
        backgroundColor,
        icon: ctx.metadataService.getTagIcon(tagNode.path)
    };
}

function decoratePropertyLikeNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: PropertyLikeNavigationItem
): CombinedNavigationItem {
    const propertyNode = item.data;
    const propertyNodeId = propertyNode.id;
    const propertyColorData = ctx.metadataService.getPropertyColorData(propertyNodeId);
    const icon =
        ctx.metadataService.getPropertyIcon(propertyNodeId) ||
        (propertyNode.kind === 'value' ? resolveUXIcon(ctx.settings.interfaceIcons, 'nav-property-value') : undefined);

    let color = propertyColorData.color;
    let backgroundColor = propertyColorData.background;

    const inheritedRoot = inheritVirtualFolderStyle({
        ctx,
        enabled: ctx.settings.showAllPropertiesFolder && ctx.settings.inheritPropertyColors,
        virtualFolderId: PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
        color,
        backgroundColor
    });
    if (inheritedRoot) {
        color = inheritedRoot.color;
        backgroundColor = inheritedRoot.backgroundColor;
    }

    const propertyRainbow = ctx.rainbow.property;
    if (propertyRainbow.isEnabled) {
        const ownRainbowColor = propertyRainbow.colors.colorsByNodeId.get(propertyNode.id);
        const inheritedRainbowColor =
            ownRainbowColor || propertyRainbow.scope !== 'root' || !ctx.settings.inheritPropertyColors || propertyNode.kind !== 'value'
                ? undefined
                : propertyRainbow.colors.rootColorsByKey.get(propertyNode.key);
        const rainbowColor = ownRainbowColor ?? inheritedRainbowColor;
        const isPropertyRootNode = propertyNode.kind === 'key' && item.level === propertyRainbow.rootLevel;
        const shouldApplyByScope =
            propertyRainbow.scope === 'all'
                ? true
                : propertyRainbow.scope === 'root'
                  ? isPropertyRootNode || Boolean(inheritedRainbowColor)
                  : !isPropertyRootNode;

        if (shouldApplyByScope && rainbowColor) {
            const next = applyRainbowOverlayToColors({ ctx, rainbowColor, color, backgroundColor });
            color = next.color;
            backgroundColor = next.backgroundColor;
        }
    }

    return { ...item, color, backgroundColor, icon };
}

function decorateVirtualFolderNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: VirtualFolderNavigationItem
): CombinedNavigationItem {
    const virtualFolderId = item.data.id;
    const color = ctx.settings.virtualFolderColors[virtualFolderId];
    const backgroundColor = ctx.settings.virtualFolderBackgroundColors[virtualFolderId];
    const nextItem =
        color || backgroundColor
            ? {
                  ...item,
                  color: color ?? undefined,
                  backgroundColor: backgroundColor ?? undefined
              }
            : item;

    let rainbowColor: string | undefined;
    if (item.data.id === TAGS_ROOT_VIRTUAL_FOLDER_ID) {
        rainbowColor = ctx.rainbow.tag.colors.rootColor;
    } else if (item.data.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
        rainbowColor = ctx.rainbow.property.colors.rootColor;
    } else if (item.data.id === SHORTCUTS_VIRTUAL_FOLDER_ID) {
        rainbowColor = ctx.rainbow.shortcut.colors.rootColor;
    }

    return overlayItemWithRainbow(ctx, nextItem, rainbowColor);
}

function decorateShortcutFolderNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: ShortcutFolderNavigationItem
): CombinedNavigationItem {
    const folderPath = item.folder?.path;
    const folderDisplayData = folderPath ? ctx.getFolderDisplayData(folderPath) : undefined;
    const defaultIcon = folderPath === '/' ? 'vault' : 'lucide-folder';

    let color = folderDisplayData?.color;
    let backgroundColor: string | undefined;

    const inheritedRoot = inheritShortcutsRootStyle(ctx, color, backgroundColor);
    if (inheritedRoot) {
        color = inheritedRoot.color;
        backgroundColor = inheritedRoot.backgroundColor;
    }

    if (!item.isExcluded) {
        const rainbowColor = resolveShortcutRainbowColor(ctx, item.key);
        if (rainbowColor) {
            const next = applyRainbowOverlayToColors({ ctx, rainbowColor, color, backgroundColor });
            color = next.color;
            backgroundColor = next.backgroundColor;
        }
    }

    return {
        ...item,
        displayName: folderDisplayData?.displayName,
        icon: folderDisplayData?.icon || defaultIcon,
        color,
        backgroundColor
    };
}

function decorateShortcutTagNavigationItem(ctx: NavigationItemDecorationContext, item: ShortcutTagNavigationItem): CombinedNavigationItem {
    const tagColorData = ctx.metadataService.getTagColorData(item.tagPath);
    let color = tagColorData.color;
    let backgroundColor: string | undefined;

    const inheritedRoot = inheritShortcutsRootStyle(ctx, color, backgroundColor);
    if (inheritedRoot) {
        color = inheritedRoot.color;
        backgroundColor = inheritedRoot.backgroundColor;
    }

    const rainbowColor = resolveShortcutRainbowColor(ctx, item.key);
    if (rainbowColor) {
        const next = applyRainbowOverlayToColors({ ctx, rainbowColor, color, backgroundColor });
        color = next.color;
        backgroundColor = next.backgroundColor;
    }

    return {
        ...item,
        icon: ctx.metadataService.getTagIcon(item.tagPath) || resolveUXIcon(ctx.settings.interfaceIcons, 'nav-tag'),
        color,
        backgroundColor
    };
}

function decorateShortcutPropertyNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: ShortcutPropertyNavigationItem
): CombinedNavigationItem {
    const propertyNodeId = item.propertyNodeId;
    const propertyColorData = ctx.metadataService.getPropertyColorData(propertyNodeId);
    const icon = (() => {
        if (propertyNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
            return resolveUXIcon(ctx.settings.interfaceIcons, 'nav-properties');
        }

        const parsed = parsePropertyNodeId(propertyNodeId);
        return (
            ctx.metadataService.getPropertyIcon(propertyNodeId) ||
            (parsed?.valuePath
                ? resolveUXIcon(ctx.settings.interfaceIcons, 'nav-property-value')
                : resolveUXIcon(ctx.settings.interfaceIcons, 'nav-property'))
        );
    })();

    let color = propertyColorData.color;
    let backgroundColor: string | undefined;

    const inheritedRoot = inheritShortcutsRootStyle(ctx, color, backgroundColor);
    if (inheritedRoot) {
        color = inheritedRoot.color;
        backgroundColor = inheritedRoot.backgroundColor;
    }

    const rainbowColor = resolveShortcutRainbowColor(ctx, item.key);
    if (rainbowColor) {
        const next = applyRainbowOverlayToColors({ ctx, rainbowColor, color, backgroundColor });
        color = next.color;
        backgroundColor = next.backgroundColor;
    }

    return { ...item, icon, color, backgroundColor };
}

function decorateShortcutNoteNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: ShortcutNoteNavigationItem
): CombinedNavigationItem {
    const note = item.note;
    if (!note) {
        return item;
    }

    const baseColor = ctx.metadataService.getFileColor(note.path);
    const customIconId = ctx.metadataService.getFileIcon(note.path);
    const resolvedIconId = resolveNavigationFileIconId(ctx, note, customIconId);

    let color = baseColor;
    let backgroundColor: string | undefined;

    const inheritedRoot = inheritShortcutsRootStyle(ctx, color, backgroundColor);
    if (inheritedRoot) {
        color = inheritedRoot.color;
        backgroundColor = inheritedRoot.backgroundColor;
    }

    const rainbowColor = resolveShortcutRainbowColor(ctx, item.key);
    if (rainbowColor) {
        const next = applyRainbowOverlayToColors({ ctx, rainbowColor, color, backgroundColor });
        color = next.color;
        backgroundColor = next.backgroundColor;
    }

    return { ...item, icon: resolvedIconId ?? undefined, color, backgroundColor };
}

function decorateRecentNoteNavigationItem(ctx: NavigationItemDecorationContext, item: RecentNoteNavigationItem): CombinedNavigationItem {
    const note = item.note;
    const customIconId = ctx.metadataService.getFileIcon(note.path);
    const color = ctx.metadataService.getFileColor(note.path);
    const resolvedIconId = resolveNavigationFileIconId(ctx, note, customIconId);

    return { ...item, icon: resolvedIconId ?? undefined, color };
}

function decorateShortcutSearchNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: ShortcutSearchNavigationItem
): CombinedNavigationItem {
    let color = item.color;
    let backgroundColor: string | undefined;

    const inheritedRoot = inheritShortcutsRootStyle(ctx, color, backgroundColor);
    if (inheritedRoot) {
        color = inheritedRoot.color;
        backgroundColor = inheritedRoot.backgroundColor;
    }

    const rainbowColor = resolveShortcutRainbowColor(ctx, item.key);
    if (color === item.color && backgroundColor === item.backgroundColor) {
        return overlayItemWithRainbow(ctx, item, rainbowColor);
    }
    return overlayItemWithRainbow(ctx, { ...item, color, backgroundColor }, rainbowColor);
}

function decorateNavigationItem(ctx: NavigationItemDecorationContext, item: CombinedNavigationItem): CombinedNavigationItem {
    switch (item.type) {
        case NavigationPaneItemType.FOLDER:
            return decorateFolderNavigationItem(ctx, item);
        case NavigationPaneItemType.TAG:
        case NavigationPaneItemType.UNTAGGED:
            return decorateTagLikeNavigationItem(ctx, item);
        case NavigationPaneItemType.PROPERTY_KEY:
        case NavigationPaneItemType.PROPERTY_VALUE:
            return decoratePropertyLikeNavigationItem(ctx, item);
        case NavigationPaneItemType.VIRTUAL_FOLDER:
            return decorateVirtualFolderNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_FOLDER:
            return decorateShortcutFolderNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_TAG:
            return decorateShortcutTagNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_PROPERTY:
            return decorateShortcutPropertyNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_NOTE:
            return decorateShortcutNoteNavigationItem(ctx, item);
        case NavigationPaneItemType.RECENT_NOTE:
            return decorateRecentNoteNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_SEARCH:
            return decorateShortcutSearchNavigationItem(ctx, item);
        default:
            return item;
    }
}

export interface DecorateNavigationItemsParams {
    app: App;
    settings: NotebookNavigatorSettings;
    fileNameIconNeedles: readonly FileNameIconNeedle[];
    getFileDisplayName: (file: TFile) => string;
    metadataService: MetadataService;
    parsedExcludedFolders: string[];
    navRainbowPalettes: NavigationRainbowPalettes;
    navRainbowColors: NavigationRainbowColors;
}

export function createNavigationItemDecorator(
    params: DecorateNavigationItemsParams
): (item: CombinedNavigationItem) => CombinedNavigationItem {
    const {
        app,
        settings,
        fileNameIconNeedles,
        getFileDisplayName,
        metadataService,
        parsedExcludedFolders,
        navRainbowPalettes,
        navRainbowColors
    } = params;

    const ctx = createNavigationItemDecorationContext({
        app,
        settings,
        fileNameIconNeedles,
        getFileDisplayName,
        metadataService,
        parsedExcludedFolders,
        navRainbowPalettes,
        navRainbowColors
    });

    return (item: CombinedNavigationItem): CombinedNavigationItem => decorateNavigationItem(ctx, item);
}
