import { z } from 'zod';

export const CrossCheckVerdictSchema = z.enum([
  'Match',
  'Mismatch',
  // Compared, and could not be decided either way. Not an agreement, so it
  // reaches the inspector as a finding.
  'Unclear',
]);
export type CrossCheckVerdict = z.infer<typeof CrossCheckVerdictSchema>;
