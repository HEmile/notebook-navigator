# Icon Assets

Icon font files and metadata for external icon providers.

## Usage

```bash
# Update all icon packs
./icon-assets/update-icon-packs.sh

# Check for updates without downloading
./icon-assets/update-icon-packs.sh --check-only

# Update specific packs
./icon-assets/update-icon-packs.sh fontawesome simple-icons

# Force update even if already up to date
./icon-assets/update-icon-packs.sh --force
```

## Structure

- `scripts/` - Update scripts and utilities
  - `config/` - Individual icon pack configurations
  - `shared.ts` - Shared utilities and types
  - `update-icon-packs.ts` - Main update script
- `[pack-name]/` - Downloaded icon assets for each pack
  - Font files (.woff/.woff2)
  - Metadata JSON
  - `latest.json` - Version manifest

## Supported Icon Packs

- Bootstrap Icons
- FontAwesome
- Google Material Icons
- Phosphor Icons
- RPG-Awesome
- Simple Icons

## Configuration

Each icon pack has its own configuration file in `scripts/config/` that defines:

- Current version
- Download URLs
- Custom metadata processing logic
- Version checking method
