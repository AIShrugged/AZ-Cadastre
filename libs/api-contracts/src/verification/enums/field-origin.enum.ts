import { z } from 'zod';

/**
 * Where an extracted field's value came from (ADR-0023).
 *
 * Published as an origin and never as a flag, because the three are not degrees
 * of one thing: a reading is evidence about the paper it hangs on, a value
 * carried over is evidence about the package, and a confirmation is evidence
 * from outside it. A client showing "implicit: true" would be showing the same
 * badge for two facts an inspector acts on differently.
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
]);
export type FieldOrigin = z.infer<typeof FieldOriginSchema>;
