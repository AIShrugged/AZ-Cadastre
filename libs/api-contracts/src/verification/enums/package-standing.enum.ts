import { z } from 'zod';

/**
 * Where a submission stands: what has to happen to it next.
 *
 * The third of this context's three states a reader may call a status, and the
 * only one written for the inspector rather than for the machine.
 * `PackageStatus` is where the pipeline got to, `ReportStatus` is what the run
 * found, and neither answers what an inspector opens the list to ask — a full
 * set of papers and a package with seven findings are both `Completed`.
 *
 * Derived by the context from the other two and from what the archive register
 * was asked, never set by hand and never stored (ADR-0014). A client shows it;
 * it does not work it out, and two clients working it out differently is the
 * reason it is in the contract at all.
 */
export const PackageStandingSchema = z.enum([
  // Accepted, no run has read it yet. Also where a package lands when a file is
  // added to one that had already been reported on (ADR-0013).
  'Queued',
  'UnderVerification',
  // Our own machinery broke down; nothing was concluded about the papers.
  'Stalled',
  // A paper the profile requires never arrived. The next move is to get it, and
  // it can be added to this package.
  'ShortOfDocuments',
  // The envelope is complete and the run holds findings against it, every one
  // of them for a person to resolve.
  'NeedsInspector',
  // Nothing is held against it, and the archive search it rests on has not been
  // approved by anybody yet.
  'AwaitingArchiveApproval',
  // Nothing is held against it and nothing is outstanding. Not a decision about
  // the registration — that is the inspector's, and this system never makes it.
  'Cleared',
]);
export type PackageStanding = z.infer<typeof PackageStandingSchema>;
