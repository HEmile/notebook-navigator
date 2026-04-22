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

/**
 * Icon Service Module
 *
 * This module provides a unified icon system for Notebook Navigator,
 * supporting multiple icon providers through a plugin architecture.
 *
 * The module exports:
 * - IconService: Central service for managing icons
 * - Icon providers: LucideIconProvider, EmojiIconProvider
 * - Types: Interfaces and type definitions
 * - Helper functions: initializeIconService, getIconService
 *
 * Usage:
 * ```typescript
 * const iconService = getIconService();
 * iconService.renderIcon(element, 'folder'); // Renders Lucide folder icon
 * iconService.renderIcon(element, 'emoji:📁'); // Renders emoji icon
 * ```
 */

export * from './types';

import { useSyncExternalStore } from 'react';
import { IconService } from './IconService';
import { LucideIconProvider } from './providers/LucideIconProvider';
import { EmojiIconProvider } from './providers/EmojiIconProvider';

let iconService: IconService | null = null;

/**
 * Initializes the icon service with default providers.
 * Creates the service instance and registers Lucide and Emoji providers.
 *
 * @returns The initialized IconService instance
 */
function initializeIconService(): IconService {
    if (!iconService) {
        iconService = IconService.getInstance();

        // Register default providers
        iconService.registerProvider(new LucideIconProvider());
        iconService.registerProvider(new EmojiIconProvider());
    }

    return iconService;
}

/**
 * Gets the icon service instance, initializing if necessary.
 * This is the primary way to access the icon service throughout the plugin.
 *
 * @returns The IconService instance
 */
export function getIconService(): IconService {
    if (!iconService) {
        return initializeIconService();
    }
    return iconService;
}

export function useIconServiceVersion(): number {
    const service = getIconService();
    return useSyncExternalStore(
        listener => service.subscribe(listener),
        () => service.getVersion(),
        () => service.getVersion()
    );
}
