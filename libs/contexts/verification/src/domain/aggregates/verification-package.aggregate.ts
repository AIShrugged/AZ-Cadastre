import { AggregateRoot } from "@cadastre/kernel";

import {
  type Document,
  type ExtractedField,
  type Page,
  type SourceFile,
} from "../entities/index.js";
import {
  DocumentClassified,
  FieldsExtracted,
  PackageSubmitted,
  PageRecognised,
  ReportCompiled,
  SourceFileSegmented,
  SourceFileSplitIntoPages,
  VerificationCompleted,
  VerificationFailed,
  VerificationStarted,
} from "../events/index.js";
import {
  DocumentNotInPackageException,
  DocumentsMustCoverEverySheetException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  PackageAlreadyFinishedException,
  PackageMustHaveAFileException,
  PackageNotStartableException,
  PackageNotUnderWayException,
  SourceFileAlreadySegmentedException,
  SourceFileMustHaveADocumentException,
  SourceFileNotInPackageException,
  SourceFileNotSplitException,
} from "../exceptions/index.js";
import {
  type Classification,
  Confidence,
  type DocumentId,
  FailureReason,
  type OcrResult,
  PackageId,
  PackageStatus,
  type PageId,
  type RecognisedText,
  type SourceFileId,
  ValidationIssue,
  type VerificationProfile,
  VerificationReport,
} from "../value-objects/index.js";

export type VerificationPackageState = {
  readonly id: PackageId;
  readonly version: number;
  readonly profile: VerificationProfile;
  readonly status: PackageStatus;
  readonly files: readonly SourceFile[];
  readonly documents: readonly Document[];
  readonly report: VerificationReport | null;
};

export class VerificationPackage extends AggregateRoot<PackageId> {
  readonly #profile: VerificationProfile;
  #status: PackageStatus;
  #files: SourceFile[];
  #documents: Document[];
  #report: VerificationReport | null;

  private constructor(state: VerificationPackageState) {
    super(state.id, state.version);
    this.#profile = state.profile;
    this.#status = state.status;
    this.#files = [...state.files];
    this.#documents = [...state.documents];
    this.#report = state.report;
  }

  static create(
    id: PackageId,
    profile: VerificationProfile,
    files: readonly SourceFile[],
  ): VerificationPackage {
    if (files.length === 0) throw new PackageMustHaveAFileException();

    const seen = new Set<string>();
    for (const file of files) {
      if (seen.has(file.storageKey.value)) {
        throw new DuplicateStorageKeyException(file.storageKey.value);
      }
      seen.add(file.storageKey.value);
    }

    const submitted = new VerificationPackage({
      id,
      version: 0,
      profile,
      status: PackageStatus.PENDING,
      files,
      documents: [],
      report: null,
    });

    submitted.apply(new PackageSubmitted(id, profile, files.length));

    return submitted;
  }

  static restore(state: VerificationPackageState): VerificationPackage {
    return new VerificationPackage(state);
  }

  get profile(): VerificationProfile {
    return this.#profile;
  }

  get status(): PackageStatus {
    return this.#status;
  }

  get files(): readonly SourceFile[] {
    return this.#files;
  }

  get documents(): readonly Document[] {
    return this.#documents;
  }

  get report(): VerificationReport | null {
    return this.#report;
  }

  fileWith(sourceFileId: SourceFileId): SourceFile {
    const file = this.#files.find((candidate) =>
      candidate.id.equals(sourceFileId),
    );

    if (!file) {
      throw new SourceFileNotInPackageException(
        sourceFileId.value,
        this.id.value,
      );
    }

    return file;
  }

  documentWith(documentId: DocumentId): Document {
    const document = this.#documents.find((candidate) =>
      candidate.id.equals(documentId),
    );

    if (!document) {
      throw new DocumentNotInPackageException(documentId.value, this.id.value);
    }

    return document;
  }

  documentsIn(sourceFileId: SourceFileId): readonly Document[] {
    return this.#documents.filter((document) => document.isFrom(sourceFileId));
  }

  isSegmented(sourceFileId: SourceFileId): boolean {
    return this.documentsIn(sourceFileId).length > 0;
  }

  textOf(documentId: DocumentId): RecognisedText {
    const document = this.documentWith(documentId);

    return this.fileWith(document.sourceFileId).textIn(document.pages);
  }

  get isFullyProcessed(): boolean {
    const filesRead = this.#files.every(
      (file) => file.isFullyRecognised && this.isSegmented(file.id),
    );

    return (
      filesRead &&
      this.#documents.every(
        (document) =>
          document.isClassified &&
          (document.hasFields || !this.expectsFieldsOf(document)),
      )
    );
  }

  start(): void {
    if (!this.#status.canStart) {
      throw new PackageNotStartableException(this.id.value, this.#status.value);
    }

    this.#status = PackageStatus.PROCESSING;
    this.apply(new VerificationStarted(this.id));
  }

  splitIntoPages(sourceFileId: SourceFileId, pages: readonly Page[]): void {
    this.guardUnderWay();
    const file = this.fileWith(sourceFileId);

    this.replaceFile(file.splitInto(pages));
    this.apply(
      new SourceFileSplitIntoPages(this.id, sourceFileId, pages.length),
    );
  }

  recordRecognition(
    sourceFileId: SourceFileId,
    pageId: PageId,
    ocr: OcrResult,
  ): void {
    this.guardUnderWay();
    const file = this.fileWith(sourceFileId);

    this.replaceFile(file.recognised(pageId, ocr));
    this.apply(new PageRecognised(this.id, sourceFileId, pageId));
  }

  // A file is a container: what the inspector uploaded as one PDF may hold a
  // passport on sheet 1 and a title deed on sheets 2–4. Reading it into its
  // documents happens once, and what is found must account for every sheet — a
  // page belonging to no document would drop out of the report unnoticed.
  segmentIntoDocuments(
    sourceFileId: SourceFileId,
    documents: readonly Document[],
  ): void {
    this.guardUnderWay();
    const file = this.fileWith(sourceFileId);

    if (!file.isSplit) throw new SourceFileNotSplitException(sourceFileId.value);
    if (this.isSegmented(sourceFileId)) {
      throw new SourceFileAlreadySegmentedException(sourceFileId.value);
    }
    if (documents.length === 0) {
      throw new SourceFileMustHaveADocumentException(sourceFileId.value);
    }

    this.guardCoverOf(file, documents);

    this.#documents = [...this.#documents, ...documents];
    this.apply(new SourceFileSegmented(this.id, sourceFileId, documents.length));
  }

  classify(documentId: DocumentId, classification: Classification): void {
    this.guardUnderWay();
    const document = this.documentWith(documentId);

    if (
      classification.isPlaced &&
      !this.#profile.recognises(classification.type)
    ) {
      throw new DocumentTypeNotInProfileException(
        classification.type.value,
        this.#profile.key,
      );
    }

    this.replaceDocument(document.classifiedAs(classification));
    this.apply(new DocumentClassified(this.id, documentId, classification));
  }

  recordExtractedFields(
    documentId: DocumentId,
    fields: readonly ExtractedField[],
  ): void {
    this.guardUnderWay();
    const document = this.documentWith(documentId);
    const classification = document.classification;

    if (classification?.isPlaced) {
      const schema = this.#profile.schemaFor(classification.type);
      for (const field of fields) {
        if (!schema.declares(field.key)) {
          throw new FieldNotInSchemaException(
            field.key.value,
            classification.type.value,
          );
        }
      }
    }

    this.replaceDocument(document.withFields(fields));
    this.apply(new FieldsExtracted(this.id, documentId, fields.length));
  }

  // A run ends by reporting, so finishing compiles one: there is no state in
  // which a package is done and the inspector has nothing to read.
  complete(): void {
    this.guardUnderWay();

    this.compileReport();
    this.#status = PackageStatus.COMPLETED;
    this.apply(new VerificationCompleted(this.id));
  }

  fail(reason: FailureReason): void {
    if (this.#status.isTerminal) {
      throw new PackageAlreadyFinishedException(this.id.value, this.#status.value);
    }

    this.#status = PackageStatus.FAILED;
    this.apply(new VerificationFailed(this.id, reason));
  }

  // Compiled from what the run actually managed to read, however little that
  // was: a document the classifier could not place, a sheet that came back
  // unread and a type nobody supplied are each a finding, never a reason to
  // stop. Worked out from scratch every time, so a re-run cannot leave behind a
  // finding it has since answered.
  private compileReport(): void {
    const issues = [
      ...this.missingDocuments(),
      ...this.unreadable(),
      ...this.lowConfidence(),
    ];

    this.#report = VerificationReport.of(issues);
    this.apply(new ReportCompiled(this.id, this.#report.status, issues.length));
  }

  private missingDocuments(): readonly ValidationIssue[] {
    const placed = this.#documents.flatMap((document) => {
      const classification = document.classification;

      return classification?.isPlaced ? [classification.type] : [];
    });

    return this.#profile.requiredTypes
      .filter((required) => !placed.some((type) => type.equals(required)))
      .map((required) => ValidationIssue.missingDocument(required));
  }

  private unreadable(): readonly ValidationIssue[] {
    const sheets = this.#files.flatMap((file) => [
      ...file.unrecognisedPages.map((page) =>
        ValidationIssue.unreadableSheet(file.id, page.number),
      ),
      // Nothing was carved out of it, so whatever it holds is in no document
      // and reaches no classifier.
      ...(this.isSegmented(file.id) ? [] : [ValidationIssue.unreadableFile(file.id)]),
    ]);

    const documents = this.#documents
      .filter((document) => !document.classification?.isPlaced)
      .map((document) =>
        ValidationIssue.unplacedDocument(
          document.id,
          document.sourceFileId,
          document.pages,
        ),
      );

    return [...sheets, ...documents];
  }

  private lowConfidence(): readonly ValidationIssue[] {
    return this.#documents.flatMap((document) => {
      const classification = document.classification;
      const type = classification?.isPlaced ? classification.type : null;

      const placement =
        classification?.isPlaced &&
        classification.confidence.isBelow(Confidence.FLOOR)
          ? [
              ValidationIssue.lowConfidenceType(
                document.id,
                document.sourceFileId,
                classification.type,
                classification.confidence,
              ),
            ]
          : [];

      const fields = document.fields
        .filter((field) => field.isBelow(Confidence.FLOOR))
        .map((field) =>
          ValidationIssue.lowConfidenceField(
            document.id,
            document.sourceFileId,
            type,
            field.key,
            field.foundOn,
            field.confidence,
          ),
        );

      return [...placement, ...fields];
    });
  }

  private guardCoverOf(file: SourceFile, documents: readonly Document[]): void {
    const refuse = (): never => {
      throw new DocumentsMustCoverEverySheetException(
        file.id.value,
        file.pageCount,
      );
    };

    const ordered = [...documents].sort(
      (left, right) => left.pages.first.value - right.pages.first.value,
    );

    for (const [index, document] of ordered.entries()) {
      if (!document.isFrom(file.id)) refuse();

      const previous = ordered[index - 1];
      const startsWhereItShould = previous
        ? document.pages.follows(previous.pages)
        : document.pages.first.value === 1;

      if (!startsWhereItShould) refuse();
    }

    if (ordered.at(-1)?.pages.last.value !== file.pageCount) refuse();
  }

  private expectsFieldsOf(document: Document): boolean {
    const classification = document.classification;

    if (!classification?.isPlaced) return false;

    return !this.#profile.schemaFor(classification.type).isEmpty;
  }

  private guardUnderWay(): void {
    if (!this.#status.isUnderWay) {
      throw new PackageNotUnderWayException(this.id.value, this.#status.value);
    }
  }

  private replaceFile(file: SourceFile): void {
    this.#files = this.#files.map((candidate) =>
      candidate.id.equals(file.id) ? file : candidate,
    );
  }

  private replaceDocument(document: Document): void {
    this.#documents = this.#documents.map((candidate) =>
      candidate.id.equals(document.id) ? document : candidate,
    );
  }
}
