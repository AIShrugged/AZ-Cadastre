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
  // The archive does not hold the original of a paper the submission rests on.
  // Not the same shortfall as MissingDocument, which is about the envelope: the
  // paper is here, and the file it should have come out of does not have it.
  'RegistryDocumentMissing',
  // Stated for the record rather than against the package: something the run
  // noticed in the envelope that only the inspector can weigh.
  'ExtraDocument',
  'DuplicateDocument',
  // The register held no record of the property, or held more than one. Its
  // coverage is partial and historical, so this is told to the inspector and
  // never counted against the package.
  'RegistryUnconfirmed',
  // A paper that is only itself once an office has sealed or signed it came
  // without the mark, or with one nothing could be read off. Not the same
  // shortfall as UnreadableDocument, which is about the reading: the sheet was
  // read, and what it holds is a document short of what makes it valid.
  'MissingAttestation',
]);
export type IssueKind = z.infer<typeof IssueKindSchema>;
