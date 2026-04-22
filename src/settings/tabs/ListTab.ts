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

import { DropdownComponent, Platform, Setting, SliderComponent, setIcon } from 'obsidian';
import { strings } from '../../i18n';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import type { ListDisplayMode, ListNoteGroupingOption, ListPaneTitleOption, PropertySortSecondaryOption, SortOption } from '../types';
import { PROPERTY_SORT_SECONDARY_OPTIONS, SORT_OPTIONS } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { runAsyncAction } from '../../utils/async';
import { createSettingGroupFactory } from '../settingGroups';
import { addSettingSyncModeToggle } from '../syncModeToggle';
import { createSubSettingsContainer, wireToggleSettingWithSubSettings } from '../subSettings';

type QuickActionSettingKey =
    | 'quickActionRevealInFolder'
    | 'quickActionAddTag'
    | 'quickActionAddToShortcuts'
    | 'quickActionPinNote'
    | 'quickActionOpenInNewTab';

interface QuickActionToggleConfig {
    key: QuickActionSettingKey;
    icon: string;
    label: string;
}

/** Renders the list pane settings tab */
export function renderListPaneTab(context: SettingsTabContext): void {
    const { containerEl, plugin, addToggleSetting } = context;
    const createGroup = createSettingGroupFactory(containerEl);

    const topGroup = createGroup(undefined);

    if (!Platform.isMobile) {
        topGroup.addSetting(setting => {
            setting
                .setName(strings.settings.items.listPaneTitle.name)
                .setDesc(strings.settings.items.listPaneTitle.desc)
                .addDropdown(dropdown =>
                    dropdown
                        .addOption('header', strings.settings.items.listPaneTitle.options.header)
                        .addOption('list', strings.settings.items.listPaneTitle.options.list)
                        .addOption('hidden', strings.settings.items.listPaneTitle.options.hidden)
                        .setValue(plugin.settings.listPaneTitle)
                        .onChange(async (value: ListPaneTitleOption) => {
                            plugin.settings.listPaneTitle = value;
                            await plugin.saveSettingsAndUpdate();
                        })
                );
        });
    }

    topGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.sortNotesBy.name)
            .setDesc(strings.settings.items.sortNotesBy.desc)
            .addDropdown((dropdown: DropdownComponent) => {
                SORT_OPTIONS.forEach(option => {
                    dropdown.addOption(option, strings.settings.items.sortNotesBy.options[option]);
                });
                return dropdown.setValue(plugin.settings.defaultFolderSort).onChange(async (value: SortOption) => {
                    plugin.settings.defaultFolderSort = value;
                    await plugin.saveSettingsAndUpdate();
                });
            });
    });

    const propertySortKeySetting = topGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.propertySortKey.name)
            .setDesc(strings.settings.items.propertySortKey.desc)
            .addText(text =>
                text
                    .setPlaceholder(strings.settings.items.propertySortKey.placeholder)
                    .setValue(plugin.settings.propertySortKey)
                    .onChange(async value => {
                        plugin.settings.propertySortKey = value;
                        await plugin.saveSettingsAndUpdate();
                    })
            );
    });

    const propertySortSecondarySettingsEl = createSubSettingsContainer(propertySortKeySetting);

    new Setting(propertySortSecondarySettingsEl)
        .setName(strings.settings.items.propertySortSecondary.name)
        .setDesc(strings.settings.items.propertySortSecondary.desc)
        .addDropdown(dropdown => {
            PROPERTY_SORT_SECONDARY_OPTIONS.forEach(option => {
                dropdown.addOption(option, strings.settings.items.propertySortSecondary.options[option]);
            });
            return dropdown.setValue(plugin.settings.propertySortSecondary).onChange(async (value: PropertySortSecondaryOption) => {
                plugin.settings.propertySortSecondary = value;
                await plugin.saveSettingsAndUpdate();
            });
        });

    addToggleSetting(
        topGroup.addSetting,
        strings.settings.items.revealFileOnListChanges.name,
        strings.settings.items.revealFileOnListChanges.desc,
        () => plugin.settings.revealFileOnListChanges,
        value => {
            plugin.settings.revealFileOnListChanges = value;
        }
    );

    if (!Platform.isMobile) {
        const quickActionsSetting = topGroup.addSetting(setting => {
            setting.setName(strings.settings.items.showQuickActions.name).setDesc(strings.settings.items.showQuickActions.desc);
        });

        quickActionsSetting.controlEl.addClass('nn-quick-actions-control');

        const quickActionsButtonsEl = quickActionsSetting.controlEl.createDiv({
            cls: ['nn-toolbar-visibility-grid', 'nn-quick-actions-buttons']
        });

        const updateButtonsDisabledState = (enabled: boolean) => {
            quickActionsButtonsEl.classList.toggle('is-disabled', !enabled);
            quickActionsButtonsEl.querySelectorAll('button').forEach(button => {
                button.toggleAttribute('disabled', !enabled);
            });
        };

        const quickActionButtons: QuickActionToggleConfig[] = [
            {
                key: 'quickActionRevealInFolder',
                icon: 'lucide-folder-search',
                label: strings.contextMenu.file.revealInFolder
            },
            {
                key: 'quickActionAddTag',
                icon: 'lucide-tag',
                label: strings.contextMenu.file.addTag
            },
            {
                key: 'quickActionAddToShortcuts',
                icon: 'lucide-star',
                label: strings.shortcuts.add
            },
            {
                key: 'quickActionPinNote',
                icon: 'lucide-pin',
                label: strings.contextMenu.file.pinNote
            },
            {
                key: 'quickActionOpenInNewTab',
                icon: 'lucide-file-plus',
                label: strings.contextMenu.file.openInNewTab
            }
        ];

        quickActionButtons.forEach(buttonConfig => {
            const buttonEl = quickActionsButtonsEl.createEl('button', {
                cls: ['nn-toolbar-visibility-toggle', 'nn-mobile-toolbar-button'],
                attr: { type: 'button' }
            });
            buttonEl.setAttr('aria-label', buttonConfig.label);
            buttonEl.setAttr('title', buttonConfig.label);

            const iconEl = buttonEl.createSpan({ cls: 'nn-toolbar-visibility-icon' });
            setIcon(iconEl, buttonConfig.icon);

            const applyState = () => {
                const isEnabled = Boolean(plugin.settings[buttonConfig.key]);
                buttonEl.classList.toggle('is-active', isEnabled);
                buttonEl.classList.toggle('nn-mobile-toolbar-button-active', isEnabled);
                buttonEl.setAttr('aria-pressed', isEnabled ? 'true' : 'false');
            };

            buttonEl.addEventListener('click', () => {
                plugin.settings[buttonConfig.key] = !plugin.settings[buttonConfig.key];
                applyState();
                runAsyncAction(async () => {
                    await plugin.saveSettingsAndUpdate();
                });
            });

            applyState();
        });

        quickActionsSetting.addToggle(toggle => {
            toggle.setValue(plugin.settings.showQuickActions).onChange(async value => {
                plugin.settings.showQuickActions = value;
                updateButtonsDisabledState(value);
                await plugin.saveSettingsAndUpdate();
            });
            toggle.toggleEl.addClass('nn-quick-actions-master-toggle');
        });

        updateButtonsDisabledState(plugin.settings.showQuickActions);
    }

    const pinnedNotesGroup = createGroup(strings.settings.groups.list.pinnedNotes);

    addToggleSetting(
        pinnedNotesGroup.addSetting,
        strings.settings.items.limitPinnedToCurrentFolder.name,
        strings.settings.items.limitPinnedToCurrentFolder.desc,
        () => plugin.settings.filterPinnedByFolder,
        value => {
            plugin.settings.filterPinnedByFolder = value;
        }
    );

    const showPinnedGroupHeaderSetting = pinnedNotesGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showPinnedGroupHeader.name).setDesc(strings.settings.items.showPinnedGroupHeader.desc);
    });

    const pinnedGroupSettingsEl = wireToggleSettingWithSubSettings(
        showPinnedGroupHeaderSetting,
        () => plugin.settings.showPinnedGroupHeader,
        async value => {
            plugin.settings.showPinnedGroupHeader = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    new Setting(pinnedGroupSettingsEl)
        .setName(strings.settings.items.showPinnedIcon.name)
        .setDesc(strings.settings.items.showPinnedIcon.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showPinnedIcon).onChange(async value => {
                plugin.settings.showPinnedIcon = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    const displayGroup = createGroup(strings.settings.groups.list.display);

    displayGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.defaultListMode.name)
            .setDesc(strings.settings.items.defaultListMode.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('standard', strings.settings.items.defaultListMode.options.standard)
                    .addOption('compact', strings.settings.items.defaultListMode.options.compact)
                    .setValue(plugin.settings.defaultListMode)
                    .onChange(async (value: ListDisplayMode) => {
                        plugin.settings.defaultListMode = value === 'compact' ? 'compact' : 'standard';
                        await plugin.saveSettingsAndUpdate();
                    })
            );
    });

    const includeDescendantNotesSetting = displayGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.includeDescendantNotes.name)
            .setDesc(strings.settings.items.includeDescendantNotes.desc)
            .addToggle(toggle => {
                const preferences = plugin.getUXPreferences();
                toggle.setValue(preferences.includeDescendantNotes).onChange(value => {
                    plugin.setIncludeDescendantNotes(value);
                });
            });
    });

    addSettingSyncModeToggle({ setting: includeDescendantNotesSetting, plugin, settingId: 'includeDescendantNotes' });

    displayGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.groupNotes.name)
            .setDesc(strings.settings.items.groupNotes.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('none', strings.settings.items.groupNotes.options.none)
                    .addOption('date', strings.settings.items.groupNotes.options.date)
                    .addOption('folder', strings.settings.items.groupNotes.options.folder)
                    .setValue(plugin.settings.noteGrouping)
                    .onChange(async (value: ListNoteGroupingOption) => {
                        plugin.settings.noteGrouping = value;
                        await plugin.saveSettingsAndUpdate();
                    })
            );
    });

    addToggleSetting(
        displayGroup.addSetting,
        strings.settings.items.showSelectedNavigationPills.name,
        strings.settings.items.showSelectedNavigationPills.desc,
        () => plugin.settings.showSelectedNavigationPills,
        value => {
            plugin.settings.showSelectedNavigationPills = value;
        }
    );

    addToggleSetting(
        displayGroup.addSetting,
        strings.settings.items.optimizeNoteHeight.name,
        strings.settings.items.optimizeNoteHeight.desc,
        () => plugin.settings.optimizeNoteHeight,
        value => {
            plugin.settings.optimizeNoteHeight = value;
        }
    );

    // Slider to configure compact list item height with reset button
    let compactItemHeightSlider: SliderComponent;
    const compactItemHeightSetting = displayGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.compactItemHeight.name)
            .setDesc(strings.settings.items.compactItemHeight.desc)
            .addSlider(slider => {
                compactItemHeightSlider = slider
                    .setLimits(20, 28, 1)
                    .setValue(plugin.settings.compactItemHeight)
                    .setInstant(false)
                    .setDynamicTooltip()
                    .onChange(value => {
                        plugin.setCompactItemHeight(value);
                    });
                return slider;
            })
            .addExtraButton(button =>
                button
                    .setIcon('lucide-rotate-ccw')
                    .setTooltip(strings.settings.items.compactItemHeight.resetTooltip)
                    .onClick(() => {
                        // Reset item height to default without blocking the UI
                        runAsyncAction(() => {
                            const defaultValue = DEFAULT_SETTINGS.compactItemHeight;
                            compactItemHeightSlider.setValue(defaultValue);
                            plugin.setCompactItemHeight(defaultValue);
                        });
                    })
            );
    });

    addSettingSyncModeToggle({ setting: compactItemHeightSetting, plugin, settingId: 'compactItemHeight' });

    // Sub-setting container for compact item height options
    const compactItemHeightSettingsEl = createSubSettingsContainer(compactItemHeightSetting);

    // Toggle to scale text proportionally with compact item height
    const compactItemHeightScaleTextSetting = new Setting(compactItemHeightSettingsEl)
        .setName(strings.settings.items.compactItemHeightScaleText.name)
        .setDesc(strings.settings.items.compactItemHeightScaleText.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.compactItemHeightScaleText).onChange(value => {
                plugin.setCompactItemHeightScaleText(value);
            })
        );

    addSettingSyncModeToggle({ setting: compactItemHeightScaleTextSetting, plugin, settingId: 'compactItemHeightScaleText' });
}
