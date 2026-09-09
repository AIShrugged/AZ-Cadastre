/**
 * Report Status — what the run made of the papers, as a word and a tone.
 *
 * The second of the context's three states, and not the one the register is
 * read by: `PackageStanding` says what has to happen next, this says what was
 * found. A submission can be finished and still carry findings, which is why
 * the two are shown in two columns and narrowed by two filters (CONTEXT-MAP,
 * ADR-0014).
 *
 * Null is not a member and never gets a word here: a package no run has
 * reported on has no outcome, and drawing one for it would state a verdict
 * nobody reached.
 *
 * It lives with the entity rather than on a screen because two screens now show
 * it — the register's row and the detail's report panel — and two copies of the
 * mapping is how they come to disagree.
 */
import type { ReportStatus } from '@cadastre/api-contracts/verification';

import type { OutcomeTone } from './archive-search';

/** The word itself, in the reader's language. */
export const REPORT_KEY: Record<ReportStatus, string> = {
  OK: 'status.ok',
  IssuesFound: 'status.issues',
  IncompletePackage: 'status.incomplete',
};

/**
 * The tone it is set in — the register's own three, shared with the marks a
 * cross-document check and an archive answer are drawn in, so "found nothing
 * against it" reads alike wherever it is said.
 */
export const REPORT_TONE: Record<ReportStatus, OutcomeTone> = {
  OK: 'ok',
  IssuesFound: 'issues',
  IncompletePackage: 'incomplete',
};
