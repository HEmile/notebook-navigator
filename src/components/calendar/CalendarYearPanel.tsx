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

import React from 'react';
import { strings } from '../../i18n';
import { ServiceIcon } from '../ServiceIcon';
import type { CalendarYearMonthEntry } from './types';

interface CalendarYearPanelProps {
    showYearCalendar: boolean;
    currentMonthKey: string | null;
    selectedYearValue: number;
    selectedMonthIndex: number;
    hasYearPeriodNote: boolean;
    yearMonthEntries: CalendarYearMonthEntry[];
    highlightedMonthImageUrls: Record<string, string>;
    onNavigateYear: (delta: number) => void;
    onYearPeriodClick: (event: React.MouseEvent<HTMLElement>) => void;
    onYearPeriodContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
    onSelectYearMonth: (event: React.MouseEvent<HTMLButtonElement>, date: CalendarYearMonthEntry['date']) => void;
}

export const CalendarYearPanel = React.memo(function CalendarYearPanel({
    showYearCalendar,
    currentMonthKey,
    selectedYearValue,
    selectedMonthIndex,
    hasYearPeriodNote,
    yearMonthEntries,
    highlightedMonthImageUrls,
    onNavigateYear,
    onYearPeriodClick,
    onYearPeriodContextMenu,
    onSelectYearMonth
}: CalendarYearPanelProps) {
    if (!showYearCalendar) {
        return null;
    }

    return (
        <>
            <div className="nn-navigation-calendar-year-nav">
                <button
                    type="button"
                    className="nn-navigation-calendar-nav-button nn-navigation-calendar-year-nav-button"
                    aria-label={strings.common.previous}
                    onClick={() => onNavigateYear(-1)}
                >
                    <ServiceIcon iconId="lucide-chevron-left" aria-hidden={true} />
                </button>
                <button
                    type="button"
                    className={[
                        'nn-navigation-calendar-year-label',
                        'nn-navigation-calendar-period-button',
                        hasYearPeriodNote ? 'has-period-note' : ''
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    aria-live="polite"
                    onClick={onYearPeriodClick}
                    onContextMenu={onYearPeriodContextMenu}
                >
                    {selectedYearValue}
                </button>
                <button
                    type="button"
                    className="nn-navigation-calendar-nav-button nn-navigation-calendar-year-nav-button"
                    aria-label={strings.common.next}
                    onClick={() => onNavigateYear(1)}
                >
                    <ServiceIcon iconId="lucide-chevron-right" aria-hidden={true} />
                </button>
            </div>

            <div className="nn-navigation-calendar-year-grid">
                {yearMonthEntries.map(entry => {
                    const isSelectedMonth = entry.monthIndex === selectedMonthIndex;
                    const isCurrentMonth = entry.key === currentMonthKey;
                    const featureImageUrl = highlightedMonthImageUrls[entry.key] ?? null;
                    const monthLabelText = entry.noteCount > 0 ? `${entry.shortLabel} (${entry.noteCount})` : entry.shortLabel;
                    const monthAriaLabel =
                        entry.noteCount > 0
                            ? `${entry.fullLabel} ${selectedYearValue} (${entry.noteCount})`
                            : `${entry.fullLabel} ${selectedYearValue}`;
                    const style: React.CSSProperties | undefined = featureImageUrl
                        ? { backgroundImage: `url(${featureImageUrl})` }
                        : undefined;

                    return (
                        <button
                            key={entry.key}
                            type="button"
                            className={[
                                'nn-navigation-calendar-year-month',
                                isCurrentMonth ? 'is-current-month' : '',
                                isSelectedMonth ? 'is-selected-month' : '',
                                featureImageUrl ? 'has-feature-image' : ''
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            aria-label={monthAriaLabel}
                            style={style}
                            onClick={event => onSelectYearMonth(event, entry.date)}
                        >
                            <span className="nn-navigation-calendar-year-month-label">{monthLabelText}</span>
                        </button>
                    );
                })}
            </div>
        </>
    );
});
