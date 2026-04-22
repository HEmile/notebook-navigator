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

import { describe, expect, it } from 'vitest';
import { getImageCodedDimensionsFromBuffer, getImageDimensionsFromBuffer } from '../../src/services/content/thumbnail/imageDimensions';

function ascii4(value: string): Uint8Array {
    if (value.length !== 4) {
        throw new Error(`Expected a 4-character ASCII string, got "${value}"`);
    }

    return new Uint8Array([value.charCodeAt(0), value.charCodeAt(1), value.charCodeAt(2), value.charCodeAt(3)]);
}

function be32(value: number): Uint8Array {
    return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const part of parts) {
        totalLength += part.length;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

function fullBox(version: number, flags: number, payload: Uint8Array): Uint8Array {
    const header = new Uint8Array(4);
    header[0] = version & 0xff;
    header[1] = (flags >>> 16) & 0xff;
    header[2] = (flags >>> 8) & 0xff;
    header[3] = flags & 0xff;

    return concatBytes([header, payload]);
}

function box(type: string, payload: Uint8Array): Uint8Array {
    const size = 8 + payload.length;
    const data = new Uint8Array(size);
    data.set(be32(size), 0);
    data.set(ascii4(type), 4);
    data.set(payload, 8);
    return data;
}

function ftypBox(majorBrand: string, compatibleBrands: string[]): Uint8Array {
    const minorVersion = be32(0);
    const brands: Uint8Array[] = [ascii4(majorBrand), minorVersion];
    for (const brand of compatibleBrands) {
        brands.push(ascii4(brand));
    }
    return box('ftyp', concatBytes(brands));
}

function clapPayload(width: number, height: number): Uint8Array {
    return concatBytes([be32(width), be32(1), be32(height), be32(1), be32(0), be32(1), be32(0), be32(1)]);
}

describe('getImageDimensionsFromBuffer', () => {
    it('parses PNG dimensions', () => {
        const bytes = new Uint8Array(24);
        bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
        bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
        bytes.set([0x49, 0x48, 0x44, 0x52], 12);
        bytes.set([0x00, 0x00, 0x01, 0x2c], 16);
        bytes.set([0x00, 0x00, 0x00, 0xc8], 20);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/png')).toEqual({ width: 300, height: 200 });
    });

    it('normalizes PNG mime type aliases', () => {
        const bytes = new Uint8Array(24);
        bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
        bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
        bytes.set([0x49, 0x48, 0x44, 0x52], 12);
        bytes.set([0x00, 0x00, 0x01, 0x2c], 16);
        bytes.set([0x00, 0x00, 0x00, 0xc8], 20);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/x-png')).toEqual({ width: 300, height: 200 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/apng')).toEqual({ width: 300, height: 200 });
    });

    it('parses GIF dimensions', () => {
        const bytes = new Uint8Array(10);
        bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
        bytes.set([0x40, 0x01], 6);
        bytes.set([0xf0, 0x00], 8);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/gif')).toEqual({ width: 320, height: 240 });
    });

    it('parses JPEG SOF dimensions', () => {
        const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x03, 0xff, 0xd9]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/jpeg')).toEqual({ width: 300, height: 200 });
    });

    it('applies JPEG EXIF orientation', () => {
        const bytes = new Uint8Array([
            // SOI
            0xff, 0xd8,
            // APP1 (Exif) marker + length (0x0022 = 34 bytes, includes these two bytes)
            0xff, 0xe1, 0x00, 0x22,
            // "Exif\0\0"
            0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
            // TIFF header (MM, 42, IFD0 offset = 8)
            0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
            // IFD0 entry count = 1
            0x00, 0x01,
            // Tag = 0x0112 (orientation), Type = 3 (SHORT), Count = 1
            0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,
            // Value = 6 (rotate 90) stored inline for SHORT
            0x00, 0x06, 0x00, 0x00,
            // Next IFD offset = 0
            0x00, 0x00, 0x00, 0x00,
            // SOF0 marker (width=300, height=200)
            0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x03,
            // EOI
            0xff, 0xd9
        ]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/jpeg')).toEqual({ width: 200, height: 300 });
    });

    it('applies JPEG EXIF orientation (little endian)', () => {
        const bytes = new Uint8Array([
            // SOI
            0xff, 0xd8,
            // APP1 (Exif) marker + length (0x0022 = 34 bytes, includes these two bytes)
            0xff, 0xe1, 0x00, 0x22,
            // "Exif\0\0"
            0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
            // TIFF header (II, 42, IFD0 offset = 8)
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
            // IFD0 entry count = 1
            0x01, 0x00,
            // Tag = 0x0112 (orientation), Type = 3 (SHORT), Count = 1
            0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
            // Value = 8 stored inline for SHORT
            0x08, 0x00, 0x00, 0x00,
            // Next IFD offset = 0
            0x00, 0x00, 0x00, 0x00,
            // SOF0 marker (width=300, height=200)
            0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x03,
            // EOI
            0xff, 0xd9
        ]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/jpeg')).toEqual({ width: 200, height: 300 });
    });

    it('parses JPEG SOF dimensions when trailing segments are truncated', () => {
        const bytes = new Uint8Array([
            // SOI
            0xff, 0xd8,
            // SOF0 marker (width=300, height=200)
            0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x03,
            // APP2 marker with declared length extending past the buffer
            0xff, 0xe2, 0x00, 0x10, 0x00
        ]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/jpeg')).toEqual({ width: 300, height: 200 });
    });

    it('normalizes JPEG mime type aliases', () => {
        const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x03, 0xff, 0xd9]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/jpg')).toEqual({ width: 300, height: 200 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/pjpeg')).toEqual({ width: 300, height: 200 });
    });

    it('parses WebP VP8X dimensions', () => {
        const bytes = new Uint8Array(30);
        bytes.set([0x52, 0x49, 0x46, 0x46], 0);
        bytes.set([0x57, 0x45, 0x42, 0x50], 8);
        bytes.set([0x56, 0x50, 0x38, 0x58], 12);
        bytes.set([0x0a, 0x00, 0x00, 0x00], 16);
        bytes.set([0x2b, 0x01, 0x00], 24);
        bytes.set([0xc7, 0x00, 0x00], 27);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/webp')).toEqual({ width: 300, height: 200 });
    });

    it('normalizes WebP mime type aliases', () => {
        const bytes = new Uint8Array(30);
        bytes.set([0x52, 0x49, 0x46, 0x46], 0);
        bytes.set([0x57, 0x45, 0x42, 0x50], 8);
        bytes.set([0x56, 0x50, 0x38, 0x58], 12);
        bytes.set([0x0a, 0x00, 0x00, 0x00], 16);
        bytes.set([0x2b, 0x01, 0x00], 24);
        bytes.set([0xc7, 0x00, 0x00], 27);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/x-webp')).toEqual({ width: 300, height: 200 });
    });

    it('falls back to signature detection when mime type is wrong', () => {
        const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x03, 0xff, 0xd9]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/webp')).toEqual({ width: 300, height: 200 });
    });

    it('falls back to ISO BMFF detection when mime type is wrong and ftyp is not first box', () => {
        const leadingFree = box('free', new Uint8Array([]));
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const bytes = concatBytes([leadingFree, ftypBox('avif', ['avif']), ispe]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/png')).toEqual({ width: 300, height: 200 });
    });

    it('parses "fried" PNG dimensions with a leading CgBI chunk', () => {
        const bytes = new Uint8Array(48);
        bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

        // CgBI chunk
        bytes.set([0x00, 0x00, 0x00, 0x04], 8);
        bytes.set([0x43, 0x67, 0x42, 0x49], 12);

        // IHDR chunk after CgBI
        bytes.set([0x00, 0x00, 0x00, 0x0d], 24);
        bytes.set([0x49, 0x48, 0x44, 0x52], 28);
        bytes.set([0x00, 0x00, 0x01, 0x2c], 32);
        bytes.set([0x00, 0x00, 0x00, 0xc8], 36);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/png')).toEqual({ width: 300, height: 200 });
    });

    it('parses BMP dimensions', () => {
        const bytes = new Uint8Array(26);
        bytes.set([0x42, 0x4d], 0);
        bytes.set([0x28, 0x00, 0x00, 0x00], 14);
        bytes.set([0x2c, 0x01, 0x00, 0x00], 18);
        bytes.set([0xc8, 0x00, 0x00, 0x00], 22);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/bmp')).toEqual({ width: 300, height: 200 });
    });

    it('normalizes BMP mime type aliases', () => {
        const bytes = new Uint8Array(26);
        bytes.set([0x42, 0x4d], 0);
        bytes.set([0x28, 0x00, 0x00, 0x00], 14);
        bytes.set([0x2c, 0x01, 0x00, 0x00], 18);
        bytes.set([0xc8, 0x00, 0x00, 0x00], 22);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/x-ms-bmp')).toEqual({ width: 300, height: 200 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/x-bmp')).toEqual({ width: 300, height: 200 });
    });

    it('parses AVIF ispe dimensions', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const bytes = concatBytes([ftypBox('avif', ['avif']), ispe]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/avif')).toEqual({ width: 300, height: 200 });
    });

    it('parses AVIF dimensions when ftyp is not the first box', () => {
        const leadingFree = box('free', new Uint8Array([]));
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const bytes = concatBytes([leadingFree, ftypBox('avif', ['avif']), ispe]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/avif')).toEqual({ width: 300, height: 200 });
    });

    it('applies HEIC/HEIF/AVIF irot orientation', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const irot = box('irot', new Uint8Array([0x01]));
        const ipco = box('ipco', concatBytes([ispe, irot]));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), ipco]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 200, height: 300 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heif')).toEqual({ width: 200, height: 300 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/avif')).toEqual({ width: 200, height: 300 });
    });

    it('applies irot fullbox variant', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const irot = box('irot', fullBox(0, 0, new Uint8Array([0x01])));
        const ipco = box('ipco', concatBytes([ispe, irot]));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), ipco]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 200, height: 300 });
    });

    it('applies irot fullbox with non-zero flags', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const irot = box('irot', fullBox(0, 0x123456, new Uint8Array([0x01])));
        const ipco = box('ipco', concatBytes([ispe, irot]));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), ipco]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 200, height: 300 });
    });

    it('parses irot angle with reserved bits', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const irot = box('irot', new Uint8Array([0x81]));
        const ipco = box('ipco', concatBytes([ispe, irot]));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), ipco]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 200, height: 300 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heif')).toEqual({ width: 200, height: 300 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/avif')).toEqual({ width: 200, height: 300 });
    });

    it('uses HEIC/HEIF ipma associations to apply irot to primary item', () => {
        const pitm = box('pitm', fullBox(0, 0, new Uint8Array([0x00, 0x02])));

        const ispe1 = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const ispe2 = box('ispe', fullBox(0, 0, concatBytes([be32(500), be32(400)])));
        const irot = box('irot', new Uint8Array([0x01]));

        const ipco = box('ipco', concatBytes([ispe1, ispe2, irot]));
        const ipma = box('ipma', fullBox(0, 0, concatBytes([be32(1), new Uint8Array([0x00, 0x02, 0x02, 0x02, 0x03])])));

        const iprp = box('iprp', concatBytes([ipco, ipma]));
        const meta = box('meta', fullBox(0, 0, concatBytes([pitm, iprp])));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), meta]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 400, height: 500 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heif')).toEqual({ width: 400, height: 500 });
    });

    it('parses irot payloads that include extra bytes', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const irot = box('irot', new Uint8Array([0x01, 0xaa, 0xbb, 0xcc, 0x00, 0xdd]));
        const ipco = box('ipco', concatBytes([ispe, irot]));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), ipco]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 200, height: 300 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heif')).toEqual({ width: 200, height: 300 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/avif')).toEqual({ width: 200, height: 300 });
    });

    it('prefers HEIC/HEIF primary item dimensions over other ispe boxes', () => {
        const strayIspe = box('ispe', fullBox(0, 0, concatBytes([be32(1000), be32(1000)])));
        const pitm = box('pitm', fullBox(0, 0, new Uint8Array([0x00, 0x02])));

        const ispePrimary = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const irot = box('irot', new Uint8Array([0x01]));
        const ipco = box('ipco', concatBytes([ispePrimary, irot]));

        const ipma = box('ipma', fullBox(0, 0, concatBytes([be32(1), new Uint8Array([0x00, 0x02, 0x02, 0x01, 0x02])])));
        const iprp = box('iprp', concatBytes([ipco, ipma]));
        const meta = box('meta', fullBox(0, 0, concatBytes([pitm, iprp])));

        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), strayIspe, meta]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 200, height: 300 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heif')).toEqual({ width: 200, height: 300 });
    });

    it('parses HEIC/HEIF dimensions with an ispe box and clap crop right', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(124), be32(456)])));
        const clap = box('clap', clapPayload(123, 456));
        const ipco = box('ipco', concatBytes([ispe, clap]));
        const iprp = box('iprp', ipco);
        const meta = box('meta', fullBox(0, 0, iprp));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), meta]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 123, height: 456 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heif')).toEqual({ width: 123, height: 456 });
        expect(getImageCodedDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 124, height: 456 });
    });

    it('clamps HEIC/HEIF clap crop values that exceed ispe by 1px', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(124), be32(456)])));
        const clap = box('clap', clapPayload(125, 400));
        const ipco = box('ipco', concatBytes([ispe, clap]));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), ipco]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 124, height: 400 });
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heif')).toEqual({ width: 124, height: 400 });
    });

    it('ignores HEIC/HEIF clap crop values that exceed the width', () => {
        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(5), be32(10)])));
        const clap = box('clap', clapPayload(100, 10));
        const ipco = box('ipco', concatBytes([ispe, clap]));
        const iprp = box('iprp', ipco);
        const meta = box('meta', fullBox(0, 0, iprp));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), meta]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 5, height: 10 });
    });

    it('applies HEIC/HEIF crop and rotation together when uniquely associated', () => {
        const pitm = box('pitm', fullBox(0, 0, new Uint8Array([0x00, 0x02])));

        const ispe = box('ispe', fullBox(0, 0, concatBytes([be32(300), be32(200)])));
        const clap = box('clap', clapPayload(290, 200));
        const irot = box('irot', new Uint8Array([0x01]));
        const ipco = box('ipco', concatBytes([ispe, clap, irot]));

        const ipma = box('ipma', fullBox(0, 0, concatBytes([be32(1), new Uint8Array([0x00, 0x02, 0x03, 0x01, 0x02, 0x03])])));
        const iprp = box('iprp', concatBytes([ipco, ipma]));
        const meta = box('meta', fullBox(0, 0, concatBytes([pitm, iprp])));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), meta]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 200, height: 290 });
        expect(getImageCodedDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 300, height: 200 });
    });

    it('selects the largest HEIC/HEIF ispe dimensions when multiple boxes are present', () => {
        const ispe1 = box('ispe', fullBox(0, 0, concatBytes([be32(10), be32(10)])));
        const clap = box('clap', clapPayload(123, 456));
        const ispe2 = box('ispe', fullBox(0, 0, concatBytes([be32(124), be32(456)])));
        const ipco = box('ipco', concatBytes([ispe1, clap, ispe2]));
        const iprp = box('iprp', ipco);
        const meta = box('meta', fullBox(0, 0, iprp));
        const bytes = concatBytes([ftypBox('avif', ['avif', 'heic', 'mif1']), meta]);

        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/heic')).toEqual({ width: 123, height: 456 });
    });

    it('returns null for unknown mime types', () => {
        const bytes = new Uint8Array([0x00, 0x01, 0x02]);
        expect(getImageDimensionsFromBuffer(bytes.buffer, 'image/tiff')).toBeNull();
    });
});
