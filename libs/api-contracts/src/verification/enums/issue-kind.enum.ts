import { z } from 'zod';

export const IssueKindSchema = z.enum([
  'MissingDocument',
  'UnreadableDocument',
  'LowConfidence',
  // Documents of one submission were asked to agree on a value the profile says
  // must be one value, and were not shown to agree.
  'FieldMismatch',
  // A value the package states was found in the archive register under a
  // different value. Unlike FieldMismatch this is not the papers disagreeing
  // with each other but with the record of what was registered.
  'RegistryMismatch',
  // Stated for the record rather than against the package: something the run
  // noticed in the envelope that only the inspector can weigh.
  'ExtraDocument',
  'DuplicateDocument',
  // The register held no record of the property, or held more than one. Its
  // coverage is partial and historical, so this is told to the inspector and
  // never counted against the package.
  'RegistryUnconfirmed',
]);
export type IssueKind = z.infer<typeof IssueKindSchema>;
