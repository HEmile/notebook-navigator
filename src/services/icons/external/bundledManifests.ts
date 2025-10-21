import { ExternalIconManifest, ExternalIconProviderId } from './providerRegistry';

// Bundled icon manifests keyed by provider id
export const BUNDLED_ICON_MANIFESTS: Record<ExternalIconProviderId, ExternalIconManifest> = {
    'bootstrap-icons': {
        version: '1.13.1',
        font: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/bootstrap-icons/bootstrap-icons.woff2',
        metadata: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/bootstrap-icons/bootstrap-icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json'
    },

    'fontawesome-solid': {
        version: '7.1.0',
        font: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/fontawesome/fa-solid-900.woff2',
        metadata: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/fontawesome/icons-solid.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json'
    },

    'material-icons': {
        version: '145',
        font: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/material-icons/MaterialIcons-Regular.woff2',
        metadata: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/material-icons/icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json'
    },

    phosphor: {
        version: '2.1.2',
        font: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/phosphor/phosphor-regular.woff2',
        metadata: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/phosphor/icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json'
    },

    'rpg-awesome': {
        version: '0.2.0',
        font: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/rpg-awesome/rpgawesome-webfont.woff',
        metadata: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/rpg-awesome/icons.json',
        fontMimeType: 'font/woff',
        metadataFormat: 'json'
    },

    'simple-icons': {
        version: '15.17.0',
        font: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/simple-icons/SimpleIcons.woff2',
        metadata: 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets/simple-icons/simple-icons.json',
        fontMimeType: 'font/woff2',
        metadataFormat: 'json'
    }
};
