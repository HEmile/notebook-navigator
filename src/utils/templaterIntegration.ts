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

import { App, Plugin, TFile, TFolder } from 'obsidian';
import { TEMPLATER_PLUGIN_ID } from '../constants/pluginIds';
import { getPluginById, getRecordValue, isRecord } from './typeGuards';

export type TemplaterCreateNewNoteFromTemplateFn = (folder?: TFolder) => void | Promise<void>;
export type TemplaterCreateNoteFromTemplateFn = (
    template: TFile | string,
    folder?: TFolder | string,
    filename?: string,
    openNewNote?: boolean
) => Promise<TFile | undefined>;

type TemplaterCreateNoteFromTemplateApiFn = (
    template: TFile | string,
    folder?: TFolder | string,
    filename?: string,
    openNewNote?: boolean
) => TFile | Promise<TFile | undefined> | undefined;

interface TemplaterFuzzySuggesterApi {
    create_new_note_from_template: TemplaterCreateNewNoteFromTemplateFn;
}

interface TemplaterCoreApi {
    create_new_note_from_template: TemplaterCreateNoteFromTemplateApiFn;
}

interface TemplaterFuzzySuggesterPluginApi extends Plugin {
    fuzzy_suggester: TemplaterFuzzySuggesterApi;
}

interface TemplaterCorePluginApi extends Plugin {
    templater: TemplaterCoreApi;
}

function isTemplaterFuzzySuggesterPlugin(plugin: Plugin | null): plugin is TemplaterFuzzySuggesterPluginApi {
    if (!plugin) {
        return false;
    }

    const fuzzySuggester = getRecordValue(plugin, 'fuzzy_suggester');
    if (!isRecord(fuzzySuggester)) {
        return false;
    }

    const createNewNoteFromTemplate = getRecordValue(fuzzySuggester, 'create_new_note_from_template');
    return typeof createNewNoteFromTemplate === 'function';
}

function isTemplaterCorePlugin(plugin: Plugin | null): plugin is TemplaterCorePluginApi {
    if (!plugin) {
        return false;
    }

    const templater = getRecordValue(plugin, 'templater');
    if (!isRecord(templater)) {
        return false;
    }

    const createNoteFromTemplate = getRecordValue(templater, 'create_new_note_from_template');
    return typeof createNoteFromTemplate === 'function';
}

export function getTemplaterCreateNewNoteFromTemplate(app: App): TemplaterCreateNewNoteFromTemplateFn | null {
    if (!isTemplaterFuzzySuggesterPlugin(getPluginById(app, TEMPLATER_PLUGIN_ID))) {
        return null;
    }

    return (folder?: TFolder) => {
        const plugin = getPluginById(app, TEMPLATER_PLUGIN_ID);
        if (!isTemplaterFuzzySuggesterPlugin(plugin)) {
            return;
        }

        return plugin.fuzzy_suggester.create_new_note_from_template(folder);
    };
}

export function getTemplaterCreateNoteFromTemplate(app: App): TemplaterCreateNoteFromTemplateFn | null {
    if (!isTemplaterCorePlugin(getPluginById(app, TEMPLATER_PLUGIN_ID))) {
        return null;
    }

    return async (template: TFile | string, folder?: TFolder | string, filename?: string, openNewNote?: boolean) => {
        const plugin = getPluginById(app, TEMPLATER_PLUGIN_ID);
        if (!isTemplaterCorePlugin(plugin)) {
            return undefined;
        }

        return await plugin.templater.create_new_note_from_template(template, folder, filename, openNewNote);
    };
}
