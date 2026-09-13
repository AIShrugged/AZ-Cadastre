import { z } from 'zod';

// Where the policy expects a paper of a kind to come from: the envelope, or a
// state system that confirms it (ADR-0025). None of the systems is connected to
// this one; a report says so rather than letting a paper that was only read
// look confirmed.
export const DocumentSourceSchema = z.enum([
  'Package',
  'Mqs',
  'LicencesPortal',
  'UrbanPlanningCommittee',
  'NationalArchive',
]);
export type DocumentSource = z.infer<typeof DocumentSourceSchema>;
