/*
 * What a reader saw on one sheet of a drawing set, as shapes rather than as
 * words (COMM-165).
 *
 * The extraction stage answers in text — "1—2 4000; 2—3 4400" — and text is all
 * the span calculation needs. It is not enough to show anybody: an inspector
 * handed "B—C 5200" has no way of telling whether B and C are the axes of the
 * drawing or two gaps a reader numbered itself, which is the failure a
 * production case was decided on (COMM-160). Shapes are what can be drawn back
 * onto the sheet, and a picture of the wrong axes is wrong visibly.
 *
 * Coordinates are normalised to the sheet: 0..1 of its width and of its height,
 * origin top left. Normalised and not pixels, because the sheet the reader was
 * shown and the sheet the markup is drawn on are rendered at whatever DPI the
 * run used, and a figure in pixels would be silently wrong at another one.
 */

import { PageNumber } from './page-number.vo.js';

export type SheetPoint = {
  // 0..1 of the sheet's width, from its left edge.
  readonly x: number;
  // 0..1 of the sheet's height, from its top edge.
  readonly y: number;
};

/*
 * One wall of a room: which two corners of the outline it runs between, and the
 * figure printed along it where the drawing prints one.
 *
 * The figure is text and not a number on purpose — it is copied off the sheet
 * as printed, decimal comma and all, the way every other reading is. What unit
 * it is in is not the sheet's to say (ADR-0043).
 */
export type RoomWall = {
  // Indices into the room's outline.
  readonly from: number;
  readonly to: number;
  // As printed beside the wall, or null where nothing is printed there.
  readonly printed: string | null;
};

export type RoomOutline = {
  // The name printed inside the room — "İstirahət otağı" — or null where none
  // is legible. Never translated and never invented.
  readonly label: string | null;
  // The corners of the room, in the order they are walked. At least three.
  readonly outline: readonly SheetPoint[];
  readonly walls: readonly RoomWall[];
};

/*
 * One axis of the drawing: the line, and the mark printed in the circle at its
 * end — "1", "A", exactly as printed.
 *
 * Empty on a set that marks no axes, and that is an answer and not a gap
 * (ADR-0044): three of the four designs in the reference set dimension rooms and
 * mark no axes at all, and the markup of one of those shows rooms and no axes.
 */
export type SheetAxis = {
  readonly mark: string;
  readonly from: SheetPoint;
  readonly to: SheetPoint;
};

// One link of a dimension chain: the two axes it spans, the figure printed at
// it, and where on the sheet that dimension line runs.
export type ChainSegment = {
  readonly from: string;
  readonly to: string;
  readonly printed: string;
  readonly at: readonly [SheetPoint, SheetPoint];
};

export type SheetGeometry = {
  readonly pageNumber: PageNumber;
  readonly rooms: readonly RoomOutline[];
  readonly axes: readonly SheetAxis[];
  readonly chains: readonly ChainSegment[];
};

// The fewest corners a closed outline can have.
const LEAST_CORNERS = 3;

/*
 * The geometry of one sheet with everything unusable dropped.
 *
 * A reader shown a drawing answers with coordinates off the end of the sheet, a
 * room of two corners, a wall between a corner and one that is not there. None
 * of those is a fault worth losing the sheet over — the rest of the answer draws
 * — so each is dropped where it stands, and a sheet nothing survives on is
 * null. The alternative is a renderer full of guards, and a guard in a renderer
 * is a rule nobody can test without a canvas.
 */
export function sheetGeometryOf(raw: {
  readonly pageNumber: number;
  readonly rooms?: readonly {
    readonly label?: string | null;
    readonly outline?: readonly { readonly x: number; readonly y: number }[];
    readonly walls?: readonly {
      readonly from: number;
      readonly to: number;
      readonly printed?: string | null;
    }[];
  }[];
  readonly axes?: readonly {
    readonly mark?: string | null;
    readonly from?: { readonly x: number; readonly y: number };
    readonly to?: { readonly x: number; readonly y: number };
  }[];
  readonly chains?: readonly {
    readonly from?: string | null;
    readonly to?: string | null;
    readonly printed?: string | null;
    readonly at?: readonly { readonly x: number; readonly y: number }[];
  }[];
}): SheetGeometry | null {
  if (!Number.isInteger(raw.pageNumber) || raw.pageNumber < 1) return null;

  const rooms = (raw.rooms ?? []).flatMap(room => {
    const outline = (room.outline ?? []).flatMap(point =>
      onTheSheet(point) ? [point] : [],
    );

    if (outline.length < LEAST_CORNERS) return [];

    return [
      {
        label: said(room.label),
        outline,
        walls: (room.walls ?? []).flatMap(wall =>
          wall.from !== wall.to &&
          corner(wall.from, outline.length) &&
          corner(wall.to, outline.length)
            ? [{ from: wall.from, to: wall.to, printed: said(wall.printed) }]
            : [],
        ),
      },
    ];
  });

  const axes = (raw.axes ?? []).flatMap(axis => {
    const mark = said(axis.mark);

    return mark !== null && onTheSheet(axis.from) && onTheSheet(axis.to)
      ? [{ mark, from: axis.from, to: axis.to }]
      : [];
  });

  const chains = (raw.chains ?? []).flatMap(segment => {
    const from = said(segment.from);
    const to = said(segment.to);
    const printed = said(segment.printed);
    const [one, other] = segment.at ?? [];

    return from !== null &&
      to !== null &&
      printed !== null &&
      onTheSheet(one) &&
      onTheSheet(other)
      ? [{ from, to, printed, at: [one, other] as const }]
      : [];
  });

  return rooms.length === 0 && axes.length === 0
    ? null
    : { pageNumber: PageNumber.of(raw.pageNumber), rooms, axes, chains };
}

function onTheSheet(
  point: { readonly x: number; readonly y: number } | undefined,
): point is SheetPoint {
  return (
    point !== undefined &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

function corner(index: number, corners: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < corners;
}

function said(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? '';

  return trimmed.length === 0 ? null : trimmed;
}
