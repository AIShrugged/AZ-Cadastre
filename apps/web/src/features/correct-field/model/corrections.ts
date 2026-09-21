/**
 * What an operator has typed over the engine's reading of one document, before
 * any of it is saved.
 *
 * A flat map of field name to the text in that row's box, and deliberately not
 * a list of corrections: a box the operator has opened and typed the reading
 * back into is not a correction, and a map keyed by the row is what lets the
 * screen tell "touched, and the same" from "changed" without a second
 * structure to keep in step. What goes on the wire is worked out from the map
 * and the document together (`correctionsOf`) at the moment of saving, which is
 * the only moment the two have to agree.
 *
 * Text is held raw and trimmed only where it is compared or sent, because
 * trimming as the operator types takes the space out from under the cursor.
 *
 * An entry whose key names no field of the document is a value the engine never
 * read — the profile declares the key, nothing filled it in, and the operator
 * is stating what the paper says. Its original is the empty string, so the same
 * comparison answers for it as for a reading being corrected.
 */
import { isSuperseded, takesFiles } from '@/entities/verification-package';
import {
  EDIT_FIELD_VALUE_MAX_LENGTH,
  EDIT_FIELDS_MAX_ENTRIES,
  type DocumentDto,
  type EditDocumentFieldsRequest,
  type FieldDto,
  type PackageDetailDto,
} from '@cadastre/api-contracts/verification';

export { EDIT_FIELD_VALUE_MAX_LENGTH };

/** The boxes the operator has touched on one document, by field name. */
export type Draft = Readonly<Record<string, string>>;

/**
 * Why this document takes no correction — the client's own reading of the
 * three rules the service refuses on, so the control is never offered and then
 * refused. The 409s remain the backstop and this is not a copy of the policy:
 * each of these is a fact the detail response already states.
 */
export type NoCorrection =
  /** A run is under way, and the pipeline reads the files it started with. */
  | 'running'
  /** The paper has been replaced; the case no longer rests on it. */
  | 'superseded'
  /** No type, so no field schema to correct against. */
  | 'unclassified';

export function whyNotCorrectable(
  pkg: PackageDetailDto,
  doc: DocumentDto,
): NoCorrection | null {
  // The same answer the "add a file" control is drawn from, and for the same
  // reason: a package mid-run takes no writes at all.
  if (!takesFiles(pkg.status)) return 'running';
  if (isSuperseded(doc)) return 'superseded';
  const placed =
    doc.type !== null &&
    doc.type !== 'unknown' &&
    doc.type !== 'out_of_profile';
  if (!placed) return 'unclassified';
  return null;
}

/** What the box for this row holds: what the operator typed, or the value on
 *  the page until they type something. */
export function boxText(draft: Draft, field: FieldDto): string {
  return draft[field.name] ?? field.value;
}

/** The value the document holds for a key, which is the empty string for a key
 *  it holds nothing for. */
export function valueOn(fields: readonly FieldDto[], name: string): string {
  return fields.find(field => field.name === name)?.value ?? '';
}

/** Whether this row's box says something other than what the document holds.
 *  An emptied box says the paper does not state it, which is a change. */
export function isChanged(
  fields: readonly FieldDto[],
  draft: Draft,
  name: string,
): boolean {
  const typed = draft[name];
  if (typed === undefined) return false;
  return typed.trim() !== valueOn(fields, name).trim();
}

/** Whether the operator has emptied the box — the paper does not state this,
 *  and the key is to be struck from the document. */
export function isStruck(draft: Draft, name: string): boolean {
  const typed = draft[name];
  return typed !== undefined && typed.trim() === '';
}

/** Longer than the contract takes. Worked out here so the row can say so before
 *  the save is attempted, and the save can decline to attempt it. */
export function isOverlong(text: string): boolean {
  return text.trim().length > EDIT_FIELD_VALUE_MAX_LENGTH;
}

export function withText(draft: Draft, name: string, text: string): Draft {
  return { ...draft, [name]: text };
}

/** The row put back as the document holds it. */
export function withoutText(draft: Draft, name: string): Draft {
  const { [name]: _dropped, ...rest } = draft;
  return rest;
}

/**
 * The rows a card draws that the document itself does not hold — keys the
 * operator has opened a box for because nothing was read for them.
 *
 * In the order they were opened, under the document's own rows, so a key added
 * by hand never displaces the profile's order in the part of the card that is
 * the profile's.
 */
export function addedNames(
  fields: readonly FieldDto[],
  draft: Draft,
): readonly string[] {
  return Object.keys(draft).filter(
    name => !fields.some(field => field.name === name),
  );
}

/**
 * The keys of this document's type that nothing has been read for and no box is
 * open on — what the "state a value the reader missed" control may offer.
 *
 * Off the profile's published field list for the document's own type, in the
 * profile's order, and never a list kept here: a key this client invented would
 * be refused with `FIELD_NOT_IN_SCHEMA`, which is a refusal the operator can do
 * nothing about.
 */
export function unreadNames(
  schema: readonly string[],
  fields: readonly FieldDto[],
  draft: Draft,
): readonly string[] {
  return schema.filter(
    name => !fields.some(field => field.name === name) && !(name in draft),
  );
}

/** How many more corrections one save can still carry. */
export function roomLeft(count: number): number {
  return EDIT_FIELDS_MAX_ENTRIES - count;
}

/**
 * What goes on the wire: every row whose box says something other than what the
 * document holds, and nothing else.
 *
 * An emptied box becomes `null`, which is the operator stating that the paper
 * does not carry the key at all — a different statement from an empty value,
 * and the one the contract takes.
 */
export function correctionsOf(
  fields: readonly FieldDto[],
  draft: Draft,
): EditDocumentFieldsRequest['fields'] {
  return Object.keys(draft)
    .filter(name => isChanged(fields, draft, name))
    .map(name => {
      const value = (draft[name] ?? '').trim();
      return { name, value: value === '' ? null : value };
    });
}

/** Whether anything in the draft is too long for the contract to take. */
export function anyOverlong(draft: Draft): boolean {
  return Object.values(draft).some(isOverlong);
}
