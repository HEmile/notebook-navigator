#!/usr/bin/env bash

# Notebook Navigator - Plugin for Obsidian
# Copyright (c) 2025-2026 Johan Sanneblad
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCRIPT_PATH="${REPO_ROOT}/icon-assets/scripts/update-icon-packs.ts"

# Display usage information when no parameters are provided
if [[ $# -eq 0 ]]; then
    echo "Icon Pack Updater - Updating all packs..."
    echo ""
    echo "Available options:"
    echo "  --check-only     Check for updates without applying them"
    echo "  --force          Force update even if already up to date"
    echo "  --generate-only  Regenerate bundled manifest files from local icon-assets"
    echo "  [pack-id]        Update specific pack(s) only"
    echo ""
    echo "Available icon packs:"
    echo "  bootstrap-icons  Bootstrap Icons collection"
    echo "  fontawesome      Font Awesome icons"
    echo "  material-icons   Google Material Icons"
    echo "  phosphor         Phosphor Icons"
    echo "  rpg-awesome      RPG Awesome icons"
    echo "  simple-icons     Simple Icons (brand logos)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/update-icon-packs.sh                     # Update all packs"
    echo "  ./scripts/update-icon-packs.sh --check-only        # Check for updates"
    echo "  ./scripts/update-icon-packs.sh --generate-only     # Rewrite generated manifest files"
    echo "  ./scripts/update-icon-packs.sh phosphor --force    # Force update Phosphor"
    echo "  ./scripts/update-icon-packs.sh bootstrap-icons phosphor  # Update specific packs"
    echo ""
    echo "Starting update process..."
    echo "----------------------------------------"
fi

if [[ ! -f "${SCRIPT_PATH}" ]]; then
    echo "Unable to locate update script at ${SCRIPT_PATH}" >&2
    exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
    echo "npx is required to run icon pack updates" >&2
    exit 1
fi

npx tsx "${SCRIPT_PATH}" "$@"
