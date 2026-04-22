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

import { App, Modal, Setting, setIcon } from 'obsidian';
import NotebookNavigatorPlugin from '../main';
import { strings } from '../i18n';
import { runAsyncAction } from '../utils/async';
import {
    isNavRainbowScope,
    isNavRainbowTransitionStyle,
    type NavRainbowScope,
    type NavRainbowSettings,
    type NavRainbowTransitionStyle,
    type VaultProfile
} from '../settings/types';
import { NAV_RAINBOW_DEFAULTS } from '../settings/defaultSettings';
import { getActiveVaultProfile } from '../utils/vaultProfiles';

type NavRainbowSectionId = 'shortcuts' | 'recent' | 'folders' | 'tags' | 'properties';

interface ColorSettingAccess {
    getLightValue: () => string;
    setLightValue: (value: string) => void;
    lightDefaultValue: string;
    getDarkValue: () => string;
    setDarkValue: (value: string) => void;
    darkDefaultValue: string;
}

interface TransitionStyleSettingAccess {
    getValue: () => NavRainbowTransitionStyle;
    setValue: (value: NavRainbowTransitionStyle) => void;
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
    separateThemeColors: {
        getValue: () => boolean;
    };
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
    private readonly profileId: string;
    private readonly section: NavRainbowSectionId;

    constructor(app: App, plugin: NotebookNavigatorPlugin, section: NavRainbowSectionId) {
        super(app);
        this.plugin = plugin;
        this.profileId = getActiveVaultProfile(plugin.settings).id;
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
            access: access.firstColor,
            separateThemeColors: access.separateThemeColors.getValue()
        });

        this.createColorSetting({
            containerEl: contentEl,
            name: strings.settings.items.navRainbowLastColor.name,
            desc: strings.settings.items.navRainbowLastColor.desc,
            access: access.lastColor,
            separateThemeColors: access.separateThemeColors.getValue()
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

    private getBoundProfile(): VaultProfile | null {
        const profiles = this.plugin.settings.vaultProfiles;
        if (!Array.isArray(profiles)) {
            return null;
        }

        return profiles.find(profile => profile.id === this.profileId) ?? null;
    }

    private getSectionSettingsAccess(): NavRainbowSectionSettingsAccess {
        if (this.section === 'shortcuts') {
            return this.createSectionAccess({
                sectionLabel: strings.settings.items.navRainbowApplyToShortcuts.name,
                getSection: settings => settings.shortcuts,
                setSection: (settings, section) => ({ ...settings, shortcuts: section }),
                defaultSection: NAV_RAINBOW_DEFAULTS.shortcuts
            });
        }

        if (this.section === 'recent') {
            return this.createSectionAccess({
                sectionLabel: strings.settings.items.navRainbowApplyToRecent.name,
                getSection: settings => settings.recent,
                setSection: (settings, section) => ({ ...settings, recent: section }),
                defaultSection: NAV_RAINBOW_DEFAULTS.recent
            });
        }

        if (this.section === 'folders') {
            return this.createSectionAccess({
                sectionLabel: strings.settings.items.navRainbowApplyToFolders.name,
                getSection: settings => settings.folders,
                setSection: (settings, section) => ({ ...settings, folders: section }),
                defaultSection: NAV_RAINBOW_DEFAULTS.folders,
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
                defaultSection: NAV_RAINBOW_DEFAULTS.tags,
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
            defaultSection: NAV_RAINBOW_DEFAULTS.properties,
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
        const getNavRainbow = (): NavRainbowSettings | null => this.getBoundProfile()?.navRainbow ?? null;
        const updateSection = (updater: (section: TSection) => TSection): void => {
            const profile = this.getBoundProfile();
            if (!profile) {
                return;
            }
            const current = profile.navRainbow;
            const nextSection = updater(params.getSection(current));
            profile.navRainbow = params.setSection(current, nextSection);
        };

        const getSection = (): TSection => {
            const navRainbow = getNavRainbow();
            return navRainbow ? params.getSection(navRainbow) : params.defaultSection;
        };

        const access: NavRainbowSectionSettingsAccess = {
            sectionLabel: params.sectionLabel,
            separateThemeColors: {
                getValue: () => getNavRainbow()?.separateThemeColors ?? NAV_RAINBOW_DEFAULTS.separateThemeColors
            },
            firstColor: {
                getLightValue: () => getSection().firstColor,
                setLightValue: value => {
                    updateSection(section => ({ ...section, firstColor: value }));
                },
                lightDefaultValue: params.defaultSection.firstColor,
                getDarkValue: () => getSection().darkFirstColor,
                setDarkValue: value => {
                    updateSection(section => ({ ...section, darkFirstColor: value }));
                },
                darkDefaultValue: params.defaultSection.darkFirstColor
            },
            lastColor: {
                getLightValue: () => getSection().lastColor,
                setLightValue: value => {
                    updateSection(section => ({ ...section, lastColor: value }));
                },
                lightDefaultValue: params.defaultSection.lastColor,
                getDarkValue: () => getSection().darkLastColor,
                setDarkValue: value => {
                    updateSection(section => ({ ...section, darkLastColor: value }));
                },
                darkDefaultValue: params.defaultSection.darkLastColor
            },
            transitionStyle: {
                getValue: () => getSection().transitionStyle,
                setValue: value => {
                    updateSection(section => ({ ...section, transitionStyle: value }));
                }
            }
        };

        if (params.levelScope) {
            const levelScope = params.levelScope;
            access.levelScope = {
                getValue: () => levelScope.getValue(getSection()),
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

    private createColorSetting(params: {
        containerEl: HTMLElement;
        name: string;
        desc: string;
        access: ColorSettingAccess;
        separateThemeColors: boolean;
    }): void {
        const setting = new Setting(params.containerEl).setName(params.name).setDesc(params.desc);
        const previewEl = setting.controlEl.createDiv({ cls: 'nn-setting-color-preview' });
        const createThemedSwatchButton = (theme: 'light' | 'dark'): { buttonEl: HTMLButtonElement; swatchEl: HTMLDivElement } => {
            const isDark = theme === 'dark';
            const themeLabel = isDark ? strings.common.darkMode : strings.common.lightMode;
            const buttonEl = previewEl.createEl('button', {
                cls: `nn-setting-color-swatch-button${isDark ? ' nn-setting-color-swatch-button-dark' : ''}`,
                attr: {
                    type: 'button',
                    'aria-label': `${params.name} (${themeLabel})`
                }
            });
            const swatchEl = buttonEl.createDiv({ cls: 'nn-setting-color-swatch' });
            return { buttonEl, swatchEl };
        };
        const createSingleSwatchButton = (): { buttonEl: HTMLButtonElement; swatchEl: HTMLDivElement } => {
            const buttonEl = previewEl.createEl('button', {
                cls: 'nn-setting-color-swatch-button',
                attr: {
                    type: 'button',
                    'aria-label': params.name
                }
            });
            const swatchEl = buttonEl.createDiv({ cls: 'nn-setting-color-swatch' });
            return { buttonEl, swatchEl };
        };
        const lightSwatch = params.separateThemeColors ? createThemedSwatchButton('light') : null;
        const copyLightToDarkButton =
            params.separateThemeColors && lightSwatch
                ? previewEl.createEl('button', {
                      cls: 'clickable-icon nn-setting-color-copy-button',
                      attr: {
                          type: 'button',
                          'aria-label': strings.settings.items.navRainbowCopyLightToDark,
                          title: strings.settings.items.navRainbowCopyLightToDark
                      }
                  })
                : null;
        const darkSwatch = params.separateThemeColors ? createThemedSwatchButton('dark') : null;
        const singleSwatch = params.separateThemeColors ? null : createSingleSwatchButton();

        if (copyLightToDarkButton) {
            setIcon(copyLightToDarkButton, 'arrow-right');
        }

        const openColorPicker = (theme: 'light' | 'dark' | 'single') => {
            runAsyncAction(async () => {
                if (!this.plugin.metadataService) {
                    return;
                }

                const metadataService = this.plugin.metadataService;
                const { ColorPickerModal } = await import('./ColorPickerModal');
                const isDark = theme === 'dark';
                const isSingle = theme === 'single';
                const themeLabel = isDark ? strings.common.darkMode : strings.common.lightMode;
                const initialColor = isDark ? params.access.getDarkValue() : params.access.getLightValue();
                const defaultValue = isDark ? params.access.darkDefaultValue : params.access.lightDefaultValue;
                const modal = new ColorPickerModal(this.app, {
                    title: isSingle ? params.name : `${params.name} (${themeLabel})`,
                    initialColor,
                    settingsProvider: metadataService.getSettingsProvider(),
                    onChooseColor: async color => {
                        const nextValue = typeof color === 'string' && color.trim().length > 0 ? color.trim() : defaultValue;
                        if (isDark) {
                            params.access.setDarkValue(nextValue);
                        } else {
                            params.access.setLightValue(nextValue);
                        }
                        await this.plugin.saveSettingsAndUpdate();
                        renderValue();
                    }
                });

                modal.open();
            });
        };

        if (singleSwatch) {
            singleSwatch.buttonEl.addEventListener('click', () => openColorPicker('single'));
        } else {
            lightSwatch?.buttonEl.addEventListener('click', () => openColorPicker('light'));
            darkSwatch?.buttonEl.addEventListener('click', () => openColorPicker('dark'));
            copyLightToDarkButton?.addEventListener('click', () => {
                runAsyncAction(async () => {
                    const lightColor = params.access.getLightValue();
                    if (params.access.getDarkValue() === lightColor) {
                        return;
                    }

                    params.access.setDarkValue(lightColor);
                    await this.plugin.saveSettingsAndUpdate();
                    renderValue();
                });
            });
        }

        const renderValue = () => {
            const lightColor = params.access.getLightValue();
            if (singleSwatch) {
                singleSwatch.swatchEl.style.backgroundColor = lightColor;
                singleSwatch.buttonEl.setAttribute('title', lightColor);
                return;
            }

            if (!lightSwatch || !darkSwatch) {
                return;
            }

            lightSwatch.swatchEl.style.backgroundColor = lightColor;
            lightSwatch.buttonEl.setAttribute('title', `${strings.common.lightMode}: ${lightColor}`);

            const darkColor = params.access.getDarkValue();
            darkSwatch.swatchEl.style.backgroundColor = darkColor;
            darkSwatch.buttonEl.setAttribute('title', `${strings.common.darkMode}: ${darkColor}`);
        };

        renderValue();
    }
}
