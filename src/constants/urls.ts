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

import { Platform } from 'obsidian';

const NOTEBOOK_NAVIGATOR_REPOSITORY = 'johansan/notebook-navigator';
const NOTEBOOK_NAVIGATOR_RAW_BASE_URL = `https://raw.githubusercontent.com/${NOTEBOOK_NAVIGATOR_REPOSITORY}/main`;

export const NOTEBOOK_NAVIGATOR_RELEASE_CHECK_URL = `https://api.github.com/repos/${NOTEBOOK_NAVIGATOR_REPOSITORY}/releases/latest`;

export const SUPPORT_SPONSOR_URL = 'https://github.com/sponsors/johansan/';
export const SUPPORT_BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/johansan';

export const MOMENT_FORMAT_DOCS_URL = 'https://momentjs.com/docs/#/displaying/format/';

const WELCOME_VIDEO_URL = 'https://www.youtube.com/watch?v=BewIlG8wLAM';
const WELCOME_VIDEO_TIMESTAMP_DESKTOP = 66;
const WELCOME_VIDEO_TIMESTAMP_MOBILE = 116;

export function getWelcomeVideoUrl(): string {
    const timestampSeconds = Platform.isMobile ? WELCOME_VIDEO_TIMESTAMP_MOBILE : WELCOME_VIDEO_TIMESTAMP_DESKTOP;
    return `${WELCOME_VIDEO_URL}&t=${timestampSeconds}s`;
}

export function getWelcomeVideoBaseUrl(): string {
    return WELCOME_VIDEO_URL;
}
export const WELCOME_VIDEO_THUMBNAIL_URL = `${NOTEBOOK_NAVIGATOR_RAW_BASE_URL}/images/youtube-thumbnail.jpg`;

export function getReleaseBannerUrl(bannerUrl: boolean | string | undefined, version: string): string | null {
    if (!bannerUrl) {
        return null;
    }

    const bannerSource = bannerUrl === true ? version : bannerUrl.trim();
    if (bannerSource.length === 0) {
        return null;
    }

    if (/^https?:\/\//i.test(bannerSource)) {
        return bannerSource;
    }

    return `${NOTEBOOK_NAVIGATOR_RAW_BASE_URL}/images/version-banners/${bannerSource}.jpg`;
}
