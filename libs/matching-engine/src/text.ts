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
    // Russian table produces nonsense here: ъ→c, э→g, ц→ü, я→ə, щ→h, ь→ğ.
    // "Эянъя" is Gəncə and "сащяси" is sahəsi.
    ъ: 'c',
    э: 'g',
    ц: 'ü',
    я: 'ə',
    щ: 'h',
    // ь is not a soft sign here: the technical-passport database writes
    // "Таьыйев" for Tağıyev, "оьлу" for oğlu, "маьазасы" for mağazası and
    // "Ляьв" for ləğv, so in this code page it is the letter ğ. Read as a soft
    // sign — which is what a Russian table does — it drops out and an address
    // stops resolving.
    ь: 'ğ',
    // And ю is ö, not yu. The same database heads a column "Паспорт нюмряси"
    // and translates it, in the sheet beside it, as "Passport No." — nömrəsi.
    ю: 'ö',
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

/**
 * How alike two strings are: 1 for the same skeleton, down to 0 for two that
 * share nothing. The edit distance between their folded forms over the length
 * of the longer one.
 *
 * Arithmetic and not a rule. Whether 0.83 is one street misspelled or two
 * different streets depends entirely on what is being compared — a house number
 * off by one digit is a different house, a surname off by one letter is the same
 * person — so this says how far apart the letters are and the rules above it
 * (`nameConfidence`, `referenceConfidence`, `addressConfidence`) say what that
 * is worth.
 *
 * Two empty strings are 0 and not 1: nothing was compared, and no evidence is
 * not agreement.
 */
export function similarity(left: string, right: string): number {
  const first = fold(left);
  const second = fold(right);
  const longest = Math.max(first.length, second.length);

  if (longest === 0) return 0;

  return Math.max(0, 1 - distance(first, second) / longest);
}

/**
 * Levenshtein distance, over one row rather than the whole matrix: the strings
 * here are a word or an address and the table is never wanted afterwards.
 */
function distance(first: string, second: string): number {
  if (first === second) return 0;
  if (first.length === 0) return second.length;
  if (second.length === 0) return first.length;

  let row = Array.from({ length: second.length + 1 }, (_, i) => i);

  for (let i = 1; i <= first.length; i += 1) {
    const next = [i];

    for (let j = 1; j <= second.length; j += 1) {
      next[j] = Math.min(
        (next[j - 1] ?? 0) + 1,
        (row[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + (first[i - 1] === second[j - 1] ? 0 : 1),
      );
    }

    row = next;
  }

  return row[second.length] ?? 0;
}

/**
 * Below this, two words are not one word misspelled — they are two words.
 *
 * One number for the whole engine, because it answers one question: how far a
 * word may be from another and still be read as the same word. `Aliyeva` and
 * `Əliyeva` are one surname written twice; `Əliyev` and `Əzizov` are two
 * people, and a scale with no floor under it would call them a third alike.
 */
export const SAME_WORD = 0.75;

/**
 * How much of the shorter list of words the longer one carries, from 1 for all
 * of them to 0 for none.
 *
 * Each word of the shorter list is worth the best likeness it finds in the
 * longer one, and nothing at all below `SAME_WORD`: a word that merely shares
 * some letters with a word beside it is not half of a match, it is not a match.
 * That floor is the difference between grading a misspelling and grading two
 * unrelated names as half alike — `qızı` against `qızı` is worth its line,
 * `Həsənova` against `Əliyeva` is worth nothing.
 */
export function tokenCoverage(
  shorter: readonly string[],
  longer: readonly string[],
): number {
  if (shorter.length === 0) return 0;

  const found = shorter.reduce((total, token) => {
    const best = longer.reduce(
      (most, other) => Math.max(most, similarity(token, other)),
      0,
    );

    return total + (best >= SAME_WORD ? best : 0);
  }, 0);

  return found / shorter.length;
}
