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
 * Derives filename metadata (name, basename, extension) from a vault-relative path.
 */
export function deriveFileMetadata(path: string): {
    name: string;
    basename: string;
    extension: string;
} {
    const name = path.split('/').pop() ?? '';

    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) {
        return {
            name,
            basename: name,
            extension: ''
        };
    }

    return {
        name,
        basename: name.substring(0, lastDot),
        extension: name.substring(lastDot + 1)
    };
}
