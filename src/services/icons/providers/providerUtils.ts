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

const ICON_FONT_CLASSES = [
    'nn-iconfont',
    'nn-iconfont-fa-solid',
    'nn-iconfont-rpg-awesome',
    'nn-iconfont-bootstrap-icons',
    'nn-iconfont-material-icons',
    'nn-iconfont-phosphor',
    'nn-iconfont-simple-icons'
];

const ICON_RENDER_TOKENS = new WeakMap<HTMLElement, symbol>();

/**
 * Stores the current render token for an icon container.
 */
export function setIconRenderToken(container: HTMLElement, token: symbol): void {
    ICON_RENDER_TOKENS.set(container, token);
}

/**
 * Returns the current render token for an icon container.
 */
export function getIconRenderToken(container: HTMLElement): symbol | undefined {
    return ICON_RENDER_TOKENS.get(container);
}

/**
 * Resets a container element by removing icon-related classes and content.
 */
export function resetIconContainer(container: HTMLElement): void {
    container.empty();
    container.removeClass('nn-emoji-icon');
    ICON_FONT_CLASSES.forEach(className => {
        container.removeClass(className);
    });
}
