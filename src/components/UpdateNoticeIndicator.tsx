/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

// Imports
import { useCallback } from 'react';
import type { ReleaseUpdateNotice } from '../services/ReleaseCheckService';
import { strings } from '../i18n';
import { ObsidianIcon } from './ObsidianIcon';
import { useAutoDismissFade } from '../hooks/useAutoDismissFade';

// Types/Interfaces
interface UpdateNoticeIndicatorProps {
    notice: ReleaseUpdateNotice | null;
    isEnabled: boolean;
}

// Component
/**
 * Floating indicator button that appears when a new plugin version is available
 */
export function UpdateNoticeIndicator({ notice, isEnabled }: UpdateNoticeIndicatorProps) {
    // Hooks (state, context, refs)
    const noticeVersion = notice?.version ?? null;
    const shouldShowIndicator = isEnabled && notice !== null;
    // Controls auto-dismiss timing and fade animation state
    const { isVisible, isFading } = useAutoDismissFade({
        isActive: shouldShowIndicator,
        resetKey: noticeVersion
    });

    // Callbacks / handlers
    // Opens the plugin's page in Obsidian's plugin manager
    const handleClick = useCallback(() => {
        window.open('obsidian://show-plugin?id=notebook-navigator');
    }, []);

    // Render
    if (!isVisible) {
        return null;
    }

    return (
        <button
            type="button"
            className={`nn-update-indicator${isFading ? ' fade-out' : ''}`}
            onClick={handleClick}
            aria-label={strings.common.updateIndicatorLabel}
            title={strings.common.updateIndicatorLabel}
        >
            <ObsidianIcon name="lucide-arrow-up-circle" className="nn-update-indicator__icon" />
        </button>
    );
}
