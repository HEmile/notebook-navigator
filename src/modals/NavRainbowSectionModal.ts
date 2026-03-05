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
import {
    isNavRainbowScope,
    isNavRainbowTransitionStyle,
    type NavRainbowScope,
    type NavRainbowSettings,
    type NavRainbowTransitionStyle
} from '../settings/types';
import { DEFAULT_SETTINGS } from '../settings/defaultSettings';

type NavRainbowSectionId = 'shortcuts' | 'recent' | 'folders' | 'tags' | 'properties';

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

interface LevelScopeConfig<TSection extends NavRainbowSettings['shortcuts']> {
    getValue: (section: TSection) => NavRainbowScope;
    setValue: (section: TSection, value: NavRainbowScope) => TSection;
    isValid: (value: unknown) => value is NavRainbowScope;
    name: string;
    desc: string;
    rootOption: string;
    childOption: string;
    allOption: string;
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
        if (this.section === 'shortcuts') {
            return this.createSectionAccess({
                sectionLabel: strings.settings.items.navRainbowApplyToShortcuts.name,
                getSection: settings => settings.shortcuts,
                setSection: (settings, section) => ({ ...settings, shortcuts: section }),
                defaultSection: DEFAULT_SETTINGS.navRainbow.shortcuts
            });
        }

        if (this.section === 'recent') {
            return this.createSectionAccess({
                sectionLabel: strings.settings.items.navRainbowApplyToRecent.name,
                getSection: settings => settings.recent,
                setSection: (settings, section) => ({ ...settings, recent: section }),
                defaultSection: DEFAULT_SETTINGS.navRainbow.recent
            });
        }

        if (this.section === 'folders') {
            return this.createSectionAccess({
                sectionLabel: strings.settings.items.navRainbowApplyToFolders.name,
                getSection: settings => settings.folders,
                setSection: (settings, section) => ({ ...settings, folders: section }),
                defaultSection: DEFAULT_SETTINGS.navRainbow.folders,
                levelScope: {
                    getValue: section => section.scope,
                    setValue: (section, value) => ({ ...section, scope: value }),
                    isValid: isNavRainbowScope,
                    name: strings.settings.items.navRainbowFolderScope.name,
                    desc: strings.settings.items.navRainbowFolderScope.desc,
                    rootOption: strings.settings.items.navRainbowFolderScope.options.root,
                    childOption: strings.settings.items.navRainbowFolderScope.options.child,
                    allOption: strings.settings.items.navRainbowFolderScope.options.all
                }
            });
        }

        if (this.section === 'tags') {
            return this.createSectionAccess({
                sectionLabel: strings.settings.items.navRainbowApplyToTags.name,
                getSection: settings => settings.tags,
                setSection: (settings, section) => ({ ...settings, tags: section }),
                defaultSection: DEFAULT_SETTINGS.navRainbow.tags,
                levelScope: {
                    getValue: section => section.scope,
                    setValue: (section, value) => ({ ...section, scope: value }),
                    isValid: isNavRainbowScope,
                    name: strings.settings.items.navRainbowTagScope.name,
                    desc: strings.settings.items.navRainbowTagScope.desc,
                    rootOption: strings.settings.items.navRainbowTagScope.options.root,
                    childOption: strings.settings.items.navRainbowTagScope.options.child,
                    allOption: strings.settings.items.navRainbowTagScope.options.all
                }
            });
        }

        return this.createSectionAccess({
            sectionLabel: strings.settings.items.navRainbowApplyToProperties.name,
            getSection: settings => settings.properties,
            setSection: (settings, section) => ({ ...settings, properties: section }),
            defaultSection: DEFAULT_SETTINGS.navRainbow.properties,
            levelScope: {
                getValue: section => section.scope,
                setValue: (section, value) => ({ ...section, scope: value }),
                isValid: isNavRainbowScope,
                name: strings.settings.items.navRainbowPropertyScope.name,
                desc: strings.settings.items.navRainbowPropertyScope.desc,
                rootOption: strings.settings.items.navRainbowPropertyScope.options.root,
                childOption: strings.settings.items.navRainbowPropertyScope.options.child,
                allOption: strings.settings.items.navRainbowPropertyScope.options.all
            }
        });
    }

    private createSectionAccess<TSection extends NavRainbowSettings['shortcuts']>(params: {
        sectionLabel: string;
        getSection: (settings: NavRainbowSettings) => TSection;
        setSection: (settings: NavRainbowSettings, section: TSection) => NavRainbowSettings;
        defaultSection: TSection;
        levelScope?: LevelScopeConfig<TSection>;
    }): NavRainbowSectionSettingsAccess {
        const getNavRainbow = (): NavRainbowSettings => this.plugin.settings.navRainbow;
        const updateSection = (updater: (section: TSection) => TSection): void => {
            const current = getNavRainbow();
            const nextSection = updater(params.getSection(current));
            this.plugin.settings.navRainbow = params.setSection(current, nextSection);
        };

        const access: NavRainbowSectionSettingsAccess = {
            sectionLabel: params.sectionLabel,
            firstColor: {
                getValue: () => params.getSection(getNavRainbow()).firstColor,
                setValue: value => {
                    updateSection(section => ({ ...section, firstColor: value }));
                },
                defaultValue: params.defaultSection.firstColor
            },
            lastColor: {
                getValue: () => params.getSection(getNavRainbow()).lastColor,
                setValue: value => {
                    updateSection(section => ({ ...section, lastColor: value }));
                },
                defaultValue: params.defaultSection.lastColor
            },
            transitionStyle: {
                getValue: () => params.getSection(getNavRainbow()).transitionStyle,
                setValue: value => {
                    updateSection(section => ({ ...section, transitionStyle: value }));
                },
                defaultValue: params.defaultSection.transitionStyle
            }
        };

        if (params.levelScope) {
            const levelScope = params.levelScope;
            access.levelScope = {
                getValue: () => levelScope.getValue(params.getSection(getNavRainbow())),
                setValue: value => {
                    updateSection(section => levelScope.setValue(section, value));
                },
                isValid: levelScope.isValid,
                name: levelScope.name,
                desc: levelScope.desc,
                rootOption: levelScope.rootOption,
                childOption: levelScope.childOption,
                allOption: levelScope.allOption
            };
        }

        return access;
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
                const modal = new ColorPickerModal(this.app, {
                    title: params.name,
                    initialColor: params.access.getValue(),
                    settingsProvider: metadataService.getSettingsProvider(),
                    onChooseColor: async color => {
                        const nextValue = typeof color === 'string' && color.trim().length > 0 ? color.trim() : params.access.defaultValue;
                        params.access.setValue(nextValue);
                        await this.plugin.saveSettingsAndUpdate();
                        renderValue();
                    }
                });

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
