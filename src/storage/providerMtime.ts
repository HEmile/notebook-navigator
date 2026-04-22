import type { ContentProviderType } from '../interfaces/IContentProvider';

export type ProviderProcessedMtimeField = `${ContentProviderType}Mtime`;

function describeProvider(value: never): string {
    return String(value);
}

function assertNever(value: never): never {
    throw new Error(`Unsupported content provider type: ${describeProvider(value)}`);
}

export function getProviderProcessedMtimeField(provider: ContentProviderType): ProviderProcessedMtimeField {
    switch (provider) {
        case 'markdownPipeline':
            return 'markdownPipelineMtime';
        case 'tags':
            return 'tagsMtime';
        case 'metadata':
            return 'metadataMtime';
        case 'fileThumbnails':
            return 'fileThumbnailsMtime';
        default:
            return assertNever(provider);
    }
}
