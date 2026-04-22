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

import { requestUrl } from 'obsidian';
import { NOTEBOOK_NAVIGATOR_RELEASE_CHECK_URL } from '../constants/urls';
import { compareVersions } from '../releaseNotes';
import NotebookNavigatorPlugin from '../main';

/** Represents a newer release that should be announced to the user */
export interface ReleaseUpdateNotice {
    version: string;
    publishedAt: string;
    url: string;
}

/** Response structure from GitHub's release API endpoint */
interface GithubReleaseResponse {
    tag_name: string;
    html_url: string;
    published_at: string;
    draft: boolean;
    prerelease: boolean;
}

/** Minimum time between release checks (24 hours) */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Checks GitHub releases to determine if a newer plugin version exists.
 * Persists metadata about release check timestamps.
 */
export default class ReleaseCheckService {
    private plugin: NotebookNavigatorPlugin;
    private pendingNotice: ReleaseUpdateNotice | null = null;
    private isChecking = false;

    constructor(plugin: NotebookNavigatorPlugin) {
        this.plugin = plugin;
    }

    /**
     * Returns the last notice produced by the release check.
     */
    public getPendingNotice(): ReleaseUpdateNotice | null {
        return this.pendingNotice;
    }

    /**
     * Clears the in-memory notice after the UI has acknowledged it.
     */
    public clearPendingNotice(): void {
        this.pendingNotice = null;
    }

    /**
     * Checks for a newer release if the minimum interval has passed.
     * Returns the pending notice when a fresh check finds a newer version.
     */
    public async checkForUpdates(force = false): Promise<ReleaseUpdateNotice | null> {
        // Prevent concurrent checks
        if (this.isChecking) {
            return this.pendingNotice;
        }

        // Skip check if minimum interval hasn't passed (unless forced)
        const now = Date.now();
        const lastCheck = this.plugin.getReleaseCheckTimestamp() ?? 0;
        if (!force && lastCheck && now - lastCheck < CHECK_INTERVAL_MS) {
            this.pendingNotice = null;
            return this.pendingNotice;
        }

        this.isChecking = true;
        try {
            const release = await this.fetchLatestRelease();

            // Update last check timestamp after a fresh check attempt
            this.plugin.setReleaseCheckTimestamp(now);

            // Compare versions if we have a release payload
            if (release) {
                const currentVersion = this.plugin.manifest.version;
                const comparison = compareVersions(release.version, currentVersion);

                // Create notice if a newer version exists
                if (comparison > 0) {
                    this.pendingNotice = {
                        version: release.version,
                        publishedAt: release.publishedAt,
                        url: release.url
                    };
                } else {
                    this.pendingNotice = null;
                }
            } else {
                this.pendingNotice = null;
            }

            return this.pendingNotice;
        } catch {
            this.pendingNotice = null;
            return this.pendingNotice;
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Fetches the latest release from GitHub API.
     * Returns null if the request fails, or if the release is a draft or prerelease.
     */
    private async fetchLatestRelease(): Promise<ReleaseUpdateNotice | null> {
        const response = await requestUrl({
            url: NOTEBOOK_NAVIGATOR_RELEASE_CHECK_URL,
            method: 'GET',
            headers: {
                'User-Agent': 'NotebookNavigator/ReleaseCheck (Obsidian Plugin)',
                Accept: 'application/vnd.github+json'
            },
            throw: false
        });

        // Validate response status and payload
        if (response.status !== 200 || !response.json) {
            return null;
        }

        const json = response.json as GithubReleaseResponse;
        // Skip drafts and prereleases
        if (!json || json.draft || json.prerelease) {
            return null;
        }

        // Extract and normalize version from tag
        const cleanVersion = this.normalizeVersion(json.tag_name);
        if (!cleanVersion) {
            return null;
        }

        return {
            version: cleanVersion,
            publishedAt: json.published_at ?? '',
            url: json.html_url
        };
    }

    /**
     * Removes 'v' prefix from version tags (e.g., "v1.2.3" -> "1.2.3").
     */
    private normalizeVersion(tag: string): string {
        return tag.replace(/^v/i, '').trim();
    }
}
