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
