/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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
import { describe, expect, it, vi } from 'vitest';
import { TopicTreeItem } from '../../src/components/TopicTreeItem';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { TopicNode } from '../../src/types/storage';

vi.mock('../../src/context/SettingsContext', () => ({
    useSettingsState: () => ({ ...DEFAULT_SETTINGS, showTopicIcons: true, separateNoteCounts: true })
}));
vi.mock('../../src/context/UXPreferencesContext', () => ({
    useUXPreferences: () => ({ includeDescendantNotes: true, showHiddenItems: false })
}));
vi.mock('../../src/hooks/useContextMenu', () => ({ useContextMenu: vi.fn() }));
vi.mock('../../src/services/icons', () => ({ useIconServiceVersion: () => 0, getIconService: () => ({ renderIcon: vi.fn() }) }));

function topic(name: string, children: TopicNode[] = []): TopicNode {
    return {
        name,
        parents: new Map(),
        children: new Map(children.map(child => [child.name, child])),
        notesWithTag: new Set()
    };
}

function render(props: Partial<React.ComponentProps<typeof TopicTreeItem>> = {}): string {
    return renderToStaticMarkup(
        React.createElement(TopicTreeItem, {
            topicNode: topic('Physics', [topic('Optics')]),
            topicPath: 'Science/Physics',
            level: 2,
            isExpanded: true,
            isSelected: false,
            onToggle: vi.fn(),
            onClick: vi.fn(),
            showFileCount: true,
            countInfo: { current: 3, descendants: 5, total: 8 },
            ...props
        })
    );
}

describe('TopicTreeItem', () => {
    it('marks a custom background so the row actually shows it', () => {
        const html = render({ backgroundColor: '#ffeeaa' });
        expect(html).toContain('nn-has-custom-background');
        expect(html).toContain('--nn-navitem-custom-bg-color:#ffeeaa');
    });

    it('colors the name, not the row, when a color is set', () => {
        const html = render({ color: '#ff0000' });
        expect(html).toMatch(/class="nn-navitem-name nn-has-custom-color"[^>]*style="color:#ff0000"/);
    });

    it('formats counts like tags, with separate descendant counts', () => {
        expect(render()).toContain('<span class="nn-navitem-count">3 • 5</span>');
    });

    it('hides the count when there are no notes', () => {
        expect(render({ countInfo: { current: 0, descendants: 0, total: 0 } })).not.toContain('nn-navitem-count');
    });

    it('exposes tree item semantics', () => {
        const html = render({ isSelected: true });
        expect(html).toContain('role="treeitem"');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('aria-level="3"');
        expect(html).toContain('nn-selected');
        expect(html).toContain('data-path="Science/Physics"');
    });

    it('is draggable only when allowed', () => {
        expect(render({ isDraggable: true })).toContain('draggable="true"');
        expect(render()).toContain('draggable="false"');
    });
});
