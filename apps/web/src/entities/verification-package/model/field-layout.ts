/**
 * What a document's card has to do to stay readable once the contract is read
 * off whole.
 *
 * The acceptance contract asks sixteen values of a plan-scheme and nineteen of
 * a sketch design (COMM-78), where the card was built for five and seven. Two
 * things break at that size, and neither is the number of rows on its own.
 *
 * The first is the row: five of the new values are enumerations — the turning
 * points of the boundary, the schedule of drawings, what the set is composed
 * of — written into one field as entries separated by semicolons. Set as one
 * run of text they wrap into a paragraph in a column sized for a cadastral
 * number, and an inspector counting turning points against the sheet has to
 * count them inside a paragraph. Split at the separator each entry is a line
 * they can run a finger down.
 *
 * The second is the card: nineteen label/value pairs under one heading is a
 * wall, and a package holds several such documents. The tail folds — and only a
 * tail worth folding, so the documents the profile asks less of are untouched.
 * Nothing is dropped and nothing is hidden for being empty: a value the paper
 * does not carry is an answer the inspector needs, and it keeps its row and
 * shows a dash.
 */
import type { FieldDto } from '@cadastre/api-contracts/verification';

/** The row a finding — or a carried-over value — is addressed to. */
export function fieldRowId(documentId: string, fieldName: string): string {
  return `field-${documentId}-${fieldName}`;
}

/** The same row as a fragment. Built here so the row that answers to it and
 *  every link that addresses it cannot drift apart. */
export function fieldAnchor(documentId: string, fieldName: string): string {
  return `#${fieldRowId(documentId, fieldName)}`;
}

/** What the extractor is told to separate the entries of an enumeration with
 *  when the contract asks for a list in one field. */
const ENTRY_SEPARATOR = ';';

/** How many entries a row states before it offers the rest. Three is what a
 *  reader takes in without the row becoming the card. */
export const ENTRIES_SHOWN = 3;

/** Below this the separator is punctuation rather than structure. The contract
 *  asks for a boundary, a schedule of drawings, the composition of a set and
 *  the spans of a frame — none of which is two of anything — while a field
 *  worded as a sentence may well carry one semicolon. Setting that sentence out
 *  as two bullets would be the client inventing a list nobody wrote. */
const SHORTEST_LIST = 3;

/**
 * The entries of a value that is a list rather than a figure.
 *
 * Empty for everything else, which is the signal to set the value as it
 * arrived: a single entry is a scalar, and a scalar split on nothing would be
 * a list of one.
 */
export function entriesOf(value: string): readonly string[] {
  const entries = value
    .split(ENTRY_SEPARATOR)
    .map(entry => entry.trim())
    .filter(entry => entry !== '');

  return entries.length >= SHORTEST_LIST ? entries : [];
}

/** How many rows a card states before folding the rest away. */
export const FIELDS_BEFORE_FOLD = 10;

/** Below this a fold costs the reader more than it saves: a control and a count
 *  to spare them two rows is furniture. */
const SHORTEST_FOLD = 3;

/**
 * A card's rows, split into the ones it states and the ones it folds.
 *
 * Positional, and deliberately so — the profile lists the fields in the order
 * the contract numbers its items, and that order is what an inspector holds the
 * card against the paper by. Reordering to bring the doubtful ones up would
 * make the card easier to skim and impossible to check.
 */
export function foldFields(fields: readonly FieldDto[]): {
  shown: readonly FieldDto[];
  folded: readonly FieldDto[];
} {
  if (fields.length <= FIELDS_BEFORE_FOLD + SHORTEST_FOLD) {
    return { shown: fields, folded: [] };
  }

  return {
    shown: fields.slice(0, FIELDS_BEFORE_FOLD),
    folded: fields.slice(FIELDS_BEFORE_FOLD),
  };
}

/**
 * Whether a fragment already on the address bar names one of the rows a card
 * would fold away.
 *
 * `:target` opens a folded row the moment a jump inside the register lands on
 * it, which is the ordinary case and the one that has to happen before the
 * browser scrolls. It cannot answer for the other one: a link pasted cold, or
 * followed from outside, resolves its target while the register is still being
 * fetched, and an element that appears afterwards is not the document's target.
 * So the card reads the fragment for itself and opens shut, rather than
 * answering a link with a row nobody can see.
 */
export function holdsHash(
  folded: readonly FieldDto[],
  documentId: string,
  hash: string,
): boolean {
  return folded.some(field => fieldAnchor(documentId, field.name) === hash);
}
