import { describe, expect, it } from 'vitest';

import type {
  DocumentDto,
  SpanMarkupDto,
} from '@cadastre/api-contracts/verification';

import {
  markupCounts,
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
