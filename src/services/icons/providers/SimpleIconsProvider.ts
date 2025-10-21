import { IconDefinition } from '../types';
import { BaseFontIconProvider, BaseFontIconProviderOptions } from './BaseFontIconProvider';

/**
 * Structure of each icon entry in the Simple Icons metadata JSON
 */
type SimpleIconsSearchPrimitive = string | number | boolean | null;
type SimpleIconsSearchEntry =
    | SimpleIconsSearchPrimitive
    | SimpleIconsSearchPrimitive[]
    | Record<string, SimpleIconsSearchPrimitive | SimpleIconsSearchPrimitive[]>;

interface SimpleIconsMetadataItem {
    unicode?: string; // Unicode character code for the icon
    label?: string | null; // Display label for the icon
    search?: SimpleIconsSearchEntry; // Additional search terms
}

/**
 * Icon provider for Simple Icons web font.
 */
export class SimpleIconsProvider extends BaseFontIconProvider {
    readonly id = 'simple-icons';
    readonly name = 'Simple Icons';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-simple-icons';
    }

    /**
     * Parses Simple Icons metadata file.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, SimpleIconsMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            Object.entries(parsed).forEach(([iconId, data]) => {
                if (!this.isValidRecord(data)) {
                    return;
                }

                const unicode = data.unicode.trim();
                if (!unicode) {
                    return;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);

                const label = this.normalizeLabel(data.label);
                if (label) {
                    keywords.add(label.toLowerCase());
                }

                this.normalizeSearchTerms(data.search).forEach(term => {
                    keywords.add(term.toLowerCase());
                });

                iconId.split('-').forEach(part => {
                    const normalized = part.trim().toLowerCase();
                    if (normalized) {
                        keywords.add(normalized);
                    }
                });

                const displayName = label || this.formatDisplayName(iconId);
                const keywordList = Array.from(keywords);

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: keywordList
                });

                lookup.set(iconId, {
                    unicode,
                    keywords: keywordList
                });
            });

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    /**
     * Formats an icon ID into a human-readable display name.
     * Converts kebab-case to Title Case.
     */
    private formatDisplayName(iconId: string): string {
        return iconId
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    private isValidRecord(value: SimpleIconsMetadataItem | undefined): value is SimpleIconsMetadataItem & { unicode: string } {
        if (!value) {
            return false;
        }

        return typeof value.unicode === 'string';
    }

    private normalizeLabel(label: string | null | undefined): string | null {
        if (label === null || label === undefined) {
            return null;
        }

        if (typeof label !== 'string') {
            return null;
        }

        const trimmed = label.trim();
        if (!trimmed) {
            return null;
        }

        return trimmed;
    }

    private normalizeSearchTerms(search: SimpleIconsSearchEntry | undefined): string[] {
        if (search === null || search === undefined) {
            return [];
        }

        if (typeof search === 'string' || typeof search === 'number' || typeof search === 'boolean') {
            const normalized = String(search).trim();
            return normalized ? [normalized] : [];
        }

        if (Array.isArray(search)) {
            return this.collectKeywordsFromArray(search);
        }

        if (typeof search === 'object') {
            return this.collectKeywordsFromObject(search);
        }

        return [];
    }

    private collectKeywordsFromArray(entries: (SimpleIconsSearchPrimitive | SimpleIconsSearchPrimitive[])[]): string[] {
        const keywords: string[] = [];
        entries.forEach(entry => {
            if (Array.isArray(entry)) {
                entry.forEach(value => {
                    const normalized = this.normalizePrimitiveValue(value);
                    if (normalized) {
                        keywords.push(normalized);
                    }
                });
                return;
            }

            const normalized = this.normalizePrimitiveValue(entry);
            if (normalized) {
                keywords.push(normalized);
            }
        });

        return keywords;
    }

    private collectKeywordsFromObject(entries: Record<string, SimpleIconsSearchPrimitive | SimpleIconsSearchPrimitive[]>): string[] {
        const keywords: string[] = [];
        Object.values(entries).forEach(entry => {
            if (Array.isArray(entry)) {
                entry.forEach(value => {
                    const normalized = this.normalizePrimitiveValue(value);
                    if (normalized) {
                        keywords.push(normalized);
                    }
                });
                return;
            }

            const normalized = this.normalizePrimitiveValue(entry);
            if (normalized) {
                keywords.push(normalized);
            }
        });

        return keywords;
    }

    private normalizePrimitiveValue(value: SimpleIconsSearchPrimitive): string | null {
        if (value === null) {
            return null;
        }

        const normalized = String(value).trim();
        return normalized || null;
    }
}
