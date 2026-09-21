import { z } from 'zod';

/**
 * Where an extracted field's value came from (ADR-0023, ADR-0033).
 *
 * Published as an origin and never as a flag, because they are not degrees of
 * one thing: a reading is evidence about the paper it hangs on, a value carried
 * over is evidence about the package, a confirmation is evidence from outside
 * it, and a value an operator typed is a person's reading of the paper. A
 * client showing "implicit: true" would be showing the same badge for facts an
 * inspector acts on differently.
 */
export const FieldOriginSchema = z.enum([
  // Read off this document, on the sheet `pageNumber` names.
  'ReadOnThisDocument',
  // The same value another paper of this package states, carried over because
  // the profile's cross-checks say the two papers print one value and this one
  // did not yield it. `pageNumber` is null — this document has no sheet that
  // states it — and `takenFrom` names the document, the field and the sheet
  // that do.
  'TakenFromAnotherDocument',
  // Read off this document, and matched by the archive register's record of the
  // property. Still a reading of this paper: the register agreed with it, it did
  // not supply it, so `pageNumber` is a sheet of this document as usual.
  'ConfirmedByRegistry',
  // Typed by an operator off the paper, because the reader got the field wrong
  // or never got it at all. A reading of this document like the first and the
  // third: `pageNumber` is the sheet of the field it replaced where there was
  // one, and null where the operator stated a value nothing was read for.
  // `confidence` is always 1 — a person read the sheet, and that is not a
  // reading with a probability on it — and `editedByAccountId` / `editedAt` say
  // who and when. The archive register never overwrites this origin: its
  // agreement lives on the registry check, and where the value came from is
  // still a person.
  'EnteredByOperator',
]);
export type FieldOrigin = z.infer<typeof FieldOriginSchema>;
