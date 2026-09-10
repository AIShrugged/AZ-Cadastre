import { describe, expect, it } from 'vitest';

import type { FieldDto } from '@cadastre/api-contracts/verification';

import {
  ENTRIES_SHOWN,
  entriesOf,
  fieldAnchor,
  fieldRowId,
  FIELDS_BEFORE_FOLD,
  foldFields,
  holdsHash,
} from './field-layout';

const field = (name: string): FieldDto => ({
  name,
  value: '',
  confidence: 0.9,
  pageNumber: 1,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
});

const someFields = (n: number): FieldDto[] =>
  Array.from({ length: n }, (_, i) => field(`field_${i}`));

describe('where a row is addressed', () => {
  it('names the document and the field, and the fragment is that name', () => {
    expect(fieldRowId('doc-7', 'turning_points')).toBe(
      'field-doc-7-turning_points',
    );
    expect(fieldAnchor('doc-7', 'turning_points')).toBe(
      '#field-doc-7-turning_points',
    );
  });
});

describe('a value the contract asks for as a list', () => {
  it('reads as its entries', () => {
    expect(
      entriesOf('X=1 Y=2, 14.6 m; X=3 Y=4, 11.2 m; X=5 Y=6, 9.8 m'),
    ).toEqual(['X=1 Y=2, 14.6 m', 'X=3 Y=4, 11.2 m', 'X=5 Y=6, 9.8 m']);
  });

  it('drops the empty entry a trailing separator leaves', () => {
    expect(entriesOf('AR-01 plans; AR-02 elevations; AR-03 section;')).toEqual([
      'AR-01 plans',
      'AR-02 elevations',
      'AR-03 section',
    ]);
  });

  /* A field the contract words as a sentence may carry a semicolon of its own —
     the ±0.000 datum does — and a sentence set out as two bullets is a list the
     client invented. */
  it('leaves a sentence with one semicolon a sentence', () => {
    expect(
      entriesOf('±0.000 — floor level of the first storey; absolute 24.15 m'),
    ).toEqual([]);
  });

  it('leaves a figure alone — a scalar is not a list of one', () => {
    expect(entriesOf('612.4 m²')).toEqual([]);
    expect(entriesOf('М 1:500;')).toEqual([]);
  });

  it('says nothing about a field the paper did not state', () => {
    expect(entriesOf('')).toEqual([]);
  });

  it('offers the rest only once there is a rest', () => {
    const entries = entriesOf('a; b; c');
    expect(entries).toHaveLength(ENTRIES_SHOWN);
    expect(entries.slice(ENTRIES_SHOWN)).toEqual([]);
  });
});

describe('the tail of a long card', () => {
  it('states the whole of a card the profile asks little of', () => {
    const fields = someFields(7);
    expect(foldFields(fields)).toEqual({ shown: fields, folded: [] });
  });

  it('folds nothing to spare the reader two rows', () => {
    const fields = someFields(FIELDS_BEFORE_FOLD + 2);
    expect(foldFields(fields).folded).toEqual([]);
  });

  it('folds the tail of the sketch design and keeps the order', () => {
    const fields = someFields(19);
    const { shown, folded } = foldFields(fields);

    expect(shown).toHaveLength(FIELDS_BEFORE_FOLD);
    expect(folded).toHaveLength(19 - FIELDS_BEFORE_FOLD);
    expect([...shown, ...folded]).toEqual(fields);
  });

  it('loses no field of the plan-scheme either', () => {
    const fields = someFields(16);
    const { shown, folded } = foldFields(fields);

    expect([...shown, ...folded]).toEqual(fields);
  });
});

describe('a link that arrives before the card is drawn', () => {
  const { folded } = foldFields(someFields(19));

  it('opens the fold when the fragment names a row inside it', () => {
    expect(holdsHash(folded, 'doc-1', '#field-doc-1-field_12')).toBe(true);
  });

  it('leaves it shut for a row the card was already stating', () => {
    expect(holdsHash(folded, 'doc-1', '#field-doc-1-field_2')).toBe(false);
  });

  it('leaves it shut for another document, and for no fragment at all', () => {
    expect(holdsHash(folded, 'doc-1', '#field-doc-2-field_12')).toBe(false);
    expect(holdsHash(folded, 'doc-1', '')).toBe(false);
  });
});
