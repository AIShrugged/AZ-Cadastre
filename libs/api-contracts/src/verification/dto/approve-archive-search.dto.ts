import { z } from 'zod';

import { PackageDetailDtoSchema } from './package.dto.js';

// Long enough for a paragraph and no longer. Both of these are a person's own
// words about one submission; a field that takes a report is a field the report
// ends up in.
export const APPROVAL_TEXT_MAX_LENGTH = 2000;

/**
 * What a person signs when they approve the archive search of a submission.
 *
 * Two texts and no author. There are no accounts in this system, so there is
 * nothing to read a name off — and a box to type one into would manufacture the
 * appearance of accountability rather than record it (ADR-0016). When accounts
 * arrive, the author is one more field here and is not a caller's to state.
 */
export const ApproveArchiveSearchRequestSchema = z.object({
  /**
   * The conclusion the archive search leads to for this submission as a whole.
   * Required, and the only required part: an approval that says only that it
   * happened says nothing, since nobody's name is on it either. Not about one
   * check — each of those already says what it found, in its own words.
   */
  summary: z.string().trim().min(1).max(APPROVAL_TEXT_MAX_LENGTH),
  /**
   * A remark on the act of approving — a reservation, or why this was signed
   * for despite something. Optional, deliberately: a second box that must be
   * filled in beside the summary is a box that gets "ok" typed into it, and a
   * record full of "ok" reads like deliberation without being any.
   *
   * Blank is no comment rather than an empty one, because that is what an
   * untouched box sends.
   */
  comment: z
    .string()
    .trim()
    .max(APPROVAL_TEXT_MAX_LENGTH)
    .transform(remark => (remark === '' ? undefined : remark))
    .optional(),
});
export type ApproveArchiveSearchRequest = z.infer<
  typeof ApproveArchiveSearchRequestSchema
>;

/**
 * The submission as it now stands, approval and all — the resource the approval
 * is visible on, so a caller that has just signed for a search does not have to
 * ask for the package again to see it.
 */
export const ApproveArchiveSearchResponseSchema = PackageDetailDtoSchema;
export type ApproveArchiveSearchResponse = z.infer<
  typeof ApproveArchiveSearchResponseSchema
>;
