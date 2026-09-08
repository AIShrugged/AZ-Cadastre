import { z } from 'zod';

export const PackageStatusSchema = z.enum([
  'Pending',
  'Processing',
  'Completed',
  'Failed',
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

/**
 * The states a package takes more files in, named here rather than left to a
 * caller to work out — this is the contract's answer to "may I add a file to
 * this one?" and the button is enabled off it.
 *
 * Only a run under way refuses: the pipeline reads the list of files it started
 * with, so a file added to it would reach no stage and the report the run is
 * about to compile would describe a package that is no longer the one on file.
 * A package that has already been reported on takes files — that is the case
 * the operation exists for, and it is re-opened by it (ADR-0013).
 */
export const PackageStatusTakingFilesSchema = PackageStatusSchema.exclude([
  'Processing',
]);
export type PackageStatusTakingFiles = z.infer<
  typeof PackageStatusTakingFilesSchema
>;
