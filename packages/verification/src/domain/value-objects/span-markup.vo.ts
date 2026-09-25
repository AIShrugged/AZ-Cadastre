import { SpanMarkupWithoutSheetsException } from '../exceptions/index.js';

import type { PageImage } from './page-image.vo.js';
import type { PageNumber } from './page-number.vo.js';
import type { SpanUnit, SpanUnitBasis } from './span-unit.vo.js';

/*
 * The span working, drawn onto the sheets it was read off (COMM-165).
 *
 * What the package keeps is not the picture but where the picture is: the PNGs
 * go into the same object storage the rendered sheets do, and the link an
 * inspector opens is signed per request and expires, the way a sheet's own link
 * is. So this is a key per sheet, with the two counts that say what is on it.
 *
 * Kept on the document and not on the calculation, deliberately. The picture is
 * worth the most exactly when the calculation refused — a set that marks no axes
 * produces no span at all, and "here are the rooms, and there are no axes" is
 * the whole of what an inspector needs to see to agree with it (ADR-0044).
 */
export class SpanMarkupSheet {
  private constructor(
    public readonly pageNumber: PageNumber,
    public readonly image: PageImage,
    // How many room outlines and how many axes were drawn on this sheet.
    public readonly rooms: number,
    public readonly axes: number,
  ) {}

  static of(
    pageNumber: PageNumber,
    image: PageImage,
    counts: { rooms: number; axes: number },
  ): SpanMarkupSheet {
    return new SpanMarkupSheet(pageNumber, image, counts.rooms, counts.axes);
  }
}

/*
 * Why a markup is incomplete or empty: a closed vocabulary, not a sentence.
 *
 * A vocabulary of its own for the reason `SPAN_UNITS` is one — the drawing
 * stage decides these, the contract publishes them and the screen says them in
 * the reader's language. Said as words and not as prose because a sentence
 * built here is a sentence in one language, and it reached Russian and
 * Azerbaijani screens in English (COMM-166).
 *
 * The order is the order a reader meets them in, wherever two of them hold at
 * once.
 */
export const SPAN_MARKUP_NOTE_REASONS = [
  // No sheet of the set carries circled axis marks: the set dimensions rooms
  // only, and a span is not read off it by rule (ADR-0044).
  'NoAxesOnSheets',
  // No room outlines were read on any sheet.
  'NoRoomOutlines',
  // The unit of the printed figures could not be established, so every length
  // on the pictures is labelled «ед.».
  'UnitUnestablished',
  // Some of the sheets that were asked for could not be marked up.
  'SheetsUnmarked',
] as const;

export type SpanMarkupNoteReason = (typeof SPAN_MARKUP_NOTE_REASONS)[number];

export type SpanMarkupNote = {
  readonly reason: SpanMarkupNoteReason;
  // How many sheets the reason is about. Only 'SheetsUnmarked' counts anything;
  // the other three are about the set as a whole and carry null.
  readonly sheets: number | null;
};

export class SpanMarkup {
  private constructor(
    public readonly sheets: readonly SpanMarkupSheet[],
    /*
     * The unit the lengths on the pictures are printed in, and what decided it —
     * the calculation's own decision (ADR-0043), never a second one. Null in
     * both where nothing decided it: the lengths are then labelled «ед.» rather
     * than assumed to be millimetres, because a figure labelled with a unit
     * nobody established is what makes a wrong span look checked.
     */
    public readonly unit: SpanUnit | null,
    public readonly unitBasis: SpanUnitBasis | null,
    /*
     * Why the markup is incomplete or empty, as reasons and not as a sentence:
     * the words a reader sees are the client's, in the reader's language
     * (COMM-166). Empty where everything asked for is on the pictures, and
     * always in the order the domain declares the reasons in.
     */
    public readonly notes: readonly SpanMarkupNote[],
  ) {}

  static of(state: {
    sheets: readonly SpanMarkupSheet[];
    unit: SpanUnit | null;
    unitBasis: SpanUnitBasis | null;
    notes: readonly SpanMarkupNote[];
  }): SpanMarkup {
    if (state.sheets.length === 0) {
      throw new SpanMarkupWithoutSheetsException();
    }

    return new SpanMarkup([...state.sheets], state.unit, state.unitBasis, [
      ...state.notes,
    ]);
  }
}
