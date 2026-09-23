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
 * archive's copy (`ArchiveQrFieldVerdict`) — and one that is, `QrFieldOutcome`,
 * which is the contract's four verdicts read with the two values beside them so
 * that the `Результат` column can say which side was silent (COMM-150). What
 * this module decides is the only thing a client may decide about any of them:
 * the tone each is set in, the line of the dictionary that names it, and
 * whether there is a table to draw at all.
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
 * What the `Результат` column says about one line — the whole of the block's
 * per-row news, in one word (COMM-150).
 *
 * A vocabulary of the surface's own and not the contract's, because the
 * contract's four verdicts do not carve the news the way a reader needs it
 * carved: `NotStated` is silence on *either* side, and which side was silent
 * is the entire difference between "the archive's copy carries no such line"
 * and "the paper does not print one". Told as one word they read as one fact,
 * and the reader guesses which.
 *
 * Five and not four. Four are the ones the customer named — agreed, differed,
 * the archive states nothing, we never put the question — and the fifth is the
 * residue those four leave: a line the archive does state and the paper does
 * not. That one is a real comparison with a real finding (the paper is short
 * where the fonds are not), and folding it into the archive's silence would
 * say the opposite of what happened.
 *
 * Six since ADR-0041, and the sixth is the only one that is ours. The archive
 * answered and served its own signed copy, and this system could not read it:
 * the link would not open, the file was not a PDF, the reader refused. It also
 * arrives looking exactly like the archive's silence — a null archive value —
 * and reported as that it told the customer the fonds hold almost nothing
 * about their paper, which was not true (COMM-151).
 */
export type QrFieldOutcome =
  | 'match'
  | 'mismatch'
  // The archive was asked and its copy prints no such line. Not a shortfall of
  // the paper's and never drawn as one.
  | 'archive_silent'
  // The archive states the line and the paper does not — where the paper is
  // short and the fonds are not.
  | 'document_silent'
  // Never put to the archive at all, by a decision of ours (ADR-0040).
  | 'not_compared'
  // The archive served its copy of the paper and we could not read it
  // (ADR-0041). Ours, and never the archive's silence.
  | 'copy_unread';

/**
 * How one line came out, read off the verdict and the two values together.
 *
 * The two that are about this system rather than about either document come
 * first — `NotCompared` and `NotRead` — because both arrive looking exactly
 * like the archive's silence, a null archive value, which is the confusion the
 * split exists to prevent. Read off the verdict for that reason: the contract's
 * word is the only thing that tells them from a copy that prints no such line.
 */
export function qrFieldOutcome(field: ArchiveQrFieldCheckDto): QrFieldOutcome {
  if (field.verdict === 'NotCompared') return 'not_compared';
  if (field.verdict === 'NotRead') return 'copy_unread';
  if (field.verdict === 'Match') return 'match';
  if (field.verdict === 'Mismatch') return 'mismatch';

  return field.archiveValue === null ? 'archive_silent' : 'document_silent';
}

/**
 * One tone per outcome, and only a disagreement is a fault's colour.
 *
 * The four silences share `silent` for the reason the statuses do: a value one
 * side does not state is not a disagreement, a decision of ours is not a
 * shortfall of the paper's, and neither is a copy we could not read. They are
 * told apart by their word, which is also what carries the difference into
 * grayscale and a screen reader.
 */
export const QR_OUTCOME_TONE: Record<
  QrFieldOutcome,
  'ok' | 'issues' | 'silent'
> = {
  match: 'ok',
  mismatch: 'issues',
  archive_silent: 'silent',
  document_silent: 'silent',
  not_compared: 'silent',
  copy_unread: 'silent',
};

export const QR_OUTCOME_KEY: Record<QrFieldOutcome, string> = {
  match: 'detail.qr.o_match',
  mismatch: 'detail.qr.o_mismatch',
  archive_silent: 'detail.qr.o_archive_silent',
  document_silent: 'detail.qr.o_document_silent',
  not_compared: 'detail.qr.o_not_compared',
  copy_unread: 'detail.qr.o_copy_unread',
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
 * The word for this standing, and for `unknown` the reason there is nothing to
 * judge by where this system knows it.
 *
 * "Nothing to judge its power by" left alone is the one line about the issuing
 * body an inspector sees, and it invites the guess that the archive was asked
 * about the body and shrugged. Where the issuing line is one this system never
 * put to the archive, that is exactly why the standing is empty — the body is
 * never read off a scan, so it is never held against anything (ADR-0040) — and
 * the block says so rather than leaving the reader to join the two lines up.
 *
 * Only on `unknown`, and only where the line is in fact uncompared: a standing
 * the archive did answer needs no excuse, and a type the Decree's table simply
 * does not settle keeps the plain wording.
 */
export function competenceKey(check: ArchiveQrCheckDto): string {
  const standing = competence(check);

  if (standing !== 'unknown') return COMPETENCE_KEY[standing];

  return qrUncomparedFields(check).some(
    field => field.name === 'issuing_authority',
  )
    ? 'detail.qr.competence_not_compared'
    : COMPETENCE_KEY.unknown;
}

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
 * The lines the archive was asked about and said nothing for, in the same
 * order.
 *
 * Rows of the table like any other since COMM-150, marked `архив не приводит`
 * in the `Результат` column. They used to be dropped from the table and named
 * in a sentence beneath it, which kept the edge of the comparison visible but
 * made the block prose and made a table of two agreeing lines look like a paper
 * confirmed in full. The list itself stays, because the count and the summary
 * are read off it.
 *
 * `NotCompared` and `NotRead` are off this list and on their own. All three end
 * with no archive value, and the reason is the whole difference: here the
 * archive was asked and its copy carries no such line; there the line was never
 * put to it by a decision of ours (ADR-0040); and there again the copy was
 * served and we could not read it (ADR-0041). Told as one fact the reader
 * blames the fonds for what this system did.
 */
export function qrUnstatedFields(
  check: ArchiveQrCheckDto,
): readonly ArchiveQrFieldCheckDto[] {
  return qrFields(check).filter(
    field =>
      field.archiveValue === null &&
      field.verdict !== 'NotCompared' &&
      field.verdict !== 'NotRead',
  );
}

/**
 * The lines this system never put to the archive, in the same order.
 *
 * Read off the verdict and not off the missing archive value: `NotCompared` is
 * the contract's word for a decision of ours, and it is the only thing that
 * tells this apart from an archive that simply kept no such column. Today it
 * is `issuing_authority` and only it — the body is not read off a scan, so it
 * is not held against anything (ADR-0034, ADR-0040).
 *
 * A row of the table like the rest, marked `не сверяем`; the list is what
 * `competenceKey` reads to say why there is nothing to judge the body by.
 */
export function qrUncomparedFields(
  check: ArchiveQrCheckDto,
): readonly ArchiveQrFieldCheckDto[] {
  return qrFields(check).filter(field => field.verdict === 'NotCompared');
}

/**
 * The lines whose value was to come off the archive's own copy of the paper and
 * did not, because that copy could not be read (ADR-0041).
 *
 * A row of the table like the rest, marked `копию не прочитали`. Read off the
 * verdict for the same reason `NotCompared` is: the contract's word is all that
 * tells a copy nobody could open from a copy that prints no such line, and the
 * first is our failure while the second is the archive's record.
 */
export function qrUnreadFields(
  check: ArchiveQrCheckDto,
): readonly ArchiveQrFieldCheckDto[] {
  return qrFields(check).filter(field => field.verdict === 'NotRead');
}

/**
 * Whether there is a table to draw.
 *
 * Whether the check came back with lines at all, and nothing more (COMM-150).
 * It used to also ask whether any of them had been *answered*, and hid the
 * table where none had — which is how eight silences came to be reported as
 * five paragraphs of prose, and how «все сверенные строки совпали» came to
 * stand over an empty set. That nothing was compared is now something the
 * table says, row by row, in its own `Результат` column.
 *
 * The statuses that genuinely carry no lines keep their sentence: `NoQrCode`,
 * `NotFound`, `IssuerNotConnected` and `IssuerUnreachable` all answer with an
 * empty `fields`, and an empty frame under them reads as a table that failed
 * to load. So does an answer that was about the sheet rather than about what
 * it says — a signature service states no lines at all (ADR-0034), and the
 * signature table below is what it has to show.
 */
export function qrDrawsTable(check: ArchiveQrCheckDto): boolean {
  return qrFields(check).length > 0;
}

/**
 * Whether the check bore out no line of the paper at all (COMM-150).
 *
 * The bug this exists to close: the archive answered, its copy stated not one
 * of the eight lines, every comparison was therefore vacuous — and the block
 * still headed itself «Копия Национального архива подтверждает» and said in
 * its own sentence that every compared line agreed. True over an empty set and
 * read by an inspector as a confirmed paper.
 *
 * Only `Confirmed`, because only `Confirmed` claims anything. `Differs` with
 * no compared line is a finding of some other kind — the signature did not
 * verify, or the issuing body had no such power — and its word and its tone
 * are already the right ones. The four silences never claimed to begin with.
 *
 * Purely presentational, and derived: the contract states no such status and
 * is not asked for one.
 */
export function qrConfirmsNoLine(check: ArchiveQrCheckDto): boolean {
  return check.status === 'Confirmed' && qrComparedFields(check).length === 0;
}

/** The status word, with the empty confirmation told apart from a real one. */
export function qrStatusKey(check: ArchiveQrCheckDto): string {
  return qrConfirmsNoLine(check)
    ? 'detail.qr.confirmed_no_line'
    : QR_STATUS_KEY[check.status];
}

/** And its sentence, which is where the difference is actually explained. */
export function qrStatusNote(check: ArchiveQrCheckDto): string {
  return qrConfirmsNoLine(check)
    ? 'detail.qr.confirmed_no_line_note'
    : QR_STATUS_NOTE[check.status];
}

/**
 * And its colour. A pass is a pass only where something passed: an empty
 * confirmation takes the tone the four silences take, because that is what it
 * is — an answer with nothing in it — and a green mark over it is the whole of
 * the misreading.
 */
export function qrStatusTone(check: ArchiveQrCheckDto): OutcomeTone {
  return qrConfirmsNoLine(check) ? 'silent' : QR_STATUS_TONE[check.status];
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
 * The rows of the signature table, in the order they are drawn (COMM-150).
 *
 * Six and fixed, the sixth being the signature's own standing. It used to be
 * the heading over the other five, phrased as a sentence with the value baked
 * into the string — «копию подписал: X» — which put the label inside the
 * reading and made the block prose. In a table the label belongs in the label
 * column, so the standing is simply the row that has no name of its own.
 *
 * Who signed and when are about the act; the issuing organisation, the
 * structural subdivision and the certificate's validity period are about the
 * credential the act was made with. Fixed here rather than at the point of
 * drawing: a block whose rows moved between two papers of the same kind is a
 * block an inspector cannot scan.
 *
 * None of them is a row of the comparison table. That table holds the paper
 * against the National Archive's copy line by line; these say how the archive's
 * own electronic copy was signed, which is a claim of a different kind.
 */
export const SIGNATURE_ROW_ORDER = [
  'signedBy',
  'signedOn',
  'organisation',
  'unit',
  'certificateValidity',
  'valid',
] as const;

export type SignatureRowName = (typeof SIGNATURE_ROW_ORDER)[number];

export const SIGNATURE_ROW_KEY: Record<SignatureRowName, string> = {
  signedBy: 'detail.qr.signed_by',
  signedOn: 'detail.qr.signed_on',
  organisation: 'detail.qr.cert_organisation',
  unit: 'detail.qr.cert_unit',
  certificateValidity: 'detail.qr.cert_validity',
  valid: 'detail.qr.sig_valid',
};

export type SignatureRow = {
  readonly name: SignatureRowName;
  /**
   * What the archive stated, or `null` where it stated nothing — which the
   * table draws as its placeholder and never as a blank cell.
   *
   * Always `null` for `valid`: the signature's standing is a mark and a word
   * (`SIGNATURE_KEY`), not a string the service sent, and giving it a value
   * here would invite the table to print it as one.
   */
  readonly value: string | null;
};

/**
 * Every row of the signature table, always all six, in one order.
 *
 * The customer's ask, in one function: **which fields we have and which we do
 * not.** The block used to drop a null particular, so a source stating two of
 * the five drew two lines and said nothing about the other three — the reader
 * could not tell an absent value from a field this build does not read. Now
 * the row is always there and the silence is in its value column.
 *
 * Empty and only empty where the archive verified no signature at all: there
 * is then no table, because six labels over six placeholders state an absence
 * of a thing that was never claimed.
 *
 * A value present but blank is the same silence as a null: whitespace a service
 * sent is not a particular the archive stated.
 */
export function signatureRows(
  check: ArchiveQrCheckDto,
): readonly SignatureRow[] {
  const signature = check.signature;

  if (!signature) return [];

  const organisation = signature.organisation?.trim() || null;

  return SIGNATURE_ROW_ORDER.map<SignatureRow>(name => {
    if (name === 'valid') return { name, value: null };

    const value = signature[name]?.trim() || null;

    if (name !== 'unit' || value === null) return { name, value };

    return { name, value: subdivisionTail(value, organisation) || null };
  });
}

/**
 * The subdivision, with the organisation it is already under not said twice.
 *
 * The archive's service answers the subdivision as the full path through the
 * organisation — `<organisation> / DÖVLƏT ARXİVİNİN BAKI FİLİALI DİREKTOR` —
 * and the block prints the organisation on the line above. Printed in full the
 * second line buries its own news, the branch and the post, behind a name the
 * reader has just read; and two long lines opening identically read as the
 * same fact drawn twice (COMM-149).
 *
 * Only a prefix, and only an exact one. A subdivision that merely mentions the
 * organisation further in is not a path and keeps every word; and matching
 * case-insensitively would turn on Azerbaijani's dotted and dotless i, where a
 * locale's idea of the same letter is not the service's. Where the whole of
 * the subdivision is the organisation there is no news left in the line at all,
 * and the row is drawn with its placeholder rather than dropped — the table's
 * whole point is that every field it knows about has a row.
 */
function subdivisionTail(unit: string, organisation: string | null): string {
  if (!organisation || !unit.startsWith(organisation)) return unit;

  return unit
    .slice(organisation.length)
    .replace(/^[\s/,;|·–—-]+/u, '')
    .trim();
}
