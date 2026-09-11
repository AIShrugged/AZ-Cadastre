import { AggregateRoot } from '@cadastre/shared';

import {
  ExtractedField,
  type Document,
  type Page,
  type SourceFile,
} from '../entities/index.js';
import {
  ArchiveSearchApprovalSpent,
  ArchiveSearchApproved,
  CrossCheckMade,
  DocumentClassified,
  DocumentSupplied,
  FieldsConfirmedByRegistry,
  FieldsExtracted,
  FieldsGathered,
  FilesAdded,
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
  ArchiveSearchAlreadyApprovedException,
  ArchiveSearchNotAskedException,
  ArchiveSearchNotSettledException,
  CrossCheckNotInProfileException,
  DocumentNotInPackageException,
  DocumentsMustCoverEverySheetException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  LegalBasisNotInProfileException,
  NoSuchDocumentGapException,
  PackageAlreadyFinishedException,
  PackageMustGainAFileException,
  PackageMustHaveAFileException,
  PackageNotStartableException,
  PackageNotTakingFilesException,
  PackageNotUnderWayException,
  RegistryCheckNotInProfileException,
  SourceFileAlreadySegmentedException,
  SourceFileMustHaveADocumentException,
  SourceFileNotInPackageException,
  SourceFileNotSplitException,
  UntargetedSupplyException,
} from '../exceptions/index.js';
import {
  attestationOf,
  gapsIn,
  heightInMetres,
  looksLikeTheSameValue,
  yearIn,
  type DocumentAttestation,
  type DocumentGap,
  type ReadDocument,
} from '../services/index.js';
import {
  ApprovedCheck,
  ArchiveSearchApproval,
  CheckedValue,
  Confidence,
  DeclaredAtIntake,
  FailureReason,
  PackageId,
  PackageStanding,
  PackageStatus,
  ValidationIssue,
  VerificationReport,
  type ApprovalComment,
  type ApprovalSummary,
  type Classification,
  type CrossCheck,
  type CrossCheckKey,
  type CrossCheckSpec,
  type DocumentId,
  type DocumentType,
  type DocumentTypeSpec,
  type FieldKey,
  type FieldRef,
  type OcrResult,
  type PageId,
  type RecognisedText,
  type RegistryCheck,
  type RegistryCheckKey,
  type RegistryCheckSpec,
  type SourceFileId,
  type SupplyTarget,
  type SupportingDocumentsSpec,
  type VerificationProfile,
} from '../value-objects/index.js';

export type VerificationPackageState = {
  readonly id: PackageId;
  readonly version: number;
  readonly profile: VerificationProfile;
  // What the office declared when it took the submission in. Held apart from
  // everything the pipeline read, and never merged with it.
  readonly declared: DeclaredAtIntake;
  readonly status: PackageStatus;
  readonly files: readonly SourceFile[];
  readonly documents: readonly Document[];
  readonly crossChecks: readonly CrossCheck[];
  readonly registryChecks: readonly RegistryCheck[];
  // The approval of the archive search that is in force, if one is. The ones a
  // later run spent are kept by the register for the record and are of no
  // interest to the aggregate: only an approval in force decides anything
  // (ADR-0016).
  readonly archiveSearchApproval: ArchiveSearchApproval | null;
  readonly report: VerificationReport | null;
};

export class VerificationPackage extends AggregateRoot<PackageId> {
  readonly #profile: VerificationProfile;
  readonly #declared: DeclaredAtIntake;
  #status: PackageStatus;
  #files: SourceFile[];
  #documents: Document[];
  #crossChecks: CrossCheck[];
  #registryChecks: RegistryCheck[];
  #archiveSearchApproval: ArchiveSearchApproval | null;
  #report: VerificationReport | null;

  private constructor(state: VerificationPackageState) {
    super(state.id, state.version);
    this.#profile = state.profile;
    this.#declared = state.declared;
    this.#status = state.status;
    this.#files = [...state.files];
    this.#documents = [...state.documents];
    this.#crossChecks = [...state.crossChecks];
    this.#registryChecks = [...state.registryChecks];
    this.#archiveSearchApproval = state.archiveSearchApproval;
    this.#report = state.report;
  }

  static create(
    id: PackageId,
    profile: VerificationProfile,
    files: readonly SourceFile[],
    // What the office declared at the counter. Last and defaulted, because a
    // submission that declares nothing is the ordinary one: intake may know
    // neither figure, and nothing about the run depends on it being told.
    declared: DeclaredAtIntake = DeclaredAtIntake.none(),
  ): VerificationPackage {
    if (files.length === 0) throw new PackageMustHaveAFileException();

    VerificationPackage.guardOneObjectEach(files);
    VerificationPackage.guardDeclaredGround(profile, declared);

    const submitted = new VerificationPackage({
      id,
      version: 0,
      profile,
      declared,
      status: PackageStatus.PENDING,
      files,
      documents: [],
      crossChecks: [],
      registryChecks: [],
      archiveSearchApproval: null,
      report: null,
    });

    submitted.apply(new PackageSubmitted(id, profile, files.length));

    return submitted;
  }

  static restore(state: VerificationPackageState): VerificationPackage {
    return new VerificationPackage(state);
  }

  /*
   * A ground the chosen profile does not register is refused, and the refusal
   * names the grounds it does.
   *
   * Not a second-guessing of the operator's choice of profile — that choice is
   * theirs and this never overrules it. It is the two halves of one statement
   * contradicting each other: a case founded on a paper this policy does not
   * register is a case this policy cannot verify, and taking it in would file
   * a submission nobody could act on and tell nobody. `GET /profiles/
   * suggestion` is where an operator finds out which profile does register it,
   * before they get here.
   *
   * Checked when a submission is taken in and never again. A profile that stops
   * registering a ground does not make the packages already filed under it
   * unreadable — the declaration is what was said at the counter, and it stays
   * true of that submission — which is why `restore` does not run this.
   */
  private static guardDeclaredGround(
    profile: VerificationProfile,
    declared: DeclaredAtIntake,
  ): void {
    const basis = declared.legalBasis;

    if (basis === null) return;
    if (profile.intake.registers(basis)) return;

    throw new LegalBasisNotInProfileException(
      basis.value,
      profile.key,
      profile.intake.grounds.map(ground => ground.value),
    );
  }

  get profile(): VerificationProfile {
    return this.#profile;
  }

  /*
   * What the office declared when it took this submission in — a source of
   * facts of its own, standing beside what the pipeline read and never folded
   * into it.
   *
   * Fixed at submission and never edited afterwards. A package's declaration is
   * what was said when it was taken in, and a screen that let it be corrected
   * later would make the record say something nobody said at the counter.
   */
  get declared(): DeclaredAtIntake {
    return this.#declared;
  }

  get status(): PackageStatus {
    return this.#status;
  }

  /*
   * Where this submission stands: what has to happen to it next, which is
   * neither where the pipeline got to (`status`) nor what the run found
   * (`report`). Read off the three of them together and never held as state of
   * its own, so it cannot be stale (ADR-0014).
   */
  get standing(): PackageStanding {
    return PackageStanding.of({
      status: this.#status,
      report: this.#report?.status ?? null,
      // What the register was actually asked, not what the profile declares: a
      // check whose address no sheet stated was never put, and there is no
      // answer to it for anybody to sign off.
      askedTheArchive: this.#registryChecks.length > 0,
      // An approval in force and not merely one that was once given: a run that
      // asked the register again spends the one it had (ADR-0016).
      archiveSearchApproved: this.#archiveSearchApproval !== null,
    });
  }

  get files(): readonly SourceFile[] {
    return this.#files;
  }

  get documents(): readonly Document[] {
    return this.#documents;
  }

  /*
   * The documents that speak for this package.
   *
   * A document a later arrival replaced stays in `documents` and stays
   * readable, and is absent from here: what the report is compiled from, what
   * the cross-document checks weigh, what the register is asked about and what
   * names the case are all read off the papers in force (COMM-80). Everything
   * that addresses a document by its id — `documentWith`, the segmentation
   * stage, the classifier — goes on seeing all of them, because a replaced
   * document is still a document of this package.
   */
  get documentsInForce(): readonly Document[] {
    return this.#documents.filter(document => document.isInForce);
  }

  /*
   * What this package will take a document for, and why.
   *
   * The server's own answer, published so a screen can draw exactly the uploads
   * that will be accepted — `supplyDocument` refuses anything that is not on
   * this list, so the two cannot drift apart. The rule itself is a domain
   * service, because the read side answers the same question off rows without
   * ever loading the aggregate, and one rule with two implementations is two
   * rules (COMM-80).
   */
  get gaps(): readonly DocumentGap[] {
    return gapsIn(this.#profile, this.#documents.map(asRead));
  }

  get crossChecks(): readonly CrossCheck[] {
    return this.#crossChecks;
  }

  get registryChecks(): readonly RegistryCheck[] {
    return this.#registryChecks;
  }

  // The approval of the archive search that is in force, or none. An approval a
  // later run spent is not here: the aggregate holds what is true of the
  // package now, and the record of what was signed for and when it was spent is
  // the register's (ADR-0016).
  get archiveSearchApproval(): ArchiveSearchApproval | null {
    return this.#archiveSearchApproval;
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

  /*
   * Every reading of one of the profile's field references the package holds.
   *
   * Readings and not values: a field carried over from another paper of this
   * package is not this paper stating anything, and letting one in here would
   * put it on both sides of every rule that reads this — a cross-check would
   * compare a value with its own source and always agree, and the register
   * would be asked about an address no sheet of the document it is filed
   * against prints.
   */
  private valuesOf(reference: FieldRef): readonly CheckedValue[] {
    return this.documentsInForce.flatMap(document => {
      const classification = document.classification;

      if (!classification?.isPlaced) return [];
      if (!classification.type.equals(reference.type)) return [];

      return document.fieldsReadHere.flatMap(field =>
        field.key.equals(reference.key) && field.foundOn
          ? [
              CheckedValue.of({
                documentId: document.id,
                documentType: classification.type,
                fieldKey: field.key,
                value: field.value,
                foundOn: field.foundOn,
                confidence: field.confidence,
              }),
            ]
          : [],
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
    return this.firstStated(spec.subjects);
  }

  // The first of an ordered list of places a value is printed that this package
  // actually states. Shared by every rule that reads one figure off whichever
  // of several papers carries it, because the ordering is the profile's and the
  // walk is always the same.
  private firstStated(references: readonly FieldRef[]): CheckedValue | null {
    for (const reference of references) {
      const [value] = this.valuesOf(reference);

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
    return this.documentsInForce.flatMap(document => {
      const classification = document.classification;

      if (!classification?.isPlaced) return [];
      if (!classification.type.equals(type)) return [];

      // Read off this paper, for the reason `valuesOf` takes only readings:
      // the anchor is what says the package carries this document, and a value
      // carried in from elsewhere says nothing of the kind.
      const field = document.fieldsReadHere.find(one => one.foundOn !== null);

      if (!field?.foundOn) return [];

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
    // A fresh answer from the register spends whatever was signed for the last
    // one: the approval covered the state of the search, and this is a
    // different state of it (ADR-0016).
    this.spendArchiveSearchApproval();
    this.apply(new RegistryCheckMade(this.id, check.key, check.outcome));
  }

  /**
   * A person's sign-off on what the archive register answered about this
   * submission.
   *
   * The decision is about the submission and never about the register: the
   * register states what its own fonds hold and passes no judgement on anybody's
   * application (ADR-0009), and this says a person has read those answers and
   * accepts what they mean here.
   *
   * Refused while a run is still free to replace those answers, and refused
   * where the register was never asked — approving a search nobody made would
   * settle a submission on the strength of nothing. Refused, too, when one is
   * already in force: an approval is an event and not a draft, and the way it
   * ends is that the search is made again.
   */
  approveArchiveSearch(
    summary: ApprovalSummary,
    comment: ApprovalComment | null,
  ): void {
    if (!this.#status.equals(PackageStatus.COMPLETED)) {
      throw new ArchiveSearchNotSettledException(
        this.id.value,
        this.#status.value,
      );
    }
    if (this.#registryChecks.length === 0) {
      throw new ArchiveSearchNotAskedException(this.id.value);
    }
    if (this.#archiveSearchApproval) {
      throw new ArchiveSearchAlreadyApprovedException(this.id.value);
    }

    this.#archiveSearchApproval = ArchiveSearchApproval.of({
      summary,
      comment,
      // What was approved, and not merely that something was: an approval the
      // checks have since outrun is then readable rather than only marked
      // spent.
      checks: this.#registryChecks.map(check =>
        ApprovedCheck.of(check.key, check.outcome),
      ),
    });
    this.apply(new ArchiveSearchApproved(this.id, this.#registryChecks.length));
  }

  /*
   * The one way an approval ends. Every path that changes what the archive
   * answered about this package goes through here, and a path that grows later
   * and does not is the bug this exists to prevent: an approval left standing
   * over answers nobody has read says a person signed for something they never
   * saw (ADR-0016).
   */
  private spendArchiveSearchApproval(): void {
    if (!this.#archiveSearchApproval) return;

    this.#archiveSearchApproval = null;
    this.apply(new ArchiveSearchApprovalSpent(this.id));
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
      this.documentsInForce.every(
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

  /*
   * Files that reached the package after it was submitted: the document the
   * report said was missing, or a readable scan of a sheet nobody could read.
   *
   * They join this package rather than starting a second one. What the
   * inspector holds is one submission, and two half-packages would be two
   * reports neither of which describes it.
   *
   * A package that had already been reported on is re-opened by this, and
   * everything worked out *across* the package goes with the report: the
   * cross-document checks and the register's answers were made over an envelope
   * that has since changed, and a report compiled from them would be a report
   * about a package nobody submitted. What was read off each file on its own —
   * its sheets, their text, the documents carved out of them — stands, because
   * another file arriving does not change what this one says. That is what
   * makes the fresh run cheap: it re-reads nothing it has already read
   * (ADR-0013).
   */
  addFiles(files: readonly SourceFile[]): void {
    this.takeIn(files);
    this.apply(new FilesAdded(this.id, files.length));
  }

  /*
   * One file, sent in for one of the holes this package publishes.
   *
   * The difference from `addFiles` is the whole point of it, and it is why this
   * is an operation of its own rather than a target bolted onto that one: a
   * file here answers something. It names the paper it is meant to be and, when
   * it replaces a scan that was read badly, the document it is sent in place of
   * — and both are checked here, against the gaps the package publishes, so
   * that a screen drawing its buttons off that list can never offer an upload
   * this would refuse. `addFiles` stays what it is: more of the envelope,
   * answering nothing in particular, any number of files at once.
   *
   * What is *not* decided here is whether the paper really is what it was sent
   * in as. Nothing has read it yet — that is the run's answer, and it comes out
   * of the classification stage, where a target that was not met is refused and
   * the report says so (`refusedSupplies`). Refusing at this point would mean
   * reading the file inside the call that uploaded it.
   *
   * Everything else is `addFiles`: the package re-opens, the answers worked out
   * across it are discarded, and the run that follows re-reads nothing it has
   * already read (ADR-0013).
   */
  supplyDocument(file: SourceFile): void {
    const target = file.suppliedFor;

    // The file carries what it answers, because that is what has to survive to
    // the run and into the database. One with no target is not a supply at all
    // — it is `addFiles` with one file — and taking it in here would put a file
    // in the package that nothing will ever hold to anything.
    if (!target) throw new UntargetedSupplyException(this.id.value);

    // Before anything is changed: a refusal must leave the package exactly as
    // it was, not as one that has discarded its report over a file it declined.
    this.guardPublishesGapFor(target);
    this.takeIn([file]);

    this.apply(
      new DocumentSupplied(
        this.id,
        file.id,
        target.expectedType,
        target.replaces?.value ?? null,
      ),
    );
  }

  /*
   * The gaps are the offer and the whole of what will be taken.
   *
   * A target that is not among them is one of two things, and neither may be
   * let through: a screen offering an upload the package has no room for, or a
   * replacement of a document that is no longer in force — sent twice, or sent
   * against a list the operator has been looking at since before the last run.
   */
  private guardPublishesGapFor(target: SupplyTarget): void {
    const replaces = target.replaces;
    const offered = this.gaps.some(
      gap =>
        gap.expectedType.equals(target.expectedType) &&
        (replaces === null
          ? gap.documentId === null
          : gap.documentId === replaces.value),
    );

    if (offered) return;

    throw new NoSuchDocumentGapException(
      this.id.value,
      target.expectedType.value,
      replaces?.value ?? null,
    );
  }

  // What both ways in have in common: the package takes the files and re-opens,
  // and everything that was worked out across it goes (ADR-0013).
  private takeIn(files: readonly SourceFile[]): void {
    if (files.length === 0) {
      throw new PackageMustGainAFileException(this.id.value);
    }

    if (!this.#status.takesMoreFiles) {
      throw new PackageNotTakingFilesException(
        this.id.value,
        this.#status.value,
      );
    }

    VerificationPackage.guardOneObjectEach(files, this.#files);

    this.#files = [...this.#files, ...files];
    this.#crossChecks = [];
    this.#registryChecks = [];
    this.#report = null;
    this.#status = PackageStatus.PENDING;
    // The archive search went with them, so anything signed for it is spent:
    // what was approved is no longer what the package holds (ADR-0016).
    this.spendArchiveSearchApproval();
  }

  // Two files pointing at one object are one file counted twice: a package that
  // held both would report a document it does not have.
  private static guardOneObjectEach(
    files: readonly SourceFile[],
    already: readonly SourceFile[] = [],
  ): void {
    const seen = new Set(already.map(file => file.storageKey.value));

    for (const file of files) {
      if (seen.has(file.storageKey.value)) {
        throw new DuplicateStorageKeyException(file.storageKey.value);
      }
      seen.add(file.storageKey.value);
    }
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
    this.settleSupplyOf(document, classification);
    this.apply(new DocumentClassified(this.id, documentId, classification));
  }

  /*
   * The moment a file sent in for a gap is answered, or is not.
   *
   * Here and not in `supplyDocument`, because this is the first point at which
   * anything has read the paper: what was sent in is settled by what the
   * classifier made of it and by nothing else.
   *
   * Answered, and the document it was sent in place of goes out of force with
   * the stamp of what replaced it and when. It is never deleted — a submission
   * is evidence and not a working draft, the same principle that keeps a
   * machine reading on file once a better one exists — and every rule that says
   * what the package states reads `documentsInForce` instead (COMM-80).
   *
   * Not answered, and nothing happens here at all: the replaced document stays
   * in force, the gap stays open, and the report says what was sent and what it
   * turned out to be (`refusedSupplies`).
   */
  private settleSupplyOf(
    document: Document,
    classification: Classification,
  ): void {
    const target = this.fileWith(document.sourceFileId).suppliedFor;
    const replaces = target?.replaces;

    if (!target || !replaces) return;
    if (!classification.isPlaced) return;
    if (!target.isAnsweredBy(classification.type)) return;

    const replaced = this.#documents.find(
      candidate => candidate.id.equals(replaces) && candidate.isInForce,
    );

    if (!replaced) return;

    this.replaceDocument(replaced.supersededBy(document.id, new Date()));
    // The values other papers had borrowed from it go with it: a carried-over
    // value is nothing but a pointer at the reading behind it, and the next run
    // gathers again off the paper that is now in force (ADR-0023).
    this.#documents = this.#documents.map(candidate =>
      candidate.withoutValuesFrom(replaced.id),
    );
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

  /*
   * Lay the archive register's agreement onto the readings it agreed with.
   *
   * The register is asked about attributes of the property — the owner of
   * record, the cadastral number, the surveyed area — and the answer has until
   * now lived only on the check. But the answer is *about* a field somebody
   * read off a paper, and an inspector reading that field has no way to see
   * that a source outside the envelope holds the same thing. That is a fact
   * worth having beside the value and not two screens away.
   *
   * Only agreement is recorded. A record that says something else is already
   * `RegistryMismatch` and a register that says nothing is silence — neither
   * needs a second way of being said, and marking a field "differs" would put
   * the same finding in the report twice under two names (ADR-0023).
   */
  confirmAgainstTheRecord(): readonly {
    readonly documentId: DocumentId;
    readonly fieldKey: FieldKey;
  }[] {
    this.guardUnderWay();

    const agreed = this.#registryChecks.flatMap(check =>
      check.attributes
        .filter(attribute => attribute.agrees)
        .map(attribute => attribute.submitted),
    );
    const confirmed: { documentId: DocumentId; fieldKey: FieldKey }[] = [];

    for (const document of this.documentsInForce) {
      const keys = agreed
        .filter(value => value.isFrom(document.id))
        .map(value => value.fieldKey)
        .filter(key =>
          document.fieldsReadHere.some(field => field.key.equals(key)),
        );

      if (keys.length === 0) continue;

      this.replaceDocument(document.withConfirmed(keys));
      confirmed.push(
        ...keys.map(fieldKey => ({ documentId: document.id, fieldKey })),
      );
    }

    if (confirmed.length > 0) {
      this.apply(new FieldsConfirmedByRegistry(this.id, confirmed.length));
    }

    return confirmed;
  }

  /*
   * Close the fields a paper did not yield with the value another paper of the
   * package states.
   *
   * The address of the property is printed on five of this profile's papers. If
   * the sketch design's line went unread, the engine used to leave the field
   * absent — while the same address stood legibly on the plan-scheme, read, and
   * sitting in the same envelope. The inspector saw a blank where the system
   * had the answer.
   *
   * What counts as "the same value on another paper" is the profile's
   * cross-checks and nothing else: they already say which [document type,
   * field] pairs print one value, and they already say what agreeing means. A
   * second list of the same thing beside the first is how the two come to
   * disagree. A check that composes several fields of one paper is not such a
   * map and is refused — `CrossCheckSpec.isOneValueAcrossPapers` is where that
   * is decided.
   *
   * Nothing is chosen between: where the papers that state the value do not
   * speak with one voice, the field stays empty. That case is `FieldMismatch`,
   * the report already says it, and replacing a disagreement with a guess would
   * make the report read better than the package is (ADR-0023).
   */
  gatherFromThePackage(): readonly {
    readonly documentId: DocumentId;
    readonly documentType: DocumentType;
    readonly field: ExtractedField;
  }[] {
    this.guardUnderWay();

    const gathered: {
      documentId: DocumentId;
      documentType: DocumentType;
      field: ExtractedField;
    }[] = [];

    for (const document of this.documentsInForce) {
      const classification = document.classification;

      if (!classification?.isPlaced) continue;

      const type = classification.type;
      const carried = this.#profile.schemaFor(type).specs.flatMap(spec => {
        // Anything already here answers the field, whatever its origin: a
        // reading is what the paper says, and a value gathered by an earlier
        // run is not gathered twice.
        if (document.fields.some(field => field.key.equals(spec.key))) {
          return [];
        }

        const read = this.statedElsewhere(document.id, type, spec.key);

        return read ? [ExtractedField.takenFrom(spec.key, read)] : [];
      });

      if (carried.length === 0) continue;

      this.replaceDocument(document.withGathered(carried));
      gathered.push(
        ...carried.map(field => ({
          documentId: document.id,
          documentType: type,
          field,
        })),
      );
    }

    if (gathered.length > 0) {
      this.apply(new FieldsGathered(this.id, gathered.length));
    }

    return gathered;
  }

  /*
   * The reading elsewhere in the package that may close this field, or none.
   *
   * Which source, where there are several, is decided and not stumbled on: the
   * surest reading first, and where two were read equally well the order the
   * profile names the papers in — that order is already an ordering by trust
   * (the plan-scheme was written by the office that surveyed the parcel; the
   * application is filled in by hand), and it is the same one a registry
   * check's subject is walked in.
   */
  private statedElsewhere(
    documentId: DocumentId,
    type: DocumentType,
    key: FieldKey,
  ): CheckedValue | null {
    for (const spec of this.#profile.crossChecks) {
      if (!spec.isOneValueAcrossPapers) continue;
      if (!spec.wants(type, key)) continue;

      const candidates = spec.references.flatMap((reference, order) =>
        this.valuesOf(reference)
          .filter(value => !value.isFrom(documentId))
          .map(value => ({ value, order })),
      );

      if (candidates.length === 0) continue;
      if (
        !this.agreesWithItselfOn(
          spec,
          candidates.map(one => one.value),
        )
      ) {
        continue;
      }

      const [best] = [...candidates].sort(
        (left, right) =>
          right.value.confidence.value - left.value.confidence.value ||
          left.order - right.order,
      );

      if (best) return best.value;
    }

    return null;
  }

  /*
   * Whether the papers that state this value say one thing.
   *
   * The cross-check's own verdict answers it wherever there is one: that is the
   * profile's `agreesWhen` as the reader applied it, and re-deciding it here
   * would be a second opinion nobody asked for. There is none when only one
   * paper states the value — a check needs two documents to be a check — and
   * then the engine's own rule decides, unanimously: a single reading agrees
   * with itself, and several that do not read alike are a disagreement this
   * must not resolve.
   */
  private agreesWithItselfOn(
    spec: CrossCheckSpec,
    candidates: readonly CheckedValue[],
  ): boolean {
    const made = this.#crossChecks.find(check => check.key.equals(spec.key));

    if (made) return made.verdict.agrees;

    const [first, ...rest] = candidates;

    if (!first) return false;

    return rest.every(other =>
      looksLikeTheSameValue(first.value.value, other.value.value),
    );
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
      ...this.againstTheDeclaration(),
      ...this.supportingDocuments(),
      ...this.refusedSupplies(),
    ];

    this.#report = VerificationReport.of(issues);
    this.apply(new ReportCompiled(this.id, this.#report.status, issues.length));
  }

  private missingDocuments(): readonly ValidationIssue[] {
    const placed = this.documentsInForce.flatMap(document => {
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

  /*
   * What the applicant must bring beyond the envelope, and which of the
   * profile's sets this case needs.
   *
   * Stated on every report the profile declares a branch on, decided or not.
   * That is the point of it: the message is about what happens next, not about
   * what arrived, and a case whose height nobody could read still has papers to
   * bring. Where the branch could not be decided the report says so and names
   * every set, which is a different thing from a report that decided and is
   * content — and the two must not read alike (ADR-0013).
   *
   * Never held against the package: the thresholds are read off the papers, not
   * checked against them, and none of the papers named is in the envelope.
   */
  private supportingDocuments(): readonly ValidationIssue[] {
    return this.#profile.supportingDocuments.map(spec => {
      const stated = this.figuresFor(spec);
      const band = spec.bandFor(stated.metres, stated.year);

      return band
        ? ValidationIssue.supportingDocuments(
            band,
            stated.decidedOn,
            stated.yearFromDeclaration ? stated.year : null,
          )
        : ValidationIssue.supportingDocumentsUndecided(spec, stated);
    });
  }

  /*
   * What the office declared when it took the submission in, against what the
   * papers turned out to say.
   *
   * A finding of its own and not a cross-check: a cross-check holds two
   * readings of one submission against each other, and one side of this was
   * typed at a counter and read off nothing. It is stated for the record and
   * never against the package — the applicant did not write the declaration,
   * and neither side of the disagreement is presumed right.
   *
   * Only where both exist. A declaration nothing contradicts is silence, and a
   * package whose papers state no year at all is a package the declaration was
   * useful for rather than one it disagrees with.
   */
  private againstTheDeclaration(): readonly ValidationIssue[] {
    const declaredYear = this.#declared.builtYear;

    if (declaredYear === null) return [];

    // Two branches that read the year off the same field is one disagreement
    // and not two: the finding is about a reading, and there is one reading.
    const said = new Set<string>();

    return this.#profile.supportingDocuments.flatMap(spec => {
      const dated = this.firstStated(spec.builtIn);
      const readYear = dated ? yearIn(dated.value.value) : null;

      if (!dated || readYear === null || readYear === declaredYear) return [];

      const at = `${dated.documentId.value}:${dated.fieldKey.value}`;

      if (said.has(at)) return [];

      said.add(at);

      return [
        ValidationIssue.declaredYearMismatch(declaredYear, readYear, dated),
      ];
    });
  }

  /*
   * The two figures the branch turns on, each off the first paper of the
   * profile's ordering that states it, and the readings they came from — kept
   * so the message can be filed against a sheet the inspector can open.
   *
   * The year falls back to what the office declared at intake where no paper of
   * this package states one, and only there: a figure printed on a paper is
   * what the case actually rests on, and a declaration is what somebody said
   * about it. Where both exist and disagree, the branch still reads the paper
   * and the report says separately that the two do not match — the decision and
   * the disagreement are two different things to tell an inspector, and folding
   * them into one would leave a band chosen on a figure nobody stands behind.
   *
   * There is no such fallback for the height: nothing is declared about it at
   * intake, which is why a case whose sketch design went unread is still a case
   * whose band could not be decided.
   */
  private figuresFor(spec: SupportingDocumentsSpec): {
    readonly metres: number | null;
    readonly year: number | null;
    readonly yearFromDeclaration: boolean;
    readonly decidedOn: readonly CheckedValue[];
  } {
    const height = this.firstStated(spec.height);
    const dated = this.firstStated(spec.builtIn);
    const metres = height ? heightInMetres(height.value.value) : null;
    const readYear = dated ? yearIn(dated.value.value) : null;
    const year = readYear ?? this.#declared.builtYear;

    // Only the readings a figure actually came out of. A field that was read
    // and could not be understood as a height told the branch nothing, and
    // anchoring the message to it would point the inspector at a value that
    // decided none of this. A year taken off the declaration is not a reading
    // at all and has no sheet to name.
    const decidedOn = [
      metres === null ? null : height,
      readYear === null ? null : dated,
    ].filter((value): value is CheckedValue => value !== null);

    return {
      metres,
      year,
      yearFromDeclaration: readYear === null && year !== null,
      decidedOn,
    };
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
    const documents = this.documentsInForce
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

    return this.documentsInForce.flatMap(document => {
      const classification = document.classification;

      if (classification?.isOutOfProfile) {
        return [
          ValidationIssue.extraDocument(
            document.id,
            document.sourceFileId,
            document.pages,
            classification.knownAs,
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

  /*
   * A file sent in for a particular hole in the package that turned out to be a
   * different paper.
   *
   * The alternative was silence: the file would have been taken in as one more
   * document of the envelope, the gap it was sent for would have stayed open,
   * and nothing anywhere would have connected the two. An operator who attached
   * the wrong scan would see the hole still there and no reason for it.
   *
   * Only once the run has placed what it read. A file whose documents are not
   * classified yet has not been refused — it has not been answered — and a file
   * nothing could be carved out of is already in the report as a file that
   * could not be read, which is the truer thing to say about it.
   */
  private refusedSupplies(): readonly ValidationIssue[] {
    return this.#files.flatMap(file => {
      const target = file.suppliedFor;

      if (!target) return [];

      const carved = this.documentsIn(file.id);

      if (carved.length === 0) return [];
      if (!carved.every(document => document.isClassified)) return [];

      const answered = carved.some(document => {
        const classification = document.classification;

        return (
          classification?.isPlaced === true &&
          target.isAnsweredBy(classification.type)
        );
      });

      if (answered) return [];

      // The first paper the reader made of the file: the sheets an operator
      // opens to see what they actually attached.
      const [arrived] = carved;

      return [
        ValidationIssue.wrongDocumentSupplied(
          file.id,
          file.filename.value,
          target.expectedType,
          arrived?.classification?.type ?? null,
          arrived?.id ?? null,
        ),
      ];
    });
  }

  private lowConfidence(): readonly ValidationIssue[] {
    return this.documentsInForce.flatMap(document => {
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

      /*
       * Only what was read off this paper. A finding here says a reading was
       * doubtful and sends the inspector to the sheet it was made on; a value
       * carried over from another document of the package was not read here at
       * all, and the reading behind it is already reported against the document
       * it was made on. Filing it twice would put an inspector in front of a
       * paper on which there is nothing to look at, under the same heading as
       * the papers where there is.
       */
      const fields = document.fieldsReadHere.flatMap(field =>
        field.foundOn && field.isBelow(Confidence.FLOOR)
          ? [
              ValidationIssue.lowConfidenceField(
                document.id,
                document.sourceFileId,
                type,
                field.key,
                field.foundOn,
                field.confidence,
              ),
            ]
          : [],
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
    return this.documentsInForce.flatMap(document => {
      const classification = document.classification;
      if (!classification?.isPlaced) return [];

      const spec = this.#profile.specFor(classification.type);
      if (!spec.expectsStamp && !spec.expectsSignature) return [];

      const attestation = this.marksOn(document, spec);
      // The figure both marks carry, and null only where neither was looked at
      // — a state no branch below files anything on.
      const confidence = Confidence.of(attestation.stamp.confidence ?? 0);
      const type = classification.type;
      const findings: ValidationIssue[] = [];

      // `Unread` falls through both: nothing on the paper was read, so there
      // was nothing to have seen a seal in, and the sheets are already reported
      // as unread on their own account.
      if (spec.expectsStamp) {
        if (attestation.stamp.state === 'Absent') {
          findings.push(
            ValidationIssue.unstampedDocument(
              document.id,
              document.sourceFileId,
              type,
              document.pages,
              confidence,
            ),
          );
        } else if (attestation.stamp.state === 'Illegible') {
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

      if (spec.expectsSignature && attestation.signature.state === 'Absent') {
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

  /*
   * What the document's sheets say about the seal and the signature, held
   * against what its type is expected to carry.
   *
   * The answer is not the report's alone — an inspector is shown the marks that
   * are there as well as the ones that are not — so the rule lives in a domain
   * service the detail query reads too, and the report never decides it here
   * (COMM-76).
   */
  private marksOn(
    document: Document,
    spec: DocumentTypeSpec,
  ): DocumentAttestation {
    return attestationOf(
      this.sheetsOf(document.id).map(sheet => ({
        text: sheet.ocr?.text.value ?? '',
        confidence: sheet.ocr?.confidence.value ?? 0,
      })),
      spec,
    );
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

/**
 * A document as the gap rule needs to see it.
 *
 * Only what was read off the paper itself: a value carried over from elsewhere
 * in the package says the envelope is consistent and says nothing about this
 * scan, so it neither answers a field the profile asked for nor doubts one
 * (ADR-0023). That is the whole reason this mapping exists rather than the rule
 * taking the entity — the read side answers the same question off rows, and it
 * has to answer it the same way.
 */
function asRead(document: Document): ReadDocument {
  const classification = document.classification;

  return {
    documentId: document.id.value,
    sourceFileId: document.sourceFileId.value,
    type: classification?.type.value ?? null,
    classifiedAt: classification?.confidence.value ?? null,
    readings: document.fieldsReadHere.map(field => ({
      key: field.key.value,
      confidence: field.confidence.value,
    })),
    superseded: !document.isInForce,
  };
}
