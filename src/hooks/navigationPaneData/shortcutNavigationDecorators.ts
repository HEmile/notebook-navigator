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

import { NavigationPaneItemType, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID } from '../../types';
import type { CombinedNavigationItem } from '../../types/virtualization';
import { parsePropertyNodeId } from '../../utils/propertyTree';
import { resolveUXIcon } from '../../utils/uxIcons';
import {
    resolveNavigationFileIconId,
    resolveShortcutDecorationColors,
    type NavigationItemDecorationContext
} from './navigationItemDecorationShared';

type ShortcutFolderNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_FOLDER }>;
type ShortcutTagNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_TAG }>;
type ShortcutPropertyNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_PROPERTY }>;
type ShortcutNoteNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_NOTE }>;
type ShortcutSearchNavigationItem = Extract<CombinedNavigationItem, { type: typeof NavigationPaneItemType.SHORTCUT_SEARCH }>;

function resolveShortcutPropertyIcon(ctx: NavigationItemDecorationContext, propertyNodeId: string): string {
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
}

function decorateShortcutFolderNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: ShortcutFolderNavigationItem
): CombinedNavigationItem {
    const folderPath = item.folder?.path;
    const folderDisplayData = folderPath ? ctx.getFolderDisplayData(folderPath) : undefined;
    const defaultIcon = folderPath === '/' ? 'vault' : 'lucide-folder';
    const colors = resolveShortcutDecorationColors({
        ctx,
        itemKey: item.key,
        color: folderDisplayData?.color,
        backgroundColor: undefined,
        allowRainbow: !item.isExcluded
    });

    return {
        ...item,
        displayName: folderDisplayData?.displayName,
        icon: folderDisplayData?.icon || defaultIcon,
        color: colors.color,
        backgroundColor: colors.backgroundColor
    };
}

function decorateShortcutTagNavigationItem(ctx: NavigationItemDecorationContext, item: ShortcutTagNavigationItem): CombinedNavigationItem {
    const tagColorData = ctx.metadataService.getTagColorData(item.tagPath);
    const colors = resolveShortcutDecorationColors({
        ctx,
        itemKey: item.key,
        color: tagColorData.color,
        backgroundColor: undefined
    });

    return {
        ...item,
        icon: ctx.metadataService.getTagIcon(item.tagPath) || resolveUXIcon(ctx.settings.interfaceIcons, 'nav-tag'),
        color: colors.color,
        backgroundColor: colors.backgroundColor
    };
}

function decorateShortcutPropertyNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: ShortcutPropertyNavigationItem
): CombinedNavigationItem {
    const propertyNodeId = item.propertyNodeId;
    const propertyColorData = ctx.metadataService.getPropertyColorData(propertyNodeId);
    const colors = resolveShortcutDecorationColors({
        ctx,
        itemKey: item.key,
        color: propertyColorData.color,
        backgroundColor: undefined
    });

    return {
        ...item,
        icon: resolveShortcutPropertyIcon(ctx, propertyNodeId),
        color: colors.color,
        backgroundColor: colors.backgroundColor
    };
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
    const colors = resolveShortcutDecorationColors({
        ctx,
        itemKey: item.key,
        color: baseColor,
        backgroundColor: undefined
    });

    return {
        ...item,
        icon: resolvedIconId ?? undefined,
        color: colors.color,
        backgroundColor: colors.backgroundColor
    };
}

function decorateShortcutSearchNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: ShortcutSearchNavigationItem
): CombinedNavigationItem {
    const colors = resolveShortcutDecorationColors({
        ctx,
        itemKey: item.key,
        color: item.color,
        backgroundColor: undefined
    });

    if (colors.color === item.color && colors.backgroundColor === item.backgroundColor) {
        return item;
    }

    return { ...item, color: colors.color, backgroundColor: colors.backgroundColor };
}

export function decorateShortcutNavigationItem(
    ctx: NavigationItemDecorationContext,
    item: CombinedNavigationItem
): CombinedNavigationItem | null {
    switch (item.type) {
        case NavigationPaneItemType.SHORTCUT_FOLDER:
            return decorateShortcutFolderNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_TAG:
            return decorateShortcutTagNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_PROPERTY:
            return decorateShortcutPropertyNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_NOTE:
            return decorateShortcutNoteNavigationItem(ctx, item);
        case NavigationPaneItemType.SHORTCUT_SEARCH:
            return decorateShortcutSearchNavigationItem(ctx, item);
        default:
            return null;
    }
}
