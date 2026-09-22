import type { ArchiveQrCheck } from './archive-qr-check.vo.js';
import type { Confidence } from './confidence.vo.js';
import { CrossCheckVerdict } from './cross-check-verdict.vo.js';
import type {
  CheckedValue,
  CrossCheck,
  CrossCheckKey,
} from './cross-check.vo.js';
import type { DocumentSource } from './document-source.vo.js';
import { DocumentType as DocumentTypeRef } from './document-type.vo.js';
import type { DocumentType } from './document-type.vo.js';
import type { DocumentId, SourceFileId } from './entity-ids/index.js';
import type { FieldKey } from './field.vo.js';
import { IssueKind } from './issue-kind.vo.js';
import type { PageNumber } from './page-number.vo.js';
import type { PageRange } from './page-range.vo.js';
import type { CaseParameterKey } from './provision.vo.js';
import type { RegistryCheck, RegistryDocument } from './registry-check.vo.js';

// A document a finding is filed against, and — where the finding is about one of
// its lines — the line and the sheet it sits on.
type Anchor = {
  readonly documentId: DocumentId;
  readonly sourceFileId: SourceFileId;
  readonly documentType: DocumentType;
  readonly fieldKey?: FieldKey | null;
  readonly pageNumber?: PageNumber | null;
  readonly confidence?: Confidence | null;
};

// The state systems a paper is confirmed through, named the way an audit line
// names them.
const SOURCE_NAMES: Record<DocumentSource, string> = {
  Package: 'nothing outside the package',
  Mqs: 'MQS',
  LicencesPortal: 'the Licences and Permits Portal',
  UrbanPlanningCommittee:
    "the Urban Planning and Architecture Committee's information system",
  NationalArchive: 'the National Archive Fund',
};

type Finding = {
  readonly kind: IssueKind;
  readonly message: string;
  readonly documentId?: DocumentId | null;
  readonly sourceFileId?: SourceFileId | null;
  readonly documentType?: DocumentType | null;
  readonly fieldKey?: FieldKey | null;
  readonly checkKey?: CrossCheckKey | null;
  readonly pageNumber?: PageNumber | null;
  readonly confidence?: Confidence | null;
};

// One finding in a report. It carries what it is about — a type, a document, a
// field, a sheet — so a reader can render it in their own language; `message`
// is the audit line, written once, in English, and never translated.
export class ValidationIssue {
  private constructor(
    public readonly kind: IssueKind,
    public readonly message: string,
    public readonly documentId: DocumentId | null,
    public readonly sourceFileId: SourceFileId | null,
    public readonly documentType: DocumentType | null,
    public readonly fieldKey: FieldKey | null,
    public readonly checkKey: CrossCheckKey | null,
    public readonly pageNumber: PageNumber | null,
    public readonly confidence: Confidence | null,
  ) {}

  static of(finding: Finding): ValidationIssue {
    return new ValidationIssue(
      finding.kind,
      finding.message,
      finding.documentId ?? null,
      finding.sourceFileId ?? null,
      finding.documentType ?? null,
      finding.fieldKey ?? null,
      finding.checkKey ?? null,
      finding.pageNumber ?? null,
      finding.confidence ?? null,
    );
  }

  static missingDocument(type: DocumentType): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.MISSING_DOCUMENT,
      message: `The package carries no "${type.value}", which this profile requires.`,
      documentType: type,
    });
  }

  static unplacedDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    pages: PageRange,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.UNREADABLE_DOCUMENT,
      message:
        `The document on sheets ${pages.first.value}–${pages.last.value} ` +
        `could not be recognised as any type this profile expects.`,
      documentId,
      sourceFileId,
      pageNumber: pages.first,
    });
  }

  /*
   * A document the profile does not ask for. `knownAs` is the entry of the
   * document catalogue the classifier recognised it as, where it recognised
   * one: a finding that can say "courier waybill" is worth more to an
   * inspector than six findings that all say "extra document", and the whole
   * point of the catalogue is that some of them can (ADR-0012).
   *
   * The named finding carries the catalogue key as its type rather than
   * `out_of_profile`, because that is what a reader renders the finding by.
   * Unnamed, it carries `out_of_profile` as it always has — the catalogue adds
   * a name where there is one and takes nothing away where there is not.
   */
  static extraDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    pages: PageRange,
    knownAs: DocumentType | null = null,
  ): ValidationIssue {
    const sheets = `sheets ${pages.first.value}–${pages.last.value}`;

    return ValidationIssue.of({
      kind: IssueKind.EXTRA_DOCUMENT,
      message: knownAs
        ? `The document on ${sheets} was read as "${knownAs.value}", which ` +
          `this profile does not ask for.`
        : `The document on ${sheets} was read but is not a type this profile ` +
          `asks for.`,
      documentId,
      sourceFileId,
      documentType: knownAs ?? DocumentTypeRef.OUT_OF_PROFILE,
      pageNumber: pages.first,
    });
  }

  static duplicateDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType,
    pages: PageRange,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.DUPLICATE_DOCUMENT,
      message:
        `The document on sheets ${pages.first.value}–${pages.last.value} is a ` +
        `second "${type.value}" in this package; the requirement was already answered.`,
      documentId,
      sourceFileId,
      documentType: type,
      pageNumber: pages.first,
    });
  }

  static unreadableSheet(
    sourceFileId: SourceFileId,
    pageNumber: PageNumber,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.UNREADABLE_DOCUMENT,
      message: `Sheet ${pageNumber.value} of the file could not be read.`,
      sourceFileId,
      pageNumber,
    });
  }

  static unreadableFile(sourceFileId: SourceFileId): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.UNREADABLE_DOCUMENT,
      message: 'The file could not be read into the documents it holds.',
      sourceFileId,
    });
  }

  // Filed against the first value the check weighed — the document the profile
  // named first — so the inspector lands on one side of the disagreement and
  // the message names the other.
  static crossCheckFailed(check: CrossCheck): ValidationIssue {
    const anchor = check.anchor;
    const said = check.verdict.equals(CrossCheckVerdict.MISMATCH)
      ? `The documents do not agree on "${check.key.value}"`
      : `Whether the documents agree on "${check.key.value}" could not be decided`;

    return ValidationIssue.of({
      kind: IssueKind.FIELD_MISMATCH,
      message: `${said}: ${check.cited}.${check.note ? ` ${check.note}` : ''}`,
      documentId: anchor?.documentId,
      documentType: anchor?.documentType,
      fieldKey: anchor?.fieldKey,
      checkKey: check.key,
      pageNumber: anchor?.foundOn,
      confidence: check.confidence,
    });
  }

  // Filed against the document the address was read off, because that is the
  // sheet the inspector opens to see what the package claims. The message names
  // what the record says instead, and the register the record came from.
  static registryMismatch(check: RegistryCheck): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.REGISTRY_MISMATCH,
      message:
        `The archive record of this property does not agree with the package ` +
        `on "${check.key.value}": ${check.cited}.` +
        (check.note ? ` ${check.note}` : ''),
      documentId: check.asked.documentId,
      documentType: check.asked.documentType,
      fieldKey: check.asked.fieldKey,
      pageNumber: check.asked.foundOn,
      confidence: check.confidence,
    });
  }

  /*
   * Filed against the paper itself, not against the address: the sheet the
   * inspector opens is the decree extract whose original the archive does not
   * have, and the question is whether that ground stands without it.
   *
   * A finding and not an observation. The register's silence about a kind of
   * paper never reaches here — only a register that recorded the absence does —
   * and for a title relied on under Decree 439 §7 the original in the National
   * Archive Fund is a condition of the ground being valid (ADR-0010).
   */
  static registryDocumentMissing(
    check: RegistryCheck,
    document: RegistryDocument,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.REGISTRY_DOCUMENT_MISSING,
      message:
        `The archive holds no original of ${document.cited} for this ` +
        `property.` +
        (check.reference ? ` Its file is at ${check.reference}.` : ''),
      documentId: document.carried.documentId,
      documentType: document.carried.documentType,
      pageNumber: document.carried.foundOn,
      confidence: check.confidence,
    });
  }

  // Stated for the record, never against the package: the register's coverage
  // is partial, so an absence is something the inspector weighs and not a
  // shortfall they have to resolve.
  static registryUnconfirmed(check: RegistryCheck): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.REGISTRY_UNCONFIRMED,
      message:
        `The archive register did not confirm "${check.key.value}" for ` +
        `${check.asked.cited}. ${check.note}`.trim(),
      documentId: check.asked.documentId,
      documentType: check.asked.documentType,
      fieldKey: check.asked.fieldKey,
      pageNumber: check.asked.foundOn,
      confidence: check.confidence,
    });
  }

  /*
   * Filed against the paper the mark is absent from, and carrying the reading
   * of the sheets it was looked for on: the whole claim is "the transcription
   * of these sheets shows no seal", and a sheet read at 0.4 supports that no
   * better than it supports anything else on it (docs/process-overview.md §5).
   */
  static unstampedDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType,
    pages: PageRange,
    confidence: Confidence,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.MISSING_ATTESTATION,
      message:
        `The "${type.value}" on sheets ${pages.first.value}–${pages.last.value} ` +
        `carries no stamp, which this profile expects it to bear.`,
      documentId,
      sourceFileId,
      documentType: type,
      pageNumber: pages.first,
      confidence,
    });
  }

  // A sealed paper whose seal says nothing. Reported apart from an unsealed
  // one because it is a different question for the inspector: not whether the
  // office stamped it but which office did, and that is answered by looking at
  // the sheet rather than by sending the paper back.
  static illegibleStamp(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType,
    pages: PageRange,
    confidence: Confidence,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.MISSING_ATTESTATION,
      message:
        `The stamp on the "${type.value}" on sheets ` +
        `${pages.first.value}–${pages.last.value} could not be read.`,
      documentId,
      sourceFileId,
      documentType: type,
      pageNumber: pages.first,
      confidence,
    });
  }

  static unsignedDocument(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType,
    pages: PageRange,
    confidence: Confidence,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.MISSING_ATTESTATION,
      message:
        `The "${type.value}" on sheets ${pages.first.value}–${pages.last.value} ` +
        `carries no signature, which this profile expects it to bear.`,
      documentId,
      sourceFileId,
      documentType: type,
      pageNumber: pages.first,
      confidence,
    });
  }

  /*
   * No document of the package is a title to the land (Article 10.2.1).
   *
   * Names no type, because any of the titles would answer it and naming one
   * would tell the applicant to bring that one. Which titles there are, and
   * which of them the case's provision rests on, is the provision the detail
   * view publishes beside the report (ADR-0025).
   */
  static missingTitleDocument(provision: string | null): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.MISSING_TITLE_DOCUMENT,
      message:
        'The package carries no title to the land — no document Article ' +
        '10.2.1 accepts as confirming the right over the plot' +
        (provision === null
          ? ', which every provision of Article 8 rests on.'
          : `, which provision ${provision} rests on like every other.`),
    });
  }

  /*
   * A paper the provision of Article 8 this case falls under asks for, that no
   * document of the package answers.
   *
   * The same kind as a missing required type, because to the applicant it is
   * the same shortfall. A group answered by any of several papers names no
   * single type — "an approved design or an act of acceptance", and a finding
   * that named the first would send the applicant for that one (ADR-0025).
   */
  static missingForProvision(
    provision: string,
    anyOf: readonly DocumentType[],
  ): ValidationIssue {
    const [only] = anyOf;
    const named = anyOf.map(type => `"${type.value}"`).join(' or ');

    return ValidationIssue.of({
      kind: IssueKind.MISSING_DOCUMENT,
      message:
        `Provision ${provision} of Article 8 asks for ${named}, and the ` +
        `package carries ${anyOf.length === 1 ? 'none' : 'none of them'}.`,
      documentType: anyOf.length === 1 ? only : null,
    });
  }

  /*
   * A title the package carries, dated outside the window every item it is
   * listed under gives it — a homestead allocation decision of 2003 where the
   * Decree takes one issued before 2001.
   *
   * Filed against the date it was read off, with that reading's confidence: a
   * date misread by one digit is the likeliest cause, and settling it is
   * opening that sheet.
   */
  static titleDocumentOutOfWindow(
    title: Anchor,
    dated: string,
    items: readonly { readonly item: string; readonly window: string }[],
  ): ValidationIssue {
    const windows = items
      .map(one => `item ${one.item}: ${one.window}`)
      .join('; ');

    return ValidationIssue.of({
      kind: IssueKind.TITLE_DOCUMENT_INVALID,
      message:
        `The "${title.documentType.value}" is dated "${dated}", outside the ` +
        `window of dates it is a title in (${windows}).`,
      documentId: title.documentId,
      sourceFileId: title.sourceFileId,
      documentType: title.documentType,
      fieldKey: title.fieldKey,
      pageNumber: title.pageNumber,
      confidence: title.confidence,
    });
  }

  /*
   * A title the package carries of the other class than a provision the case
   * falls under rests on — a lease-or-use title where the case is, or by the
   * wording of its extract would be, one of 8.0.9.1.2 (ADR-0030).
   *
   * Filed against the document and no field of it: the class is its kind, and
   * nothing on its sheets could be misread into another.
   */
  static titleDocumentOfWrongClass(
    title: Anchor,
    landRight: string,
    items: readonly string[],
    provisions: readonly string[],
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.TITLE_DOCUMENT_INVALID,
      message:
        `The "${title.documentType.value}" is a ${landRight} title ` +
        `(item ${items.join(', ')}), and provision ${provisions.join(', ')} ` +
        `of Article 8 does not rest on a title of that class.`,
      documentId: title.documentId,
      sourceFileId: title.sourceFileId,
      documentType: title.documentType,
    });
  }

  /*
   * Which provision of Article 8 the case falls under could not be decided,
   * because a figure the table turns on was not stated and the provisions it
   * could have made the first are all still open.
   *
   * Names the figures whose reading would settle it and the candidates, so the
   * inspector knows what to establish rather than only that something is
   * unknown. Carries no document: what is missing is a figure, and a figure
   * nobody read has no sheet.
   */
  static provisionAmbiguous(
    candidates: readonly string[],
    undecidedOn: readonly CaseParameterKey[],
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.PROVISION_UNDETERMINED,
      message:
        `Which provision of Article 8 this case falls under could not be ` +
        `decided: ${undecidedOn.join(', ')} could not be established, and the ` +
        `case falls under one of ${candidates.join(', ')}.`,
    });
  }

  /*
   * No provision of Article 8 covers the case: every row of the table is ruled
   * out by a figure the package does state — a plot owned but designated for
   * something other than housing, say.
   *
   * Says which figure ruled out which provision, because the likeliest cause is
   * a figure read wrongly, and the inspector needs to know which one to check.
   */
  static provisionNotCovered(
    ruledOut: readonly {
      readonly provision: string;
      readonly by: readonly CaseParameterKey[];
    }[],
  ): ValidationIssue {
    const reasons = ruledOut
      .map(one => `${one.provision} by ${one.by.join(', ')}`)
      .join('; ');

    return ValidationIssue.of({
      kind: IssueKind.PROVISION_UNDETERMINED,
      message: `No provision of Article 8 covers this case. Ruled out: ${reasons}.`,
    });
  }

  /*
   * A paper the policy confirms through a state system this one does not reach.
   *
   * Filed against the document where there is one, and against the type alone
   * where the policy asks the system instead of the paper — a notification made
   * after 2025 lives in the Urban Planning Committee's system and in no
   * envelope. Never against the package (ADR-0025).
   */
  static integrationNotConnected(
    type: DocumentType,
    source: DocumentSource,
    document: {
      readonly documentId: DocumentId;
      readonly sourceFileId: SourceFileId;
    } | null = null,
  ): ValidationIssue {
    const what = document
      ? `This "${type.value}" is confirmed through ${SOURCE_NAMES[source]}`
      : `For this case the policy takes the "${type.value}" from ` +
        `${SOURCE_NAMES[source]} rather than from the package`;

    return ValidationIssue.of({
      kind: IssueKind.INTEGRATION_NOT_CONNECTED,
      message:
        `${what}, which is not connected to this system: ` +
        `${document ? 'it was read and not confirmed' : 'nothing was checked'}.`,
      documentId: document?.documentId,
      sourceFileId: document?.sourceFileId,
      documentType: type,
    });
  }

  /*
   * The check of authenticity by QR code was skipped: no paper of the package
   * prints a code, so there was nothing to check it with (ADR-0028).
   *
   * Names the papers of the package that could have carried one and did not
   * have one read off them, so the inspector knows which sheet to look at for a
   * code the reader may have missed; filed against no document, because the
   * finding is about the package having none. Never against the package.
   *
   * `carriers` are only those papers no line of their own already says this
   * of: a Decree 439 paper carries it as `archiveQrUnconfirmed` against its own
   * sheet, so the aggregate leaves it out here rather than tell one absence
   * twice (ADR-0032). Empty names the package that carries no paper of a kind
   * that prints a code at all.
   */
  static qrCodeUnavailable(carriers: readonly DocumentType[]): ValidationIssue {
    const named = carriers.map(type => `"${type.value}"`).join(', ');

    return ValidationIssue.of({
      kind: IssueKind.QR_CODE_UNAVAILABLE,
      message:
        'Authenticity was not checked by QR code: there was nothing to check ' +
        'it with.' +
        (carriers.length === 0
          ? ' The package carries no paper whose QR code this system resolves.'
          : ` No code was read off the ${named}.`),
    });
  }

  /*
   * A Decree 439 paper the National Archive Fund's copy does not bear out.
   *
   * Names every line that differs, with both sides, and says so separately when
   * the issuing body had no competence to issue a paper of this kind — the two
   * are different doubts, and a paper can carry either without the other. Filed
   * against the document: the finding is about the paper, and which lines
   * agreed is its `archiveQrCheck` (ADR-0028).
   */
  static archiveQrMismatch(
    document: {
      readonly documentId: DocumentId;
      readonly sourceFileId: SourceFileId;
    },
    type: DocumentType,
    check: ArchiveQrCheck,
  ): ValidationIssue {
    const lines = check.mismatched.map(
      field =>
        `${field.name} reads "${field.documentValue}" and the archive has ` +
        `"${field.archiveValue}"`,
    );
    const reasons = [
      ...(lines.length > 0 ? [lines.join('; ')] : []),
      ...(check.issuingAuthorityCompetent === false
        ? [
            `the body the archive files it under had no competence to issue ` +
              `a "${type.value}"`,
          ]
        : []),
    ];

    return ValidationIssue.of({
      kind: IssueKind.ARCHIVE_QR_MISMATCH,
      message:
        `The National Archive Fund's copy of this "${type.value}", found by ` +
        `its QR reference ${check.qrReference}, does not bear it out: ` +
        `${reasons.join('. Also, ')}.`,
      documentId: document.documentId,
      sourceFileId: document.sourceFileId,
      documentType: type,
    });
  }

  /*
   * A Decree 439 paper the National Archive Fund could not be asked about, or
   * answered nothing for.
   *
   * RegistryUnconfirmed and not a kind of its own: it is the same absence of
   * evidence — an archive whose electronic copies are partial says nothing
   * about a paper by not holding it — and it is told to the inspector and never
   * held against the package (ADR-0028). A paper nobody read a QR code off is
   * here for the same reason: it was not confirmed, and the inspector has to
   * know that rather than read silence as a pass.
   *
   * And this is the only line that says it of such a paper. The package-wide
   * `qrCodeUnavailable` leaves out every paper that has one, so the inspector
   * reads the sheet to open once instead of reading a list of them and then
   * the same papers one by one (ADR-0032).
   */
  static archiveQrUnconfirmed(
    document: {
      readonly documentId: DocumentId;
      readonly sourceFileId: SourceFileId;
    },
    type: DocumentType,
    check: ArchiveQrCheck,
  ): ValidationIssue {
    /*
     * Three absences and three sentences, because they send the inspector to
     * three different places: nothing on the sheet to ask by, nobody here to
     * ask, and an archive that looked and holds nothing (ADR-0034).
     *
     * The third is the only one the archive is the subject of. Saying "the
     * National Archive Fund did not confirm this" of a code issued by the
     * register would be a claim about a search nobody made.
     */
    const message =
      check.status === 'NoQrCode'
        ? `The National Archive Fund did not confirm this "${type.value}": ` +
          'no QR code was decoded off it, so the archive was not asked.'
        : check.status === 'IssuerNotConnected'
          ? `The QR code on this "${type.value}" was decoded and not ` +
            `followed: it is issued by ` +
            `${check.issuer ?? 'a service this system cannot ask'}, which is ` +
            'not connected to this system.'
          : `The National Archive Fund did not confirm this "${type.value}": ` +
            `the archive holds nothing under its QR reference ` +
            `${check.qrReference}.`;

    return ValidationIssue.of({
      kind: IssueKind.REGISTRY_UNCONFIRMED,
      message,
      documentId: document.documentId,
      sourceFileId: document.sourceFileId,
      documentType: type,
    });
  }

  /*
   * The year the office declared when it took the submission in against the
   * year the papers turn out to be dated by.
   *
   * Stated for the record and never against the package: the applicant did not
   * type the declaration, and one side of this is as likely to be wrong as the
   * other — a year is as easy to mistype at a counter as it is to misread off a
   * scan. The engine says the two do not match and says no more than that; who
   * is right is the inspector's to settle.
   *
   * Filed against the reading, with that reading's own confidence, so settling
   * it means opening the sheet the figure was read off. There is no such anchor
   * on the other side — nothing was read at the counter, and there is no sheet
   * to turn to.
   */
  static declaredYearMismatch(
    declaredYear: number,
    readYear: number,
    read: CheckedValue,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.DECLARED_VALUE_MISMATCH,
      message:
        `The year ${declaredYear} declared at intake is not the year this ` +
        `case is dated by: ${read.cited} is dated ${readYear}.`,
      documentId: read.documentId,
      documentType: read.documentType,
      fieldKey: read.fieldKey,
      pageNumber: read.foundOn,
      confidence: read.confidence,
    });
  }

  /*
   * A file sent in against a published gap that turned out to be a different
   * paper.
   *
   * Filed against the file and not only against the document, because the
   * operator's next move is to send that file again: the sheets the reader
   * placed are what they have to look at, and `documentType` carries what was
   * asked for rather than what turned up — the finding is about the gap that is
   * still open (COMM-80).
   */
  static wrongDocumentSupplied(
    sourceFileId: SourceFileId,
    filename: string,
    expected: DocumentType,
    arrived: DocumentType | null,
    documentId: DocumentId | null = null,
  ): ValidationIssue {
    const was = arrived?.isKnown
      ? `was read as "${arrived.value}"`
      : 'could not be placed under any type this profile expects';

    return ValidationIssue.of({
      kind: IssueKind.WRONG_DOCUMENT_SUPPLIED,
      message:
        `"${filename}" was sent in as the "${expected.value}" this package is ` +
        `short of, and ${was}. The package still needs a "${expected.value}".`,
      documentId,
      sourceFileId,
      documentType: expected,
    });
  }

  static lowConfidenceType(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType,
    confidence: Confidence,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.LOW_CONFIDENCE,
      message:
        `The document was placed as "${type.value}" with a confidence of ` +
        `${confidence.value.toFixed(2)}.`,
      documentId,
      sourceFileId,
      documentType: type,
      confidence,
    });
  }

  static lowConfidenceField(
    documentId: DocumentId,
    sourceFileId: SourceFileId,
    type: DocumentType | null,
    fieldKey: FieldKey,
    pageNumber: PageNumber,
    confidence: Confidence,
  ): ValidationIssue {
    return ValidationIssue.of({
      kind: IssueKind.LOW_CONFIDENCE,
      message:
        `"${fieldKey.value}" was read with a confidence of ` +
        `${confidence.value.toFixed(2)}.`,
      documentId,
      sourceFileId,
      documentType: type,
      fieldKey,
      pageNumber,
      confidence,
    });
  }
}
