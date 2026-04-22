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

import type { App, Setting } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';

export type SettingsTabId =
    | 'general'
    | 'navigation-pane'
    | 'shortcuts'
    | 'calendar'
    | 'folders'
    | 'tags'
    | 'properties'
    | 'list-pane'
    | 'frontmatter'
    | 'notes'
    | 'files'
    | 'icon-packs'
    | 'advanced';

export type AddSettingFunction = (createSetting: (setting: Setting) => void) => Setting;
export type SettingDescription = string | DocumentFragment;

/**
 * Factory function type for creating debounced text settings
 * Prevents excessive updates while user is typing
 */
export type DebouncedTextSettingFactory = (
    container: HTMLElement,
    name: string,
    desc: SettingDescription,
    placeholder: string,
    getValue: () => string,
    setValue: (value: string) => void,
    validator?: (value: string) => boolean,
    onAfterUpdate?: () => void
) => Setting;

/** Configures an existing Setting with a debounced text input */
export type DebouncedTextSettingConfigurer = (
    setting: Setting,
    name: string,
    desc: SettingDescription,
    placeholder: string,
    getValue: () => string,
    setValue: (value: string) => void,
    validator?: (value: string) => boolean,
    onAfterUpdate?: () => void
) => Setting;

/** Optional configuration for debounced text area settings */
export interface DebouncedTextAreaSettingOptions {
    rows?: number;
    validator?: (value: string) => boolean;
    onAfterUpdate?: () => void;
}

/** Factory function type for creating debounced text area settings */
export type DebouncedTextAreaSettingFactory = (
    container: HTMLElement,
    name: string,
    desc: SettingDescription,
    placeholder: string,
    getValue: () => string,
    setValue: (value: string) => void,
    options?: DebouncedTextAreaSettingOptions
) => Setting;

/** Configures an existing Setting with a debounced text area input */
export type DebouncedTextAreaSettingConfigurer = (
    setting: Setting,
    name: string,
    desc: SettingDescription,
    placeholder: string,
    getValue: () => string,
    setValue: (value: string) => void,
    options?: DebouncedTextAreaSettingOptions
) => Setting;

/** Adds a toggle Setting that persists via plugin save/update */
export type ToggleSettingFactory = (
    addSetting: AddSettingFunction,
    name: string,
    desc: string,
    getValue: () => boolean,
    setValue: (value: boolean) => void,
    onAfterUpdate?: () => void
) => Setting;

/** Adds an info-only Setting that renders into the description element */
export type InfoSettingFactory = (
    addSetting: AddSettingFunction,
    cls: string | readonly string[],
    render: (descEl: HTMLElement) => void
) => Setting;

/**
 * Context object passed to settings tab render functions
 * Provides access to app, plugin, and utility methods for tab rendering
 */
export interface SettingsTabContext {
    app: App;
    plugin: NotebookNavigatorPlugin;
    containerEl: HTMLElement;
    addToggleSetting: ToggleSettingFactory;
    addInfoSetting: InfoSettingFactory;
    createDebouncedTextSetting: DebouncedTextSettingFactory;
    configureDebouncedTextSetting: DebouncedTextSettingConfigurer;
    createDebouncedTextAreaSetting: DebouncedTextAreaSettingFactory;
    configureDebouncedTextAreaSetting: DebouncedTextAreaSettingConfigurer;
    /** Registers a listener for plugin settings updates while the settings tab is open */
    registerSettingsUpdateListener(id: string, listener: () => void): void;
    /** Unregisters a previously registered settings update listener */
    unregisterSettingsUpdateListener(id: string): void;
    /** Registers the element where metadata info should be displayed */
    registerMetadataInfoElement(element: HTMLElement): void;
    /** Registers the element where statistics should be displayed */
    registerStatsTextElement(element: HTMLElement): void;
    /** Requests an immediate statistics refresh */
    requestStatisticsRefresh(): void;
    /** Ensures the statistics update interval is running */
    ensureStatisticsInterval(): void;
    /** Activates another settings tab */
    openSettingsTab(tabId: SettingsTabId): void;
    /** Registers a listener for show tags visibility changes */
    registerShowTagsListener(listener: (visible: boolean) => void): void;
    /** Notifies all listeners of show tags visibility change */
    notifyShowTagsVisibility(visible: boolean): void;
}
