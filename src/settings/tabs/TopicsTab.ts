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
import { Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { strings } from '../../i18n';
import { isTagSortOrder, type NotebookNavigatorSettings } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { createGroupDefinition, createRenderDefinition } from '../nativeSettingControls';

type TopicToggleKey = 'showTopics' | 'showTopicIcons' | 'inheritTopicColors';

/** Builds native setting definitions for the topics settings page */
export function createTopicsSettingDefinitions(context: SettingsTabContext): SettingDefinitionItem[] {
    const { plugin } = context;
    const items = strings.settings.items;
    const whenTopicsShown = () => plugin.settings.showTopics;

    return [
        createGroupDefinition(undefined, [
            createRenderDefinition({
                name: items.showTopics.name,
                desc: items.showTopics.desc,
                render: setting => renderToggle(setting, context, 'showTopics', items.showTopics)
            }),
            createRenderDefinition({
                name: items.topicTags.name,
                desc: items.topicTags.desc,
                visible: whenTopicsShown,
                render: setting => renderTopicTagsSetting(setting, context)
            }),
            createRenderDefinition({
                name: items.topicSortOrder.name,
                desc: items.topicSortOrder.desc,
                aliases: Object.values(items.topicSortOrder.options),
                visible: whenTopicsShown,
                render: setting => renderTopicSortOrderSetting(setting, context)
            }),
            createRenderDefinition({
                name: items.showTopicIcons.name,
                desc: items.showTopicIcons.desc,
                visible: whenTopicsShown,
                render: setting => renderToggle(setting, context, 'showTopicIcons', items.showTopicIcons)
            }),
            createRenderDefinition({
                name: items.inheritTopicColors.name,
                desc: items.inheritTopicColors.desc,
                visible: whenTopicsShown,
                render: setting => renderToggle(setting, context, 'inheritTopicColors', items.inheritTopicColors)
            }),
            createRenderDefinition({
                name: items.hiddenTopics.name,
                desc: items.hiddenTopics.desc,
                visible: whenTopicsShown,
                render: setting => renderHiddenTopicsSetting(setting, context)
            })
        ])
    ];
}

function renderToggle(setting: Setting, context: SettingsTabContext, key: TopicToggleKey, text: { name: string; desc: string }): void {
    const { plugin } = context;
    setting.setName(text.name).setDesc(text.desc);
    setting.addToggle(toggle =>
        toggle.setValue(plugin.settings[key]).onChange(async value => {
            plugin.settings[key] = value;
            await plugin.saveSettingsAndUpdate();
        })
    );
}

/** Parses the comma-separated topic tags field: trims, drops a leading '#', empty entries and duplicates */
export function parseTopicTagsInput(value: string): string[] {
    const tags = value
        .split(',')
        .map(tag => tag.trim().replace(/^#/, '').trim())
        .filter(tag => tag.length > 0);
    return Array.from(new Set(tags));
}

function renderTopicTagsSetting(setting: Setting, context: SettingsTabContext): void {
    const { plugin } = context;
    const text = strings.settings.items.topicTags;
    setting.setName(text.name).setDesc(text.desc);
    setting.addText(input => {
        input.setPlaceholder(text.placeholder).setValue(plugin.settings.topicTags.join(', '));
        // Saves when the field is committed rather than per keystroke, since each change rebuilds the topic graph
        input.inputEl.addEventListener('change', () => {
            const topicTags = parseTopicTagsInput(input.getValue());
            if (topicTags.length === 0 || sameList(topicTags, plugin.settings.topicTags)) {
                input.setValue(plugin.settings.topicTags.join(', '));
                return;
            }
            plugin.settings.topicTags = topicTags;
            input.setValue(topicTags.join(', '));
            void plugin.saveSettingsAndUpdate();
        });
    });
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function renderTopicSortOrderSetting(setting: Setting, context: SettingsTabContext): void {
    const { plugin } = context;
    const options = strings.settings.items.topicSortOrder.options;

    setting.setName(strings.settings.items.topicSortOrder.name).setDesc(strings.settings.items.topicSortOrder.desc);
    setting.addDropdown(dropdown => {
        dropdown
            .addOption('alpha-asc', options.alphaAsc)
            .addOption('alpha-desc', options.alphaDesc)
            .addOption('frequency-asc', `${options.frequency} (${options.lowToHigh})`)
            .addOption('frequency-desc', `${options.frequency} (${options.highToLow})`)
            .setValue(plugin.getTopicSortOrder())
            .onChange(value => {
                if (!isTagSortOrder(value)) {
                    return;
                }
                plugin.setTopicSortOrder(value);
            });
    });
}

function renderHiddenTopicsSetting(setting: Setting, context: SettingsTabContext): void {
    const { plugin } = context;
    const text = strings.settings.items.hiddenTopics;
    setting.setName(text.name).setDesc(text.desc);
    const listEl = setting.descEl.createDiv({ cls: 'nn-hidden-topics-list' });

    const renderList = () => {
        listEl.empty();
        const hiddenTopics = [...plugin.settings.hiddenTopics].sort((a, b) => a.localeCompare(b));
        if (hiddenTopics.length === 0) {
            listEl.createDiv({ text: text.empty });
            return;
        }
        for (const topicName of hiddenTopics) {
            const rowEl = listEl.createDiv({ cls: 'nn-hidden-topics-row' });
            rowEl.createSpan({ text: topicName });
            const button = rowEl.createEl('button', { text: text.unhide, cls: 'mod-muted' });
            button.addEventListener('click', () => {
                unhideTopic(plugin.settings, topicName);
                renderList();
                void plugin.saveSettingsAndUpdate();
            });
        }
    };
    renderList();
}

export function unhideTopic(settings: NotebookNavigatorSettings, topicName: string): void {
    settings.hiddenTopics = settings.hiddenTopics.filter(name => name !== topicName);
}
