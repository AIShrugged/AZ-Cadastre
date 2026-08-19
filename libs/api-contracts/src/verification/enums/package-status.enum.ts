import { z } from 'zod';

export const PackageStatusSchema = z.enum([
  'Pending',
  'Processing',
  'Completed',
  'Failed',
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;
