import { describe, expect, it } from 'vitest';

import type {
  DocumentDto,
  SpanMarkupDto,
  SpanMarkupNoteDto,
} from '@cadastre/api-contracts/verification';

import {
  markupCounts,
  markupNotes,
  markupSheets,
  markupUnitLine,
  spanMarkupOf,
} from './span-markup';

const t = (key: string, params?: Record<string, string | number>) =>
  params === undefined
    ? key
    : `${key}(${Object.entries(params)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')})`;

// PROJE44, sheet 7: six rooms, axes 1—3 and A—E, lengths in millimetres from
// the built-up area the design states (COMM-165).
const MARKED: SpanMarkupDto = {
  sheets: [
    {
      pageNumber: 7,
      imageUrl: 'https://store/page_007.png',
      rooms: 6,
      axes: 8,
    },
  ],
  unit: 'mm',
  unitBasis: 'BuiltUpArea',
  notes: [],
};

function aDocument(over: Partial<DocumentDto> = {}): DocumentDto {
  return {
    id: 'doc-1',
    firstPage: 7,
    lastPage: 9,
    type: 'sketch_project',
    classificationConfidence: 0.97,
    attestation: null,
    fields: [],
    archiveQrCheck: null,
    spanMarkup: MARKED,
    supersededById: null,
    supersededAt: null,
    ...over,
  };
}

describe('the span working drawn on the sheets', () => {
  it('is drawn for a design set that has one', () => {
    expect(spanMarkupOf(aDocument())).toBe(MARKED);
  });

  // Every other type, and a design set no run has marked up yet. The contract
  // does not tell the two apart, and neither does the screen.
  it('is nothing at all where the document carries none', () => {
    expect(spanMarkupOf(aDocument({ spanMarkup: null }))).toBeNull();
  });

  it('puts the sheets in the order of the sheets they were drawn on', () => {
    const markup: SpanMarkupDto = {
      ...MARKED,
      sheets: [
        { pageNumber: 9, imageUrl: null, rooms: 1, axes: 0 },
        {
          pageNumber: 7,
          imageUrl: 'https://store/page_007.png',
          rooms: 6,
          axes: 8,
        },
      ],
    };

    expect(markupSheets(markup).map(sheet => sheet.pageNumber)).toEqual([7, 9]);
  });

  it('leaves the markup it was given alone', () => {
    const sheets = MARKED.sheets;
    markupSheets(MARKED);
    expect(MARKED.sheets).toBe(sheets);
  });

  it('says what was put on a sheet', () => {
    expect(markupCounts(t, MARKED.sheets[0]!)).toBe(
      'span.markup.rooms(n=6) · span.markup.axes(n=8)',
    );
  });

  // Three of four real design sets mark no axes at all, so this is the common
  // answer and not a failure — and "Axes: 0" reads as a count that came out
  // empty rather than as a set that numbers none (ADR-0044).
  it('says in words that a sheet marks no axes, never “0”', () => {
    expect(
      markupCounts(t, { pageNumber: 15, imageUrl: null, rooms: 1, axes: 0 }),
    ).toBe('span.markup.rooms(n=1) · span.markup.axes_none');
  });

  it('says what the lengths are labelled in and what decided it', () => {
    expect(markupUnitLine(t, MARKED)).toBe(
      'span.markup.unit(unit=span.unit_name.mm) — span.markup.basis.BuiltUpArea',
    );
  });

  // Nothing decided the unit, so the picture labels its lengths «ед.» and does
  // not assume millimetres. The line says that, and says nothing about a basis
  // there was none of.
  it('says the unit was never decided where nothing decided it', () => {
    expect(markupUnitLine(t, { ...MARKED, unit: null, unitBasis: null })).toBe(
      'span.markup.unit_unknown',
    );
  });

  it('states the unit alone where nothing named the basis', () => {
    expect(markupUnitLine(t, { ...MARKED, unitBasis: null })).toBe(
      'span.markup.unit(unit=span.unit_name.mm)',
    );
  });
});

// ── Why the markup is short (COMM-171) ──────────────────────────────────────
// The run used to write one English sentence and the screen printed it as it
// came, so a Russian inspector read "No axis circles" (COMM-166). The contract
// carries a closed list of reasons now, and every one of them has a word in all
// three dictionaries.
describe('why the markup is short of what was asked for', () => {
  // A sheet that carries a working: it is the counts on these sheets that
  // decide whether a reason has already been said a line above.
  const DRAWN = { pageNumber: 7, imageUrl: null, rooms: 6, axes: 8 };

  const withNotes = (
    notes: SpanMarkupNoteDto[],
    over: Partial<SpanMarkupDto> = {},
  ): SpanMarkupDto => ({ ...MARKED, sheets: [DRAWN], notes, ...over });

  it('says nothing where the run marked up everything it was given', () => {
    expect(markupNotes(t, withNotes([]))).toEqual([]);
  });

  it('counts the sheets it could not mark up', () => {
    expect(
      markupNotes(t, withNotes([{ reason: 'SheetsUnmarked', sheets: 3 }])),
    ).toEqual(['span.markup.note.SheetsUnmarked(n=3)']);
  });

  // A label and a figure everywhere else, and one sheet said as one sheet: the
  // block never asks a count to agree in number with three languages at once.
  it('says one sheet as one sheet rather than as a figure', () => {
    expect(
      markupNotes(t, withNotes([{ reason: 'SheetsUnmarked', sheets: 1 }])),
    ).toEqual(['span.markup.note.SheetsUnmarked_one']);
  });

  // The contract fills `sheets` on this reason and on no other, but a null
  // still says something true without a number in it — «null лист» would not.
  it('says some sheets where the run sent no count', () => {
    expect(
      markupNotes(t, withNotes([{ reason: 'SheetsUnmarked', sheets: null }])),
    ).toEqual(['span.markup.note.SheetsUnmarked_some']);
  });

  // The three reasons the block already states in its own words a line above.
  // Printing them again puts the same sentence twice in one card, which reads
  // as two findings rather than one.
  it.each([
    [
      'no axes on any sheet',
      { reason: 'NoAxesOnSheets', sheets: null } as SpanMarkupNoteDto,
      { sheets: [{ ...DRAWN, axes: 0 }] },
    ],
    [
      'no room outlines read',
      { reason: 'NoRoomOutlines', sheets: null } as SpanMarkupNoteDto,
      { sheets: [{ ...DRAWN, rooms: 0 }] },
    ],
    [
      'no unit established',
      { reason: 'UnitUnestablished', sheets: null } as SpanMarkupNoteDto,
      { unit: null, unitBasis: null },
    ],
  ])('leaves %s to the line that already says it', (_what, note, over) => {
    expect(markupNotes(t, withNotes([note], over))).toEqual([]);
  });

  // The counts and the reasons are worked out apart on the server. Where they
  // disagree the caption above is the one that is wrong, and the reason is the
  // only thing on the card that says so — dropping it would leave the lie.
  it.each(['NoAxesOnSheets', 'NoRoomOutlines', 'UnitUnestablished'] as const)(
    'states %s where the sheets above do not say it',
    reason => {
      // `DRAWN` counts six outlines and eight axes and the markup names a unit,
      // so none of the three captions above says any of this.
      expect(markupNotes(t, withNotes([{ reason, sheets: null }]))).toEqual([
        `span.markup.note.${reason}`,
      ]);
    },
  );

  // The server declares the reasons in one order so that a reader meets them
  // in one order every time, whatever else is on the card.
  it('keeps the order the contract sent', () => {
    const notes: SpanMarkupNoteDto[] = [
      { reason: 'NoAxesOnSheets', sheets: null },
      { reason: 'NoRoomOutlines', sheets: null },
      { reason: 'UnitUnestablished', sheets: null },
      { reason: 'SheetsUnmarked', sheets: 4 },
    ];

    expect(markupNotes(t, withNotes(notes))).toEqual([
      'span.markup.note.NoAxesOnSheets',
      'span.markup.note.NoRoomOutlines',
      'span.markup.note.UnitUnestablished',
      'span.markup.note.SheetsUnmarked(n=4)',
    ]);
  });
});
