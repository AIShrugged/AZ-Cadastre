// Whether two values off two papers are the same value, decided without asking
// anybody. It is what the mock cross-checker runs on, and it is deliberately
// forgiving in exactly the ways the paper is: a form prints a surname in
// capitals and an oblique case, a scan drops a diacritic, a receipt writes the
// card number with a space in it.

// The one Azerbaijani letter an ASCII keyboard has two answers for. `ə` is
// typed `e` by whoever hears it and `a` by whoever transliterates the Arabic
// name it came from — Kərim is written both Kerim and Karim, Həsənov both
// Hesenov and Hasanov — and the same page can do both at once: the archive's
// copy of the Hümbətov order reached the inspector as "Hümbətov Yavər Kərim
// oğlu" against the package's "Hümbətov Yaver Karim oğlu", one name, and the
// comparison reported the archive as contradicting the paper (COMM-153).
//
// So the letter is not folded to one reading but to both, and a word that
// carries no `ə` keeps the one reading it has: Balayev and Belayev are two
// surnames and must stay two.
const READ_TWO_WAYS: Readonly<Record<string, readonly string[]>> = {
  ə: ['e', 'a'],
};

// The other letter that is a letter in its own right rather than a letter with
// a mark on it — decomposing gets ş, ç, ğ, ö and ü for nothing — and it has
// only the one reading.
const FOLDED: Readonly<Record<string, string>> = {
  ı: 'i',
};

// Below this a word is too short to be recognised by its beginning: "ev" and
// "evlər" would otherwise be one word.
const SHORTEST_STEM = 3;

/*
 * How many readings of one word are worth carrying.
 *
 * Four `ə` in a word is already past any name on any paper, and the readings
 * double with each of them. Past the bound the word is read the one way it was
 * read before this existed, which is the reading a scan of Azerbaijani text
 * most often wants anyway.
 */
const MOST_READINGS = 16;

/** The ways one word can be read, the plainest folding first. */
type Readings = readonly string[];

// Lowercased first, because "İ" lowercases to an i with a combining dot that
// the decomposition then takes off.
function bare(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function fold(raw: string): string {
  return [...bare(raw)]
    .map(
      character =>
        READ_TWO_WAYS[character]?.[0] ?? FOLDED[character] ?? character,
    )
    .join('');
}

function readingsOf(word: string): Readings {
  const characters = [...bare(word)];
  const ways = characters.reduce(
    (count, character) => count * (READ_TWO_WAYS[character]?.length ?? 1),
    1,
  );

  if (ways > MOST_READINGS) return [fold(word)];

  return characters.reduce<readonly string[]>(
    (readings, character) => {
      const letters = READ_TWO_WAYS[character] ?? [
        FOLDED[character] ?? character,
      ];

      return readings.flatMap(sofar =>
        letters.map(letter => `${sofar}${letter}`),
      );
    },
    [''],
  );
}

function wordsIn(raw: string): readonly string[] {
  return raw.split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 0);
}

export function tokensOf(raw: string): readonly string[] {
  return wordsIn(raw).map(word => fold(word));
}

function readingsIn(raw: string): readonly Readings[] {
  return wordsIn(raw).map(word => readingsOf(word));
}

function digitsIn(token: string): string {
  return token.replace(/\D/gu, '');
}

// A number is the same number or it is not: nothing about it is spelling, so
// only its digits are compared and nothing is forgiven.
function isNumeric(token: string): boolean {
  return /\d/u.test(token);
}

function tokenMatches(token: Readings, against: readonly Readings[]): boolean {
  const [plainest = ''] = token;

  if (isNumeric(plainest)) {
    const digits = digitsIn(plainest);

    return against.some(candidate => {
      const [other = ''] = candidate;

      return isNumeric(other) && digitsIn(other) === digits;
    });
  }

  return against.some(candidate =>
    token.some(ours =>
      candidate.some(theirs => continuesTheOther(ours, theirs)),
    ),
  );
}

// One word is the other with an ending on it: "Əliyev" and "Əliyeva",
// "küç." and "küçəsi", a name and the case a form put it in. A word that
// merely starts alike — Gəncə against Göyçay — is not.
function continuesTheOther(left: string, right: string): boolean {
  if (left === right) return true;

  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left];

  return shorter.length >= SHORTEST_STEM && longer.startsWith(shorter);
}

// Asymmetric on purpose: the identity card carries a surname and a given name,
// the application carries those plus a patronymic and a case ending. Every word
// of the shorter side has to be answered by the longer one; the longer side is
// allowed to say more.
export function looksLikeTheSameValue(left: string, right: string): boolean {
  const ours = readingsIn(left);
  const theirs = readingsIn(right);

  if (ours.length === 0 || theirs.length === 0) return false;

  const [fewer, more] =
    ours.length <= theirs.length ? [ours, theirs] : [theirs, ours];

  return fewer.every(token => tokenMatches(token, more));
}
