/**
 * Package Standing — where a submission stands, and what has to happen to it
 * next. The third of the context's three states a reader will call a status,
 * and the only one written for the inspector (CONTEXT-MAP, ADR-0014).
 *
 * It is read off `PackageDto.standing` and never worked out here. The two
 * states behind it — `PackageStatus`, where the pipeline got to, and
 * `ReportStatus`, what the run found — are the machine's, and this client shows
 * neither of them to a person. The client's own `Disposition` is the word this
 * supersedes: a view-model term invented before there was anything to read.
 *
 * What lives here is only what a client is allowed to decide: which tone the
 * word is set in, which line of the dictionary names it, and — from the
 * contract's own answer, not from a list of our own — whether the package will
 * take another file.
 */
import {
  PackageStatusTakingFilesSchema,
  type PackageStanding,
  type PackageStatus,
} from '@cadastre/api-contracts/verification';

export type { PackageStanding };

/**
 * The register's tones, plus one this state needs and no other does:
 * `awaiting`, for a submission held up by a signature rather than by anything
 * wrong with it. Marking it `issues` would say the papers are at fault; marking
 * it `progress` would say the machine is still working. Neither is true.
 */
export type StandingTone =
  'ok' | 'issues' | 'incomplete' | 'progress' | 'awaiting' | 'failed';

export const STANDING_TONE: Record<PackageStanding, StandingTone> = {
  Queued: 'progress',
  UnderVerification: 'progress',
  Stalled: 'failed',
  ShortOfDocuments: 'incomplete',
  NeedsInspector: 'issues',
  AwaitingArchiveApproval: 'awaiting',
  Cleared: 'ok',
};

/** The word itself, in the reader's language. */
export const STANDING_KEY: Record<PackageStanding, string> = {
  Queued: 'standing.Queued',
  UnderVerification: 'standing.UnderVerification',
  Stalled: 'standing.Stalled',
  ShortOfDocuments: 'standing.ShortOfDocuments',
  NeedsInspector: 'standing.NeedsInspector',
  AwaitingArchiveApproval: 'standing.AwaitingArchiveApproval',
  Cleared: 'standing.Cleared',
};

/** What has to happen next, said in a sentence — the standing is a name, and a
 *  name alone leaves the inspector to infer the move. */
export const STANDING_NOTE: Record<PackageStanding, string> = {
  Queued: 'standing.note.Queued',
  UnderVerification: 'standing.note.UnderVerification',
  Stalled: 'standing.note.Stalled',
  ShortOfDocuments: 'standing.note.ShortOfDocuments',
  NeedsInspector: 'standing.note.NeedsInspector',
  AwaitingArchiveApproval: 'standing.note.AwaitingArchiveApproval',
  Cleared: 'standing.note.Cleared',
};

/** Whether the run is still working, which is the one standing that keeps a
 *  marker beating rather than still. */
export function isRunning(standing: PackageStanding): boolean {
  return standing === 'UnderVerification';
}

/**
 * Whether this package will take another file.
 *
 * Answered by the contract — `PackageStatusTakingFilesSchema` is the published
 * answer to "may I add a file to this one?", and the button is enabled off it
 * rather than off a list of states this client keeps. A run under way is the
 * only refusal: the pipeline reads the files it started with, so one added mid
 * run would reach no stage.
 */
export function takesFiles(status: PackageStatus): boolean {
  return PackageStatusTakingFilesSchema.safeParse(status).success;
}
