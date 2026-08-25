import { fold } from './text.js';

// What one square metre is, in each unit an Azerbaijani paper states an area
// in. `sot` is the hundred-square-metre unit every plot is spoken of in;
// `hektar` is ten thousand.
const IN_SQUARE_METRES: ReadonlyMap<string, number> = new Map(
  Object.entries({
    m2: 1,
    'm²': 1,
    kvm: 1,
    kv: 1,
    sqm: 1,
    sot: 100,
    sotka: 100,
    ha: 10_000,
    hektar: 10_000,
    ga: 10_000,
  }),
);

/**
 * An area in square metres, whatever it was written in — "120,5 kv.m", "1.2
 * sot", "0,012 ha". Null when the string carries no figure at all: a value
 * nobody can read is not a value that disagrees.
 */
export function parseArea(raw: string): number | null {
  const cleaned = fold(raw).replaceAll(/\s+/gu, ' ').trim();
  const figure = /(\d+(?:[.,]\d+)?)/u.exec(cleaned);

  if (!figure?.[1]) return null;

  const amount = Number(figure[1].replace(',', '.'));

  if (!Number.isFinite(amount)) return null;

  const unit = cleaned
    .slice(figure.index + figure[1].length)
    .replaceAll(/[^a-z0-9²]/gu, '');
  const factor = IN_SQUARE_METRES.get(unit);

  return amount * (factor ?? 1);
}

// Areas are stated to two decimals at most, so anything below a square
// centimetre is the float arithmetic and not the paper.
const NOISE = 1e-4;

/**
 * Whether two figures are the same area. Units written differently and a
 * decimal comma against a decimal point are formatting, and so is a figure
 * given to more places than the other. A genuinely different area is a
 * disagreement, however small the difference.
 */
export function areasAgree(left: string, right: string): boolean {
  const first = parseArea(left);
  const second = parseArea(right);

  if (first === null || second === null) return false;

  return Math.abs(first - second) < NOISE;
}
