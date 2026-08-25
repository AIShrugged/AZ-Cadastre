import { z } from 'zod';

// What the archive register said when it was asked about the property a package
// is for (ADR-0009). An answer about the register's own holdings, never about
// the package: its coverage is partial and historical, so "no record" is an
// absence of evidence rather than a fault in the submission.
//
// It is not the register's own `LookupOutcome`, which says what it holds and
// stops there. This is what the stage that asked made of the answer, so it
// carries the two the register cannot know: everything held against the record
// agreed, or something did not.
export const RegistryOutcomeSchema = z.enum([
  'Confirmed',
  'Differs',
  'NotFound',
  'Ambiguous',
]);
export type RegistryOutcome = z.infer<typeof RegistryOutcomeSchema>;
