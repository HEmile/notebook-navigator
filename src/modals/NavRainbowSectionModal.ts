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

import { App, Modal, Setting } from 'obsidian';
import NotebookNavigatorPlugin from '../main';
import { strings } from '../i18n';
import { runAsyncAction } from '../utils/async';
import { ItemType } from '../types';
import {
    isNavRainbowScope,
    isNavRainbowTransitionStyle,
    type NavRainbowScope,
    type NavRainbowSettings,
    type NavRainbowTransitionStyle
} from '../settings/types';
import { DEFAULT_SETTINGS } from '../settings/defaultSettings';

type NavRainbowSectionId = 'shortcuts' | 'folders' | 'tags' | 'properties';

interface ColorSettingAccess {
    getValue: () => string;
    setValue: (value: string) => void;
    defaultValue: string;
}

interface TransitionStyleSettingAccess {
    getValue: () => NavRainbowTransitionStyle;
    setValue: (value: NavRainbowTransitionStyle) => void;
    defaultValue: NavRainbowTransitionStyle;
}

interface LevelScopeSettingAccess {
    getValue: () => NavRainbowScope;
    setValue: (value: NavRainbowScope) => void;
    isValid: (value: unknown) => value is NavRainbowScope;
    name: string;
    desc: string;
    rootOption: string;
    childOption: string;
    allOption: string;
}

interface NavRainbowSectionSettingsAccess {
    sectionLabel: string;
    firstColor: ColorSettingAccess;
    lastColor: ColorSettingAccess;
    transitionStyle: TransitionStyleSettingAccess;
    levelScope?: LevelScopeSettingAccess;
}

export class NavRainbowSectionModal extends Modal {
    private readonly plugin: NotebookNavigatorPlugin;
    private readonly section: NavRainbowSectionId;

    constructor(app: App, plugin: NotebookNavigatorPlugin, section: NavRainbowSectionId) {
        super(app);
        this.plugin = plugin;
        this.section = section;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        const access = this.getSectionSettingsAccess();
        this.titleEl.setText(strings.modals.navRainbowSection.title(access.sectionLabel));

        this.createColorSetting({
            containerEl: contentEl,
            name: strings.settings.items.navRainbowFirstColor.name,
            desc: strings.settings.items.navRainbowFirstColor.desc,
            access: access.firstColor
        });

        this.createColorSetting({
            containerEl: contentEl,
            name: strings.settings.items.navRainbowLastColor.name,
            desc: strings.settings.items.navRainbowLastColor.desc,
            access: access.lastColor
        });

        new Setting(contentEl)
            .setName(strings.settings.items.navRainbowTransitionStyle.name)
            .setDesc(strings.settings.items.navRainbowTransitionStyle.desc)
            .addDropdown(dropdown =>
                dropdown
                    .addOption('hue', strings.settings.items.navRainbowTransitionStyle.options.hue)
                    .addOption('rgb', strings.settings.items.navRainbowTransitionStyle.options.rgb)
                    .setValue(access.transitionStyle.getValue())
                    .onChange(async value => {
                        if (!isNavRainbowTransitionStyle(value)) {
                            return;
                        }
                        access.transitionStyle.setValue(value);
                        await this.plugin.saveSettingsAndUpdate();
                    })
            );

        const levelScope = access.levelScope;
        if (levelScope) {
            new Setting(contentEl)
                .setName(levelScope.name)
                .setDesc(levelScope.desc)
                .addDropdown(dropdown =>
                    dropdown
                        .addOption('root', levelScope.rootOption)
                        .addOption('child', levelScope.childOption)
                        .addOption('all', levelScope.allOption)
                        .setValue(levelScope.getValue())
                        .onChange(async value => {
                            if (!levelScope.isValid(value)) {
                                return;
                            }

                            levelScope.setValue(value);
                            await this.plugin.saveSettingsAndUpdate();
                        })
                );
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private getSectionSettingsAccess(): NavRainbowSectionSettingsAccess {
        const getNavRainbow = (): NavRainbowSettings => this.plugin.settings.navRainbow;
        const updateNavRainbow = (updater: (settings: NavRainbowSettings) => NavRainbowSettings): void => {
            this.plugin.settings.navRainbow = updater(this.plugin.settings.navRainbow);
        };
        const defaultNavRainbow = DEFAULT_SETTINGS.navRainbow;

        if (this.section === 'shortcuts') {
            return {
                sectionLabel: strings.settings.items.navRainbowApplyToShortcuts.name,
                firstColor: {
                    getValue: () => getNavRainbow().shortcuts.firstColor,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, shortcuts: { ...settings.shortcuts, firstColor: value } }));
                    },
                    defaultValue: defaultNavRainbow.shortcuts.firstColor
                },
                lastColor: {
                    getValue: () => getNavRainbow().shortcuts.lastColor,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, shortcuts: { ...settings.shortcuts, lastColor: value } }));
                    },
                    defaultValue: defaultNavRainbow.shortcuts.lastColor
                },
                transitionStyle: {
                    getValue: () => getNavRainbow().shortcuts.transitionStyle,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, shortcuts: { ...settings.shortcuts, transitionStyle: value } }));
                    },
                    defaultValue: defaultNavRainbow.shortcuts.transitionStyle
                }
            };
        }

        if (this.section === 'folders') {
            return {
                sectionLabel: strings.settings.items.navRainbowApplyToFolders.name,
                firstColor: {
                    getValue: () => getNavRainbow().folders.firstColor,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, folders: { ...settings.folders, firstColor: value } }));
                    },
                    defaultValue: defaultNavRainbow.folders.firstColor
                },
                lastColor: {
                    getValue: () => getNavRainbow().folders.lastColor,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, folders: { ...settings.folders, lastColor: value } }));
                    },
                    defaultValue: defaultNavRainbow.folders.lastColor
                },
                transitionStyle: {
                    getValue: () => getNavRainbow().folders.transitionStyle,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, folders: { ...settings.folders, transitionStyle: value } }));
                    },
                    defaultValue: defaultNavRainbow.folders.transitionStyle
                },
                levelScope: {
                    getValue: (): NavRainbowScope => getNavRainbow().folders.scope,
                    setValue: (value: NavRainbowScope) => {
                        updateNavRainbow(settings => ({ ...settings, folders: { ...settings.folders, scope: value } }));
                    },
                    isValid: isNavRainbowScope,
                    name: strings.settings.items.navRainbowFolderScope.name,
                    desc: strings.settings.items.navRainbowFolderScope.desc,
                    rootOption: strings.settings.items.navRainbowFolderScope.options.root,
                    childOption: strings.settings.items.navRainbowFolderScope.options.child,
                    allOption: strings.settings.items.navRainbowFolderScope.options.all
                }
            };
        }

        if (this.section === 'tags') {
            return {
                sectionLabel: strings.settings.items.navRainbowApplyToTags.name,
                firstColor: {
                    getValue: () => getNavRainbow().tags.firstColor,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, tags: { ...settings.tags, firstColor: value } }));
                    },
                    defaultValue: defaultNavRainbow.tags.firstColor
                },
                lastColor: {
                    getValue: () => getNavRainbow().tags.lastColor,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, tags: { ...settings.tags, lastColor: value } }));
                    },
                    defaultValue: defaultNavRainbow.tags.lastColor
                },
                transitionStyle: {
                    getValue: () => getNavRainbow().tags.transitionStyle,
                    setValue: value => {
                        updateNavRainbow(settings => ({ ...settings, tags: { ...settings.tags, transitionStyle: value } }));
                    },
                    defaultValue: defaultNavRainbow.tags.transitionStyle
                },
                levelScope: {
                    getValue: (): NavRainbowScope => getNavRainbow().tags.scope,
                    setValue: (value: NavRainbowScope) => {
                        updateNavRainbow(settings => ({ ...settings, tags: { ...settings.tags, scope: value } }));
                    },
                    isValid: isNavRainbowScope,
                    name: strings.settings.items.navRainbowTagScope.name,
                    desc: strings.settings.items.navRainbowTagScope.desc,
                    rootOption: strings.settings.items.navRainbowTagScope.options.root,
                    childOption: strings.settings.items.navRainbowTagScope.options.child,
                    allOption: strings.settings.items.navRainbowTagScope.options.all
                }
            };
        }

        return {
            sectionLabel: strings.settings.items.navRainbowApplyToProperties.name,
            firstColor: {
                getValue: () => getNavRainbow().properties.firstColor,
                setValue: value => {
                    updateNavRainbow(settings => ({ ...settings, properties: { ...settings.properties, firstColor: value } }));
                },
                defaultValue: defaultNavRainbow.properties.firstColor
            },
            lastColor: {
                getValue: () => getNavRainbow().properties.lastColor,
                setValue: value => {
                    updateNavRainbow(settings => ({ ...settings, properties: { ...settings.properties, lastColor: value } }));
                },
                defaultValue: defaultNavRainbow.properties.lastColor
            },
            transitionStyle: {
                getValue: () => getNavRainbow().properties.transitionStyle,
                setValue: value => {
                    updateNavRainbow(settings => ({ ...settings, properties: { ...settings.properties, transitionStyle: value } }));
                },
                defaultValue: defaultNavRainbow.properties.transitionStyle
            },
            levelScope: {
                getValue: (): NavRainbowScope => getNavRainbow().properties.scope,
                setValue: (value: NavRainbowScope) => {
                    updateNavRainbow(settings => ({ ...settings, properties: { ...settings.properties, scope: value } }));
                },
                isValid: isNavRainbowScope,
                name: strings.settings.items.navRainbowPropertyScope.name,
                desc: strings.settings.items.navRainbowPropertyScope.desc,
                rootOption: strings.settings.items.navRainbowPropertyScope.options.root,
                childOption: strings.settings.items.navRainbowPropertyScope.options.child,
                allOption: strings.settings.items.navRainbowPropertyScope.options.all
            }
        };
    }

    private createColorSetting(params: { containerEl: HTMLElement; name: string; desc: string; access: ColorSettingAccess }): void {
        const setting = new Setting(params.containerEl).setName(params.name).setDesc(params.desc);

        const previewEl = setting.controlEl.createDiv({ cls: 'nn-setting-color-preview' });
        const swatchButtonEl = previewEl.createEl('button', {
            cls: 'nn-setting-color-swatch-button',
            attr: {
                type: 'button',
                'aria-label': params.name
            }
        });
        const swatchEl = swatchButtonEl.createDiv({ cls: 'nn-setting-color-swatch' });

        const openColorPicker = () => {
            runAsyncAction(async () => {
                if (!this.plugin.metadataService) {
                    return;
                }

                const metadataService = this.plugin.metadataService;
                const { ColorPickerModal } = await import('./ColorPickerModal');
                const modal = new ColorPickerModal(
                    this.app,
                    {
                        setTagColor: (path, color) => metadataService.setTagColor(path, color),
                        setFolderColor: async () => {},
                        setFileColor: (path, color) => metadataService.setFileColor(path, color),
                        setPropertyColor: (path, color) => metadataService.setPropertyColor(path, color),
                        removeTagColor: path => metadataService.removeTagColor(path),
                        removeFolderColor: async () => {},
                        removeFileColor: path => metadataService.removeFileColor(path),
                        removePropertyColor: path => metadataService.removePropertyColor(path),
                        setTagBackgroundColor: (path, color) => metadataService.setTagBackgroundColor(path, color),
                        setFolderBackgroundColor: async () => {},
                        setPropertyBackgroundColor: (path, color) => metadataService.setPropertyBackgroundColor(path, color),
                        removeTagBackgroundColor: path => metadataService.removeTagBackgroundColor(path),
                        removeFolderBackgroundColor: async () => {},
                        removePropertyBackgroundColor: path => metadataService.removePropertyBackgroundColor(path),
                        getTagColor: path => metadataService.getTagColor(path),
                        getFolderColor: () => params.access.getValue(),
                        getFileColor: path => metadataService.getFileColor(path),
                        getPropertyColor: path => metadataService.getPropertyColor(path),
                        getTagBackgroundColor: path => metadataService.getTagBackgroundColor(path),
                        getFolderBackgroundColor: () => params.access.getValue(),
                        getPropertyBackgroundColor: path => metadataService.getPropertyBackgroundColor(path),
                        getSettingsProvider: () => metadataService.getSettingsProvider()
                    },
                    '__nn-settings-rainbow-colors__',
                    ItemType.FOLDER,
                    'foreground',
                    { titleOverride: params.name }
                );

                modal.onChooseColor = async color => {
                    const nextValue = typeof color === 'string' && color.trim().length > 0 ? color.trim() : params.access.defaultValue;
                    params.access.setValue(nextValue);
                    await this.plugin.saveSettingsAndUpdate();
                    renderValue();
                    return { handled: true };
                };

                modal.open();
            });
        };
        swatchButtonEl.addEventListener('click', openColorPicker);

        const renderValue = () => {
            const current = params.access.getValue();
            swatchEl.style.backgroundColor = current;
            swatchButtonEl.setAttribute('title', current);
        };

        renderValue();

        setting.addExtraButton(button => {
            button
                .setIcon('lucide-rotate-ccw')
                .setTooltip(`${strings.common.restoreDefault} (${params.access.defaultValue})`)
                .onClick(() => {
                    runAsyncAction(async () => {
                        const current = params.access.getValue();
                        if (current === params.access.defaultValue) {
                            return;
                        }

                        params.access.setValue(params.access.defaultValue);
                        await this.plugin.saveSettingsAndUpdate();
                        renderValue();
                    });
                });
        });
    }
}
