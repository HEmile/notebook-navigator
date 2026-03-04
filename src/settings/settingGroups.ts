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

import { Setting, SettingGroup, requireApiVersion } from 'obsidian';

interface SettingGroupController {
    rootEl: HTMLElement;
    addSetting: (createSetting: (setting: Setting) => void) => Setting;
}

function supportsSettingGroups(): boolean {
    return typeof SettingGroup === 'function' && requireApiVersion('1.11.0');
}

export function createSettingGroupFactory(containerEl: HTMLElement): (heading?: string | DocumentFragment) => SettingGroupController {
    const useSettingGroups = supportsSettingGroups();

    return (heading?: string | DocumentFragment): SettingGroupController => {
        if (!useSettingGroups && heading) {
            const headingText = typeof heading === 'string' ? heading : (heading.textContent ?? '');
            new Setting(containerEl).setName(headingText).setHeading();
        }

        const wrapperEl = containerEl.createDiv();

        if (useSettingGroups) {
            wrapperEl.addClass('setting-group');
            const group = new SettingGroup(wrapperEl);
            if (heading) {
                group.setHeading(heading);
            }

            return {
                rootEl: wrapperEl,
                addSetting: createSetting => {
                    let createdSetting: Setting | null = null;
                    group.addSetting(setting => {
                        createdSetting = setting;
                        createSetting(setting);
                    });
                    if (!createdSetting) {
                        throw new Error('SettingGroup.addSetting did not provide a Setting');
                    }
                    return createdSetting;
                }
            };
        }

        return {
            rootEl: wrapperEl,
            addSetting: createSetting => {
                const setting = new Setting(wrapperEl);
                createSetting(setting);
                return setting;
            }
        };
    };
}
