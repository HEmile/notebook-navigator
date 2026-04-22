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

import { EXTERNAL_ICON_PROVIDERS, type ExternalIconProviderId } from './external/providerRegistry';

const BUILTIN_PROVIDER_LINKS: Record<string, string> = {
    lucide: 'https://lucide.dev/icons/'
};

/**
 * Returns the public catalog URL for a provider so users can browse icons outside the modal.
 */
export function getProviderCatalogUrl(providerId: string): string | null {
    if (!providerId) {
        return null;
    }

    const builtInUrl = BUILTIN_PROVIDER_LINKS[providerId];
    if (builtInUrl) {
        return builtInUrl;
    }

    const externalProvider = EXTERNAL_ICON_PROVIDERS[providerId as ExternalIconProviderId];
    return externalProvider?.catalogUrl ?? null;
}
