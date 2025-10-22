/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import { ButtonComponent, DropdownComponent, Notice, Platform, Setting } from 'obsidian';
import { HomepageModal } from '../../modals/HomepageModal';
import { strings } from '../../i18n';
import { FILE_VISIBILITY, type FileVisibility } from '../../utils/fileTypeUtils';
import { TIMEOUTS } from '../../types/obsidian-extended';
import type { SettingsTabContext } from './SettingsTabContext';

/** Renders the general settings tab */
export function renderGeneralTab(context: SettingsTabContext): void {
    const { containerEl, plugin, createDebouncedTextSetting } = context;

    let updateStatusEl: HTMLDivElement | null = null;

    const renderUpdateStatus = (version: string | null) => {
        if (!updateStatusEl) {
            return;
        }
        const hasVersion = Boolean(version);
        updateStatusEl.setText(hasVersion ? strings.settings.items.updateCheckOnStart.status.replace('{version}', version ?? '') : '');
        updateStatusEl.classList.toggle('is-hidden', !hasVersion);
    };

    const applyCurrentNotice = () => {
        const notice = plugin.getPendingUpdateNotice();
        renderUpdateStatus(notice?.version ?? null);
    };

    const updateStatusListenerId = 'general-update-status';
    plugin.unregisterUpdateNoticeListener(updateStatusListenerId);

    const whatsNewSetting = new Setting(containerEl)
        .setName(strings.settings.items.whatsNew.name)
        .setDesc(strings.settings.items.whatsNew.desc)
        .addButton(button =>
            button.setButtonText(strings.settings.items.whatsNew.buttonText).onClick(async () => {
                const { WhatsNewModal } = await import('../../modals/WhatsNewModal');
                const { getLatestReleaseNotes } = await import('../../releaseNotes');
                const latestNotes = getLatestReleaseNotes();
                new WhatsNewModal(context.app, latestNotes, plugin.settings.dateFormat).open();
            })
        );

    updateStatusEl = whatsNewSetting.descEl.createDiv({ cls: 'setting-item-description nn-update-status is-hidden' });

    applyCurrentNotice();

    plugin.registerUpdateNoticeListener(updateStatusListenerId, notice => {
        renderUpdateStatus(notice?.version ?? null);
    });

    const supportSetting = new Setting(containerEl)
        .setName(strings.settings.items.supportDevelopment.name)
        .setDesc(strings.settings.items.supportDevelopment.desc);

    supportSetting.addButton(button => {
        button
            .setButtonText(strings.settings.items.supportDevelopment.buttonText)
            .onClick(() => window.open('https://github.com/sponsors/johansan/'));
        button.buttonEl.addClass('nn-support-button');
    });

    supportSetting.addButton(button => {
        button
            .setButtonText(strings.settings.items.supportDevelopment.coffeeButton)
            .onClick(() => window.open('https://buymeacoffee.com/johansan'));
        button.buttonEl.addClass('nn-support-button');
    });

    new Setting(containerEl).setName(strings.settings.groups.general.view).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.startView.name)
        .setDesc(strings.settings.items.startView.desc)
        .addDropdown(dropdown => {
            dropdown
                .addOptions({
                    navigation: strings.settings.items.startView.options.navigation,
                    files: strings.settings.items.startView.options.files
                })
                .setValue(plugin.settings.startView)
                .onChange(async value => {
                    const nextView = value === 'navigation' ? 'navigation' : 'files';
                    plugin.settings.startView = nextView;
                    await plugin.saveSettingsAndUpdate();
                });
        });

    // Track orientation dropdown and container for visibility toggling
    let orientationDropdown: DropdownComponent | null = null;
    let orientationContainerEl: HTMLDivElement | null = null;

    // Show/hide orientation setting based on dual-pane toggle
    const updateOrientationVisibility = (enabled: boolean) => {
        orientationDropdown?.setDisabled(!enabled);
        orientationContainerEl?.toggleClass('nn-setting-hidden', !enabled);
    };

    if (!Platform.isMobile) {
        new Setting(containerEl)
            .setName(strings.settings.items.dualPane.name)
            .setDesc(strings.settings.items.dualPane.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.useDualPane()).onChange(value => {
                    plugin.setDualPanePreference(value);
                    updateOrientationVisibility(value);
                })
            );

        // Create indented sub-setting for orientation
        orientationContainerEl = containerEl.createDiv('nn-sub-settings');

        new Setting(orientationContainerEl)
            .setName(strings.settings.items.dualPaneOrientation.name)
            .setDesc(strings.settings.items.dualPaneOrientation.desc)
            .addDropdown(dropdown => {
                orientationDropdown = dropdown;
                dropdown
                    .addOptions({
                        horizontal: strings.settings.items.dualPaneOrientation.options.horizontal,
                        vertical: strings.settings.items.dualPaneOrientation.options.vertical
                    })
                    .setValue(plugin.getDualPaneOrientation())
                    .onChange(async value => {
                        // Normalize and persist orientation change
                        const nextOrientation = value === 'vertical' ? 'vertical' : 'horizontal';
                        await plugin.setDualPaneOrientation(nextOrientation);
                    });

                // Initialize visibility based on current dual-pane state
                updateOrientationVisibility(plugin.useDualPane());
            });
    }

    const homepageSetting = new Setting(containerEl).setName(strings.settings.items.homepage.name);
    homepageSetting.setDesc('');

    const homepageDescEl = homepageSetting.descEl;
    homepageDescEl.empty();
    homepageDescEl.createDiv({ text: strings.settings.items.homepage.desc });

    const homepageValueEl = homepageDescEl.createDiv();
    let clearHomepageButton: ButtonComponent | null = null;

    /** Updates the displayed homepage path and button state */
    const renderHomepageValue = () => {
        const { homepage, mobileHomepage, useMobileHomepage } = plugin.settings;
        const isMobile = Platform.isMobile;

        const activePath = isMobile && useMobileHomepage ? mobileHomepage : homepage;
        const labelTemplate =
            isMobile && useMobileHomepage
                ? (strings.settings.items.homepage.currentMobile ?? strings.settings.items.homepage.current)
                : strings.settings.items.homepage.current;

        homepageValueEl.setText('');
        if (activePath) {
            homepageValueEl.setText(labelTemplate.replace('{path}', activePath));
        }

        if (clearHomepageButton) {
            const canClear = isMobile && useMobileHomepage ? Boolean(mobileHomepage) : Boolean(homepage);
            clearHomepageButton.setDisabled(!canClear);
        }
    };

    homepageSetting.addButton(button => {
        button.setButtonText(strings.settings.items.homepage.chooseButton);
        button.onClick(() => {
            new HomepageModal(context.app, file => {
                if (Platform.isMobile && plugin.settings.useMobileHomepage) {
                    plugin.settings.mobileHomepage = file.path;
                } else {
                    plugin.settings.homepage = file.path;
                }
                renderHomepageValue();
                void plugin.saveSettingsAndUpdate();
            }).open();
        });
    });

    homepageSetting.addButton(button => {
        button.setButtonText(strings.settings.items.homepage.clearButton);
        clearHomepageButton = button;
        button.onClick(async () => {
            if (Platform.isMobile && plugin.settings.useMobileHomepage) {
                if (!plugin.settings.mobileHomepage) {
                    return;
                }
                plugin.settings.mobileHomepage = null;
            } else {
                if (!plugin.settings.homepage) {
                    return;
                }
                plugin.settings.homepage = null;
            }
            renderHomepageValue();
            await plugin.saveSettingsAndUpdate();
        });
    });

    renderHomepageValue();

    const homepageSubSettingsEl = containerEl.createDiv('nn-sub-settings');
    new Setting(homepageSubSettingsEl)
        .setName(strings.settings.items.homepage.separateMobile.name)
        .setDesc(strings.settings.items.homepage.separateMobile.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.useMobileHomepage).onChange(async value => {
                plugin.settings.useMobileHomepage = value;
                await plugin.saveSettingsAndUpdate();
                renderHomepageValue();
            })
        );

    if (!Platform.isMobile) {
        let showTooltipsSubSettings: HTMLDivElement | null = null;

        const updateShowTooltipsSubSettings = (visible: boolean) => {
            if (showTooltipsSubSettings) {
                showTooltipsSubSettings.toggleClass('nn-setting-hidden', !visible);
            }
        };

        new Setting(containerEl)
            .setName(strings.settings.items.showTooltips.name)
            .setDesc(strings.settings.items.showTooltips.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.showTooltips).onChange(async value => {
                    plugin.settings.showTooltips = value;
                    await plugin.saveSettingsAndUpdate();
                    updateShowTooltipsSubSettings(value);
                })
            );

        showTooltipsSubSettings = containerEl.createDiv('nn-sub-settings');

        new Setting(showTooltipsSubSettings)
            .setName(strings.settings.items.showTooltipPath.name)
            .setDesc(strings.settings.items.showTooltipPath.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.showTooltipPath).onChange(async value => {
                    plugin.settings.showTooltipPath = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );

        updateShowTooltipsSubSettings(plugin.settings.showTooltips);
    }

    let showIconsSubSettings: HTMLDivElement | null = null;

    const updateShowIconsSubSettings = (visible: boolean) => {
        if (showIconsSubSettings) {
            showIconsSubSettings.toggleClass('nn-setting-hidden', !visible);
        }
    };

    new Setting(containerEl)
        .setName(strings.settings.items.showIcons.name)
        .setDesc(strings.settings.items.showIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showIcons).onChange(async value => {
                plugin.settings.showIcons = value;
                await plugin.saveSettingsAndUpdate();
                updateShowIconsSubSettings(value);
            })
        );

    showIconsSubSettings = containerEl.createDiv('nn-sub-settings');

    new Setting(showIconsSubSettings)
        .setName(strings.settings.items.showIconsColorOnly.name)
        .setDesc(strings.settings.items.showIconsColorOnly.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.colorIconOnly).onChange(async value => {
                plugin.settings.colorIconOnly = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    updateShowIconsSubSettings(plugin.settings.showIcons);

    new Setting(containerEl).setName(strings.settings.groups.general.behavior).setHeading();

    const autoRevealSettingsEl = containerEl.createDiv('nn-sub-settings');

    new Setting(containerEl)
        .setName(strings.settings.items.autoRevealActiveNote.name)
        .setDesc(strings.settings.items.autoRevealActiveNote.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.autoRevealActiveFile).onChange(async value => {
                plugin.settings.autoRevealActiveFile = value;
                await plugin.saveSettingsAndUpdate();
                autoRevealSettingsEl.toggle(value);
            })
        );

    containerEl.appendChild(autoRevealSettingsEl);

    new Setting(autoRevealSettingsEl)
        .setName(strings.settings.items.autoRevealIgnoreRightSidebar.name)
        .setDesc(strings.settings.items.autoRevealIgnoreRightSidebar.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.autoRevealIgnoreRightSidebar).onChange(async value => {
                plugin.settings.autoRevealIgnoreRightSidebar = value;
                await plugin.saveSettingsAndUpdate();
            })
        );
    autoRevealSettingsEl.toggle(plugin.settings.autoRevealActiveFile);

    new Setting(containerEl).setName(strings.settings.groups.general.filtering).setHeading();

    new Setting(containerEl)
        .setName(strings.settings.items.fileVisibility.name)
        .setDesc(strings.settings.items.fileVisibility.desc)
        .addDropdown(dropdown =>
            dropdown
                .addOption(FILE_VISIBILITY.DOCUMENTS, strings.settings.items.fileVisibility.options.documents)
                .addOption(FILE_VISIBILITY.SUPPORTED, strings.settings.items.fileVisibility.options.supported)
                .addOption(FILE_VISIBILITY.ALL, strings.settings.items.fileVisibility.options.all)
                .setValue(plugin.settings.fileVisibility)
                .onChange(async (value: FileVisibility) => {
                    plugin.settings.fileVisibility = value;
                    await plugin.saveSettingsAndUpdate();
                })
        );

    const excludedFoldersSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.excludedFolders.name,
        strings.settings.items.excludedFolders.desc,
        strings.settings.items.excludedFolders.placeholder,
        () => plugin.settings.excludedFolders.join(', '),
        value => {
            plugin.settings.excludedFolders = value
                .split(',')
                .map(folder => folder.trim())
                .filter(folder => folder.length > 0);
        }
    );
    excludedFoldersSetting.controlEl.addClass('nn-setting-wide-input');

    const excludedFilesSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.excludedNotes.name,
        strings.settings.items.excludedNotes.desc,
        strings.settings.items.excludedNotes.placeholder,
        () => plugin.settings.excludedFiles.join(', '),
        value => {
            plugin.settings.excludedFiles = value
                .split(',')
                .map(file => file.trim())
                .filter(file => file.length > 0);
        }
    );
    excludedFilesSetting.controlEl.addClass('nn-setting-wide-input');

    new Setting(containerEl).setName(strings.settings.groups.general.formatting).setHeading();

    const dateFormatSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.dateFormat.name,
        strings.settings.items.dateFormat.desc,
        strings.settings.items.dateFormat.placeholder,
        () => plugin.settings.dateFormat,
        value => {
            plugin.settings.dateFormat = value || 'MMM d, yyyy';
        }
    );
    dateFormatSetting.addExtraButton(button =>
        button
            .setIcon('lucide-help-circle')
            .setTooltip(strings.settings.items.dateFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.dateFormat.help, TIMEOUTS.NOTICE_HELP);
            })
    );
    dateFormatSetting.controlEl.addClass('nn-setting-wide-input');

    const timeFormatSetting = createDebouncedTextSetting(
        containerEl,
        strings.settings.items.timeFormat.name,
        strings.settings.items.timeFormat.desc,
        strings.settings.items.timeFormat.placeholder,
        () => plugin.settings.timeFormat,
        value => {
            plugin.settings.timeFormat = value || 'h:mm a';
        }
    );
    timeFormatSetting.addExtraButton(button =>
        button
            .setIcon('lucide-help-circle')
            .setTooltip(strings.settings.items.timeFormat.helpTooltip)
            .onClick(() => {
                new Notice(strings.settings.items.timeFormat.help, TIMEOUTS.NOTICE_HELP);
            })
    );
    timeFormatSetting.controlEl.addClass('nn-setting-wide-input');
}
