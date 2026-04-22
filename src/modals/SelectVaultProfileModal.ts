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

import { App, Modal } from 'obsidian';
import type { VaultProfile } from '../settings/types';
import { strings } from '../i18n';
import { getLocalizedDefaultVaultProfileName } from '../utils/vaultProfiles';
import { runAsyncAction, type MaybePromise } from '../utils/async';

interface SelectVaultProfileModalOptions {
    profiles: VaultProfile[];
    activeProfileId: string | null | undefined;
    onSelect: (profileId: string) => MaybePromise;
}

/**
 * Modal dialog that lists vault profiles with keyboard navigation support
 */
export class SelectVaultProfileModal extends Modal {
    private buttons: HTMLButtonElement[] = [];
    private selectedIndex = -1;

    constructor(
        app: App,
        private options: SelectVaultProfileModalOptions
    ) {
        super(app);
    }

    /** Renders the modal content with profile list and keyboard navigation */
    onOpen(): void {
        this.modalEl.addClass('nn-select-profile-modal');
        this.titleEl.setText(strings.modals.selectVaultProfile.title);
        this.contentEl.empty();

        const profiles = this.options.profiles ?? [];
        if (profiles.length === 0) {
            this.contentEl.createEl('p', {
                text: strings.modals.selectVaultProfile.emptyState,
                cls: 'nn-select-profile-empty'
            });
            return;
        }

        const listEl = this.contentEl.createDiv({
            cls: 'nn-select-profile-list',
            attr: {
                role: 'listbox',
                'aria-label': strings.modals.selectVaultProfile.title
            }
        });

        this.buttons = profiles.map((profile, index) => {
            const button = listEl.createEl('button', {
                cls: 'nn-select-profile-item',
                attr: {
                    type: 'button',
                    role: 'option',
                    'data-profile-id': profile.id
                }
            });
            button.tabIndex = -1;

            const profileName = this.resolveProfileName(profile);
            button.setAttr('aria-selected', 'false');
            button.setAttr('aria-label', profileName);

            const nameEl = button.createSpan({
                cls: 'nn-select-profile-item-name',
                text: profileName
            });
            nameEl.setAttr('aria-hidden', 'true');

            if (profile.id === this.options.activeProfileId) {
                button.classList.add('is-current');
                button.setAttr('aria-label', `${profileName} (${strings.modals.selectVaultProfile.currentBadge})`);
                button.createSpan({
                    cls: 'nn-select-profile-item-badge',
                    text: strings.modals.selectVaultProfile.currentBadge
                });
            }

            button.addEventListener('click', () => {
                this.selectProfile(index);
            });

            return button;
        });

        const initialIndex = this.resolveInitialIndex();
        this.focusProfile(initialIndex);

        this.scope.register([], 'ArrowDown', event => {
            event.preventDefault();
            this.moveSelection(1);
        });

        this.scope.register([], 'ArrowUp', event => {
            event.preventDefault();
            this.moveSelection(-1);
        });

        this.scope.register([], 'Enter', event => {
            event.preventDefault();
            this.selectProfile(this.selectedIndex);
        });

        this.scope.register([], 'Escape', event => {
            event.preventDefault();
            this.close();
        });
    }

    /** Cleans up modal state when closed */
    onClose(): void {
        this.buttons = [];
        this.selectedIndex = -1;
        this.contentEl.empty();
    }

    /** Returns the display name for a profile, falling back to default if unnamed */
    private resolveProfileName(profile: VaultProfile): string {
        const name = profile.name?.trim();
        if (name && name.length > 0) {
            return name;
        }
        return getLocalizedDefaultVaultProfileName();
    }

    /** Determines which profile should be initially selected */
    private resolveInitialIndex(): number {
        const { profiles, activeProfileId } = this.options;
        if (!Array.isArray(profiles) || profiles.length === 0) {
            return 0;
        }
        const activeIndex = profiles.findIndex(profile => profile.id === activeProfileId);
        return activeIndex >= 0 ? activeIndex : 0;
    }

    /** Moves keyboard selection by the specified offset */
    private moveSelection(offset: number): void {
        if (this.buttons.length === 0) {
            return;
        }
        const count = this.buttons.length;
        const currentIndex = this.selectedIndex >= 0 ? this.selectedIndex : 0;
        const nextIndex = (currentIndex + offset + count) % count;
        this.focusProfile(nextIndex);
    }

    /** Updates UI to focus and scroll to the profile at the given index */
    private focusProfile(index: number): void {
        if (this.buttons.length === 0) {
            return;
        }
        const clampedIndex = Math.max(0, Math.min(index, this.buttons.length - 1));
        const previousButton = this.buttons[this.selectedIndex];
        if (previousButton) {
            previousButton.classList.remove('is-selected');
            previousButton.setAttr('aria-selected', 'false');
        }
        const activeButton = this.buttons[clampedIndex];
        activeButton.classList.add('is-selected');
        activeButton.setAttr('aria-selected', 'true');
        activeButton.focus();
        activeButton.scrollIntoView({ block: 'nearest' });
        this.selectedIndex = clampedIndex;
    }

    /** Activates the selected profile and closes the modal */
    private selectProfile(index: number): void {
        const profile = this.options.profiles[index];
        if (!profile) {
            return;
        }
        this.close();
        runAsyncAction(() => this.options.onSelect(profile.id));
    }
}
