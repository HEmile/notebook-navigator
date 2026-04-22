# Scripts

Utility scripts for building, releasing, and maintaining the Notebook Navigator plugin.

## build.sh

The main build script that ensures code quality before deployment.

**Usage:**

```bash
./scripts/build.sh
```

**Features:**

- Runs ESLint to check for code quality issues
- Validates TypeScript types
- Checks for unused imports and dead code
- Verifies code formatting with Prettier
- Builds the plugin using esbuild
- **Stops immediately if ANY errors or warnings are found**
- Calls `build-local.sh` if available (for local deployment to Obsidian vault)

**Requirements:**

- The build MUST complete with zero errors and zero warnings
- The build summary must show "✅ No warnings"
- Any ESLint errors, TypeScript errors, or warnings will abort the deployment

## release.js

Automates the release process for the Obsidian plugin.

**Usage:**

```bash
node scripts/release.js                    # Interactive mode
node scripts/release.js patch              # Direct patch release
node scripts/release.js minor              # Direct minor release
node scripts/release.js major              # Direct major release
node scripts/release.js patch --dry-run    # Preview changes
```

**Features:**

- Increments version numbers in `manifest.json`, `package.json`, and `versions.json`
- Validates git repository state (clean, on main branch, synced with remote)
- Runs build verification before release
- Creates git commit and tag
- Pushes to trigger GitHub Actions release workflow

**Version Types:**

- **PATCH** (x.x.X): Bug fixes, small tweaks, documentation updates
- **MINOR** (x.X.x): New features, backwards-compatible changes
- **MAJOR** (X.x.x): Breaking changes, major rewrites

**Important:**

- Never manually modify version numbers in files
- Always commit all changes before running
- Must be on main branch and synced with remote

## gitdump.sh

Generates git diff snapshots for code review and backup purposes.

**Usage:**

```bash
./scripts/gitdump.sh
```

**Options:**

1. **Uncommitted changes** - Shows staged and unstaged changes
2. **Current branch vs main** - Shows all changes from main branch
3. **Current state vs before specific commit** - Shows changes since a specific commit

**Output:**

- Creates timestamped diff files in the parent directory
- File format: `{folder_name}_{type}_{timestamp}.txt`
- Useful for quick code reviews or sharing changes

## mdReleaseNotes.js

Converts release notes from TypeScript format to Markdown for GitHub releases.

**Usage:**

```bash
node scripts/mdReleaseNotes.js
```

**Features:**

- Reads the latest release notes from `src/releaseNotes.ts`
- Converts TypeScript object format to clean Markdown
- Outputs formatted release notes ready for GitHub release descriptions
- Automatically used by the release process

## build-local.sh (Optional)

Custom local deployment script (not included in repository).

**Purpose:**

- Deploy built plugin to your local Obsidian vault
- Automatically called by `build.sh` if present
- Add to `.gitignore` to keep vault paths private

**Example:**

```bash
#!/bin/bash
# Copy built files to Obsidian vault
cp main.js manifest.json styles.css ~/Documents/ObsidianVault/.obsidian/plugins/notebook-navigator/
```

## check-unused-strings.mjs

Finds unused i18n keys in `src/i18n/locales/en.ts` by scanning for `strings.<keyPath>` usage across `src` (excluding `src/i18n/locales`). Prompts to remove unused keys from all locale files.

```bash
node scripts/check-unused-strings.mjs
```

## check-unused-css.mjs

Scans `styles.css` and `src` for unused plugin CSS classes and variables.

```bash
node scripts/check-unused-css.mjs
```
