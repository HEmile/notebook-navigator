#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="${SCRIPT_DIR}/scripts/update-icon-packs.ts"

# Display usage information when no parameters are provided
if [[ $# -eq 0 ]]; then
    echo "Icon Pack Updater - Updating all packs..."
    echo ""
    echo "Available options:"
    echo "  --check-only     Check for updates without applying them"
    echo "  --force          Force update even if already up to date"
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
    echo "  ./update-icon-packs.sh                     # Update all packs"
    echo "  ./update-icon-packs.sh --check-only        # Check for updates"
    echo "  ./update-icon-packs.sh phosphor --force    # Force update Phosphor"
    echo "  ./update-icon-packs.sh bootstrap-icons phosphor  # Update specific packs"
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
