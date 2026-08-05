// Whether two values off two papers are the same value, decided without asking
// anybody. It is what the mock cross-checker runs on, and it is deliberately
// forgiving in exactly the ways the paper is: a form prints a surname in
// capitals and an oblique case, a scan drops a diacritic, a receipt writes the
// card number with a space in it.

// The two Azerbaijani letters that are letters in their own right rather than a
// letter with a mark on it: decomposing gets ş, ç, ğ, ö and ü for nothing, and
// leaves these two.
const FOLDED: Readonly<Record<string, string>> = {
  ə: "e",
  ı: "i",
};

// Below this a word is too short to be recognised by its beginning: "ev" and
// "evlər" would otherwise be one word.
const SHORTEST_STEM = 3;

// Lowercased first, because "İ" lowercases to an i with a combining dot that
// the decomposition then takes off.
function fold(raw: string): string {
  const bare = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  return [...bare].map((character) => FOLDED[character] ?? character).join("");
}

export function tokensOf(raw: string): readonly string[] {
  return fold(raw)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

function digitsIn(token: string): string {
  return token.replace(/\D/gu, "");
}

// A number is the same number or it is not: nothing about it is spelling, so
// only its digits are compared and nothing is forgiven.
function isNumeric(token: string): boolean {
  return /\d/u.test(token);
}

function tokenMatches(token: string, against: readonly string[]): boolean {
  if (isNumeric(token)) {
    const digits = digitsIn(token);

    return against.some(
      (candidate) => isNumeric(candidate) && digitsIn(candidate) === digits,
    );
  }

  return against.some((candidate) => continuesTheOther(token, candidate));
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
  const ours = tokensOf(left);
  const theirs = tokensOf(right);

  if (ours.length === 0 || theirs.length === 0) return false;

  const [fewer, more] = ours.length <= theirs.length ? [ours, theirs] : [theirs, ours];

  return fewer.every((token) => tokenMatches(token, more));
}
