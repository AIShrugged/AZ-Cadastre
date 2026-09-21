/**
 * What the National Archive Fund said about one Decree 439 paper, as a reader
 * has to be able to take it in (ADR-0028).
 *
 * An answer about **one document** and not about the package: each paper prints
 * its own QR reference and names its own file in the archive, so the answer is
 * drawn in the document's own entry and never in the package's panels.
 *
 * Two vocabularies, neither invented here: how the check as a whole came out
 * (`ArchiveQrCheckStatus`) and how one line of the paper stood against the
 * archive's copy (`ArchiveQrFieldVerdict`). What this module decides is the
 * only thing a client may decide about them — the tone each is set in, the line
 * of the dictionary that names it, and whether there is a table to draw at all.
 *
 * The distinction it exists to hold: **the archive contradicting the paper and
 * the archive having nothing to say are not the same news.** `NotFound` is an
 * absence of evidence — the reference was asked and the fonds hold no file
 * under it — and `NoQrCode` is not even a question that was put. Neither is
 * held against the submission (ADR-0031), so neither may borrow a fault's
 * colour; `Differs` is the only status that reports one.
 */
import type { OutcomeTone } from '@/shared/ui/outcome-mark';
import type {
  ArchiveQrCheckDto,
  ArchiveQrCheckStatus,
  ArchiveQrFieldCheckDto,
  ArchiveQrFieldName,
  ArchiveQrFieldVerdict,
} from '@cadastre/api-contracts/verification';
import { ArchiveQrFieldNameSchema } from '@cadastre/api-contracts/verification';

/**
 * One tone per status, and the two silences are not a fault's colour.
 *
 * `NotFound` and `NoQrCode` share `silent` on purpose — both are the surface
 * saying "there is no answer here", and the surface must not rank one of them
 * as worse than the other. They are told apart by their icon and their sentence
 * (The Status-Never-Alone Rule), which is also what carries the difference into
 * grayscale, a screen reader and a printout.
 */
export const QR_STATUS_TONE: Record<ArchiveQrCheckStatus, OutcomeTone> = {
  Confirmed: 'ok',
  Differs: 'issues',
  NotFound: 'silent',
  NoQrCode: 'silent',
};

/** The status itself, in the reader's language. */
export const QR_STATUS_KEY: Record<ArchiveQrCheckStatus, string> = {
  Confirmed: 'detail.qr.confirmed',
  Differs: 'detail.qr.differs',
  NotFound: 'detail.qr.not_found',
  NoQrCode: 'detail.qr.no_code',
};

/** What the status means for this paper, said in a sentence — the whole of the
 *  block where there is no table to draw. */
export const QR_STATUS_NOTE: Record<ArchiveQrCheckStatus, string> = {
  Confirmed: 'detail.qr.confirmed_note',
  Differs: 'detail.qr.differs_note',
  NotFound: 'detail.qr.not_found_note',
  NoQrCode: 'detail.qr.no_code_note',
};

/**
 * One tone per verdict. `NotStated` is silence on one side or the other and is
 * never a disagreement, so it is drawn as the register draws a column nobody
 * kept rather than as a shortfall.
 */
export const QR_VERDICT_TONE: Record<
  ArchiveQrFieldVerdict,
  'ok' | 'issues' | 'silent'
> = {
  Match: 'ok',
  Mismatch: 'issues',
  NotStated: 'silent',
};

export const QR_VERDICT_KEY: Record<ArchiveQrFieldVerdict, string> = {
  Match: 'detail.qr.v_match',
  Mismatch: 'detail.qr.v_mismatch',
  NotStated: 'detail.qr.v_not_stated',
};

/**
 * Whether the body that issued the paper was competent to issue one of that
 * kind — a fact of its own and not a string comparison, which is why it is a
 * line beside the table and never a row in it: the name on the paper can match
 * the archive's copy exactly and the body still have had no such power.
 *
 * Three answers and not two. `unknown` is the ordinary case wherever the
 * archive had nothing to judge it by, and drawn as a fault it would state a
 * shortfall nobody claimed.
 */
export type Competence = 'competent' | 'incompetent' | 'unknown';

export function competence(check: ArchiveQrCheckDto): Competence {
  if (check.issuingAuthorityCompetent === null) return 'unknown';
  return check.issuingAuthorityCompetent ? 'competent' : 'incompetent';
}

export const COMPETENCE_TONE: Record<Competence, 'ok' | 'issues' | 'silent'> = {
  competent: 'ok',
  incompetent: 'issues',
  unknown: 'silent',
};

export const COMPETENCE_KEY: Record<Competence, string> = {
  competent: 'detail.qr.competent',
  incompetent: 'detail.qr.incompetent',
  unknown: 'detail.qr.competence_unknown',
};

/**
 * The lines of the paper the archive was asked about, in the order the contract
 * publishes them.
 *
 * The order is read off the contract's own enum rather than written out again
 * here: a ninth line the engine learns to hold against the archive would
 * otherwise arrive at the bottom of the table, below the reference, wherever
 * the wire happened to put it.
 */
export const QR_FIELD_ORDER: readonly ArchiveQrFieldName[] =
  ArchiveQrFieldNameSchema.options;

export function qrFields(
  check: ArchiveQrCheckDto,
): readonly ArchiveQrFieldCheckDto[] {
  const rank = new Map(QR_FIELD_ORDER.map((name, index) => [name, index]));

  return [...check.fields].sort(
    (a, b) =>
      (rank.get(a.name) ?? QR_FIELD_ORDER.length) -
      (rank.get(b.name) ?? QR_FIELD_ORDER.length),
  );
}

/**
 * Whether there is a line-by-line comparison to draw.
 *
 * `NotFound` and `NoQrCode` carry no lines — nothing was held against anything
 * — and an empty table under them would read as a table that failed to load.
 * They get the status and the sentence, which is the whole of what is known.
 */
export function comparesLines(check: ArchiveQrCheckDto): boolean {
  return (
    (check.status === 'Confirmed' || check.status === 'Differs') &&
    check.fields.length > 0
  );
}

/** How many lines disagree — the count the block's heading carries, so a table
 *  folded shut still says how much work is in it. */
export function qrDisagreements(check: ArchiveQrCheckDto): number {
  return check.fields.filter(field => field.verdict === 'Mismatch').length;
}

/**
 * Whether this answer is one the package is answerable for.
 *
 * `Differs` and nothing else: the archive's copy bears the paper out or it does
 * not, and a reference the fonds hold no file under says nothing about the
 * submission. The block opens itself on this, on the same rule the cross-checks
 * and the register panel open on — an agreement is stated and folded, a
 * disagreement is where the work is.
 */
export function qrSpeaksAgainst(check: ArchiveQrCheckDto): boolean {
  return check.status === 'Differs';
}
