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

import { closestCenter, type CollisionDetection, type Modifier } from '@dnd-kit/core';

export const verticalAxisOnly: Modifier = ({ transform }) => {
    return {
        ...transform,
        x: 0
    };
};

/**
 * Collision detection that filters droppable containers by type.
 * Containers must have `data: { type: string }` set via useSortable.
 * Only containers matching the active item's type are considered.
 */
export const typeFilteredCollisionDetection: CollisionDetection = args => {
    const activeType = args.active?.data?.current?.type as string | undefined;

    if (!activeType) {
        return closestCenter(args);
    }

    const filteredContainers = args.droppableContainers.filter(container => container.data.current?.type === activeType);

    return closestCenter({
        ...args,
        droppableContainers: filteredContainers
    });
};

export const SHORTCUT_POINTER_CONSTRAINT = { distance: 6 };
export const ROOT_REORDER_MOUSE_CONSTRAINT = { distance: 6 };
export const ROOT_REORDER_TOUCH_CONSTRAINT = { distance: 6 };
