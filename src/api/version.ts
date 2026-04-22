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
 * API Version Management
 *
 * Semantic versioning for the API:
 * - MAJOR: Breaking changes
 * - MINOR: New features (backwards compatible)
 * - PATCH: Bug fixes (backwards compatible)
 */

function formatApiVersion(version: { major: number; minor: number; patch: number }): string {
    return `${version.major}.${version.minor}.${version.patch}`;
}

export const API_VERSION = {
    major: 2,
    minor: 0,
    patch: 0,
    toString(): string {
        return formatApiVersion(API_VERSION);
    }
} as const;
