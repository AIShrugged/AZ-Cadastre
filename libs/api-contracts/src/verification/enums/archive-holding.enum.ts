import { z } from 'zod';

// Whether the archive holds the original of one of the papers a package rests
// on, as the report carries it (ADR-0010).
//
// It has the same three members as the register's own `DocumentHolding` and is
// deliberately not that type: this is the verification language, and a context
// that reached into the register's to name something in its own report would be
// speaking a word it does not own. The register may add a fourth state without
// the report having to render it.
export const ArchiveHoldingSchema = z.enum([
  'Held',
  'NotHeld',
  // The area's presence register never carried a column for this kind of paper.
  // The ordinary case, and not a shortfall: silence is not absence.
  'Unknown',
]);
export type ArchiveHolding = z.infer<typeof ArchiveHoldingSchema>;
