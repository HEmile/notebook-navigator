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
import { describe, expect, it } from 'vitest';
import { getYoutubeVideoId } from '../../src/utils/youtubeUtils';

describe('getYoutubeVideoId', () => {
    it('extracts video ids from YouTube hostnames', () => {
        expect(getYoutubeVideoId('https://www.youtube.com/watch?v=abc123')).toBe('abc123');
        expect(getYoutubeVideoId('https://m.youtube.com/watch?v=mobile123')).toBe('mobile123');
        expect(getYoutubeVideoId('https://music.youtube.com/watch?v=music123')).toBe('music123');
        expect(getYoutubeVideoId('https://www.youtube.com./shorts/short123')).toBe('short123');
        expect(getYoutubeVideoId('https://youtu.be/shortlink123')).toBe('shortlink123');
    });

    it('rejects hostnames that only contain YouTube domains as substrings', () => {
        expect(getYoutubeVideoId('https://notyoutube.com/watch?v=abc123')).toBeNull();
        expect(getYoutubeVideoId('https://youtube.com.evil.example/watch?v=abc123')).toBeNull();
        expect(getYoutubeVideoId('https://notyoutu.be/abc123')).toBeNull();
        expect(getYoutubeVideoId('https://youtu.be.evil.example/abc123')).toBeNull();
    });
});
