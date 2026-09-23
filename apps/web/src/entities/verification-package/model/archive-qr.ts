/**
 * What the National Archive Fund said about the disposal order, as a reader has
 * to be able to take it in (ADR-0028).
 *
 * An answer about **one document** and not about the package: the paper prints
 * its own QR reference and names its own file in the archive, so the answer is
 * drawn in the document's own entry and never in the package's panels.
 *
 * And about **one source**. The National Archive is asked, over the link its
 * own code carries, and its answer stands alone: nothing in this block is
 * corroborated against, supplemented by or held beside our own archive register
 * (COMM-141). The register panel in the package's own view is a separate
 * reading of a separate question and says so in its own words.
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
 * under it — `NoQrCode` is not even a question that was put, and
 * `IssuerNotConnected` is a question this system cannot put to anybody, and
 * `IssuerUnreachable` is a question that was put and never answered (ADR-0037).
 * None of the four is held against the submission (ADR-0031, ADR-0034), so none
 * may borrow a fault's colour; `Differs` is the only status that reports one.
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
  // The third silence: the code was read and there is nobody here to ask. It
  // is the most hopeful of the three — the sheet did its part — and still not
  // a pass, so it keeps the same tone and is told apart by its sentence.
  IssuerNotConnected: 'silent',
  /*
   * The fourth: the issuer was asked and did not answer (ADR-0037). Silent for
   * the same reason as the rest — nobody said anything against the paper — and
   * the only one of them that is a fault of ours rather than of the paper, its
   * issuer or the fonds. What it must never be is invisible: this block not
   * drawing at all is the bug it was added for (COMM-144).
   */
  IssuerUnreachable: 'silent',
};

/** The status itself, in the reader's language. */
export const QR_STATUS_KEY: Record<ArchiveQrCheckStatus, string> = {
  Confirmed: 'detail.qr.confirmed',
  Differs: 'detail.qr.differs',
  NotFound: 'detail.qr.not_found',
  NoQrCode: 'detail.qr.no_code',
  IssuerNotConnected: 'detail.qr.issuer_not_connected',
  IssuerUnreachable: 'detail.qr.issuer_unreachable',
};

/** What the status means for this paper, said in a sentence — the whole of the
 *  block where there is no table to draw. */
export const QR_STATUS_NOTE: Record<ArchiveQrCheckStatus, string> = {
  Confirmed: 'detail.qr.confirmed_note',
  Differs: 'detail.qr.differs_note',
  NotFound: 'detail.qr.not_found_note',
  NoQrCode: 'detail.qr.no_code_note',
  IssuerNotConnected: 'detail.qr.issuer_not_connected_note',
  IssuerUnreachable: 'detail.qr.issuer_unreachable_note',
};

/**
 * One tone per verdict. `NotStated` is silence on one side or the other and is
 * never a disagreement, so it is drawn as the register draws a column nobody
 * kept rather than as a shortfall. `NotCompared` is quieter still — the line
 * was never put to the archive (ADR-0040) — and shares the tone until the block
 * is designed around it.
 */
export const QR_VERDICT_TONE: Record<
  ArchiveQrFieldVerdict,
  'ok' | 'issues' | 'silent'
> = {
  Match: 'ok',
  Mismatch: 'issues',
  NotStated: 'silent',
  NotCompared: 'silent',
};

export const QR_VERDICT_KEY: Record<ArchiveQrFieldVerdict, string> = {
  Match: 'detail.qr.v_match',
  Mismatch: 'detail.qr.v_mismatch',
  NotStated: 'detail.qr.v_not_stated',
  NotCompared: 'detail.qr.v_not_compared',
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
 * The lines the archive actually answered on — the comparison, as opposed to
 * the eight questions that were put (COMM-146).
 *
 * The engine returns all eight whatever the archive's copy holds, and a line
 * the archive prints nothing for was never compared with anything: drawing it
 * as a row, with the paper's value against a dash and a verdict beside it,
 * states a result where there was none. The reader takes those rows for a
 * system that tried and failed, which is not what happened — the archive's copy
 * simply does not carry that line.
 *
 * Read off `archiveValue` and not off the verdict: `NotStated` is silence on
 * *either* side, and a line the paper omits and the archive states is a line
 * the archive did answer — worth showing, because it is where the paper is
 * short and the fonds are not.
 */
export function qrComparedFields(
  check: ArchiveQrCheckDto,
): readonly ArchiveQrFieldCheckDto[] {
  return qrFields(check).filter(field => field.archiveValue !== null);
}

/**
 * The lines the archive said nothing about, in the same order.
 *
 * Dropped from the table and not from the block: an inspector has to see the
 * edge of the comparison — what was held against the archive's copy and what
 * the copy simply does not print — or a table of two agreeing lines reads as a
 * paper confirmed in full. They are named in one muted sentence under the
 * table, which is the whole of what is true about them.
 */
export function qrUnstatedFields(
  check: ArchiveQrCheckDto,
): readonly ArchiveQrFieldCheckDto[] {
  return qrFields(check).filter(field => field.archiveValue === null);
}

/**
 * Whether there is a line-by-line comparison to draw.
 *
 * Every status but `Confirmed` and `Differs` carries no lines — nothing was
 * held against anything — and an empty table under them would read as a table
 * that failed to load. They get the status and the sentence, which is the whole
 * of what is known. So does an answer that was about the sheet rather than
 * about what it says: a signature service states no lines at all (ADR-0034),
 * and the signature block below is what it has to show.
 *
 * And so does an answer whose every line the archive left blank: the eight
 * questions came back eight silences, there is nothing to compare, and the
 * sentence naming them is what the block shows instead of an empty frame.
 */
export function comparesLines(check: ArchiveQrCheckDto): boolean {
  return (
    (check.status === 'Confirmed' || check.status === 'Differs') &&
    qrComparedFields(check).length > 0
  );
}

/** How many lines disagree — the count the block's heading carries, so a table
 *  folded shut still says how much work is in it. Counted over the lines that
 *  were compared, which is also what the heading's total is: "2 of 8" where six
 *  of the eight were never answered overstates the check. */
export function qrDisagreements(check: ArchiveQrCheckDto): number {
  return qrComparedFields(check).filter(field => field.verdict === 'Mismatch')
    .length;
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

/**
 * How the sheet's own signature stood, where the archive verified one
 * (ADR-0034).
 *
 * A fact about the sheet and not about what it says, so it is drawn beside the
 * table and never as a row in it — and where the archive answered about the
 * sheet rather than about what it says, it is the whole of the block.
 */
export type SignatureStanding = 'verified' | 'failed';

export function signatureStanding(
  check: ArchiveQrCheckDto,
): SignatureStanding | null {
  if (!check.signature) return null;

  return check.signature.valid ? 'verified' : 'failed';
}

export const SIGNATURE_TONE: Record<SignatureStanding, 'ok' | 'issues'> = {
  verified: 'ok',
  failed: 'issues',
};

export const SIGNATURE_KEY: Record<SignatureStanding, string> = {
  verified: 'detail.qr.signature_verified',
  failed: 'detail.qr.signature_failed',
};

/**
 * What the signature block names, besides the verified/failed mark, in the
 * order it reads them out.
 *
 * Five particulars and one order, fixed here rather than at the point of
 * drawing: who signed and when are about the act, the issuing organisation,
 * the structural subdivision and the certificate's validity period are about
 * the credential the act was made with — and a block whose lines moved between
 * two papers of the same kind is a block an inspector cannot scan.
 *
 * None of them is a row of the comparison table. The table holds the paper
 * against the National Archive's copy line by line; these say how the sheet was
 * signed, which is a claim of a different kind and is why it is drawn beside
 * the table and never in it.
 */
export const SIGNATURE_LINE_ORDER = [
  'signedBy',
  'signedOn',
  'organisation',
  'unit',
  'certificateValidity',
] as const;

export type SignatureLineName = (typeof SIGNATURE_LINE_ORDER)[number];

export const SIGNATURE_LINE_KEY: Record<SignatureLineName, string> = {
  signedBy: 'detail.qr.signed_by',
  signedOn: 'detail.qr.signed_on',
  organisation: 'detail.qr.cert_organisation',
  unit: 'detail.qr.cert_unit',
  certificateValidity: 'detail.qr.cert_validity',
};

export type SignatureLine = {
  readonly name: SignatureLineName;
  readonly value: string;
};

/**
 * The particulars this signature actually states, in order.
 *
 * Every one of the five is nullable on the contract, and a source that states
 * none of them still verifies a signature — so the block degrades to the
 * verified/failed mark alone rather than to five labels pointing at nothing.
 * A value present but blank is the same silence as a null and is dropped with
 * it: whitespace a service sent is not a particular the archive stated.
 */
export function signatureLines(check: ArchiveQrCheckDto): SignatureLine[] {
  const signature = check.signature;

  if (!signature) return [];

  return SIGNATURE_LINE_ORDER.flatMap(name => {
    const value = signature[name]?.trim();

    return value ? [{ name, value }] : [];
  });
}
