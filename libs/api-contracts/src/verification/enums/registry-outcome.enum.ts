import { z } from 'zod';

// What the archive register said when it was asked about the property a package
// is for (ADR-0009). An answer about the register's own holdings, never about
// the package: its coverage is partial and historical, so "no record" is an
// absence of evidence rather than a fault in the submission.
//
// It is not the register's own `LookupOutcome`, which says what it holds and
// stops there. This is what the stage that asked made of the answer, so it
// carries the three the register cannot know: everything held against the
// record agreed, something did not, or the archive does not hold one of the
// papers the submission rests on.
export const RegistryOutcomeSchema = z.enum([
  'Confirmed',
  'Differs',
  // A record was found, everything held against it agreed, and the archive
  // does not hold one of the papers that were asked about. A separate answer
  // from `Differs` because it is a different question: the record does not
  // contradict the package, the file behind it is short (ADR-0010).
  'Incomplete',
  'NotFound',
  'Ambiguous',
]);
export type RegistryOutcome = z.infer<typeof RegistryOutcomeSchema>;
