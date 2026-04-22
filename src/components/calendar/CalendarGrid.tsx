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
import type { TFile } from 'obsidian';
import type { CalendarWeekendDays } from '../../settings/types';
import { DateUtils } from '../../utils/dateUtils';
import { CalendarDayButton } from './CalendarDayButton';
import { isWeekendDay } from './calendarUtils';
import type { CalendarDay, CalendarHoverTooltipData, CalendarWeek } from './types';

interface CalendarGridProps {
    activeEditorFilePath: string | null;
    showWeekNumbers: boolean;
    weekdays: string[];
    weekStartsOn: number;
    trailingSpacerWeekCount: number;
    weeks: CalendarWeek[];
    weekNotesEnabled: boolean;
    weekNoteFilesByKey: Map<string, TFile | null>;
    weekUnfinishedTaskCountByKey: Map<string, number>;
    displayLocale: string;
    calendarWeekendDays: CalendarWeekendDays;
    todayIso: string | null;
    unfinishedTaskCountByIso: Map<string, number>;
    featureImageUrls: Record<string, string>;
    featureImageKeysByIso: Map<string, string>;
    frontmatterTitlesByPath: Map<string, string>;
    dateFormat: string;
    isMobile: boolean;
    canCreateDayNotes: boolean;
    onShowTooltip: (element: HTMLElement, tooltipData: CalendarHoverTooltipData) => void;
    onHideTooltip: (element: HTMLElement) => void;
    onDayClick: (event: React.MouseEvent<HTMLButtonElement>, day: CalendarDay) => void;
    onDayContextMenu: (event: React.MouseEvent<HTMLButtonElement>, day: CalendarDay, canCreate: boolean) => void;
    onWeekClick: (event: React.MouseEvent<HTMLElement>, week: CalendarWeek, weekNoteFile: TFile | null) => void;
    onWeekLabelClick: (event: React.MouseEvent<HTMLElement>, week: CalendarWeek) => void;
    onWeekContextMenu: (event: React.MouseEvent<HTMLElement>, week: CalendarWeek, weekNoteFile: TFile | null) => void;
}

export const CalendarGrid = React.memo(function CalendarGrid({
    activeEditorFilePath,
    showWeekNumbers,
    weekdays,
    weekStartsOn,
    trailingSpacerWeekCount,
    weeks,
    weekNotesEnabled,
    weekNoteFilesByKey,
    weekUnfinishedTaskCountByKey,
    displayLocale,
    calendarWeekendDays,
    todayIso,
    unfinishedTaskCountByIso,
    featureImageUrls,
    featureImageKeysByIso,
    frontmatterTitlesByPath,
    dateFormat,
    isMobile,
    canCreateDayNotes,
    onShowTooltip,
    onHideTooltip,
    onDayClick,
    onDayContextMenu,
    onWeekClick,
    onWeekLabelClick,
    onWeekContextMenu
}: CalendarGridProps) {
    return (
        <div className="nn-navigation-calendar-grid" data-weeknumbers={showWeekNumbers ? 'true' : undefined}>
            <div className="nn-navigation-calendar-weekdays" data-weeknumbers={showWeekNumbers ? 'true' : undefined}>
                {showWeekNumbers ? <div className="nn-navigation-calendar-weeknumber-spacer" /> : null}
                {showWeekNumbers ? <div className="nn-navigation-calendar-weeknumber-divider" aria-hidden="true" /> : null}
                {weekdays.map((day, index) => (
                    <div key={(weekStartsOn + index) % 7} className="nn-navigation-calendar-weekday">
                        {day}
                    </div>
                ))}
            </div>

            <div className="nn-navigation-calendar-weeks" data-weeknumbers={showWeekNumbers ? 'true' : undefined}>
                {weeks.map((week, weekIndex) => {
                    const weekNoteFile = weekNoteFilesByKey.get(week.key) ?? null;
                    const weekHasUnfinishedTasks = (weekUnfinishedTaskCountByKey.get(week.key) ?? 0) > 0;
                    const isActiveEditorWeek = Boolean(weekNoteFile && activeEditorFilePath === weekNoteFile.path);
                    const previousWeek = weekIndex > 0 ? weeks[weekIndex - 1] : null;
                    const nextWeek = weekIndex < weeks.length - 1 ? weeks[weekIndex + 1] : null;

                    return (
                        <div
                            key={week.key}
                            className={`nn-navigation-calendar-week${weekIndex < weeks.length - 1 ? ' has-next-week' : ''}`}
                        >
                            {showWeekNumbers ? (
                                <>
                                    {weekNotesEnabled ? (
                                        <button
                                            type="button"
                                            className={[
                                                'nn-navigation-calendar-weeknumber',
                                                'nn-navigation-calendar-weeknumber-button',
                                                weekNoteFile ? 'has-period-note' : '',
                                                isActiveEditorWeek ? 'is-active-editor-file' : '',
                                                weekHasUnfinishedTasks ? 'has-unfinished-tasks' : ''
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            onClick={event => onWeekClick(event, week, weekNoteFile)}
                                            onContextMenu={event => onWeekContextMenu(event, week, weekNoteFile)}
                                        >
                                            <span className="nn-navigation-calendar-weeknumber-value">{week.weekNumber}</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="nn-navigation-calendar-weeknumber nn-navigation-calendar-weeknumber-button"
                                            onClick={event => onWeekLabelClick(event, week)}
                                            onContextMenu={event => onWeekContextMenu(event, week, null)}
                                        >
                                            <span className="nn-navigation-calendar-weeknumber-value">{week.weekNumber}</span>
                                        </button>
                                    )}
                                    <div className="nn-navigation-calendar-weeknumber-divider" aria-hidden="true" />
                                </>
                            ) : null}
                            {week.days.map((day, dayIndex) => {
                                const dayNumber = day.date.date();
                                const hasDailyNote = Boolean(day.file);
                                const dayUnfinishedTaskCount = hasDailyNote ? (unfinishedTaskCountByIso.get(day.iso) ?? 0) : 0;
                                const hasUnfinishedTasks = dayUnfinishedTaskCount > 0;
                                const featureImageUrl = featureImageUrls[day.iso] ?? null;
                                const hasFeatureImageKey = featureImageKeysByIso.has(day.iso);
                                const isToday = todayIso === day.iso;
                                const isActiveEditorDay = Boolean(day.file && activeEditorFilePath === day.file.path);
                                const dayOfWeek = day.date.toDate().getDay();
                                const isWeekend = isWeekendDay(dayOfWeek, calendarWeekendDays);
                                const previousDay = dayIndex > 0 ? week.days[dayIndex - 1] : null;
                                const nextDay = dayIndex < week.days.length - 1 ? week.days[dayIndex + 1] : null;
                                const dayAbove = previousWeek ? (previousWeek.days[dayIndex] ?? null) : null;
                                const dayBelow = nextWeek ? (nextWeek.days[dayIndex] ?? null) : null;
                                const hasWeekendBefore =
                                    isWeekend &&
                                    Boolean(previousDay && isWeekendDay(previousDay.date.toDate().getDay(), calendarWeekendDays));
                                const hasWeekendAfter =
                                    isWeekend && Boolean(nextDay && isWeekendDay(nextDay.date.toDate().getDay(), calendarWeekendDays));
                                const hasWeekendAbove =
                                    isWeekend && Boolean(dayAbove && isWeekendDay(dayAbove.date.toDate().getDay(), calendarWeekendDays));
                                const hasWeekendBelow =
                                    isWeekend && Boolean(dayBelow && isWeekendDay(dayBelow.date.toDate().getDay(), calendarWeekendDays));
                                const roundWeekendTopLeft = isWeekend && !hasWeekendAbove && !hasWeekendBefore;
                                const roundWeekendTopRight = isWeekend && !hasWeekendAbove && !hasWeekendAfter;
                                const roundWeekendBottomLeft = isWeekend && !hasWeekendBelow && !hasWeekendBefore;
                                const roundWeekendBottomRight = isWeekend && !hasWeekendBelow && !hasWeekendAfter;
                                const dayCellClassName = [
                                    'nn-navigation-calendar-day-cell',
                                    isWeekend ? 'is-weekend' : 'is-weekday',
                                    hasWeekendBefore ? 'has-weekend-before' : '',
                                    hasWeekendAfter ? 'has-weekend-after' : '',
                                    hasWeekendAbove ? 'has-weekend-above' : '',
                                    hasWeekendBelow ? 'has-weekend-below' : '',
                                    roundWeekendTopLeft ? 'round-weekend-top-left' : '',
                                    roundWeekendTopRight ? 'round-weekend-top-right' : '',
                                    roundWeekendBottomLeft ? 'round-weekend-bottom-left' : '',
                                    roundWeekendBottomRight ? 'round-weekend-bottom-right' : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                const className = [
                                    'nn-navigation-calendar-day',
                                    day.inMonth ? 'is-in-month' : 'is-outside-month',
                                    isToday ? 'is-today' : '',
                                    isActiveEditorDay ? 'is-active-editor-file' : '',
                                    isWeekend ? 'is-weekend' : 'is-weekday',
                                    hasDailyNote ? 'has-daily-note' : '',
                                    hasUnfinishedTasks ? 'has-unfinished-tasks' : '',
                                    hasFeatureImageKey ? 'has-feature-image-key' : '',
                                    featureImageUrl ? 'has-feature-image' : ''
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                const style: React.CSSProperties | undefined = featureImageUrl
                                    ? { backgroundImage: `url(${featureImageUrl})` }
                                    : undefined;

                                const ariaLabel = day.date.clone().locale(displayLocale).format('LL');
                                const dateTimestamp = day.date.toDate().getTime();
                                const frontmatterTitle = day.file ? (frontmatterTitlesByPath.get(day.file.path) ?? '') : '';
                                const hasFrontmatterTitle = frontmatterTitle.trim().length > 0;
                                const tooltipTitle = hasFrontmatterTitle
                                    ? frontmatterTitle
                                    : DateUtils.formatDate(dateTimestamp, dateFormat);
                                const showDate = hasFrontmatterTitle;
                                const tooltipAriaText = hasFrontmatterTitle ? `${ariaLabel}, ${frontmatterTitle}` : ariaLabel;
                                const tooltipEnabled = Boolean(day.file || featureImageUrl);
                                const tooltipData: CalendarHoverTooltipData = {
                                    imageUrl: featureImageUrl,
                                    title: tooltipTitle || ariaLabel,
                                    dateTimestamp,
                                    previewPath: day.file?.path ?? null,
                                    previewEnabled: Boolean(day.file && day.file.extension === 'md'),
                                    showDate
                                };

                                return (
                                    <div key={day.iso} className={dayCellClassName}>
                                        <CalendarDayButton
                                            className={className}
                                            ariaText={tooltipAriaText}
                                            style={style}
                                            tooltipEnabled={tooltipEnabled}
                                            tooltipData={tooltipData}
                                            dayNumber={dayNumber}
                                            isMobile={isMobile}
                                            showUnfinishedTaskIndicator={hasUnfinishedTasks}
                                            onShowTooltip={onShowTooltip}
                                            onHideTooltip={onHideTooltip}
                                            onClick={event => onDayClick(event, day)}
                                            onContextMenu={event => onDayContextMenu(event, day, canCreateDayNotes)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                {Array.from({ length: trailingSpacerWeekCount }).map((_entry, spacerIndex) => (
                    <div key={`spacer-week-${spacerIndex}`} className="nn-navigation-calendar-week nn-navigation-calendar-week-spacer">
                        {showWeekNumbers ? (
                            <>
                                <div
                                    className="nn-navigation-calendar-weeknumber nn-navigation-calendar-weeknumber-spacer-row"
                                    aria-hidden="true"
                                />
                            </>
                        ) : null}
                        {Array.from({ length: 7 }).map((_day, dayIndex) => (
                            <div
                                key={`spacer-day-${spacerIndex}-${dayIndex}`}
                                className="nn-navigation-calendar-day-spacer"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
});
