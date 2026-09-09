/**
 * What the archive register answered, as a reader has to be able to take it in.
 *
 * Three vocabularies, none of them invented here: what the lookup found
 * (`LookupOutcome`), how one supplied attribute stood against the record
 * (`AttributeMatch`), and whether the archive holds a paper (`DocumentHolding`).
 * All this module decides is the only thing a client may decide about them —
 * the tone each is set in and the line of the dictionary that names it.
 *
 * **The register never passes judgement on anybody's application** (ADR-0009).
 * It states what its own fonds hold; its coverage is partial and historical, so
 * `NotFound` is an absence of evidence and `NotRecorded` is a column that area's
 * register never kept. Neither is drawn in a fault's colour, because neither is
 * a fault — and a screen that reddened for them would be telling the operator
 * something the register never said.
 */
import type { OutcomeTone } from '@/shared/ui/outcome-mark';
import type {
  AttributeMatch,
  DocumentHolding,
  LookupOutcome,
} from '@cadastre/api-contracts/registry';

/**
 * What the lookup found, as a tone.
 *
 * `Found` is `ok` because the question was answered, not because the property
 * is in order — whether a prior registration is good news is the operator's to
 * weigh and never this screen's to imply.
 */
export const LOOKUP_TONE: Record<LookupOutcome, OutcomeTone> = {
  Found: 'ok',
  NotFound: 'silent',
  Ambiguous: 'question',
};

export const LOOKUP_KEY: Record<LookupOutcome, string> = {
  Found: 'archive.found',
  NotFound: 'archive.not_found',
  Ambiguous: 'archive.ambiguous',
};

/** What the answer means for the operator, said in a sentence — the word alone
 *  leaves them to infer the move. */
export const LOOKUP_NOTE: Record<LookupOutcome, string> = {
  Found: 'archive.found_note',
  NotFound: 'archive.not_found_note',
  Ambiguous: 'archive.ambiguous_note',
};

/** How one attribute the operator supplied stood against the record. */
export const MATCH_TONE: Record<AttributeMatch, OutcomeTone> = {
  Matches: 'ok',
  Differs: 'issues',
  // The record is silent about it. Half the registers carry a column the other
  // half never had, so this is the ordinary case and not a shortfall.
  NotRecorded: 'silent',
};

export const MATCH_KEY: Record<AttributeMatch, string> = {
  Matches: 'archive.match.matches',
  Differs: 'archive.match.differs',
  NotRecorded: 'archive.match.not_recorded',
};

/** Whether the archive holds the original of a paper. */
export const HOLDING_TONE: Record<DocumentHolding, OutcomeTone> = {
  Held: 'ok',
  NotHeld: 'incomplete',
  Unknown: 'silent',
};

export const HOLDING_KEY: Record<DocumentHolding, string> = {
  Held: 'archive.holding.held',
  NotHeld: 'archive.holding.not_held',
  Unknown: 'archive.holding.unknown',
};

/**
 * The record's own fields, in the order a person reads a property record: who
 * and where first, then what it is, then how the archive files it.
 *
 * A list and not a loop over `Object.keys`, because the order is the answer and
 * a key order is not a promise the contract makes. Every field but the register
 * number is nullable — the registers disagree on which columns they carry — so
 * a screen drawing this skips what is silent rather than printing an em dash
 * for a column that was never kept.
 */
export const RECORD_FIELDS = [
  'registerNo',
  'inventoryNo',
  'address',
  'ownerName',
  'cadastralNumber',
  'plotArea',
] as const;

export type RecordField = (typeof RECORD_FIELDS)[number];

export const RECORD_FIELD_KEY: Record<RecordField, string> = {
  registerNo: 'archive.field.register_no',
  inventoryNo: 'archive.field.inventory_no',
  address: 'archive.field.address',
  ownerName: 'archive.field.owner_name',
  cadastralNumber: 'archive.field.cadastral_number',
  plotArea: 'archive.field.plot_area',
};

/**
 * The register's own name for an attribute, in the reader's language.
 *
 * The names travel on the wire as the register spells them — `ownerName`,
 * `cadastralNumber` — and a client that has not been taught one shows the bare
 * name rather than nothing: a register that starts answering about a column
 * this build never heard of must still be legible.
 */
export const ATTRIBUTE_KEY: Record<string, string> = {
  ownerName: 'archive.field.owner_name',
  cadastralNumber: 'archive.field.cadastral_number',
  plotArea: 'archive.field.plot_area',
};
