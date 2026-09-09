/*
 * The two figures a profile's supporting-documents branch is decided on, read
 * off the values the papers state: how tall the building is, and the year the
 * case is dated by.
 *
 * Read here and not in a matcher because nothing is being compared: the
 * question is what the number is, not whether two of them are the same value.
 *
 * A figure nobody can read comes back as null and never as a guess. The whole
 * point of the branch is that an inspector is told which set of supporting
 * documents this case needs, and a made-up metre would tell them the wrong one
 * with the same confidence as the right one.
 */

// What one metre is, in each unit a title block states a height in. Both
// scripts, because the same drawings carry Azerbaijani and Russian
// abbreviations, and the empty string because a bare figure on a line headed
// "Hündürlük" is metres.
const IN_METRES: ReadonlyMap<string, number> = new Map(
  Object.entries({
    '': 1,
    m: 1,
    metr: 1,
    metre: 1,
    meter: 1,
    м: 1,
    метр: 1,
    sm: 0.01,
    cm: 0.01,
    см: 0.01,
    mm: 0.001,
    мм: 0.001,
  }),
);

/**
 * A height in metres, whatever it was written in — "9,4 m", "940 sm", "12".
 *
 * Null where the string carries no figure, and null where it carries one under
 * a unit this does not know: "2 mərtəbə" is two storeys, and reading it as two
 * metres would put the building in a band it is nowhere near.
 */
export function heightInMetres(raw: string): number | null {
  const figure = /(\d+(?:[.,]\d+)?)/u.exec(raw);

  if (!figure?.[1]) return null;

  const amount = Number(figure[1].replace(',', '.'));

  if (!Number.isFinite(amount)) return null;

  // The first word after the figure and nothing else: "9,4 m (təxmini)" is
  // metres with a remark after it, not a unit called "mtxmini".
  const after = raw.slice(figure.index + figure[1].length);
  const unit = /^\s*(\p{L}*)/u.exec(after)?.[1]?.toLowerCase() ?? '';
  const factor = IN_METRES.get(unit);

  return factor === undefined ? null : amount * factor;
}

// Outside these a four-digit run is not a year: a receipt number, a cadastral
// group, a sum in manats.
//
// Exported because a year the office declares at intake is held to the same
// window as one read off a paper: the two are compared, and a window that let
// one side hold a figure the other never could would make the comparison a
// question about the window rather than about the case.
export const EARLIEST_YEAR = 1800;
export const LATEST_YEAR = 2200;

/**
 * The year a value is dated by — the year out of "18.12.2025", "2025-12-18" or
 * a year written on its own. The first four-digit run that could be a year,
 * because every date format these papers use puts the year in one run and no
 * other run of exactly four digits comes before it.
 */
export function yearIn(raw: string): number | null {
  for (const match of raw.matchAll(/(?<!\d)(\d{4})(?!\d)/gu)) {
    const year = Number(match[1]);

    if (year >= EARLIEST_YEAR && year <= LATEST_YEAR) return year;
  }

  return null;
}
