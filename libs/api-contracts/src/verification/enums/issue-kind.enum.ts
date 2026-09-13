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
  // No longer compiled since ADR-0025, which replaced the invented bands with
  // the provisions of Article 8; a report written before it may still carry
  // one, so the value stays.
  //
  // What the applicant must bring beyond the envelope, for the case this
  // package turned out to be. Not a finding: the engine never sees these
  // papers, and saying which ones are needed is the whole of what it does with
  // them, so a report carrying nothing else still reads OK.
  //
  // Told whether or not the case could be placed. A message that placed it
  // carries the value it was decided on — the document, the field, the sheet
  // and the confidence of that reading; one that could not carries none of
  // them. That is what tells "this case needs these papers" apart from "which
  // papers this case needs could not be worked out", and the two must never
  // read alike (ADR-0013).
  'SupportingDocumentsRequired',
  // What the office declared when it took the submission in is not what the
  // papers turned out to say. Neither side is presumed right — a figure can be
  // mistyped at the counter as easily as it can be misread off a scan — so it
  // is stated for the record and never counted against the package. The
  // finding is filed against the reading it disagrees with, so the inspector
  // opens the sheet and settles it.
  'DeclaredValueMismatch',
  // A file sent in for one of the gaps the package publishes turned out to be a
  // different paper — the payment receipt attached where an unreadable sketch
  // design was asked for. Not ExtraDocument, which is a paper that simply
  // arrived: this one was sent in answer to something, the answer does not fit,
  // and the gap it was sent for is still open. `documentType` carries what was
  // asked for rather than what turned up, because the finding is about that gap
  // (COMM-80).
  'WrongDocumentSupplied',
  // No document of the package is a title to the land — none of the papers
  // Article 10.2.1 accepts as confirming the right over the plot. Leaves the
  // package incomplete, like MissingDocument, and names no single type because
  // any of the titles would answer it: which ones is on the report's
  // provision (ADR-0025).
  'MissingTitleDocument',
  // A title document the package does carry that does not found the case: it
  // is dated outside the window its item of the Decree gives it, or it is a
  // title of the other class from the one the case's provision rests on — a
  // lease document under 8.0.9.1.2, which is registered on ownership. Filed
  // against the title and, for a date, against the date it was read off.
  'TitleDocumentInvalid',
  // Which provision of Article 8 the case falls under could not be decided:
  // a figure the table turns on was not stated, and several provisions stay
  // open; or no provision covers the case at all. Held against the package,
  // because which papers it must carry turns on the answer and only the
  // inspector can give it.
  'ProvisionUndetermined',
  // The policy confirms a paper of this kind through a state system — MQS, the
  // Licences Portal, the Urban Planning Committee, the National Archive — and
  // that system is not connected to this one, so the paper was read and not
  // confirmed. Stated for the record and never against the package: the
  // applicant is not answerable for an integration nobody built. Which system
  // is the profile's `source` of `documentType`.
  'IntegrationNotConnected',
]);
export type IssueKind = z.infer<typeof IssueKindSchema>;
