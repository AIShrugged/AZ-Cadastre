/**
 * What is with a case, as one thing to draw — the register's answer to the two
 * questions it used to answer in three columns.
 *
 * Where a submission stands is what has to happen to it next; what the run
 * found is what the report holds against the papers; the findings are the
 * tallies that report is built from. Three columns for that made the register
 * say the same thing twice, because most of the time the standing is what the
 * outcome came to: `ShortOfDocuments` is what `IncompletePackage` means for the
 * queue, and `NeedsInspector` is what `IssuesFound` means for it.
 *
 * Merged in the **column** and never in the filters (ADR-0014). Two controls
 * still narrow the register, so the cell must be able to say both words: a row
 * narrowed to a word it never shows is a row the inspector cannot check. What
 * the merge removes is the empty repetition — the standing leads, the findings
 * are said under it, and the outcome's own word is drawn when it adds something
 * (`drawsOutcome`).
 *
 * Two things are decided here rather than in the cell, because both are
 * judgements about what the words mean and neither is a matter of layout:
 * which piece of news the cell is telling, and whether the outcome still has
 * one of its own to tell.
 */
import type {
  PackageStanding,
  ReportStatus,
} from '@cadastre/api-contracts/verification';

import type { VerificationPackage } from './verification-package';

export type CaseState =
  /** A run has reported. The outcome, and the findings it counted. */
  | {
      readonly kind: 'reported';
      readonly outcome: ReportStatus;
      readonly issues: number;
      readonly lowConfidence: number;
    }
  /**
   * A run is under way and has not reported yet. Nothing is said about
   * findings, because nothing has been found *yet* — the stage bar beside this
   * is what reports the wait, and a `—` under it would be a second way of
   * saying the same thing.
   */
  | { readonly kind: 'reading' }
  /**
   * Nothing has read this package and nothing is reading it. Drawn as silence
   * rather than as "no issues": a package nothing has read is not a package
   * nothing was found in.
   */
  | { readonly kind: 'unread' };

export function caseState(p: VerificationPackage): CaseState {
  if (p.reportStatus !== null) {
    return {
      kind: 'reported',
      outcome: p.reportStatus,
      issues: p.issues,
      lowConfidence: p.lowConfidence,
    };
  }
  return p.stage === undefined ? { kind: 'unread' } : { kind: 'reading' };
}

/**
 * Whether the report line has a count to say beyond its own word.
 *
 * A run that found nothing is fully said by its outcome — appending "None" to
 * "No issues" is the stutter the merge exists to remove — while any figure at
 * all is what the inspector counts their day by and is never dropped.
 */
export function hasFindings(state: CaseState): boolean {
  return (
    state.kind === 'reported' && (state.issues > 0 || state.lowConfidence > 0)
  );
}

/**
 * Which outcome a standing already says in the queue's own words.
 *
 * These are the three pairs the customer was looking at when they said the two
 * columns duplicate each other, and they do: `ShortOfDocuments` is what
 * `IncompletePackage` means for the work, `NeedsInspector` is what
 * `IssuesFound` means for it, and a submission is `Cleared` because the run
 * found nothing. Saying both is saying one thing twice.
 *
 * Every other pairing says two things and both are drawn. The register is
 * explicit that a finished submission can still carry findings — `Cleared` with
 * `IssuesFound` is a real row and the outcome is the whole of its news — and a
 * submission held on a signature or stopped mid-run has a standing that reports
 * the queue and an outcome that reports the papers.
 *
 * A partial record on purpose: a standing the contract adds tomorrow says
 * nothing about any outcome until somebody decides it does, which is the safe
 * default — the word is drawn rather than swallowed.
 */
const ALREADY_SAID: Partial<Record<PackageStanding, ReportStatus>> = {
  Cleared: 'OK',
  ShortOfDocuments: 'IncompletePackage',
  NeedsInspector: 'IssuesFound',
};

/**
 * Whether the cell draws the outcome's own word beside the standing.
 *
 * Two questions, and either one is enough. Does the outcome say something the
 * standing does not? Then it is news and it is drawn. Is the register narrowed
 * by the outcome filter — by the select or by one of the tabs that stands for
 * it? Then it is drawn whether or not it repeats, because that is the word the
 * inspector chose and a row they cannot check against it is a row the filter
 * made unreadable.
 *
 * Which is why the filter is asked about at all: the repetition is only
 * harmless to remove while nobody is looking for it.
 */
export function drawsOutcome(
  standing: PackageStanding,
  outcome: ReportStatus,
  narrowedByOutcome: boolean,
): boolean {
  return narrowedByOutcome || ALREADY_SAID[standing] !== outcome;
}
