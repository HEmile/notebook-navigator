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

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileView, Menu, TFile, type Workspace, type WorkspaceLeaf } from 'obsidian';
import { getCurrentLanguage, strings } from '../../i18n';
import { InfoModal } from '../../modals/InfoModal';
import { useServices } from '../../context/ServicesContext';
import { useSettingsState, useSettingsUpdate } from '../../context/SettingsContext';
import { useFileCacheOptional } from '../../context/StorageContext';
import { getDBInstanceOrNull, isShutdownInProgress, waitForDatabaseInitialization } from '../../storage/fileOperations';
import { runAsyncAction } from '../../utils/async';
import { getCalendarCustomWeekAnchorUnit } from '../../utils/calendarCustomNotePatterns';
import { getDailyNoteFile, getDailyNoteSettings as getCoreDailyNoteSettings } from '../../utils/dailyNotes';
import { getMomentApi, resolveMomentLocale, type MomentInstance } from '../../utils/moment';
import { useFileOpener } from '../../hooks/useFileOpener';
import { useLocalDayKey } from '../../hooks/useLocalDayKey';
import { extractFrontmatterName } from '../../utils/metadataExtractor';
import { TIMEOUTS } from '../../types/obsidian-extended';
import { type CalendarNoteKind } from '../../utils/calendarNotes';
import { getActiveVaultProfile } from '../../utils/vaultProfiles';
import type { CalendarWeeksToShow } from '../../settings/types';
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';
import { CalendarHoverTooltip } from './CalendarHoverTooltip';
import { CalendarYearPanel } from './CalendarYearPanel';
import { createCalendarNotePathResolverContext, getExistingCalendarNoteFile } from './calendarNoteResolution';
import {
    buildDateFilterToken,
    clamp,
    formatIsoDate,
    isDateFilterModifierPressed,
    setUnfinishedTaskCount,
    startOfWeek
} from './calendarUtils';
import { useCalendarFeatureImages, type CalendarFeatureImageTarget } from './useCalendarFeatureImages';
import { useCalendarHoverTooltip } from './useCalendarHoverTooltip';
import { useCalendarNoteActions } from './useCalendarNoteActions';
import type { CalendarDay, CalendarHeaderPeriodNoteFiles, CalendarWeek, CalendarYearMonthEntry } from './types';
import { isStringRecordValue, sanitizeRecord } from '../../utils/recordUtils';

export interface CalendarProps {
    onWeekCountChange?: (count: number) => void;
    onNavigationAction?: () => void;
    weeksToShowOverride?: CalendarWeeksToShow;
    onAddDateFilter?: (dateToken: string) => void;
    isRightSidebar?: boolean;
}

type HeaderPeriodKind = Extract<CalendarNoteKind, 'month' | 'quarter' | 'year'>;

function getWorkspaceActiveFile(workspace: Workspace): TFile | null {
    const activeView = workspace.getActiveViewOfType(FileView);
    const activeFile = activeView?.file;
    return activeFile instanceof TFile ? activeFile : null;
}

function resolveActiveEditorFilePath(workspace: Workspace, candidateFile?: TFile | null): string | null {
    const activeViewFile = getWorkspaceActiveFile(workspace);
    const file = candidateFile instanceof TFile ? candidateFile : activeViewFile;

    if (file) {
        return file.path;
    }

    return null;
}

function isFileOpenInWorkspace(workspace: Workspace, filePath: string): boolean {
    if (typeof workspace.iterateAllLeaves !== 'function') {
        return false;
    }

    let isOpen = false;
    workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
        if (isOpen) {
            return;
        }

        const view = leaf.view;
        if (!(view instanceof FileView)) {
            return;
        }

        const file = view.file;
        if (file instanceof TFile && file.path === filePath) {
            isOpen = true;
        }
    });

    return isOpen;
}

export function Calendar({
    onWeekCountChange,
    onNavigationAction,
    weeksToShowOverride,
    onAddDateFilter,
    isRightSidebar = false
}: CalendarProps) {
    const { app, commandQueue, fileSystemOps, isMobile } = useServices();
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const periodicNotesFolder = getActiveVaultProfile(settings).periodicNotesFolder;
    const customCalendarRootFolderSettings = useMemo(() => ({ calendarCustomRootFolder: periodicNotesFolder }), [periodicNotesFolder]);
    const weeksToShowSetting = weeksToShowOverride ?? settings.calendarWeeksToShow;
    const fileCache = useFileCacheOptional();
    const [dbFallback, setDbFallback] = useState(() => getDBInstanceOrNull());
    const db = fileCache?.getDB() ?? dbFallback;
    const openFile = useFileOpener();
    const calendarLabelId = useId();

    const momentApi = getMomentApi();
    const [cursorDate, setCursorDate] = useState<MomentInstance | null>(() => (momentApi ? momentApi().startOf('day') : null));
    const todayIso = useLocalDayKey();
    const [activeEditorFilePath, setActiveEditorFilePath] = useState<string | null>(
        () => resolveActiveEditorFilePath(app.workspace) ?? null
    );

    const [vaultVersion, setVaultVersion] = useState(0);
    const [featureImageVersion, setFeatureImageVersion] = useState(0);
    const [taskIndicatorVersion, setTaskIndicatorVersion] = useState(0);
    const [hoverTooltipPreviewVersion, setHoverTooltipPreviewVersion] = useState(0);
    const [metadataVersion, setMetadataVersion] = useState(0);
    const visibleIndicatorNotePathsRef = useRef<Set<string>>(new Set());
    const visibleFeatureImageNotePathsRef = useRef<Set<string>>(new Set());
    const visibleFrontmatterNotePathsRef = useRef<Set<string>>(new Set());
    const dayNoteFileLookupCacheRef = useRef<Map<string, TFile | null>>(new Map());
    const vaultVersionDebounceRef = useRef<number | null>(null);
    const scheduleVaultVersionUpdate = useCallback(() => {
        dayNoteFileLookupCacheRef.current.clear();

        if (typeof window === 'undefined') {
            setVaultVersion(v => v + 1);
            return;
        }

        if (vaultVersionDebounceRef.current !== null) {
            return;
        }

        vaultVersionDebounceRef.current = window.setTimeout(() => {
            vaultVersionDebounceRef.current = null;
            setVaultVersion(v => v + 1);
        }, 120);
    }, []);
    const syncActiveEditorFilePath = useCallback(
        (candidateFile?: TFile | null) => {
            const nextFilePath = resolveActiveEditorFilePath(app.workspace, candidateFile);
            setActiveEditorFilePath(previousFilePath => {
                if (previousFilePath === nextFilePath) {
                    return previousFilePath;
                }

                if (nextFilePath !== null) {
                    return nextFilePath;
                }

                if (previousFilePath && isFileOpenInWorkspace(app.workspace, previousFilePath)) {
                    return previousFilePath;
                }

                return null;
            });
        },
        [app.workspace]
    );
    const shouldTrackCalendarVaultChange = useCallback((file: unknown): boolean => {
        if (!(file instanceof TFile)) {
            return true;
        }
        return file.extension === 'md';
    }, []);
    const {
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
    } = useCalendarHoverTooltip({
        db,
        dateFormat: settings.dateFormat,
        isMobile,
        previewVersion: hoverTooltipPreviewVersion
    });

    useEffect(() => {
        if (fileCache) {
            return;
        }

        if (dbFallback) {
            return;
        }

        let isActive = true;
        runAsyncAction(async () => {
            while (isActive && !isShutdownInProgress()) {
                const instance = await waitForDatabaseInitialization();
                if (!isActive) {
                    return;
                }
                if (instance) {
                    setDbFallback(instance);
                    return;
                }

                await new Promise<void>(resolve => {
                    globalThis.setTimeout(resolve, 250);
                });
            }
        });

        return () => {
            isActive = false;
        };
    }, [dbFallback, fileCache]);

    useEffect(() => {
        let pendingSyncTimer: number | null = null;
        let pendingCandidateFile: TFile | null | undefined = undefined;
        let pendingIgnoreBackgroundOpen: boolean | undefined = undefined;

        // Keep this block in sync with src/hooks/useNavigatorReveal.ts. The scheduling below and the
        // `handleFileOpen` background-open check intentionally mirror that hook because Obsidian can
        // emit `file-open` and `active-leaf-change` in different turns.
        const scheduleSyncActiveEditorFilePath = (candidateFile?: TFile | null, ignoreBackgroundOpen?: boolean) => {
            if (candidateFile !== undefined) {
                pendingCandidateFile = candidateFile;
                pendingIgnoreBackgroundOpen = ignoreBackgroundOpen ?? false;
            }

            if (typeof window === 'undefined') {
                syncActiveEditorFilePath(candidateFile);
                return;
            }

            if (pendingSyncTimer !== null) {
                window.clearTimeout(pendingSyncTimer);
            }

            // Yield to the event loop so workspace state reflects the new active file before reading it.
            pendingSyncTimer = window.setTimeout(() => {
                pendingSyncTimer = null;
                const file = pendingIgnoreBackgroundOpen === true ? undefined : pendingCandidateFile;
                pendingCandidateFile = undefined;
                pendingIgnoreBackgroundOpen = undefined;
                syncActiveEditorFilePath(file);
            }, TIMEOUTS.YIELD_TO_EVENT_LOOP);
        };

        const handleActiveLeafChange = () => {
            scheduleSyncActiveEditorFilePath();
        };

        const handleFileOpen = (file: TFile | null) => {
            // Ignore preview opens (`active: false`) and fall back to the actual active view file.
            const ignoreBackgroundOpen = file instanceof TFile && commandQueue?.isOpeningActiveFileInBackground(file.path) === true;
            scheduleSyncActiveEditorFilePath(file, ignoreBackgroundOpen);
        };

        const activeLeafChangeRef = app.workspace.on('active-leaf-change', handleActiveLeafChange);
        const fileOpenRef = app.workspace.on('file-open', handleFileOpen);
        syncActiveEditorFilePath();

        return () => {
            if (pendingSyncTimer !== null) {
                window.clearTimeout(pendingSyncTimer);
            }
            app.workspace.offref(activeLeafChangeRef);
            app.workspace.offref(fileOpenRef);
        };
    }, [app.workspace, commandQueue, syncActiveEditorFilePath]);

    useEffect(() => {
        const onVaultUpdate = (file: unknown) => {
            if (!shouldTrackCalendarVaultChange(file)) {
                return;
            }
            scheduleVaultVersionUpdate();
        };
        const createRef = app.vault.on('create', onVaultUpdate);
        const deleteRef = app.vault.on('delete', onVaultUpdate);
        const renameRef = app.vault.on('rename', onVaultUpdate);

        return () => {
            app.vault.offref(createRef);
            app.vault.offref(deleteRef);
            app.vault.offref(renameRef);
            if (typeof window !== 'undefined' && vaultVersionDebounceRef.current !== null) {
                window.clearTimeout(vaultVersionDebounceRef.current);
                vaultVersionDebounceRef.current = null;
            }
        };
    }, [app.vault, scheduleVaultVersionUpdate, shouldTrackCalendarVaultChange]);

    useEffect(() => {
        if (!db) {
            return;
        }

        return db.onContentChange(changes => {
            const visibleIndicatorPaths = visibleIndicatorNotePathsRef.current;
            const visibleFeatureImagePaths = visibleFeatureImageNotePathsRef.current;
            const hoverTooltipState = hoverTooltipStateRef.current;
            const hoverPreviewPath =
                hoverTooltipState && hoverTooltipState.tooltipData.previewEnabled ? hoverTooltipState.tooltipData.previewPath : null;
            const shouldTrackFeatureImage = settings.calendarShowFeatureImage && visibleFeatureImagePaths.size > 0;
            const shouldTrackTaskIndicator = visibleIndicatorPaths.size > 0;
            const shouldTrackHoverPreview = Boolean(hoverPreviewPath);

            let hasFeatureImageChange = !shouldTrackFeatureImage;
            let hasTaskIndicatorChange = !shouldTrackTaskIndicator;
            let hasHoverPreviewChange = !shouldTrackHoverPreview;

            for (const change of changes) {
                if (
                    !hasHoverPreviewChange &&
                    hoverPreviewPath &&
                    change.path === hoverPreviewPath &&
                    change.changes.preview !== undefined
                ) {
                    hasHoverPreviewChange = true;
                }

                if (!hasTaskIndicatorChange && visibleIndicatorPaths.has(change.path) && change.changes.taskUnfinished !== undefined) {
                    hasTaskIndicatorChange = true;
                }

                if (
                    !hasFeatureImageChange &&
                    visibleFeatureImagePaths.has(change.path) &&
                    (change.changes.featureImage !== undefined ||
                        change.changes.featureImageKey !== undefined ||
                        change.changes.featureImageStatus !== undefined)
                ) {
                    hasFeatureImageChange = true;
                }

                if (hasFeatureImageChange && hasTaskIndicatorChange && hasHoverPreviewChange) {
                    break;
                }
            }

            if (shouldTrackFeatureImage && hasFeatureImageChange) {
                setFeatureImageVersion(v => v + 1);
            }

            if (shouldTrackTaskIndicator && hasTaskIndicatorChange) {
                setTaskIndicatorVersion(v => v + 1);
            }

            if (shouldTrackHoverPreview && hasHoverPreviewChange) {
                setHoverTooltipPreviewVersion(v => v + 1);
            }
        });
    }, [db, hoverTooltipStateRef, settings.calendarShowFeatureImage]);

    useEffect(() => {
        if (!settings.useFrontmatterMetadata) {
            return;
        }

        const offref = app.metadataCache.on('changed', file => {
            if (!file) {
                return;
            }
            if (!visibleFrontmatterNotePathsRef.current.has(file.path)) {
                return;
            }
            setMetadataVersion(v => v + 1);
        });

        return () => {
            app.metadataCache.offref(offref);
        };
    }, [app.metadataCache, settings.useFrontmatterMetadata]);

    useEffect(() => {
        // Obsidian exposes `window.moment` after startup; in tests (or very early) it may be unavailable.
        if (!momentApi || cursorDate) {
            return;
        }
        setCursorDate(momentApi().startOf('day'));
    }, [cursorDate, momentApi]);

    const displayLocale = useMemo(() => {
        if (!momentApi) {
            return 'en';
        }

        // Month name / weekday labels follow the current UI language by default.
        const currentLanguage = getCurrentLanguage();
        const fallback = momentApi.locale() || 'en';
        const requested = (currentLanguage || fallback).replace(/_/g, '-');

        return resolveMomentLocale(requested, momentApi, fallback);
    }, [momentApi]);

    const calendarRulesLocale = useMemo(() => {
        if (!momentApi) {
            return 'en';
        }
        // Week rules (week starts on, week number calculation) can differ from display locale; allow override.
        const requested = settings.calendarLocale === 'system-default' ? displayLocale : settings.calendarLocale;
        return resolveMomentLocale(requested, momentApi, displayLocale);
    }, [displayLocale, momentApi, settings.calendarLocale]);

    const isCustomCalendar = settings.calendarIntegrationMode === 'notebook-navigator';
    const weekNotesEnabled = isCustomCalendar && settings.calendarCustomWeekPattern.trim() !== '';

    const effectiveWeekMode = useMemo<'iso' | 'locale'>(() => {
        if (!weekNotesEnabled) {
            return 'locale';
        }

        const anchorUnit = getCalendarCustomWeekAnchorUnit(settings.calendarCustomWeekPattern);
        return anchorUnit === 'isoWeek' ? 'iso' : 'locale';
    }, [settings.calendarCustomWeekPattern, weekNotesEnabled]);

    const weekStartsOn = useMemo(() => {
        if (effectiveWeekMode === 'iso') {
            return 1;
        }
        if (!momentApi) {
            return 1;
        }
        const localeData = momentApi().locale(calendarRulesLocale).localeData();
        const firstDay = localeData.firstDayOfWeek();
        return typeof firstDay === 'number' && Number.isInteger(firstDay) && firstDay >= 0 && firstDay <= 6 ? firstDay : 1;
    }, [calendarRulesLocale, effectiveWeekMode, momentApi]);

    const weekdays = useMemo(() => {
        if (!momentApi) {
            return [];
        }

        const firstDay = weekStartsOn;
        const localeData = momentApi().locale(displayLocale).localeData();
        const labels = localeData.weekdaysMin();
        if (!Array.isArray(labels) || labels.length !== 7) {
            return [];
        }
        const ordered = [...labels.slice(firstDay), ...labels.slice(0, firstDay)];
        return ordered.map(label => Array.from(label.trim())[0] ?? '');
    }, [displayLocale, momentApi, weekStartsOn]);

    const dailyNoteSettings = useMemo(() => {
        // Force refresh when vault contents change so `getDailyNoteFile()` reflects created/renamed/deleted daily notes.
        void vaultVersion;
        if (settings.calendarIntegrationMode !== 'daily-notes') {
            return null;
        }
        return getCoreDailyNoteSettings(app);
    }, [app, settings.calendarIntegrationMode, vaultVersion]);

    const dayNoteResolverContext = useMemo(() => createCalendarNotePathResolverContext('day', settings), [settings]);

    const canResolveCustomDayNotes = useMemo(() => {
        if (!momentApi) {
            return false;
        }

        return (
            settings.calendarIntegrationMode === 'notebook-navigator' &&
            dayNoteResolverContext.config.isPatternValid(dayNoteResolverContext.momentPattern, momentApi)
        );
    }, [dayNoteResolverContext, momentApi, settings.calendarIntegrationMode]);

    useEffect(() => {
        dayNoteFileLookupCacheRef.current.clear();
    }, [
        canResolveCustomDayNotes,
        customCalendarRootFolderSettings,
        dailyNoteSettings,
        dayNoteResolverContext,
        displayLocale,
        momentApi,
        settings.calendarIntegrationMode,
        vaultVersion
    ]);

    const getExistingDayNoteFile = useCallback(
        (date: MomentInstance): TFile | null => {
            const iso = formatIsoDate(date);
            const cached = dayNoteFileLookupCacheRef.current.get(iso);
            if (cached !== undefined) {
                return cached;
            }

            let existingFile: TFile | null = null;
            if (canResolveCustomDayNotes) {
                existingFile = getExistingCalendarNoteFile({
                    app,
                    kind: 'day',
                    date,
                    resolverContext: dayNoteResolverContext,
                    displayLocale,
                    weekLocale: calendarRulesLocale,
                    customCalendarRootFolderSettings,
                    momentApi
                });
            } else if (settings.calendarIntegrationMode === 'daily-notes' && dailyNoteSettings) {
                existingFile = getDailyNoteFile(app, date, dailyNoteSettings);
            }

            dayNoteFileLookupCacheRef.current.set(iso, existingFile);
            return existingFile;
        },
        [
            app,
            canResolveCustomDayNotes,
            customCalendarRootFolderSettings,
            dailyNoteSettings,
            dayNoteResolverContext,
            displayLocale,
            calendarRulesLocale,
            momentApi,
            settings.calendarIntegrationMode
        ]
    );

    const weeks = useMemo<CalendarWeek[]>(() => {
        if (!momentApi || !cursorDate) {
            return [];
        }

        // Force refresh when vault contents change so custom calendar resolution reflects created/renamed/deleted notes.
        void vaultVersion;

        const weeksToShow = clamp(weeksToShowSetting, 1, 6);
        const cursor = cursorDate.clone().startOf('day');
        const cursorWeekStart = startOfWeek(cursor.clone(), weekStartsOn);
        const targetMonth = cursor.month();
        const targetYear = cursor.year();

        let windowStart: MomentInstance;
        let weekCount: number;

        if (weeksToShow === 6) {
            // `6` means "full month": render as many week rows as needed to cover the month grid (capped at 6).
            const monthStart = cursor.clone().startOf('month');
            const gridStart = startOfWeek(monthStart, weekStartsOn);
            const monthEnd = monthStart.clone().endOf('month');
            const gridEndWeekStart = startOfWeek(monthEnd, weekStartsOn);
            const totalWeeks = clamp(gridEndWeekStart.diff(gridStart, 'weeks') + 1, 1, 6);

            windowStart = gridStart;
            weekCount = totalWeeks;
        } else {
            // For 1..5 weeks: show a sliding N-week window around the cursor week (page navigation never skips weeks).
            const offset = Math.floor((weeksToShow - 1) / 2);
            windowStart = cursorWeekStart.clone().subtract(offset, 'week');
            weekCount = weeksToShow;
        }

        const visibleWeeks: CalendarWeek[] = [];
        for (let weekOffset = 0; weekOffset < weekCount; weekOffset++) {
            const weekStart = windowStart.clone().add(weekOffset, 'week');
            const weekMoment = weekStart.clone().locale(calendarRulesLocale);
            const weekNumber = effectiveWeekMode === 'iso' ? weekMoment.isoWeek() : weekMoment.week();
            const weekYear = effectiveWeekMode === 'iso' ? weekMoment.isoWeekYear() : weekMoment.weekYear();

            const days: CalendarDay[] = [];
            for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                const date = weekStart.clone().add(dayOffset, 'day');
                const inMonth = date.month() === targetMonth && date.year() === targetYear;
                const iso = formatIsoDate(date);
                const file = getExistingDayNoteFile(date);

                days.push({ date, iso, inMonth, file });
            }

            visibleWeeks.push({
                key: `week-${weekYear}-W${weekNumber}`,
                weekNumber,
                days
            });
        }

        return visibleWeeks;
    }, [
        calendarRulesLocale,
        cursorDate,
        effectiveWeekMode,
        getExistingDayNoteFile,
        momentApi,
        vaultVersion,
        weeksToShowSetting,
        weekStartsOn
    ]);

    const visibleDayNotePaths = useMemo(() => {
        const paths = new Set<string>();
        for (const week of weeks) {
            for (const day of week.days) {
                if (day.file) {
                    paths.add(day.file.path);
                }
            }
        }
        return paths;
    }, [weeks]);

    const featureImageKeysByIso = useMemo(() => {
        // Force refresh when calendar feature-image metadata changes so rendered day backgrounds stay in sync with content updates.
        void featureImageVersion;

        const featureKeys = new Map<string, string>();

        if (!db || !settings.calendarShowFeatureImage) {
            return featureKeys;
        }

        for (const week of weeks) {
            for (const day of week.days) {
                const file = day.file;
                if (!file) {
                    continue;
                }

                const record = db.getFile(file.path);
                const featureKey = record?.featureImageKey ?? null;
                const featureStatus = record?.featureImageStatus ?? null;
                if (featureStatus === 'has' && featureKey && featureKey !== '') {
                    featureKeys.set(day.iso, featureKey);
                }
            }
        }

        return featureKeys;
    }, [db, featureImageVersion, settings.calendarShowFeatureImage, weeks]);

    const dayFeatureImageTargets = useMemo<CalendarFeatureImageTarget[]>(() => {
        const targets: CalendarFeatureImageTarget[] = [];

        if (!settings.calendarShowFeatureImage) {
            return targets;
        }

        for (const week of weeks) {
            for (const day of week.days) {
                if (!day.file) {
                    continue;
                }

                const featureKey = featureImageKeysByIso.get(day.iso);
                if (!featureKey) {
                    continue;
                }

                targets.push({
                    id: day.iso,
                    file: day.file,
                    key: featureKey
                });
            }
        }

        return targets;
    }, [featureImageKeysByIso, settings.calendarShowFeatureImage, weeks]);

    const unfinishedTaskCountByIso = useMemo(() => {
        // Force refresh when calendar task metadata changes so day task indicators stay in sync with content updates.
        void taskIndicatorVersion;

        const unfinishedTaskCounts = new Map<string, number>();

        if (!db) {
            return unfinishedTaskCounts;
        }

        for (const week of weeks) {
            for (const day of week.days) {
                setUnfinishedTaskCount(unfinishedTaskCounts, day.iso, day.file, db);
            }
        }

        return unfinishedTaskCounts;
    }, [db, taskIndicatorVersion, weeks]);

    const showYearCalendar = isRightSidebar && settings.calendarShowYearCalendar;
    const renderedWeekRowCount = useMemo(() => {
        const weeksToShow = clamp(weeksToShowSetting, 1, 6);
        if (weeksToShow === 6 && showYearCalendar) {
            return 6;
        }
        return weeks.length;
    }, [showYearCalendar, weeks.length, weeksToShowSetting]);
    const trailingSpacerWeekCount = Math.max(0, renderedWeekRowCount - weeks.length);

    useLayoutEffect(() => {
        if (weeks.length === 0) {
            return;
        }
        onWeekCountChange?.(renderedWeekRowCount);
    }, [onWeekCountChange, renderedWeekRowCount, weeks.length]);

    const frontmatterTitlesByPath = useMemo(() => {
        void metadataVersion;
        if (!settings.useFrontmatterMetadata) {
            return new Map<string, string>();
        }

        const titles = new Map<string, string>();
        for (const week of weeks) {
            for (const day of week.days) {
                const file = day.file;
                if (!file) {
                    continue;
                }

                const title = extractFrontmatterName(app, file, settings.frontmatterNameField).trim();
                if (!title) {
                    continue;
                }

                titles.set(file.path, title);
            }
        }

        return titles;
    }, [app, metadataVersion, settings.frontmatterNameField, settings.useFrontmatterMetadata, weeks]);
    const featureImageUrls = useCalendarFeatureImages({
        db,
        showFeatureImages: settings.calendarShowFeatureImage,
        targets: dayFeatureImageTargets,
        maxConcurrentLoads: isMobile ? 4 : 6
    });

    const handleNavigate = useCallback(
        (delta: number) => {
            if (!momentApi) {
                return;
            }
            clearHoverTooltip();
            const weeksToShow = clamp(weeksToShowSetting, 1, 6);
            const unit = weeksToShow === 6 ? 'month' : 'week';
            const step = weeksToShow === 6 ? delta : delta * weeksToShow;

            setCursorDate(prev => (prev ?? momentApi().startOf('day')).clone().add(step, unit));
            onNavigationAction?.();
        },
        [clearHoverTooltip, momentApi, onNavigationAction, weeksToShowSetting]
    );

    const handleNavigateYear = useCallback(
        (delta: number) => {
            if (!momentApi) {
                return;
            }

            clearHoverTooltip();
            setCursorDate(prev => (prev ?? momentApi().startOf('day')).clone().add(delta, 'year'));
            onNavigationAction?.();
        },
        [clearHoverTooltip, momentApi, onNavigationAction]
    );

    const openCalendarHelp = useCallback(() => {
        const dateFilterItem =
            settings.multiSelectModifier === 'optionAlt'
                ? strings.navigationCalendar.helpModal.dateFilterOptionAlt
                : strings.navigationCalendar.helpModal.dateFilterCmdCtrl;

        new InfoModal(app, {
            title: strings.navigationCalendar.helpModal.title,
            items: [...strings.navigationCalendar.helpModal.items, dateFilterItem]
        }).open();
    }, [app, settings.multiSelectModifier]);

    const handleDateFilterModifiedClick = useCallback(
        (event: React.MouseEvent<HTMLElement>, kind: CalendarNoteKind, date: MomentInstance): boolean => {
            if (!onAddDateFilter) {
                return false;
            }

            if (!isDateFilterModifierPressed(event, settings.multiSelectModifier, isMobile)) {
                return false;
            }

            const dateToken = buildDateFilterToken(kind, date);
            if (!dateToken) {
                return false;
            }

            event.preventDefault();
            event.stopPropagation();
            clearHoverTooltip();
            onAddDateFilter(dateToken);
            return true;
        },
        [clearHoverTooltip, onAddDateFilter, settings.multiSelectModifier, isMobile]
    );

    const handleSelectYearMonth = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>, date: MomentInstance) => {
            if (handleDateFilterModifiedClick(event, 'month', date)) {
                return;
            }

            clearHoverTooltip();
            setCursorDate(date.clone().startOf('day'));
            onNavigationAction?.();
        },
        [clearHoverTooltip, handleDateFilterModifiedClick, onNavigationAction]
    );

    const onVaultChange = useCallback(() => {
        scheduleVaultVersionUpdate();
    }, [scheduleVaultVersionUpdate]);

    const setCalendarMonthHighlight = useCallback(
        async (monthKey: string, dayIso: string) => {
            await updateSettings(targetSettings => {
                const nextHighlights = sanitizeRecord(targetSettings.calendarMonthHighlights, isStringRecordValue);
                nextHighlights[monthKey] = dayIso;
                targetSettings.calendarMonthHighlights = nextHighlights;
            });
        },
        [updateSettings]
    );

    const removeCalendarMonthHighlight = useCallback(
        async (monthKey: string) => {
            await updateSettings(targetSettings => {
                const nextHighlights = sanitizeRecord(targetSettings.calendarMonthHighlights, isStringRecordValue);
                delete nextHighlights[monthKey];
                targetSettings.calendarMonthHighlights = nextHighlights;
            });
        },
        [updateSettings]
    );

    const { getExistingCustomCalendarNoteFile, openOrCreateCustomCalendarNote, openOrCreateDailyNote, showCalendarNoteContextMenu } =
        useCalendarNoteActions({
            app,
            fileSystemOps,
            isMobile,
            settings,
            dailyNoteSettings,
            momentApi,
            displayLocale,
            weekLocale: calendarRulesLocale,
            customCalendarRootFolderSettings,
            openFile,
            clearHoverTooltip,
            onVaultChange,
            setCalendarMonthHighlight,
            removeCalendarMonthHighlight
        });

    const handleToday = useCallback(() => {
        if (!momentApi) {
            return;
        }
        clearHoverTooltip();
        setCursorDate(momentApi().startOf('day'));
        onNavigationAction?.();
    }, [clearHoverTooltip, momentApi, onNavigationAction]);

    const showWeekNumbers = settings.calendarShowWeekNumber;
    const highlightToday = settings.calendarHighlightToday;
    const showYearInHeader = !isRightSidebar || !showYearCalendar;
    const useRightSidebarYearCalendarHeaderLayout = isRightSidebar && showYearCalendar;
    const useSplitHeaderLayout = !useRightSidebarYearCalendarHeaderLayout;
    const showHeaderHelpButton = settings.showInfoButtons && !isMobile && useRightSidebarYearCalendarHeaderLayout;
    const showInlineMonthNavigation = useRightSidebarYearCalendarHeaderLayout;
    const showCompactQuarterInMonthRow = useRightSidebarYearCalendarHeaderLayout && settings.calendarShowQuarter;
    const showHeaderPeriodDetails = useSplitHeaderLayout;
    const showHeaderNavRow = useSplitHeaderLayout;
    const showCompactHeaderInlineInfoButton = showHeaderHelpButton;
    const showInfoInNavRow = false;

    const monthNotesEnabled = isCustomCalendar && settings.calendarCustomMonthPattern.trim() !== '';
    const quarterNotesEnabled = isCustomCalendar && settings.calendarCustomQuarterPattern.trim() !== '';
    const yearNotesEnabled = isCustomCalendar && settings.calendarCustomYearPattern.trim() !== '';
    const selectedYear = cursorDate?.year() ?? null;

    const yearMonthEntries = useMemo<CalendarYearMonthEntry[]>(() => {
        if (!momentApi || selectedYear === null || !showYearCalendar) {
            return [];
        }

        // Force refresh when vault contents change so year month counts reflect created/renamed/deleted daily notes.
        void vaultVersion;

        const entries: CalendarYearMonthEntry[] = [];
        for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
            const monthDate = momentApi(new Date(selectedYear, monthIndex, 1))
                .startOf('day')
                .locale(displayLocale);
            const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
            let noteCount = 0;

            for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
                const dayDate = monthDate.clone().set({ date: dayNumber });
                const existingFile = getExistingDayNoteFile(dayDate);

                if (existingFile) {
                    noteCount += 1;
                }
            }

            entries.push({
                date: monthDate,
                fullLabel: monthDate.format('MMMM'),
                key: monthDate.format('YYYY-MM'),
                monthIndex,
                noteCount,
                shortLabel: monthDate.format('MMM')
            });
        }

        return entries;
    }, [displayLocale, getExistingDayNoteFile, momentApi, selectedYear, showYearCalendar, vaultVersion]);

    const highlightedMonthFilesByKey = useMemo(() => {
        const filesByKey = new Map<string, TFile>();

        if (!momentApi || !showYearCalendar) {
            return filesByKey;
        }

        for (const entry of yearMonthEntries) {
            const highlightedDayIso = settings.calendarMonthHighlights[entry.key];
            if (!highlightedDayIso) {
                continue;
            }

            const highlightedDay = momentApi(highlightedDayIso, 'YYYY-MM-DD', true);
            if (!highlightedDay.isValid() || highlightedDay.format('YYYY-MM') !== entry.key) {
                continue;
            }

            const file = getExistingDayNoteFile(highlightedDay.startOf('day'));
            if (file) {
                filesByKey.set(entry.key, file);
            }
        }

        return filesByKey;
    }, [getExistingDayNoteFile, momentApi, settings.calendarMonthHighlights, showYearCalendar, yearMonthEntries]);

    const highlightedMonthFeatureImageTargets = useMemo<CalendarFeatureImageTarget[]>(() => {
        void featureImageVersion;

        const targets: CalendarFeatureImageTarget[] = [];

        if (!db || !settings.calendarShowFeatureImage) {
            return targets;
        }

        highlightedMonthFilesByKey.forEach((file, monthKey) => {
            const record = db.getFile(file.path);
            const featureKey = record?.featureImageKey ?? null;
            const featureStatus = record?.featureImageStatus ?? null;
            if (featureStatus !== 'has' || !featureKey || featureKey === '') {
                return;
            }

            targets.push({
                id: monthKey,
                file,
                key: featureKey
            });
        });

        return targets;
    }, [db, featureImageVersion, highlightedMonthFilesByKey, settings.calendarShowFeatureImage]);

    const highlightedMonthWatchedNotePaths = useMemo(() => {
        const paths = new Set<string>();
        highlightedMonthFilesByKey.forEach(file => {
            paths.add(file.path);
        });
        return paths;
    }, [highlightedMonthFilesByKey]);

    const highlightedMonthKeys = useMemo(() => {
        const keys = new Set<string>();
        yearMonthEntries.forEach(entry => {
            if (settings.calendarMonthHighlights[entry.key]) {
                keys.add(entry.key);
            }
        });
        return keys;
    }, [settings.calendarMonthHighlights, yearMonthEntries]);

    const highlightedMonthImageUrls = useCalendarFeatureImages({
        db,
        showFeatureImages: settings.calendarShowFeatureImage && showYearCalendar,
        targets: highlightedMonthFeatureImageTargets,
        maxConcurrentLoads: isMobile ? 2 : 4
    });

    const headerPeriodNoteFiles = useMemo<CalendarHeaderPeriodNoteFiles>(() => {
        void vaultVersion;
        if (!momentApi || !cursorDate) {
            return { month: null, quarter: null, year: null };
        }

        const date = cursorDate.clone().locale(displayLocale);

        const month = monthNotesEnabled ? getExistingCustomCalendarNoteFile('month', date) : null;
        const year = yearNotesEnabled ? getExistingCustomCalendarNoteFile('year', date) : null;
        const quarter = settings.calendarShowQuarter && quarterNotesEnabled ? getExistingCustomCalendarNoteFile('quarter', date) : null;

        return { month, quarter, year };
    }, [
        cursorDate,
        displayLocale,
        getExistingCustomCalendarNoteFile,
        momentApi,
        monthNotesEnabled,
        quarterNotesEnabled,
        settings.calendarShowQuarter,
        vaultVersion,
        yearNotesEnabled
    ]);

    const getHeaderPeriodState = useCallback(
        (kind: HeaderPeriodKind): { existingFile: TFile | null; canCreate: boolean } => {
            switch (kind) {
                case 'month':
                    return {
                        existingFile: headerPeriodNoteFiles.month,
                        canCreate: monthNotesEnabled
                    };
                case 'quarter':
                    return {
                        existingFile: headerPeriodNoteFiles.quarter,
                        canCreate: settings.calendarShowQuarter && quarterNotesEnabled
                    };
                case 'year':
                    return {
                        existingFile: headerPeriodNoteFiles.year,
                        canCreate: yearNotesEnabled
                    };
            }
        },
        [
            headerPeriodNoteFiles.month,
            headerPeriodNoteFiles.quarter,
            headerPeriodNoteFiles.year,
            monthNotesEnabled,
            quarterNotesEnabled,
            settings.calendarShowQuarter,
            yearNotesEnabled
        ]
    );

    const handleHeaderPeriodClick = useCallback(
        (event: React.MouseEvent<HTMLElement>, kind: HeaderPeriodKind) => {
            if (!cursorDate) {
                return;
            }

            const periodDate = cursorDate.clone().locale(displayLocale);
            if (handleDateFilterModifiedClick(event, kind, periodDate)) {
                return;
            }

            const { existingFile, canCreate } = getHeaderPeriodState(kind);
            if (!canCreate) {
                return;
            }

            openOrCreateCustomCalendarNote(kind, periodDate, existingFile);
        },
        [cursorDate, displayLocale, getHeaderPeriodState, handleDateFilterModifiedClick, openOrCreateCustomCalendarNote]
    );

    const handleHeaderPeriodContextMenu = useCallback(
        (event: React.MouseEvent<HTMLElement>, kind: HeaderPeriodKind) => {
            if (!cursorDate) {
                return;
            }

            const { existingFile, canCreate } = getHeaderPeriodState(kind);
            showCalendarNoteContextMenu(event, {
                kind,
                date: cursorDate.clone().locale(displayLocale),
                existingFile,
                canCreate
            });
        },
        [cursorDate, displayLocale, getHeaderPeriodState, showCalendarNoteContextMenu]
    );

    const weekNoteFilesByKey = useMemo(() => {
        void vaultVersion;
        if (!momentApi || !cursorDate) {
            return new Map<string, TFile | null>();
        }

        if (!showWeekNumbers || !weekNotesEnabled) {
            return new Map<string, TFile | null>();
        }

        const entries = new Map<string, TFile | null>();
        for (const week of weeks) {
            const weekStart = week.days[0]?.date;
            if (!weekStart) {
                continue;
            }

            const weekDate = weekStart.clone().locale(displayLocale);
            const file = getExistingCustomCalendarNoteFile('week', weekDate);

            entries.set(week.key, file);
        }

        return entries;
    }, [cursorDate, displayLocale, getExistingCustomCalendarNoteFile, momentApi, showWeekNumbers, vaultVersion, weekNotesEnabled, weeks]);

    const weekUnfinishedTaskCountByKey = useMemo(() => {
        // Force refresh when calendar task metadata changes so week number task indicators reflect the latest metadata.
        void taskIndicatorVersion;

        if (!db) {
            return new Map<string, number>();
        }

        const counts = new Map<string, number>();
        weekNoteFilesByKey.forEach((file, weekKey) => {
            setUnfinishedTaskCount(counts, weekKey, file, db);
        });

        return counts;
    }, [db, taskIndicatorVersion, weekNoteFilesByKey]);

    const visibleIndicatorNotePaths = useMemo(() => {
        const paths = new Set<string>(visibleDayNotePaths);

        weekNoteFilesByKey.forEach(file => {
            if (file) {
                paths.add(file.path);
            }
        });

        return paths;
    }, [visibleDayNotePaths, weekNoteFilesByKey]);
    visibleIndicatorNotePathsRef.current = visibleIndicatorNotePaths;
    const visibleFeatureImageNotePaths = useMemo(() => {
        const paths = new Set<string>(visibleDayNotePaths);
        highlightedMonthWatchedNotePaths.forEach(path => {
            paths.add(path);
        });
        return paths;
    }, [highlightedMonthWatchedNotePaths, visibleDayNotePaths]);
    visibleFeatureImageNotePathsRef.current = visibleFeatureImageNotePaths;
    visibleFrontmatterNotePathsRef.current = visibleDayNotePaths;

    const handleWeekClick = useCallback(
        (event: React.MouseEvent<HTMLElement>, week: CalendarWeek, weekNoteFile: TFile | null) => {
            const weekStart = week.days[0]?.date;
            if (!weekStart) {
                return;
            }

            const weekDate = weekStart.clone().locale(displayLocale);
            if (handleDateFilterModifiedClick(event, 'week', weekDate)) {
                return;
            }

            if (!weekNotesEnabled) {
                return;
            }

            openOrCreateCustomCalendarNote('week', weekDate, weekNoteFile);
        },
        [displayLocale, handleDateFilterModifiedClick, openOrCreateCustomCalendarNote, weekNotesEnabled]
    );

    const handleWeekLabelClick = useCallback(
        (event: React.MouseEvent<HTMLElement>, week: CalendarWeek) => {
            const weekStart = week.days[0]?.date;
            if (!weekStart) {
                return;
            }

            handleDateFilterModifiedClick(event, 'week', weekStart.clone().locale(displayLocale));
        },
        [displayLocale, handleDateFilterModifiedClick]
    );

    const handleWeekContextMenu = useCallback(
        (event: React.MouseEvent<HTMLElement>, week: CalendarWeek, weekNoteFile: TFile | null) => {
            const weekStart = week.days[0]?.date;
            if (!weekStart) {
                return;
            }

            showCalendarNoteContextMenu(event, {
                kind: 'week',
                date: weekStart.clone().locale(displayLocale),
                existingFile: weekNoteFile,
                canCreate: weekNotesEnabled
            });
        },
        [displayLocale, showCalendarNoteContextMenu, weekNotesEnabled]
    );

    const handleDayClick = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>, day: CalendarWeek['days'][number]) => {
            if (handleDateFilterModifiedClick(event, 'day', day.date)) {
                return;
            }

            openOrCreateDailyNote(day.date, day.file);
        },
        [handleDateFilterModifiedClick, openOrCreateDailyNote]
    );

    const handleDayContextMenu = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>, day: CalendarWeek['days'][number], canCreate: boolean) => {
            const monthKey = day.date.format('YYYY-MM');
            showCalendarNoteContextMenu(event, {
                kind: 'day',
                date: day.date,
                existingFile: day.file,
                canCreate,
                monthKey,
                dayIso: day.iso,
                hasFeatureImage: featureImageKeysByIso.has(day.iso),
                currentMonthHighlightDayIso: settings.calendarMonthHighlights[monthKey] ?? null
            });
        },
        [featureImageKeysByIso, settings.calendarMonthHighlights, showCalendarNoteContextMenu]
    );

    const handleYearMonthContextMenu = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>, date: MomentInstance) => {
            const monthKey = date.format('YYYY-MM');
            if (!settings.calendarMonthHighlights[monthKey]) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            clearHoverTooltip();

            const menu = new Menu();
            menu.addItem(item => {
                item.setTitle(strings.contextMenu.file.removeCalendarHighlight)
                    .setIcon('lucide-image-off')
                    .onClick(() => {
                        runAsyncAction(() => removeCalendarMonthHighlight(monthKey));
                    });
            });
            menu.showAtMouseEvent(event.nativeEvent);
        },
        [clearHoverTooltip, removeCalendarMonthHighlight, settings.calendarMonthHighlights]
    );

    if (!momentApi || !cursorDate) {
        return null;
    }

    const selectedYearValue = cursorDate.year();
    const currentMonthKey = todayIso ? todayIso.slice(0, 7) : null;
    const monthYearHeaderDate = cursorDate.clone().locale(displayLocale);
    const monthLabel = monthYearHeaderDate.format('MMMM');
    const yearLabel = monthYearHeaderDate.format('YYYY');
    const quarterLabel = monthYearHeaderDate.format('[Q]Q');
    const canCreateDayNotes = settings.calendarIntegrationMode !== 'daily-notes' || Boolean(dailyNoteSettings);

    return (
        <>
            <CalendarHoverTooltip
                isMobile={isMobile}
                hoverTooltip={hoverTooltip}
                hoverTooltipStyle={hoverTooltipStyle}
                hoverTooltipRef={hoverTooltipRef}
                hoverTooltipPreviewText={hoverTooltipPreviewText}
                shouldShowHoverTooltipPreview={shouldShowHoverTooltipPreview}
                hoverTooltipDateText={hoverTooltipDateText}
            />
            <div
                className="nn-navigation-calendar"
                role="group"
                aria-labelledby={calendarLabelId}
                data-highlight-today={highlightToday ? 'true' : undefined}
                data-weeknumbers={showWeekNumbers ? 'true' : undefined}
                data-compact-header={useRightSidebarYearCalendarHeaderLayout ? 'true' : undefined}
                data-split-header={useSplitHeaderLayout ? 'true' : undefined}
            >
                <span id={calendarLabelId} className="nn-visually-hidden">
                    {strings.navigationCalendar.ariaLabel}
                </span>
                <CalendarHeader
                    monthLabel={monthLabel}
                    yearLabel={yearLabel}
                    quarterLabel={quarterLabel}
                    showYearInHeader={showYearInHeader}
                    showQuarter={settings.calendarShowQuarter}
                    hasMonthPeriodNote={Boolean(headerPeriodNoteFiles.month)}
                    hasQuarterPeriodNote={Boolean(headerPeriodNoteFiles.quarter)}
                    hasYearPeriodNote={Boolean(headerPeriodNoteFiles.year)}
                    showInlineMonthNavigation={showInlineMonthNavigation}
                    showCompactQuarterInMonthRow={showCompactQuarterInMonthRow}
                    showHeaderPeriodDetails={showHeaderPeriodDetails}
                    showHeaderNavRow={showHeaderNavRow}
                    showCompactHeaderInlineInfoButton={showCompactHeaderInlineInfoButton}
                    showInfoInNavRow={showInfoInNavRow}
                    onNavigate={handleNavigate}
                    onToday={handleToday}
                    onOpenHelp={openCalendarHelp}
                    onPeriodClick={handleHeaderPeriodClick}
                    onPeriodContextMenu={handleHeaderPeriodContextMenu}
                />

                <CalendarGrid
                    activeEditorFilePath={activeEditorFilePath}
                    showWeekNumbers={showWeekNumbers}
                    weekdays={weekdays}
                    weekStartsOn={weekStartsOn}
                    trailingSpacerWeekCount={trailingSpacerWeekCount}
                    weeks={weeks}
                    weekNotesEnabled={weekNotesEnabled}
                    weekNoteFilesByKey={weekNoteFilesByKey}
                    weekUnfinishedTaskCountByKey={weekUnfinishedTaskCountByKey}
                    displayLocale={displayLocale}
                    calendarWeekendDays={settings.calendarWeekendDays}
                    todayIso={todayIso}
                    unfinishedTaskCountByIso={unfinishedTaskCountByIso}
                    featureImageUrls={featureImageUrls}
                    featureImageKeysByIso={featureImageKeysByIso}
                    frontmatterTitlesByPath={frontmatterTitlesByPath}
                    dateFormat={settings.dateFormat}
                    isMobile={isMobile}
                    canCreateDayNotes={canCreateDayNotes}
                    onShowTooltip={handleShowTooltip}
                    onHideTooltip={handleHideTooltip}
                    onDayClick={handleDayClick}
                    onDayContextMenu={handleDayContextMenu}
                    onWeekClick={handleWeekClick}
                    onWeekLabelClick={handleWeekLabelClick}
                    onWeekContextMenu={handleWeekContextMenu}
                />

                <CalendarYearPanel
                    showYearCalendar={showYearCalendar}
                    currentMonthKey={currentMonthKey}
                    selectedYearValue={selectedYearValue}
                    selectedMonthIndex={cursorDate.month()}
                    hasYearPeriodNote={Boolean(headerPeriodNoteFiles.year)}
                    yearMonthEntries={yearMonthEntries}
                    highlightedMonthImageUrls={highlightedMonthImageUrls}
                    highlightedMonthKeys={highlightedMonthKeys}
                    onNavigateYear={handleNavigateYear}
                    onYearPeriodClick={event => handleHeaderPeriodClick(event, 'year')}
                    onYearPeriodContextMenu={event => handleHeaderPeriodContextMenu(event, 'year')}
                    onSelectYearMonth={handleSelectYearMonth}
                    onYearMonthContextMenu={handleYearMonthContextMenu}
                />
            </div>
        </>
    );
}
