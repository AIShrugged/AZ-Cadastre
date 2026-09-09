/**
 * Supporting documents — the third thing a report says, and the one that is
 * about what happens after it.
 *
 * A report holds two kinds of line about the package that arrived: a shortfall
 * in it, and a doubt about how well a sheet was read. `SupportingDocumentsRequired`
 * is neither. It names papers that were never in the envelope and were never
 * expected to be, for the case this submission turned out to be — so it is
 * counted against nothing, and a report whose only line is one of these still
 * reads `OK` (ADR-0013).
 *
 * The three readings this module exists to keep apart are the ones that slide
 * into one another on a screen:
 *
 *   1. we held the package against the profile and found nothing against it;
 *   2. we held it against the profile and found something;
 *   3. we could not work out which set of supporting papers the case needs.
 *
 * The third is not the first. An unanswered question drawn the way a clean
 * answer is drawn is how an inspector comes to register a building on papers
 * nobody checked. It is not the second either: nothing is wrong with the
 * submission, nothing failed, and drawing it as a fault would send an applicant
 * away believing they did something incorrectly.
 *
 * It lives with the entity and not on the detail screen because the reading is
 * a property of the report, and the moment a second surface states it — the
 * register's row, a summary tile — two copies of this rule is how they come to
 * disagree.
 */
import type {
  IssueDto,
  IssueKind,
  ReportDto,
} from '@cadastre/api-contracts/verification';

export const SUPPORTING_DOCUMENTS: IssueKind = 'SupportingDocumentsRequired';

export type SupportingSet = {
  /**
   * Whether the run worked out which of the profile's sets this case falls
   * under. False is not a fault and not a failure: a height nobody could read
   * off the papers leaves the question open, and the papers still have to be
   * brought.
   */
  readonly placed: boolean;
  readonly issue: IssueDto;
};

/**
 * How the two are told apart, and it is the contract's own marker rather than
 * one invented here: a message that placed the case is filed against the
 * reading it was decided on and carries that reading's confidence, and one that
 * could not carries no document, no sheet and no confidence (ADR-0013 §6).
 *
 * Read as "carries any of the three" and not "carries a confidence": the
 * absence is stated of all three together, and a client that hung the
 * distinction on one field would flip the whole panel the day a message arrives
 * anchored to a sheet whose confidence was not recorded.
 */
function wasPlaced(issue: IssueDto): boolean {
  return (
    issue.documentId !== null ||
    issue.pageNumber !== null ||
    issue.confidence !== null
  );
}

/**
 * Every set the report states, in the order it states them. A profile may
 * declare more than one branch, so this is a list and not one answer.
 */
export function supportingSetsOf(
  report: ReportDto | null,
): readonly SupportingSet[] {
  if (!report) return [];

  return report.issues
    .filter(issue => issue.kind === SUPPORTING_DOCUMENTS)
    .map(issue => ({ placed: wasPlaced(issue), issue }));
}

/** Whether any of them left the question of which set applies open. */
export function anyUnplaced(sets: readonly SupportingSet[]): boolean {
  return sets.some(set => !set.placed);
}

/**
 * The three readings, as one word.
 *
 * `findings` wins over `could_not_place` when both are true: the conclusion
 * line answers "what is wrong with this package", and an outstanding question
 * about supporting papers is not an answer to it. The question is not lost by
 * losing that line — it states itself in its own panel, which is the whole
 * reason the panel is not folded into the findings list.
 *
 * `findings` is passed in rather than counted here because which kinds are held
 * against the package is the report panel's own definition, and one count read
 * two ways is how a screen comes to say "no issues" above a list of them.
 */
export type ReportReading =
  'checked_clean' | 'checked_findings' | 'could_not_place';

export function readReport(
  findings: number,
  sets: readonly SupportingSet[],
): ReportReading {
  if (findings > 0) return 'checked_findings';

  return anyUnplaced(sets) ? 'could_not_place' : 'checked_clean';
}
