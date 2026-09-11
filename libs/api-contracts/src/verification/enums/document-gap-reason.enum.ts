import { z } from 'zod';

/**
 * Why a package will take a document it already has files for (COMM-80).
 *
 * Three reasons and not one flag, because an operator answers them differently:
 * one is a paper nobody sent, one is a paper that arrived and could not be read
 * well enough, and one is a paper the profile takes whenever it turns up. A
 * screen that could only say "you may upload something here" would be a screen
 * that cannot say what to upload.
 */
export const DocumentGapReasonSchema = z.enum([
  // A type the profile requires that no document in force answers. `documentId`
  // is null: there is nothing in the package to replace.
  'MissingDocument',
  // A document that is here and was read badly — the profile asks for a field
  // its sheets did not yield, or something read off it came back under the
  // engine's confidence floor, the placement itself included. The one reason
  // that names a document, because filling it replaces that document.
  'UnusableScan',
  // A paper the profile takes at any time, whether or not the package is short
  // of one: the receipt for the state duty is the case it exists for. Never a
  // shortfall — it is published on a package with nothing wrong with it — and
  // never published twice, so a required type that is genuinely absent arrives
  // as `MissingDocument` and not also as this.
  'AlwaysAccepted',
]);
export type DocumentGapReason = z.infer<typeof DocumentGapReasonSchema>;
