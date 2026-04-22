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

export function getYoutubeVideoId(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        const pathname = parsedUrl.pathname;
        const searchParams = parsedUrl.searchParams;

        const normalizedHostname = hostname.replace('m.youtube.com', 'youtube.com');

        if (hostname.includes('youtu.be')) {
            return pathname.slice(1);
        }

        if (normalizedHostname.includes('youtube.com')) {
            if (pathname === '/watch') {
                return searchParams.get('v');
            }

            if (pathname.startsWith('/embed/') || pathname.startsWith('/v/') || pathname.startsWith('/shorts/')) {
                return pathname.split('/')[2];
            }

            if (pathname === '/playlist') {
                return searchParams.get('v');
            }
        }
        return null;
    } catch {
        return null;
    }
}

export function getYoutubeThumbnailUrl(videoId: string, quality: string): string {
    const isWebp = quality.endsWith('.webp');
    const baseUrl = isWebp ? 'https://i.ytimg.com/vi_webp' : 'https://img.youtube.com/vi';
    return `${baseUrl}/${videoId}/${quality}`;
}
