/**
 * correct-field — an operator putting right what the engine read off a paper,
 * on the row where the reading is shown (ADR-0033).
 *
 * The one write on the case screen that changes what the register *holds*
 * rather than what it has been told: a corrected value is a reading of the
 * document like the machine's own, so it may be a side of a cross-document
 * check and may be what the archive register is asked about — which is why
 * saving one re-opens the package and verifies it afresh.
 *
 * The feature owns the draft, the save and the wording; the register's page
 * owns the row. That split is deliberate: the row already carries the value,
 * the confidence, the sheet jump and the carried-from citation, and none of
 * those become this feature's business for the sake of putting a box in the
 * middle of them.
 *
 * **Operator only, and this client does not enforce it.** The case screen lives
 * under the operator's branch of the route map and an applicant never reaches
 * it; the service refuses the call outright for anyone else (403). A guard
 * drawn here as well would be a second opinion about permission, which is the
 * one thing this client keeps out of (ADR-0029).
 */
export type { Corrections, Draft, NoCorrection } from './model';
export { useCorrections, whyNotCorrectable } from './model';
export {
  AddValue,
  CorrectButton,
  CorrectionBar,
  CorrectionBox,
  NoCorrectionsNote,
  UnsavedMark,
} from './ui/correct-field';
