#!/bin/bash

# Notebook Navigator - Plugin for Obsidian
# Copyright (c) 2026 Emile van Krieken
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

# Fork: builds the plugin and copies it into one or more Obsidian vaults for local testing.
#
# Usage:
#   scripts/install-to-vault.sh <vault> [<vault> ...]
#   OBSIDIAN_VAULTS="$HOME/Vault1:$HOME/Vault2" scripts/install-to-vault.sh
#
# Copies main.js, manifest.json and styles.css into <vault>/.obsidian/plugins/notebook-navigator/.
# The plugin's data.json (its settings) is left untouched. With the Hot Reload plugin installed and a
# .hotreload file in the plugin folder, Obsidian reloads the plugin as soon as the files change;
# otherwise toggle the plugin off and on, or reload Obsidian.
#
# Set SKIP_BUILD=1 to copy the current build without rebuilding.

set -euo pipefail

PLUGIN_ID="notebook-navigator"
FILES=(main.js manifest.json styles.css)

vaults=("$@")
if [ ${#vaults[@]} -eq 0 ] && [ -n "${OBSIDIAN_VAULTS:-}" ]; then
    IFS=':' read -r -a vaults <<< "$OBSIDIAN_VAULTS"
fi
if [ ${#vaults[@]} -eq 0 ]; then
    echo "Usage: $0 <vault> [<vault> ...]   (or set OBSIDIAN_VAULTS, colon-separated)" >&2
    exit 1
fi

# Check every vault before building, so a typo fails fast
for vault in "${vaults[@]}"; do
    if [ ! -d "$vault/.obsidian" ]; then
        echo "Not an Obsidian vault (no .obsidian folder): $vault" >&2
        exit 1
    fi
done

cd "$(dirname "$0")/.."

if [ "${SKIP_BUILD:-0}" != "1" ]; then
    npm run build
fi

for file in "${FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "Missing build output: $file (run without SKIP_BUILD=1)" >&2
        exit 1
    fi
done

version=$(node -p "require('./manifest.json').version")

for vault in "${vaults[@]}"; do
    dest="$vault/.obsidian/plugins/$PLUGIN_ID"
    mkdir -p "$dest"
    cp "${FILES[@]}" "$dest/"
    echo "Installed $PLUGIN_ID $version into $dest"
done
