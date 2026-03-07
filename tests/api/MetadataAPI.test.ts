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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetadataAPI } from '../../src/api/modules/MetadataAPI';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings';
import type { IconString } from '../../src/api/types';
import { TFolder } from 'obsidian';

describe('MetadataAPI icon normalization', () => {
    let foldersByPath: Map<string, TFolder>;
    let plugin: {
        settings: NotebookNavigatorSettings;
        saveSettingsAndUpdate: ReturnType<typeof vi.fn>;
        metadataService: {
            setFolderStyle: ReturnType<typeof vi.fn>;
            getFolderDisplayData: ReturnType<typeof vi.fn>;
            isFolderStyleEventBridgeEnabled?: ReturnType<typeof vi.fn>;
        } | null;
    };
    let api: ConstructorParameters<typeof MetadataAPI>[0];
    let triggerMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        foldersByPath = new Map();
        plugin = {
            settings: structuredClone(DEFAULT_SETTINGS),
            saveSettingsAndUpdate: vi.fn().mockResolvedValue(undefined),
            metadataService: null
        };
        triggerMock = vi.fn();

        api = {
            getPlugin: () => plugin as never,
            getApp: () =>
                ({
                    vault: {
                        getFolderByPath: (path: string) => foldersByPath.get(path) ?? null
                    }
                }) as never,
            trigger: triggerMock
        };
    });

    it('normalizes legacy lucide identifiers provided through the API', async () => {
        const metadataAPI = new MetadataAPI(api);
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);

        await metadataAPI.setFolderMeta(folder, {
            icon: 'lucide-sun' as unknown as IconString
        });

        expect(plugin.settings.folderIcons.Folder).toBe('sun');
        expect(plugin.saveSettingsAndUpdate).toHaveBeenCalled();
    });

    it('normalizes provider-prefixed identifiers provided through the API', async () => {
        const metadataAPI = new MetadataAPI(api);
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);

        await metadataAPI.setFolderMeta(folder, {
            icon: 'phosphor:ph-apple-logo' as IconString
        });

        expect(plugin.settings.folderIcons.Folder).toBe('phosphor:apple-logo');
    });

    it('normalizes property node ids when setting property metadata', async () => {
        const metadataAPI = new MetadataAPI(api);

        await metadataAPI.setPropertyMeta('key:Status=Done', {
            color: '#112233'
        });
        metadataAPI.updateFromSettings(plugin.settings);

        expect(plugin.settings.propertyColors['key:status=done']).toBe('#112233');
        expect(metadataAPI.getPropertyMeta('key:status=done')).toEqual({
            color: '#112233',
            backgroundColor: undefined,
            icon: undefined
        });
    });

    it('ignores invalid property node ids when setting property metadata', async () => {
        const metadataAPI = new MetadataAPI(api);

        await metadataAPI.setPropertyMeta('properties-root', {
            color: '#112233'
        });

        expect(plugin.settings.propertyColors['properties-root']).toBeUndefined();
        expect(plugin.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });

    it('emits property-changed events when property metadata changes', () => {
        const metadataAPI = new MetadataAPI(api);

        const updatedSettings = structuredClone(plugin.settings);
        updatedSettings.propertyColors['key:status'] = '#334455';

        metadataAPI.updateFromSettings(updatedSettings);

        expect(triggerMock).toHaveBeenCalledWith('property-changed', {
            nodeId: 'key:status',
            metadata: {
                color: '#334455',
                backgroundColor: undefined,
                icon: undefined
            }
        });
    });

    it('emits property-changed events when property background metadata changes', () => {
        const metadataAPI = new MetadataAPI(api);

        const updatedSettings = structuredClone(plugin.settings);
        updatedSettings.propertyBackgroundColors['key:status'] = '#223344';

        metadataAPI.updateFromSettings(updatedSettings);

        expect(triggerMock).toHaveBeenCalledWith('property-changed', {
            nodeId: 'key:status',
            metadata: {
                color: undefined,
                backgroundColor: '#223344',
                icon: undefined
            }
        });
    });

    it('emits property-changed events when property icon metadata changes', () => {
        const metadataAPI = new MetadataAPI(api);

        const updatedSettings = structuredClone(plugin.settings);
        updatedSettings.propertyIcons['key:status'] = 'lucide:hash';

        metadataAPI.updateFromSettings(updatedSettings);

        expect(triggerMock).toHaveBeenCalledWith('property-changed', {
            nodeId: 'key:status',
            metadata: {
                color: undefined,
                backgroundColor: undefined,
                icon: 'lucide:hash'
            }
        });
    });

    it('emits property-changed events with null metadata when metadata is cleared', () => {
        plugin.settings.propertyColors['key:status'] = '#334455';
        const metadataAPI = new MetadataAPI(api);

        const updatedSettings = structuredClone(plugin.settings);
        delete updatedSettings.propertyColors['key:status'];

        metadataAPI.updateFromSettings(updatedSettings);

        expect(triggerMock).toHaveBeenCalledWith('property-changed', {
            nodeId: 'key:status',
            metadata: null
        });
    });

    it('routes folder metadata writes through metadata service when available', async () => {
        const getFolderDisplayDataMock = vi
            .fn()
            .mockReturnValueOnce({
                displayName: undefined,
                color: undefined,
                backgroundColor: undefined,
                icon: undefined
            })
            .mockReturnValue({
                displayName: undefined,
                color: '#112233',
                backgroundColor: '#223344',
                icon: 'phosphor:apple-logo'
            });
        plugin.metadataService = {
            setFolderStyle: vi.fn().mockResolvedValue(undefined),
            getFolderDisplayData: getFolderDisplayDataMock
        };
        const metadataAPI = new MetadataAPI(api);
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);

        await metadataAPI.setFolderMeta(folder, {
            icon: 'phosphor:ph-apple-logo' as IconString,
            color: '#112233',
            backgroundColor: '#223344'
        });

        expect(plugin.metadataService.setFolderStyle).toHaveBeenCalledWith('Folder', {
            icon: 'phosphor:apple-logo',
            color: '#112233',
            backgroundColor: '#223344'
        });
        expect(plugin.saveSettingsAndUpdate).not.toHaveBeenCalled();
        expect(triggerMock).toHaveBeenCalledWith('folder-changed', {
            folder,
            metadata: {
                color: '#112233',
                backgroundColor: '#223344',
                icon: 'phosphor:apple-logo'
            }
        });
    });

    it('defers manual folder-changed emission when metadata service bridge is enabled', async () => {
        const getFolderDisplayDataMock = vi
            .fn()
            .mockReturnValueOnce({
                displayName: undefined,
                color: undefined,
                backgroundColor: undefined,
                icon: undefined
            })
            .mockReturnValue({
                displayName: undefined,
                color: '#112233',
                backgroundColor: undefined,
                icon: undefined
            });
        plugin.metadataService = {
            setFolderStyle: vi.fn().mockResolvedValue(undefined),
            getFolderDisplayData: getFolderDisplayDataMock,
            isFolderStyleEventBridgeEnabled: vi.fn().mockReturnValue(true)
        };
        const metadataAPI = new MetadataAPI(api);
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);

        await metadataAPI.setFolderMeta(folder, {
            color: '#112233'
        });

        expect(plugin.metadataService.setFolderStyle).toHaveBeenCalledWith('Folder', {
            color: '#112233'
        });
        expect(triggerMock).not.toHaveBeenCalled();
    });

    it('skips folder-changed emission when style update resolves to unchanged metadata', async () => {
        plugin.metadataService = {
            setFolderStyle: vi.fn().mockResolvedValue(undefined),
            getFolderDisplayData: vi.fn().mockReturnValue({
                displayName: undefined,
                color: undefined,
                backgroundColor: undefined,
                icon: undefined
            })
        };
        const metadataAPI = new MetadataAPI(api);
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);

        await metadataAPI.setFolderMeta(folder, {
            color: '#112233'
        });

        expect(triggerMock).not.toHaveBeenCalled();
    });

    it('skips manual folder-changed emission when folder settings changed during style update', async () => {
        plugin.metadataService = {
            setFolderStyle: vi.fn().mockImplementation(async (_folderPath: string, style: { color?: string | null }) => {
                if (style.color) {
                    plugin.settings.folderColors.Folder = style.color;
                }
            }),
            getFolderDisplayData: vi.fn().mockReturnValue({
                displayName: undefined,
                color: '#112233',
                backgroundColor: undefined,
                icon: undefined
            })
        };
        const metadataAPI = new MetadataAPI(api);
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);

        await metadataAPI.setFolderMeta(folder, {
            color: '#112233'
        });

        expect(triggerMock).not.toHaveBeenCalled();
    });

    it('emits folder-changed events with null metadata when metadata is cleared', () => {
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);
        plugin.settings.folderColors.Folder = '#112233';
        const metadataAPI = new MetadataAPI(api);

        const updatedSettings = structuredClone(plugin.settings);
        delete updatedSettings.folderColors.Folder;

        metadataAPI.updateFromSettings(updatedSettings);

        expect(triggerMock).toHaveBeenCalledWith('folder-changed', {
            folder,
            metadata: null
        });
    });

    it('emits tag-changed events with null metadata when metadata is cleared', () => {
        plugin.settings.tagColors.status = '#112233';
        const metadataAPI = new MetadataAPI(api);

        const updatedSettings = structuredClone(plugin.settings);
        delete updatedSettings.tagColors.status;

        metadataAPI.updateFromSettings(updatedSettings);

        expect(triggerMock).toHaveBeenCalledWith('tag-changed', {
            tag: 'status',
            metadata: null
        });
    });

    it('reads folder metadata through metadata service when frontmatter metadata is enabled', () => {
        plugin.settings.useFrontmatterMetadata = true;
        plugin.metadataService = {
            setFolderStyle: vi.fn().mockResolvedValue(undefined),
            getFolderDisplayData: vi.fn().mockReturnValue({
                displayName: undefined,
                color: '#112233',
                backgroundColor: '#223344',
                icon: 'phosphor:apple-logo'
            })
        };
        const metadataAPI = new MetadataAPI(api);
        const folder = new TFolder();
        folder.path = 'Folder';
        foldersByPath.set(folder.path, folder);

        expect(metadataAPI.getFolderMeta(folder)).toEqual({
            color: '#112233',
            backgroundColor: '#223344',
            icon: 'phosphor:apple-logo'
        });
        expect(plugin.metadataService.getFolderDisplayData).toHaveBeenCalledWith('Folder', {
            includeDisplayName: false,
            includeColor: true,
            includeBackgroundColor: true,
            includeIcon: true,
            includeInheritedColors: false
        });
    });
});
