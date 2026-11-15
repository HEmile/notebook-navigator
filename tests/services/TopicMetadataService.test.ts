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

import { describe, expect, it, vi } from 'vitest';
import { App } from 'obsidian';
import { TopicMetadataService } from '../../src/services/metadata/TopicMetadataService';
import type { ISettingsProvider } from '../../src/interfaces/ISettingsProvider';
import type { NotebookNavigatorSettings } from '../../src/settings';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { CollapsedPinnedContexts } from '../../src/types';

class TestSettingsProvider implements ISettingsProvider {
    constructor(public settings: NotebookNavigatorSettings) {}

    saveSettingsAndUpdate = vi.fn().mockResolvedValue(undefined);

    notifySettingsUpdate(): void {}

    getRecentNotes(): string[] {
        return [];
    }

    setRecentNotes(): void {}

    getRecentIcons(): Record<string, string[]> {
        return {};
    }

    setRecentIcons(): void {}

    getCollapsedPinnedContexts(): CollapsedPinnedContexts {
        return {};
    }

    updateCollapsedPinnedContexts(): boolean {
        return false;
    }

    getRecentColors(): string[] {
        return [];
    }

    setRecentColors(): void {}
}

function createService(overrides: Partial<NotebookNavigatorSettings> = {}) {
    const settings: NotebookNavigatorSettings = {
        ...DEFAULT_SETTINGS,
        tagColors: {},
        tagBackgroundColors: {},
        tagIcons: {},
        topicColors: {},
        topicBackgroundColors: {},
        topicIcons: {},
        topicStylesMigrated: false,
        ...overrides
    };
    const provider = new TestSettingsProvider(settings);
    return { service: new TopicMetadataService(new App(), provider), settings, provider };
}

describe('TopicMetadataService styles', () => {
    it('stores topic styles in the topic records, keyed case-insensitively, and leaves tag records alone', async () => {
        const { service, settings } = createService({ tagColors: { python: '#111111' } });

        await service.setTopicColor('Python', '#ff0000');
        await service.setTopicBackgroundColor('Python', '#00ff00');
        await service.setTopicIcon('Python', 'lucide-code');

        expect(settings.topicColors).toEqual({ python: '#ff0000' });
        expect(settings.topicBackgroundColors).toEqual({ python: '#00ff00' });
        expect(service.getTopicColor('PYTHON')).toBe('#ff0000');
        expect(service.getTopicIcon('python')).toBeTruthy();
        expect(settings.tagColors).toEqual({ python: '#111111' });
    });

    it('removes topic styles without touching a same-named tag style', async () => {
        const { service, settings } = createService({ tagColors: { python: '#111111' }, topicColors: { python: '#ff0000' } });

        await service.removeTopicColor('Python');

        expect(service.getTopicColor('Python')).toBeUndefined();
        expect(settings.tagColors).toEqual({ python: '#111111' });
    });

    it('rejects invalid colors', async () => {
        const { service, provider } = createService();
        await service.setTopicColor('Python', 'not a color!');
        expect(service.getTopicColor('Python')).toBeUndefined();
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});

describe('TopicMetadataService migration', () => {
    it('copies styles of known topics from the tag records once, keeping existing topic styles', async () => {
        const { service, settings, provider } = createService({
            tagColors: { 'machine learning': '#ff0000', python: '#0000ff', inbox: '#00ff00' },
            tagBackgroundColors: { 'machine learning': '#eeeeee' },
            tagIcons: { 'machine learning': 'lucide-brain' },
            topicColors: { python: '#123456' }
        });

        const changed = await service.migrateTopicStylesFromTags(['Machine Learning', 'Python']);

        expect(changed).toBe(true);
        expect(settings.topicColors).toEqual({ 'machine learning': '#ff0000', python: '#123456' });
        expect(settings.topicBackgroundColors).toEqual({ 'machine learning': '#eeeeee' });
        expect(settings.topicIcons).toEqual({ 'machine learning': 'lucide-brain' });
        // Copied, not moved: the tag records are unchanged, and tags that are not topics are not copied
        expect(settings.tagColors).toEqual({ 'machine learning': '#ff0000', python: '#0000ff', inbox: '#00ff00' });
        expect(settings.topicStylesMigrated).toBe(true);
        expect(provider.saveSettingsAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('does nothing after the first migration', async () => {
        const { service, settings, provider } = createService({ tagColors: { python: '#0000ff' }, topicStylesMigrated: true });

        const changed = await service.migrateTopicStylesFromTags(['Python']);

        expect(changed).toBe(false);
        expect(settings.topicColors).toEqual({});
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});

describe('TopicMetadataService rename', () => {
    it('moves every topic-keyed setting to the new name', async () => {
        const { service, settings, provider } = createService({
            topicSortOverrides: { Physics: 'title-asc' } as never,
            topicAppearances: { Physics: { mode: 'compact' } } as never,
            topicColors: { physics: '#ff0000' },
            topicIcons: { physics: 'lucide-atom' },
            hiddenTopics: ['Physics', 'Inbox'],
            rootTopicOrder: ['Science', 'Physics'],
            navigationSeparators: { 'topic:physics': true }
        });
        settings.vaultProfiles[0].shortcuts = [{ type: 'topic', topicName: 'Physics' } as never];
        const collapsed: Record<string, boolean> = { 'topic:Physics': true };
        provider.updateCollapsedPinnedContexts = (mutate: (record: Record<string, boolean>) => boolean) => mutate(collapsed);

        await service.handleTopicRename('Physics', 'Natural Philosophy');

        expect(settings.topicSortOverrides).toEqual({ 'Natural Philosophy': 'title-asc' });
        expect(settings.topicAppearances).toEqual({ 'Natural Philosophy': { mode: 'compact' } });
        expect(settings.topicColors).toEqual({ 'natural philosophy': '#ff0000' });
        expect(settings.topicIcons).toEqual({ 'natural philosophy': 'lucide-atom' });
        expect(settings.hiddenTopics).toEqual(['Natural Philosophy', 'Inbox']);
        expect(settings.rootTopicOrder).toEqual(['Science', 'Natural Philosophy']);
        expect(settings.navigationSeparators).toEqual({ 'topic:natural philosophy': true });
        expect(settings.vaultProfiles[0].shortcuts).toEqual([{ type: 'topic', topicName: 'Natural Philosophy' }]);
        expect(collapsed).toEqual({ 'topic:Natural Philosophy': true });
    });

    it('keeps an entry already stored under the new name, and skips saving when nothing changes', async () => {
        const { service, settings, provider } = createService({ topicColors: { physics: '#ff0000', optics: '#00ff00' } });
        await service.handleTopicRename('Physics', 'Optics');
        expect(settings.topicColors).toEqual({ optics: '#00ff00' });

        provider.saveSettingsAndUpdate.mockClear();
        await service.handleTopicRename('Unknown', 'Other');
        expect(provider.saveSettingsAndUpdate).not.toHaveBeenCalled();
    });
});
