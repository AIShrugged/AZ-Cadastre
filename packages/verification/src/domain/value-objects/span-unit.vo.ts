/*
 * What a bare figure on a drawing's dimension chain was read as, and who
 * decided it (ADR-0043).
 *
 * A vocabulary of its own rather than a pair of types inside the calculation,
 * because two things now state it: the calculation, and the markup drawn onto
 * the sheets, which labels every length it prints with the unit the calculation
 * decided and never with one of its own (COMM-165).
 */
export const SPAN_UNITS = ['mm', 'cm', 'm'] as const;
export type SpanUnit = (typeof SPAN_UNITS)[number];

/*
 * Who decided that: a unit printed beside every figure, the built-up area the
 * footprint was held against, or the rule a drawing is dimensioned in
 * millimetres, where there was no area to hold it against.
 */
export const SPAN_UNIT_BASES = ['Printed', 'BuiltUpArea', 'Assumed'] as const;
export type SpanUnitBasis = (typeof SPAN_UNIT_BASES)[number];

// How the lengths are labelled where nothing established the unit: an
// un-unitted figure, and not millimetres by default. A figure carrying a unit
// nobody established is what makes a wrong span look checked (COMM-165).
export const UNIT_UNESTABLISHED = 'ед.';
