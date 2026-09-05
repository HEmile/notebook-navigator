import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
    decodeCompactNameToKebab,
    normalizeIdentifierFromIconize,
    normalizeIconizeCompactName
} from '../../src/utils/iconizeNormalization';
import { IconPackConfig, ProcessContext, compareVersions, downloadText, downloadBinary } from './shared';

// Import all icon pack configs
import { bootstrapIcons } from './config/bootstrap-icons';
import { fontAwesome } from './config/fontawesome';
import { materialIcons } from './config/material-icons';
import { phosphor } from './config/phosphor';
import { rpgAwesome } from './config/rpg-awesome';
import { simpleIcons } from './config/simple-icons';

const ICON_PACKS = [bootstrapIcons, fontAwesome, materialIcons, phosphor, rpgAwesome, simpleIcons];

const ICON_ASSETS_ROOT = path.resolve(__dirname, '..');
const PUBLIC_BASE_URL = 'https://raw.githubusercontent.com/johansan/notebook-navigator/main/icon-assets';
const BUNDLED_MANIFEST_OUTPUT = path.resolve(__dirname, '..', '..', 'src/services/icons/external/bundledManifests.ts');
const ICONIZE_REVERSE_MAP_OUTPUT = path.resolve(__dirname, '..', '..', 'src/generated/iconizeReverseMaps.ts');

const PACK_ID_TO_PROVIDER_ID: Record<string, string> = {
    'bootstrap-icons': 'bootstrap-icons',
    fontawesome: 'fontawesome-solid',
    'material-icons': 'material-icons',
    phosphor: 'phosphor',
    'rpg-awesome': 'rpg-awesome',
    'simple-icons': 'simple-icons'
};

// Parse command line arguments
const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');
const forceUpdate = args.includes('--force');
const generateOnly = args.includes('--generate-only');
const requestedIds = new Set(args.filter(arg => !arg.startsWith('--')));

function resolveIconAssetOutputPath(pack: IconPackConfig, fileName: string): string {
    if (!PACK_ID_TO_PROVIDER_ID[pack.id]) {
        throw new Error(`[${pack.id}] Unknown icon pack`);
    }

    const allowedFileNames = new Set([pack.files.font, pack.files.metadata, 'latest.json']);
    if (!allowedFileNames.has(fileName) || path.basename(fileName) !== fileName) {
        throw new Error(`[${pack.id}] Invalid icon asset output filename: ${fileName}`);
    }

    const outputPath = path.resolve(ICON_ASSETS_ROOT, pack.id, fileName);
    const packRoot = path.resolve(ICON_ASSETS_ROOT, pack.id);
    const relativePath = path.relative(packRoot, outputPath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`[${pack.id}] Icon asset output path escapes pack directory: ${fileName}`);
    }

    return outputPath;
}

function validateFontAsset(pack: IconPackConfig, contents: Buffer): Buffer {
    const signature = contents.subarray(0, 4).toString('ascii');
    const isValid =
        (pack.files.mimeType === 'font/woff2' && signature === 'wOF2') || (pack.files.mimeType === 'font/woff' && signature === 'wOFF');

    if (!isValid) {
        throw new Error(`[${pack.id}] Downloaded font does not match ${pack.files.mimeType}`);
    }

    return contents;
}

function validateMetadataAsset(pack: IconPackConfig, metadata: string): string {
    let parsed: unknown;

    try {
        parsed = JSON.parse(metadata) as unknown;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[${pack.id}] Downloaded metadata is not valid JSON: ${message}`);
    }

    const hasEntries = Array.isArray(parsed) ? parsed.length > 0 : !!parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;

    if (!hasEntries) {
        throw new Error(`[${pack.id}] Downloaded metadata is empty`);
    }

    return metadata.endsWith('\n') ? metadata : metadata + '\n';
}

async function writeIconAssetOutput(outputPath: string, contents: string | Buffer): Promise<void> {
    // codeql[js/http-to-file-access] Output paths are restricted to known icon asset filenames and downloaded assets are validated before writing.
    await fs.writeFile(outputPath, contents);
}

function extractMetadataIconIds(raw: string): string[] {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
        return parsed
            .flatMap(entry => {
                if (!entry || typeof entry !== 'object' || typeof (entry as { id?: unknown }).id !== 'string') {
                    return [];
                }

                return [(entry as { id: string }).id];
            })
            .sort((a, b) => a.localeCompare(b));
    }

    if (!parsed || typeof parsed !== 'object') {
        return [];
    }

    return Object.keys(parsed as Record<string, unknown>).sort((a, b) => a.localeCompare(b));
}

function addExceptionAlias(exceptionMap: Record<string, string>, providerId: string, compactName: string, canonicalId: string): void {
    const existing = exceptionMap[compactName];
    if (existing && existing !== canonicalId) {
        throw new Error(`[${providerId}] exception alias collision for ${compactName}: ${existing} vs ${canonicalId}`);
    }

    exceptionMap[compactName] = canonicalId;
}

async function writeIconizeReverseMaps(): Promise<void> {
    const exceptionMaps: Record<string, Record<string, string>> = {};

    for (const pack of ICON_PACKS) {
        const providerId = PACK_ID_TO_PROVIDER_ID[pack.id];
        if (!providerId) {
            continue;
        }

        const metadataPath = path.join(ICON_ASSETS_ROOT, pack.id, pack.files.metadata);
        const metadataRaw = await fs.readFile(metadataPath, 'utf8');
        const iconIds = extractMetadataIconIds(metadataRaw);
        const providerExceptionMap: Record<string, string> = {};

        iconIds.forEach(iconId => {
            const iconizeCompact = normalizeIconizeCompactName(iconId);
            const heuristicCanonical = normalizeIdentifierFromIconize(decodeCompactNameToKebab(iconizeCompact), providerId);
            if (heuristicCanonical !== iconId) {
                addExceptionAlias(providerExceptionMap, providerId, iconizeCompact, iconId);
            }
        });

        exceptionMaps[providerId] = Object.fromEntries(Object.entries(providerExceptionMap).sort(([a], [b]) => a.localeCompare(b)));
    }

    const exceptionLines = Object.entries(exceptionMaps)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([providerId, map]) => {
            const mapString = formatTsObjectLiteral(map, '        ');

            return `    ${formatTsPropertyKey(providerId)}: ${mapString}`;
        });
    const contents = [
        '/*',
        ' * Notebook Navigator - Plugin for Obsidian',
        ' * Copyright (c) 2025-2026 Johan Sanneblad',
        ' *',
        ' * This program is free software: you can redistribute it and/or modify',
        ' * it under the terms of the GNU General Public License as published by',
        ' * the Free Software Foundation, either version 3 of the License, or',
        ' * (at your option) any later version.',
        ' *',
        ' * This program is distributed in the hope that it will be useful,',
        ' * but WITHOUT ANY WARRANTY; without even the implied warranty of',
        ' * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
        ' * GNU General Public License for more details.',
        ' *',
        ' * You should have received a copy of the GNU General Public License',
        ' * along with this program.  If not, see <https://www.gnu.org/licenses/>.',
        ' *',
        ' * ========================================================================',
        ' * GENERATED FILE - DO NOT EDIT src/generated/iconizeReverseMaps.ts',
        ' * ========================================================================',
        ' * Generated by: icon-assets/scripts/update-icon-packs.ts',
        ' */',
        '',
        "import type { ExternalIconProviderId } from '../services/icons/external/providerRegistry';",
        '',
        '// Compact Iconize aliases that cannot be reconstructed algorithmically.',
        'export const GENERATED_ICONIZE_EXCEPTION_MAPS: Record<ExternalIconProviderId, Record<string, string>> = {',
        exceptionLines.join(',\n\n'),
        '};',
        ''
    ].join('\n');

    await fs.mkdir(path.dirname(ICONIZE_REVERSE_MAP_OUTPUT), { recursive: true });
    await fs.writeFile(ICONIZE_REVERSE_MAP_OUTPUT, contents);
}

function formatTsPropertyKey(key: string): string {
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        return key;
    }

    return `'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatTsScalar(value: unknown): string {
    if (typeof value === 'string') {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }

    return JSON.stringify(value);
}

function formatTsObjectLiteral(record: Record<string, unknown>, indent: string): string {
    const entries = Object.entries(record);
    if (entries.length === 0) {
        return '{}';
    }

    return [
        '{',
        ...entries.map(([key, value], index) => {
            const suffix = index === entries.length - 1 ? '' : ',';
            return `${indent}${formatTsPropertyKey(key)}: ${formatTsScalar(value)}${suffix}`;
        }),
        `${indent.slice(4)}}`
    ].join('\n');
}

async function updateConfigVersion(configPath: string, newVersion: string): Promise<void> {
    const content = await fs.readFile(configPath, 'utf8');
    const updated = content.replace(/version:\s*['"][\d.]+['"]/, `version: '${newVersion}'`);
    await fs.writeFile(configPath, updated);
}

async function processIconPack(pack: IconPackConfig): Promise<void> {
    const configPath = path.join(__dirname, 'config', `${pack.id}.ts`);
    const currentVersion = pack.version;

    // Check for updates
    const latestVersion = pack.checkVersion ? await pack.checkVersion() : currentVersion;
    const needsUpdate = compareVersions(currentVersion, latestVersion);

    if (checkOnly) {
        if (needsUpdate) {
            console.log(`[${pack.id}] Update available: ${currentVersion} → ${latestVersion}`);
        } else {
            console.log(`[${pack.id}] Up to date: ${currentVersion}`);
        }
        return;
    }

    if (!needsUpdate && !forceUpdate) {
        console.log(`[${pack.id}] Already up to date: ${currentVersion}`);
        return;
    }

    const targetVersion = needsUpdate ? latestVersion : currentVersion;
    console.log(`[${pack.id}] ${needsUpdate ? 'Updating' : 'Processing'} version ${targetVersion}`);

    // Update config file if needed
    if (needsUpdate) {
        await updateConfigVersion(configPath, targetVersion);
        pack.version = targetVersion;
    }

    // Get URLs for the target version
    const urls = pack.urls(targetVersion);

    // Download font file
    const packDir = path.join(ICON_ASSETS_ROOT, pack.id);
    await fs.mkdir(packDir, { recursive: true });

    console.log(`[${pack.id}] Downloading font from ${urls.font}`);
    const fontContents = await downloadBinary(urls.font);
    await writeIconAssetOutput(resolveIconAssetOutputPath(pack, pack.files.font), validateFontAsset(pack, fontContents));

    // Process metadata
    let metadata: string;
    if (pack.processMetadata) {
        const context: ProcessContext = {
            version: targetVersion,
            urls,
            downloadText,
            downloadBinary
        };
        metadata = await pack.processMetadata(context);
    } else {
        // Simple download for packs without custom processing
        if (!urls.metadata) {
            throw new Error(`[${pack.id}] No metadata URL or processor defined`);
        }
        console.log(`[${pack.id}] Downloading metadata from ${urls.metadata}`);
        metadata = await downloadText(urls.metadata);
    }

    await writeIconAssetOutput(resolveIconAssetOutputPath(pack, pack.files.metadata), validateMetadataAsset(pack, metadata));

    // Generate latest.json
    const latestManifest = {
        version: targetVersion,
        font: `${PUBLIC_BASE_URL}/${pack.id}/${pack.files.font}`,
        metadata: `${PUBLIC_BASE_URL}/${pack.id}/${pack.files.metadata}`,
        fontMimeType: pack.files.mimeType,
        metadataFormat: 'json'
    };

    await writeIconAssetOutput(resolveIconAssetOutputPath(pack, 'latest.json'), `${JSON.stringify(latestManifest, null, 2)}\n`);

    if (needsUpdate) {
        console.log(`[${pack.id}] Successfully updated from ${currentVersion} to ${latestVersion}`);
    } else {
        console.log(`[${pack.id}] Successfully processed version ${targetVersion}`);
    }
}

async function writeBundledManifest(): Promise<void> {
    const entries: Array<{ providerId: string; manifest: Record<string, unknown> }> = [];

    for (const pack of ICON_PACKS) {
        const providerId = PACK_ID_TO_PROVIDER_ID[pack.id];
        if (!providerId) {
            continue;
        }

        const manifestPath = path.join(ICON_ASSETS_ROOT, pack.id, 'latest.json');
        try {
            const raw = await fs.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(raw) as Record<string, unknown>;
            entries.push({ providerId, manifest });
        } catch (error) {
            console.error(`[${pack.id}] Failed to read latest.json:`, error);
            throw error;
        }
    }

    if (entries.length === 0) {
        return;
    }

    entries.sort((a, b) => a.providerId.localeCompare(b.providerId));

    const lines = entries.map(entry => {
        const manifestString = formatTsObjectLiteral(entry.manifest, '        ');
        return `    ${formatTsPropertyKey(entry.providerId)}: ${manifestString}`;
    });

    const contents = [
        '/*',
        ' * Notebook Navigator - Plugin for Obsidian',
        ' * Copyright (c) 2025-2026 Johan Sanneblad',
        ' *',
        ' * This program is free software: you can redistribute it and/or modify',
        ' * it under the terms of the GNU General Public License as published by',
        ' * the Free Software Foundation, either version 3 of the License, or',
        ' * (at your option) any later version.',
        ' *',
        ' * This program is distributed in the hope that it will be useful,',
        ' * but WITHOUT ANY WARRANTY; without even the implied warranty of',
        ' * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
        ' * GNU General Public License for more details.',
        ' *',
        ' * You should have received a copy of the GNU General Public License',
        ' * along with this program.  If not, see <https://www.gnu.org/licenses/>.',
        ' *',
        ' * ========================================================================',
        ' * GENERATED FILE - DO NOT EDIT src/services/icons/external/bundledManifests.ts',
        ' * ========================================================================',
        ' * Generated by: icon-assets/scripts/update-icon-packs.ts',
        ' */',
        '',
        "import { ExternalIconManifest, ExternalIconProviderId } from './providerRegistry';",
        '',
        '// Bundled icon manifests keyed by provider id',
        'export const BUNDLED_ICON_MANIFESTS: Record<ExternalIconProviderId, ExternalIconManifest> = {',
        lines.join(',\n\n'),
        '};',
        ''
    ].join('\n');

    await fs.mkdir(path.dirname(BUNDLED_MANIFEST_OUTPUT), { recursive: true });
    await fs.writeFile(BUNDLED_MANIFEST_OUTPUT, contents);
}

async function main(): Promise<void> {
    const packs = ICON_PACKS.filter(pack => requestedIds.size === 0 || requestedIds.has(pack.id));

    if (packs.length === 0) {
        const available = ICON_PACKS.map(pack => pack.id).join(', ');
        throw new Error(`No matching icon packs. Available packs: ${available}`);
    }

    if (!generateOnly) {
        for (const pack of packs) {
            try {
                await processIconPack(pack);
            } catch (error) {
                console.error(`[${pack.id}] Error:`, error);
                if (!forceUpdate) {
                    throw error;
                }
            }
        }
    }

    if (checkOnly) {
        console.log('\n💡 Run without --check-only to apply updates');
        return;
    }

    await writeBundledManifest();
    await writeIconizeReverseMaps();
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
