import {
  InvalidApprovalCommentException,
  InvalidApprovalSummaryException,
} from '../exceptions/index.js';

import type { RegistryCheckKey } from './registry-check.vo.js';
import type { RegistryOutcome } from './registry-outcome.vo.js';

/**
 * What a person concluded about the submission from what the archive answered.
 *
 * Required, and the only required part of an approval. It is what the next
 * reader actually opens the approval for: an approval carrying nothing but a
 * timestamp says a search was signed for and not what signing it meant, and
 * since nobody's name is recorded either (ADR-0016) it would say nothing at
 * all. About the submission as a whole, never about one check — the checks
 * already say what they found, each in its own words.
 */
export class ApprovalSummary {
  static readonly MAX_LENGTH = 2000;

  private constructor(public readonly value: string) {}

  static create(raw: string): ApprovalSummary {
    const trimmed = raw.trim();

    if (trimmed.length === 0)
      throw new InvalidApprovalSummaryException('empty');
    if (trimmed.length > ApprovalSummary.MAX_LENGTH) {
      throw new InvalidApprovalSummaryException('too_long');
    }

    return new ApprovalSummary(trimmed);
  }
}

/**
 * A remark on the act of approving — a reservation, or why this was signed for
 * despite something.
 *
 * Optional, deliberately: a second box that must be filled in beside the
 * summary is a box that gets "ok" typed into it, and a record full of "ok" is
 * worse than an absent one because it reads like deliberation (ADR-0016).
 * Blank is no comment rather than an empty one, because that is what an
 * untouched box sends.
 */
export class ApprovalComment {
  static readonly MAX_LENGTH = 2000;

  private constructor(public readonly value: string) {}

  static from(raw: string | null | undefined): ApprovalComment | null {
    if (raw === null || raw === undefined) return null;

    const trimmed = raw.trim();

    if (trimmed.length === 0) return null;
    if (trimmed.length > ApprovalComment.MAX_LENGTH) {
      throw new InvalidApprovalCommentException('too_long');
    }

    return new ApprovalComment(trimmed);
  }
}

/**
 * One line of what an approval covered: which of the profile's registry checks,
 * and what the register answered it with at the moment it was signed for.
 *
 * Kept so that an approval the checks have since outrun is readable rather than
 * merely marked spent — the record says the search that was approved answered
 * `Confirmed`, and the reader can see the current one says something else.
 */
export class ApprovedCheck {
  private constructor(
    public readonly key: RegistryCheckKey,
    public readonly outcome: RegistryOutcome,
  ) {}

  static of(key: RegistryCheckKey, outcome: RegistryOutcome): ApprovedCheck {
    return new ApprovedCheck(key, outcome);
  }
}

/**
 * A person's sign-off on what the archive register answered about a submission.
 *
 * An event and not a field. It covers the state of the archive search it was
 * given, so a run that asks the register again spends it: the aggregate drops
 * it and the record says when it stopped being in force, rather than leaving a
 * signature on answers nobody has read standing quietly in place (ADR-0016).
 *
 * It carries no author. There are no accounts in this system and none are
 * planned, so there is nothing to read a name off; a free-text box for one
 * would manufacture the appearance of accountability rather than record it.
 * When accounts arrive the author is one more field here.
 */
export class ArchiveSearchApproval {
  private constructor(
    public readonly summary: ApprovalSummary,
    public readonly comment: ApprovalComment | null,
    public readonly checks: readonly ApprovedCheck[],
  ) {}

  static of(state: {
    summary: ApprovalSummary;
    comment: ApprovalComment | null;
    checks: readonly ApprovedCheck[];
  }): ArchiveSearchApproval {
    return new ArchiveSearchApproval(state.summary, state.comment, [
      ...state.checks,
    ]);
  }
}
