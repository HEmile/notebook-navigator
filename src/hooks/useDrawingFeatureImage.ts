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

import { useEffect, useMemo, useState } from 'react';
import type { App, TFile } from 'obsidian';
import {
    getDrawingFeatureImageSource,
    resolveDrawingFeatureImageFileForProvider,
    subscribeDrawingFeatureImageChange,
    type DrawingFeatureImageSource
} from '../utils/drawingFeatureImages';
import { useThemeMode } from './useThemeMode';
import { getVersionedResourcePath } from '../utils/resourcePath';

export interface DrawingFeatureImageState {
    isDrawing: boolean;
    showsFeatureImageBox: boolean;
    supportsCompanionImages: boolean;
    isMissing: boolean;
    iconId: string | null;
    key: string | null;
    url: string | null;
}

export function useDrawingFeatureImage(params: {
    app: App;
    file: TFile;
    enabled: boolean;
    source?: DrawingFeatureImageSource | null;
    metadataVersion: number;
}): DrawingFeatureImageState {
    const { app, file, enabled, source: sourceOverride, metadataVersion } = params;
    const [changeVersion, setChangeVersion] = useState(0);
    const hasSourceOverride = sourceOverride !== undefined;
    const sourceProviderId = sourceOverride?.providerId ?? null;
    const sourceIconId = sourceOverride?.iconId ?? null;
    const sourceShowsFeatureImageBox = sourceOverride?.showsFeatureImageBox ?? false;
    const sourceSupportsCompanionImages = sourceOverride?.supportsCompanionImages ?? false;
    const source = useMemo(() => {
        void metadataVersion;
        if (hasSourceOverride) {
            if (sourceProviderId === null || sourceIconId === null) {
                return null;
            }
            return {
                providerId: sourceProviderId,
                iconId: sourceIconId,
                showsFeatureImageBox: sourceShowsFeatureImageBox,
                supportsCompanionImages: sourceSupportsCompanionImages
            };
        }
        return getDrawingFeatureImageSource(app, file);
    }, [
        app,
        file,
        hasSourceOverride,
        metadataVersion,
        sourceIconId,
        sourceProviderId,
        sourceShowsFeatureImageBox,
        sourceSupportsCompanionImages
    ]);
    const shouldResolveCompanionImage = enabled && source !== null && source.supportsCompanionImages;
    const themeMode = useThemeMode(app, shouldResolveCompanionImage);

    useEffect(() => {
        if (!shouldResolveCompanionImage) {
            return;
        }

        return subscribeDrawingFeatureImageChange(file.path, () => {
            setChangeVersion(version => version + 1);
        });
    }, [file.path, shouldResolveCompanionImage]);

    return useMemo(() => {
        if (!enabled || !source) {
            return {
                isDrawing: Boolean(source),
                showsFeatureImageBox: false,
                supportsCompanionImages: false,
                isMissing: false,
                iconId: source?.iconId ?? null,
                key: null,
                url: null
            };
        }

        if (!source.supportsCompanionImages) {
            return {
                isDrawing: true,
                showsFeatureImageBox: source.showsFeatureImageBox,
                supportsCompanionImages: false,
                isMissing: source.showsFeatureImageBox,
                iconId: source.iconId,
                key: source.showsFeatureImageBox ? `${file.path}:placeholder:${source.providerId}` : null,
                url: null
            };
        }

        const companionImage = resolveDrawingFeatureImageFileForProvider(app, file, source.providerId, themeMode);
        if (!companionImage) {
            return {
                isDrawing: true,
                showsFeatureImageBox: source.showsFeatureImageBox,
                supportsCompanionImages: true,
                isMissing: true,
                iconId: source.iconId,
                key: `${file.path}:missing:${themeMode}:${changeVersion}`,
                url: null
            };
        }

        let url: string | null = null;
        try {
            url = getVersionedResourcePath(app, companionImage);
        } catch {
            url = null;
        }

        return {
            isDrawing: true,
            showsFeatureImageBox: source.showsFeatureImageBox,
            supportsCompanionImages: true,
            isMissing: url === null,
            iconId: source.iconId,
            key: `${companionImage.path}@${companionImage.stat.mtime}:${themeMode}:${changeVersion}`,
            url
        };
    }, [app, changeVersion, enabled, file, source, themeMode]);
}
