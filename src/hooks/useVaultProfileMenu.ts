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

import { Menu } from 'obsidian';
import type React from 'react';
import { useCallback } from 'react';
import type NotebookNavigatorPlugin from '../main';
import type { VaultProfile } from '../settings/types';
import { runAsyncAction } from '../utils/async';
import { getLocalizedDefaultVaultProfileName } from '../utils/vaultProfiles';

interface UseVaultProfileMenuParams {
    plugin: NotebookNavigatorPlugin;
    vaultProfiles: VaultProfile[];
    activeProfileId: string;
}

interface UseVaultProfileMenuResult {
    hasProfiles: boolean;
    hasMultipleProfiles: boolean;
    activeProfileName: string;
    handleTriggerClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    handleTriggerKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Shared logic for resolving the active vault profile display name and opening the vault profile menu.
 * Used by both NavigationPaneHeader and VaultTitleArea to avoid duplicating menu and event handling.
 */
export function useVaultProfileMenu({ plugin, vaultProfiles, activeProfileId }: UseVaultProfileMenuParams): UseVaultProfileMenuResult {
    const profileNameFallback = getLocalizedDefaultVaultProfileName();
    const hasProfiles = vaultProfiles.length > 0;
    const hasMultipleProfiles = vaultProfiles.length > 1;
    const activeProfile = vaultProfiles.find(profile => profile.id === activeProfileId) ?? vaultProfiles[0] ?? null;
    const resolvedActiveProfileId = activeProfile?.id ?? '';
    const activeProfileName = activeProfile?.name?.trim().length ? activeProfile.name : profileNameFallback;

    const createProfileMenu = useCallback(() => {
        const menu = new Menu();

        vaultProfiles.forEach(profile => {
            menu.addItem(item => {
                const profileName = profile.name?.trim().length ? profile.name : profileNameFallback;
                item.setTitle(profileName)
                    .setIcon(profile.id === resolvedActiveProfileId ? 'lucide-check' : 'lucide-user')
                    .setDisabled(profile.id === resolvedActiveProfileId)
                    .onClick(() => {
                        runAsyncAction(() => {
                            plugin.setVaultProfile(profile.id);
                        });
                    });
            });
        });

        return menu;
    }, [plugin, profileNameFallback, resolvedActiveProfileId, vaultProfiles]);

    const handleTriggerClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();

            if (!hasMultipleProfiles) {
                return;
            }

            const menu = createProfileMenu();
            menu.showAtMouseEvent(event.nativeEvent);
        },
        [createProfileMenu, hasMultipleProfiles]
    );

    const handleTriggerKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (!hasMultipleProfiles) {
                return;
            }

            const rect = event.currentTarget.getBoundingClientRect();
            const menu = createProfileMenu();
            menu.showAtPosition({
                x: rect.left + rect.width / 2,
                y: rect.bottom
            });
        },
        [createProfileMenu, hasMultipleProfiles]
    );

    return {
        hasProfiles,
        hasMultipleProfiles,
        activeProfileName,
        handleTriggerClick,
        handleTriggerKeyDown
    };
}
