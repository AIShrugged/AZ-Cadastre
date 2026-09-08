import { AggregateRoot } from '@cadastre/shared';

import {
  type Document,
  type ExtractedField,
  type Page,
  type SourceFile,
} from '../entities/index.js';
import {
  CrossCheckMade,
  DocumentClassified,
  FieldsExtracted,
  PackageSubmitted,
  PageRecognised,
  RegistryCheckMade,
  ReportCompiled,
  SourceFileSegmented,
  SourceFileSplitIntoPages,
  VerificationCompleted,
  VerificationFailed,
  VerificationStarted,
} from '../events/index.js';
import {
  CrossCheckNotInProfileException,
  DocumentNotInPackageException,
  DocumentsMustCoverEverySheetException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  PackageAlreadyFinishedException,
  PackageMustHaveAFileException,
  PackageNotStartableException,
  PackageNotUnderWayException,
  RegistryCheckNotInProfileException,
  SourceFileAlreadySegmentedException,
  SourceFileMustHaveADocumentException,
  SourceFileNotInPackageException,
  SourceFileNotSplitException,
} from '../exceptions/index.js';
import { attestationIn } from '../services/index.js';
import {
  CheckedValue,
  Confidence,
  FailureReason,
  PackageId,
  PackageStatus,
  ValidationIssue,
  VerificationReport,
  type Classification,
  type CrossCheck,
  type CrossCheckKey,
  type CrossCheckSpec,
  type DocumentId,
  type DocumentType,
  type FieldRef,
  type OcrResult,
  type PageId,
  type RecognisedText,
  type RegistryCheck,
  type RegistryCheckKey,
  type RegistryCheckSpec,
  type SourceFileId,
  type VerificationProfile,
} from '../value-objects/index.js';

export type VerificationPackageState = {
  readonly id: PackageId;
  readonly version: number;
  readonly profile: VerificationProfile;
  readonly status: PackageStatus;
  readonly files: readonly SourceFile[];
  readonly documents: readonly Document[];
  readonly crossChecks: readonly CrossCheck[];
  readonly registryChecks: readonly RegistryCheck[];
  readonly report: VerificationReport | null;
};

export class VerificationPackage extends AggregateRoot<PackageId> {
  readonly #profile: VerificationProfile;
  #status: PackageStatus;
  #files: SourceFile[];
  #documents: Document[];
  #crossChecks: CrossCheck[];
  #registryChecks: RegistryCheck[];
  #report: VerificationReport | null;

  private constructor(state: VerificationPackageState) {
    super(state.id, state.version);
    this.#profile = state.profile;
    this.#status = state.status;
    this.#files = [...state.files];
    this.#documents = [...state.documents];
    this.#crossChecks = [...state.crossChecks];
    this.#registryChecks = [...state.registryChecks];
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
      crossChecks: [],
      registryChecks: [],
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

  get crossChecks(): readonly CrossCheck[] {
    return this.#crossChecks;
  }

  get registryChecks(): readonly RegistryCheck[] {
    return this.#registryChecks;
  }

  get report(): VerificationReport | null {
    return this.#report;
  }

  fileWith(sourceFileId: SourceFileId): SourceFile {
    const file = this.#files.find(candidate =>
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
    const document = this.#documents.find(candidate =>
      candidate.id.equals(documentId),
    );

    if (!document) {
      throw new DocumentNotInPackageException(documentId.value, this.id.value);
    }

    return document;
  }

  documentsIn(sourceFileId: SourceFileId): readonly Document[] {
    return this.#documents.filter(document => document.isFrom(sourceFileId));
  }

  isSegmented(sourceFileId: SourceFileId): boolean {
    return this.documentsIn(sourceFileId).length > 0;
  }

  textOf(documentId: DocumentId): RecognisedText {
    const document = this.documentWith(documentId);

    return this.fileWith(document.sourceFileId).textIn(document.pages);
  }

  // The document's own sheets, in order, each as its image and its reading.
  // Page numbers are the file's, which is what a report cites and what the
  // inspector counts to when they open the scan.
  sheetsOf(documentId: DocumentId): readonly Page[] {
    const document = this.documentWith(documentId);

    return this.fileWith(document.sourceFileId).pagesIn(document.pages);
  }

  // Every value one of the profile's checks reaches for, in the order the check
  // names them: the anchor document first, then what it is held against. A type
  // two documents answer to contributes both of them — a package carrying two
  // identity cards has two names to reconcile, not one.
  valuesFor(spec: CrossCheckSpec): readonly CheckedValue[] {
    return spec.references.flatMap(reference => this.valuesOf(reference));
  }

  private valuesOf(reference: FieldRef): readonly CheckedValue[] {
    return this.#documents.flatMap(document => {
      const classification = document.classification;

      if (!classification?.isPlaced) return [];
      if (!classification.type.equals(reference.type)) return [];

      return document.fields
        .filter(field => field.key.equals(reference.key))
        .map(field =>
          CheckedValue.of({
            documentId: document.id,
            documentType: classification.type,
            fieldKey: field.key,
            value: field.value,
            foundOn: field.foundOn,
            confidence: field.confidence,
          }),
        );
    });
  }

  /*
   * What the register is asked about.
   *
   * One value and never a list: a second document answering the same type is a
   * duplicate the report already states, and asking the register twice about
   * one property would only file the finding twice. But *which* value is the
   * profile's ordering, walked until a paper states one — an address is printed
   * on several of the papers and they are not equally trustworthy (ADR-0010).
   */
  askedOf(spec: RegistryCheckSpec): CheckedValue | null {
    for (const subject of spec.subjects) {
      const [value] = this.valuesOf(subject);

      if (value) return value;
    }

    return null;
  }

  statedFor(
    spec: RegistryCheckSpec,
  ): readonly { name: string; value: CheckedValue }[] {
    return spec.attributes.flatMap(attribute => {
      const [value] = this.valuesOf(attribute.ref);

      return value ? [{ name: attribute.name, value }] : [];
    });
  }

  /*
   * Which of the check's papers this package actually carries, and the sheet of
   * it a finding would be filed against.
   *
   * Only the ones that are here. A required type the envelope is missing is
   * already in the report as a missing document, and asking the archive whether
   * it holds the original of a paper nobody submitted would put the same
   * shortfall in the report twice under two names.
   *
   * The anchor is the document's first value, whichever field it is: the
   * finding is about the paper and not about anything printed on it.
   */
  carriedFor(
    spec: RegistryCheckSpec,
  ): readonly { name: string; carried: CheckedValue }[] {
    return spec.documents.flatMap(paper => {
      const [carried] = this.anchorsOf(paper.type);

      return carried ? [{ name: paper.name, carried }] : [];
    });
  }

  private anchorsOf(type: DocumentType): readonly CheckedValue[] {
    return this.#documents.flatMap(document => {
      const classification = document.classification;

      if (!classification?.isPlaced) return [];
      if (!classification.type.equals(type)) return [];

      const [field] = document.fields;

      if (!field) return [];

      return [
        CheckedValue.of({
          documentId: document.id,
          documentType: classification.type,
          fieldKey: field.key,
          value: field.value,
          foundOn: field.foundOn,
          confidence: field.confidence,
        }),
      ];
    });
  }

  // Unlike a cross-check this needs one document and not two: the other side of
  // the comparison is not in the envelope at all.
  canAsk(spec: RegistryCheckSpec): boolean {
    return this.askedOf(spec) !== null;
  }

  hasAsked(key: RegistryCheckKey): boolean {
    return this.#registryChecks.some(check => check.key.equals(key));
  }

  recordRegistryCheck(check: RegistryCheck): void {
    this.guardUnderWay();

    if (!this.#profile.declaresRegistryCheck(check.key)) {
      throw new RegistryCheckNotInProfileException(
        check.key.value,
        this.#profile.key,
      );
    }

    // Replaced rather than added, for the same reason a cross-check is: a
    // re-run asks the register again, and the package holds one answer per
    // check rather than a history of them.
    this.#registryChecks = [
      ...this.#registryChecks.filter(made => !made.key.equals(check.key)),
      check,
    ];
    this.apply(new RegistryCheckMade(this.id, check.key, check.outcome));
  }

  // A check needs two documents to be a cross-document check at all: the
  // surname and the given name on one identity card are not evidence about each
  // other, and a check whose counterpart never arrived is a missing document,
  // which the report already says.
  canMake(spec: CrossCheckSpec): boolean {
    const values = this.valuesFor(spec);

    return new Set(values.map(value => value.documentId.value)).size >= 2;
  }

  hasMade(key: CrossCheckKey): boolean {
    return this.#crossChecks.some(check => check.key.equals(key));
  }

  recordCrossCheck(check: CrossCheck): void {
    this.guardUnderWay();

    if (!this.#profile.declaresCheck(check.key)) {
      throw new CrossCheckNotInProfileException(
        check.key.value,
        this.#profile.key,
      );
    }

    // Replaced rather than added: a re-run reads the same papers again, and the
    // package holds one answer per check, not a history of them.
    this.#crossChecks = [
      ...this.#crossChecks.filter(made => !made.key.equals(check.key)),
      check,
    ];
    this.apply(new CrossCheckMade(this.id, check.key, check.verdict));
  }

  get isFullyProcessed(): boolean {
    const filesRead = this.#files.every(
      file => file.isFullyRecognised && this.isSegmented(file.id),
    );

    return (
      filesRead &&
      this.#documents.every(
        document =>
          document.isClassified &&
          (document.hasFields || !this.expectsFieldsOf(document)),
      ) &&
      this.#profile.crossChecks.every(
        spec => this.hasMade(spec.key) || !this.canMake(spec),
      ) &&
      this.#profile.registryChecks.every(
        spec => this.hasAsked(spec.key) || !this.canAsk(spec),
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

    if (!file.isSplit)
      throw new SourceFileNotSplitException(sourceFileId.value);
    if (this.isSegmented(sourceFileId)) {
      throw new SourceFileAlreadySegmentedException(sourceFileId.value);
    }
    if (documents.length === 0) {
      throw new SourceFileMustHaveADocumentException(sourceFileId.value);
    }

    this.guardCoverOf(file, documents);

    this.#documents = [...this.#documents, ...documents];
    this.apply(
      new SourceFileSegmented(this.id, sourceFileId, documents.length),
    );
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
      throw new PackageAlreadyFinishedException(
        this.id.value,
        this.#status.value,
      );
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
      ...this.disagreements(),
      ...this.unreadable(),
      ...this.lowConfidence(),
      ...this.unattested(),
      ...this.alsoInThePackage(),
      ...this.againstTheRecord(),
    ];

    this.#report = VerificationReport.of(issues);
    this.apply(new ReportCompiled(this.id, this.#report.status, issues.length));
  }

  private missingDocuments(): readonly ValidationIssue[] {
    const placed = this.#documents.flatMap(document => {
      const classification = document.classification;

      return classification?.isPlaced ? [classification.type] : [];
    });

    return this.#profile.requiredTypes
      .filter(required => !placed.some(type => type.equals(required)))
      .map(required => ValidationIssue.missingDocument(required));
  }

  // What the papers of one submission were asked to agree on and did not. A
  // check nobody could decide is here too: the inspector is the one who decides
  // it, and they can only do that if they are told.
  private disagreements(): readonly ValidationIssue[] {
    return this.#crossChecks
      .filter(check => check.needsInspector)
      .map(check => ValidationIssue.crossCheckFailed(check));
  }

  // What the archive register had to say. A record that contradicts the package
  // is a finding against it; a register that held no record, or held two, is
  // told to the inspector and counts for nothing — its coverage is partial, so
  // silence there is not evidence about the submission (ADR-0009).
  private againstTheRecord(): readonly ValidationIssue[] {
    return this.#registryChecks
      .filter(check => check.needsInspector)
      .flatMap(check => {
        if (check.contradicts) return [ValidationIssue.registryMismatch(check)];

        /*
         * One finding per paper the archive does not hold, and not one per
         * check: each is a different original in a different file, and an
         * inspector answering them answers them one at a time.
         */
        if (check.isShortOfPaper) {
          return check.missing.map(document =>
            ValidationIssue.registryDocumentMissing(check, document),
          );
        }

        return [ValidationIssue.registryUnconfirmed(check)];
      });
  }

  private unreadable(): readonly ValidationIssue[] {
    const sheets = this.#files.flatMap(file => [
      ...file.unrecognisedPages.map(page =>
        ValidationIssue.unreadableSheet(file.id, page.number),
      ),
      // Nothing was carved out of it, so whatever it holds is in no document
      // and reaches no classifier.
      ...(this.isSegmented(file.id)
        ? []
        : [ValidationIssue.unreadableFile(file.id)]),
    ]);

    // Only the documents nothing could be made of. One the classifier read and
    // placed outside the profile was not unreadable, and is reported as what it
    // is a few lines below.
    const documents = this.#documents
      .filter(document => {
        const classification = document.classification;

        return !classification?.isPlaced && !classification?.isOutOfProfile;
      })
      .map(document =>
        ValidationIssue.unplacedDocument(
          document.id,
          document.sourceFileId,
          document.pages,
        ),
      );

    return [...sheets, ...documents];
  }

  // What the package turned out to hold beyond the profile's list: documents
  // that are not of a required type, and second documents answering a type
  // already answered. Neither counts against the package — they are here so the
  // inspector can see the whole envelope, not only the parts the engine scores.
  private alsoInThePackage(): readonly ValidationIssue[] {
    const answered = new Set<string>();

    return this.#documents.flatMap(document => {
      const classification = document.classification;

      if (classification?.isOutOfProfile) {
        return [
          ValidationIssue.extraDocument(
            document.id,
            document.sourceFileId,
            document.pages,
          ),
        ];
      }

      if (!classification?.isPlaced) return [];

      const type = classification.type;
      if (!answered.has(type.value)) {
        answered.add(type.value);
        return [];
      }

      return [
        ValidationIssue.duplicateDocument(
          document.id,
          document.sourceFileId,
          type,
          document.pages,
        ),
      ];
    });
  }

  private lowConfidence(): readonly ValidationIssue[] {
    return this.#documents.flatMap(document => {
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
        .filter(field => field.isBelow(Confidence.FLOOR))
        .map(field =>
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

  /*
   * Whether the papers that are only themselves once an office has sealed or
   * signed them show it. The marks are read off the same transcription every
   * other stage reads — the reader is asked to write [stamp: …] and
   * [signature] where it sees one — so this asserts nothing the sheets do not
   * already say, and it asserts it no more strongly than they were read
   * (docs/process-overview.md §5, ADR-0012).
   *
   * One finding per absent mark, not one per document: an inspector confirms a
   * seal and a signature by looking at different parts of the sheet, and
   * answers them one at a time.
   */
  private unattested(): readonly ValidationIssue[] {
    return this.#documents.flatMap(document => {
      const classification = document.classification;
      if (!classification?.isPlaced) return [];

      const spec = this.#profile.specFor(classification.type);
      if (!spec.expectsStamp && !spec.expectsSignature) return [];

      const sheets = this.sheetsOf(document.id);
      // Nothing on the paper was read, so there is nothing to have seen a seal
      // in. The sheets are already reported as unread, and saying a mark is
      // absent from a page nobody read would be a claim about the reading
      // dressed up as a claim about the document.
      if (!sheets.some(sheet => sheet.ocr?.isLegible === true)) return [];

      const confidence = VerificationPackage.leastConfidentOf(sheets);
      const marks = attestationIn(this.textOf(document.id).value);
      const type = classification.type;
      const findings: ValidationIssue[] = [];

      if (spec.expectsStamp) {
        if (marks.stamps.length === 0) {
          findings.push(
            ValidationIssue.unstampedDocument(
              document.id,
              document.sourceFileId,
              type,
              document.pages,
              confidence,
            ),
          );
        } else if (marks.stamps.every(legend => legend === '')) {
          findings.push(
            ValidationIssue.illegibleStamp(
              document.id,
              document.sourceFileId,
              type,
              document.pages,
              confidence,
            ),
          );
        }
      }

      if (spec.expectsSignature && !marks.isSigned) {
        findings.push(
          ValidationIssue.unsignedDocument(
            document.id,
            document.sourceFileId,
            type,
            document.pages,
            confidence,
          ),
        );
      }

      return findings;
    });
  }

  // A mark is only as certain as the reading of the sheets it was looked for
  // on, and a sheet that was never read supports nothing at all — which is
  // unassessed and not "probably fine" (docs/process-overview.md §5).
  private static leastConfidentOf(sheets: readonly Page[]): Confidence {
    return sheets.reduce<Confidence>((lowest, sheet) => {
      const own = sheet.ocr?.confidence ?? Confidence.none();

      return own.value < lowest.value ? own : lowest;
    }, Confidence.of(1));
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
    this.#files = this.#files.map(candidate =>
      candidate.id.equals(file.id) ? file : candidate,
    );
  }

  private replaceDocument(document: Document): void {
    this.#documents = this.#documents.map(candidate =>
      candidate.id.equals(document.id) ? document : candidate,
    );
  }
}
