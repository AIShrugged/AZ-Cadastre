/*
 * The figures a case is decided on, read off the values the papers state: how
 * tall the building is, how many storeys it has, how long its longest span is,
 * and when it — or the paper — is dated.
 *
 * Read here and not in a matcher because nothing is being compared: the
 * question is what the number is, not whether two of them are the same value.
 *
 * A figure nobody can read comes back as null and never as a guess. Which
 * provision of Article 8 a case falls under turns on these figures (ADR-0025),
 * and a made-up metre would place the case under the wrong provision with the
 * same confidence as the right one.
 */

// What one metre is, in each unit a title block states a length in. Both
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
 * metres would put the building under a provision it is nowhere near.
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

// A bare dimension on a floor plan is millimetres — "6000" between two axes is
// six metres, never six kilometres — while a bare figure in a title block is
// metres. A span of a hundred metres or more is no house, so a bare figure that
// large is read as the drawing's own unit.
const BARE_MILLIMETRES_FROM = 100;

/**
 * The longest span of a building in metres, out of the axis spacings a floor
 * plan dimensions — "A—B 6,00 m; B—C 5,40 m; 1—2 4800".
 *
 * Each entry's figure is the last one in it that stands under a unit this
 * knows: "1—2 4,80 m" names the axes 1 and 2 before it states the spacing, and
 * the axis numbers are not lengths. Null where no entry states a length at all.
 */
export function spanInMetres(raw: string): number | null {
  const spans = raw.split(/[;\n]/u).flatMap(entry => {
    const lengths = [...entry.matchAll(/(\d+(?:[.,]\d+)?)\s*(\p{L}*)/gu)]
      .map(match => {
        const amount = Number(match[1]!.replace(',', '.'));
        const unit = match[2]!.toLowerCase();
        const factor = IN_METRES.get(unit);

        if (!Number.isFinite(amount) || factor === undefined) return null;
        if (unit === '' && amount >= BARE_MILLIMETRES_FROM) {
          return amount * 0.001;
        }

        return amount * factor;
      })
      .filter((length): length is number => length !== null);

    const last = lengths.at(-1);

    return last === undefined ? [] : [last];
  });

  return spans.length > 0 ? Math.max(...spans) : null;
}

// More storeys than this is no individual house, and a figure above it is a
// sheet number, a year or an area that happened to come first.
const MOST_STOREYS = 99;

/**
 * The number of storeys out of "2", "2 mərtəbə" or "2 этажа" — the first whole
 * figure the value states that could be a count of storeys.
 *
 * A figure with a fractional part is not a count ("2,5 m" is a height), so it is
 * passed over rather than truncated.
 */
export function storeysIn(raw: string): number | null {
  for (const match of raw.matchAll(/(?<![\d.,])(\d{1,3})(?![\d]|[.,]\d)/gu)) {
    const storeys = Number(match[1]);

    if (storeys >= 1 && storeys <= MOST_STOREYS) return storeys;
  }

  return null;
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

/**
 * The days a value is dated within, as ISO dates: one day for "12.05.1995" or
 * "1995-05-12", the whole year for a value that states only "1995".
 *
 * A span and not a date, because a title document's window has an edge — 6 July
 * 2006, 19 December 1995 — and a paper whose day went unread is not thereby
 * dated 1 January. Whether a year-only reading falls inside a window is decided
 * by whoever holds the window (`TitleDocumentEntry.admits`).
 */
export function dateSpanIn(
  raw: string,
): { readonly first: string; readonly last: string } | null {
  const dayFirst = /(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/u.exec(
    raw,
  );
  const yearFirst = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/u.exec(raw);

  const [year, month, day] = dayFirst
    ? [dayFirst[3], dayFirst[2], dayFirst[1]]
    : yearFirst
      ? [yearFirst[1], yearFirst[2], yearFirst[3]]
      : [undefined, undefined, undefined];

  if (year && month && day) {
    const iso = calendarDate(Number(year), Number(month), Number(day));

    if (iso) return { first: iso, last: iso };
  }

  const alone = yearIn(raw);

  return alone === null
    ? null
    : { first: `${alone}-01-01`, last: `${alone}-12-31` };
}

// A date that exists, as an ISO string, or null for "31.02.1995" and for a year
// outside the window a paper can be dated in.
function calendarDate(year: number, month: number, day: number): string | null {
  if (year < EARLIEST_YEAR || year > LATEST_YEAR) return null;
  if (month < 1 || month > 12 || day < 1) return null;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (day > daysInMonth) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
