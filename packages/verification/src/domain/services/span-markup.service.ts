/*
 * What is drawn on a marked-up sheet, decided here and drawn elsewhere
 * (COMM-165).
 *
 * The span calculation is a string of pairs and a number, and neither says
 * anything an inspector can check against the drawing in front of them. The
 * markup is the check: the rooms outlined, their corners lettered the way a
 * graph's vertices are, every wall reading AB, BC, CD with the figure printed
 * along it, and the axes — where the set marks any — drawn apart and keyed to
 * the marks the draughtsman printed.
 *
 * This service decides all of that and draws none of it. What a canvas does is
 * put pixels where it is told; which letter a corner gets, which figure is
 * printed beside a wall, in what unit, and what the legend says are domain
 * questions, and a rule that can only be exercised through a bitmap is a rule
 * nobody tests. The renderer takes this plan and nothing else.
 */

import {
  UNIT_UNESTABLISHED,
  type DocumentTypeSpec,
  type SheetGeometry,
  type SheetPoint,
  type SpanUnit,
  type SpanUnitBasis,
} from '../value-objects/index.js';

// The key a span is read off, and so the key that says a paper of this type is
// a design set at all (ADR-0043): the three types of design documentation
// declare it and nothing else does.
const SPAN_DIMENSIONS = 'span_dimensions';

export type MarkupCorner = {
  // A, B, C… the corners of one room, in outline order.
  readonly letter: string;
  readonly at: SheetPoint;
};

export type MarkupWall = {
  // "AB 4000 mm", or "AB" where the drawing prints no figure along it.
  readonly text: string;
  readonly from: SheetPoint;
  readonly to: SheetPoint;
};

export type MarkupRoom = {
  // Which of the renderer's colours this room is drawn in. An index and not a
  // colour: what "its own colour" looks like is the renderer's business, and
  // the rule here is only that two rooms of a sheet do not share one.
  readonly colour: number;
  readonly outline: readonly SheetPoint[];
  // The name printed in the room, or null.
  readonly name: string | null;
  readonly corners: readonly MarkupCorner[];
  readonly walls: readonly MarkupWall[];
};

export type MarkupAxis = {
  // a, b, c… — the axis as the markup names it.
  readonly letter: string;
  // The mark as the draughtsman printed it: "1", "A".
  readonly printed: string;
  readonly from: SheetPoint;
  readonly to: SheetPoint;
};

export type MarkupChain = {
  // "1—2 4000 mm".
  readonly text: string;
  readonly from: SheetPoint;
  readonly to: SheetPoint;
};

export type SheetMarkup = {
  readonly pageNumber: number;
  readonly rooms: readonly MarkupRoom[];
  readonly axes: readonly MarkupAxis[];
  readonly chains: readonly MarkupChain[];
  // What the picture says about itself: the sheet, the paper, the unit and what
  // decided it, and which printed mark each lowercase axis letter stands for.
  readonly legend: readonly string[];
};

// Whether a span is read off a paper of this type, and so whether its sheets
// are marked up at all. Asked of the schema and not of a list of type keys:
// the three types that declare the key are the three the provisions table takes
// a span from, and a fourth added to the profile would want the markup too.
export function dimensionsASpan(spec: DocumentTypeSpec): boolean {
  return spec.schema.specs.some(field => field.key.value === SPAN_DIMENSIONS);
}

/**
 * The plan for one sheet: what to draw and what to write beside it.
 *
 * `unit` and `unitBasis` are the calculation's own decision, handed in rather
 * than made here — the picture must print the unit the span was worked out in
 * or it is evidence for a different calculation. Null in both is the honest
 * state of a set nothing established the unit of, and then every length is
 * labelled «ед.» rather than assumed to be millimetres (ADR-0043).
 */
export function sheetMarkupOf(input: {
  readonly geometry: SheetGeometry;
  readonly documentType: string;
  readonly unit: SpanUnit | null;
  readonly unitBasis: SpanUnitBasis | null;
}): SheetMarkup {
  const suffix = input.unit ?? UNIT_UNESTABLISHED;
  const rooms = input.geometry.rooms.map((room, index) => {
    const corners = room.outline.map((at, corner) => ({
      letter: cornerLetter(corner),
      at,
    }));

    return {
      colour: index,
      outline: room.outline,
      name: room.label,
      corners,
      walls: room.walls.map(wall => ({
        text: withLength(
          `${corners[wall.from]!.letter}${corners[wall.to]!.letter}`,
          wall.printed,
          suffix,
        ),
        from: room.outline[wall.from]!,
        to: room.outline[wall.to]!,
      })),
    };
  });

  const axes = [...input.geometry.axes]
    .sort((one, other) => alongTheChain(one.mark) - alongTheChain(other.mark))
    .map((axis, index) => ({
      letter: axisLetter(index),
      printed: axis.mark,
      from: axis.from,
      to: axis.to,
    }));

  const chains = input.geometry.chains.map(segment => ({
    text: withLength(`${segment.from}—${segment.to}`, segment.printed, suffix),
    from: segment.at[0],
    to: segment.at[1],
  }));

  return {
    pageNumber: input.geometry.pageNumber.value,
    rooms,
    axes,
    chains,
    legend: legendOf({
      pageNumber: input.geometry.pageNumber.value,
      documentType: input.documentType,
      unit: input.unit,
      unitBasis: input.unitBasis,
      rooms: rooms.length,
      axes,
    }),
  };
}

/**
 * Why the markup is incomplete or empty, in the words of an audit — or null
 * where everything that was asked for is on the pictures.
 *
 * Every clause is something an inspector would otherwise have to work out from
 * an absence. A set that marks no axes draws none, and "no axes were drawn" on
 * its own reads like a failure of ours; saying that the sheets carry none is
 * the difference between a reading refused and a reading not made (ADR-0044).
 */
export function spanMarkupNoteOf(input: {
  // The sheets a picture was produced for.
  readonly marked: readonly { readonly rooms: number; readonly axes: number }[];
  // The sheets that were asked for and produced none.
  readonly unmarked: number;
  readonly unitEstablished: boolean;
}): string | null {
  const clauses: string[] = [];

  if (input.marked.every(sheet => sheet.axes === 0)) {
    clauses.push(
      'No circled axis marks were read on these sheets, so no axes are ' +
        'drawn: the set dimensions rooms only.',
    );
  }

  if (input.marked.every(sheet => sheet.rooms === 0)) {
    clauses.push('No room outlines were read on these sheets.');
  }

  if (!input.unitEstablished) {
    clauses.push(
      `The unit of the printed figures was not established, so every length ` +
        `is labelled «${UNIT_UNESTABLISHED}».`,
    );
  }

  if (input.unmarked > 0) {
    clauses.push(
      `${input.unmarked} further ` +
        `${input.unmarked === 1 ? 'sheet was' : 'sheets were'} asked for and ` +
        `could not be marked up.`,
    );
  }

  return clauses.length === 0 ? null : clauses.join(' ');
}

function withLength(
  label: string,
  printed: string | null,
  suffix: string,
): string {
  return printed === null ? label : `${label} ${printed} ${suffix}`;
}

const ALPHABET_SIZE = 26;
const FIRST_UPPER = 'A'.codePointAt(0)!;
const FIRST_LOWER = 'a'.codePointAt(0)!;

// A, B … Z, then AA, AB — a spreadsheet's column names. A room of more than
// twenty-six corners is not a room, but a reader that answers with one must not
// give two of its walls the same name.
function cornerLetter(index: number): string {
  return letters(index, FIRST_UPPER);
}

function axisLetter(index: number): string {
  return letters(index, FIRST_LOWER);
}

function letters(index: number, first: number): string {
  const lead = Math.floor(index / ALPHABET_SIZE);
  const last = String.fromCodePoint(first + (index % ALPHABET_SIZE));

  return lead === 0 ? last : letters(lead - 1, first) + last;
}

/*
 * Where an axis mark falls in its own chain, so that a, b, c run the way the
 * drawing does: the numerals in numeric order first, then the letters in
 * alphabetical order. A mark that is neither sorts last, in the order the reader
 * gave it, rather than being dropped — the picture is evidence of what was read,
 * and a mark nobody recognises is worth seeing.
 */
const NUMERAL = /^\d+$/u;
const LETTERS_AFTER_NUMERALS = 1000;
const UNRECOGNISED = 100_000;

function alongTheChain(mark: string): number {
  if (NUMERAL.test(mark)) return Number(mark);

  const code = mark.codePointAt(0) ?? 0;

  return mark.length === 1
    ? LETTERS_AFTER_NUMERALS + code
    : UNRECOGNISED + code;
}

const UNIT_BASIS_WORDS: Readonly<Record<SpanUnitBasis, string>> = {
  Printed: 'printed beside the figures',
  BuiltUpArea: 'from the built-up area the design states',
  Assumed: 'assumed, as a drawing is dimensioned in millimetres',
};

function legendOf(input: {
  readonly pageNumber: number;
  readonly documentType: string;
  readonly unit: SpanUnit | null;
  readonly unitBasis: SpanUnitBasis | null;
  readonly rooms: number;
  readonly axes: readonly MarkupAxis[];
}): readonly string[] {
  const unit =
    input.unit === null || input.unitBasis === null
      ? `Lengths in «${UNIT_UNESTABLISHED}» — no unit established`
      : `Lengths in ${input.unit} — ${UNIT_BASIS_WORDS[input.unitBasis]}`;

  return [
    `Sheet ${input.pageNumber} · ${input.documentType}`,
    unit,
    `${input.rooms} ${input.rooms === 1 ? 'room' : 'rooms'} outlined`,
    input.axes.length === 0
      ? 'No axes marked on this sheet'
      : `Axes: ${input.axes
          .map(axis => `${axis.letter} → ${axis.printed}`)
          .join(', ')}`,
  ];
}
