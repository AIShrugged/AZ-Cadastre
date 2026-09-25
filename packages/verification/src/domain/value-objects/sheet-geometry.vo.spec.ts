import { describe, expect, it } from 'vitest';

import { sheetGeometryOf } from './sheet-geometry.vo.js';

const A_ROOM = {
  label: 'Mətbəx',
  outline: [
    { x: 0.2, y: 0.2 },
    { x: 0.5, y: 0.2 },
    { x: 0.5, y: 0.5 },
  ],
  walls: [{ from: 0, to: 1, printed: '3000' }],
};

describe('sheetGeometryOf', () => {
  it('keeps what can be drawn', () => {
    const geometry = sheetGeometryOf({
      pageNumber: 7,
      rooms: [A_ROOM],
      axes: [{ mark: 'A', from: { x: 0, y: 0.3 }, to: { x: 1, y: 0.3 } }],
      chains: [
        {
          from: 'A',
          to: 'B',
          printed: '2400',
          at: [
            { x: 0.1, y: 0.3 },
            { x: 0.1, y: 0.6 },
          ],
        },
      ],
    });

    expect(geometry?.pageNumber.value).toBe(7);
    expect(geometry?.rooms[0]?.label).toBe('Mətbəx');
    expect(geometry?.axes[0]?.mark).toBe('A');
    expect(geometry?.chains).toHaveLength(1);
  });

  // A reader shown a drawing answers with coordinates off the end of it. Dropping
  // them here is what keeps the renderer free of guards: a rule that can only be
  // exercised through a bitmap is a rule nobody tests.
  it('drops a corner that is not on the sheet', () => {
    const geometry = sheetGeometryOf({
      pageNumber: 1,
      rooms: [
        {
          outline: [
            { x: 0.2, y: 0.2 },
            { x: 1.4, y: 0.2 },
            { x: 0.5, y: 0.5 },
            { x: 0.2, y: 0.5 },
          ],
          walls: [],
        },
      ],
    });

    expect(geometry?.rooms[0]?.outline).toHaveLength(3);
  });

  it('drops a room of fewer than three corners', () => {
    const geometry = sheetGeometryOf({
      pageNumber: 1,
      rooms: [
        {
          outline: [
            { x: 0.2, y: 0.2 },
            { x: 0.5, y: 0.2 },
          ],
          walls: [],
        },
      ],
      axes: [{ mark: '1', from: { x: 0.2, y: 0 }, to: { x: 0.2, y: 1 } }],
    });

    expect(geometry?.rooms).toEqual([]);
    expect(geometry?.axes).toHaveLength(1);
  });

  it('drops a wall between corners that are not there, and one to itself', () => {
    const geometry = sheetGeometryOf({
      pageNumber: 1,
      rooms: [
        {
          ...A_ROOM,
          walls: [
            { from: 0, to: 9, printed: '3000' },
            { from: 1, to: 1, printed: '3000' },
            { from: 1, to: 2, printed: null },
          ],
        },
      ],
    });

    expect(geometry?.rooms[0]?.walls).toEqual([
      { from: 1, to: 2, printed: null },
    ]);
  });

  it('drops an axis with no mark printed on it', () => {
    const geometry = sheetGeometryOf({
      pageNumber: 1,
      rooms: [A_ROOM],
      axes: [
        { mark: '  ', from: { x: 0, y: 0.3 }, to: { x: 1, y: 0.3 } },
        { mark: 'A', from: { x: 0, y: 0.4 }, to: { x: 1, y: 0.4 } },
      ],
    });

    expect(geometry?.axes.map(axis => axis.mark)).toEqual(['A']);
  });

  it('drops a chain segment with no figure or no line to draw it on', () => {
    const geometry = sheetGeometryOf({
      pageNumber: 1,
      rooms: [A_ROOM],
      chains: [
        {
          from: 'A',
          to: 'B',
          printed: null,
          at: [
            { x: 0.1, y: 0.3 },
            { x: 0.1, y: 0.6 },
          ],
        },
        { from: 'A', to: 'B', printed: '2400', at: [{ x: 0.1, y: 0.3 }] },
      ],
    });

    expect(geometry?.chains).toEqual([]);
  });

  it('is nothing for a sheet with neither a room nor an axis on it', () => {
    expect(sheetGeometryOf({ pageNumber: 4 })).toBeNull();
  });

  it('is nothing for a sheet number no page has', () => {
    expect(sheetGeometryOf({ pageNumber: 0, rooms: [A_ROOM] })).toBeNull();
  });
});
