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
import { describe, expect, it } from 'vitest';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import {
    areNavRainbowSettingsEqual,
    cloneNavRainbowSettings,
    cloneShortcuts,
    createValidatedVaultProfileFromTemplate,
    getActiveFileVisibility,
    getActiveHiddenFileNames,
    getActiveHiddenFileTags,
    getActiveHiddenFileProperties,
    getActiveHiddenFolders,
    getActiveHiddenTags,
    getActiveVaultProfile,
    getHiddenFolderMatcher,
    normalizeHiddenFolderPath,
    removeHiddenFileTagPrefixMatches,
    removeHiddenTagPrefixMatches,
    removeHiddenFolderExactMatches,
    updateHiddenFileTagPrefixMatches,
    updateHiddenTagPrefixMatches,
    updateHiddenFolderExactMatches
} from '../../src/utils/vaultProfiles';
import { normalizeTagPathValue } from '../../src/utils/tagPrefixMatcher';
import { ShortcutStartType, ShortcutType, isSearchShortcut, type ShortcutEntry } from '../../src/types/shortcuts';

function createSettings(): NotebookNavigatorSettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as NotebookNavigatorSettings;
}

describe('updateHiddenFolderExactMatches', () => {
    it('renames exact path matches across every vault profile', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/Archive', '/Reports/*', 'Archive']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenFolders: ['/Projects/Archive/', '/Other']
            }
        ];
        settings.vaultProfile = 'default';

        const didChange = updateHiddenFolderExactMatches(settings, 'Projects/Archive', 'Areas/Archive');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual([
            '/Areas/Archive',
            '/Reports/*',
            'Archive'
        ]);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenFolders).toEqual(['/Areas/Archive', '/Other']);
    });

    it('renames path patterns even when casing differs', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/projects/archive', '/Reports/*', 'Archive']
            }
        ];
        settings.vaultProfile = 'default';

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects/Archive', '/Areas/Archive');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/Archive', '/Reports/*', 'Archive']);
    });

    it('returns false when no perfect match exists', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Design/*', 'Archive']
            }
        ];
        settings.vaultProfile = 'default';

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects/Archive', '/Projects/Renamed');

        expect(didChange).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual(['/Design/*', 'Archive']);
    });

    it('renames wildcard patterns that match the folder prefix', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*', '/Notes/Archive*']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects', '/Areas');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/*', '/Notes/Archive*']);
    });

    it('renames nested wildcard patterns when the prefix matches exactly', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/Archive/*', '/Projects/*']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects/Archive', '/Projects/Archives');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Projects/Archives/*', '/Projects/*']);
    });

    it('renames descendant wildcard patterns when a parent folder changes', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects', '/Projects/Client/*', '/Archive']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects', '/Areas');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas', '/Areas/Client/*', '/Archive']);
    });

    it('renames mid-segment wildcard patterns when the leading segment changes', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*/Archive']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects', '/Areas');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/*/Archive']);
    });

    it('renames mid-segment wildcard patterns when a deeper child is renamed', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*/Archive']
            }
        ];

        const didChange = updateHiddenFolderExactMatches(settings, '/Projects/Client', '/Areas/Client');

        expect(didChange).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Areas/*/Archive']);
    });
});

describe('removeHiddenFolderExactMatches', () => {
    it('removes exact path matches across every vault profile', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/Archive', '/Reports/*', 'Archive']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenFolders: ['/Projects/Archive/', '/Other']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, 'Projects/Archive');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual(['/Reports/*', 'Archive']);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenFolders).toEqual(['/Other']);
    });

    it('removes path patterns even when casing differs', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/projects/archive', '/Reports/*', 'Archive']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenFolders: ['/Projects/Archive/', '/Other']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, 'Projects/Archive');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual(['/Reports/*', 'Archive']);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenFolders).toEqual(['/Other']);
    });

    it('returns false when no perfect match exists to remove', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Design/*', 'Archive']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects/Archive');

        expect(didRemove).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenFolders).toEqual(['/Design/*', 'Archive']);
    });

    it('removes wildcard entries whose prefix matches the deleted folder', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*', '/Projects/Archive/*']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects/Archive');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Projects/*']);
    });

    it('removes descendant wildcard entries when a parent folder is deleted', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects', '/Projects/Client/*', '/Keep']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Keep']);
    });

    it('keeps mid-segment wildcard patterns when deleting a matched child path', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFolders: ['/Projects/*/Archive']
            }
        ];

        const didRemove = removeHiddenFolderExactMatches(settings, '/Projects/Client/Archive');

        expect(didRemove).toBe(false);
        expect(settings.vaultProfiles[0]?.hiddenFolders).toEqual(['/Projects/*/Archive']);
    });
});

describe('vault profile name validation', () => {
    it('rejects NFC and NFD-equivalent duplicate profile names', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                name: 'réunion'
            }
        ];

        expect(createValidatedVaultProfileFromTemplate(settings.vaultProfiles, 're\u0301union')).toEqual({ error: 'duplicate' });
    });
});

describe('hidden tag pattern updates', () => {
    it('does not rewrite name-based wildcard patterns', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['draft*', '*archived', 'projects']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenTags: ['draft*', '*archived', 'misc']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'draft', 'review');

        expect(didUpdate).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenTags).toEqual(['draft*', '*archived', 'projects']);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenTags).toEqual(['draft*', '*archived', 'misc']);
    });

    it('keeps name-based wildcard patterns when deleting a tag', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['*draft', 'draft*', 'keep']
            },
            {
                ...baseProfile,
                id: 'profile-b',
                hiddenTags: ['*draft', 'other']
            }
        ];

        const didRemove = removeHiddenTagPrefixMatches(settings, 'draft');

        expect(didRemove).toBe(false);
        expect(settings.vaultProfiles.find(profile => profile.id === 'default')?.hiddenTags).toEqual(['*draft', 'draft*', 'keep']);
        expect(settings.vaultProfiles.find(profile => profile.id === 'profile-b')?.hiddenTags).toEqual(['*draft', 'other']);
    });

    it('rewrites descendant path rules ending with /* on rename', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects', 'projects/*', 'projects/client/design']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'projects', 'areas');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['areas', 'areas/*', 'areas/client/design']);
    });

    it('rewrites hidden file tag patterns on rename', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFileTags: ['projects', 'projects/*', 'projects/client/design']
            }
        ];

        const didUpdate = updateHiddenFileTagPrefixMatches(settings, 'projects', 'areas');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFileTags).toEqual(['areas', 'areas/*', 'areas/client/design']);
    });

    it('dedupes rewritten hidden tag rules across NFC and NFD-equivalent forms', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['cafe\u0301/areas', 'café/projects']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'cafe\u0301/projects', 'cafe\u0301/areas');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toHaveLength(1);
        expect(settings.vaultProfiles[0]?.hiddenTags.map(normalizeTagPathValue)).toEqual(['café/areas']);
    });

    it('dedupes rewritten hidden file tag rules across NFC and NFD-equivalent forms', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFileTags: ['cafe\u0301/areas', 'café/projects']
            }
        ];

        const didUpdate = updateHiddenFileTagPrefixMatches(settings, 'cafe\u0301/projects', 'cafe\u0301/areas');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFileTags).toHaveLength(1);
        expect(settings.vaultProfiles[0]?.hiddenFileTags.map(normalizeTagPathValue)).toEqual(['café/areas']);
    });

    it('renames mid-segment wildcard tag rules when the leading segment changes', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects/*/drafts']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'projects', 'areas');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['areas/*/drafts']);
    });

    it('renames mid-segment wildcard tag rules when a deeper child is renamed', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects/*/drafts']
            }
        ];

        const didUpdate = updateHiddenTagPrefixMatches(settings, 'projects/client', 'areas/client');

        expect(didUpdate).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['areas/*/drafts']);
    });

    it('removes descendant path rules ending with /* on delete', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenTags: ['projects/*', 'projects/client/design', 'draft*']
            }
        ];

        const didRemove = removeHiddenTagPrefixMatches(settings, 'projects');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenTags).toEqual(['draft*']);
    });

    it('removes hidden file tag patterns on delete', () => {
        const settings = createSettings();
        const [baseProfile] = settings.vaultProfiles;
        settings.vaultProfiles = [
            {
                ...baseProfile,
                id: 'default',
                hiddenFileTags: ['projects/*', 'projects/client/design', 'draft*']
            }
        ];

        const didRemove = removeHiddenFileTagPrefixMatches(settings, 'projects');

        expect(didRemove).toBe(true);
        expect(settings.vaultProfiles[0]?.hiddenFileTags).toEqual(['draft*']);
    });
});

describe('normalizeHiddenFolderPath', () => {
    it('adds leading slash and trims trailing slash', () => {
        expect(normalizeHiddenFolderPath('folder/subdir/')).toBe('/folder/subdir');
    });

    it('preserves vault root and empty values', () => {
        expect(normalizeHiddenFolderPath('/')).toBe('/');
        expect(normalizeHiddenFolderPath('')).toBe('');
    });
});

describe('vault profile selectors', () => {
    it('returns existing profile references without cloning', () => {
        const settings = createSettings();
        const activeProfile = getActiveVaultProfile(settings);

        expect(activeProfile).toBe(settings.vaultProfiles[0]);
        expect(getActiveHiddenFolders(settings)).toBe(settings.vaultProfiles[0].hiddenFolders);
        expect(getActiveHiddenFileProperties(settings)).toBe(settings.vaultProfiles[0].hiddenFileProperties);
        expect(getActiveHiddenFileNames(settings)).toBe(settings.vaultProfiles[0].hiddenFileNames);
        expect(getActiveHiddenTags(settings)).toBe(settings.vaultProfiles[0].hiddenTags);
        expect(getActiveHiddenFileTags(settings)).toBe(settings.vaultProfiles[0].hiddenFileTags);
        expect(getActiveFileVisibility(settings)).toBe(settings.vaultProfiles[0].fileVisibility);
    });
});

describe('areNavRainbowSettingsEqual', () => {
    it('returns true for distinct clones with the same values', () => {
        const navRainbow = createSettings().vaultProfiles[0].navRainbow;
        const cloned = cloneNavRainbowSettings(navRainbow);

        expect(areNavRainbowSettingsEqual(navRainbow, cloned)).toBe(true);
    });

    it('returns false when any section setting changes', () => {
        const navRainbow = createSettings().vaultProfiles[0].navRainbow;
        const nextScope = navRainbow.folders.scope === 'root' ? 'all' : 'root';
        const changed = {
            ...cloneNavRainbowSettings(navRainbow),
            folders: {
                ...navRainbow.folders,
                scope: nextScope
            }
        } satisfies typeof navRainbow;

        expect(areNavRainbowSettingsEqual(navRainbow, changed)).toBe(false);
    });
});

describe('hidden folder matcher', () => {
    it('matches mid-segment wildcard paths and descendants', () => {
        const matcher = getHiddenFolderMatcher(['/Projects/*/Archive']);

        expect(matcher.matches('/Projects/Client/Archive')).toBe(true);
        expect(matcher.matches('/Projects/Client/Archive/Deep')).toBe(true);
        expect(matcher.matches('/Projects/Archive')).toBe(false);
    });

    it('matches paths case-insensitively', () => {
        const matcher = getHiddenFolderMatcher(['/Projects/*/Archive']);

        expect(matcher.matches('/projects/client/archive')).toBe(true);
        expect(matcher.matches('/Projects/CLIENT/archive/Deep')).toBe(true);
    });

    it('matches NFC and NFD-equivalent paths', () => {
        const matcher = getHiddenFolderMatcher(['/Réunion/*/Café']);

        expect(matcher.matches('/Re\u0301union/Client/Cafe\u0301')).toBe(true);
        expect(matcher.matches('/Re\u0301union/Client/Cafe\u0301/Deep')).toBe(true);
    });

    it('matches trailing wildcard patterns against the base path', () => {
        const matcher = getHiddenFolderMatcher(['/Projects/*']);

        expect(matcher.matches('/Projects')).toBe(false);
        expect(matcher.matches('/Projects/Client')).toBe(true);
    });
});

describe('cloneShortcuts', () => {
    it('clones nested search start targets without sharing references', () => {
        const source: ShortcutEntry[] = [
            {
                type: ShortcutType.SEARCH,
                name: 'Active work',
                query: '#work -#done',
                provider: 'internal',
                startTarget: {
                    type: ShortcutStartType.FOLDER,
                    path: 'projects/active'
                }
            }
        ];

        const cloned = cloneShortcuts(source);
        expect(cloned).toEqual(source);

        const originalShortcut = source[0];
        const clonedShortcut = cloned[0];
        if (!isSearchShortcut(originalShortcut) || !isSearchShortcut(clonedShortcut)) {
            throw new Error('Expected search shortcuts in test setup.');
        }

        expect(clonedShortcut).not.toBe(originalShortcut);
        expect(clonedShortcut.startTarget).toEqual(originalShortcut.startTarget);
        expect(clonedShortcut.startTarget).not.toBe(originalShortcut.startTarget);
    });
});
