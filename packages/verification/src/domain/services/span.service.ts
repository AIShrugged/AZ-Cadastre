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
 *
 * None of that holds a reader to anything, and a reader shown a set that marks
 * no axes has been seen to number the gaps between rooms itself. A case was
 * decided in production on "5—6 545" off a first-floor plan whose figures are
 * centimetres — a 54.5 cm span, which no building has, on a chain no drawing
 * carries (COMM-160). So the calculation checks itself before it is anything:
 * the chain read against the overall dimension of the same chain, the two
 * chains multiplied against the built-up area, and the answer against the
 * lengths a span can have. A check that does not pass refuses the calculation —
 * the parameter is left unestablished and the case goes to an inspector with
 * the reason in words, which is what an empty figure is for. A confident wrong
 * figure is the one thing nobody checks.
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

/*
 * Why a calculation states no span although entries were read off the value.
 * Each is a check the reading failed, in the order they are put to it:
 *
 * - `OneChain`: only one direction was read. A building is framed in two, so a
 *   single chain is half a reading — and it is the half that leaves the unit
 *   with nothing to be checked against.
 * - `ChainUnlikeOverall`: the spans of a chain do not add up to the overall
 *   dimension the same plan prints for it.
 * - `FootprintUnlikeArea`: the two chains multiplied are no unit's worth of the
 *   built-up area the design states.
 * - `UnitUnchecked`: nothing stated the unit and nothing could decide it — no
 *   unit printed beside the figures and no built-up area to hold them against.
 * - `Implausible`: the answer is not a length a span has.
 */
export const SPAN_REFUSALS = [
  'OneChain',
  'ChainUnlikeOverall',
  'FootprintUnlikeArea',
  'UnitUnchecked',
  'Implausible',
] as const;
export type SpanRefusal = (typeof SPAN_REFUSALS)[number];

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
  // provisions holds against six metres. Null where a check refused the
  // reading: the working is still stated, so that what was refused can be seen.
  readonly longest: number | null;
  // One per chain the value names, never empty.
  readonly chains: readonly ChainSpans[];
  readonly unit: SpanUnit;
  readonly unitBasis: SpanUnitBasis;
  // The entries set aside as not a span: between two axes with another between
  // them — a room, or the overall dimension — as printed.
  readonly setAside: readonly string[];
  // The check the reading failed, or null where it passed all of them.
  readonly refusedFor: SpanRefusal | null;
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

/*
 * How far the spans of a chain may stand off the overall dimension the same
 * plan prints for that chain. They add up to it exactly where both are taken
 * over the axes; a set that prints the overall dimension over the outer faces
 * instead is a few hundred millimetres longer — 8800 against the 8400 of the
 * sample design's numbered chain, 4.8 per cent. Ten per cent forgives that and
 * still catches a chain whose figures were read off the wrong dimension line.
 */
const OVERALL_TOLERANCE = 1.1;

/*
 * The lengths a span can have, in metres. The floor is the narrowest bay worth
 * framing — a corridor between two walls — and the ceiling is past anything an
 * individual house is built with; either end means the figures, or the unit
 * they were read in, are not what they were taken for. The production case this
 * was written for (COMM-160) worked out at 0.545 m and was decided on.
 */
const PLAUSIBLE_FROM = 1.5;
const PLAUSIBLE_TO = 30;

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
 * "1—2 4000; 2—3 4400; A—B 2400; B—C 5200" — the built-up area the same design
 * states, and the overall dimension of each chain where the same design states
 * that: "1—3 8400; A—E 14400".
 *
 * Null where no entry is a length between two axes. A calculation whose
 * `longest` is null is one the checks refused: `refusedFor` says which.
 */
export function spanCalculationOf(
  dimensions: string,
  builtUpArea: string | null,
  overallDimensions: string | null = null,
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
  const area = builtUpArea === null ? null : squareMetresIn(builtUpArea);
  const { unit, unitBasis } = unitOf(kept, area);

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

  const longest = Math.max(...chains.map(chain => chain.longest.length));
  const refusedFor = refusalOf({
    chains,
    longest,
    unitBasis,
    area,
    overall: overallDimensions === null ? [] : overallOf(overallDimensions),
    unit,
  });

  return {
    longest: refusedFor === null ? longest : null,
    chains,
    unit,
    unitBasis,
    setAside,
    refusedFor,
  };
}

/*
 * What the reading failed, or null where it passed everything. The checks are
 * put in the order of what they say about the reading: whether both directions
 * were read at all, then whether each chain agrees with its own overall
 * dimension, then whether the two together are the building the design states,
 * then whether the unit was decided by anything, and last whether the answer is
 * a length a span has. The first failure is the one reported — it is the one
 * the later checks are standing on.
 */
function refusalOf({
  chains,
  longest,
  unit,
  unitBasis,
  area,
  overall,
}: {
  chains: readonly ChainSpans[];
  longest: number;
  unit: SpanUnit;
  unitBasis: SpanUnitBasis;
  area: number | null;
  overall: readonly Entry[];
}): SpanRefusal | null {
  // A house is framed in both directions, and a set that dimensions only one of
  // them was not read whole: what was read may be the rooms of a plan that
  // marks no axes, numbered by the reader (COMM-160).
  if (chains.length < AXIS_CHAINS.length) return 'OneChain';

  if (chains.some(chain => unlikeOverall(chain, overall, unit))) {
    return 'ChainUnlikeOverall';
  }

  // The area was there to decide the unit by and decided nothing: the chains
  // are not the footprint of the building the design describes.
  if (area !== null && unitBasis === 'Assumed') return 'FootprintUnlikeArea';
  if (unitBasis === 'Assumed') return 'UnitUnchecked';
  if (longest < PLAUSIBLE_FROM || longest > PLAUSIBLE_TO) return 'Implausible';

  return null;
}

/*
 * Whether a chain's spans fail to add up to the overall dimension stated for
 * that chain. A chain no overall dimension names is not checked: this is a
 * check the design either offers or does not, and a set that prints no overall
 * dimension line refuses nothing.
 */
function unlikeOverall(
  chain: ChainSpans,
  overall: readonly Entry[],
  unit: SpanUnit,
): boolean {
  const stated = overall
    .filter(entry => entry.chain === chain.chain)
    .map(entry => entry.amount / PER_METRE[entry.unit ?? unit]);

  if (stated.length === 0) return false;

  const summed = chain.spans.reduce((sum, span) => sum + span.length, 0);

  // The longest of several, because a set may print the chain over the axes and
  // again over the outer faces, and the one the spans are measured against is
  // the one they can add up to.
  const against = Math.max(...stated);

  return (
    summed <= 0 ||
    against <= 0 ||
    Math.abs(Math.log(summed / against)) > Math.log(OVERALL_TOLERANCE)
  );
}

// The overall dimension of each chain, read as the chain entries are — "1—3
// 8400" names the two end axes — and never held to being between adjacent ones,
// which is the whole difference between it and a span.
function overallOf(dimensions: string): Entry[] {
  return dimensions
    .split(/[;\n]/u)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
    .flatMap(entryOf);
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
  area: number | null,
): { unit: SpanUnit; unitBasis: SpanUnitBasis } {
  const bare = kept.filter(entry => entry.unit === null);

  if (bare.length === 0) {
    return { unit: kept[0]?.unit ?? 'm', unitBasis: 'Printed' };
  }

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

/*
 * An area in square metres out of "130.2 m²", "130,2 м2" or a bare "130.2";
 * null for an area in hectares or ares, which is a parcel and not a footprint.
 *
 * A design states the footprint as its sides as often as as a figure —
 * "10.8 x 16.1 = 174.48 m²" — and the first number on that line is a side and
 * not the area. Where the line works it out, the total is taken; where it only
 * multiplies, nothing is: an area read a hundred and sixty times too small
 * would decide the unit of every chain wrongly, and silently (COMM-160).
 */
function squareMetresIn(raw: string): number | null {
  const worked = raw.lastIndexOf('=');
  const stated = worked === -1 ? raw : raw.slice(worked + 1);

  // "10.8 x 16.1" and "10,8 × 16,1" state the sides of the footprint, in the
  // Latin x, the Cyrillic х, the multiplication sign or an asterisk.
  if (/\d\s*[x×*х]\s*\d/iu.test(stated)) return null;

  const match = /(\d+(?:[.,]\d+)?)\s*(\p{L}*)/u.exec(stated);

  if (!match) return null;

  const amount = Number(match[1]!.replace(',', '.'));
  const unit = match[2]!.toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) return null;

  return ['', 'm', 'м', 'kv'].includes(unit) ? amount : null;
}
