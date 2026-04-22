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

import { TFolder, App, Plugin } from 'obsidian';

/**
 * Interface for internal plugin structure
 */
interface InternalPlugin {
    enabled: boolean;
    instance?: unknown;
}

/**
 * Interface for app with internal APIs
 */
interface AppWithInternals extends App {
    internalPlugins?: {
        getPluginById?(id: string): InternalPlugin | undefined;
    };
}

/**
 * Type guard to check if app has internal plugins API
 */
function hasInternalPlugins(app: App): app is AppWithInternals {
    return app && typeof app === 'object' && 'internalPlugins' in app;
}

/**
 * Safe access to internal Obsidian APIs with type inference
 * Note: internalPlugins is not in Obsidian's public TypeScript API but is widely used
 * This provides safe access to internal plugins (e.g., search, sync) that many community plugins use
 */
export function getInternalPlugin<T = InternalPlugin>(app: App, pluginId: string): T | undefined {
    if (!hasInternalPlugins(app)) return undefined;

    const plugin = app.internalPlugins?.getPluginById?.(pluginId);

    return plugin as T | undefined;
}

/**
 * Interface for app with command APIs
 */
interface AppWithCommands extends App {
    commands?: {
        executeCommandById?(id: string): boolean;
    };
}

/**
 * Type guard to check if app has commands API
 */
function hasCommands(app: App): app is AppWithCommands {
    return app && typeof app === 'object' && 'commands' in app;
}

/**
 * Safe command execution
 * Note: executeCommandById is not in Obsidian's public TypeScript API but is widely used
 * This is accessing internal Obsidian APIs that many plugins rely on
 */
export function executeCommand(app: App, commandId: string): boolean {
    if (!hasCommands(app)) return false;

    try {
        return app.commands?.executeCommandById?.(commandId) ?? false;
    } catch {
        return false;
    }
}

/**
 * Extended App interface with access to plugin registry
 */
interface AppWithPlugins extends App {
    plugins?: {
        plugins?: Record<string, Plugin>;
        enabledPlugins?: Set<string>;
    };
}

/**
 * Type guard to check if the app has a plugin registry
 */
function hasPluginRegistry(app: App): app is AppWithPlugins {
    return typeof app === 'object' && app !== null && 'plugins' in app;
}

/**
 * Safe access to a plugin instance by id
 */
export function getPluginById(app: App, pluginId: string): Plugin | null {
    if (!pluginId || !hasPluginRegistry(app)) {
        return null;
    }

    const registry = app.plugins;
    if (!registry?.plugins) {
        return null;
    }

    return registry.plugins[pluginId] ?? null;
}

/**
 * Checks if a plugin is installed or enabled
 */
export function isPluginInstalled(app: App, pluginId: string): boolean {
    if (!pluginId || !hasPluginRegistry(app)) {
        return false;
    }

    const registry = app.plugins;
    if (!registry) {
        return false;
    }

    return Boolean(registry.plugins?.[pluginId]) || Boolean(registry.enabledPlugins?.has(pluginId));
}

/**
 * Check if a folder is an ancestor of another folder
 * @param potentialAncestor - The folder that might be an ancestor
 * @param folder - The folder to check
 * @returns true if potentialAncestor is an ancestor of folder
 */
export function isFolderAncestor(potentialAncestor: TFolder, folder: TFolder): boolean {
    let current = folder.parent;
    while (current) {
        if (current.path === potentialAncestor.path) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

/**
 * Checks if the provided value is a plain object record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely reads a property from a record-like value
 */
export function getRecordValue<T = unknown>(value: unknown, key: string): T | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    return value[key] as T | undefined;
}
