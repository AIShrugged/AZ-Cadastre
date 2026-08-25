// The letters, before any of the words.
//
// Three files of the archive store Azerbaijani in a legacy Cyrillic code page
// that is not Russian and does not transliterate with a Russian table: "Гейри
// йашайыш сащяси" is *qeyri-yaşayış sahəsi*, "Няриманов" is *Nərimanov*. The
// mapping below is that code page, and it is applied to what is left after the
// address words have been recognised — the same code points mean different
// letters in the two languages, and the words are where it matters.

const LEGACY_CYRILLIC: ReadonlyMap<string, string> = new Map(
  Object.entries({
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'q',
    ғ: 'ğ',
    ҝ: 'g',
    д: 'd',
    е: 'e',
    ж: 'j',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    ө: 'ö',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ү: 'ü',
    ф: 'f',
    х: 'x',
    һ: 'h',
    ч: 'ç',
    ҹ: 'c',
    ш: 'ş',
    ы: 'ı',
    // The substitutions the archive's own sheets prove, and the reason a
    // Russian table produces nonsense here: ъ→c, э→g, ц→ü, я→ə, щ→h. "Эянъя"
    // is Gəncə and "сащяси" is sahəsi.
    ъ: 'c',
    э: 'g',
    ц: 'ü',
    я: 'ə',
    щ: 'h',
    // The proper Azerbaijani Cyrillic schwa, for text that was written with it
    // rather than substituted around it.
    ә: 'ə',
  }),
);

// What is folded away before two strings are held against each other, and is
// not decomposable: the schwa and the dotless i have no combining form, so the
// pass below cannot reach them.
//
// Everything else — ü, ö, ç, ğ, ş and any Latin accent — is a base letter plus
// a mark once the string is decomposed, and is handled there.
const FOLDED: ReadonlyMap<string, string> = new Map(
  Object.entries({
    ə: 'e',
    ı: 'i',
  }),
);

export function fromLegacyCyrillic(raw: string): string {
  return [...raw].map(letter => LEGACY_CYRILLIC.get(letter) ?? letter).join('');
}

/** Whether the string holds Cyrillic at all — what decides if the table above runs. */
export function isCyrillic(raw: string): boolean {
  return /[Ѐ-ӿ]/u.test(raw);
}

/**
 * The comparison skeleton of one word: lower case, Latin script, no diacritics.
 * Never shown to anybody — it exists so two spellings of one word land on one
 * string.
 */
export function fold(raw: string): string {
  const latin = isCyrillic(raw) ? fromLegacyCyrillic(raw.toLowerCase()) : raw;

  /*
   * Decomposed and stripped of its marks after lowercasing, not before.
   *
   * "İ" — the dotted capital I, which every Azerbaijani name in upper case is
   * full of — lowercases to "i" followed by a *combining dot above*, not to
   * "i". So "ELÇİN" and "Elçin" were two different strings, and a name printed
   * in capitals on one paper never matched the same name printed normally on
   * another. Found by the first end-to-end call against the register, which
   * reported the owner as differing from himself.
   */
  return [...latin.toLowerCase().normalize('NFD').replaceAll(/\p{M}/gu, '')]
    .map(letter => FOLDED.get(letter) ?? letter)
    .join('');
}

/**
 * The words of a value, with the punctuation that only ever separates them
 * removed.
 *
 * A full stop ends a word only where a space or the end of the string follows
 * it: "küç." is the abbreviation and not part of it, while "H.Əliyev" is one
 * name, and splitting it would leave the initial floating free of the street it
 * belongs to.
 */
export function tokenise(raw: string): readonly string[] {
  return raw
    .replaceAll(/[,;:/\\()"«»]/gu, ' ')
    .replaceAll(/\.(?=\s|$)/gu, ' ')
    .split(/[\s -]+/u)
    .map(token => token.trim())
    .filter(token => token.length > 0);
}

/**
 * A name without the initials in front of it: "H.Əliyev" and "H. Əliyev" are
 * the same street as "Əliyev".
 *
 * An initial one document prints and another omits is the commonest difference
 * between two spellings of one Azerbaijani street name, and it identifies
 * nothing on its own — so it is shown and never compared. A name that is only
 * an initial is left alone: stripping it down to nothing would match anything.
 */
export function stripInitials(raw: string): string {
  return raw.replace(/^(?:\p{L}[.\s]+)+/u, '').trim() || raw.trim();
}

/** Digits only, for values whose separators are formatting: 12 34 567 = 1234567. */
export function digitsOf(raw: string): string {
  return raw.replaceAll(/\D/gu, '');
}
