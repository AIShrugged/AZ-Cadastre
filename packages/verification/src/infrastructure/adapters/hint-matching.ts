import type { DocumentTypeSpec } from "../../domain/value-objects/index.js";

// What a profile's own headings can tell you about a page, with no model
// involved: the type whose heading appears earliest wins, because a document
// names itself at the top and only mentions the others further down. This is
// what the mock providers classify and segment by; the real ones read the text.
export function looksLike(
  text: string,
  candidates: readonly DocumentTypeSpec[],
): DocumentTypeSpec | null {
  const hay = fold(text);
  let best: { spec: DocumentTypeSpec; at: number; length: number } | null = null;

  for (const spec of candidates) {
    for (const hint of spec.hints) {
      const needle = fold(hint);
      const at = hay.indexOf(needle);

      if (at === -1) continue;

      // Two headings starting at the same place is "Lisenziyaya əlavə" matching
      // both the annex and the licence. The longer one is what the sheet is.
      const beats =
        !best || at < best.at || (at === best.at && needle.length > best.length);

      if (beats) best = { spec, at, length: needle.length };
    }
  }

  return best?.spec ?? null;
}

// Azerbaijani headings are printed in capitals, and JavaScript lowercases "İ"
// to an "i" carrying a combining dot — so "LİSENZİYA" does not contain
// "lisenziya" by plain string search. Folding both sides to unaccented letters
// settles that, and buys the tolerance of dropped diacritics that OCR needs
// anyway: "ƏLAVƏ", "Əlavə" and a scanner's "ELAVE" all read alike.
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i");
}
