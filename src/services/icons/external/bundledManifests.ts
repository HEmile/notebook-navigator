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

import { ExternalIconManifest, ExternalIconProviderId } from './providerRegistry';

// Bundled icon manifests keyed by provider id
export const BUNDLED_ICON_MANIFESTS: Record<ExternalIconProviderId, ExternalIconManifest> = {
    'bootstrap-icons': {
            "version": "1.13.1",
            "font": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/bootstrap-icons/bootstrap-icons.woff2",
            "metadata": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/bootstrap-icons/bootstrap-icons.json",
            "fontMimeType": "font/woff2",
            "metadataFormat": "json"
        },

    'fontawesome-regular': {
            "version": "7.1.0",
            "font": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/fontawesome/fa-solid-900.woff2",
            "metadata": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/fontawesome/icons-solid.json",
            "fontMimeType": "font/woff2",
            "metadataFormat": "json"
        },

    'material-icons': {
            "version": "145",
            "font": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/material-icons/MaterialIcons-Regular.woff2",
            "metadata": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/material-icons/icons.json",
            "fontMimeType": "font/woff2",
            "metadataFormat": "json"
        },

    'phosphor': {
            "version": "2.1.2",
            "font": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/phosphor/phosphor-regular.woff2",
            "metadata": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/phosphor/icons.json",
            "fontMimeType": "font/woff2",
            "metadataFormat": "json"
        },

    'rpg-awesome': {
            "version": "0.2.0",
            "font": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/rpg-awesome/rpgawesome-webfont.woff",
            "metadata": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/rpg-awesome/icons.json",
            "fontMimeType": "font/woff",
            "metadataFormat": "json"
        },

    'simple-icons': {
            "version": "15.17.0",
            "font": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/simple-icons/SimpleIcons.woff2",
            "metadata": "https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/simple-icons/simple-icons.json",
            "fontMimeType": "font/woff2",
            "metadataFormat": "json"
        }
};
