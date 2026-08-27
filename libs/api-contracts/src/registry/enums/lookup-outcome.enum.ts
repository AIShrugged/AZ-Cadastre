import { z } from 'zod';

/**
 * What the register found when it was asked about a property. It is a statement
 * about the register's own holdings and never about the submission: whether a
 * record that is absent, or one that two records answer to, means anything is
 * for the caller to decide.
 */
export const LookupOutcomeSchema = z.enum([
  'Found',
  // The register holds nothing under that address. Coverage is partial and
  // historical, so this is an absence of evidence and not evidence of a fault.
  'NotFound',
  // More than one record answers to it. An answer in its own right, not a
  // failure: somebody has to say which of them is the one.
  'Ambiguous',
]);
export type LookupOutcome = z.infer<typeof LookupOutcomeSchema>;
