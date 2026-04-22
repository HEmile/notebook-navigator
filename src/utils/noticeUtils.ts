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

import { Notice } from 'obsidian';

/**
 * Visual variants for notices.
 * - success: Green text for successful operations
 * - warning: Red text for warnings
 * - loading: Shows loading spinner animation
 */
export type NoticeVariant = 'success' | 'warning' | 'loading';

/**
 * Configuration options for displaying notices.
 */
export interface ShowNoticeOptions {
    /** Duration in milliseconds before notice auto-dismisses. Omit for default duration. */
    timeout?: number;
    /** Visual style variant to apply to the notice */
    variant?: NoticeVariant;
}

/**
 * Displays an Obsidian notice with optional styling variants.
 *
 * Applies CSS classes to the notice container based on the variant:
 * - 'success': Adds 'mod-success' class for green text
 * - 'warning': Adds 'mod-warning' class for red text
 * - 'loading': Adds 'is-loading' class for spinner animation
 *
 * @param message - Content to display in the notice
 * @param options - Optional configuration for timeout and visual variant
 * @returns The Notice instance, allowing caller to dismiss or update it
 */
export function showNotice(message: string | DocumentFragment, options?: ShowNoticeOptions): Notice {
    const notice = new Notice(message, options?.timeout);
    const container = notice.containerEl;
    if (container) {
        if (!container.isConnected) {
            const parent = container.parentElement;
            if (parent && parent.classList.contains('notice-container') && !parent.isConnected) {
                const body = container.ownerDocument?.body ?? null;
                if (body) {
                    body.appendChild(parent);
                }
            }
        }
        if (options?.variant === 'success') {
            container.addClass('mod-success');
        } else if (options?.variant === 'warning') {
            container.addClass('mod-warning');
        } else if (options?.variant === 'loading') {
            container.addClass('is-loading');
        }
    }
    return notice;
}
