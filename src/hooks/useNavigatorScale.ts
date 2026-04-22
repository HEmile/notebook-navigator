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

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { sanitizeUIScale, DEFAULT_UI_SCALE } from '../utils/uiScale';

interface NavigatorScaleOptions {
    isMobile: boolean;
    desktopScale: number | null | undefined;
    mobileScale: number | null | undefined;
}

interface NavigatorScaleResult {
    scale: number;
    style?: CSSProperties;
    dataAttr?: string;
}

/**
 * Computes memoized scale props for wrapping the navigator so panes render at
 * the requested zoom level without duplicating style logic in each component.
 */
export function useNavigatorScale({ isMobile, desktopScale, mobileScale }: NavigatorScaleOptions): NavigatorScaleResult {
    return useMemo(() => {
        const scale = sanitizeUIScale(isMobile ? mobileScale : desktopScale);
        if (scale === DEFAULT_UI_SCALE) {
            return { scale };
        }

        const value = scale.toString();
        const style: CSSProperties = { '--nn-ui-scale': value } as CSSProperties;

        return {
            scale,
            style,
            dataAttr: value
        };
    }, [desktopScale, isMobile, mobileScale]);
}
