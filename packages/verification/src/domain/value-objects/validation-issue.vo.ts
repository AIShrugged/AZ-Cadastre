import type { Confidence } from './confidence.vo.js';
import { CrossCheckVerdict } from './cross-check-verdict.vo.js';
import type {
  CheckedValue,
  CrossCheck,
  CrossCheckKey,
} from './cross-check.vo.js';
import { DocumentType as DocumentTypeRef } from './document-type.vo.js';
import type { DocumentType } from './document-type.vo.js';
import type { DocumentId, SourceFileId } from './entity-ids/index.js';
import type { FieldKey } from './field.vo.js';
import { IssueKind } from './issue-kind.vo.js';
import type { PageNumber } from './page-number.vo.js';
import type { PageRange } from './page-range.vo.js';
import type { RegistryCheck, RegistryDocument } from './registry-check.vo.js';
import type {
  RequirementBand,
  SupportingDocumentsSpec,
} from './verification-profile.vo.js';

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
   * What the applicant must bring, for the case this package turned out to be.
   *
   * Filed against the value the branch was decided on, and carrying that
   * reading's own confidence: a set chosen on a height read at 0.4 is a set
   * chosen on a guess, and an inspector settling it opens the sheet the figure
   * was read off. `decidedOn` is in the order the branch read the figures, so
   * the first of them is the one the message is anchored to.
   *
   * Never a finding against the package. None of these papers is in the
   * envelope and none of them was checked — the message says what to bring, and
   * the report's own status is decided without it (ADR-0013).
   */
  static supportingDocuments(
    band: RequirementBand,
    decidedOn: readonly CheckedValue[],
  ): ValidationIssue {
    const [anchor] = decidedOn;
    const read = decidedOn.map(value => value.cited).join(', ');

    return ValidationIssue.of({
      kind: IssueKind.SUPPORTING_DOCUMENTS_REQUIRED,
      message:
        `This case falls under "${band.key}" (${band.bounds})` +
        `${read ? `, read off ${read}` : ''}. The applicant must bring: ` +
        `${band.cited}.`,
      documentId: anchor?.documentId,
      documentType: anchor?.documentType,
      fieldKey: anchor?.fieldKey,
      pageNumber: anchor?.foundOn,
      confidence: ValidationIssue.leastConfidentOf(decidedOn),
    });
  }

  /*
   * The same message where the case could not be placed: because a figure the
   * branch turns on could not be read off the package, or because the profile's
   * bands leave a hole this case fell into.
   *
   * It still names the papers — every set of them, since which one applies is
   * exactly what is unknown. An applicant learning that they must bring one of
   * three sets is better served than one told nothing, and an inspector reading
   * this knows the engine did not check rather than that it checked and was
   * content.
   *
   * Carries no document, no sheet and no confidence, which is what a reader
   * tells it apart by: there was no reading to file it against.
   */
  static supportingDocumentsUndecided(
    spec: SupportingDocumentsSpec,
    read: { readonly metres: number | null; readonly year: number | null },
  ): ValidationIssue {
    const sets = spec.bands
      .map(band => `"${band.key}" (${band.bounds}) — ${band.cited}`)
      .join('; ');

    return ValidationIssue.of({
      kind: IssueKind.SUPPORTING_DOCUMENTS_REQUIRED,
      message:
        `Which supporting documents this case needs could not be decided: ` +
        `${ValidationIssue.whyUndecided(read)}. Whichever it is, the ` +
        `applicant must bring one of these sets: ${sets}.`,
    });
  }

  private static whyUndecided(read: {
    readonly metres: number | null;
    readonly year: number | null;
  }): string {
    if (read.metres === null && read.year === null) {
      return 'neither the height of the building nor the year it is dated by could be read off this package';
    }
    if (read.metres === null) {
      return 'the height of the building could not be read off this package';
    }
    if (read.year === null) {
      return 'the year this case is dated by could not be read off this package';
    }

    return (
      `no band of this profile covers a building of ${read.metres} m dated ` +
      `${read.year}`
    );
  }

  // A set is only as certain as the least certain reading it was chosen on. No
  // reading at all is no claim, which is null rather than a confident nothing.
  private static leastConfidentOf(
    values: readonly CheckedValue[],
  ): Confidence | null {
    return values.reduce<Confidence | null>(
      (lowest, value) =>
        lowest === null || value.confidence.value < lowest.value
          ? value.confidence
          : lowest,
      null,
    );
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
