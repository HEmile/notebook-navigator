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

import type { NotebookNavigatorSettings } from '../../settings/types';
import { normalizeCanonicalIconId } from '../../utils/iconizeFormat';
import { ensureRecord, isStringRecordValue } from '../../utils/recordUtils';
import { normalizeTagPath } from '../../utils/tagUtils';
import { BaseMetadataService } from './BaseMetadataService';

type TopicStyleRecordKey = 'topicColors' | 'topicBackgroundColors' | 'topicIcons';

/** Tag style records that older fork versions stored topic styles in, with their topic counterparts */
const LEGACY_TOPIC_STYLE_RECORDS: readonly [TopicStyleRecordKey, 'tagColors' | 'tagBackgroundColors' | 'tagIcons'][] = [
    ['topicColors', 'tagColors'],
    ['topicBackgroundColors', 'tagBackgroundColors'],
    ['topicIcons', 'tagIcons']
];

/**
 * Topic styles are keyed like tags: trimmed, without a leading '#', lowercase. Using the tag normalization keeps
 * the keys identical to the ones older fork versions wrote into the tag records, so the migration copies them as is.
 */
export function normalizeTopicStyleKey(topicName: string): string | null {
    return normalizeTagPath(topicName);
}

/**
 * Colors, background colors and icons of topics. They live in their own settings records so that tag cleanup,
 * tag renames and tag deletions never touch them, and a topic and a tag with the same name style independently.
 */
export class TopicMetadataService extends BaseMetadataService {
    getTopicColor(topicName: string): string | undefined {
        return this.getStyle('topicColors', topicName);
    }

    getTopicBackgroundColor(topicName: string): string | undefined {
        return this.getStyle('topicBackgroundColors', topicName);
    }

    getTopicIcon(topicName: string): string | undefined {
        return this.getStyle('topicIcons', topicName);
    }

    async setTopicColor(topicName: string, color: string): Promise<void> {
        if (!this.validateColor(color)) {
            return;
        }
        await this.setStyle('topicColors', topicName, color);
    }

    async setTopicBackgroundColor(topicName: string, color: string): Promise<void> {
        if (!this.validateColor(color)) {
            return;
        }
        await this.setStyle('topicBackgroundColors', topicName, color);
    }

    async setTopicIcon(topicName: string, iconId: string): Promise<void> {
        const normalizedIcon = normalizeCanonicalIconId(iconId);
        if (!normalizedIcon) {
            return;
        }
        await this.setStyle('topicIcons', topicName, normalizedIcon);
    }

    async removeTopicColor(topicName: string): Promise<void> {
        await this.removeStyle('topicColors', topicName);
    }

    async removeTopicBackgroundColor(topicName: string): Promise<void> {
        await this.removeStyle('topicBackgroundColors', topicName);
    }

    async removeTopicIcon(topicName: string): Promise<void> {
        await this.removeStyle('topicIcons', topicName);
    }

    /**
     * Copies topic styles that older fork versions stored in the tag records into the topic records, once.
     * Entries are copied, not moved: a tag with the same name keeps the style it shared until now, and tag
     * cleanup removes the copies that belong to no tag. Existing topic styles are never overwritten.
     *
     * @returns True when settings changed
     */
    async migrateTopicStylesFromTags(topicNames: Iterable<string>): Promise<boolean> {
        if (this.settingsProvider.settings.topicStylesMigrated) {
            return false;
        }

        const keys = new Set<string>();
        for (const topicName of topicNames) {
            const key = normalizeTopicStyleKey(topicName);
            if (key) {
                keys.add(key);
            }
        }

        await this.saveAndUpdate(settings => {
            copyLegacyTopicStyles(settings, keys);
            settings.topicStylesMigrated = true;
        });
        return true;
    }

    private getStyle(recordKey: TopicStyleRecordKey, topicName: string): string | undefined {
        const key = normalizeTopicStyleKey(topicName);
        return key ? this.settingsProvider.settings[recordKey]?.[key] : undefined;
    }

    private async setStyle(recordKey: TopicStyleRecordKey, topicName: string, value: string): Promise<void> {
        const key = normalizeTopicStyleKey(topicName);
        if (!key) {
            return;
        }
        await this.saveAndUpdate(settings => {
            const record = ensureRecord(settings[recordKey], isStringRecordValue);
            record[key] = value;
            settings[recordKey] = record;
        });
    }

    private async removeStyle(recordKey: TopicStyleRecordKey, topicName: string): Promise<void> {
        const key = normalizeTopicStyleKey(topicName);
        const record = this.settingsProvider.settings[recordKey];
        if (!key || !record || !(key in record)) {
            return;
        }
        await this.saveAndUpdate(settings => {
            const mutableRecord = settings[recordKey];
            if (mutableRecord) {
                delete mutableRecord[key];
            }
        });
    }
}

/** Copies tag-record styles for the given topic keys into the topic records, keeping existing topic styles */
export function copyLegacyTopicStyles(settings: NotebookNavigatorSettings, topicKeys: ReadonlySet<string>): void {
    for (const [topicRecordKey, tagRecordKey] of LEGACY_TOPIC_STYLE_RECORDS) {
        const source = settings[tagRecordKey];
        if (!source) {
            continue;
        }
        const target = ensureRecord(settings[topicRecordKey], isStringRecordValue);
        for (const key of topicKeys) {
            const value = source[key];
            if (typeof value === 'string' && !(key in target)) {
                target[key] = value;
            }
        }
        settings[topicRecordKey] = target;
    }
}
