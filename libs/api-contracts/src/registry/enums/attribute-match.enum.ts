import { z } from 'zod';

/** How one attribute the caller supplied stood against the record. */
export const AttributeMatchSchema = z.enum([
  'Matches',
  'Differs',
  // The record is silent about it. Half the registers carry a column the other
  // half never had, so this is the ordinary case and not a shortfall.
  'NotRecorded',
]);
export type AttributeMatch = z.infer<typeof AttributeMatchSchema>;
