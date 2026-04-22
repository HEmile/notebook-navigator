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

/**
 * Central export point for internationalization
 * Dynamically loads the appropriate language based on Obsidian's language setting
 */
import { getLanguage } from 'obsidian';
import { STRINGS_AR } from './locales/ar';
import { STRINGS_DE } from './locales/de';
import { STRINGS_EN } from './locales/en';
import { STRINGS_ES } from './locales/es';
import { STRINGS_FA } from './locales/fa';
import { STRINGS_FR } from './locales/fr';
import { STRINGS_ID } from './locales/id';
import { STRINGS_IT } from './locales/it';
import { STRINGS_JA } from './locales/ja';
import { STRINGS_KO } from './locales/ko';
import { STRINGS_NL } from './locales/nl';
import { STRINGS_PL } from './locales/pl';
import { STRINGS_PT } from './locales/pt';
import { STRINGS_PT_BR } from './locales/pt_br';
import { STRINGS_RU } from './locales/ru';
import { STRINGS_TH } from './locales/th';
import { STRINGS_TR } from './locales/tr';
import { STRINGS_UK } from './locales/uk';
import { STRINGS_VI } from './locales/vi';
import { STRINGS_ZH_CN } from './locales/zh_cn';
import { STRINGS_ZH_TW } from './locales/zh_tw';

// Type for the translation strings structure
type TranslationStrings = typeof STRINGS_EN;

type DeepPartial<T> = T extends readonly unknown[]
    ? T
    : T extends object
      ? {
            [K in keyof T]?: DeepPartial<T[K]>;
        }
      : T;

// Map of supported languages to their translation modules
// Just add new languages here as they are created
//
// Obsidian-supported languages:
// ✅ ar     - Arabic
// ❌ am     - Amharic
// ❌ be     - Belarusian
// ❌ da     - Danish
// ✅ de     - German
// ✅ en     - English
// ❌ en-GB  - English (UK)
// ✅ es     - Spanish
// ✅ fa     - Persian (Farsi)
// ✅ fr     - French
// ✅ id     - Indonesian
// ✅ it     - Italian
// ✅ ja     - Japanese
// ✅ ko     - Korean
// ❌ lv     - Latvian
// ❌ ne     - Nepali
// ✅ nl     - Dutch
// ❌ no     - Norwegian
// ✅ pl     - Polish
// ✅ pt     - Portuguese
// ✅ pt-BR  - Portuguese (Brazil)
// ✅ ru     - Russian
// ❌ sq     - Albanian
// ✅ th     - Thai
// ✅ tr     - Turkish
// ✅ uk     - Ukrainian
// ✅ vi     - Vietnamese
// ✅ zh     - Chinese (Simplified)
// ✅ zh-TW  - Chinese (Traditional)
const LANGUAGE_MAP: Record<string, DeepPartial<TranslationStrings>> = {
    ar: STRINGS_AR,
    de: STRINGS_DE,
    en: STRINGS_EN,
    es: STRINGS_ES,
    fa: STRINGS_FA,
    fr: STRINGS_FR,
    id: STRINGS_ID,
    it: STRINGS_IT,
    ja: STRINGS_JA,
    ko: STRINGS_KO,
    nl: STRINGS_NL,
    pl: STRINGS_PL,
    pt: STRINGS_PT,
    'pt-BR': STRINGS_PT_BR,
    ru: STRINGS_RU,
    th: STRINGS_TH,
    tr: STRINGS_TR,
    uk: STRINGS_UK,
    vi: STRINGS_VI,
    zh: STRINGS_ZH_CN,
    'zh-CN': STRINGS_ZH_CN,
    zh_cn: STRINGS_ZH_CN,
    'zh-TW': STRINGS_ZH_TW,
    zh_tw: STRINGS_ZH_TW
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeTranslationValues(base: unknown, override: unknown): unknown {
    if (override === undefined) {
        return base;
    }

    if (Array.isArray(base)) {
        return Array.isArray(override) ? override : base;
    }

    if (isPlainObject(base)) {
        if (!isPlainObject(override)) {
            return base;
        }

        const result: Record<string, unknown> = {};
        for (const key of Object.keys(base)) {
            result[key] = mergeTranslationValues(base[key], override[key]);
        }
        return result;
    }

    return typeof override === typeof base ? override : base;
}

function getMergedStrings(base: TranslationStrings, overrides: DeepPartial<TranslationStrings> | undefined): TranslationStrings {
    if (!overrides || overrides === base) {
        return base;
    }

    return mergeTranslationValues(base, overrides) as TranslationStrings;
}

const resolvedLanguageCache = new Map<string, TranslationStrings>();

function getResolvedStrings(locale: string): TranslationStrings {
    if (locale === 'en') {
        return STRINGS_EN;
    }

    const cached = resolvedLanguageCache.get(locale);
    if (cached) {
        return cached;
    }

    const merged = getMergedStrings(STRINGS_EN, LANGUAGE_MAP[locale] ?? LANGUAGE_MAP.en);
    resolvedLanguageCache.set(locale, merged);
    return merged;
}

/**
 * Gets the current language setting from Obsidian
 */
export function getCurrentLanguage(): string {
    return getLanguage();
}

/**
 * Detects the current Obsidian language setting
 * Falls back to English if the language is not supported
 */
function getObsidianLanguage(): string {
    const locale = getCurrentLanguage();

    // Check if the detected language is supported
    if (locale && locale in LANGUAGE_MAP) {
        return locale;
    }

    // Fallback to English
    return 'en';
}

// Export the appropriate language strings based on Obsidian's setting
export const strings: TranslationStrings = getResolvedStrings(getObsidianLanguage());

/**
 * Get the default date format for the current language
 * Uses Moment format tokens
 */
export function getDefaultDateFormat(): string {
    const localeStrings = getResolvedStrings(getObsidianLanguage());
    return localeStrings.settings.items.dateFormat.placeholder || 'MMM D, YYYY';
}

/**
 * Get the default time format for the current language
 * Uses Moment format tokens
 */
export function getDefaultTimeFormat(): string {
    const localeStrings = getResolvedStrings(getObsidianLanguage());
    return localeStrings.settings.items.timeFormat.placeholder || 'h:mm a';
}
