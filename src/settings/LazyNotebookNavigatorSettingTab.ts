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

import { App, PluginSettingTab, requireApiVersion, type SettingDefinitionItem } from 'obsidian';
import type NotebookNavigatorPlugin from '../main';
import type { NotebookNavigatorSettingTab } from '../settings';
import { NOTEBOOK_NAVIGATOR_ICON_ID } from '../constants/notebookNavigatorIcon';

/**
 * Lightweight settings tab shell. Startup search indexing stays lightweight;
 * the full settings UI loads when Obsidian renders the tab or changes controls.
 */
export class LazyNotebookNavigatorSettingTab extends PluginSettingTab {
    private readonly plugin: NotebookNavigatorPlugin;
    private delegate: NotebookNavigatorSettingTab | null = null;

    constructor(app: App, plugin: NotebookNavigatorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.icon = NOTEBOOK_NAVIGATOR_ICON_ID;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        if (!requireApiVersion('1.13.0')) {
            return [];
        }

        return this.getDelegate().getSettingDefinitions();
    }

    getControlValue(key: string): unknown {
        return this.getDelegate().getControlValue(key);
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        await this.getDelegate().setControlValue(key, value);
    }

    display(): void {
        const delegate = this.getDelegate();
        // Obsidian versions before native settings pages call display().
        const display = Reflect.get(delegate, 'display');
        if (typeof display === 'function') {
            Reflect.apply(display, delegate, []);
        }
    }

    hide(): void {
        if (this.delegate) {
            this.syncDelegateContainer();
            this.delegate.hide();
            return;
        }

        super.hide();
    }

    private getDelegate(): NotebookNavigatorSettingTab {
        if (!this.delegate) {
            this.delegate = this.createDelegate();
        }

        this.syncDelegateContainer();
        return this.delegate;
    }

    protected createDelegate(): NotebookNavigatorSettingTab {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Settings UI is intentionally loaded on first settings access.
        const { NotebookNavigatorSettingTab } = require('../settings') as typeof import('../settings');
        const delegate = new NotebookNavigatorSettingTab(this.app, this.plugin);
        delegate.setNativeSettingsHost(this);
        return delegate;
    }

    private syncDelegateContainer(): void {
        if (!this.delegate) {
            return;
        }

        this.delegate.containerEl = this.containerEl;
    }
}
