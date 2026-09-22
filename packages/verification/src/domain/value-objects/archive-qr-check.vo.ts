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
  // A code was decoded and the service that issued it is not connected to this
  // system, so nothing was asked (ADR-0034).
  'IssuerNotConnected',
] as const;

export type ArchiveQrStatus = (typeof ARCHIVE_QR_STATUSES)[number];

// `NotStated` is silence on one side or the other — a line the paper does not
// print, or one the archive's entry does not carry — and never a disagreement.
export const ARCHIVE_QR_VERDICTS = ['Match', 'Mismatch', 'NotStated'] as const;

export type ArchiveQrVerdict = (typeof ARCHIVE_QR_VERDICTS)[number];

/**
 * What the issuer said about the sheet itself: who signed the electronic
 * original, for which body, and whether that signature verifies (ADR-0034).
 *
 * Kept whole rather than reduced to `valid`, because an inspector holding a
 * sealed sheet wants to see the same name the seal carries — a signature that
 * verifies for the wrong office is a finding, and only the name shows it.
 *
 * Six lines since ADR-0035: the signature panel of the archive's own signed PDF
 * states a validity period for the certificate as well, and it is read off the
 * sheet where the service's metadata is silent about it.
 */
export class ArchiveQrSignature {
  private constructor(
    public readonly signedBy: string | null,
    public readonly organisation: string | null,
    public readonly unit: string | null,
    public readonly signedOn: string | null,
    /*
     * How long the signing certificate is good for, in the words the panel
     * prints it in — "14.01.2025 - 14.01.2027", a single expiry date, whatever
     * the sheet says (ADR-0035).
     *
     * Never parsed into dates. An inspector is shown this beside the signer's
     * name and decides for themselves whether the signature was made inside it;
     * turning two words off a scan into a pair of instants would invent a
     * precision the reading never had, and a wrong one would read as a fact.
     */
    public readonly certificateValidity: string | null,
    public readonly valid: boolean,
  ) {}

  static of(state: {
    signedBy: string | null;
    organisation: string | null;
    unit: string | null;
    signedOn: string | null;
    // Absent from an answer made before the signed PDF was digitised, and from
    // a service that states no validity period at all.
    certificateValidity?: string | null;
    valid: boolean;
  }): ArchiveQrSignature {
    return new ArchiveQrSignature(
      blank(state.signedBy),
      blank(state.organisation),
      blank(state.unit),
      blank(state.signedOn),
      blank(state.certificateValidity ?? null),
      state.valid,
    );
  }
}

function blank(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? '';

  return trimmed.length === 0 ? null : trimmed;
}

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
    // What the issuer said about the sheet. Null on every status but
    // `Confirmed` and `Differs`, and on those two only where the service that
    // answered verifies signatures at all (ADR-0034).
    public readonly signature: ArchiveQrSignature | null,
    // Whoever issued the code, where the reference names them — the host of the
    // link, as a person would read it off the paper. Carried on
    // `IssuerNotConnected`, where it is the whole of what the report can say.
    public readonly issuer: string | null,
  ) {}

  // No QR code was decoded off the paper, so there was nothing to ask.
  static noQrCode(checkedAt: Date): ArchiveQrCheck {
    return new ArchiveQrCheck(
      'NoQrCode',
      null,
      checkedAt,
      null,
      [],
      null,
      null,
    );
  }

  // Asked, and the archive returned nothing under the reference.
  static notFound(qrReference: string, checkedAt: Date): ArchiveQrCheck {
    return new ArchiveQrCheck(
      'NotFound',
      ArchiveQrCheck.referenceOf(qrReference),
      checkedAt,
      null,
      [],
      null,
      null,
    );
  }

  /*
   * A code that resolves somewhere nothing here can follow it (ADR-0034).
   *
   * Never asked and so never answered: it is the absence `IntegrationNotConnected`
   * states for a whole type, narrowed to the one sheet and naming the service
   * that would settle it.
   */
  static issuerNotConnected(
    qrReference: string,
    issuer: string | null,
    checkedAt: Date,
  ): ArchiveQrCheck {
    return new ArchiveQrCheck(
      'IssuerNotConnected',
      ArchiveQrCheck.referenceOf(qrReference),
      checkedAt,
      null,
      [],
      null,
      blank(issuer),
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
    // Null where there was nothing to judge competence by — a type the Decree's
    // table does not cover, which is every paper the check gained in ADR-0034.
    // Unknown is not a fault: only an explicit `false` is.
    issuingAuthorityCompetent: boolean | null;
    fields: readonly ArchiveQrFieldCheck[];
    signature?: ArchiveQrSignature | null;
  }): ArchiveQrCheck {
    ArchiveQrCheck.guardEveryLineOnce(state.fields);

    const signature = state.signature ?? null;
    // A signature that does not verify is the sheet itself disagreeing with the
    // record of it, which is a stronger finding than any single line: the lines
    // are what the paper says, and this is whether the paper is the paper.
    const differs =
      state.issuingAuthorityCompetent === false ||
      state.fields.some(field => field.differs) ||
      signature?.valid === false;

    return new ArchiveQrCheck(
      differs ? 'Differs' : 'Confirmed',
      ArchiveQrCheck.referenceOf(state.qrReference),
      state.checkedAt,
      state.issuingAuthorityCompetent,
      ArchiveQrCheck.inPublishedOrder(state.fields),
      signature,
      null,
    );
  }

  static restore(state: {
    status: string;
    qrReference: string | null;
    checkedAt: Date;
    issuingAuthorityCompetent: boolean | null;
    fields: readonly ArchiveQrFieldCheck[];
    signature?: ArchiveQrSignature | null;
    issuer?: string | null;
  }): ArchiveQrCheck {
    switch (state.status) {
      case 'NoQrCode':
        return ArchiveQrCheck.noQrCode(state.checkedAt);
      case 'NotFound':
        return ArchiveQrCheck.notFound(
          state.qrReference ?? '',
          state.checkedAt,
        );
      case 'IssuerNotConnected':
        return ArchiveQrCheck.issuerNotConnected(
          state.qrReference ?? '',
          state.issuer ?? null,
          state.checkedAt,
        );
      case 'Confirmed':
      case 'Differs':
        return ArchiveQrCheck.found({
          qrReference: state.qrReference ?? '',
          checkedAt: state.checkedAt,
          issuingAuthorityCompetent: state.issuingAuthorityCompetent,
          fields: state.fields,
          signature: state.signature ?? null,
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

  // Not confirmed for want of an answer rather than because the answer
  // disagreed: nothing under the reference, no code on the sheet, or a code
  // whose issuer this system cannot ask.
  get isUnanswered(): boolean {
    return (
      this.status === 'NotFound' ||
      this.status === 'NoQrCode' ||
      this.status === 'IssuerNotConnected'
    );
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
