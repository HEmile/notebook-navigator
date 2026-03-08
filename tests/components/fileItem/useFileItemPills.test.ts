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

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaultSettings';
import { useFileItemPills, type UseFileItemPillsParams } from '../../../src/components/fileItem/useFileItemPills';
import { createTestTFile } from '../../utils/createTestTFile';

const mockOpenLinkText = vi.fn();
const mockNavigateToTag = vi.fn();
const mockNavigateToProperty = vi.fn();
const mockMetadataService = {
    getTagColorData: vi.fn<(tag: string) => { color?: string; background?: string }>(),
    getTagIcon: vi.fn<(tag: string) => string | undefined>(),
    getPropertyColorData: vi.fn<(nodeId: string) => { color?: string; background?: string }>(),
    getPropertyIcon: vi.fn<(nodeId: string) => string | undefined>()
};

vi.mock('../../../src/context/ServicesContext', () => ({
    useServices: () => ({
        app: {
            workspace: {
                openLinkText: mockOpenLinkText
            }
        },
        isMobile: false
    }),
    useMetadataService: () => mockMetadataService
}));

vi.mock('../../../src/context/SettingsContext', () => ({
    useActiveProfile: () => ({
        hiddenTags: []
    })
}));

vi.mock('../../../src/context/UXPreferencesContext', () => ({
    useUXPreferences: () => ({
        showHiddenItems: false
    })
}));

vi.mock('../../../src/hooks/useTagNavigation', () => ({
    useTagNavigation: () => ({
        navigateToTag: mockNavigateToTag,
        navigateToProperty: mockNavigateToProperty
    })
}));

vi.mock('../../../src/components/ServiceIcon', () => ({
    ServiceIcon: ({ iconId, className }: { iconId: string; className?: string }) =>
        React.createElement('span', { 'data-icon-id': iconId, className })
}));

function renderPillRows(params: UseFileItemPillsParams): string {
    function Host() {
        const state = useFileItemPills(params);
        return React.createElement(
            'div',
            {
                'data-show-tags': state.shouldShowFileTags ? 'true' : 'false',
                'data-show-properties': state.shouldShowProperty ? 'true' : 'false',
                'data-show-word-count': state.shouldShowWordCountProperty ? 'true' : 'false'
            },
            state.pillRows
        );
    }

    return renderToStaticMarkup(React.createElement(Host));
}

describe('useFileItemPills', () => {
    beforeEach(() => {
        mockOpenLinkText.mockReset();
        mockNavigateToTag.mockReset();
        mockNavigateToProperty.mockReset();
        mockMetadataService.getTagColorData.mockReset();
        mockMetadataService.getTagIcon.mockReset();
        mockMetadataService.getPropertyColorData.mockReset();
        mockMetadataService.getPropertyIcon.mockReset();

        mockMetadataService.getTagColorData.mockImplementation(() => ({}));
        mockMetadataService.getTagIcon.mockImplementation(() => undefined);
        mockMetadataService.getPropertyColorData.mockImplementation(() => ({}));
        mockMetadataService.getPropertyIcon.mockImplementation(() => undefined);
    });

    it('renders colored tags before uncolored tags when colored priority is enabled', () => {
        mockMetadataService.getTagColorData.mockImplementation(tag => {
            if (tag === 'beta') {
                return { color: '#ff0000' };
            }

            return {};
        });

        const markup = renderPillRows({
            file: createTestTFile('Notes/Daily.md'),
            isCompactMode: false,
            tags: ['alpha', 'beta'],
            properties: null,
            wordCount: null,
            notePropertyType: DEFAULT_SETTINGS.notePropertyType,
            settings: {
                ...DEFAULT_SETTINGS,
                showTags: true,
                showFileTags: true,
                colorFileTags: true,
                prioritizeColoredFileTags: true,
                tagColors: { beta: '#ff0000' }
            },
            visiblePropertyKeys: new Set<string>(),
            visibleNavigationPropertyKeys: new Set<string>()
        });

        expect(markup).toContain('data-show-tags="true"');
        expect(markup.indexOf('beta')).toBeLessThan(markup.indexOf('alpha'));
        expect(markup).toContain('style="color:#ff0000"');
    });

    it('renders word count pill rows for markdown notes when word count is active', () => {
        const markup = renderPillRows({
            file: createTestTFile('Notes/Counted.md'),
            isCompactMode: false,
            tags: [],
            properties: null,
            wordCount: 1234,
            notePropertyType: 'wordCount',
            settings: {
                ...DEFAULT_SETTINGS,
                showFileProperties: true
            },
            visiblePropertyKeys: new Set<string>(),
            visibleNavigationPropertyKeys: new Set<string>()
        });

        expect(markup).toContain('data-show-word-count="true"');
        expect(markup).toContain('1,234');
    });

    it('renders external property links using their display text', () => {
        const markup = renderPillRows({
            file: createTestTFile('Notes/Links.md'),
            isCompactMode: false,
            tags: [],
            properties: [
                {
                    fieldKey: 'Reference',
                    value: '[GitHub issue](https://github.com/johansan/notebook-navigator/issues/935)',
                    valueKind: 'string'
                }
            ],
            wordCount: null,
            notePropertyType: DEFAULT_SETTINGS.notePropertyType,
            settings: {
                ...DEFAULT_SETTINGS,
                showFileProperties: true,
                enablePropertyExternalLinks: true
            },
            visiblePropertyKeys: new Set<string>(['reference']),
            visibleNavigationPropertyKeys: new Set<string>()
        });

        expect(markup).toContain('GitHub issue');
        expect(markup).not.toContain('https://github.com/johansan/notebook-navigator/issues/935');
        expect(markup).toContain('nn-file-property-link');
        expect(markup).toContain('nn-clickable-tag');
        expect(markup).toContain('data-icon-id="external-link"');
    });

    it('renders bare external URLs as clickable property links', () => {
        const markup = renderPillRows({
            file: createTestTFile('Notes/Links.md'),
            isCompactMode: false,
            tags: [],
            properties: [
                {
                    fieldKey: 'Reference',
                    value: 'https://github.com/johansan/notebook-navigator/issues/935',
                    valueKind: 'string'
                }
            ],
            wordCount: null,
            notePropertyType: DEFAULT_SETTINGS.notePropertyType,
            settings: {
                ...DEFAULT_SETTINGS,
                showFileProperties: true,
                enablePropertyExternalLinks: true
            },
            visiblePropertyKeys: new Set<string>(['reference']),
            visibleNavigationPropertyKeys: new Set<string>()
        });

        expect(markup).toContain('https://github.com/johansan/notebook-navigator/issues/935');
        expect(markup).toContain('nn-file-property-link');
        expect(markup).toContain('nn-clickable-tag');
        expect(markup).toContain('data-icon-id="external-link"');
    });

    it('renders internal property links as plain property values when link opening is disabled', () => {
        const markup = renderPillRows({
            file: createTestTFile('Notes/Links.md'),
            isCompactMode: false,
            tags: [],
            properties: [
                {
                    fieldKey: 'Reference',
                    value: '[[Tech Insights/Tech Insights 2026 Week 11|Tech Insights 2026 Week 11]]',
                    valueKind: 'string'
                }
            ],
            wordCount: null,
            notePropertyType: DEFAULT_SETTINGS.notePropertyType,
            settings: {
                ...DEFAULT_SETTINGS,
                showFileProperties: true,
                enablePropertyInternalLinks: false
            },
            visiblePropertyKeys: new Set<string>(['reference']),
            visibleNavigationPropertyKeys: new Set<string>()
        });

        expect(markup).toContain('Tech Insights 2026 Week 11');
        expect(markup).not.toContain('nn-file-property-link');
        expect(markup).not.toContain('nn-clickable-tag');
    });

    it('uses the external link icon instead of custom property icons for external links', () => {
        mockMetadataService.getPropertyIcon.mockImplementation(() => 'star');

        const markup = renderPillRows({
            file: createTestTFile('Notes/Links.md'),
            isCompactMode: false,
            tags: [],
            properties: [
                {
                    fieldKey: 'Reference',
                    value: '[GitHub issue](https://github.com/johansan/notebook-navigator/issues/935)',
                    valueKind: 'string'
                }
            ],
            wordCount: null,
            notePropertyType: DEFAULT_SETTINGS.notePropertyType,
            settings: {
                ...DEFAULT_SETTINGS,
                showFileProperties: true,
                propertyIcons: { reference: 'star' }
            },
            visiblePropertyKeys: new Set<string>(['reference']),
            visibleNavigationPropertyKeys: new Set<string>()
        });

        expect(markup).toContain('data-icon-id="external-link"');
        expect(markup).not.toContain('data-icon-id="star"');
        expect(mockMetadataService.getPropertyIcon).not.toHaveBeenCalled();
    });

    it('does not show the external link icon when external links are disabled', () => {
        mockMetadataService.getPropertyIcon.mockImplementation(() => 'star');

        const markup = renderPillRows({
            file: createTestTFile('Notes/Links.md'),
            isCompactMode: false,
            tags: [],
            properties: [
                {
                    fieldKey: 'Reference',
                    value: '[GitHub issue](https://github.com/johansan/notebook-navigator/issues/935)',
                    valueKind: 'string'
                }
            ],
            wordCount: null,
            notePropertyType: DEFAULT_SETTINGS.notePropertyType,
            settings: {
                ...DEFAULT_SETTINGS,
                showFileProperties: true,
                enablePropertyExternalLinks: false,
                propertyIcons: { reference: 'star' }
            },
            visiblePropertyKeys: new Set<string>(['reference']),
            visibleNavigationPropertyKeys: new Set<string>()
        });

        expect(markup).not.toContain('data-icon-id="external-link"');
        expect(markup).toContain('data-icon-id="star"');
        expect(mockMetadataService.getPropertyIcon).toHaveBeenCalled();
    });
});
