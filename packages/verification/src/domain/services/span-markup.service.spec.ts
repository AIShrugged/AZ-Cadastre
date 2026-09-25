import { describe, expect, it } from 'vitest';

import {
  sheetGeometryOf,
  VerificationProfile,
  type SheetGeometry,
} from '../value-objects/index.js';

import {
  dimensionsASpan,
  sheetMarkupOf,
  spanMarkupNoteOf,
} from './span-markup.service.js';

/*
 * Two rooms and both axis chains, as the sample design's first-floor plan
 * carries them (PROJE44): the figures are the ones the acceptance contract works
 * the span rule on, so a picture drawn off this geometry and the calculation
 * printed beside it are about the same building.
 */
function aSheet(
  overrides: Partial<Parameters<typeof sheetGeometryOf>[0]> = {},
) {
  const geometry = sheetGeometryOf({
    pageNumber: 7,
    rooms: [
      {
        label: 'Qonaq otağı',
        outline: [
          { x: 0.2, y: 0.2 },
          { x: 0.6, y: 0.2 },
          { x: 0.6, y: 0.5 },
          { x: 0.2, y: 0.5 },
        ],
        walls: [
          { from: 0, to: 1, printed: '4000' },
          { from: 1, to: 2, printed: '2400' },
          { from: 2, to: 3, printed: '4000' },
          { from: 3, to: 0, printed: null },
        ],
      },
    ],
    axes: [
      { mark: 'B', from: { x: 0.15, y: 0.5 }, to: { x: 0.85, y: 0.5 } },
      { mark: '1', from: { x: 0.2, y: 0.15 }, to: { x: 0.2, y: 0.85 } },
      { mark: 'A', from: { x: 0.15, y: 0.2 }, to: { x: 0.85, y: 0.2 } },
      { mark: '2', from: { x: 0.6, y: 0.15 }, to: { x: 0.6, y: 0.85 } },
    ],
    chains: [
      {
        from: 'A',
        to: 'B',
        printed: '2400',
        at: [
          { x: 0.15, y: 0.2 },
          { x: 0.15, y: 0.5 },
        ],
      },
    ],
    ...overrides,
  });

  if (!geometry) throw new Error('the fixture is not readable geometry');

  return geometry;
}

function markupOf(
  geometry: SheetGeometry,
  unit: 'mm' | 'cm' | 'm' | null = 'mm',
  unitBasis: 'Printed' | 'BuiltUpArea' | 'Assumed' | null = 'BuiltUpArea',
) {
  return sheetMarkupOf({
    geometry,
    documentType: 'sketch_project',
    unit,
    unitBasis,
  });
}

describe('dimensionsASpan', () => {
  it('is true of exactly the types a span is read off', () => {
    const marked = VerificationProfile.CADASTRE.specs
      .filter(dimensionsASpan)
      .map(spec => spec.type.value);

    expect([...marked].sort()).toEqual([
      'approved_design',
      'architectural_planning_section',
      'sketch_project',
    ]);
  });
});

describe('sheetMarkupOf', () => {
  it('letters the corners of a room in outline order and names its walls by them', () => {
    const room = markupOf(aSheet()).rooms[0]!;

    expect(room.corners.map(corner => corner.letter)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(room.walls.map(wall => wall.text)).toEqual([
      'AB 4000 mm',
      'BC 2400 mm',
      'CD 4000 mm',
      'DA',
    ]);
  });

  it('gives every room of a sheet a colour of its own', () => {
    const twoRooms = aSheet({
      rooms: [
        {
          outline: [
            { x: 0.2, y: 0.2 },
            { x: 0.4, y: 0.2 },
            { x: 0.4, y: 0.4 },
          ],
          walls: [],
        },
        {
          outline: [
            { x: 0.5, y: 0.5 },
            { x: 0.7, y: 0.5 },
            { x: 0.7, y: 0.7 },
          ],
          walls: [],
        },
      ],
    });

    expect(markupOf(twoRooms).rooms.map(room => room.colour)).toEqual([0, 1]);
  });

  it('names the axes a, b, c along their own chains and keys them back in the legend', () => {
    const markup = markupOf(aSheet());

    expect(markup.axes.map(axis => [axis.letter, axis.printed])).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', 'A'],
      ['d', 'B'],
    ]);
    expect(markup.legend).toContain('Axes: a → 1, b → 2, c → A, d → B');
  });

  // The unit is the calculation's decision and never a second one (ADR-0043):
  // a figure labelled with a unit nobody established is what makes a wrong span
  // look checked (COMM-160).
  it('labels every length «ед.» where nothing established the unit', () => {
    const markup = markupOf(aSheet(), null, null);

    expect(markup.rooms[0]!.walls[0]!.text).toBe('AB 4000 ед.');
    expect(markup.chains[0]!.text).toBe('A—B 2400 ед.');
    expect(markup.legend).toContain('Lengths in «ед.» — no unit established');
  });

  it('says on the picture which sheet and which paper it is, and what decided the unit', () => {
    const markup = markupOf(aSheet());

    expect(markup.pageNumber).toBe(7);
    expect(markup.legend[0]).toBe('Sheet 7 · sketch_project');
    expect(markup.legend).toContain(
      'Lengths in mm — from the built-up area the design states',
    );
  });

  // Three of the four designs in the reference set mark no axes at all
  // (ADR-0044). The rooms are still drawn: that is exactly what an inspector
  // needs to see to agree that no span was established.
  it('draws the rooms and no axes on a set that marks none', () => {
    const markup = markupOf(aSheet({ axes: [], chains: [] }));

    expect(markup.rooms).toHaveLength(1);
    expect(markup.axes).toEqual([]);
    expect(markup.legend).toContain('No axes marked on this sheet');
  });
});

describe('spanMarkupNoteOf', () => {
  it('says nothing where everything asked for is on the pictures', () => {
    expect(
      spanMarkupNoteOf({
        marked: [{ rooms: 4, axes: 5 }],
        unmarked: 0,
        unitEstablished: true,
      }),
    ).toBeNull();
  });

  it('says that the set marks no axes rather than leaving the absence to be guessed at', () => {
    const note = spanMarkupNoteOf({
      marked: [{ rooms: 3, axes: 0 }],
      unmarked: 0,
      unitEstablished: true,
    });

    expect(note).toContain('No circled axis marks were read');
    expect(note).toContain('dimensions rooms only');
  });

  it('says how the lengths are labelled where the unit was not established', () => {
    expect(
      spanMarkupNoteOf({
        marked: [{ rooms: 2, axes: 4 }],
        unmarked: 0,
        unitEstablished: false,
      }),
    ).toBe(
      'The unit of the printed figures was not established, so every length ' +
        'is labelled «ед.».',
    );
  });

  it('counts the sheets that were asked for and could not be drawn', () => {
    expect(
      spanMarkupNoteOf({
        marked: [{ rooms: 2, axes: 4 }],
        unmarked: 2,
        unitEstablished: true,
      }),
    ).toBe('2 further sheets were asked for and could not be marked up.');
  });
});
