import type { DocumentTypeSpec } from '../value-objects/index.js';

// Where a candidate's heading was found, and how much of the text it took up.
// The span matters to a caller that consults two lists: a heading of one list
// that ENCLOSES a heading of the other is not a rival reading of the sheet, it
// is the same words read short.
export type HeadingMatch = {
  readonly spec: DocumentTypeSpec;
  readonly at: number;
  readonly length: number;
};

// What a profile's own headings can tell you about a page, with no model
// involved: the type whose heading appears earliest wins, because a document
// names itself at the top and only mentions the others further down. This is
// what the mock providers classify and segment by; the real ones read the text.
export function looksLike(
  text: string,
  candidates: readonly DocumentTypeSpec[],
): DocumentTypeSpec | null {
  return headingMatch(text, candidates)?.spec ?? null;
}

// The same answer with the span it was found at, for a caller that has to
// weigh it against a match from another list.
export function headingMatch(
  text: string,
  candidates: readonly DocumentTypeSpec[],
): HeadingMatch | null {
  let best: HeadingMatch | null = null;

  for (const match of matchesIn(text, candidates)) {
    // Two headings starting at the same place is "Lisenziyaya əlavə" matching
    // both the annex and the licence. The longer one is what the sheet is.
    const beats =
      !best ||
      match.at < best.at ||
      (match.at === best.at && match.length > best.length);

    if (beats) best = match;
  }

  return best;
}

// Whether one of these candidates is headed by words that CONTAIN the span
// given — "технический паспорт" over the "паспорт" inside it. Asked of the
// whole list and not of its best match: the heading that swallows a span is
// rarely the one that starts the sheet, and a caller weighing two lists needs
// to know that the shorter reading is the same words read short (ADR-0022).
export function enclosesHeading(
  text: string,
  span: { readonly at: number; readonly length: number },
  candidates: readonly DocumentTypeSpec[],
): boolean {
  return matchesIn(text, candidates).some(
    match =>
      match.length > span.length &&
      match.at <= span.at &&
      match.at + match.length >= span.at + span.length,
  );
}

// Every candidate's earliest heading in the text, in no particular order.
function matchesIn(
  text: string,
  candidates: readonly DocumentTypeSpec[],
): readonly HeadingMatch[] {
  const hay = fold(text);
  const found: HeadingMatch[] = [];

  for (const spec of candidates) {
    for (const hint of spec.hints) {
      const needle = fold(hint);
      const at = hay.indexOf(needle);

      if (at !== -1) found.push({ spec, at, length: needle.length });
    }
  }

  return found;
}

// Azerbaijani headings are printed in capitals, and JavaScript lowercases "İ"
// to an "i" carrying a combining dot — so "LİSENZİYA" does not contain
// "lisenziya" by plain string search. Folding both sides to unaccented letters
// settles that, and buys the tolerance of dropped diacritics that OCR needs
// anyway: "ƏLAVƏ", "Əlavə" and a scanner's "ELAVE" all read alike.
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i');
}
