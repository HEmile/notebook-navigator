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

import { useEffect, useState } from 'react';
import { UPDATE_NOTICE_DISPLAY_DURATION_MS, UPDATE_NOTICE_FADE_DURATION_MS } from '../constants/updateNotice';

interface AutoDismissOptions {
    isActive: boolean;
    resetKey?: unknown;
    onDismiss?: () => void;
}

interface AutoDismissState {
    isVisible: boolean;
    isFading: boolean;
}

/**
 * Manages show/fade transitions for temporary notices with shared timing.
 */
export function useAutoDismissFade({ isActive, resetKey, onDismiss }: AutoDismissOptions): AutoDismissState {
    const [isVisible, setIsVisible] = useState(false);
    const [isFading, setIsFading] = useState(false);

    // Controls visibility and starts fade timer when component becomes active
    useEffect(() => {
        if (!isActive) {
            setIsVisible(false);
            setIsFading(false);
            return;
        }

        setIsVisible(true);
        setIsFading(false);

        // Start fade animation after display duration
        const displayTimer = window.setTimeout(() => {
            setIsFading(true);
        }, UPDATE_NOTICE_DISPLAY_DURATION_MS);

        return () => {
            window.clearTimeout(displayTimer);
        };
    }, [isActive, resetKey]);

    // Handles dismissal after fade animation completes
    useEffect(() => {
        if (!isVisible || !isFading) {
            return;
        }

        const fadeTimer = window.setTimeout(() => {
            if (onDismiss) {
                onDismiss();
            }

            setIsVisible(false);
            setIsFading(false);
        }, UPDATE_NOTICE_FADE_DURATION_MS);

        return () => {
            window.clearTimeout(fadeTimer);
        };
    }, [isVisible, isFading, onDismiss]);

    return {
        isVisible,
        isFading
    };
}
