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

import type { Setting } from 'obsidian';

const SETTING_HIDDEN_CLASS = 'nn-setting-hidden';

export function setElementVisible(element: HTMLElement, visible: boolean): void {
    element.classList.toggle(SETTING_HIDDEN_CLASS, !visible);
}

export function createDependentSettingsSection(parentSetting: Setting): HTMLDivElement {
    const container = parentSetting.settingEl.win.createDiv();
    parentSetting.settingEl.after(container);
    return container;
}

export function wireToggleSettingWithDependentSection(
    parentSetting: Setting,
    getValue: () => boolean,
    onValueChange: (value: boolean) => Promise<void> | void
): HTMLDivElement {
    const container = createDependentSettingsSection(parentSetting);
    setElementVisible(container, getValue());

    parentSetting.addToggle(toggle =>
        toggle.setValue(getValue()).onChange(async value => {
            await onValueChange(value);
            setElementVisible(container, value);
        })
    );

    return container;
}
