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

import { ButtonComponent, Platform } from 'obsidian';
import { strings } from '../../i18n';
import { ConfirmModal } from '../../modals/ConfirmModal';
import { SettingsExportModal, SettingsImportModal } from '../../modals/SettingsTransferModal';
import type { MetadataCleanupSummary } from '../../services/MetadataService';
import type { SettingsTabContext } from './SettingsTabContext';
import { getNavigationPaneSizing } from '../../utils/paneSizing';
import { localStorage } from '../../utils/localStorage';
import { runAsyncAction } from '../../utils/async';
import { showNotice } from '../../utils/noticeUtils';
import { createSettingGroupFactory } from '../settingGroups';

/** Renders the advanced settings tab */
export function renderAdvancedTab(context: SettingsTabContext): void {
    const { containerEl, plugin, addInfoSetting } = context;

    const createGroup = createSettingGroupFactory(containerEl);
    const advancedGroup = createGroup(undefined);

    advancedGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.updateCheckOnStart.name)
            .setDesc(strings.settings.items.updateCheckOnStart.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.checkForUpdatesOnStart).onChange(async value => {
                    plugin.settings.checkForUpdatesOnStart = value;
                    if (!value) {
                        plugin.dismissPendingUpdateNotice();
                    }
                    await plugin.saveSettingsAndUpdate();
                    if (value) {
                        await plugin.runReleaseUpdateCheck(true);
                    }
                })
            );
    });

    if (!Platform.isMobile) {
        advancedGroup.addSetting(setting => {
            setting
                .setName(strings.settings.items.resetPaneSeparator.name)
                .setDesc(strings.settings.items.resetPaneSeparator.desc)
                .addButton(button =>
                    button.setButtonText(strings.settings.items.resetPaneSeparator.buttonText).onClick(() => {
                        const orientation = plugin.getDualPaneOrientation();
                        const { storageKey } = getNavigationPaneSizing(orientation);
                        localStorage.remove(storageKey);
                        showNotice(strings.settings.items.resetPaneSeparator.notice);
                    })
                );
        });
    }

    advancedGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.settingsTransfer.name)
            .setDesc(strings.settings.items.settingsTransfer.desc)
            .addButton(button =>
                button.setButtonText(strings.settings.items.settingsTransfer.importButtonText).onClick(() => {
                    new SettingsImportModal(context.app, plugin).open();
                })
            )
            .addButton(button =>
                button.setButtonText(strings.settings.items.settingsTransfer.exportButtonText).onClick(() => {
                    new SettingsExportModal(context.app, plugin).open();
                })
            );
    });

    advancedGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.resetAllSettings.name)
            .setDesc(strings.settings.items.resetAllSettings.desc)
            .addButton(button => {
                button.setButtonText(strings.settings.items.resetAllSettings.buttonText);
                button.buttonEl.addClass('mod-warning');
                button.onClick(() => {
                    new ConfirmModal(
                        context.app,
                        strings.settings.items.resetAllSettings.confirmTitle,
                        strings.settings.items.resetAllSettings.confirmMessage,
                        async () => {
                            button.setDisabled(true);
                            try {
                                await plugin.resetAllSettings();
                                showNotice(strings.settings.items.resetAllSettings.notice);
                            } catch (error) {
                                console.error('Failed to reset all settings', error);
                                showNotice(strings.settings.items.resetAllSettings.error, { variant: 'warning' });
                            } finally {
                                button.setDisabled(false);
                            }
                        },
                        strings.settings.items.resetAllSettings.confirmButtonText
                    ).open();
                });
            });
    });

    let metadataCleanupButton: ButtonComponent | null = null;
    let metadataCleanupInfoText: HTMLDivElement | null = null;

    /** Sets the metadata cleanup UI to loading state */
    const setMetadataCleanupLoadingState = () => {
        metadataCleanupInfoText?.setText(strings.settings.items.metadataCleanup.loading);
        metadataCleanupButton?.setDisabled(true);
    };

    /** Updates the metadata cleanup information display based on cleanup summary */
    const updateMetadataCleanupInfo = ({ folders, tags, properties, files, pinnedNotes, separators, total }: MetadataCleanupSummary) => {
        if (!metadataCleanupInfoText) {
            return;
        }

        if (total === 0) {
            metadataCleanupInfoText.setText(strings.settings.items.metadataCleanup.statusClean);
            metadataCleanupButton?.setDisabled(true);
            return;
        }

        const infoText = strings.settings.items.metadataCleanup.statusCounts
            .replace('{folders}', folders.toString())
            .replace('{tags}', tags.toString())
            .replace('{properties}', properties.toString())
            .replace('{files}', files.toString())
            .replace('{pinned}', pinnedNotes.toString())
            .replace('{separators}', separators.toString());
        metadataCleanupInfoText.setText(infoText);
        metadataCleanupButton?.setDisabled(false);
    };

    const refreshMetadataCleanupSummary = async () => {
        setMetadataCleanupLoadingState();
        try {
            const summary = await plugin.getMetadataCleanupSummary();
            updateMetadataCleanupInfo(summary);
        } catch (error) {
            console.error('Failed to fetch metadata cleanup summary', error);
            metadataCleanupInfoText?.setText(strings.settings.items.metadataCleanup.error);
            metadataCleanupButton?.setDisabled(false);
        }
    };

    const metadataCleanupSetting = advancedGroup.addSetting(setting => {
        setting.setName(strings.settings.items.metadataCleanup.name).setDesc(strings.settings.items.metadataCleanup.desc);
    });

    metadataCleanupSetting.addButton(button => {
        metadataCleanupButton = button;
        button.setButtonText(strings.settings.items.metadataCleanup.buttonText);
        button.setDisabled(true);
        // Run metadata cleanup without blocking the UI
        button.onClick(() => {
            runAsyncAction(async () => {
                setMetadataCleanupLoadingState();
                try {
                    await plugin.runMetadataCleanup();
                } catch (error) {
                    console.error('Metadata cleanup failed', error);
                    showNotice(strings.settings.items.metadataCleanup.error, { variant: 'warning' });
                } finally {
                    await refreshMetadataCleanupSummary();
                }
            });
        });
    });

    metadataCleanupInfoText = metadataCleanupSetting.descEl.createDiv({
        cls: 'setting-item-description',
        text: strings.settings.items.metadataCleanup.loading
    });

    // Load initial metadata cleanup summary without blocking
    runAsyncAction(() => refreshMetadataCleanupSummary());

    advancedGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.rebuildCache.name)
            .setDesc(strings.settings.items.rebuildCache.desc)
            .addButton(button =>
                button.setButtonText(strings.settings.items.rebuildCache.buttonText).onClick(() => {
                    // Rebuild cache without blocking the UI
                    runAsyncAction(async () => {
                        button.setDisabled(true);
                        try {
                            await plugin.rebuildCache();
                        } catch (error) {
                            console.error('Failed to rebuild cache from settings:', error);
                            showNotice(strings.settings.items.rebuildCache.error, { variant: 'warning' });
                        } finally {
                            button.setDisabled(false);
                        }
                    });
                })
            );
    });

    const cacheStatsSetting = addInfoSetting(
        advancedGroup.addSetting,
        ['nn-database-stats', 'nn-stats-section', 'nn-local-cache-stats-setting'],
        () => {}
    );

    const statsTextEl = cacheStatsSetting.descEl.createDiv({ cls: 'nn-stats-text' });

    // Use context directly to satisfy eslint exhaustive-deps requirements
    context.registerStatsTextElement(statsTextEl);
    context.requestStatisticsRefresh();
    context.ensureStatisticsInterval();
}
