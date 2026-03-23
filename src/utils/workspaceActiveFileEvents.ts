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

import { TFile } from 'obsidian';
import type { CommandQueueService } from '../services/CommandQueueService';
import { TIMEOUTS } from '../types/obsidian-extended';

interface WorkspaceActiveFileEventSource {
    on(name: 'active-leaf-change', callback: () => void): unknown;
    on(name: 'file-open', callback: (file: TFile | null) => void): unknown;
    offref(ref: unknown): void;
}

export interface ActiveFileWorkspaceEvent {
    candidateFile?: TFile | null;
    ignoreBackgroundOpen: boolean;
}

interface RegisterActiveFileWorkspaceListenersOptions {
    workspace: WorkspaceActiveFileEventSource;
    commandQueue?: Pick<CommandQueueService, 'isOpeningActiveFileInBackground'> | null;
    onChange: (event: ActiveFileWorkspaceEvent) => void;
}

export function registerActiveFileWorkspaceListeners({
    workspace,
    commandQueue,
    onChange
}: RegisterActiveFileWorkspaceListenersOptions): () => void {
    let pendingSyncTimer: number | null = null;
    let pendingCandidateFile: TFile | null | undefined = undefined;
    let pendingIgnoreBackgroundOpen: boolean | undefined = undefined;

    const scheduleChange = (candidateFile?: TFile | null, ignoreBackgroundOpen?: boolean) => {
        if (candidateFile !== undefined) {
            pendingCandidateFile = candidateFile;
            pendingIgnoreBackgroundOpen = ignoreBackgroundOpen ?? false;
        }

        if (typeof window === 'undefined') {
            onChange({
                candidateFile,
                ignoreBackgroundOpen: ignoreBackgroundOpen === true
            });
            return;
        }

        if (pendingSyncTimer !== null) {
            window.clearTimeout(pendingSyncTimer);
        }

        // Coalesce rapid file-open + active-leaf-change sequences and yield until workspace state settles.
        pendingSyncTimer = window.setTimeout(() => {
            pendingSyncTimer = null;
            const file = pendingCandidateFile;
            const ignore = pendingIgnoreBackgroundOpen;
            pendingCandidateFile = undefined;
            pendingIgnoreBackgroundOpen = undefined;
            onChange({
                candidateFile: file,
                ignoreBackgroundOpen: ignore === true
            });
        }, TIMEOUTS.YIELD_TO_EVENT_LOOP);
    };

    const handleActiveLeafChange = () => {
        scheduleChange();
    };

    const handleFileOpen = (file: TFile | null) => {
        const ignoreBackgroundOpen = file instanceof TFile && commandQueue?.isOpeningActiveFileInBackground(file.path) === true;
        scheduleChange(file, ignoreBackgroundOpen);
    };

    const activeLeafChangeRef = workspace.on('active-leaf-change', handleActiveLeafChange);
    const fileOpenRef = workspace.on('file-open', handleFileOpen);

    return () => {
        if (pendingSyncTimer !== null) {
            window.clearTimeout(pendingSyncTimer);
        }
        workspace.offref(activeLeafChangeRef);
        workspace.offref(fileOpenRef);
    };
}
