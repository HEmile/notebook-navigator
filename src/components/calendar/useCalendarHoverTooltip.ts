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

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { IndexedDBStorage } from '../../storage/IndexedDBStorage';
import { runAsyncAction } from '../../utils/async';
import { DateUtils } from '../../utils/dateUtils';
import { getTooltipPlacement } from '../../utils/domUtils';
import { clamp } from './calendarUtils';
import type { CalendarHoverTooltipData, CalendarHoverTooltipState } from './types';

interface UseCalendarHoverTooltipOptions {
    db: IndexedDBStorage | null;
    dateFormat: string;
    isMobile: boolean;
    previewVersion: number;
}

interface UseCalendarHoverTooltipResult {
    hoverTooltip: CalendarHoverTooltipState | null;
    hoverTooltipStyle: React.CSSProperties | null;
    hoverTooltipRef: React.RefObject<HTMLDivElement | null>;
    hoverTooltipStateRef: React.RefObject<CalendarHoverTooltipState | null>;
    hoverTooltipPreviewText: string;
    shouldShowHoverTooltipPreview: boolean;
    hoverTooltipDateText: string;
    handleShowTooltip: (element: HTMLElement, tooltipData: CalendarHoverTooltipData) => void;
    handleHideTooltip: (element: HTMLElement) => void;
    clearHoverTooltip: () => void;
}

function isSameTooltipData(left: CalendarHoverTooltipData, right: CalendarHoverTooltipData): boolean {
    return (
        left.imageUrl === right.imageUrl &&
        left.title === right.title &&
        left.dateTimestamp === right.dateTimestamp &&
        left.previewPath === right.previewPath &&
        left.previewEnabled === right.previewEnabled &&
        left.showDate === right.showDate
    );
}

export function useCalendarHoverTooltip({
    db,
    dateFormat,
    isMobile,
    previewVersion
}: UseCalendarHoverTooltipOptions): UseCalendarHoverTooltipResult {
    const [hoverTooltip, setHoverTooltip] = useState<CalendarHoverTooltipState | null>(null);
    const [hoverTooltipStyle, setHoverTooltipStyle] = useState<React.CSSProperties | null>(null);
    const hoverTooltipRef = useRef<HTMLDivElement | null>(null);
    const hoverTooltipAnchorRef = useRef<HTMLElement | null>(null);
    const lastHoverTooltipPreviewVisibleRef = useRef<boolean | null>(null);
    const hoverTooltipStateRef = useRef<CalendarHoverTooltipState | null>(null);

    const hoverTooltipPreviewText = useMemo(() => {
        void previewVersion;
        if (!hoverTooltip || !db || !hoverTooltip.tooltipData.previewEnabled || !hoverTooltip.tooltipData.previewPath) {
            return '';
        }
        return db.getCachedPreviewText(hoverTooltip.tooltipData.previewPath);
    }, [db, hoverTooltip, previewVersion]);

    const shouldShowHoverTooltipPreview = hoverTooltipPreviewText.trim().length > 0;

    const hoverTooltipDateText =
        hoverTooltip && hoverTooltip.tooltipData.showDate ? DateUtils.formatDate(hoverTooltip.tooltipData.dateTimestamp, dateFormat) : '';

    const clearHoverTooltip = useCallback(() => {
        hoverTooltipAnchorRef.current = null;
        setHoverTooltipStyle(null);
        setHoverTooltip(null);
    }, []);

    useEffect(() => {
        hoverTooltipStateRef.current = hoverTooltip;
    }, [hoverTooltip]);

    const updateHoverTooltipPosition = useCallback(() => {
        if (!hoverTooltip) {
            setHoverTooltipStyle(null);
            return;
        }

        if (typeof window === 'undefined') {
            setHoverTooltipStyle(null);
            return;
        }

        if (!hoverTooltip.anchorEl.isConnected) {
            setHoverTooltip(null);
            setHoverTooltipStyle(null);
            return;
        }

        const tooltipElement = hoverTooltipRef.current;
        if (!tooltipElement) {
            setHoverTooltipStyle({
                top: 0,
                left: 0,
                transform: 'translateY(-50%)',
                visibility: 'hidden'
            });
            return;
        }

        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;

        const rect = hoverTooltip.anchorEl.getBoundingClientRect();
        const preferredPlacement = getTooltipPlacement();
        const offset = 10;
        const margin = 8;

        const rawCenterY = rect.top + rect.height / 2;
        const halfHeight = tooltipHeight / 2;
        const minCenterY = margin + halfHeight;
        const maxCenterY = window.innerHeight - margin - halfHeight;
        const centerY =
            Number.isFinite(minCenterY) && Number.isFinite(maxCenterY) && maxCenterY >= minCenterY
                ? clamp(rawCenterY, minCenterY, maxCenterY)
                : clamp(rawCenterY, margin, window.innerHeight - margin);

        const availableRight = window.innerWidth - rect.right - margin;
        const availableLeft = rect.left - margin;
        const requiredWidth = tooltipWidth + offset;

        const fitsRight = availableRight >= requiredWidth;
        const fitsLeft = availableLeft >= requiredWidth;

        let placement: 'left' | 'right' = preferredPlacement;
        if (preferredPlacement === 'right' && !fitsRight && fitsLeft) {
            placement = 'left';
        } else if (preferredPlacement === 'left' && !fitsLeft && fitsRight) {
            placement = 'right';
        } else if (!fitsLeft && !fitsRight) {
            placement = availableRight >= availableLeft ? 'right' : 'left';
        }

        const minLeft = margin;
        const maxLeft = window.innerWidth - margin - tooltipWidth;
        let left: number = placement === 'right' ? rect.right + offset : rect.left - offset - tooltipWidth;
        if (Number.isFinite(minLeft) && Number.isFinite(maxLeft) && maxLeft >= minLeft) {
            left = clamp(left, minLeft, maxLeft);
        }

        setHoverTooltipStyle({
            top: centerY,
            left,
            transform: 'translateY(-50%)',
            visibility: 'visible'
        });
    }, [hoverTooltip]);

    useLayoutEffect(() => {
        updateHoverTooltipPosition();
    }, [updateHoverTooltipPosition]);

    useLayoutEffect(() => {
        if (!hoverTooltip || isMobile) {
            lastHoverTooltipPreviewVisibleRef.current = null;
            return;
        }

        const previous = lastHoverTooltipPreviewVisibleRef.current;
        lastHoverTooltipPreviewVisibleRef.current = shouldShowHoverTooltipPreview;

        if (previous === null || previous === shouldShowHoverTooltipPreview) {
            return;
        }

        updateHoverTooltipPosition();
    }, [hoverTooltip, isMobile, shouldShowHoverTooltipPreview, updateHoverTooltipPosition]);

    useEffect(() => {
        if (!hoverTooltip) {
            return;
        }

        if (typeof window === 'undefined') {
            return;
        }

        let frameId: number | null = null;

        const schedulePositionUpdate = () => {
            if (frameId !== null) {
                return;
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                updateHoverTooltipPosition();
            });
        };

        window.addEventListener('resize', schedulePositionUpdate);
        window.addEventListener('scroll', schedulePositionUpdate, true);

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener('resize', schedulePositionUpdate);
            window.removeEventListener('scroll', schedulePositionUpdate, true);
        };
    }, [hoverTooltip, updateHoverTooltipPosition]);

    const handleShowTooltip = useCallback(
        (element: HTMLElement, tooltipData: CalendarHoverTooltipData) => {
            if (hoverTooltipAnchorRef.current !== element) {
                hoverTooltipAnchorRef.current = element;
                setHoverTooltipStyle(null);
            }

            const existing = hoverTooltipStateRef.current;
            const current = existing && existing.anchorEl === element ? existing.tooltipData : null;
            const isUnchanged = current !== null && isSameTooltipData(current, tooltipData);

            const previewPath = tooltipData.previewPath;
            if (!isUnchanged && tooltipData.previewEnabled && previewPath && db) {
                runAsyncAction(() => db.ensurePreviewTextLoaded(previewPath));
            }

            setHoverTooltip(existingTooltip => {
                if (existingTooltip && existingTooltip.anchorEl === element) {
                    const currentTooltip = existingTooltip.tooltipData;
                    if (isSameTooltipData(currentTooltip, tooltipData)) {
                        return existingTooltip;
                    }
                }

                return { anchorEl: element, tooltipData };
            });
        },
        [db]
    );

    const handleHideTooltip = useCallback((element: HTMLElement) => {
        if (hoverTooltipAnchorRef.current === element) {
            hoverTooltipAnchorRef.current = null;
            setHoverTooltipStyle(null);
        }

        setHoverTooltip(existingTooltip => {
            if (!existingTooltip || existingTooltip.anchorEl !== element) {
                return existingTooltip;
            }
            return null;
        });
    }, []);

    return {
        hoverTooltip,
        hoverTooltipStyle,
        hoverTooltipRef,
        hoverTooltipStateRef,
        hoverTooltipPreviewText,
        shouldShowHoverTooltipPreview,
        hoverTooltipDateText,
        handleShowTooltip,
        handleHideTooltip,
        clearHoverTooltip
    };
}
