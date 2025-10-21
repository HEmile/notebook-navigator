export interface UrlConfig {
    font: string;
    css?: string;
    metadata?: string;
}

export interface IconPackConfig {
    id: string;
    name: string;
    version: string;
    githubRepo?: string;
    files: {
        font: string;
        metadata: string;
        mimeType: string;
    };
    urls: (version: string) => UrlConfig;
    processMetadata?: (context: ProcessContext) => Promise<string>;
    checkVersion?: () => Promise<string>;
}

export interface ProcessContext {
    version: string;
    urls: UrlConfig;
    downloadText: (url: string) => Promise<string>;
    downloadBinary: (url: string) => Promise<Buffer>;
}

// Download utilities
export async function downloadBinary(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function downloadText(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}

// Version checking utilities
export async function checkGitHubVersion(repo: string): Promise<string> {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch GitHub release for ${repo}: ${response.status}`);
    }

    const data = (await response.json()) as { tag_name: string };
    // Remove 'v' prefix if present
    return data.tag_name.replace(/^v/, '');
}

export async function checkMaterialIconsVersion(): Promise<string> {
    const url = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch Material Icons CSS: ${response.status}`);
    }

    const css = await response.text();
    const versionMatch = css.match(/materialicons\/v(\d+)/);

    if (!versionMatch) {
        throw new Error('Could not find Material Icons version in CSS');
    }

    return versionMatch[1];
}

// Version comparison
export function compareVersions(current: string, latest: string): boolean {
    // Handle Material Icons special case (just numbers)
    if (/^\d+$/.test(current) && /^\d+$/.test(latest)) {
        return parseInt(latest) > parseInt(current);
    }

    // Handle semantic versions
    const currentParts = current.split('.').map(p => parseInt(p) || 0);
    const latestParts = latest.split('.').map(p => parseInt(p) || 0);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;

        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
    }

    return false;
}

// Utility functions
export function sortObject<T>(input: Record<string, T>): Record<string, T> {
    const sorted: Record<string, T> = {};
    Object.keys(input)
        .sort((a, b) => a.localeCompare(b))
        .forEach(key => {
            sorted[key] = input[key];
        });
    return sorted;
}

export function titleCaseFromSlug(slug: string): string {
    return slug
        .split(/[-_]/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
