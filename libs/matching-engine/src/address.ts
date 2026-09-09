import {
  fold,
  fromLegacyCyrillic,
  isCyrillic,
  SAME_WORD,
  similarity,
  stripInitials,
  tokenCoverage,
  tokenise,
} from './text.js';

// The words that say what a part of an address *is*. An Azerbaijani address
// puts them after the name — "Zığ qəsəbəsi", "Suraxanı rayonu" — and a Russian
// one puts them before it — "ул. Ленина" — so binding a marker to its value
// cannot assume a side.

type Scope = 'place' | 'way' | 'unit';

type Marker = {
  // How the level is spelled once, whatever it arrived as.
  readonly canonical: string;
  readonly scope: Scope;
};

const MARKERS: ReadonlyMap<string, Marker> = new Map(
  Object.entries({
    // ── city, district, settlement ──────────────────────────────────────
    şəhəri: { canonical: 'şəhəri', scope: 'place' },
    şəhər: { canonical: 'şəhəri', scope: 'place' },
    şəh: { canonical: 'şəhəri', scope: 'place' },
    seheri: { canonical: 'şəhəri', scope: 'place' },
    seher: { canonical: 'şəhəri', scope: 'place' },
    город: { canonical: 'şəhəri', scope: 'place' },
    г: { canonical: 'şəhəri', scope: 'place' },
    rayonu: { canonical: 'rayonu', scope: 'place' },
    rayon: { canonical: 'rayonu', scope: 'place' },
    ray: { canonical: 'rayonu', scope: 'place' },
    r: { canonical: 'rayonu', scope: 'place' },
    район: { canonical: 'rayonu', scope: 'place' },
    района: { canonical: 'rayonu', scope: 'place' },
    району: { canonical: 'rayonu', scope: 'place' },
    qəsəbəsi: { canonical: 'qəsəbəsi', scope: 'place' },
    qəsəbə: { canonical: 'qəsəbəsi', scope: 'place' },
    qəs: { canonical: 'qəsəbəsi', scope: 'place' },
    qesebesi: { canonical: 'qəsəbəsi', scope: 'place' },
    qesebe: { canonical: 'qəsəbəsi', scope: 'place' },
    qes: { canonical: 'qəsəbəsi', scope: 'place' },
    посёлок: { canonical: 'qəsəbəsi', scope: 'place' },
    поселок: { canonical: 'qəsəbəsi', scope: 'place' },
    пос: { canonical: 'qəsəbəsi', scope: 'place' },
    kəndi: { canonical: 'kəndi', scope: 'place' },
    kənd: { canonical: 'kəndi', scope: 'place' },
    kendi: { canonical: 'kəndi', scope: 'place' },
    село: { canonical: 'kəndi', scope: 'place' },
    mikrorayonu: { canonical: 'mikrorayonu', scope: 'place' },
    mikrorayon: { canonical: 'mikrorayonu', scope: 'place' },
    mkr: { canonical: 'mikrorayonu', scope: 'place' },
    микрорайон: { canonical: 'mikrorayonu', scope: 'place' },
    мкр: { canonical: 'mikrorayonu', scope: 'place' },
    məhəlləsi: { canonical: 'məhəlləsi', scope: 'place' },
    məhəllə: { canonical: 'məhəlləsi', scope: 'place' },
    mehellesi: { canonical: 'məhəlləsi', scope: 'place' },
    квартал: { canonical: 'məhəlləsi', scope: 'place' },

    // ── street ──────────────────────────────────────────────────────────
    küçəsi: { canonical: 'küçəsi', scope: 'way' },
    küçə: { canonical: 'küçəsi', scope: 'way' },
    küç: { canonical: 'küçəsi', scope: 'way' },
    kucesi: { canonical: 'küçəsi', scope: 'way' },
    kuce: { canonical: 'küçəsi', scope: 'way' },
    kuc: { canonical: 'küçəsi', scope: 'way' },
    улица: { canonical: 'küçəsi', scope: 'way' },
    улицы: { canonical: 'küçəsi', scope: 'way' },
    ул: { canonical: 'küçəsi', scope: 'way' },
    prospekti: { canonical: 'prospekti', scope: 'way' },
    prospekt: { canonical: 'prospekti', scope: 'way' },
    prosp: { canonical: 'prospekti', scope: 'way' },
    pr: { canonical: 'prospekti', scope: 'way' },
    проспект: { canonical: 'prospekti', scope: 'way' },
    döngəsi: { canonical: 'döngəsi', scope: 'way' },
    döngə: { canonical: 'döngəsi', scope: 'way' },
    dongesi: { canonical: 'döngəsi', scope: 'way' },
    переулок: { canonical: 'döngəsi', scope: 'way' },

    // ── house and flat ──────────────────────────────────────────────────
    ev: { canonical: 'ev', scope: 'unit' },
    evi: { canonical: 'ev', scope: 'unit' },
    dom: { canonical: 'ev', scope: 'unit' },
    дом: { canonical: 'ev', scope: 'unit' },
    д: { canonical: 'ev', scope: 'unit' },
    bina: { canonical: 'bina', scope: 'unit' },
    korpus: { canonical: 'bina', scope: 'unit' },
    корпус: { canonical: 'bina', scope: 'unit' },
    mənzil: { canonical: 'mənzil', scope: 'unit' },
    menzil: { canonical: 'mənzil', scope: 'unit' },
    mnz: { canonical: 'mənzil', scope: 'unit' },
    квартира: { canonical: 'mənzil', scope: 'unit' },
    кв: { canonical: 'mənzil', scope: 'unit' },
  }),
);

// The order the levels are written in when the address is spelled back out,
// widest first. Only for display: nothing compares on it.
const WRITTEN_ORDER: readonly string[] = [
  'şəhəri',
  'rayonu',
  'qəsəbəsi',
  'kəndi',
  'mikrorayonu',
  'məhəlləsi',
  'küçəsi',
  'prospekti',
  'döngəsi',
  'bina',
  'ev',
  'mənzil',
];

export type ParsedAddress = {
  // One value per level. A second value for a level already bound is not a
  // level: an address states each of them once, and the extra is noise.
  readonly parts: ReadonlyMap<string, string>;
  // Words no marker claimed — a settlement written without its word, a given
  // name, a block number. Kept, because dropping them would let two different
  // places compare equal.
  readonly rest: readonly string[];
};

function markerFor(token: string): Marker | null {
  return MARKERS.get(token.toLowerCase()) ?? MARKERS.get(fold(token)) ?? null;
}

function isNumeric(token: string): boolean {
  return /^\d+[a-zA-Zа-яА-Я]?$/u.test(token);
}

function isInitial(token: string | undefined): boolean {
  return token !== undefined && /^\p{L}\.?$/u.test(token);
}

// What a level is compared as: folded, and without the initials that identify
// nobody. What it is shown as keeps them.
function comparable(value: string): string {
  return fold(stripInitials(value));
}

function latin(token: string): string {
  return isCyrillic(token) ? fromLegacyCyrillic(token.toLowerCase()) : token;
}

/**
 * An address read into the levels it names. A marker takes the word before it
 * when there is one to take — which is how Azerbaijani writes it — and the word
 * after it otherwise, which is how Russian does. A bare number straight after a
 * street is the house on that street, whichever language wrote it.
 */
export function parseAddress(raw: string): ParsedAddress {
  const tokens = tokenise(raw);
  const markers = tokens.map(token => markerFor(token));
  const taken = tokens.map(() => false);
  const parts = new Map<string, string>();

  const claim = (marker: string, index: number, before?: number): boolean => {
    if (parts.has(marker)) return false;
    const token = tokens[index];
    if (token === undefined) return false;

    // "H. Əliyev küçəsi" — an initial written apart from the name is part of
    // the name, not a word of its own the address left lying around.
    const initial =
      before !== undefined && isInitial(tokens[before]) ? before : null;

    if (initial !== null) taken[initial] = true;

    parts.set(
      marker,
      initial === null
        ? latin(token)
        : `${latin(tokens[initial] ?? '')} ${latin(token)}`,
    );
    taken[index] = true;

    return true;
  };

  const free = (index: number): boolean =>
    index >= 0 &&
    index < tokens.length &&
    markers[index] === null &&
    !taken[index];

  markers.forEach((marker, index) => {
    if (!marker) return;
    taken[index] = true;

    const before = index - 1;
    const after = index + 1;
    const namedBefore =
      free(before) &&
      !isNumeric(tokens[before] ?? '') &&
      claim(
        marker.canonical,
        before,
        free(before - 1) ? before - 1 : undefined,
      );

    if (!namedBefore) claim(marker.canonical, after);

    // "H.Əliyev küç. 12" — the number after a street is the house on it, and
    // the address may never say the word "ev" at all.
    if (
      marker.scope === 'way' &&
      free(after) &&
      isNumeric(tokens[after] ?? '')
    ) {
      claim('ev', after);
    }
  });

  return {
    parts,
    rest: tokens.flatMap((token, index) =>
      markers[index] === null && !taken[index] ? [latin(token)] : [],
    ),
  };
}

/**
 * The address spelled one way: every level named in full, widest first, and
 * whatever was left over after them. What a register hands back so the reader
 * sees the record's own wording rather than their own.
 */
export function normaliseAddress(raw: string): string {
  const { parts, rest } = parseAddress(raw);
  const written = WRITTEN_ORDER.flatMap(marker => {
    const value = parts.get(marker);
    if (value === undefined) return [];

    const scope = MARKERS.get(marker)?.scope;

    return [scope === 'unit' ? `${marker} ${value}` : `${value} ${marker}`];
  });

  return [...rest, ...written].join(', ');
}

/**
 * The whole address as one comparison string — every level and every leftover,
 * folded and in a fixed order. Two addresses with the same key are the same
 * place written twice; two with different keys may still agree, because one of
 * them may simply say less (see `addressesAgree`).
 */
export function addressKey(raw: string): string {
  const { parts, rest } = parseAddress(raw);
  const levels = [...parts.entries()]
    .map(([marker, value]) => `${marker}:${comparable(value)}`)
    .sort();

  return [...levels, '~', ...rest.map(fold).sort()].join('|');
}

/**
 * Whether two ways of writing an address name the same place.
 *
 * A level one document spells out and the other omits is formatting, so only
 * the levels both of them name are held against each other — but every one of
 * those has to agree, and the words neither side attached to a level have to be
 * the same words as far as the shorter of the two goes. A different house
 * number, street or settlement is a different address, however much of the rest
 * matches.
 */
export function addressesAgree(left: string, right: string): boolean {
  const first = parseAddress(left);
  const second = parseAddress(right);

  const shared = [...first.parts.keys()].filter(marker =>
    second.parts.has(marker),
  );

  const levelsAgree = shared.every(
    marker =>
      comparable(first.parts.get(marker) ?? '') ===
      comparable(second.parts.get(marker) ?? ''),
  );

  if (!levelsAgree) return false;

  const shorter = first.rest.length <= second.rest.length ? first : second;
  const longer = shorter === first ? second : first;
  const spare = longer.rest.map(fold);
  const restAgrees = shorter.rest
    .map(fold)
    .every(token => spare.includes(token));

  if (!restAgrees) return false;

  // Two strings that named no level in common and no word in common are not an
  // agreement, they are two addresses nobody compared.
  return shared.length > 0 || shorter.rest.length > 0;
}

/**
 * The most an address whose house, flat or block differs can be worth.
 *
 * Everything wider agreeing is what makes the record worth showing at all —
 * the operator may have mistyped the number, or the archive may hold the
 * neighbour under the same case — but 12 is not a misspelling of 14, and no
 * amount of agreement about the street may let a different house read as a
 * probable one.
 */
const OTHER_UNIT = 0.5;

/**
 * How far two ways of writing an address are from naming the same place, as a
 * number rather than as a yes.
 *
 * The graded form of `addressesAgree`, and it agrees with it by construction: a
 * pair that rule accepts is 1, whatever either side left out and whichever
 * script it was written in. Below that it is the average of what was actually
 * comparable — every level both sides name, and the words neither side attached
 * to a level — so an address that agrees about the settlement and the street and
 * differs about the house scores what that is worth and no more.
 *
 * Two strings that named no level in common and shared no word are 0: they were
 * not compared, and nothing compared is not a weak match.
 */
export function addressConfidence(left: string, right: string): number {
  if (addressesAgree(left, right)) return 1;

  const first = parseAddress(left);
  const second = parseAddress(right);
  const shared = [...first.parts.keys()].filter(marker =>
    second.parts.has(marker),
  );

  const scores = shared.map(marker =>
    levelConfidence(
      marker,
      first.parts.get(marker) ?? '',
      second.parts.get(marker) ?? '',
    ),
  );

  const [shorter, longer] =
    first.rest.length <= second.rest.length
      ? [first.rest, second.rest]
      : [second.rest, first.rest];

  if (shorter.length > 0) scores.push(tokenCoverage(shorter, longer));
  if (scores.length === 0) return 0;

  const score = scores.reduce((total, one) => total + one, 0) / scores.length;
  const unitDiffers = shared.some(
    marker =>
      MARKERS.get(marker)?.scope === 'unit' &&
      comparable(first.parts.get(marker) ?? '') !==
        comparable(second.parts.get(marker) ?? ''),
  );

  return unitDiffers ? Math.min(score, OTHER_UNIT) : score;
}

/**
 * What one level both addresses name is worth.
 *
 * A number is compared as a number and forgives nothing — a house, a flat, a
 * block or a plot written as a figure is either the one asked for or another
 * one. A name is compared as a word and forgives a misspelling, down to the
 * floor below which it is simply a different name.
 */
function levelConfidence(marker: string, left: string, right: string): number {
  const first = comparable(left);
  const second = comparable(right);

  if (first === second) return 1;
  if (
    MARKERS.get(marker)?.scope === 'unit' ||
    isNumeric(first) ||
    isNumeric(second)
  ) {
    return 0;
  }

  const alike = similarity(first, second);

  return alike >= SAME_WORD ? alike : 0;
}
