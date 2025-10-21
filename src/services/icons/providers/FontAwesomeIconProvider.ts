import { IconDefinition } from '../types';
import { BaseFontIconProvider, BaseFontIconProviderOptions } from './BaseFontIconProvider';

interface FontAwesomeMetadataItem {
    unicode: string;
    label?: string;
    styles?: string[];
    search?: {
        terms?: string[];
    };
    aliases?: {
        names?: string[];
    };
}

/**
 * Icon provider for Font Awesome solid icons loaded from external assets.
 */
export class FontAwesomeIconProvider extends BaseFontIconProvider {
    readonly id = 'fontawesome-solid';
    readonly name = 'Font Awesome';

    constructor(options: BaseFontIconProviderOptions) {
        super(options);
    }

    protected getCssClass(): string {
        return 'nn-iconfont-fa-solid';
    }

    /**
     * Parses Font Awesome metadata, filtering for solid style icons.
     */
    protected parseMetadata(raw: string): void {
        try {
            const parsed = JSON.parse(raw) as Record<string, FontAwesomeMetadataItem>;
            const definitions: IconDefinition[] = [];
            const lookup = new Map<string, { unicode: string; keywords: string[] }>();

            for (const [iconId, data] of Object.entries(parsed)) {
                if (!data || !data.unicode) {
                    continue;
                }
                if (Array.isArray(data.styles) && !data.styles.includes('solid')) {
                    continue;
                }

                const keywords = new Set<string>();
                keywords.add(iconId);
                data.search?.terms?.forEach(term => keywords.add(term.toLowerCase()));
                data.aliases?.names?.forEach(alias => keywords.add(alias.toLowerCase()));

                const displayName = data.label || this.formatDisplayName(iconId);

                definitions.push({
                    id: iconId,
                    displayName,
                    keywords: Array.from(keywords)
                });
                lookup.set(iconId, {
                    unicode: data.unicode,
                    keywords: Array.from(keywords)
                });
            }

            this.setIconData(definitions, lookup);
        } catch (error) {
            this.logParseError('Failed to parse metadata', error);
            this.clearIconData();
        }
    }

    /**
     * Converts kebab-case icon ID to title case display name.
     */
    private formatDisplayName(iconId: string): string {
        return iconId
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}
