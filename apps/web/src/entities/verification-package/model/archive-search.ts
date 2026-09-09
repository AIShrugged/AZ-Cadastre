/**
 * The archive search, as a reader has to be able to take it in.
 *
 * Two vocabularies live here and neither is invented: what the register
 * answered about a submission (`RegistryOutcome`), and whether the archive
 * holds the original of a paper (`ArchiveHolding`). What this module decides is
 * the only thing a client may decide about them — which tone each is set in and
 * which line of the dictionary names it — so that the same answer reads alike
 * wherever it is drawn, and so a member the contract adds later cannot quietly
 * render as nothing.
 *
 * The distinction the whole surface turns on: **the register contradicting the
 * package and the register having nothing to say are not the same news.** Its
 * coverage is partial and historical and it never passes judgement on a
 * submission (ADR-0009), so `NotFound` is an absence of evidence. Drawn in a
 * fault's colour it would tell the reader something untrue, and the tones below
 * are what keep the two apart at a glance rather than in a sentence they have
 * to read first.
 */
import type {
  ArchiveHolding,
  ArchiveSearchApprovalDto,
  PackageStatus,
  RegistryCheckDto,
  RegistryOutcome,
} from '@cadastre/api-contracts/verification';

/**
 * The tones an archive answer is set in.
 *
 * `ok`, `issues` and `incomplete` are the register's own three, shared with
 * every other panel on the surface. The two below them exist because this panel
 * reports something no other one does — a source outside the system that is
 * allowed not to know:
 *
 *  - `silent`  — the register holds nothing under this address. Neutral, and
 *                deliberately without a fault's colour.
 *  - `question`— the register holds more than one answer. Not a fault either,
 *                but not silence: somebody has to say which record applies.
 */
export type OutcomeTone =
  'ok' | 'issues' | 'incomplete' | 'silent' | 'question';

/**
 * One tone per verdict, all five different.
 *
 * `Differs` and `Incomplete` are the two the package is answerable for, and
 * they are told apart rather than merged: in the first the record states
 * something else, in the second the record agrees and the archive simply does
 * not have the original of a paper the submission rests on (ADR-0010).
 *
 * `NotFound` and `Ambiguous` are neither. They are what the register does not
 * know, and the reader is owed that difference in the colour, not only in the
 * word.
 */
export const OUTCOME_TONE: Record<RegistryOutcome, OutcomeTone> = {
  Confirmed: 'ok',
  Differs: 'issues',
  Incomplete: 'incomplete',
  NotFound: 'silent',
  Ambiguous: 'question',
};

/** The verdict itself, in the reader's language. */
export const OUTCOME_KEY: Record<RegistryOutcome, string> = {
  Confirmed: 'detail.reg.confirmed',
  Differs: 'detail.reg.differs',
  Incomplete: 'detail.reg.incomplete',
  NotFound: 'detail.reg.not_found',
  Ambiguous: 'detail.reg.ambiguous',
};

/** What the answer means for the submission, said in a sentence. The wire
 *  carries an English audit line naming the register that answered; nothing
 *  here reads it. */
export const OUTCOME_NOTE: Record<RegistryOutcome, string> = {
  Confirmed: 'detail.reg.confirmed_note',
  Differs: 'detail.reg.differs_note',
  Incomplete: 'detail.reg.incomplete_note',
  NotFound: 'detail.reg.not_found_note',
  Ambiguous: 'detail.reg.ambiguous_note',
};

/**
 * Whether the answer is something held against the submission.
 *
 * The counter over the panel is coloured by this and not by "everything that is
 * not Confirmed": a package the register has never heard of has nothing against
 * it, and a tally that reddened for it would be the same lie the tones exist to
 * avoid.
 */
export function speaksAgainst(outcome: RegistryOutcome): boolean {
  return outcome === 'Differs' || outcome === 'Incomplete';
}

/** The three states of an original, each with a mark of its own. `Unknown` is
 *  the ordinary case and not a shortfall — the presence registers are kept per
 *  settlement and their columns differ, so a kind an area never recorded is
 *  silence (ADR-0010). */
export const HOLDING_TONE: Record<ArchiveHolding, 'ok' | 'issues' | 'silent'> =
  {
    Held: 'ok',
    NotHeld: 'issues',
    Unknown: 'silent',
  };

export const HOLDING_KEY: Record<ArchiveHolding, string> = {
  Held: 'detail.reg.holding_held',
  NotHeld: 'detail.reg.holding_notheld',
  Unknown: 'detail.reg.holding_unknown',
};

// ─── The approval ────────────────────────────────────────────────────────────
// A person's sign-off on what the register answered, and the conclusion they
// drew from it. It carries no author: there are no accounts in this system, so
// a name here could only be one somebody typed (ADR-0016).

/** The approval that is in force, or null. At most one is: an approval is spent
 *  when the search is made again, and the spent ones keep their row. */
export function approvalInForce(
  approvals: readonly ArchiveSearchApprovalDto[],
): ArchiveSearchApprovalDto | null {
  return approvals.find(approval => approval.supersededAt === null) ?? null;
}

/** The approvals that have been outrun, newest first as the contract sends
 *  them. Kept and shown rather than dropped: a signature over answers the
 *  package has since replaced is exactly what a reader has to be able to see. */
export function spentApprovals(
  approvals: readonly ArchiveSearchApprovalDto[],
): readonly ArchiveSearchApprovalDto[] {
  return approvals.filter(approval => approval.supersededAt !== null);
}

/**
 * Where the archive search of this package stands with respect to signing.
 *
 * The four cases are the service's own: the three rules it refuses on
 * (`ARCHIVE_SEARCH_NOT_SETTLED`, `ARCHIVE_SEARCH_NOT_ASKED`,
 * `ARCHIVE_SEARCH_ALREADY_APPROVED`) and the case where it would accept. They
 * are answered here so the panel can say *why* rather than offer a button that
 * comes back refused — and the refusal is still shown by the code the service
 * named, because this copy of the rule may be the one that is wrong.
 */
export type ApprovalStance =
  // A run is under way, so the register may yet answer differently.
  | 'unsettled'
  // The register was asked nothing about this package: there is no search.
  | 'not_asked'
  // Somebody has signed, and their approval still covers these answers.
  | 'in_force'
  // It can be signed for now.
  | 'open';

export function approvalStance({
  status,
  registryChecks,
  approvals,
}: {
  status: PackageStatus;
  registryChecks: readonly RegistryCheckDto[];
  approvals: readonly ArchiveSearchApprovalDto[];
}): ApprovalStance {
  if (status !== 'Completed') return 'unsettled';
  if (registryChecks.length === 0) return 'not_asked';
  if (approvalInForce(approvals)) return 'in_force';
  return 'open';
}

/** One line of what an approval covered, against what the register says now.
 *  `now` is null where the check is no longer among the package's — the answers
 *  were made over an envelope that has since changed. */
export type CoveredCheck = {
  key: string;
  approved: RegistryOutcome;
  now: RegistryOutcome | null;
};

/**
 * What an approval was given over, held against the package as it stands.
 *
 * A spent approval is only half-legible as a date: "signed, then outrun" leaves
 * the reader to guess what changed. This says it — the verdict that was signed
 * for beside the one that replaced it.
 */
export function coveredChecks(
  approval: ArchiveSearchApprovalDto,
  registryChecks: readonly RegistryCheckDto[],
): CoveredCheck[] {
  return approval.checks.map(covered => ({
    key: covered.key,
    approved: covered.outcome,
    now:
      registryChecks.find(check => check.key === covered.key)?.outcome ?? null,
  }));
}
