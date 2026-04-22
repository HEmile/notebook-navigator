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

export type RasterDimensions = { width: number; height: number };
export type RasterDimensionsPair = { display: RasterDimensions; coded: RasterDimensions };

export function normalizeImageMimeType(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();

    switch (normalized) {
        case 'image/jpg':
        case 'image/pjpeg':
            return 'image/jpeg';
        case 'image/x-webp':
            return 'image/webp';
        case 'image/x-png':
        case 'image/apng':
            return 'image/png';
        case 'image/x-ms-bmp':
        case 'image/x-bmp':
            return 'image/bmp';
        case 'image/svg':
            return 'image/svg+xml';
        default:
            return normalized;
    }
}

type DetectedImageMimeType =
    | 'image/png'
    | 'image/gif'
    | 'image/jpeg'
    | 'image/webp'
    | 'image/bmp'
    | 'image/avif'
    | 'image/heic'
    | 'image/heif';

export function detectImageMimeTypeFromBuffer(buffer: ArrayBuffer): DetectedImageMimeType | null {
    const bytes = new Uint8Array(buffer);

    // ISO Base Media File Format (AVIF/HEIF/HEIC)
    // - 4 bytes: box size (BE)
    // - 4 bytes: 'ftyp'
    // - 4 bytes: major brand
    // - 4 bytes: minor version
    // - N*4 bytes: compatible brands
    if (bytes.length >= 16) {
        const view = new DataView(buffer);
        let cursor = 0;
        const maxScanBytes = 64 * 1024;
        const maxBoxes = 16;

        for (let i = 0; i < maxBoxes && cursor + 8 <= bytes.length && cursor < maxScanBytes; i += 1) {
            const size32 = view.getUint32(cursor, false);
            let headerSize = 8;
            let boxSize = size32;

            if (size32 === 0) {
                boxSize = bytes.length - cursor;
            } else if (size32 === 1) {
                if (cursor + 16 > bytes.length || typeof view.getBigUint64 !== 'function') {
                    break;
                }
                const size64 = view.getBigUint64(cursor + 8, false);
                if (size64 > BigInt(bytes.length - cursor) || size64 < BigInt(24)) {
                    break;
                }
                boxSize = Number(size64);
                headerSize = 16;
            }

            if (boxSize < headerSize) {
                break;
            }

            const declaredEnd = cursor + boxSize;
            if (declaredEnd <= cursor || declaredEnd > bytes.length) {
                break;
            }

            if (matchesAscii(bytes, cursor + 4, 'ftyp')) {
                if (boxSize < headerSize + 8) {
                    break;
                }

                const majorBrand = asciiSlice(bytes, cursor + headerSize, cursor + headerSize + 4);
                const brands = new Set<string>([majorBrand]);

                for (let offset = cursor + headerSize + 8; offset + 4 <= cursor + boxSize; offset += 4) {
                    brands.add(asciiSlice(bytes, offset, offset + 4));
                }

                // Prefer AVIF when any AVIF brand is present.
                if (brands.has('avif') || brands.has('avis')) {
                    return 'image/avif';
                }

                if (brands.has('heic') || brands.has('heix') || brands.has('hevc') || brands.has('hevx')) {
                    return 'image/heic';
                }

                if (brands.has('mif1') || brands.has('msf1')) {
                    return 'image/heif';
                }

                break;
            }

            cursor = declaredEnd;
        }
    }

    if (bytes.length < 2) {
        return null;
    }

    switch (bytes[0]) {
        case 0x89: {
            const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
            return bytes.length >= 8 && matchesBytes(bytes, 0, signature) ? 'image/png' : null;
        }
        case 0x47:
            return bytes.length >= 6 && matchesAscii(bytes, 0, 'GIF') ? 'image/gif' : null;
        case 0xff:
            return bytes.length >= 3 && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : null;
        case 0x42:
            return bytes[1] === 0x4d ? 'image/bmp' : null;
        case 0x52:
            // WebP begins with RIFF....WEBP and the first chunk starts with 'VP8'
            return bytes.length >= 16 && matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WEBP') && matchesAscii(bytes, 12, 'VP8')
                ? 'image/webp'
                : null;
        default:
            return null;
    }
}

// Extracts image dimensions from a buffer by parsing format-specific headers.
// Returns null for unsupported formats or malformed data.
export function getImageDimensionsFromBuffer(buffer: ArrayBuffer, mimeType: string): RasterDimensions | null {
    const normalizedMimeType = normalizeImageMimeType(mimeType);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    const initial = getImageDimensionsFromView(bytes, view, normalizedMimeType);
    if (initial) {
        return initial;
    }

    const detectedMimeType = detectImageMimeTypeFromBuffer(buffer);
    if (!detectedMimeType || detectedMimeType === normalizedMimeType) {
        return null;
    }

    return getImageDimensionsFromView(bytes, view, detectedMimeType);
}

export function getImageDimensionsPairFromBuffer(buffer: ArrayBuffer, mimeType: string): RasterDimensionsPair | null {
    const normalizedMimeType = normalizeImageMimeType(mimeType);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    const initial = getImageDimensionsPairFromView(bytes, view, normalizedMimeType);
    if (initial) {
        return initial;
    }

    const detectedMimeType = detectImageMimeTypeFromBuffer(buffer);
    if (!detectedMimeType || detectedMimeType === normalizedMimeType) {
        return null;
    }

    return getImageDimensionsPairFromView(bytes, view, detectedMimeType);
}

// Returns the best available coded (pre-crop) dimensions for decode safety heuristics.
// For ISO BMFF formats this uses 'ispe' extents without applying 'clap' or 'irot' transforms.
export function getImageCodedDimensionsFromBuffer(buffer: ArrayBuffer, mimeType: string): RasterDimensions | null {
    const normalizedMimeType = normalizeImageMimeType(mimeType);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    const initial = getImageCodedDimensionsFromView(bytes, view, normalizedMimeType);
    if (initial) {
        return initial;
    }

    const detectedMimeType = detectImageMimeTypeFromBuffer(buffer);
    if (!detectedMimeType || detectedMimeType === normalizedMimeType) {
        return null;
    }

    return getImageCodedDimensionsFromView(bytes, view, detectedMimeType);
}

function getImageDimensionsFromView(bytes: Uint8Array, view: DataView, mimeType: string): RasterDimensions | null {
    switch (mimeType) {
        case 'image/png':
            return getPngDimensions(bytes, view);
        case 'image/gif':
            return getGifDimensions(bytes, view);
        case 'image/jpeg':
            return getJpegDimensions(bytes, view);
        case 'image/webp':
            return getWebpDimensions(bytes, view);
        case 'image/bmp':
            return getBmpDimensions(bytes, view);
        case 'image/avif':
        case 'image/heic':
        case 'image/heif':
            return getIsobmffDimensions(bytes, view)?.display ?? null;
        default:
            return null;
    }
}

function getImageDimensionsPairFromView(bytes: Uint8Array, view: DataView, mimeType: string): RasterDimensionsPair | null {
    switch (mimeType) {
        case 'image/png': {
            const dimensions = getPngDimensions(bytes, view);
            return dimensions ? { display: dimensions, coded: dimensions } : null;
        }
        case 'image/gif': {
            const dimensions = getGifDimensions(bytes, view);
            return dimensions ? { display: dimensions, coded: dimensions } : null;
        }
        case 'image/jpeg': {
            const dimensions = getJpegDimensions(bytes, view);
            return dimensions ? { display: dimensions, coded: dimensions } : null;
        }
        case 'image/webp': {
            const dimensions = getWebpDimensions(bytes, view);
            return dimensions ? { display: dimensions, coded: dimensions } : null;
        }
        case 'image/bmp': {
            const dimensions = getBmpDimensions(bytes, view);
            return dimensions ? { display: dimensions, coded: dimensions } : null;
        }
        case 'image/avif':
        case 'image/heic':
        case 'image/heif':
            return getIsobmffDimensions(bytes, view);
        default:
            return null;
    }
}

function getImageCodedDimensionsFromView(bytes: Uint8Array, view: DataView, mimeType: string): RasterDimensions | null {
    switch (mimeType) {
        case 'image/png':
            return getPngDimensions(bytes, view);
        case 'image/gif':
            return getGifDimensions(bytes, view);
        case 'image/jpeg':
            return getJpegDimensions(bytes, view);
        case 'image/webp':
            return getWebpDimensions(bytes, view);
        case 'image/bmp':
            return getBmpDimensions(bytes, view);
        case 'image/avif':
        case 'image/heic':
        case 'image/heif':
            return getIsobmffDimensions(bytes, view)?.coded ?? null;
        default:
            return null;
    }
}

// Checks if byte values at offset match the expected pattern
function matchesBytes(bytes: Uint8Array, offset: number, pattern: number[]): boolean {
    if (offset < 0 || offset + pattern.length > bytes.length) {
        return false;
    }
    for (let i = 0; i < pattern.length; i += 1) {
        if (bytes[offset + i] !== pattern[i]) {
            return false;
        }
    }
    return true;
}

// Checks if bytes at offset match an ASCII string pattern
function matchesAscii(bytes: Uint8Array, offset: number, pattern: string): boolean {
    if (offset < 0 || offset + pattern.length > bytes.length) {
        return false;
    }
    for (let i = 0; i < pattern.length; i += 1) {
        if (bytes[offset + i] !== pattern.charCodeAt(i)) {
            return false;
        }
    }
    return true;
}

function asciiSlice(bytes: Uint8Array, start: number, end: number): string {
    if (start < 0 || end < start || end > bytes.length) {
        return '';
    }

    let value = '';
    for (let i = start; i < end; i += 1) {
        value += String.fromCharCode(bytes[i]);
    }
    return value;
}

// Parses PNG dimensions from the IHDR chunk (bytes 16-23 after signature)
function getPngDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 24 || !matchesBytes(bytes, 0, signature)) {
        return null;
    }

    // Some PNGs (notably iOS-optimized "fried" PNGs) include a leading CgBI chunk.
    // In that case the IHDR chunk appears after the CgBI chunk rather than at offset 12.
    const firstChunkTypeOffset = 12;
    let ihdrChunkStart = 8;

    if (matchesAscii(bytes, firstChunkTypeOffset, 'CgBI')) {
        if (bytes.length < 24) {
            return null;
        }

        const cgbiLength = view.getUint32(8, false);
        const nextChunkStart = 8 + 12 + cgbiLength;
        if (nextChunkStart + 24 > bytes.length) {
            return null;
        }

        ihdrChunkStart = nextChunkStart;
    }

    if (!matchesAscii(bytes, ihdrChunkStart + 4, 'IHDR')) {
        return null;
    }

    const width = view.getUint32(ihdrChunkStart + 8, false);
    const height = view.getUint32(ihdrChunkStart + 12, false);
    if (width <= 0 || height <= 0) {
        return null;
    }
    return { width, height };
}

// Parses GIF dimensions from the logical screen descriptor (bytes 6-9)
function getGifDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
    if (bytes.length < 10 || !matchesAscii(bytes, 0, 'GIF')) {
        return null;
    }

    if (bytes[3] !== 0x38 || (bytes[4] !== 0x37 && bytes[4] !== 0x39) || bytes[5] !== 0x61) {
        return null;
    }

    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    if (width <= 0 || height <= 0) {
        return null;
    }
    return { width, height };
}

// Parses JPEG dimensions by scanning for a Start of Frame (SOF) marker
function getJpegDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        return null;
    }

    // SOF markers (0xC0-0xCF except 0xC4, 0xC8, 0xCC) contain frame dimensions
    const isSofMarker = (marker: number) =>
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

    const getExifOrientation = (segmentStart: number, segmentEnd: number): number | null => {
        // APP1 Exif payload starts with "Exif\0\0" then TIFF header.
        if (segmentEnd - segmentStart < 14) {
            return null;
        }
        if (!matchesAscii(bytes, segmentStart, 'Exif') || bytes[segmentStart + 4] !== 0x00 || bytes[segmentStart + 5] !== 0x00) {
            return null;
        }

        const tiffStart = segmentStart + 6;
        if (tiffStart + 8 > segmentEnd) {
            return null;
        }

        const isLittleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
        const isBigEndian = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
        if (!isLittleEndian && !isBigEndian) {
            return null;
        }

        const littleEndian = isLittleEndian;
        if (view.getUint16(tiffStart + 2, littleEndian) !== 42) {
            return null;
        }

        const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
        if (ifd0Offset < 8 || ifd0Offset > segmentEnd - tiffStart - 2) {
            return null;
        }
        const ifd0Start = tiffStart + ifd0Offset;

        const entryCount = view.getUint16(ifd0Start, littleEndian);
        const entryStart = ifd0Start + 2;

        // Each IFD entry is 12 bytes; stop if the table would overrun the segment.
        const maxEntries = Math.floor((segmentEnd - entryStart) / 12);
        const safeCount = Math.min(entryCount, maxEntries);

        for (let i = 0; i < safeCount; i += 1) {
            const offset = entryStart + i * 12;
            const tag = view.getUint16(offset, littleEndian);
            if (tag !== 0x0112) {
                continue;
            }

            const type = view.getUint16(offset + 2, littleEndian);
            const count = view.getUint32(offset + 4, littleEndian);
            // Orientation is a SHORT with count 1.
            if (type !== 3 || count !== 1) {
                return null;
            }

            const orientation = view.getUint16(offset + 8, littleEndian);
            return orientation >= 1 && orientation <= 8 ? orientation : null;
        }

        return null;
    };

    let offset = 2;
    let width: number | null = null;
    let height: number | null = null;
    let orientation: number | null = null;
    while (offset + 3 < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
        }

        while (offset < bytes.length && bytes[offset] === 0xff) {
            offset += 1;
        }
        if (offset >= bytes.length) {
            break;
        }

        const marker = bytes[offset];
        offset += 1;

        if (marker === 0xd9 || marker === 0xda) {
            break;
        }
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
            continue;
        }

        if (offset + 1 >= bytes.length) {
            break;
        }
        const segmentLength = view.getUint16(offset, false);
        if (segmentLength < 2) {
            break;
        }
        const segmentEnd = offset + segmentLength;
        const segmentDataStart = offset + 2;
        if (segmentEnd > bytes.length) {
            break;
        }

        if (marker === 0xe1 && orientation === null) {
            const nextOrientation = getExifOrientation(segmentDataStart, segmentEnd);
            if (typeof nextOrientation === 'number') {
                orientation = nextOrientation;
            }
        }

        if (width === null && height === null && isSofMarker(marker)) {
            if (segmentDataStart + 5 > segmentEnd) {
                return null;
            }
            const nextHeight = view.getUint16(segmentDataStart + 1, false);
            const nextWidth = view.getUint16(segmentDataStart + 3, false);
            if (nextWidth <= 0 || nextHeight <= 0) {
                return null;
            }
            width = nextWidth;
            height = nextHeight;
        }

        if (width !== null && height !== null && orientation !== null) {
            break;
        }

        offset = segmentEnd;
    }

    if (width === null || height === null) {
        return null;
    }

    if (orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8) {
        return { width: height, height: width };
    }

    return { width, height };
}

// Parses WebP dimensions from VP8, VP8L (lossless), or VP8X (extended) chunks
function getWebpDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
    if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
        return null;
    }

    let offset = 12;
    while (offset + 8 <= bytes.length) {
        const chunkType = asciiSlice(bytes, offset, offset + 4);
        const chunkSize = view.getUint32(offset + 4, true);
        const chunkDataStart = offset + 8;

        if (chunkDataStart < offset) {
            return null;
        }

        const chunkEnd = chunkDataStart + chunkSize;
        if (chunkEnd > bytes.length) {
            return null;
        }

        // VP8 lossy format stores dimensions after a 3-byte frame tag signature
        if (chunkType === 'VP8 ') {
            if (chunkDataStart + 10 > chunkEnd) {
                return null;
            }
            if (bytes[chunkDataStart + 3] !== 0x9d || bytes[chunkDataStart + 4] !== 0x01 || bytes[chunkDataStart + 5] !== 0x2a) {
                return null;
            }
            const width = view.getUint16(chunkDataStart + 6, true) & 0x3fff;
            const height = view.getUint16(chunkDataStart + 8, true) & 0x3fff;
            if (width <= 0 || height <= 0) {
                return null;
            }
            return { width, height };
        }

        // VP8L lossless format packs width and height into a 32-bit value after a signature byte
        if (chunkType === 'VP8L') {
            if (chunkDataStart + 5 > chunkEnd) {
                return null;
            }
            if (bytes[chunkDataStart] !== 0x2f) {
                return null;
            }
            const packed = view.getUint32(chunkDataStart + 1, true);
            const width = (packed & 0x3fff) + 1;
            const height = ((packed >> 14) & 0x3fff) + 1;
            if (width <= 0 || height <= 0) {
                return null;
            }
            return { width, height };
        }

        // VP8X extended format stores canvas dimensions as 24-bit values
        if (chunkType === 'VP8X') {
            if (chunkDataStart + 10 > chunkEnd) {
                return null;
            }
            const widthMinusOne = bytes[chunkDataStart + 4] | (bytes[chunkDataStart + 5] << 8) | (bytes[chunkDataStart + 6] << 16);
            const heightMinusOne = bytes[chunkDataStart + 7] | (bytes[chunkDataStart + 8] << 8) | (bytes[chunkDataStart + 9] << 16);
            const width = widthMinusOne + 1;
            const height = heightMinusOne + 1;
            if (width <= 0 || height <= 0) {
                return null;
            }
            return { width, height };
        }

        // Chunks are padded to even sizes.
        const paddedChunkSize = chunkSize + (chunkSize % 2);
        const nextOffset = chunkDataStart + paddedChunkSize;
        if (nextOffset <= offset) {
            return null;
        }
        offset = nextOffset;
    }

    return null;
}

// Parses BMP dimensions from the DIB header, supporting BITMAPCOREHEADER and BITMAPINFOHEADER formats
function getBmpDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
    if (bytes.length < 26 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
        return null;
    }

    const dibHeaderSize = view.getUint32(14, true);
    // BITMAPCOREHEADER (OS/2 1.x) uses 16-bit dimensions
    if (dibHeaderSize === 12) {
        const width = view.getUint16(18, true);
        const height = view.getUint16(20, true);
        if (width <= 0 || height <= 0) {
            return null;
        }
        return { width, height };
    }

    // BITMAPINFOHEADER and later formats use signed 32-bit dimensions (height can be negative)
    if (dibHeaderSize >= 40) {
        const width = Math.abs(view.getInt32(18, true));
        const height = Math.abs(view.getInt32(22, true));
        if (width <= 0 || height <= 0) {
            return null;
        }
        return { width, height };
    }

    return null;
}

// Parses AVIF dimensions by scanning ISO base media file format boxes for the 'ispe' property
function getIsobmffDimensions(bytes: Uint8Array, view: DataView): { display: RasterDimensions; coded: RasterDimensions } | null {
    const bufferLength = bytes.length;
    const maxScanBytes = 512 * 1024;
    const scanLimit = Math.min(bufferLength, maxScanBytes);
    const isScanTruncated = scanLimit < bufferLength;
    const maxBoxes = 2000;
    const maxDepth = 32;
    let boxesScanned = 0;

    const getLargerDimensions = (current: RasterDimensions | null, candidate: RasterDimensions | null): RasterDimensions | null => {
        if (!candidate) {
            return current;
        }
        if (!current) {
            return candidate;
        }

        const candidateArea = candidate.width * candidate.height;
        const currentArea = current.width * current.height;
        return candidateArea > currentArea ? candidate : current;
    };

    type MetaParseResult = { dimensions: IsobmffDimensions; isPrimaryAssociated: boolean };
    type BoxInfo = { declaredEnd: number; payloadStart: number; payloadEnd: number; typeOffset: number };

    type IsobmffDimensions = { display: RasterDimensions; coded: RasterDimensions };

    type IpcoProperty =
        | { kind: 'ispe'; dimensions: RasterDimensions }
        | { kind: 'clap'; dimensions: RasterDimensions }
        | { kind: 'irot'; rotationDegrees: number };

    const readNextBox = (cursor: number, end: number): BoxInfo | null => {
        if (cursor + 8 > end || cursor + 8 > scanLimit) {
            return null;
        }

        if (boxesScanned >= maxBoxes) {
            return null;
        }
        boxesScanned += 1;

        const size32 = view.getUint32(cursor, false);
        const typeOffset = cursor + 4;
        let headerSize = 8;
        let boxSize = size32;

        if (size32 === 1) {
            if (cursor + 16 > scanLimit || typeof view.getBigUint64 !== 'function') {
                return null;
            }
            const size64 = view.getBigUint64(cursor + 8, false);
            if (size64 > BigInt(Number.MAX_SAFE_INTEGER)) {
                return null;
            }
            boxSize = Number(size64);
            headerSize = 16;
        } else if (size32 === 0) {
            boxSize = end - cursor;
        }

        if (boxSize < headerSize) {
            return null;
        }

        const declaredEnd = cursor + boxSize;
        if (declaredEnd <= cursor) {
            return null;
        }
        if (declaredEnd > end && !(isScanTruncated && end === scanLimit)) {
            return null;
        }

        const payloadStart = cursor + headerSize;
        const payloadEnd = Math.min(declaredEnd, end, scanLimit);
        if (payloadStart > payloadEnd) {
            return null;
        }

        return { declaredEnd, payloadStart, payloadEnd, typeOffset };
    };

    const readIspeBoxDimensions = (payloadStart: number, payloadEnd: number): RasterDimensions | null => {
        // 'ispe' is a FullBox:
        // - 4 bytes version/flags
        // - 4 bytes image_width
        // - 4 bytes image_height
        if (payloadStart + 12 > payloadEnd) {
            return null;
        }

        const width = view.getUint32(payloadStart + 4, false);
        const height = view.getUint32(payloadStart + 8, false);
        if (width <= 0 || height <= 0) {
            return null;
        }
        return { width, height };
    };

    const readClapBoxDimensions = (payloadStart: number, payloadEnd: number): RasterDimensions | null => {
        // 'clap' (Clean Aperture) contains rational fields:
        // - 8 x 4 bytes (uint32): widthN, widthD, heightN, heightD, horizOffN, horizOffD, vertOffN, vertOffD
        // This parser uses only the clean aperture width/height.
        const requiredBytes = 8 * 4;
        if (payloadStart + requiredBytes > payloadEnd) {
            return null;
        }

        const widthNumerator = view.getUint32(payloadStart, false);
        const widthDenominator = view.getUint32(payloadStart + 4, false);
        const heightNumerator = view.getUint32(payloadStart + 8, false);
        const heightDenominator = view.getUint32(payloadStart + 12, false);

        if (widthDenominator === 0 || heightDenominator === 0) {
            return null;
        }

        const width = Math.round(widthNumerator / widthDenominator);
        const height = Math.round(heightNumerator / heightDenominator);
        if (width <= 0 || height <= 0) {
            return null;
        }
        return { width, height };
    };

    const readIrotRotationDegrees = (payloadStart: number, payloadEnd: number): number | null => {
        // Reads the 'irot' item property.
        // Payload is 1 byte:
        // - lower 2 bits: angle (0..3) in 90-degree steps
        // - upper 6 bits: reserved
        const payloadLength = payloadEnd - payloadStart;
        if (payloadLength < 1) {
            return null;
        }

        const angleFromFirst = (bytes[payloadStart] & 0x03) * 90;

        // Some writers encode 'irot' as a FullBox (4 bytes version/flags + 1 byte angle).
        if (payloadLength >= 5) {
            const angleFromFullBox = (bytes[payloadStart + 4] & 0x03) * 90;

            const firstSwaps = angleFromFirst === 90 || angleFromFirst === 270;
            const fullBoxSwaps = angleFromFullBox === 90 || angleFromFullBox === 270;

            if (fullBoxSwaps && !firstSwaps) {
                return angleFromFullBox;
            }
            if (firstSwaps && !fullBoxSwaps) {
                return angleFromFirst;
            }
            if (firstSwaps && fullBoxSwaps && angleFromFirst !== angleFromFullBox) {
                return null;
            }
        }

        return angleFromFirst;
    };

    const applyClapAndRotation = (
        ispeDimensions: RasterDimensions,
        clapDimensions: RasterDimensions | null,
        rotationDegrees: number | null
    ): RasterDimensions => {
        let { width, height } = ispeDimensions;

        if (clapDimensions && clapDimensions.width > 0 && clapDimensions.height > 0) {
            const maxClapOvershootPixels = 1;

            const adjustedWidth =
                clapDimensions.width <= width
                    ? clapDimensions.width
                    : clapDimensions.width - width <= maxClapOvershootPixels
                      ? width
                      : null;

            const adjustedHeight =
                clapDimensions.height <= height
                    ? clapDimensions.height
                    : clapDimensions.height - height <= maxClapOvershootPixels
                      ? height
                      : null;

            if (adjustedWidth !== null && adjustedHeight !== null) {
                width = adjustedWidth;
                height = adjustedHeight;
            }
        }

        const shouldSwap = rotationDegrees === 90 || rotationDegrees === 270;
        if (shouldSwap) {
            return { width: height, height: width };
        }

        return { width, height };
    };

    const readPitmItemId = (payloadStart: number, payloadEnd: number): number | null => {
        // Reads the primary item id from 'pitm'.
        // 'pitm' is a FullBox:
        // - version 0: uint16 item_ID
        // - version 1: uint32 item_ID
        if (payloadStart + 6 > payloadEnd) {
            return null;
        }

        const version = bytes[payloadStart];
        if (version === 0) {
            const itemId = view.getUint16(payloadStart + 4, false);
            return itemId > 0 ? itemId : null;
        }

        if (version === 1) {
            if (payloadStart + 8 > payloadEnd) {
                return null;
            }
            const itemId = view.getUint32(payloadStart + 4, false);
            return itemId > 0 ? itemId : null;
        }

        return null;
    };

    const readIpmaPropertyIndicesForItem = (payloadStart: number, payloadEnd: number, targetItemId: number): number[] | null => {
        // Reads property indices for a specific item from 'ipma'.
        // 'ipma' is a FullBox. The flags indicate whether property indices are 7-bit or 15-bit.
        // Returns the raw 1-based property indices (matching ipco ordering), without mapping to property types.
        if (payloadStart + 8 > payloadEnd) {
            return null;
        }

        const version = bytes[payloadStart];
        if (version !== 0 && version !== 1) {
            return null;
        }
        const flags = (bytes[payloadStart + 1] << 16) | (bytes[payloadStart + 2] << 8) | bytes[payloadStart + 3];
        const entryCount = view.getUint32(payloadStart + 4, false);
        const uses16BitPropertyIndex = (flags & 0x01) !== 0;

        let cursor = payloadStart + 8;
        const bytesPerItemId = version === 0 ? 2 : 4;
        const minEntryBytes = bytesPerItemId + 1;
        const maxEntriesByBytes = minEntryBytes > 0 ? Math.floor((payloadEnd - cursor) / minEntryBytes) : 0;
        const maxIpmaEntries = 10000;
        const safeEntryCount = Math.min(entryCount, maxEntriesByBytes, maxIpmaEntries);

        if (safeEntryCount < entryCount) {
            return null;
        }

        for (let i = 0; i < safeEntryCount; i += 1) {
            let itemId: number;
            if (version === 0) {
                if (cursor + 2 > payloadEnd) {
                    return null;
                }
                itemId = view.getUint16(cursor, false);
                cursor += 2;
            } else {
                if (cursor + 4 > payloadEnd) {
                    return null;
                }
                itemId = view.getUint32(cursor, false);
                cursor += 4;
            }

            if (cursor + 1 > payloadEnd) {
                return null;
            }
            const associationCount = bytes[cursor];
            cursor += 1;

            const bytesPerAssociation = uses16BitPropertyIndex ? 2 : 1;
            const maxAssociationsByBytes = bytesPerAssociation > 0 ? Math.floor((payloadEnd - cursor) / bytesPerAssociation) : 0;
            const maxAssociationsPerEntry = 4096;
            if (associationCount > maxAssociationsByBytes || associationCount > maxAssociationsPerEntry) {
                return null;
            }

            const indices: number[] | null = itemId === targetItemId ? [] : null;
            for (let j = 0; j < associationCount; j += 1) {
                let propertyIndex: number;
                if (uses16BitPropertyIndex) {
                    if (cursor + 2 > payloadEnd) {
                        return null;
                    }
                    const value = view.getUint16(cursor, false);
                    cursor += 2;
                    propertyIndex = value & 0x7fff;
                } else {
                    if (cursor + 1 > payloadEnd) {
                        return null;
                    }
                    const value = bytes[cursor];
                    cursor += 1;
                    propertyIndex = value & 0x7f;
                }

                // The association entry also contains an "essential" bit; it is ignored for dimension parsing.
                if (indices && propertyIndex > 0) {
                    indices.push(propertyIndex);
                }
            }

            if (itemId === targetItemId) {
                return indices && indices.length > 0 ? indices : null;
            }
        }

        return null;
    };

    const getUniqueValueOrNull = (values: number[]): number | null => {
        // Some files associate multiple properties of the same kind.
        // Only apply a property when all encountered values match.
        if (values.length === 0) {
            return null;
        }
        const first = values[0];
        for (let i = 1; i < values.length; i += 1) {
            if (values[i] !== first) {
                return null;
            }
        }
        return first;
    };

    const getUniqueDimensionsOrNull = (values: RasterDimensions[]): RasterDimensions | null => {
        if (values.length === 0) {
            return null;
        }
        const first = values[0];
        for (let i = 1; i < values.length; i += 1) {
            const current = values[i];
            if (current.width !== first.width || current.height !== first.height) {
                return null;
            }
        }
        return first;
    };

    const parseIpcoDimensions = (start: number, end: number): IsobmffDimensions | null => {
        // Heuristic ipco scan:
        // - collects all 'ispe' boxes (spatial extents) and nearby 'clap' crop boxes
        // - applies a single 'irot' only when there is exactly one ispe + one irot in the box range
        // This is used as a fallback when there is no usable meta/pitm/ipma association chain.
        type IspeBox = { offset: number; end: number; dimensions: RasterDimensions };
        type ClapBox = { offset: number; dimensions: RasterDimensions };
        type IrotBox = { rotationDegrees: number };

        const ispeBoxes: IspeBox[] = [];
        const clapBoxes: ClapBox[] = [];
        const irotBoxes: IrotBox[] = [];

        let cursor = start;
        for (;;) {
            const box = readNextBox(cursor, end);
            if (!box) {
                break;
            }
            const { declaredEnd, payloadStart, payloadEnd, typeOffset } = box;

            if (matchesAscii(bytes, typeOffset, 'ispe')) {
                const dimensions = readIspeBoxDimensions(payloadStart, payloadEnd);
                if (dimensions) {
                    ispeBoxes.push({ offset: cursor, end: declaredEnd, dimensions });
                }
            } else if (matchesAscii(bytes, typeOffset, 'clap')) {
                const clapDimensions = readClapBoxDimensions(payloadStart, payloadEnd);
                if (clapDimensions) {
                    clapBoxes.push({ offset: cursor, dimensions: clapDimensions });
                }
            } else if (matchesAscii(bytes, typeOffset, 'irot')) {
                const rotationDegrees = readIrotRotationDegrees(payloadStart, payloadEnd);
                if (rotationDegrees !== null) {
                    irotBoxes.push({ rotationDegrees });
                }
            }

            cursor = declaredEnd;
        }

        if (ispeBoxes.length === 0) {
            return null;
        }

        let bestDisplay: RasterDimensions | null = null;
        let bestCoded: RasterDimensions | null = null;
        let currentOffset = start;
        let clapIndex = 0;

        // Without ipma associations there is no reliable mapping from irot -> a specific ispe.
        // Only apply rotation when there is a single candidate.
        const shouldSwap =
            ispeBoxes.length === 1 &&
            irotBoxes.length === 1 &&
            (irotBoxes[0].rotationDegrees === 90 || irotBoxes[0].rotationDegrees === 270);
        const rotationDegrees = shouldSwap ? irotBoxes[0].rotationDegrees : null;

        for (const ispeBox of ispeBoxes) {
            if (ispeBox.offset < currentOffset) {
                continue;
            }

            while (clapIndex < clapBoxes.length && clapBoxes[clapIndex].offset < currentOffset) {
                clapIndex += 1;
            }

            let clapDimensions: RasterDimensions | null = null;
            const clap = clapBoxes[clapIndex];
            if (clap) {
                clapDimensions = clap.dimensions;
            }

            const displayCandidate = applyClapAndRotation(ispeBox.dimensions, clapDimensions, rotationDegrees);
            bestDisplay = getLargerDimensions(bestDisplay, displayCandidate);
            bestCoded = getLargerDimensions(bestCoded, ispeBox.dimensions);
            currentOffset = ispeBox.end;
        }

        if (!bestDisplay || !bestCoded) {
            return null;
        }
        return { display: bestDisplay, coded: bestCoded };
    };

    const parseIpcoPropertyList = (start: number, end: number): (IpcoProperty | null)[] | null => {
        // Parses the ipco property list into an index-addressable array.
        // ipma refers to properties using 1-based indices, so index 0 is padded as null.
        const properties: (IpcoProperty | null)[] = [null];

        let cursor = start;
        for (;;) {
            const box = readNextBox(cursor, end);
            if (!box) {
                break;
            }
            const { declaredEnd, payloadStart, payloadEnd, typeOffset } = box;

            let property: IpcoProperty | null = null;
            if (matchesAscii(bytes, typeOffset, 'ispe')) {
                const dimensions = readIspeBoxDimensions(payloadStart, payloadEnd);
                if (dimensions) {
                    property = { kind: 'ispe', dimensions };
                }
            } else if (matchesAscii(bytes, typeOffset, 'clap')) {
                const dimensions = readClapBoxDimensions(payloadStart, payloadEnd);
                if (dimensions) {
                    property = { kind: 'clap', dimensions };
                }
            } else if (matchesAscii(bytes, typeOffset, 'irot')) {
                const rotationDegrees = readIrotRotationDegrees(payloadStart, payloadEnd);
                if (rotationDegrees !== null) {
                    property = { kind: 'irot', rotationDegrees };
                }
            }

            properties.push(property);
            cursor = declaredEnd;
        }

        return properties.length > 1 ? properties : null;
    };

    const parseIprpLayout = (
        start: number,
        end: number
    ): { ipcoStart: number; ipcoEnd: number; ipmaPayloadStart: number | null; ipmaPayloadEnd: number | null } | null => {
        let ipcoStart: number | null = null;
        let ipcoEnd: number | null = null;
        let ipmaPayloadStart: number | null = null;
        let ipmaPayloadEnd: number | null = null;

        let cursor = start;
        for (;;) {
            const box = readNextBox(cursor, end);
            if (!box) {
                break;
            }
            const { declaredEnd, payloadStart, payloadEnd, typeOffset } = box;

            if (matchesAscii(bytes, typeOffset, 'ipco')) {
                ipcoStart = payloadStart;
                ipcoEnd = payloadEnd;
            } else if (matchesAscii(bytes, typeOffset, 'ipma')) {
                ipmaPayloadStart = payloadStart;
                ipmaPayloadEnd = payloadEnd;
            }

            cursor = declaredEnd;
        }

        if (ipcoStart === null || ipcoEnd === null) {
            return null;
        }

        return { ipcoStart, ipcoEnd, ipmaPayloadStart, ipmaPayloadEnd };
    };

    const parseIprpAssociatedDimensions = (
        ipcoStart: number,
        ipcoEnd: number,
        ipmaPayloadStart: number,
        ipmaPayloadEnd: number,
        primaryItemId: number
    ): IsobmffDimensions | null => {
        const propertyIndices = readIpmaPropertyIndicesForItem(ipmaPayloadStart, ipmaPayloadEnd, primaryItemId);
        if (!propertyIndices) {
            return null;
        }

        const properties = parseIpcoPropertyList(ipcoStart, ipcoEnd);
        if (!properties) {
            return null;
        }

        const ispeDimensions: RasterDimensions[] = [];
        const clapDimensionsValues: RasterDimensions[] = [];
        const irotRotationDegreesValues: number[] = [];

        for (const propertyIndex of propertyIndices) {
            const property = properties[propertyIndex];
            if (!property) {
                continue;
            }

            if (property.kind === 'ispe') {
                ispeDimensions.push(property.dimensions);
            } else if (property.kind === 'clap') {
                clapDimensionsValues.push(property.dimensions);
            } else if (property.kind === 'irot') {
                irotRotationDegreesValues.push(property.rotationDegrees);
            }
        }

        if (ispeDimensions.length === 0) {
            return null;
        }

        const clapDimensions = getUniqueDimensionsOrNull(clapDimensionsValues);
        const rotationDegrees = getUniqueValueOrNull(irotRotationDegreesValues);

        let bestDisplay: RasterDimensions | null = null;
        let bestCoded: RasterDimensions | null = null;
        for (const dimensions of ispeDimensions) {
            const displayCandidate = applyClapAndRotation(dimensions, clapDimensions, rotationDegrees);
            bestDisplay = getLargerDimensions(bestDisplay, displayCandidate);
            bestCoded = getLargerDimensions(bestCoded, dimensions);
        }

        if (!bestDisplay || !bestCoded) {
            return null;
        }

        return { display: bestDisplay, coded: bestCoded };
    };

    const parseIprpDimensions = (start: number, end: number, primaryItemId: number | null): RasterDimensions | null => {
        // Parses 'iprp' to locate:
        // - 'ipco' (item properties)
        // - 'ipma' (item-property associations)
        //
        // If primaryItemId is provided and an ipma mapping exists, applies only properties associated with that item.
        // Otherwise falls back to an ipco-only heuristic scan.
        const layout = parseIprpLayout(start, end);
        if (!layout) {
            return null;
        }

        const { ipcoStart, ipcoEnd, ipmaPayloadStart, ipmaPayloadEnd } = layout;

        if (primaryItemId === null || ipmaPayloadStart === null || ipmaPayloadEnd === null) {
            return parseIpcoDimensions(ipcoStart, ipcoEnd)?.display ?? null;
        }

        const associated = parseIprpAssociatedDimensions(ipcoStart, ipcoEnd, ipmaPayloadStart, ipmaPayloadEnd, primaryItemId);
        if (!associated) {
            return parseIpcoDimensions(ipcoStart, ipcoEnd)?.display ?? null;
        }

        return associated.display;
    };

    const parseMetaDimensions = (start: number, end: number): MetaParseResult | null => {
        // Parses 'meta' to extract the primary item id ('pitm') and the property container ('iprp').
        // meta is a FullBox; callers pass the region after its 4-byte version/flags.
        let primaryItemId: number | null = null;
        let iprpStart: number | null = null;
        let iprpEnd: number | null = null;

        let cursor = start;
        for (;;) {
            const box = readNextBox(cursor, end);
            if (!box) {
                break;
            }
            const { declaredEnd, payloadStart, payloadEnd, typeOffset } = box;

            if (matchesAscii(bytes, typeOffset, 'pitm')) {
                primaryItemId = readPitmItemId(payloadStart, payloadEnd) ?? primaryItemId;
            } else if (matchesAscii(bytes, typeOffset, 'iprp')) {
                iprpStart = payloadStart;
                iprpEnd = payloadEnd;
            }

            cursor = declaredEnd;
        }

        if (iprpStart === null || iprpEnd === null) {
            return null;
        }

        const layout = parseIprpLayout(iprpStart, iprpEnd);
        if (!layout) {
            return null;
        }

        if (primaryItemId !== null && layout.ipmaPayloadStart !== null && layout.ipmaPayloadEnd !== null) {
            const associated = parseIprpAssociatedDimensions(
                layout.ipcoStart,
                layout.ipcoEnd,
                layout.ipmaPayloadStart,
                layout.ipmaPayloadEnd,
                primaryItemId
            );
            if (associated) {
                return { dimensions: associated, isPrimaryAssociated: true };
            }
        }

        const fallback = parseIpcoDimensions(layout.ipcoStart, layout.ipcoEnd);
        return fallback ? { dimensions: fallback, isPrimaryAssociated: false } : null;
    };

    // Recursively scans ISOBMFF boxes to find the 'ispe' (image spatial extents) property
    const scanBoxes = (start: number, end: number, depth: number): RasterDimensions | null => {
        if (depth > maxDepth) {
            return null;
        }

        let best: RasterDimensions | null = null;
        let cursor = start;
        for (;;) {
            const box = readNextBox(cursor, end);
            if (!box) {
                break;
            }
            const { declaredEnd, payloadStart, payloadEnd, typeOffset } = box;

            if (matchesAscii(bytes, typeOffset, 'meta')) {
                // meta is a FullBox; children begin after version/flags (4 bytes).
                const metaChildrenStart = payloadStart + 4;
                if (metaChildrenStart < payloadEnd) {
                    const metaResult = parseMetaDimensions(metaChildrenStart, payloadEnd);
                    if (metaResult) {
                        if (metaResult.isPrimaryAssociated) {
                            return metaResult.dimensions.display;
                        }
                        best = getLargerDimensions(best, metaResult.dimensions.display);
                    } else {
                        const found = scanBoxes(metaChildrenStart, payloadEnd, depth + 1);
                        if (found) {
                            best = getLargerDimensions(best, found);
                        }
                    }
                }
            } else if (matchesAscii(bytes, typeOffset, 'iprp')) {
                if (payloadStart < payloadEnd) {
                    // iprp can appear inside meta or at top-level depending on the file.
                    const iprpBest = parseIprpDimensions(payloadStart, payloadEnd, null);
                    if (iprpBest) {
                        best = getLargerDimensions(best, iprpBest);
                    } else {
                        const found = scanBoxes(payloadStart, payloadEnd, depth + 1);
                        if (found) {
                            best = getLargerDimensions(best, found);
                        }
                    }
                }
            } else if (matchesAscii(bytes, typeOffset, 'ipco')) {
                best = getLargerDimensions(best, parseIpcoDimensions(payloadStart, payloadEnd)?.display ?? null);
            } else if (matchesAscii(bytes, typeOffset, 'ispe')) {
                best = getLargerDimensions(best, readIspeBoxDimensions(payloadStart, payloadEnd));
            }

            cursor = declaredEnd;
        }
        return best;
    };

    if (bufferLength < 16) {
        return null;
    }

    let hasFtyp = false;
    {
        let cursor = 0;
        const maxFtypBoxes = 16;
        const maxFtypScanBytes = 64 * 1024;
        for (let i = 0; i < maxFtypBoxes && cursor < maxFtypScanBytes; i += 1) {
            const box = readNextBox(cursor, bufferLength);
            if (!box) {
                break;
            }
            if (matchesAscii(bytes, box.typeOffset, 'ftyp')) {
                hasFtyp = true;
                break;
            }
            cursor = box.declaredEnd;
        }
    }

    if (!hasFtyp) {
        return null;
    }

    const display = scanBoxes(0, bufferLength, 0);
    if (!display) {
        return null;
    }

    // Coded dimensions are computed independently so decode safety heuristics remain conservative.
    boxesScanned = 0;
    const coded = scanBoxesForCodedIspe(0, bufferLength, 0);
    if (!coded) {
        return null;
    }

    return { display, coded };

    function scanBoxesForCodedIspe(start: number, end: number, depth: number): RasterDimensions | null {
        if (depth > maxDepth) {
            return null;
        }

        let best: RasterDimensions | null = null;
        let cursor = start;
        for (;;) {
            const box = readNextBox(cursor, end);
            if (!box) {
                break;
            }
            const { declaredEnd, payloadStart, payloadEnd, typeOffset } = box;

            if (matchesAscii(bytes, typeOffset, 'meta')) {
                const metaChildrenStart = payloadStart + 4;
                if (metaChildrenStart < payloadEnd) {
                    const found = scanBoxesForCodedIspe(metaChildrenStart, payloadEnd, depth + 1);
                    if (found) {
                        best = getLargerDimensions(best, found);
                    }
                }
            } else if (matchesAscii(bytes, typeOffset, 'iprp')) {
                if (payloadStart < payloadEnd) {
                    const iprpLayout = parseIprpLayout(payloadStart, payloadEnd);
                    if (iprpLayout) {
                        const ipcoBest = parseIpcoIspeDimensions(iprpLayout.ipcoStart, iprpLayout.ipcoEnd);
                        best = getLargerDimensions(best, ipcoBest);
                    } else {
                        const found = scanBoxesForCodedIspe(payloadStart, payloadEnd, depth + 1);
                        if (found) {
                            best = getLargerDimensions(best, found);
                        }
                    }
                }
            } else if (matchesAscii(bytes, typeOffset, 'ipco')) {
                best = getLargerDimensions(best, parseIpcoIspeDimensions(payloadStart, payloadEnd));
            } else if (matchesAscii(bytes, typeOffset, 'ispe')) {
                best = getLargerDimensions(best, readIspeBoxDimensions(payloadStart, payloadEnd));
            }

            cursor = declaredEnd;
        }
        return best;
    }

    function parseIpcoIspeDimensions(start: number, end: number): RasterDimensions | null {
        let best: RasterDimensions | null = null;
        let cursor = start;
        for (;;) {
            const box = readNextBox(cursor, end);
            if (!box) {
                break;
            }
            const { declaredEnd, payloadStart, payloadEnd, typeOffset } = box;

            if (matchesAscii(bytes, typeOffset, 'ispe')) {
                best = getLargerDimensions(best, readIspeBoxDimensions(payloadStart, payloadEnd));
            }

            cursor = declaredEnd;
        }
        return best;
    }
}
