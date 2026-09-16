import { InvalidArchiveQrCheckException } from '../exceptions/index.js';

/*
 * The lines of a Decree 439 paper held against the National Archive Fund's copy
 * of it, by profile field key and in the order they are published (ADR-0028).
 *
 * The QR code itself is not among them: it is what the archive is asked by, not
 * a line the answer can disagree with.
 */
export const ARCHIVE_QR_FIELDS = [
  'document_no',
  'issue_date',
  'issuing_authority',
  'holder_name',
  'property_address',
  'plot_area',
  'decree_item',
  'archive_reference',
] as const;

export type ArchiveQrField = (typeof ARCHIVE_QR_FIELDS)[number];

export const ARCHIVE_QR_STATUSES = [
  'Confirmed',
  'Differs',
  'NotFound',
  'NoQrCode',
] as const;

export type ArchiveQrStatus = (typeof ARCHIVE_QR_STATUSES)[number];

// `NotStated` is silence on one side or the other — a line the paper does not
// print, or one the archive's entry does not carry — and never a disagreement.
export const ARCHIVE_QR_VERDICTS = ['Match', 'Mismatch', 'NotStated'] as const;

export type ArchiveQrVerdict = (typeof ARCHIVE_QR_VERDICTS)[number];

/** One line of the paper, beside what the archive's copy says of it. */
export class ArchiveQrFieldCheck {
  private constructor(
    public readonly name: ArchiveQrField,
    public readonly documentValue: string | null,
    public readonly archiveValue: string | null,
    public readonly verdict: ArchiveQrVerdict,
  ) {}

  static of(state: {
    name: string;
    documentValue: string | null;
    archiveValue: string | null;
    verdict: string;
  }): ArchiveQrFieldCheck {
    const name = ARCHIVE_QR_FIELDS.find(one => one === state.name);
    const verdict = ARCHIVE_QR_VERDICTS.find(one => one === state.verdict);

    if (!name) {
      throw new InvalidArchiveQrCheckException(`unknown field "${state.name}"`);
    }
    if (!verdict) {
      throw new InvalidArchiveQrCheckException(
        `unknown verdict "${state.verdict}"`,
      );
    }
    // A verdict about a value one side never gave would be a verdict about
    // nothing, and a reader could not tell it from a real one.
    if (
      verdict !== 'NotStated' &&
      (state.documentValue === null || state.archiveValue === null)
    ) {
      throw new InvalidArchiveQrCheckException(
        `"${name}" is judged ${verdict} with a side that states nothing`,
      );
    }

    return new ArchiveQrFieldCheck(
      name,
      state.documentValue,
      state.archiveValue,
      verdict,
    );
  }

  get differs(): boolean {
    return this.verdict === 'Mismatch';
  }
}

/**
 * What the National Archive Fund said about one Decree 439 paper, asked by the
 * QR reference printed on it (ADR-0028).
 *
 * The archive answers with its copy of the paper and the kind of body that
 * issued it; everything here that is a judgement — which lines agree, whether
 * that body could issue a paper of this kind at all, and so what the check came
 * to — is the domain's, so the status is derived and never handed in.
 */
export class ArchiveQrCheck {
  private constructor(
    public readonly status: ArchiveQrStatus,
    public readonly qrReference: string | null,
    public readonly checkedAt: Date,
    public readonly issuingAuthorityCompetent: boolean | null,
    public readonly fields: readonly ArchiveQrFieldCheck[],
  ) {}

  // No QR reference was read off the paper, so there was nothing to ask.
  static noQrCode(checkedAt: Date): ArchiveQrCheck {
    return new ArchiveQrCheck('NoQrCode', null, checkedAt, null, []);
  }

  // Asked, and the archive returned nothing under the reference.
  static notFound(qrReference: string, checkedAt: Date): ArchiveQrCheck {
    return new ArchiveQrCheck(
      'NotFound',
      ArchiveQrCheck.referenceOf(qrReference),
      checkedAt,
      null,
      [],
    );
  }

  /*
   * The archive found the paper. `Confirmed` only when every line that both
   * sides state agrees and the body was competent: a matching name on an act
   * its issuer had no power to make is an act that confirms nothing.
   */
  static found(state: {
    qrReference: string;
    checkedAt: Date;
    issuingAuthorityCompetent: boolean;
    fields: readonly ArchiveQrFieldCheck[];
  }): ArchiveQrCheck {
    ArchiveQrCheck.guardEveryLineOnce(state.fields);

    const differs =
      !state.issuingAuthorityCompetent ||
      state.fields.some(field => field.differs);

    return new ArchiveQrCheck(
      differs ? 'Differs' : 'Confirmed',
      ArchiveQrCheck.referenceOf(state.qrReference),
      state.checkedAt,
      state.issuingAuthorityCompetent,
      ArchiveQrCheck.inPublishedOrder(state.fields),
    );
  }

  static restore(state: {
    status: string;
    qrReference: string | null;
    checkedAt: Date;
    issuingAuthorityCompetent: boolean | null;
    fields: readonly ArchiveQrFieldCheck[];
  }): ArchiveQrCheck {
    switch (state.status) {
      case 'NoQrCode':
        return ArchiveQrCheck.noQrCode(state.checkedAt);
      case 'NotFound':
        return ArchiveQrCheck.notFound(
          state.qrReference ?? '',
          state.checkedAt,
        );
      case 'Confirmed':
      case 'Differs':
        return ArchiveQrCheck.found({
          qrReference: state.qrReference ?? '',
          checkedAt: state.checkedAt,
          issuingAuthorityCompetent: state.issuingAuthorityCompetent ?? false,
          fields: state.fields,
        });
      default:
        throw new InvalidArchiveQrCheckException(
          `unknown status "${state.status}"`,
        );
    }
  }

  get isConfirmed(): boolean {
    return this.status === 'Confirmed';
  }

  get differs(): boolean {
    return this.status === 'Differs';
  }

  // Asked about and not confirmed, for want of an answer rather than because
  // the answer disagreed: nothing under the reference, or no reference at all.
  get isUnanswered(): boolean {
    return this.status === 'NotFound' || this.status === 'NoQrCode';
  }

  get mismatched(): readonly ArchiveQrFieldCheck[] {
    return this.fields.filter(field => field.differs);
  }

  private static referenceOf(raw: string): string {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidArchiveQrCheckException('the QR reference is empty');
    }

    return trimmed;
  }

  // The same eight lines on every answer the archive gave, so a reader never
  // has to wonder whether a line is absent because it agreed.
  private static guardEveryLineOnce(
    fields: readonly ArchiveQrFieldCheck[],
  ): void {
    const named = new Set(fields.map(field => field.name));

    if (
      fields.length !== ARCHIVE_QR_FIELDS.length ||
      named.size !== ARCHIVE_QR_FIELDS.length
    ) {
      throw new InvalidArchiveQrCheckException(
        `expected each of ${ARCHIVE_QR_FIELDS.join(', ')} once`,
      );
    }
  }

  private static inPublishedOrder(
    fields: readonly ArchiveQrFieldCheck[],
  ): readonly ArchiveQrFieldCheck[] {
    return [...fields].sort(
      (left, right) =>
        ARCHIVE_QR_FIELDS.indexOf(left.name) -
        ARCHIVE_QR_FIELDS.indexOf(right.name),
    );
  }
}
