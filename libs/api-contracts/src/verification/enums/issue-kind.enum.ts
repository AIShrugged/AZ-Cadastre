import { z } from 'zod';

export const IssueKindSchema = z.enum([
  'MissingDocument',
  'UnreadableDocument',
  'LowConfidence',
  // Documents of one submission were asked to agree on a value the profile says
  // must be one value, and were not shown to agree.
  'FieldMismatch',
  // Stated for the record rather than against the package: something the run
  // noticed in the envelope that only the inspector can weigh.
  'ExtraDocument',
  'DuplicateDocument',
]);
export type IssueKind = z.infer<typeof IssueKindSchema>;
