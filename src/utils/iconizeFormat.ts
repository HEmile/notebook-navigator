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

/**
 * Base mapping between icon providers and their pack names
 */
interface IconizeMapping {
    providerId: string;
    packName: string;
    isDefaultProvider?: boolean;
    prefix: string;
}

/**
 * List of icon providers and their corresponding pack names
 */
const ICONIZE_MAPPINGS: IconizeMapping[] = [
    // Font Awesome variants
    { providerId: 'fontawesome-solid', packName: 'font-awesome-solid', prefix: generateIconizePrefix('font-awesome-solid') },
    { providerId: 'fontawesome-solid', packName: 'font-awesome-regular', prefix: generateIconizePrefix('font-awesome-regular') },
    { providerId: 'fontawesome-brands', packName: 'font-awesome-brands', prefix: generateIconizePrefix('font-awesome-brands') },
    // Iconize built-in packs
    { providerId: 'lucide', packName: 'lucide-icons', prefix: generateIconizePrefix('lucide-icons'), isDefaultProvider: true },
    { providerId: 'remix-icons', packName: 'remix-icons', prefix: generateIconizePrefix('remix-icons') },
    { providerId: 'icon-brew', packName: 'icon-brew', prefix: generateIconizePrefix('icon-brew') },
    { providerId: 'simple-icons', packName: 'simple-icons', prefix: generateIconizePrefix('simple-icons') },
    { providerId: 'tabler-icons', packName: 'tabler-icons', prefix: generateIconizePrefix('tabler-icons') },
    { providerId: 'boxicons', packName: 'boxicons', prefix: generateIconizePrefix('boxicons') },
    { providerId: 'rpg-awesome', packName: 'rpg-awesome', prefix: generateIconizePrefix('rpg-awesome') },
    { providerId: 'coolicons', packName: 'coolicons', prefix: generateIconizePrefix('coolicons') },
    { providerId: 'feather-icons', packName: 'feather-icons', prefix: generateIconizePrefix('feather-icons') },
    { providerId: 'octicons', packName: 'octicons', prefix: generateIconizePrefix('octicons') },
    // Additional providers supported by Notebook Navigator
    { providerId: 'bootstrap-icons', packName: 'bootstrap-icons', prefix: generateIconizePrefix('bootstrap-icons') },
    { providerId: 'material-icons', packName: 'material-icons', prefix: generateIconizePrefix('material-icons') },
    { providerId: 'phosphor', packName: 'phosphor', prefix: generateIconizePrefix('phosphor') }
];

/**
 * Generates an Iconize prefix from a pack name
 * Examples:
 * - "lucide-icons" -> "Li"
 * - "font-awesome-solid" -> "Fas"
 * - "simple-icons" -> "Si"
 */
function generateIconizePrefix(packName: string): string {
    if (packName.includes('-')) {
        const parts = packName.split('-');
        if (parts.length === 0) {
            return '';
        }

        // Take first letter of first part (uppercase) + first letter of remaining parts (lowercase)
        let result = parts[0].charAt(0).toUpperCase();
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            result += part.charAt(0).toLowerCase();
        }
        return result;
    }

    if (packName.length === 0) {
        return '';
    }

    // For single word pack names, take first two letters
    const first = packName.charAt(0).toUpperCase();
    const second = packName.charAt(1) ? packName.charAt(1).toLowerCase() : '';
    return `${first}${second}`;
}

/**
 * Mappings with generated prefixes for all supported icon providers
 */
const PREFIX_TO_MAPPING = new Map<string, IconizeMapping>();
const PROVIDER_TO_MAPPING = new Map<string, IconizeMapping>();

// Preserve initial mapping order for provider -> prefix selection
ICONIZE_MAPPINGS.forEach(mapping => {
    if (!PROVIDER_TO_MAPPING.has(mapping.providerId)) {
        PROVIDER_TO_MAPPING.set(mapping.providerId, mapping);
    }
});

// Sort by prefix length to ensure longest prefixes match first (e.g. Fab before Fa)
const PREFIX_SORTED_MAPPINGS = [...ICONIZE_MAPPINGS].sort((a, b) => b.prefix.length - a.prefix.length);
PREFIX_SORTED_MAPPINGS.forEach(mapping => {
    PREFIX_TO_MAPPING.set(mapping.prefix, mapping);
});

/**
 * Determines the prefix length in an Iconize identifier using Iconize's original logic.
 * Returns 0 when no prefix marker is found (not Iconize format).
 */
function findIconizePrefixLength(value: string): number {
    if (value.length < 2) {
        return 0;
    }

    const searchIndex = value.substring(1).search(/[A-Z0-9]/);
    if (searchIndex === -1) {
        return 0;
    }

    return searchIndex + 1;
}

/**
 * Converts an Iconize PascalCase identifier to kebab-case.
 * Examples:
 * - "Home" -> "home"
 * - "ChevronRight" -> "chevron-right"
 * - "FileJSON" -> "file-json"
 */
function pascalToKebab(value: string): string {
    if (!value) {
        return '';
    }

    const withHyphenSeparators = value
        .replace(/([a-z])([A-Z])/g, '$1-$2') // Handle camelCase transitions, excluding digit uppercase boundaries
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2') // Handle acronyms like "JSON" -> "json"
        .replace(/_/g, '-'); // Replace underscores with hyphens

    return withHyphenSeparators.toLowerCase();
}

/**
 * Converts a kebab-case identifier to Iconize PascalCase format.
 * Examples:
 * - "home" -> "Home"
 * - "chevron-right" -> "ChevronRight"
 * - "file-json" -> "FileJson"
 */
function kebabToPascal(value: string): string {
    if (!value) {
        return '';
    }

    return value
        .split(/[ -]|[ _]/g) // Split on hyphens, spaces, or underscores
        .map(part => {
            if (!part) {
                return '';
            }

            const digitMatch = part.match(/^(\d+)(.*)$/);
            if (digitMatch) {
                const [, digits, remainder] = digitMatch;
                if (!remainder) {
                    return digits;
                }
                return `${digits}${remainder.charAt(0).toUpperCase()}${remainder.slice(1)}`;
            }

            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('');
}

/**
 * Converts an Iconize formatted value (e.g. LiHome) to the plugin's icon identifier.
 * Returns null when the value does not use the Iconize format or when no mapping exists.
 *
 * Examples:
 * - "LiHome" -> "home" (lucide is default)
 * - "FasUser" -> "fontawesome-solid:user"
 * - "SiGithub" -> "simple-icons:github"
 * - "invalid" -> null (no matching prefix)
 */
export function convertIconizeToIconId(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }

    const prefixLength = findIconizePrefixLength(trimmed);
    if (prefixLength <= 0 || prefixLength >= trimmed.length) {
        return null;
    }

    const prefix = trimmed.substring(0, prefixLength);
    const iconName = trimmed.substring(prefixLength);

    const mapping = PREFIX_TO_MAPPING.get(prefix);
    if (!mapping) {
        return null;
    }

    const identifier = pascalToKebab(iconName);
    if (!identifier) {
        return null;
    }

    if (mapping.isDefaultProvider) {
        return identifier;
    }

    return `${mapping.providerId}:${identifier}`;
}

/**
 * Converts a plugin icon identifier to Iconize format (e.g. lucide icon -> LiHome).
 * Returns null when no Iconize mapping exists for the provider.
 *
 * Examples:
 * - "home" -> "LiHome" (assumes lucide as default)
 * - "fontawesome-solid:user" -> "FasUser"
 * - "simple-icons:github" -> "SiGithub"
 * - "unknown-provider:icon" -> null (no mapping for provider)
 */
export function convertIconIdToIconize(iconId: string): string | null {
    const trimmed = iconId.trim();
    if (trimmed.length === 0) {
        return null;
    }

    // Parse provider and icon identifier
    const colonIndex = trimmed.indexOf(':');
    const providerId = colonIndex === -1 ? 'lucide' : trimmed.substring(0, colonIndex);
    const identifier = colonIndex === -1 ? trimmed : trimmed.substring(colonIndex + 1);

    if (identifier.length === 0) {
        return null;
    }

    if (providerId === 'emoji') {
        return null;
    }

    // Find the mapping for this provider
    const mapping = PROVIDER_TO_MAPPING.get(providerId);
    if (!mapping) {
        return null;
    }

    // Convert kebab-case to PascalCase
    const pascalName = kebabToPascal(identifier);
    if (!pascalName) {
        return null;
    }

    // Combine prefix and icon name
    return `${mapping.prefix}${pascalName}`;
}
