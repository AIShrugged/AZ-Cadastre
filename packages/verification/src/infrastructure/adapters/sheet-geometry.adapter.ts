import { Injectable } from '@nestjs/common';

import {
  SheetGeometryReader,
  type GeometryRequest,
} from '../../application/ports/outbound/index.js';
import {
  sheetGeometryOf,
  type SheetGeometry,
} from '../../domain/value-objects/index.js';

/*
 * The offline stand-in for reading a drawing's geometry (COMM-165).
 *
 * The other five stand-ins run the domain's own rules on the text they are given
 * — that is what makes them a comparison rather than a fixture. There is no such
 * rule here: where the rooms of a plan are on the paper cannot be worked out
 * from a transcription of it, and a stand-in that laid them out by arithmetic
 * would draw outlines on top of a drawing they have nothing to do with, which is
 * worse than drawing nothing. So this answers with a fixed demo plan, the way
 * the offline extractor answers with fixed demo values: it is what makes the
 * markup stage, the renderer, the storage key and the contract exercisable with
 * no API key and no network.
 *
 * Its figures are the offline extractor's own `span_dimensions` — "A—B 6,00 m;
 * B—C 5,40 m; 1—2 4,80 m; 2—3 4,80 m" — so a local run shows one building and
 * not a picture disagreeing with the calculation printed beside it.
 */

// The demo building on the sheet: a rectangle inset from the sheet's edges,
// where a title block leaves room for a plan.
const LEFT = 0.18;
const RIGHT = 0.82;
const TOP = 0.22;
const BOTTOM = 0.72;

// The demo chains, in metres, as the offline extractor states them.
const LETTERED = [
  { from: 'A', to: 'B', metres: 6 },
  { from: 'B', to: 'C', metres: 5.4 },
] as const;
const NUMBERED = [
  { from: '1', to: '2', metres: 4.8 },
  { from: '2', to: '3', metres: 4.8 },
] as const;

// What the rooms of the demo plan are called. Azerbaijani, as a set drawn there
// prints them.
const ROOM_NAMES = ['Qonaq otağı', 'Yataq otağı', 'Mətbəx', 'Hamam'] as const;

@Injectable()
export class SheetGeometryReaderAdapter extends SheetGeometryReader {
  async read(request: GeometryRequest): Promise<readonly SheetGeometry[]> {
    return request.sheets.flatMap(sheet => {
      const geometry = sheetGeometryOf({
        pageNumber: sheet.number.value,
        rooms: demoRooms(),
        axes: demoAxes(),
        chains: demoChains(),
      });

      return geometry ? [geometry] : [];
    });
  }
}

// Where each lettered axis runs — a horizontal line at its own height — and each
// numbered one, a vertical line at its own offset. Placed in proportion to the
// spacings above, so the picture and the figures on it agree.
function lettered(): readonly { mark: string; y: number }[] {
  return along(LETTERED, TOP, BOTTOM).map(({ mark, at }) => ({ mark, y: at }));
}

function numbered(): readonly { mark: string; x: number }[] {
  return along(NUMBERED, LEFT, RIGHT).map(({ mark, at }) => ({ mark, x: at }));
}

function along(
  chain: readonly { from: string; to: string; metres: number }[],
  from: number,
  to: number,
): readonly { mark: string; at: number }[] {
  const total = chain.reduce((sum, link) => sum + link.metres, 0);
  const marks = [chain[0]!.from, ...chain.map(link => link.to)];
  let run = 0;

  return marks.map((mark, index) => {
    if (index > 0) run += chain[index - 1]!.metres;

    return { mark, at: from + ((to - from) * run) / total };
  });
}

function demoAxes() {
  return [
    ...lettered().map(axis => ({
      mark: axis.mark,
      from: { x: LEFT - 0.05, y: axis.y },
      to: { x: RIGHT + 0.05, y: axis.y },
    })),
    ...numbered().map(axis => ({
      mark: axis.mark,
      from: { x: axis.x, y: TOP - 0.05 },
      to: { x: axis.x, y: BOTTOM + 0.05 },
    })),
  ];
}

function demoChains() {
  const rows = lettered();
  const columns = numbered();

  return [
    ...LETTERED.map((link, index) => ({
      from: link.from,
      to: link.to,
      printed: printed(link.metres),
      at: [
        { x: LEFT - 0.05, y: rows[index]!.y },
        { x: LEFT - 0.05, y: rows[index + 1]!.y },
      ],
    })),
    ...NUMBERED.map((link, index) => ({
      from: link.from,
      to: link.to,
      printed: printed(link.metres),
      at: [
        { x: columns[index]!.x, y: TOP - 0.05 },
        { x: columns[index + 1]!.x, y: TOP - 0.05 },
      ],
    })),
  ];
}

/*
 * One room per cell of the demo grid, named in turn: the markup gives every room
 * of a sheet its own colour, and a plan of one room would never show that.
 */
function demoRooms() {
  const rows = lettered();
  const columns = numbered();
  const cells = rows.slice(0, -1).flatMap((row, down) =>
    columns.slice(0, -1).map((column, across) => ({
      top: row.y,
      bottom: rows[down + 1]!.y,
      left: column.x,
      right: columns[across + 1]!.x,
      height: LETTERED[down]!.metres,
      width: NUMBERED[across]!.metres,
    })),
  );

  return cells.map((cell, index) => ({
    label: ROOM_NAMES[index % ROOM_NAMES.length]!,
    outline: [
      { x: cell.left, y: cell.top },
      { x: cell.right, y: cell.top },
      { x: cell.right, y: cell.bottom },
      { x: cell.left, y: cell.bottom },
    ],
    walls: [
      { from: 0, to: 1, printed: printed(cell.width) },
      { from: 1, to: 2, printed: printed(cell.height) },
      { from: 2, to: 3, printed: printed(cell.width) },
      { from: 3, to: 0, printed: printed(cell.height) },
    ],
  }));
}

// As a set prints a figure in metres: two decimals, decimal comma.
function printed(metres: number): string {
  return metres.toFixed(2).replace('.', ',');
}
