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

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App, Plugin, type SettingDefinitionItem } from 'obsidian';
import type NotebookNavigatorPlugin from '../../src/main';
import { LazyNotebookNavigatorSettingTab } from '../../src/settings/LazyNotebookNavigatorSettingTab';
import type { NotebookNavigatorSettingTab } from '../../src/settings';

interface MockSettingTabDelegate {
    containerEl: HTMLElement;
    getSettingDefinitions: () => SettingDefinitionItem[];
    getControlValue: (key: string) => unknown;
    setControlValue: (key: string, value: unknown) => Promise<void>;
    display: () => void;
    hide: () => void;
}

function createPlugin(): NotebookNavigatorPlugin {
    const app = new App();
    return new Plugin(app, { id: 'notebook-navigator' }) as NotebookNavigatorPlugin;
}

function createContainer(isConnected: boolean): HTMLElement {
    return { isConnected } as HTMLElement;
}

function createDelegate(): MockSettingTabDelegate {
    return {
        containerEl: createContainer(false),
        getSettingDefinitions: vi.fn(() => [{ type: 'render', name: 'Mock setting' } as SettingDefinitionItem]),
        getControlValue: vi.fn((key: string) => `value:${key}`),
        setControlValue: vi.fn(async () => {}),
        display: vi.fn(),
        hide: vi.fn()
    };
}

class TestLazyNotebookNavigatorSettingTab extends LazyNotebookNavigatorSettingTab {
    constructor(
        app: App,
        plugin: NotebookNavigatorPlugin,
        private readonly delegateFactory: () => MockSettingTabDelegate
    ) {
        super(app, plugin);
    }

    protected createDelegate(): NotebookNavigatorSettingTab {
        return this.delegateFactory() as unknown as NotebookNavigatorSettingTab;
    }
}

describe('LazyNotebookNavigatorSettingTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads settings definitions while the settings container is disconnected', () => {
        const plugin = createPlugin();
        const delegate = createDelegate();
        const tab = new TestLazyNotebookNavigatorSettingTab(plugin.app, plugin, () => delegate);
        const containerEl = createContainer(false);
        tab.containerEl = containerEl;

        const definitions = tab.getSettingDefinitions();

        expect(definitions).toEqual([{ type: 'render', name: 'Mock setting' }]);
        expect(delegate.containerEl).toBe(containerEl);
    });

    it('shares the registered tab container with the delegate before returning definitions', () => {
        const plugin = createPlugin();
        const tab = new LazyNotebookNavigatorSettingTab(plugin.app, plugin);
        const delegate = createDelegate();
        const containerEl = createContainer(true);
        tab.containerEl = containerEl;
        Reflect.set(tab, 'delegate', delegate);

        const definitions = tab.getSettingDefinitions();

        expect(definitions).toEqual([{ type: 'render', name: 'Mock setting' }]);
        expect(delegate.containerEl).toBe(containerEl);
    });

    it('renders the fallback settings UI through the registered tab container', () => {
        const plugin = createPlugin();
        const tab = new LazyNotebookNavigatorSettingTab(plugin.app, plugin);
        const delegate = createDelegate();
        const containerEl = createContainer(true);
        tab.containerEl = containerEl;
        Reflect.set(tab, 'delegate', delegate);

        const display = Reflect.get(tab, 'display');
        if (typeof display !== 'function') {
            throw new Error('Lazy settings tab display fallback is missing.');
        }
        Reflect.apply(display, tab, []);

        expect(delegate.containerEl).toBe(containerEl);
        expect(delegate.display).toHaveBeenCalledOnce();
    });
});
