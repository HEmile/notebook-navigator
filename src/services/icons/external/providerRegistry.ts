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

export type ExternalIconProviderId =
    | 'bootstrap-icons'
    | 'fontawesome-solid'
    | 'material-icons'
    | 'phosphor'
    | 'rpg-awesome'
    | 'simple-icons';

export interface ExternalIconManifest {
    version: string;
    font: string;
    metadata: string;
    fontMimeType?: string;
    metadataFormat?: 'json';
    checksum?: string;
}

export interface ExternalIconProviderConfig {
    id: ExternalIconProviderId;
    name: string;
    manifestUrl: string;
    fontFamily: string;
    catalogUrl: string;
}

export const EXTERNAL_ICON_PROVIDERS: Record<ExternalIconProviderId, ExternalIconProviderConfig> = {
    'bootstrap-icons': {
        id: 'bootstrap-icons',
        name: 'Bootstrap Icons',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/bootstrap-icons/latest.json',
        fontFamily: 'NotebookNavigatorBootstrapIcons',
        catalogUrl: 'https://icons.getbootstrap.com/'
    },
    'fontawesome-solid': {
        id: 'fontawesome-solid',
        name: 'Font Awesome',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/fontawesome/latest.json',
        fontFamily: 'NotebookNavigatorFontAwesomeSolid',
        catalogUrl: 'https://fontawesome.com/'
    },
    'material-icons': {
        id: 'material-icons',
        name: 'Material Icons',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/material-icons/latest.json',
        fontFamily: 'NotebookNavigatorMaterialIcons',
        catalogUrl: 'https://fonts.google.com/icons'
    },
    phosphor: {
        id: 'phosphor',
        name: 'Phosphor Icons',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/phosphor/latest.json',
        fontFamily: 'NotebookNavigatorPhosphorIcons',
        catalogUrl: 'https://phosphoricons.com/'
    },
    'rpg-awesome': {
        id: 'rpg-awesome',
        name: 'RPG Awesome',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/rpg-awesome/latest.json',
        fontFamily: 'NotebookNavigatorRpgAwesome',
        catalogUrl: 'https://nagoshiashumari.github.io/Rpg-Awesome/'
    },
    'simple-icons': {
        id: 'simple-icons',
        name: 'Simple Icons',
        manifestUrl: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/simple-icons/latest.json',
        fontFamily: 'NotebookNavigatorSimpleIcons',
        catalogUrl: 'https://simpleicons.org/'
    }
};
