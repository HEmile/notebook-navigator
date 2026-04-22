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

import { useCallback, useEffect, useState } from 'react';
import type { ReleaseUpdateNotice } from '../services/ReleaseCheckService';
import { strings } from '../i18n';
import { useAutoDismissFade } from '../hooks/useAutoDismissFade';

/** Props for the UpdateNoticeBanner component */
interface UpdateNoticeBannerProps {
    notice: ReleaseUpdateNotice | null;
    onDismiss: (version: string) => void;
}

/**
 * Displays a temporary banner when a newer plugin release is available.
 */
export function UpdateNoticeBanner({ notice, onDismiss }: UpdateNoticeBannerProps) {
    const [visibleNotice, setVisibleNotice] = useState<ReleaseUpdateNotice | null>(null);

    // Update visible notice when a new notice arrives
    useEffect(() => {
        if (!notice) {
            return;
        }

        setVisibleNotice(notice);
    }, [notice]);

    // Callback to dismiss the banner and clear the visible notice
    const handleDismiss = useCallback(() => {
        if (!visibleNotice) {
            return;
        }

        onDismiss(visibleNotice.version);
        setVisibleNotice(null);
    }, [visibleNotice, onDismiss]);

    const handleOpenUpdatePage = useCallback(() => {
        window.open('obsidian://show-plugin?id=notebook-navigator');
        handleDismiss();
    }, [handleDismiss]);

    // Manages automatic fade-out animation and dismissal timing
    const { isVisible, isFading } = useAutoDismissFade({
        isActive: visibleNotice !== null,
        resetKey: visibleNotice?.version ?? null,
        onDismiss: handleDismiss
    });

    if (!isVisible || !visibleNotice) {
        return null;
    }

    const className = `nn-update-banner${isFading ? ' fade-out' : ''}`;

    return (
        <button
            type="button"
            className={className}
            onClick={handleOpenUpdatePage}
            aria-label={strings.common.updateBannerTitle}
            title={strings.common.updateBannerInstruction}
        >
            <div className="nn-update-banner__text">
                <span className="nn-update-banner__label">{strings.common.updateBannerTitle}</span>
                <span className="nn-update-banner__instruction">{strings.common.updateBannerInstruction}</span>
            </div>
        </button>
    );
}
