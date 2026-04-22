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

/**
 * Utility functions for emoji handling.
 *
 * This module provides functions for validating and extracting emojis from text,
 * supporting the emoji icon provider's functionality.
 */

import emojiRegex from 'emoji-regex';

const EMOJI_SEQUENCE_PATTERN = emojiRegex();
const EMOJI_SEQUENCE_SOURCE = EMOJI_SEQUENCE_PATTERN.source;
const EMOJI_SEQUENCE_FLAGS = EMOJI_SEQUENCE_PATTERN.flags.replace(/g/g, '');
const VALID_EMOJI_SEQUENCE_REGEX = new RegExp(`^(?:${EMOJI_SEQUENCE_SOURCE})+$`, EMOJI_SEQUENCE_FLAGS);
const LEADING_EMOJI_SEQUENCE_REGEX = new RegExp(`^(?:${EMOJI_SEQUENCE_SOURCE})`, EMOJI_SEQUENCE_FLAGS);

/**
 * Tests if a string contains only emoji characters.
 *
 * Supports Unicode emoji sequences, including keycaps, flags, and ZWJ sequences.
 *
 * @param str - The string to test
 * @returns True when the full string is one or more emoji sequences
 */
export function isValidEmoji(str: string): boolean {
    if (!str || str.length === 0) {
        return false;
    }

    // Remove whitespace
    const trimmed = str.trim();
    if (trimmed.length === 0) {
        return false;
    }

    return VALID_EMOJI_SEQUENCE_REGEX.test(trimmed);
}

/**
 * Extracts the first valid emoji from a string.
 *
 * Useful for handling paste events that might contain extra characters.
 * The function attempts to isolate emoji characters from the beginning
 * of the input string, handling composite emojis and modifiers.
 *
 * @param str - The string to extract from
 * @returns The first emoji found, or null if no emoji is present
 */
export function extractFirstEmoji(str: string): string | null {
    if (!str) {
        return null;
    }

    // Trim the string
    const trimmed = str.trim();
    if (trimmed.length === 0) {
        return null;
    }

    // If the whole string is valid emoji, return it
    if (isValidEmoji(trimmed)) {
        return trimmed;
    }

    const match = trimmed.match(LEADING_EMOJI_SEQUENCE_REGEX);

    if (match && match[0].length > 0) {
        return match[0];
    }

    return null;
}
