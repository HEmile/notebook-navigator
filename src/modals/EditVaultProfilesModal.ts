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

import { App, Modal, setIcon } from 'obsidian';
import type { VaultProfile } from '../settings/types';
import { strings } from '../i18n';
import { addAsyncEventListener } from '../utils/domEventListeners';
import { runAsyncAction } from '../utils/async';
import { ConfirmModal } from './ConfirmModal';
import { InputModal } from './InputModal';
import {
    DEFAULT_VAULT_PROFILE_ID,
    cloneShortcuts,
    createValidatedVaultProfileFromTemplate,
    getLocalizedDefaultVaultProfileName,
    validateVaultProfileNameOrNotify
} from '../utils/vaultProfiles';

interface EditVaultProfilesModalOptions {
    profiles: VaultProfile[];
    activeProfileId: string | null | undefined;
    onSave: (profiles: VaultProfile[], activeProfileId: string) => Promise<void> | void;
}

/**
 * Modal for reordering, renaming, and deleting vault profiles.
 * Applies all changes once when the modal closes.
 */
export class EditVaultProfilesModal extends Modal {
    private listEl: HTMLDivElement | null = null;
    private rowDisposers: (() => void)[] = [];
    private footerDisposers: (() => void)[] = [];
    private applyButton: HTMLButtonElement | null = null;
    private profiles: VaultProfile[];
    private activeProfileId: string;
    private initialSnapshot: string;
    private previousNames = new Map<string, string>();
    private rowInputs = new Map<string, HTMLInputElement>();
    private rowControls = new Map<
        string,
        {
            rowEl: HTMLDivElement;
            upBtn: HTMLButtonElement;
            downBtn: HTMLButtonElement;
            deleteBtn: HTMLButtonElement;
            input: HTMLInputElement;
        }
    >();
    private isSaving = false;

    constructor(
        app: App,
        private options: EditVaultProfilesModalOptions
    ) {
        super(app);
        this.profiles = this.cloneProfiles(options.profiles);
        this.activeProfileId = options.activeProfileId ?? DEFAULT_VAULT_PROFILE_ID;
        this.initialSnapshot = this.serializeProfiles(this.profiles, this.activeProfileId);
        this.profiles.forEach(profile => {
            this.previousNames.set(profile.id, this.resolveProfileName(profile));
        });
    }

    // Initializes the modal UI with profile list and footer buttons
    onOpen(): void {
        this.modalEl.addClass('nn-edit-profiles-modal');
        this.titleEl.setText(strings.settings.items.vaultProfiles.editProfilesModalTitle);
        this.contentEl.empty();

        this.listEl = this.contentEl.createDiv({ cls: 'nn-edit-profiles-list' });
        this.renderRows();
        this.renderFooter();

        this.registerKeyboardShortcuts();
    }

    // Saves pending changes and cleans up event listeners
    onClose(): void {
        this.applyChanges(false);
        this.disposeRowDisposers();
        this.disposeFooterDisposers();
        this.modalEl.removeClass('nn-edit-profiles-modal');
        this.contentEl.empty();
    }

    // Creates editable rows for each profile with name input and action buttons
    private renderRows(): void {
        if (!this.listEl) {
            return;
        }

        this.disposeRowDisposers();
        this.rowInputs.clear();
        this.rowControls.clear();
        this.listEl.empty();

        this.profiles.forEach((profile, index) => {
            const row = this.listEl?.createDiv({ cls: 'nn-edit-profiles-row' });
            if (!row) {
                return;
            }

            const input = row.createEl('input', {
                cls: 'nn-input',
                attr: {
                    type: 'text',
                    placeholder: getLocalizedDefaultVaultProfileName()
                }
            });
            input.value = profile.name ?? '';
            this.rowInputs.set(profile.id, input);

            this.rowDisposers.push(
                addAsyncEventListener(input, 'input', () => {
                    this.handleNameInput(profile.id);
                })
            );
            this.rowDisposers.push(
                addAsyncEventListener(input, 'blur', () => {
                    this.commitProfileName(profile.id);
                })
            );

            const actions = row.createDiv({ cls: 'nn-edit-profiles-actions' });

            const upBtn = actions.createEl('button', {
                cls: 'nn-action-btn',
                attr: {
                    type: 'button',
                    'aria-label': strings.settings.items.vaultProfiles.moveUp
                }
            });
            setIcon(upBtn, 'lucide-chevron-up');
            upBtn.disabled = index === 0;
            this.rowDisposers.push(
                addAsyncEventListener(upBtn, 'click', () => {
                    this.moveProfile(profile.id, -1);
                })
            );

            const downBtn = actions.createEl('button', {
                cls: 'nn-action-btn',
                attr: {
                    type: 'button',
                    'aria-label': strings.settings.items.vaultProfiles.moveDown
                }
            });
            setIcon(downBtn, 'lucide-chevron-down');
            downBtn.disabled = index === this.profiles.length - 1;
            this.rowDisposers.push(
                addAsyncEventListener(downBtn, 'click', () => {
                    this.moveProfile(profile.id, 1);
                })
            );

            const deleteBtn = actions.createEl('button', {
                cls: 'nn-action-btn mod-warning',
                attr: {
                    type: 'button',
                    'aria-label': strings.settings.items.vaultProfiles.deleteButton
                }
            });
            setIcon(deleteBtn, 'lucide-trash-2');
            const isDefaultProfile = profile.id === DEFAULT_VAULT_PROFILE_ID;
            deleteBtn.disabled = isDefaultProfile || this.profiles.length === 1;
            this.rowDisposers.push(
                addAsyncEventListener(deleteBtn, 'click', () => {
                    this.confirmDeleteProfile(profile.id);
                })
            );

            this.rowControls.set(profile.id, {
                rowEl: row,
                upBtn,
                downBtn,
                deleteBtn,
                input
            });
        });

        this.updateMoveButtons();
    }

    // Creates the footer with add and apply buttons
    private renderFooter(): void {
        const footer = this.contentEl.createDiv({ cls: 'nn-button-container' });

        const addButton = footer.createEl('button', {
            text: strings.settings.items.vaultProfiles.addButton,
            attr: { type: 'button' }
        });
        this.footerDisposers.push(
            addAsyncEventListener(addButton, 'click', () => {
                this.promptAddProfile();
            })
        );

        this.applyButton = footer.createEl('button', {
            cls: 'mod-cta',
            text: strings.settings.items.vaultProfiles.applyButton,
            attr: { type: 'button' }
        });
        this.footerDisposers.push(
            addAsyncEventListener(this.applyButton, 'click', () => {
                this.applyChanges(true);
            })
        );

        if (this.isSaving) {
            this.applyButton.disabled = true;
        }
    }

    // Commits profile names and saves changes if any modifications were made
    private applyChanges(shouldClose: boolean): void {
        if (this.isSaving) {
            return;
        }

        this.commitAllProfileNames();
        const nextActiveProfileId = this.getActiveProfileId();
        const snapshot = this.serializeProfiles(this.profiles, nextActiveProfileId);
        if (snapshot === this.initialSnapshot) {
            if (shouldClose) {
                this.close();
            }
            return;
        }

        const payload = this.cloneProfiles(this.profiles);
        this.setSavingState(true);
        runAsyncAction(async () => {
            try {
                await this.options.onSave(payload, nextActiveProfileId);
                this.initialSnapshot = snapshot;
                if (shouldClose) {
                    this.close();
                }
            } finally {
                this.setSavingState(false);
            }
        });
    }

    // Opens an input modal to prompt for a new profile name
    private promptAddProfile(): void {
        const modal = new InputModal(
            this.app,
            strings.settings.items.vaultProfiles.addModalTitle,
            strings.settings.items.vaultProfiles.addModalPlaceholder,
            profileName => {
                this.addProfileWithName(profileName);
            }
        );
        modal.open();
    }

    // Validates the profile name and creates a new profile with settings from the active profile
    private addProfileWithName(profileName: string): void {
        const validatedName = validateVaultProfileNameOrNotify(this.profiles, profileName);
        if (!validatedName) {
            return;
        }

        const result = createValidatedVaultProfileFromTemplate(this.profiles, validatedName, {
            sourceProfile: this.resolveActiveProfile()
        });

        if ('error' in result) {
            return;
        }

        const newProfile = result.profile;
        this.profiles.push(newProfile);
        this.previousNames.set(newProfile.id, newProfile.name ?? '');
        this.activeProfileId = newProfile.id;
        this.renderRows();
    }

    // Returns the active profile or falls back to default or first available profile
    private resolveActiveProfile(): VaultProfile | null {
        if (this.profiles.length === 0) {
            return null;
        }
        const active = this.profiles.find(profile => profile.id === this.activeProfileId);
        if (active) {
            return active;
        }
        const defaultProfile = this.profiles.find(profile => profile.id === DEFAULT_VAULT_PROFILE_ID);
        if (defaultProfile) {
            return defaultProfile;
        }
        return this.profiles[0];
    }

    // Updates the profile name in memory as the user types
    private handleNameInput(profileId: string): void {
        const input = this.rowInputs.get(profileId);
        if (!input) {
            return;
        }

        const profileIndex = this.profiles.findIndex(profile => profile.id === profileId);
        if (profileIndex === -1) {
            return;
        }

        const currentProfile = this.profiles[profileIndex];
        this.profiles[profileIndex] = {
            ...currentProfile,
            name: input.value
        };
    }

    // Validates and finalizes the profile name on blur or enter, reverting to previous name if invalid
    private commitProfileName(profileId: string): void {
        const input = this.rowInputs.get(profileId);
        if (!input) {
            return;
        }

        const profileIndex = this.profiles.findIndex(profile => profile.id === profileId);
        if (profileIndex === -1) {
            return;
        }

        const currentProfile = this.profiles[profileIndex];
        const previousValidName = this.previousNames.get(profileId) ?? this.resolveProfileName(currentProfile);

        const validatedName = validateVaultProfileNameOrNotify(this.profiles, input.value, { excludeId: profileId });
        if (!validatedName) {
            input.value = previousValidName;
            this.profiles[profileIndex] = { ...currentProfile, name: previousValidName };
            return;
        }

        this.profiles[profileIndex] = { ...currentProfile, name: validatedName };
        this.previousNames.set(profileId, validatedName);
        input.value = validatedName;
    }

    // Moves a profile up or down in the list and updates the DOM order
    private moveProfile(profileId: string, offset: number): void {
        const currentIndex = this.profiles.findIndex(profile => profile.id === profileId);
        if (currentIndex === -1) {
            return;
        }

        const nextIndex = currentIndex + offset;
        if (nextIndex < 0 || nextIndex >= this.profiles.length) {
            return;
        }

        const updated = [...this.profiles];
        const [movedProfile] = updated.splice(currentIndex, 1);
        updated.splice(nextIndex, 0, movedProfile);
        this.profiles = updated;

        if (this.listEl) {
            const fragment = document.createDocumentFragment();
            updated.forEach(profile => {
                const controls = this.rowControls.get(profile.id);
                if (controls?.rowEl) {
                    fragment.appendChild(controls.rowEl);
                }
            });
            this.listEl.appendChild(fragment);
        }

        this.updateMoveButtons(updated);
    }

    // Updates the enabled state of move and delete buttons based on profile position
    private updateMoveButtons(order: VaultProfile[] = this.profiles): void {
        const lastIndex = order.length - 1;
        order.forEach((profile, index) => {
            const controls = this.rowControls.get(profile.id);
            if (!controls) {
                return;
            }
            controls.upBtn.disabled = index === 0;
            controls.downBtn.disabled = index === lastIndex;
            const isDefaultProfile = profile.id === DEFAULT_VAULT_PROFILE_ID;
            controls.deleteBtn.disabled = isDefaultProfile || order.length === 1;
        });
    }

    // Shows a confirmation modal before deleting a profile
    private confirmDeleteProfile(profileId: string): void {
        const profile = this.profiles.find(entry => entry.id === profileId);
        if (!profile || profile.id === DEFAULT_VAULT_PROFILE_ID || this.profiles.length === 1) {
            return;
        }

        const profileName = this.resolveProfileName(profile);
        const confirmModal = new ConfirmModal(
            this.app,
            strings.settings.items.vaultProfiles.deleteModalTitle.replace('{name}', profileName),
            strings.settings.items.vaultProfiles.deleteModalMessage.replace('{name}', profileName),
            async () => {
                this.deleteProfile(profileId);
            }
        );
        confirmModal.open();
    }

    // Removes a profile from the list and updates the active profile if needed
    private deleteProfile(profileId: string): void {
        const index = this.profiles.findIndex(profile => profile.id === profileId);
        if (index === -1 || this.profiles.length === 1) {
            return;
        }

        this.profiles.splice(index, 1);
        this.previousNames.delete(profileId);
        this.rowInputs.delete(profileId);

        if (this.activeProfileId === profileId) {
            this.activeProfileId = this.resolveNextActiveProfileId(index);
        }

        this.renderRows();
    }

    // Determines the next active profile after deletion, preferring adjacent or default profile
    private resolveNextActiveProfileId(deletedIndex: number): string {
        const nextProfile =
            this.profiles[deletedIndex] ??
            this.profiles[deletedIndex - 1] ??
            this.profiles.find(profile => profile.id === DEFAULT_VAULT_PROFILE_ID) ??
            this.profiles[0];

        if (nextProfile) {
            return nextProfile.id;
        }

        return DEFAULT_VAULT_PROFILE_ID;
    }

    // Returns the current active profile ID or falls back to default if the active profile was deleted
    private getActiveProfileId(): string {
        const activeExists = this.profiles.some(profile => profile.id === this.activeProfileId);
        if (activeExists) {
            return this.activeProfileId;
        }

        const defaultProfile = this.profiles.find(profile => profile.id === DEFAULT_VAULT_PROFILE_ID);
        if (defaultProfile) {
            return defaultProfile.id;
        }

        return this.profiles[0]?.id ?? DEFAULT_VAULT_PROFILE_ID;
    }

    // Returns the profile name or the localized default name if empty
    private resolveProfileName(profile: VaultProfile): string {
        const name = profile.name?.trim();
        if (name && name.length > 0) {
            return name;
        }
        return getLocalizedDefaultVaultProfileName();
    }

    // Creates a deep copy of the profiles array to prevent mutation of the original
    private cloneProfiles(source: VaultProfile[] | null | undefined): VaultProfile[] {
        if (!Array.isArray(source)) {
            return [];
        }

        return source.map(profile => ({
            ...profile,
            name: profile.name ?? '',
            hiddenFolders: Array.isArray(profile.hiddenFolders) ? [...profile.hiddenFolders] : [],
            hiddenTags: Array.isArray(profile.hiddenTags) ? [...profile.hiddenTags] : [],
            hiddenFileNames: Array.isArray(profile.hiddenFileNames) ? [...profile.hiddenFileNames] : [],
            hiddenFileTags: Array.isArray(profile.hiddenFileTags) ? [...profile.hiddenFileTags] : [],
            hiddenFileProperties: Array.isArray(profile.hiddenFileProperties) ? [...profile.hiddenFileProperties] : [],
            navigationBanner: typeof profile.navigationBanner === 'string' ? profile.navigationBanner : null,
            shortcuts: cloneShortcuts(profile.shortcuts)
        }));
    }

    // Converts profiles and active ID to a JSON string for change detection
    private serializeProfiles(profiles: VaultProfile[], activeProfileId: string): string {
        return JSON.stringify({
            activeProfileId,
            profiles: profiles.map(profile => ({
                id: profile.id,
                name: profile.name?.trim() ?? '',
                hiddenFolders: Array.isArray(profile.hiddenFolders) ? [...profile.hiddenFolders] : [],
                hiddenTags: Array.isArray(profile.hiddenTags) ? [...profile.hiddenTags] : [],
                hiddenFileNames: Array.isArray(profile.hiddenFileNames) ? [...profile.hiddenFileNames] : [],
                hiddenFileTags: Array.isArray(profile.hiddenFileTags) ? [...profile.hiddenFileTags] : [],
                hiddenFileProperties: Array.isArray(profile.hiddenFileProperties) ? [...profile.hiddenFileProperties] : [],
                navigationBanner: profile.navigationBanner ?? null,
                fileVisibility: profile.fileVisibility,
                shortcuts: cloneShortcuts(profile.shortcuts)
            }))
        });
    }

    // Commits all pending profile name changes before saving
    private commitAllProfileNames(): void {
        for (const profileId of this.rowInputs.keys()) {
            this.commitProfileName(profileId);
        }
    }

    // Returns the profile ID associated with the provided input element
    private findProfileIdByInputElement(element: Element | null): string | null {
        if (!element || !(element instanceof HTMLInputElement)) {
            return null;
        }

        for (const [profileId, input] of this.rowInputs.entries()) {
            if (input === element) {
                return profileId;
            }
        }

        return null;
    }

    // Registers keyboard shortcuts for modal interaction
    private registerKeyboardShortcuts(): void {
        this.scope.register([], 'Enter', event => {
            const profileId = this.findProfileIdByInputElement(document.activeElement);
            if (!profileId) {
                return;
            }
            event.preventDefault();
            this.commitProfileName(profileId);
            const input = this.rowInputs.get(profileId);
            if (input) {
                input.blur();
            }
        });
        this.scope.register([], 'Escape', event => {
            event.preventDefault();
            this.close();
        });
    }

    // Enables or disables saving UI while async operations are in progress
    private setSavingState(isSaving: boolean): void {
        this.isSaving = isSaving;
        if (this.applyButton) {
            this.applyButton.disabled = isSaving;
        }
    }

    // Cleans up event listeners attached to profile row elements
    private disposeRowDisposers(): void {
        if (!this.rowDisposers.length) {
            return;
        }

        this.rowDisposers.forEach(dispose => {
            try {
                dispose();
            } catch (error) {
                console.error('Failed to dispose EditVaultProfilesModal row listener', error);
            }
        });
        this.rowDisposers = [];
    }

    // Cleans up event listeners attached to footer buttons
    private disposeFooterDisposers(): void {
        if (!this.footerDisposers.length) {
            return;
        }

        this.footerDisposers.forEach(dispose => {
            try {
                dispose();
            } catch (error) {
                console.error('Failed to dispose EditVaultProfilesModal footer listener', error);
            }
        });
        this.footerDisposers = [];
        this.applyButton = null;
    }
}
