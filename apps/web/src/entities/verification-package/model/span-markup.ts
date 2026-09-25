/**
 * The span working the pipeline drew onto the sheets of a design set
 * (COMM-165), put into the few words the screen states it in.
 *
 * Nothing here draws or decides anything. What was marked up, in what unit and
 * why the markup is short were all settled by the run; this only says it, and
 * says it the same way wherever the picture is shown.
 *
 * The one thing these lines exist to keep straight: the picture is the
 * machine's own construction over the scan and not the scan. The axes and the
 * chains on it are read off the paper, the room outlines are placed roughly,
 * and no figure printed on it reaches the calculation — so the block is
 * captioned as working, never as a measurement of the sheet.
 */
import type {
  DocumentDto,
  SpanMarkupDto,
  SpanMarkupNoteDto,
  SpanMarkupNoteReason,
  SpanMarkupSheetDto,
} from '@cadastre/api-contracts/verification';

/** The `t` from `useI18n`. */
type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * The markup of one document, or null where there is nothing to draw.
 *
 * Null on every paper that is not design documentation, and on a design set no
 * run has marked up yet — the contract does not tell the two apart, and a
 * caption guessing between them would be the screen answering for a reading it
 * never made.
 */
export function spanMarkupOf(doc: DocumentDto): SpanMarkupDto | null {
  return doc.spanMarkup ?? null;
}

/** The sheets of a markup, in the order of the sheets they were drawn on. */
export function markupSheets(
  markup: SpanMarkupDto,
): readonly SpanMarkupSheetDto[] {
  return [...markup.sheets].sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * What was put on one sheet: "Room outlines: 6 · Axes: 8".
 *
 * No axes is said in words rather than as "Axes: 0". Three of four real design
 * sets mark none, so this is the common answer and not a failure — and a zero
 * in a row of counts reads as a count that came out empty, which is the same
 * thing said less clearly (ADR-0044).
 */
export function markupCounts(t: Translate, sheet: SpanMarkupSheetDto): string {
  return [
    t('span.markup.rooms', { n: sheet.rooms }),
    sheet.axes === 0
      ? t('span.markup.axes_none')
      : t('span.markup.axes', { n: sheet.axes }),
  ].join(' · ');
}

/**
 * What the lengths on the picture are labelled in, and what decided it — the
 * same decision the calculation made (ADR-0043).
 *
 * Nothing decided it where the unit is null, and then the picture labels its
 * lengths «ед.» rather than assuming millimetres. Said as that and not as a
 * missing unit: the reader is looking at the word on the drawing.
 */
export function markupUnitLine(t: Translate, markup: SpanMarkupDto): string {
  if (markup.unit === null) return t('span.markup.unit_unknown');

  const unit = t('span.markup.unit', {
    unit: t(`span.unit_name.${markup.unit}`),
  });

  return markup.unitBasis === null
    ? unit
    : `${unit} — ${t(`span.markup.basis.${markup.unitBasis}`)}`;
}

/**
 * Whether the block has already said a reason in its own words, a line above.
 *
 * Three of the four reasons the contract publishes are things the picture's own
 * captions state anyway: a set with no circled axes says so on every sheet, a
 * set nothing was outlined on counts «Контуров комнат: 0» on every sheet, and a
 * markup with no unit says the lengths are labelled «ед.». Printing the reason
 * under them repeats the same sentence twice in one card, which reads as two
 * findings rather than one.
 *
 * Asked of the sheets rather than assumed, because the reasons and the counts
 * are worked out apart on the server: where they disagree — a reason saying no
 * sheet carries axes over sheets that count some — the caption above is the one
 * that is wrong, and the reason is the only thing on the card that says so.
 */
function saidAlready(
  markup: SpanMarkupDto,
  reason: SpanMarkupNoteReason,
): boolean {
  switch (reason) {
    case 'NoAxesOnSheets':
      return markup.sheets.every(sheet => sheet.axes === 0);
    case 'NoRoomOutlines':
      return markup.sheets.every(sheet => sheet.rooms === 0);
    case 'UnitUnestablished':
      return markup.unit === null;
    // Nothing else on the card counts the sheets that were asked for and never
    // drawn, so this one is always its own line.
    case 'SheetsUnmarked':
      return false;
  }
}

/** One reason, in the words the dictionaries have for it. */
function noteLine(t: Translate, note: SpanMarkupNoteDto): string {
  if (note.reason !== 'SheetsUnmarked')
    return t(`span.markup.note.${note.reason}`);

  // A count the run sent no number for is said without one rather than with a
  // «null» in it, and one sheet is said as one sheet — the rest is a label and
  // a figure, which is how every count on this block avoids agreeing in number
  // with three languages at once.
  if (note.sheets === null) return t('span.markup.note.SheetsUnmarked_some');
  if (note.sheets === 1) return t('span.markup.note.SheetsUnmarked_one');
  return t('span.markup.note.SheetsUnmarked', { n: note.sheets });
}

/**
 * Why the markup is short of what was asked for, in the reader's language.
 *
 * Empty where the run marked up everything it was given, and empty where every
 * reason it sent is already on the card — an empty list is the block saying
 * nothing about reasons at all, not an empty heading. The order is the
 * contract's, so a reader meets the reasons in one order every time.
 */
export function markupNotes(
  t: Translate,
  markup: SpanMarkupDto,
): readonly string[] {
  return markup.notes
    .filter(note => !saidAlready(markup, note.reason))
    .map(note => noteLine(t, note));
}
