/*
 * The span of a house, worked out of the axis chains its floor plans dimension
 * — the acceptance contract's "calculating the span length" (ADR-0043).
 *
 * A span is the distance between the centre axes of two adjacent load-bearing
 * structures (UPCC 3.0.48). It is neither the size of a room nor the overall
 * width of the building, and those are the two figures a plan prints most
 * prominently: a room may cross an axis — the sample design's studio runs from
 * axis A to axis C, 2400 + 5200 = 7600, over axis B — and the overall width of
 * any house is more than six metres, so reading either would put every house
 * under 8.0.10.1. Only an entry between two axes with no third axis of the same
 * chain between them is a span.
 *
 * A bare figure's unit is decided by the building rather than by the sheet: the
 * sample design's general notes say its dimensions are in centimetres and every
 * figure on it is millimetres. The overall lengths of the two chains multiplied
 * together are the footprint, and the unit is the one that makes the footprint
 * the built-up area the design itself states.
 */

// How the spans of one direction are named on a plan: the circled numerals, or
// the circled letters.
export const AXIS_CHAINS = ['Numbered', 'Lettered'] as const;
export type AxisChain = (typeof AXIS_CHAINS)[number];

// What a bare figure on the chains was read as.
export const SPAN_UNITS = ['mm', 'cm', 'm'] as const;
export type SpanUnit = (typeof SPAN_UNITS)[number];

// Who decided that: a unit printed beside every figure, the built-up area the
// footprint was held against, or the rule a drawing is dimensioned in
// millimetres, where there was no area to hold it against.
export const SPAN_UNIT_BASES = ['Printed', 'BuiltUpArea', 'Assumed'] as const;
export type SpanUnitBasis = (typeof SPAN_UNIT_BASES)[number];

export type AxisSpan = {
  readonly from: string;
  readonly to: string;
  // Metres.
  readonly length: number;
};

export type ChainSpans = {
  readonly chain: AxisChain;
  // Every span of the chain, in axis order.
  readonly spans: readonly AxisSpan[];
  readonly longest: AxisSpan;
};

export type SpanCalculation = {
  // Metres: the longest span in either direction — what the table of
  // provisions holds against six metres.
  readonly longest: number;
  // One per chain the value names, never empty.
  readonly chains: readonly ChainSpans[];
  readonly unit: SpanUnit;
  readonly unitBasis: SpanUnitBasis;
  // The entries set aside as not a span: between two axes with another between
  // them — a room, or the overall dimension — as printed.
  readonly setAside: readonly string[];
};

// An axis mark: a numeral of one or two digits, or a single capital letter in
// either script the drawings use.
const AXIS = String.raw`(\d{1,2}|\p{Lu})`;
const ENTRY = new RegExp(
  String.raw`^\s*${AXIS}\s*[-‐‑‒–—―−]\s*${AXIS}(?![\p{L}\d])\s*[:=]?\s*(.*)$`,
  'u',
);
const LENGTH = /(\d+(?:[.,]\d+)?)\s*(\p{L}*)/u;

const PRINTED_UNIT: ReadonlyMap<string, SpanUnit> = new Map(
  Object.entries({
    mm: 'mm',
    мм: 'mm',
    sm: 'cm',
    cm: 'cm',
    см: 'cm',
    m: 'm',
    metr: 'm',
    metre: 'm',
    meter: 'm',
    м: 'm',
    метр: 'm',
  }),
);

const PER_METRE: Readonly<Record<SpanUnit, number>> = {
  mm: 1000,
  cm: 100,
  m: 1,
};

// How far the footprint may stand off the stated built-up area and still be
// the same building. The axes of the outer walls run through the middle of the
// walls, so the footprint over the axes is a little smaller than the built-up
// area measured over the outside — on the sample design 8.4 × 14.4 = 121 m²
// against 130.2. The units the choice is between are a hundred times apart
// squared, so a wide band decides nothing wrongly.
const FOOTPRINT_TOLERANCE = 1.5;

// A bare figure this large is millimetres, where there is no area to decide it
// by — the rule `spanInMetres` reads a bare figure by.
const BARE_MILLIMETRES_FROM = 100;

type Entry = {
  readonly printed: string;
  readonly from: string;
  readonly to: string;
  readonly chain: AxisChain;
  readonly amount: number;
  readonly unit: SpanUnit | null;
};

/**
 * The spans of a building out of the axis spacings its floor plans dimension —
 * "1—2 4000; 2—3 4400; A—B 2400; B—C 5200" — and the built-up area the same
 * design states, where it states one.
 *
 * Null where no entry is a length between two axes.
 */
export function spanCalculationOf(
  dimensions: string,
  builtUpArea: string | null,
): SpanCalculation | null {
  const printed = dimensions
    .split(/[;\n]/u)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
  const entries = printed.flatMap(entryOf);

  // A value that names no axes states no span. It was once read as the largest
  // length on it, and on a customer's set that dimensions rooms and marks no
  // axes the reader returned "19400—23000 18600" — which that read as an
  // 18.6 m span (eval/span, 2026-09-24). A span is between two axes or it is
  // not a span (UPCC 3.0.48).
  if (entries.length === 0) return null;

  const kept = entries.filter(entry => adjacent(entry, entries));
  const setAside = entries
    .filter(entry => !kept.includes(entry))
    .map(entry => entry.printed);
  const { unit, unitBasis } = unitOf(kept, builtUpArea);

  const chains = AXIS_CHAINS.flatMap(chain => {
    const spans = kept
      .filter(entry => entry.chain === chain)
      .map(entry => ({
        from: entry.from,
        to: entry.to,
        length: entry.amount / PER_METRE[entry.unit ?? unit],
      }))
      .sort((one, other) => rank(one.from) - rank(other.from));
    const longest = spans.reduce<AxisSpan | null>(
      (best, span) =>
        best === null || span.length > best.length ? span : best,
      null,
    );

    return longest ? [{ chain, spans, longest }] : [];
  });

  if (chains.length === 0) return null;

  return {
    longest: Math.max(...chains.map(chain => chain.longest.length)),
    chains,
    unit,
    unitBasis,
    setAside,
  };
}

function entryOf(printed: string): Entry[] {
  const match = ENTRY.exec(printed);

  if (!match) return [];

  const [, from, to, rest] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  const chain = chainOf(from);

  // "A—2" names axes of two chains, and is no spacing between them.
  if (chain !== chainOf(to) || from === to) return [];

  const length = LENGTH.exec(rest);

  if (!length) return [];

  const amount = Number(length[1]!.replace(',', '.'));
  const word = length[2]!.toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) return [];
  if (word !== '' && !PRINTED_UNIT.has(word)) return [];

  // Written the way the chain runs, so "C—B" and "B—C" are the same span.
  const [first, second] = rank(from) <= rank(to) ? [from, to] : [to, from];

  return [
    {
      printed,
      from: first,
      to: second,
      chain,
      amount,
      unit: PRINTED_UNIT.get(word) ?? null,
    },
  ];
}

function chainOf(axis: string): AxisChain {
  return /^\d/u.test(axis) ? 'Numbered' : 'Lettered';
}

// An axis's place along its chain: its number, or its letter's place in its
// alphabet. Only the order matters — which axes lie between two others.
function rank(axis: string): number {
  return /^\d/u.test(axis) ? Number(axis) : axis.codePointAt(0)!;
}

/*
 * Whether an entry is a span: no axis the value names on the same chain lies
 * between its two. An axis the value never names cannot be known to be there,
 * so "A—C" stands where nothing mentions B.
 */
function adjacent(entry: Entry, entries: readonly Entry[]): boolean {
  const low = rank(entry.from);
  const high = rank(entry.to);

  return !entries.some(
    other =>
      other.chain === entry.chain &&
      [other.from, other.to].some(
        axis => rank(axis) > low && rank(axis) < high,
      ),
  );
}

function unitOf(
  kept: readonly Entry[],
  builtUpArea: string | null,
): { unit: SpanUnit; unitBasis: SpanUnitBasis } {
  const bare = kept.filter(entry => entry.unit === null);

  if (bare.length === 0) {
    return { unit: kept[0]?.unit ?? 'm', unitBasis: 'Printed' };
  }

  const area = builtUpArea === null ? null : squareMetresIn(builtUpArea);
  const lengths = AXIS_CHAINS.map(chain =>
    kept
      .filter(entry => entry.chain === chain && entry.unit === null)
      .reduce((sum, entry) => sum + entry.amount, 0),
  );

  if (area !== null && lengths.every(length => length > 0)) {
    const footprint = lengths[0]! * lengths[1]!;
    const fits = SPAN_UNITS.map(unit => ({
      unit,
      off: Math.abs(Math.log(footprint / PER_METRE[unit] ** 2 / area)),
    }))
      .filter(fit => fit.off <= Math.log(FOOTPRINT_TOLERANCE))
      .sort((one, other) => one.off - other.off);

    if (fits[0]) return { unit: fits[0].unit, unitBasis: 'BuiltUpArea' };
  }

  const large = bare.every(entry => entry.amount >= BARE_MILLIMETRES_FROM);

  return { unit: large ? 'mm' : 'm', unitBasis: 'Assumed' };
}

// An area in square metres out of "130.2 m²", "130,2 м2" or a bare "130.2";
// null for an area in hectares or ares, which is a parcel and not a footprint.
function squareMetresIn(raw: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(\p{L}*)/u.exec(raw);

  if (!match) return null;

  const amount = Number(match[1]!.replace(',', '.'));
  const unit = match[2]!.toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) return null;

  return ['', 'm', 'м', 'kv'].includes(unit) ? amount : null;
}
