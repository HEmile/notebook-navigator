import { describe, expect, it } from 'vitest';
import { buildNoteCountDisplay } from '../../src/utils/noteCountFormatting';

describe('buildNoteCountDisplay', () => {
    it('formats separate current/descendant counts using a dot separator by default', () => {
        expect(buildNoteCountDisplay({ current: 2, descendants: 5, total: 7 }, true, true)).toEqual({
            shouldDisplay: true,
            label: '2 • 5'
        });

        expect(buildNoteCountDisplay({ current: 0, descendants: 5, total: 5 }, true, true)).toEqual({
            shouldDisplay: true,
            label: '• 5'
        });
    });

    it('formats separate current/descendant counts using a custom separator when provided', () => {
        expect(buildNoteCountDisplay({ current: 2, descendants: 5, total: 7 }, true, true, '↓')).toEqual({
            shouldDisplay: true,
            label: '2 ↓ 5'
        });
    });

    it('formats combined counts as a single number', () => {
        expect(buildNoteCountDisplay({ current: 2, descendants: 5, total: 7 }, true, false)).toEqual({
            shouldDisplay: true,
            label: '7'
        });

        expect(buildNoteCountDisplay({ current: 2, descendants: 5, total: 7 }, false, false)).toEqual({
            shouldDisplay: true,
            label: '2'
        });
    });
});
