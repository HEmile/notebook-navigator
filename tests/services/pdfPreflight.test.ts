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

import { describe, expect, it, vi } from 'vitest';
import {
    getOperatorListMetrics,
    preflightPdfCoverThumbnailStageA,
    preflightPdfCoverThumbnailStageB,
    scanPdfBytes
} from '../../src/services/content/pdf/pdfPreflight';

function encodeBytes(value: string): Uint8Array {
    return new TextEncoder().encode(value);
}

describe('pdfPreflight scanPdfBytes', () => {
    it('parses direct /Width and /Height near /Subtype /Image', () => {
        const bytes = encodeBytes('<< /Type /XObject /Subtype /Image /Width 100 /Height 200 >>');
        const metrics = scanPdfBytes(bytes);

        expect(metrics.uncertain).toBe(false);
        expect(metrics.imageDictHits).toBe(1);
        expect(metrics.parsedDimsHits).toBe(1);
        expect(metrics.sumImagePixels).toBe(20_000);
        expect(metrics.maxImagePixels).toBe(20_000);
    });

    it('handles compact tokens and whitespace variants', () => {
        const bytes = encodeBytes('<<\n/Subtype/Image\n/Width\t10\n/Height 11\n/SMask true\n/S/Transparency\n>>');
        const metrics = scanPdfBytes(bytes);

        expect(metrics.uncertain).toBe(false);
        expect(metrics.imageDictHits).toBe(1);
        expect(metrics.parsedDimsHits).toBe(1);
        expect(metrics.sumImagePixels).toBe(110);
        expect(metrics.hasSoftMask).toBe(true);
        expect(metrics.hasTransparencyGroup).toBe(true);
    });

    it('keeps scanning when an image dictionary dimensions use indirect references', () => {
        const bytes = encodeBytes('<< /Subtype /Image /Width 10 0 R /Height 20 >>');
        const metrics = scanPdfBytes(bytes);

        expect(metrics.imageDictHits).toBe(1);
        expect(metrics.parsedDimsHits).toBe(0);
        expect(metrics.sumImagePixels).toBe(0);
        expect(metrics.uncertain).toBe(false);
    });
});

describe('pdfPreflight getOperatorListMetrics', () => {
    it('counts image paint operators using pdfjs.OPS numeric ids', async () => {
        const pdfjs = {
            OPS: {
                beginGroup: 2,
                moveTo: 1,
                paintImageXObject: 10,
                paintInlineImageXObject: 11,
                paintJpegXObject: 12
            }
        };

        const page = {
            getOperatorList: async () => ({
                fnArray: [1, 2, 10, 10, 11, 12, 999],
                argsArray: [[], [], ['Im1'], ['Im1'], [{ width: 320, height: 180 }], ['Im2'], []]
            })
        };

        const metrics = await getOperatorListMetrics(pdfjs, page, { timeoutMs: 1_000 });

        expect(metrics.uncertain).toBe(false);
        expect(metrics.paintOps).toBe(4);
        expect(metrics.xObjectPaintOps).toBe(3);
        expect(metrics.inlinePaintOps).toBe(1);
        expect(metrics.maskPaintOps).toBe(0);
        expect(metrics.transparencyGroupOps).toBe(1);
        expect(metrics.uniqueXObjectIds).toBe(2);
        expect(metrics.maxInlineImagePixels).toBe(57_600);
        expect(metrics.operatorListLength).toBe(7);
        expect(metrics.timedOut).toBe(false);
        expect(metrics.opBreakdown.paintImageXObject).toBe(2);
        expect(metrics.opBreakdown.paintInlineImageXObject).toBe(1);
        expect(metrics.opBreakdown.paintJpegXObject).toBe(1);
    });

    it('fails closed on operator list timeout', async () => {
        vi.useFakeTimers();

        try {
            const pdfjs = {
                OPS: {
                    paintImageXObject: 10
                }
            };

            const page = {
                getOperatorList: async () => await new Promise(() => {})
            };

            const metricsPromise = getOperatorListMetrics(pdfjs, page, { timeoutMs: 10 });

            await vi.advanceTimersByTimeAsync(20);
            const metrics = await metricsPromise;

            expect(metrics.uncertain).toBe(true);
            expect(metrics.paintOps).toBe(0);
            expect(metrics.timedOut).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('fails closed when getOperatorList rejects', async () => {
        const pdfjs = {
            OPS: {
                paintImageXObject: 10
            }
        };

        const page = {
            getOperatorList: async () => await Promise.reject(new Error('operator list failed'))
        };

        const metrics = await getOperatorListMetrics(pdfjs, page, { timeoutMs: 1_000 });

        expect(metrics.uncertain).toBe(true);
        expect(metrics.paintOps).toBe(0);
        expect(metrics.timedOut).toBe(false);
    });
});

describe('pdfPreflight stage decisions', () => {
    const multipliers = { transparencyGroup: 1.5, softMask: 1.5 };

    it('stage A allows when dimensions are unresolved but scan is otherwise valid', () => {
        const bytes = encodeBytes('<< /Subtype /Image /Width 10 0 R /Height 20 >>');
        const decision = preflightPdfCoverThumbnailStageA({
            bytes,
            budgetBytes: 200_000_000
        });

        expect(decision.decision).toBe('render');
        expect(decision.reason).toBe('stageA.allow');
        expect(decision.metrics.scan.uncertain).toBe(false);
    });

    it('stage A does not skip based on summed image pixels across the PDF', () => {
        const bytes = encodeBytes(
            '<< /Subtype /Image /Width 1000 /Height 1000 >> ' +
                '<< /Subtype /Image /Width 1000 /Height 1000 >> ' +
                '<< /Subtype /Image /Width 1000 /Height 1000 >>'
        );
        const decision = preflightPdfCoverThumbnailStageA({
            bytes,
            budgetBytes: 8_000_000
        });

        expect(decision.decision).toBe('render');
        expect(decision.reason).toBe('stageA.allow');
        expect(decision.metrics.scan.maxImagePixels).toBe(1_000_000);
        expect(decision.metrics.scan.sumImagePixels).toBe(3_000_000);
    });

    it('stage A skips when a single decoded image is over budget', () => {
        const bytes = encodeBytes('<< /Subtype /Image /Width 20000 /Height 20000 >>');
        const decision = preflightPdfCoverThumbnailStageA({
            bytes,
            budgetBytes: 200_000_000
        });

        expect(decision.decision).toBe('skip');
        expect(decision.reason).toBe('stageA.maxImageOverBudget');
    });

    it('stage A clamps max image pixels to maxDecodedImagePixels', () => {
        const bytes = encodeBytes('<< /Subtype /Image /Width 20000 /Height 20000 >>');
        const decision = preflightPdfCoverThumbnailStageA({
            bytes,
            budgetBytes: 200_000_000,
            maxDecodedImagePixels: 10_000_000
        });

        expect(decision.decision).toBe('render');
        expect(decision.reason).toBe('stageA.allow');
        expect(decision.metrics.maxDecodedImagePixels).toBe(10_000_000);
    });

    it('stage B reports timeout-specific skip reason', async () => {
        vi.useFakeTimers();

        try {
            const pdfjs = {
                OPS: {
                    paintImageXObject: 10
                }
            };

            const page = {
                getOperatorList: async () => await new Promise(() => {}),
                getViewport: () => ({ width: 100, height: 100 })
            };

            const scan = {
                sumImagePixels: 0,
                maxImagePixels: 0,
                imageDictHits: 0,
                parsedDimsHits: 0,
                hasSoftMask: false,
                hasTransparencyGroup: false,
                uncertain: false
            };

            const decisionPromise = preflightPdfCoverThumbnailStageB({
                pdfjs,
                page,
                scan,
                budgetBytes: 200_000_000,
                timeoutMs: 10,
                viewportScale: 1,
                multipliers
            });

            await vi.advanceTimersByTimeAsync(20);
            const decision = await decisionPromise;

            expect(decision.decision).toBe('skip');
            expect(decision.reason).toBe('stageB.operatorListTimeout');
        } finally {
            vi.useRealTimers();
        }
    });

    it('stage B uses inline image dimensions when available', async () => {
        const pdfjs = {
            OPS: {
                paintInlineImageXObject: 11
            }
        };

        const page = {
            getOperatorList: async () => ({
                fnArray: [11],
                argsArray: [[{ width: 1200, height: 1200 }]]
            }),
            getViewport: () => ({ width: 200, height: 200 })
        };

        const scan = {
            sumImagePixels: 0,
            maxImagePixels: 0,
            imageDictHits: 0,
            parsedDimsHits: 0,
            hasSoftMask: false,
            hasTransparencyGroup: false,
            uncertain: false
        };

        const decision = await preflightPdfCoverThumbnailStageB({
            pdfjs,
            page,
            scan,
            budgetBytes: 1_000_000,
            timeoutMs: 1_000,
            viewportScale: 1,
            multipliers
        });

        expect(decision.decision).toBe('skip');
        expect(decision.reason).toBe('stageB.compositeOverBudget');
    });

    it('stage B uses unique xObject ids for the worst-case estimate when available', async () => {
        const pdfjs = {
            OPS: {
                paintImageXObject: 10
            }
        };

        const fnArray = Array.from({ length: 100 }, () => 10);
        const argsArray = Array.from({ length: 100 }, () => ['Im1']);

        const page = {
            getOperatorList: async () => ({
                fnArray,
                argsArray
            }),
            getViewport: () => ({ width: 100, height: 100 })
        };

        const scan = {
            sumImagePixels: 0,
            maxImagePixels: 0,
            imageDictHits: 0,
            parsedDimsHits: 0,
            hasSoftMask: false,
            hasTransparencyGroup: false,
            uncertain: false
        };

        const decision = await preflightPdfCoverThumbnailStageB({
            pdfjs,
            page,
            scan,
            budgetBytes: 200_000,
            timeoutMs: 1_000,
            viewportScale: 1,
            multipliers
        });

        expect(decision.decision).toBe('render');
        expect(decision.reason).toBe('stageB.allow');
        expect(decision.metrics.estimatedBytes).toBe(40_000);
    });

    it('stage B applies soft mask multiplier when scan detects /SMask', async () => {
        const pdfjs = {
            OPS: {
                paintImageXObject: 10
            }
        };

        const fnArray = Array.from({ length: 10 }, () => 10);
        const argsArray = Array.from({ length: 10 }, (_, index) => [`Im${index + 1}`]);

        const page = {
            getOperatorList: async () => ({
                fnArray,
                argsArray
            }),
            getViewport: () => ({ width: 100, height: 100 })
        };

        const scan = {
            sumImagePixels: 0,
            maxImagePixels: 0,
            imageDictHits: 0,
            parsedDimsHits: 0,
            hasSoftMask: true,
            hasTransparencyGroup: false,
            uncertain: false
        };

        const decision = await preflightPdfCoverThumbnailStageB({
            pdfjs,
            page,
            scan,
            budgetBytes: 500_000,
            timeoutMs: 1_000,
            viewportScale: 1,
            multipliers: { transparencyGroup: 1, softMask: 2 }
        });

        expect(decision.decision).toBe('skip');
        expect(decision.reason).toBe('stageB.compositeOverBudget');
        expect(decision.metrics.estimatedBytes).toBe(800_000);
    });

    it('stage B applies transparency multiplier when scan detects /S /Transparency', async () => {
        const pdfjs = {
            OPS: {
                paintImageXObject: 10
            }
        };

        const fnArray = Array.from({ length: 10 }, () => 10);
        const argsArray = Array.from({ length: 10 }, (_, index) => [`Im${index + 1}`]);

        const page = {
            getOperatorList: async () => ({
                fnArray,
                argsArray
            }),
            getViewport: () => ({ width: 100, height: 100 })
        };

        const scan = {
            sumImagePixels: 0,
            maxImagePixels: 0,
            imageDictHits: 0,
            parsedDimsHits: 0,
            hasSoftMask: false,
            hasTransparencyGroup: true,
            uncertain: false
        };

        const decision = await preflightPdfCoverThumbnailStageB({
            pdfjs,
            page,
            scan,
            budgetBytes: 500_000,
            timeoutMs: 1_000,
            viewportScale: 1,
            multipliers: { transparencyGroup: 2, softMask: 1 }
        });

        expect(decision.decision).toBe('skip');
        expect(decision.reason).toBe('stageB.compositeOverBudget');
        expect(decision.metrics.estimatedBytes).toBe(800_000);
    });

    it('stage B uses viewportScale when estimating page pixels', async () => {
        const pdfjs = {
            OPS: {
                paintImageXObject: 10
            }
        };

        const page = {
            getOperatorList: async () => ({
                fnArray: [10],
                argsArray: [['Im1']]
            }),
            getViewport: ({ scale }: { scale: number }) => ({ width: 2000 * scale, height: 2000 * scale })
        };

        const scan = {
            sumImagePixels: 0,
            maxImagePixels: 0,
            imageDictHits: 0,
            parsedDimsHits: 0,
            hasSoftMask: false,
            hasTransparencyGroup: false,
            uncertain: false
        };

        const decision = await preflightPdfCoverThumbnailStageB({
            pdfjs,
            page,
            scan,
            budgetBytes: 1_000_000,
            timeoutMs: 1_000,
            viewportScale: 0.1,
            multipliers: { transparencyGroup: 1, softMask: 1 }
        });

        expect(decision.decision).toBe('render');
        expect(decision.reason).toBe('stageB.allow');
        expect(decision.metrics.pagePixels).toBe(40_000);
        expect(decision.metrics.estimatedBytes).toBe(160_000);
    });
});
