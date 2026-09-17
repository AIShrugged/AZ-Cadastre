import { describe, expect, it } from 'vitest';

import {
  Document,
  ExtractedField,
  Page,
  SourceFile,
} from '../entities/index.js';
import {
  ArchiveQrCheckMade,
  DocumentClassified,
  FieldsExtracted,
  FilesAdded,
  PackageSubmitted,
  PageRecognised,
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
  DocumentAlreadyClassifiedException,
  DocumentNotClassifiedException,
  DocumentNotHeldAgainstTheArchiveException,
  DocumentNotInPackageException,
  DocumentsMustCoverEverySheetException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  InvalidSupplyTargetException,
  LegalBasisNotInProfileException,
  NoSuchDocumentGapException,
  PackageAlreadyFinishedException,
  PackageMustGainAFileException,
  PackageMustHaveAFileException,
  PackageNotStartableException,
  PackageNotTakingFilesException,
  PackageNotUnderWayException,
  PageAlreadyRecognisedException,
  PageNotInSourceFileException,
  RegistryCheckNotInProfileException,
  SourceFileAlreadySegmentedException,
  SourceFileAlreadySplitException,
  SourceFileMustHaveADocumentException,
  SourceFileNotInPackageException,
  SourceFileNotSplitException,
  UnclassifiableDocumentException,
} from '../exceptions/index.js';
import {
  ApprovalComment,
  ApprovalSummary,
  ARCHIVE_QR_FIELDS,
  ArchiveQrCheck,
  ArchiveQrFieldCheck,
  Classification,
  Confidence,
  ContentType,
  CrossCheck,
  CrossCheckKey,
  CrossCheckVerdict,
  DeclaredAtIntake,
  DocumentId,
  DocumentType,
  FailureReason,
  FieldKey,
  FieldOrigin,
  FieldValue,
  Filename,
  IssueKind,
  OcrResult,
  PackageId,
  PackageStatus,
  PageId,
  PageImage,
  PageNumber,
  PageRange,
  RecognisedText,
  RegistryAttribute,
  RegistryCheck,
  RegistryCheckKey,
  RegistryOutcome,
  SourceFileId,
  StorageKey,
  SupplyTarget,
  ValidationIssue,
  VerificationProfile,
} from '../value-objects/index.js';

import { VerificationPackage } from './verification-package.aggregate.js';

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, '0')}`;
}

function aFile(storageKey?: string): SourceFile {
  return SourceFile.create(
    SourceFileId.of(anId()),
    Filename.create('submission.pdf'),
    ContentType.PDF,
    StorageKey.create(storageKey ?? `uploads/${anId()}.pdf`),
  );
}

function aPage(number: number): Page {
  return Page.create(
    PageId.of(anId()),
    PageNumber.of(number),
    PageImage.of(StorageKey.create(`pages/${anId()}.png`), ContentType.PNG),
  );
}

function range(first: number, last: number): PageRange {
  return PageRange.of(PageNumber.of(first), PageNumber.of(last));
}

function aDocumentOf(sourceFileId: SourceFileId, pages: PageRange): Document {
  return Document.create(DocumentId.of(anId()), sourceFileId, pages);
}

// The default carries the marks an issuing office presses on its paper: the
// packages these helpers build are meant to be the ones an inspector has
// nothing to be told about, and since ADR-0012 a sheet read with no seal and no
// signature on it is a finding of its own.
const ATTESTED = [
  'Republic of Azerbaijan',
  '[stamp: STATE REGISTER]',
  '[signature]',
].join('\n');

function anOcrResult(text = ATTESTED): OcrResult {
  return OcrResult.of(RecognisedText.of(text), Confidence.of(0.9));
}

function aClassification(type = 'identity_card'): Classification {
  return Classification.of(DocumentType.create(type), Confidence.of(0.87));
}

function aField(key: string, confidence = 0.8): ExtractedField {
  return ExtractedField.of(
    FieldKey.create(key),
    FieldValue.create('AZE1234567'),
    Confidence.of(confidence),
    PageNumber.first(),
  );
}

const REQUIRED_TYPES = VerificationProfile.CADASTRE.requiredTypes.map(
  type => type.value,
);

// Every title to the land the table of provisions lists (ADR-0025).
const TITLE_TYPES = VerificationProfile.CADASTRE.provisions!.titleTypes.map(
  type => type.value,
);

type Options = {
  profile?: VerificationProfile;
  files?: readonly SourceFile[];
  declared?: DeclaredAtIntake;
};

function aPackage(options: Options = {}) {
  const files = options.files ?? [aFile()];
  const verification = VerificationPackage.create(
    PackageId.of(anId()),
    options.profile ?? VerificationProfile.CADASTRE,
    files,
    options.declared ?? DeclaredAtIntake.none(),
  );

  return { verification, files, file: files[0]! };
}

function aStartedPackage(options: Options = {}) {
  const built = aPackage(options);
  built.verification.start();
  built.verification.commit();

  return built;
}

// A package whose single file has been rendered into `sheets` pages and read.
function aReadPackage(sheets = 1, options: Options = {}) {
  const built = aStartedPackage(options);
  const pages = Array.from({ length: sheets }, (_, index) => aPage(index + 1));

  built.verification.splitIntoPages(built.file.id, pages);
  for (const page of pages) {
    built.verification.recordRecognition(built.file.id, page.id, anOcrResult());
  }
  built.verification.commit();

  return { ...built, pages };
}

// The same, read into one document per sheet.
function aSegmentedPackage(sheets = 1, options: Options = {}) {
  const built = aReadPackage(sheets, options);
  const documents = built.pages.map(page =>
    aDocumentOf(built.file.id, PageRange.single(page.number)),
  );

  built.verification.segmentIntoDocuments(built.file.id, documents);
  built.verification.commit();

  return { ...built, documents, document: documents[0]! };
}

function typesOf(verification: VerificationPackage): readonly string[] {
  return verification.getUncommittedEvents().map(event => event.type);
}

describe('VerificationPackage', () => {
  describe('when it is submitted', () => {
    it('waits to be picked up, holding the files that arrived', () => {
      const files = [aFile(), aFile()];

      const { verification } = aPackage({ files });

      expect(verification.status.equals(PackageStatus.PENDING)).toBe(true);
      expect(verification.files).toHaveLength(2);
    });

    it('holds no documents until the pipeline reads its files', () => {
      const { verification } = aPackage({ files: [aFile(), aFile()] });

      expect(verification.documents).toEqual([]);
    });

    it('records that it was submitted, with the profile it is judged against', () => {
      const { verification } = aPackage({
        profile: VerificationProfile.CADASTRE,
        files: [aFile(), aFile()],
      });

      const [event] = verification.getUncommittedEvents();
      expect(event).toBeInstanceOf(PackageSubmitted);
      expect((event as PackageSubmitted).profile).toBe(
        VerificationProfile.CADASTRE,
      );
      expect((event as PackageSubmitted).fileCount).toBe(2);
    });

    it('refuses a package with nothing in it', () => {
      expect(() =>
        VerificationPackage.create(
          PackageId.of(anId()),
          VerificationProfile.CADASTRE,
          [],
        ),
      ).toThrow(PackageMustHaveAFileException);
    });

    it('refuses two files pointing at the same object in the store', () => {
      const twice = 'uploads/the-same-object.pdf';

      expect(() => aPackage({ files: [aFile(twice), aFile(twice)] })).toThrow(
        DuplicateStorageKeyException,
      );
    });

    it('names the object two files both point at', () => {
      const twice = 'uploads/the-same-object.pdf';

      expect(() => aPackage({ files: [aFile(twice), aFile(twice)] })).toThrow(
        twice,
      );
    });

    it('keeps its own copy of the files it was handed', () => {
      const files = [aFile()];
      const { verification } = aPackage({ files });

      files.push(aFile());

      expect(verification.files).toHaveLength(1);
    });
  });

  describe('when files arrive after it was submitted', () => {
    const IDENTITY = VerificationProfile.CADASTRE.crossChecks[0]!;
    const OF_RECORD = VerificationProfile.CADASTRE.registryChecks[0]!;

    function valued(key: string, value: string): ExtractedField {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(0.9),
        PageNumber.first(),
      );
    }

    /*
     * A package the pipeline has been all the way over: two documents read and
     * placed, the identity check made across them, the register asked, and a
     * report compiled. This is the state the operation exists for — the report
     * says something is missing, and the missing paper is what arrives.
     */
    function aReportedPackage() {
      const built = aSegmentedPackage(2);
      const [card, application] = built.documents as [Document, Document];

      built.verification.classify(card.id, aClassification('identity_card'));
      built.verification.recordExtractedFields(card.id, [
        valued('last_name', 'ƏLİYEVA'),
        valued('first_name', 'Rübabə'),
      ]);
      built.verification.classify(
        application.id,
        aClassification('application'),
      );
      built.verification.recordExtractedFields(application.id, [
        valued('applicant_name', 'Əliyeva Rübabə'),
        valued('property_address', 'Zığ qəsəbəsi, Əliyev küçəsi 12'),
      ]);

      built.verification.recordCrossCheck(
        CrossCheck.of({
          key: IDENTITY.key,
          verdict: CrossCheckVerdict.MATCH,
          confidence: Confidence.of(0.9),
          note: 'compared in a test',
          values: built.verification.valuesFor(IDENTITY),
        }),
      );
      built.verification.recordRegistryCheck(
        RegistryCheck.of({
          key: OF_RECORD.key,
          outcome: RegistryOutcome.CONFIRMED,
          confidence: Confidence.of(0.95),
          note: 'the register holds this address',
          asked: built.verification.askedOf(OF_RECORD)!,
          reference: 'folder 14, pp. 01-dən 30',
          attributes: [],
        }),
      );

      built.verification.complete();
      built.verification.commit();

      return built;
    }

    it('takes a file into a package nothing has read yet', () => {
      const { verification } = aPackage();

      verification.addFiles([aFile()]);

      expect(verification.files).toHaveLength(2);
    });

    it('takes a file into a package a run could not finish', () => {
      const { verification } = aStartedPackage();
      verification.fail(FailureReason.create('the reader is down'));

      verification.addFiles([aFile()]);

      expect(verification.files).toHaveLength(2);
    });

    it('takes a file into a package that has been reported on', () => {
      const { verification } = aReportedPackage();

      verification.addFiles([aFile()]);

      expect(verification.files).toHaveLength(2);
    });

    it('refuses a file while a run is reading the package', () => {
      const { verification } = aStartedPackage();

      expect(() => verification.addFiles([aFile()])).toThrow(
        PackageNotTakingFilesException,
      );
    });

    // The refusal has to be readable on its own: the caller is told what the
    // package is doing and when to come back, not only that the answer is no.
    it('says why it refuses and what to do about it', () => {
      const { verification } = aStartedPackage();

      expect(() => verification.addFiles([aFile()])).toThrow(
        /reads the files it started with.*once the run has finished/s,
      );
    });

    it('leaves a running package exactly as it was', () => {
      const { verification, file } = aStartedPackage();

      expect(() => verification.addFiles([aFile()])).toThrow();

      expect(verification.files.map(one => one.id.value)).toEqual([
        file.id.value,
      ]);
      expect(verification.status.equals(PackageStatus.PROCESSING)).toBe(true);
    });

    it('refuses to add nothing, which would re-open the package for no reason', () => {
      const { verification } = aReportedPackage();

      expect(() => verification.addFiles([])).toThrow(
        PackageMustGainAFileException,
      );
      expect(verification.report).not.toBeNull();
    });

    it('refuses a file pointing at an object the package already holds', () => {
      const twice = 'uploads/the-same-object.pdf';
      const { verification } = aPackage({ files: [aFile(twice)] });

      expect(() => verification.addFiles([aFile(twice)])).toThrow(
        DuplicateStorageKeyException,
      );
    });

    it('puts a package that had been reported on back in the queue', () => {
      const { verification } = aReportedPackage();

      verification.addFiles([aFile()]);

      expect(verification.status.equals(PackageStatus.PENDING)).toBe(true);
      expect(verification.status.canStart).toBe(true);
    });

    // The report described the envelope as it was. It is discarded rather than
    // kept and marked stale: a report nobody may act on is not a report, and a
    // second one is compiled the moment the fresh run finishes (ADR-0013).
    it('discards the report, which no longer describes the package', () => {
      const { verification } = aReportedPackage();

      verification.addFiles([aFile()]);

      expect(verification.report).toBeNull();
    });

    it('discards what was worked out across the package, so it is asked again', () => {
      const { verification } = aReportedPackage();

      verification.addFiles([aFile()]);

      expect(verification.crossChecks).toEqual([]);
      expect(verification.registryChecks).toEqual([]);
      expect(verification.hasMade(IDENTITY.key)).toBe(false);
      expect(verification.hasAsked(OF_RECORD.key)).toBe(false);
    });

    // Another file arriving does not change what this one says, and re-reading
    // it would be paid for twice.
    it('keeps what was read off the files that were already there', () => {
      const built = aReportedPackage();

      built.verification.addFiles([aFile()]);

      expect(built.verification.fileWith(built.file.id).pages).toHaveLength(2);
      expect(built.verification.documentsIn(built.file.id)).toHaveLength(2);
      expect(
        built.verification.documents.every(document => document.isClassified),
      ).toBe(true);
    });

    it('says how many files arrived', () => {
      const { verification } = aReportedPackage();

      verification.addFiles([aFile(), aFile()]);

      const event = verification.getUncommittedEvents().at(-1);
      expect(event).toBeInstanceOf(FilesAdded);
      expect((event as FilesAdded).fileCount).toBe(2);
    });

    it('keeps its own copy of the files it was handed', () => {
      const { verification } = aPackage();
      const arriving = [aFile()];

      verification.addFiles(arriving);
      arriving.push(aFile());

      expect(verification.files).toHaveLength(2);
    });
  });

  describe('when it is rebuilt from storage', () => {
    it('records nothing', () => {
      const restored = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 4,
        profile: VerificationProfile.CADASTRE,
        declared: DeclaredAtIntake.none(),
        status: PackageStatus.PROCESSING,
        files: [aFile()],
        documents: [],
        crossChecks: [],
        registryChecks: [],
        archiveSearchApproval: null,
        report: null,
      });

      expect(restored.getUncommittedEvents()).toEqual([]);
    });

    it('comes back where it was left, at the version it was written under', () => {
      const file = aFile();
      const document = aDocumentOf(file.id, range(1, 1));

      const restored = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 7,
        profile: VerificationProfile.CADASTRE,
        declared: DeclaredAtIntake.none(),
        status: PackageStatus.COMPLETED,
        files: [file],
        documents: [document],
        crossChecks: [],
        registryChecks: [],
        archiveSearchApproval: null,
        report: null,
      });

      expect(restored.version).toBe(7);
      expect(restored.status.equals(PackageStatus.COMPLETED)).toBe(true);
      expect(restored.profile).toBe(VerificationProfile.CADASTRE);
      expect(restored.documents).toHaveLength(1);
    });

    it('refuses nothing, so a package written before a rule can still be read', () => {
      const restored = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 1,
        profile: VerificationProfile.CADASTRE,
        declared: DeclaredAtIntake.none(),
        status: PackageStatus.PENDING,
        files: [],
        documents: [],
        crossChecks: [],
        registryChecks: [],
        archiveSearchApproval: null,
        report: null,
      });

      expect(restored.files).toEqual([]);
    });
  });

  describe('looking things up', () => {
    it('finds a file of its own', () => {
      const { verification, file } = aPackage();

      expect(verification.fileWith(file.id).id.equals(file.id)).toBe(true);
    });

    it('refuses a file that belongs to another package', () => {
      const { verification } = aPackage();

      expect(() => verification.fileWith(SourceFileId.of(anId()))).toThrow(
        SourceFileNotInPackageException,
      );
    });

    it('finds a document of its own', () => {
      const { verification, document } = aSegmentedPackage();

      expect(
        verification.documentWith(document.id).id.equals(document.id),
      ).toBe(true);
    });

    it('refuses a document that belongs to another package', () => {
      const { verification } = aSegmentedPackage();

      expect(() => verification.documentWith(DocumentId.of(anId()))).toThrow(
        DocumentNotInPackageException,
      );
    });

    it('reads a document as the text of the sheets it occupies', () => {
      const built = aStartedPackage();
      const pages = [aPage(1), aPage(2), aPage(3)];
      built.verification.splitIntoPages(built.file.id, pages);
      for (const [index, page] of pages.entries()) {
        built.verification.recordRecognition(
          built.file.id,
          page.id,
          anOcrResult(`sheet ${index + 1}`),
        );
      }
      const document = aDocumentOf(built.file.id, range(2, 3));
      built.verification.segmentIntoDocuments(built.file.id, [
        aDocumentOf(built.file.id, range(1, 1)),
        document,
      ]);

      expect(built.verification.textOf(document.id).value).toBe(
        'sheet 2\nsheet 3',
      );
    });
  });

  describe('handing it to the pipeline', () => {
    it('puts a waiting package under way', () => {
      const { verification } = aPackage();

      verification.start();

      expect(verification.status.equals(PackageStatus.PROCESSING)).toBe(true);
      expect(verification.getUncommittedEvents().at(-1)).toBeInstanceOf(
        VerificationStarted,
      );
    });

    it('refuses a package that is already running', () => {
      const { verification } = aStartedPackage();

      expect(() => verification.start()).toThrow(PackageNotStartableException);
    });

    it('refuses a package that is already done', () => {
      const { verification } = aStartedPackage();
      verification.complete();

      expect(() => verification.start()).toThrow(PackageNotStartableException);
    });

    it('says where the package sits when it refuses to start it', () => {
      const { verification } = aStartedPackage();

      expect(() => verification.start()).toThrow('Processing');
    });

    it('changes nothing when it refuses to start', () => {
      const { verification } = aStartedPackage();
      verification.complete();
      verification.commit();

      expect(() => verification.start()).toThrow(PackageNotStartableException);
      expect(verification.status.equals(PackageStatus.COMPLETED)).toBe(true);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it('starts a failed package again, so a retry resumes rather than repeats', () => {
      const { verification } = aStartedPackage();
      verification.fail(FailureReason.create('the provider gave up'));
      verification.commit();

      verification.start();

      expect(verification.status.equals(PackageStatus.PROCESSING)).toBe(true);
    });

    it('keeps everything a failed package had already learned when it starts again', () => {
      const { verification, document } = aSegmentedPackage(2);
      verification.classify(document.id, aClassification());
      verification.fail(FailureReason.create('the provider gave up'));
      verification.commit();

      verification.start();

      expect(verification.documents).toHaveLength(2);
      expect(verification.documentWith(document.id).isClassified).toBe(true);
    });

    it('refuses to fail a package that has already completed', () => {
      const { verification } = aStartedPackage();
      verification.complete();

      expect(() => verification.fail(FailureReason.create('too late'))).toThrow(
        PackageAlreadyFinishedException,
      );
    });

    it('leaves a completed package completed when it refuses to fail it', () => {
      const { verification } = aStartedPackage();
      verification.complete();
      verification.commit();

      expect(() => verification.fail(FailureReason.create('too late'))).toThrow(
        PackageAlreadyFinishedException,
      );
      expect(verification.status.equals(PackageStatus.COMPLETED)).toBe(true);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });
  });

  describe('recording the sheets a file was rendered into', () => {
    it('records them against the file named', () => {
      const { verification, file } = aStartedPackage();

      verification.splitIntoPages(file.id, [aPage(1), aPage(2)]);

      expect(verification.fileWith(file.id).pageCount).toBe(2);
      expect(verification.getUncommittedEvents().at(-1)).toBeInstanceOf(
        SourceFileSplitIntoPages,
      );
    });

    it('leaves the other files of the package alone', () => {
      const files = [aFile(), aFile()];
      const { verification } = aStartedPackage({ files });

      verification.splitIntoPages(files[0]!.id, [aPage(1)]);

      expect(verification.fileWith(files[1]!.id).isSplit).toBe(false);
    });

    it('refuses a package the pipeline is not running', () => {
      const { verification, file } = aPackage();

      expect(() => verification.splitIntoPages(file.id, [aPage(1)])).toThrow(
        PackageNotUnderWayException,
      );
    });

    it('refuses a file that belongs to another package', () => {
      const { verification } = aStartedPackage();

      expect(() =>
        verification.splitIntoPages(SourceFileId.of(anId()), [aPage(1)]),
      ).toThrow(SourceFileNotInPackageException);
    });

    it('refuses a second split of the same file', () => {
      const { verification, file } = aStartedPackage();
      verification.splitIntoPages(file.id, [aPage(1)]);

      expect(() => verification.splitIntoPages(file.id, [aPage(1)])).toThrow(
        SourceFileAlreadySplitException,
      );
    });

    it('changes nothing when it refuses a second split', () => {
      const { verification, file } = aStartedPackage();
      verification.splitIntoPages(file.id, [aPage(1), aPage(2)]);
      verification.commit();

      expect(() => verification.splitIntoPages(file.id, [aPage(1)])).toThrow(
        SourceFileAlreadySplitException,
      );
      expect(verification.fileWith(file.id).pageCount).toBe(2);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });
  });

  describe('recording what OCR read off a page', () => {
    it('records the reading against the page named', () => {
      const { verification, file } = aStartedPackage();
      const pages = [aPage(1), aPage(2)];
      verification.splitIntoPages(file.id, pages);

      verification.recordRecognition(file.id, pages[0]!.id, anOcrResult());

      const stored = verification.fileWith(file.id);
      expect(stored.pageWith(pages[0]!.id).isRecognised).toBe(true);
      expect(stored.pageWith(pages[1]!.id).isRecognised).toBe(false);
      expect(verification.getUncommittedEvents().at(-1)).toBeInstanceOf(
        PageRecognised,
      );
    });

    it('refuses a package the pipeline is not running', () => {
      const { verification, file, pages } = aReadPackage(1);
      verification.complete();

      expect(() =>
        verification.recordRecognition(file.id, pages[0]!.id, anOcrResult()),
      ).toThrow(PackageNotUnderWayException);
    });

    it('refuses a file that belongs to another package', () => {
      const { verification, pages } = aReadPackage(1);

      expect(() =>
        verification.recordRecognition(
          SourceFileId.of(anId()),
          pages[0]!.id,
          anOcrResult(),
        ),
      ).toThrow(SourceFileNotInPackageException);
    });

    it('refuses a page that belongs to another file', () => {
      const { verification, file } = aReadPackage(1);

      expect(() =>
        verification.recordRecognition(
          file.id,
          PageId.of(anId()),
          anOcrResult(),
        ),
      ).toThrow(PageNotInSourceFileException);
    });

    it('refuses a second recognition of the same page', () => {
      const { verification, file, pages } = aReadPackage(1);

      expect(() =>
        verification.recordRecognition(file.id, pages[0]!.id, anOcrResult()),
      ).toThrow(PageAlreadyRecognisedException);
    });

    it('keeps the first reading when it refuses a second', () => {
      const { verification, file, pages } = aReadPackage(1);

      expect(() =>
        verification.recordRecognition(
          file.id,
          pages[0]!.id,
          anOcrResult('something else'),
        ),
      ).toThrow(PageAlreadyRecognisedException);
      expect(
        verification.fileWith(file.id).pageWith(pages[0]!.id).ocr?.text.value,
      ).toBe(ATTESTED);
    });
  });

  describe('reading a file into the documents it holds', () => {
    it('adds the documents found and says how many there were', () => {
      const { verification, file } = aReadPackage(3);

      verification.segmentIntoDocuments(file.id, [
        aDocumentOf(file.id, range(1, 1)),
        aDocumentOf(file.id, range(2, 3)),
      ]);

      expect(verification.documents).toHaveLength(2);
      expect(verification.documentsIn(file.id)).toHaveLength(2);
      expect(verification.getUncommittedEvents().at(-1)).toBeInstanceOf(
        SourceFileSegmented,
      );
    });

    it('finds several documents in one uploaded file', () => {
      const { verification, file } = aReadPackage(4);

      verification.segmentIntoDocuments(file.id, [
        aDocumentOf(file.id, range(1, 1)),
        aDocumentOf(file.id, range(2, 2)),
        aDocumentOf(file.id, range(3, 4)),
      ]);

      expect(
        verification.documents.map(document => [
          document.pages.first.value,
          document.pages.last.value,
        ]),
      ).toEqual([
        [1, 1],
        [2, 2],
        [3, 4],
      ]);
    });

    it('keeps the documents of one file apart from those of another', () => {
      const files = [aFile(), aFile()];
      const { verification } = aStartedPackage({ files });
      for (const file of files) {
        verification.splitIntoPages(file.id, [aPage(1)]);
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 1)),
        ]);
      }

      expect(verification.documentsIn(files[0]!.id)).toHaveLength(1);
      expect(verification.documentsIn(files[1]!.id)).toHaveLength(1);
      expect(verification.documents).toHaveLength(2);
    });

    it('refuses a package the pipeline is not running', () => {
      const { verification, file } = aPackage();

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 1)),
        ]),
      ).toThrow(PackageNotUnderWayException);
    });

    it('refuses a file that belongs to another package', () => {
      const { verification } = aReadPackage(1);
      const stranger = SourceFileId.of(anId());

      expect(() =>
        verification.segmentIntoDocuments(stranger, [
          aDocumentOf(stranger, range(1, 1)),
        ]),
      ).toThrow(SourceFileNotInPackageException);
    });

    it('refuses a file that has not been rendered into sheets yet', () => {
      const { verification, file } = aStartedPackage();

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 1)),
        ]),
      ).toThrow(SourceFileNotSplitException);
    });

    it('refuses a file it is told holds nothing', () => {
      const { verification, file } = aReadPackage(1);

      expect(() => verification.segmentIntoDocuments(file.id, [])).toThrow(
        SourceFileMustHaveADocumentException,
      );
    });

    it('refuses a second reading of the same file', () => {
      const { verification, file } = aSegmentedPackage(1);

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 1)),
        ]),
      ).toThrow(SourceFileAlreadySegmentedException);
    });

    it('refuses documents that leave a sheet out', () => {
      const { verification, file } = aReadPackage(3);

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 1)),
          aDocumentOf(file.id, range(3, 3)),
        ]),
      ).toThrow(DocumentsMustCoverEverySheetException);
    });

    it('refuses documents that claim the same sheet twice', () => {
      const { verification, file } = aReadPackage(3);

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 2)),
          aDocumentOf(file.id, range(2, 3)),
        ]),
      ).toThrow(DocumentsMustCoverEverySheetException);
    });

    it('refuses documents that do not start at the first sheet', () => {
      const { verification, file } = aReadPackage(3);

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(2, 3)),
        ]),
      ).toThrow(DocumentsMustCoverEverySheetException);
    });

    it('refuses documents that stop short of the last sheet', () => {
      const { verification, file } = aReadPackage(3);

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 2)),
        ]),
      ).toThrow(DocumentsMustCoverEverySheetException);
    });

    it('refuses a document found in some other file', () => {
      const { verification, file } = aReadPackage(1);

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(SourceFileId.of(anId()), range(1, 1)),
        ]),
      ).toThrow(DocumentsMustCoverEverySheetException);
    });

    it('changes nothing when it refuses what it was told the file holds', () => {
      const { verification, file } = aReadPackage(3);
      verification.commit();

      expect(() =>
        verification.segmentIntoDocuments(file.id, [
          aDocumentOf(file.id, range(1, 1)),
        ]),
      ).toThrow(DocumentsMustCoverEverySheetException);
      expect(verification.documents).toEqual([]);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it('takes the documents in whatever order they were found', () => {
      const { verification, file } = aReadPackage(3);

      verification.segmentIntoDocuments(file.id, [
        aDocumentOf(file.id, range(2, 3)),
        aDocumentOf(file.id, range(1, 1)),
      ]);

      expect(verification.documents).toHaveLength(2);
    });
  });

  describe('recording the type the classifier chose', () => {
    it('records a type the profile expects', () => {
      const { verification, document } = aSegmentedPackage();

      verification.classify(document.id, aClassification('payment_receipt'));

      expect(
        verification.documentWith(document.id).classification?.type.value,
      ).toBe('payment_receipt');
      expect(verification.getUncommittedEvents().at(-1)).toBeInstanceOf(
        DocumentClassified,
      );
    });

    it('refuses a document type the profile does not recognise', () => {
      const { verification, document } = aSegmentedPackage(1, {
        profile: VerificationProfile.CADASTRE,
      });

      expect(() =>
        verification.classify(document.id, aClassification('driver_license')),
      ).toThrow(DocumentTypeNotInProfileException);
    });

    it('names the type and the profile that does not expect it', () => {
      const { verification, document } = aSegmentedPackage(1, {
        profile: VerificationProfile.CADASTRE,
      });

      expect(() =>
        verification.classify(document.id, aClassification('driver_license')),
      ).toThrow(/cadastre[\s\S]*driver_license/);
    });

    it('always accepts a document the classifier could not place, whatever the profile', () => {
      const { verification, document } = aSegmentedPackage();

      verification.classify(
        document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(verification.documentWith(document.id).isClassified).toBe(true);
    });

    it('refuses a package the pipeline is not running', () => {
      const { verification, document } = aSegmentedPackage();
      verification.complete();

      expect(() =>
        verification.classify(document.id, aClassification()),
      ).toThrow(PackageNotUnderWayException);
    });

    it('refuses a document that belongs to another package', () => {
      const { verification } = aSegmentedPackage();

      expect(() =>
        verification.classify(DocumentId.of(anId()), aClassification()),
      ).toThrow(DocumentNotInPackageException);
    });

    it('refuses a second classification of the same document', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification());

      expect(() =>
        verification.classify(document.id, aClassification('payment_receipt')),
      ).toThrow(DocumentAlreadyClassifiedException);
    });

    it('keeps the first decision when it refuses a second', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));
      verification.commit();

      expect(() =>
        verification.classify(document.id, aClassification('payment_receipt')),
      ).toThrow(DocumentAlreadyClassifiedException);
      expect(
        verification.documentWith(document.id).classification?.type.value,
      ).toBe('identity_card');
      expect(verification.getUncommittedEvents()).toEqual([]);
    });
  });

  describe('recording the values pulled from a document', () => {
    it("records values under keys the document's type declares", () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));

      verification.recordExtractedFields(document.id, [aField('document_no')]);

      expect(verification.documentWith(document.id).hasFields).toBe(true);
      expect(verification.getUncommittedEvents().at(-1)).toBeInstanceOf(
        FieldsExtracted,
      );
    });

    it("refuses a key the document's type never declared", () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));

      expect(() =>
        verification.recordExtractedFields(document.id, [aField('receipt_no')]),
      ).toThrow(FieldNotInSchemaException);
    });

    it('records none of the values when one of them breaks the schema', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField('document_no'),
          aField('receipt_no'),
        ]),
      ).toThrow(FieldNotInSchemaException);
      expect(verification.documentWith(document.id).hasFields).toBe(false);
    });

    it('judges each key against the type of that document, not of another', () => {
      const { verification, documents } = aSegmentedPackage(2);
      verification.classify(documents[0]!.id, aClassification('identity_card'));
      verification.classify(
        documents[1]!.id,
        aClassification('payment_receipt'),
      );

      verification.recordExtractedFields(documents[1]!.id, [
        aField('receipt_no'),
      ]);

      expect(verification.documentWith(documents[1]!.id).hasFields).toBe(true);
    });

    it('refuses a document that has not been classified', () => {
      const { verification, document } = aSegmentedPackage();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField('document_no'),
        ]),
      ).toThrow(DocumentNotClassifiedException);
    });

    it('refuses a document the classifier could not place, because it declares no fields', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(
        document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField('document_no'),
        ]),
      ).toThrow(UnclassifiableDocumentException);
    });

    it('refuses a package the pipeline is not running', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification());
      verification.complete();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField('document_no'),
        ]),
      ).toThrow(PackageNotUnderWayException);
    });

    it('replaces the values wholesale when the stage runs again', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));
      verification.recordExtractedFields(document.id, [
        aField('document_no'),
        aField('first_name'),
      ]);

      verification.recordExtractedFields(document.id, [aField('document_no')]);

      expect(verification.documentWith(document.id).fields).toHaveLength(1);
    });
  });

  describe('finishing', () => {
    it('marks a running package done', () => {
      const { verification } = aStartedPackage();

      verification.complete();

      expect(verification.status.equals(PackageStatus.COMPLETED)).toBe(true);
      expect(verification.getUncommittedEvents().at(-1)).toBeInstanceOf(
        VerificationCompleted,
      );
    });

    it('refuses to finish a package that was never started', () => {
      const { verification } = aPackage();

      expect(() => verification.complete()).toThrow(
        PackageNotUnderWayException,
      );
    });

    it('refuses to finish a package that is already done', () => {
      const { verification } = aStartedPackage();
      verification.complete();

      expect(() => verification.complete()).toThrow(
        PackageNotUnderWayException,
      );
    });

    it('marks a package that hit a permanent error as failed, with the reason', () => {
      const { verification } = aStartedPackage();

      verification.fail(FailureReason.create('the OCR provider gave up'));

      expect(verification.status.equals(PackageStatus.FAILED)).toBe(true);
      const event = verification.getUncommittedEvents().at(-1);
      expect(event).toBeInstanceOf(VerificationFailed);
      expect((event as VerificationFailed).reason.value).toBe(
        'the OCR provider gave up',
      );
    });

    it('keeps the documents of a failed package, so a retry resumes from where it stopped', () => {
      const { verification } = aSegmentedPackage(2);

      verification.fail(FailureReason.create('the provider gave up'));

      expect(verification.documents).toHaveLength(2);
    });
  });

  describe('the report it finishes with', () => {
    function kindsOf(verification: VerificationPackage): readonly string[] {
      return (verification.report?.issues ?? []).map(issue => issue.kind.value);
    }

    it('hands one over however little of the package could be read', () => {
      const { verification } = aSegmentedPackage();

      verification.complete();

      expect(verification.report).not.toBeNull();
    });

    /*
     * "Clean" is about what is held against the package, not about the report
     * being empty. A good package still carries a message — the plan of the
     * plot is a paper the policy confirms through MQS, which is not connected —
     * and that is stated for the record, so the outcome is still OK (ADR-0025).
     */
    it('reads as clean when every paper its provision asks for was found', () => {
      const { verification } = aCompletePackage();

      verification.complete();

      expect(verification.report?.status.value).toBe('OK');
      expect(kindsOf(verification)).toEqual(['IntegrationNotConnected']);
    });

    /*
     * The customer's decision: no paper with a QR code, the step is skipped and
     * the report says so — as "there was nothing to check this with", never as
     * a fault of the applicant (ADR-0028).
     */
    describe('where no paper of the package prints a QR code', () => {
      function qrFindings(verification: VerificationPackage) {
        return (verification.report?.issues ?? []).filter(
          issue => issue.kind.value === 'QrCodeUnavailable',
        );
      }

      // The complete package, its plan-scheme read again without the code.
      function aCompletePackageWithoutACode() {
        const built = aCompletePackage();
        built.verification.recordExtractedFields(built.documents[0]!.id, [
          stated('property_address', 'Zığ qəsəbəsi, Əliyev küçəsi 12'),
          stated('land_category', 'Fərdi yaşayış tikintisi üçün torpaq'),
        ]);

        return built;
      }

      it('says once that the check by QR code was skipped', () => {
        const { verification } = aCompletePackageWithoutACode();

        verification.complete();

        const [finding, ...more] = qrFindings(verification);
        expect(more).toEqual([]);
        expect(finding?.message).toContain('not checked by QR code');
        expect(finding?.documentId).toBeNull();
      });

      it('does not hold it against the package', () => {
        const { verification } = aCompletePackageWithoutACode();

        verification.complete();

        expect(verification.report?.status.value).toBe('OK');
        expect(IssueKind.QR_CODE_UNAVAILABLE.isInformational).toBe(true);
        expect(IssueKind.QR_CODE_UNAVAILABLE.leavesPackageIncomplete).toBe(
          false,
        );
      });

      it('names the papers that could have carried one', () => {
        const { verification } = aCompletePackageWithoutACode();

        verification.complete();

        // The plan-scheme is a kind that prints a code; the sketch design, the
        // certificate and the act are not, and are not named.
        const [finding] = qrFindings(verification);
        expect(finding?.message).toContain('"land_plot_plan"');
        expect(finding?.message).not.toContain('"registration_certificate"');
        expect(finding?.message).not.toContain('"sketch_project"');
        expect(finding?.message).not.toContain('"operation_acceptance_act"');
      });

      it('says the package carries no paper of a kind that prints one', () => {
        const { verification, document } = aSegmentedPackage();
        verification.classify(document.id, aClassification('sketch_project'));

        verification.complete();

        expect(qrFindings(verification)[0]?.message).toContain(
          'no paper of a kind that prints one',
        );
      });

      it('is not said where a paper printed a code', () => {
        const { verification } = aCompletePackage();

        verification.complete();

        expect(qrFindings(verification)).toEqual([]);
      });
    });

    it('names every required document nobody supplied', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));

      verification.complete();

      expect(
        verification.report?.issues
          .filter(issue => issue.kind.value === 'MissingDocument')
          .map(issue => issue.documentType?.value),
      ).toEqual(REQUIRED_TYPES.filter(type => type !== 'identity_card'));
    });

    it('reads as an incomplete package when a required document is missing', () => {
      const { verification } = aSegmentedPackage();

      verification.complete();

      expect(verification.report?.status.value).toBe('IncompletePackage');
    });

    it('reports a document the classifier could not place, rather than stopping', () => {
      const { verification, documents } = aSegmentedPackage(2);
      verification.classify(documents[0]!.id, aClassification('identity_card'));
      verification.classify(
        documents[1]!.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      verification.complete();

      const unplaced = verification.report?.issues.find(
        issue =>
          issue.kind.value === 'UnreadableDocument' &&
          issue.documentId?.equals(documents[1]!.id) === true,
      );
      expect(unplaced).toBeDefined();
      expect(verification.status.equals(PackageStatus.COMPLETED)).toBe(true);
    });

    it('reports a sheet that could not be read', () => {
      const { verification, file } = aStartedPackage();
      verification.splitIntoPages(file.id, [aPage(1), aPage(2)]);
      verification.recordRecognition(
        file.id,
        verification.files[0]!.pages[0]!.id,
        anOcrResult(),
      );

      verification.complete();

      const unread = verification.report?.issues.filter(
        issue => issue.kind.value === 'UnreadableDocument',
      );
      expect(unread?.map(issue => issue.pageNumber?.value)).toContain(2);
    });

    it('reports a file it never managed to read into documents', () => {
      const { verification, file } = aReadPackage(2);

      verification.complete();

      expect(
        verification.report?.issues.some(
          issue =>
            issue.kind.value === 'UnreadableDocument' &&
            issue.sourceFileId?.equals(file.id) === true &&
            issue.pageNumber === null,
        ),
      ).toBe(true);
    });

    it('flags a value the engine is unsure of, and says how unsure', () => {
      const { verification } = aCompletePackage();
      const title = verification.documents[2]!;
      verification.recordExtractedFields(title.id, [
        aField('document_no', 0.42),
      ]);

      verification.complete();

      const flagged = verification.report?.issues.find(
        issue => issue.kind.value === 'LowConfidence',
      );
      expect(flagged?.fieldKey?.value).toBe('document_no');
      expect(flagged?.confidence?.value).toBe(0.42);
    });

    it('leaves a value it is sure of out of the report', () => {
      const { verification } = aCompletePackage();
      const title = verification.documents[2]!;
      verification.recordExtractedFields(title.id, [
        aField('document_no', 0.95),
      ]);

      verification.complete();

      expect(kindsOf(verification)).toEqual(['IntegrationNotConnected']);
    });

    it('reports a document that read fine and is not of a type the profile asks for', () => {
      const { verification, documents } = aSegmentedPackage(2);
      verification.classify(documents[0]!.id, aClassification('identity_card'));
      verification.classify(
        documents[1]!.id,
        Classification.outOfProfile(Confidence.of(0.9)),
      );

      verification.complete();

      const extra = verification.report?.issues.find(
        issue => issue.kind.value === 'ExtraDocument',
      );
      expect(extra?.documentId?.equals(documents[1]!.id)).toBe(true);
      expect(extra?.documentType?.value).toBe('out_of_profile');
      expect(extra?.message).toContain('not a type this profile asks for');
    });

    // The whole of what the catalogue buys: an inspector reading the finding is
    // told what the paper is, not only that it is not on the list (ADR-0012).
    it('names an extra document the classifier recognised, rather than bucketing it', () => {
      const { verification, documents } = aSegmentedPackage(2);
      verification.classify(documents[0]!.id, aClassification('identity_card'));
      verification.classify(
        documents[1]!.id,
        Classification.outOfProfile(
          Confidence.of(0.9),
          DocumentType.create('courier_waybill'),
        ),
      );

      verification.complete();

      const extra = verification.report?.issues.find(
        issue => issue.kind.value === 'ExtraDocument',
      );
      expect(extra?.documentType?.value).toBe('courier_waybill');
      expect(extra?.message).toContain('courier_waybill');
    });

    // Informational, named or not: nothing here is a shortfall the inspector
    // has to resolve before registering.
    it('does not count a named extra document against the package', () => {
      const built = aCompletePackage(1);
      built.verification.classify(
        built.documents.at(-1)!.id,
        Classification.outOfProfile(
          Confidence.of(0.9),
          DocumentType.create('covering_letter'),
        ),
      );

      built.verification.complete();

      expect(kindsOf(built.verification)).toEqual([
        'ExtraDocument',
        'IntegrationNotConnected',
      ]);
      expect(built.verification.report?.status.value).toBe('OK');
    });

    /*
     * One sheet, read as `text` and placed as `type`: the smallest package that
     * can be asked whether the paper carries the marks the office that issued
     * it presses on it. It is short of the other six required documents, which
     * the report says too — every assertion here filters to the finding it is
     * about.
     */
    function aPaper(type: string, text: string, confidence = 0.9) {
      const built = aStartedPackage();
      const page = aPage(1);
      built.verification.splitIntoPages(built.file.id, [page]);
      built.verification.recordRecognition(
        built.file.id,
        page.id,
        OcrResult.of(RecognisedText.of(text), Confidence.of(confidence)),
      );
      const document = aDocumentOf(built.file.id, range(1, 1));
      built.verification.segmentIntoDocuments(built.file.id, [document]);
      built.verification.classify(document.id, aClassification(type));

      return { ...built, document };
    }

    function attestationFindings(verification: VerificationPackage) {
      return (verification.report?.issues ?? []).filter(
        issue => issue.kind.value === 'MissingAttestation',
      );
    }

    it('reports a certificate the archive never sealed', () => {
      const { verification, document } = aPaper(
        'archive_certificate',
        'ARXİV ARAYIŞI\nArayış No: ARX-2025-0417\n[signature]',
      );

      verification.complete();

      const [finding, ...rest] = attestationFindings(verification);
      expect(rest).toEqual([]);
      expect(finding?.documentId?.equals(document.id)).toBe(true);
      expect(finding?.documentType?.value).toBe('archive_certificate');
      expect(finding?.message).toContain('no stamp');
    });

    it('tells a seal that says nothing apart from no seal at all', () => {
      const { verification } = aPaper(
        'archive_certificate',
        'ARXİV ARAYIŞI\n[stamp: illegible]\n[signature]',
      );

      verification.complete();

      const [finding] = attestationFindings(verification);
      expect(finding?.message).toContain('could not be read');
    });

    it('reports the signature an application was filed without', () => {
      const { verification } = aPaper(
        'application',
        'DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ\nƏrizəçi: ELÇİN ƏLİYEV',
      );

      verification.complete();

      const findings = attestationFindings(verification);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.message).toContain('no signature');
    });

    // Two marks, two findings: an inspector confirms a seal and a signature by
    // looking at different parts of the sheet.
    it('states each absent mark on its own line', () => {
      const { verification } = aPaper(
        'land_plot_plan',
        'TORPAQ SAHƏSİNİN PLAN-SXEMİ\nSahə: 642 m2',
      );

      verification.complete();

      expect(
        attestationFindings(verification).map(issue => issue.message),
      ).toEqual([
        expect.stringContaining('no stamp'),
        expect.stringContaining('no signature'),
      ]);
    });

    it('asks neither mark of a paper no office seals or signs', () => {
      const { verification } = aPaper(
        'payment_receipt',
        'ÖDƏNİŞ QƏBZİ\nQəbz No: QB-2025-88301',
      );

      verification.complete();

      expect(attestationFindings(verification)).toEqual([]);
    });

    it('leaves a properly attested paper out of the report', () => {
      const { verification } = aPaper(
        'archive_certificate',
        'ARXİV ARAYIŞI\n[stamp: BAKI ŞƏHƏR DÖVLƏT ARXİVİ]\n[signature]',
      );

      verification.complete();

      expect(attestationFindings(verification)).toEqual([]);
    });

    // Nothing is asserted above the confidence of the sheet it came from
    // (docs/process-overview.md §5): "no seal on this paper" is a claim about a
    // reading, and it is worth exactly what that reading was worth.
    it('states the absent mark no more confidently than the sheet was read', () => {
      const { verification } = aPaper(
        'archive_certificate',
        'ARXİV ARAYIŞI\n[signature]',
        0.55,
      );

      verification.complete();

      expect(attestationFindings(verification)[0]?.confidence?.value).toBe(
        0.55,
      );
    });

    it('records the claim as unassessed when a sheet of the paper went unread', () => {
      const built = aStartedPackage();
      const pages = [aPage(1), aPage(2)];
      built.verification.splitIntoPages(built.file.id, pages);
      built.verification.recordRecognition(
        built.file.id,
        pages[0]!.id,
        OcrResult.of(RecognisedText.of('ARXİV ARAYIŞI'), Confidence.of(0.93)),
      );
      const document = aDocumentOf(built.file.id, range(1, 2));
      built.verification.segmentIntoDocuments(built.file.id, [document]);
      built.verification.classify(
        document.id,
        aClassification('archive_certificate'),
      );

      built.verification.complete();

      expect(
        attestationFindings(built.verification)[0]?.confidence?.value,
      ).toBe(0);
    });

    // The sheets are already reported as unread. Saying the seal they were
    // never read for is absent would be a claim about the reading dressed up as
    // a claim about the document.
    it('says nothing about the marks on a paper nothing was read off', () => {
      const built = aStartedPackage();
      const page = aPage(1);
      built.verification.splitIntoPages(built.file.id, [page]);
      built.verification.recordRecognition(
        built.file.id,
        page.id,
        OcrResult.illegible(),
      );
      const document = aDocumentOf(built.file.id, range(1, 1));
      built.verification.segmentIntoDocuments(built.file.id, [document]);
      built.verification.classify(
        document.id,
        aClassification('archive_certificate'),
      );

      built.verification.complete();

      expect(attestationFindings(built.verification)).toEqual([]);
    });

    it('asks nothing of a document the classifier could not place', () => {
      const built = aStartedPackage();
      const page = aPage(1);
      built.verification.splitIntoPages(built.file.id, [page]);
      built.verification.recordRecognition(
        built.file.id,
        page.id,
        anOcrResult('ARXİV ARAYIŞI'),
      );
      const document = aDocumentOf(built.file.id, range(1, 1));
      built.verification.segmentIntoDocuments(built.file.id, [document]);
      built.verification.classify(
        document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      built.verification.complete();

      expect(attestationFindings(built.verification)).toEqual([]);
    });

    // A shortfall in the paper and not an observation about the envelope: the
    // package is not incomplete, but it is not fine either.
    it('counts an unsealed paper against the package', () => {
      const { verification } = aCompletePackage();
      const stripped = VerificationPackage.restore({
        id: verification.id,
        version: 2,
        profile: VerificationProfile.CADASTRE,
        declared: DeclaredAtIntake.none(),
        status: PackageStatus.PROCESSING,
        files: [
          SourceFile.restore({
            id: verification.files[0]!.id,
            filename: verification.files[0]!.filename,
            contentType: verification.files[0]!.contentType,
            storageKey: verification.files[0]!.storageKey,
            pages: verification.files[0]!.pages.map((page, index) =>
              index === 0
                ? Page.restore(
                    page.id,
                    page.number,
                    page.image,
                    OcrResult.of(
                      RecognisedText.of('TORPAQ SAHƏSİNİN PLAN-SXEMİ'),
                      Confidence.of(0.9),
                    ),
                  )
                : page,
            ),
          }),
        ],
        documents: verification.documents,
        crossChecks: verification.crossChecks,
        registryChecks: verification.registryChecks,
        archiveSearchApproval: null,
        report: null,
      });
      stripped.complete();

      expect(stripped.report?.status.value).toBe('IssuesFound');
      expect(attestationFindings(stripped)).toHaveLength(2);
    });

    it('works the findings out afresh, so a re-run drops one it has answered', () => {
      const { verification, file } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(file.id, [page]);
      verification.complete();
      expect(kindsOf(verification)).toContain('UnreadableDocument');

      const reread = VerificationPackage.restore({
        id: verification.id,
        version: 2,
        profile: VerificationProfile.CADASTRE,
        declared: DeclaredAtIntake.none(),
        status: PackageStatus.PROCESSING,
        files: verification.files,
        documents: verification.documents,
        crossChecks: verification.crossChecks,
        registryChecks: verification.registryChecks,
        archiveSearchApproval: null,
        report: verification.report,
      });
      reread.recordRecognition(file.id, page.id, anOcrResult());
      const document = aDocumentOf(file.id, range(1, 1));
      reread.segmentIntoDocuments(file.id, [document]);
      reread.classify(document.id, aClassification('identity_card'));
      reread.complete();

      expect(kindsOf(reread)).not.toContain('UnreadableDocument');
    });
  });

  /*
   * Which provision of Article 8 the case falls under, and what the package is
   * held to because of it (ADR-0025).
   *
   * The table itself is held to the customer's acceptance contract in
   * `provision.vo.spec.ts`, and the reading of the figures in
   * `case-provision.service.spec.ts`. What is under test here is what the
   * report says: the paper a provision asks for and the title every provision
   * asks for, a title outside its window, a provision nobody could decide, and
   * a paper confirmed through a system nobody connected.
   */
  describe('the provision of Article 8 it holds the package to', () => {
    function aValue(key: string, value: string): ExtractedField {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(0.9),
        PageNumber.first(),
      );
    }

    type Paper = readonly [string, Readonly<Record<string, string>>];

    // A package of these papers, one per sheet, each placed and read, run to
    // its report — and, where a year is given, one paper more dating the case
    // (ADR-0026): the permit for operation before 2013 and the acceptance act
    // from it, each a paper no provision on that side of the line asks for.
    function aCase(year: number | null, ...given: readonly Paper[]) {
      const dated: Paper =
        year !== null && year < 2013
          ? ['operation_permit', { permit_date: `20.04.${year}` }]
          : ['operation_acceptance_act', { act_date: `14.03.${year}` }];
      const papers = year === null ? given : [...given, dated];
      const built = aSegmentedPackage(papers.length);

      papers.forEach(([type, fields], index) => {
        const document = built.documents[index]!;
        const values = Object.entries(fields);

        built.verification.classify(document.id, aClassification(type));
        if (values.length > 0) {
          built.verification.recordExtractedFields(
            document.id,
            values.map(([key, value]) => aValue(key, value)),
          );
        }
      });
      built.verification.complete();

      return built;
    }

    function issuesOf(
      verification: VerificationPackage,
      kind: string,
    ): readonly ValidationIssue[] {
      return (verification.report?.issues ?? []).filter(
        issue => issue.kind.value === kind,
      );
    }

    const PLAN: Paper = [
      'land_plot_plan',
      { land_category: 'Fərdi yaşayış tikintisi üçün torpaq' },
    ];
    // Two storeys, 7.4 m and 4.2 m spans: inside the notification procedure.
    const LOW_DESIGN: Paper = [
      'sketch_project',
      {
        storeys: '2',
        building_height: '7,4 m',
        span_dimensions: 'A—B 4,20 m; B—C 3,60 m',
      },
    ];
    // A lease-or-use title under items 1.4 and 2.7 (ADR-0028).
    const ORDER: Paper = ['disposal_order', {}];
    const LEASE: Paper = [
      'homestead_land_allocation_decision',
      { issue_date: '12.05.1995' },
    ];

    it('holds a pre-2013 owned house to its title alone', () => {
      const { verification } = aCase(2010, PLAN, LOW_DESIGN, [
        'registration_certificate',
        {},
      ]);

      const decision = verification.provision?.decision;
      expect(decision?.outcome).toBe('Determined');
      expect(
        decision?.outcome === 'Determined' && decision.provision.provision,
      ).toBe('8.0.9.1.2');
      expect(verification.report?.status.value).toBe('OK');
    });

    it('names each paper the provision asks for that the package does not carry', () => {
      const { verification } = aCase(2014, PLAN, LOW_DESIGN, ORDER);

      expect(
        issuesOf(verification, 'MissingDocument').map(
          issue => issue.documentType?.value,
        ),
      ).toEqual([
        'architectural_planning_section',
        'construction_completion_notice',
      ]);
      expect(verification.report?.status.value).toBe('IncompletePackage');
    });

    // "An approved design or an act of acceptance": naming the first would
    // send the applicant for that one.
    it('names no single paper for a group any of several papers answer', () => {
      const { verification } = aCase(
        2010,
        PLAN,
        ['sketch_project', { building_height: '8 m' }],
        LEASE,
      );

      const [missing] = issuesOf(verification, 'MissingDocument');
      expect(missing?.documentType).toBeNull();
      expect(missing?.message).toContain('8.0.9.1.1');
      expect(missing?.message).toContain('approved_design');
      expect(missing?.message).toContain('operation_acceptance_act');
    });

    it('stops asking once any paper of the group is here', () => {
      const { verification } = aCase(
        2010,
        PLAN,
        ['sketch_project', { building_height: '8 m' }],
        LEASE,
        ['operation_acceptance_act', {}],
      );

      expect(issuesOf(verification, 'MissingDocument')).toEqual([]);
    });

    it('says the package carries no title to the land, and names none of the titles', () => {
      const { verification } = aCase(2014, PLAN, LOW_DESIGN);

      const [missing] = issuesOf(verification, 'MissingTitleDocument');
      expect(missing?.documentType).toBeNull();
      expect(missing?.kind.leavesPackageIncomplete).toBe(true);
      expect(verification.report?.status.value).toBe('IncompletePackage');
    });

    // From 2026 the notification reaches the registry through the Urban
    // Planning Committee's system, which nobody has connected: the package is
    // not short of the letter, and the report says the check was not made.
    it('does not ask for the notification of a house built from 2026, and says it was not checked', () => {
      const { verification } = aCase(2026, PLAN, LOW_DESIGN, ORDER, [
        'architectural_planning_section',
        {},
      ]);

      expect(issuesOf(verification, 'MissingDocument')).toEqual([]);
      const notice = issuesOf(verification, 'IntegrationNotConnected').find(
        issue => issue.documentType?.value === 'construction_completion_notice',
      );
      expect(notice?.documentId).toBeNull();
      expect(notice?.kind.isInformational).toBe(true);
    });

    it('asks the inspector which provision applies where a figure could not be read', () => {
      const { verification } = aCase(
        2014,
        PLAN,
        ['sketch_project', { storeys: '2' }],
        ORDER,
      );

      const [undecided] = issuesOf(verification, 'ProvisionUndetermined');
      expect(undecided?.message).toContain('height');
      expect(undecided?.message).toContain('8.0.10.2');
      expect(undecided?.message).toContain('8.0.10.1');
      expect(undecided?.kind.isInformational).toBe(false);
    });

    // Which papers are owed is exactly what is unknown, and listing every
    // candidate's papers as missing would ask for papers no provision of the
    // case needs.
    it('asks for no provision’s papers while it cannot say which provision applies', () => {
      const { verification } = aCase(
        2014,
        PLAN,
        ['sketch_project', { storeys: '2' }],
        ORDER,
      );

      expect(issuesOf(verification, 'MissingDocument')).toEqual([]);
    });

    it('says no provision covers a case every row of the table rules out', () => {
      const { verification } = aCase(
        2010,
        [
          'land_plot_plan',
          { land_category: 'Kənd təsərrüfatı təyinatlı torpaqlar' },
        ],
        ['sketch_project', { building_height: '8 m' }],
        ['registration_certificate', {}],
      );

      const [undecided] = issuesOf(verification, 'ProvisionUndetermined');
      expect(undecided?.message).toContain('No provision');
      expect(undecided?.message).toContain('8.0.9.1.2 by purpose');
    });

    // TC-09 of the acceptance contract: a homestead allocation decision of
    // 2003, where item 2.7 takes one issued before 2001.
    it('holds a title to the window of dates it is a title in', () => {
      const built = aCase(
        2010,
        PLAN,
        ['sketch_project', { building_height: '8 m' }],
        ['homestead_land_allocation_decision', { issue_date: '10.04.2003' }],
      );

      const [invalid] = issuesOf(built.verification, 'TitleDocumentInvalid');
      expect(invalid?.documentId?.equals(built.documents[2]!.id)).toBe(true);
      expect(invalid?.fieldKey?.value).toBe('issue_date');
      expect(invalid?.message).toContain('item 2.7');
      expect(invalid?.kind.isInformational).toBe(false);
    });

    // The customer's answer of 2026-09-16: a title of the other class than
    // the provision is a mismatch (ADR-0028).
    it('says a lease-or-use title does not found a case a plan words as ownership', () => {
      const built = aCase(
        2010,
        [
          'land_plot_plan',
          {
            land_category: 'Fərdi yaşayış tikintisi üçün torpaq',
            right_type: 'Mülkiyyət hüququ',
          },
        ],
        ['sketch_project', { building_height: '8 m' }],
        ['disposal_order', { issue_date: '15.04.1999' }],
      );

      const [invalid] = issuesOf(built.verification, 'TitleDocumentInvalid');
      expect(invalid?.documentId?.equals(built.documents[2]!.id)).toBe(true);
      expect(invalid?.fieldKey).toBeNull();
      expect(invalid?.message).toContain('LeaseOrUse');
      expect(invalid?.message).toContain('item 1.4, 2.7');
      expect(invalid?.message).toContain('8.0.9.1.2');
      expect(invalid?.kind.isInformational).toBe(false);
    });

    it('holds an order alone to 8.0.9.1.1, and finds nothing wrong with its class', () => {
      const { verification } = aCase(
        2010,
        PLAN,
        ['sketch_project', { building_height: '8 m' }],
        ['disposal_order', { issue_date: '15.04.1999' }],
      );

      const decision = verification.provision?.decision;
      expect(
        decision?.outcome === 'Determined' && decision.provision.provision,
      ).toBe('8.0.9.1.1');
      expect(issuesOf(verification, 'TitleDocumentInvalid')).toEqual([]);
      expect(issuesOf(verification, 'MissingDocument')[0]?.message).toContain(
        '8.0.9.1.1',
      );
    });

    it('takes a title dated inside its window', () => {
      const { verification } = aCase(
        2010,
        PLAN,
        ['sketch_project', { building_height: '8 m' }],
        ['homestead_land_allocation_decision', { issue_date: '12.05.1995' }],
      );

      expect(issuesOf(verification, 'TitleDocumentInvalid')).toEqual([]);
    });

    it('says a paper confirmed through a system nobody connected was read and not confirmed', () => {
      const built = aCase(2014, PLAN, LOW_DESIGN, ORDER);

      const [plan] = issuesOf(built.verification, 'IntegrationNotConnected');
      expect(plan?.documentType?.value).toBe('land_plot_plan');
      expect(plan?.documentId?.equals(built.documents[0]!.id)).toBe(true);
      expect(plan?.message).toContain('MQS');
      expect(plan?.kind.isInformational).toBe(true);
    });

    it('says nothing of the kind about a paper that comes only in the envelope', () => {
      const { verification } = aCase(2014, LOW_DESIGN, ORDER);

      expect(issuesOf(verification, 'IntegrationNotConnected')).toEqual([]);
    });

    /*
     * The year the office typed at intake used to date the case before any
     * paper did (ADR-0025). It dates nothing now (ADR-0026): a case no paper
     * dates stays undecided on the year.
     */
    it('does not date the case by the year the office declared at intake', () => {
      const built = aSegmentedPackage(1, {
        declared: DeclaredAtIntake.of({ builtYear: 2010 }),
      });

      expect(built.verification.provision?.parameters.builtYear).toBeNull();
      expect(built.verification.provision?.readings[0]?.source).toBeNull();
    });

    // Worked out from scratch on every run, so a re-run cannot leave a second
    // copy of a finding behind.
    it('publishes the provision it held the package to, before and after the report', () => {
      const built = aSegmentedPackage(1, {
        declared: DeclaredAtIntake.of({ builtYear: 2014 }),
      });

      expect(built.verification.provision?.decision.outcome).toBe('Ambiguous');
    });
  });

  /*
   * The one thing about a package a person put there rather than the engine
   * reading it: what the office declared when it took the submission in.
   *
   * Two questions are asked of it and no others. Does it contradict the profile
   * the operator filed the case under — which is refused, because a policy that
   * does not register this ground cannot verify this case. And does it
   * contradict the papers — which is told to the inspector and never held
   * against the applicant, who did not write it.
   */
  describe('what the office declared when it took the submission in', () => {
    function aValue(
      key: string,
      value: string,
      confidence = 0.9,
    ): ExtractedField {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(confidence),
        PageNumber.first(),
      );
    }

    // A package holding one act of acceptance into operation stating a date —
    // the paper the case is dated by (ADR-0026) — taken in under whatever the
    // office declared about it.
    function aCaseDated(
      actDate: string | null,
      declared: DeclaredAtIntake,
    ): VerificationPackage {
      const built = aSegmentedPackage(1, { declared });
      built.verification.classify(
        built.document.id,
        aClassification('operation_acceptance_act'),
      );
      if (actDate !== null) {
        built.verification.recordExtractedFields(built.document.id, [
          aValue('act_date', actDate, 0.77),
        ]);
      }
      built.verification.complete();

      return built.verification;
    }

    function mismatchesOf(
      verification: VerificationPackage,
    ): readonly ValidationIssue[] {
      return (verification.report?.issues ?? []).filter(
        issue => issue.kind.value === 'DeclaredValueMismatch',
      );
    }

    it('keeps what was declared on the package, apart from anything read', () => {
      const { verification } = aPackage({
        declared: DeclaredAtIntake.of({
          legalBasis: DocumentType.create('disposal_order'),
          builtYear: 1998,
        }),
      });

      expect(verification.declared.legalBasis?.value).toBe('disposal_order');
      expect(verification.declared.builtYear).toBe(1998);
    });

    it('takes a submission that declares nothing, which is the ordinary one', () => {
      const { verification } = aPackage();

      expect(verification.declared.legalBasis).toBeNull();
      expect(verification.declared.builtYear).toBeNull();
    });

    it('takes a ground the profile registers a right on', () => {
      expect(() =>
        aPackage({
          declared: DeclaredAtIntake.of({
            legalBasis: DocumentType.create('disposal_order'),
          }),
        }),
      ).not.toThrow();
    });

    /*
     * Not a second-guessing of the operator's choice of profile — that choice
     * is theirs and nothing here overrules it. It is the two halves of one
     * statement contradicting each other: a case founded on a paper this policy
     * does not register is a case this policy cannot verify.
     */
    it('refuses a ground the chosen profile does not register a right on', () => {
      expect(() =>
        aPackage({
          declared: DeclaredAtIntake.of({
            legalBasis: DocumentType.create('payment_receipt'),
          }),
        }),
      ).toThrow(LegalBasisNotInProfileException);
    });

    // The refusal is only useful if it says what would have been accepted.
    it('names the grounds the profile does register when it refuses one', () => {
      expect(() =>
        aPackage({
          declared: DeclaredAtIntake.of({
            legalBasis: DocumentType.create('payment_receipt'),
          }),
        }),
      ).toThrow(/disposal_order/u);
    });

    it('reports a declared year the papers contradict', () => {
      const verification = aCaseDated(
        '18.12.2025',
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      expect(mismatchesOf(verification)).toHaveLength(1);
      expect(mismatchesOf(verification)[0]!.message).toContain('2005');
      expect(mismatchesOf(verification)[0]!.message).toContain('2025');
    });

    // Filed against the reading, so settling it means opening the sheet the
    // figure was read off. There is no such anchor on the other side: nothing
    // was read at the counter.
    it('files the disagreement against the reading it disagrees with', () => {
      const verification = aCaseDated(
        '18.12.2025',
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      const told = mismatchesOf(verification)[0]!;
      expect(told.documentType?.value).toBe('operation_acceptance_act');
      expect(told.fieldKey?.value).toBe('act_date');
      expect(told.pageNumber?.value).toBe(1);
      expect(told.confidence?.value).toBe(0.77);
    });

    /*
     * Neither side is presumed right — a year is as easy to mistype at a
     * counter as it is to misread off a scan — and the applicant did not write
     * the declaration. Scoring the package down for it would hold them to
     * something somebody else typed.
     */
    it('states the disagreement for the record and never against the package', () => {
      const verification = aCaseDated(
        '18.12.2025',
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      expect(mismatchesOf(verification)[0]!.kind.isInformational).toBe(true);
    });

    it('says nothing where the declaration and the papers agree', () => {
      const verification = aCaseDated(
        '18.12.2025',
        DeclaredAtIntake.of({ builtYear: 2025 }),
      );

      expect(mismatchesOf(verification)).toHaveLength(0);
    });

    // A declaration nothing contradicts is silence. A package whose papers
    // state no year has nothing to set the declaration against.
    it('says nothing where the papers state no year at all', () => {
      const verification = aCaseDated(
        null,
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      expect(mismatchesOf(verification)).toHaveLength(0);
    });

    it('says nothing where the office declared no year', () => {
      const verification = aCaseDated('18.12.2025', DeclaredAtIntake.none());

      expect(mismatchesOf(verification)).toHaveLength(0);
    });

    // Worked out from scratch on every run, so a re-run cannot leave two of
    // them behind.
    it('tells it once, however many times the report is compiled', () => {
      const built = aSegmentedPackage(1, {
        declared: DeclaredAtIntake.of({ builtYear: 2005 }),
      });
      built.verification.classify(
        built.document.id,
        aClassification('operation_acceptance_act'),
      );
      built.verification.recordExtractedFields(built.document.id, [
        aValue('act_date', '18.12.2025'),
      ]);
      built.verification.complete();

      expect(mismatchesOf(built.verification)).toHaveLength(1);
    });
  });

  describe('knowing when every stage has run', () => {
    it('is fully processed once each file is read and each document placed and pulled from', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));
      verification.recordExtractedFields(document.id, [aField('document_no')]);

      expect(verification.isFullyProcessed).toBe(true);
    });

    it('is not fully processed while a page is still unread', () => {
      const { verification, file } = aStartedPackage();
      verification.splitIntoPages(file.id, [aPage(1), aPage(2)]);

      expect(verification.isFullyProcessed).toBe(false);
    });

    it('is not fully processed while a file has not been read into its documents', () => {
      const { verification } = aReadPackage(2);

      expect(verification.isFullyProcessed).toBe(false);
    });

    it('is not fully processed while a document is still unplaced by the classifier', () => {
      const { verification } = aSegmentedPackage();

      expect(verification.isFullyProcessed).toBe(false);
    });

    it('asks for no fields from a document the classifier could not place', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(
        document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(verification.isFullyProcessed).toBe(true);
    });

    it('is not fully processed while one document of several is still behind', () => {
      const { verification, documents } = aSegmentedPackage(2);
      verification.classify(documents[0]!.id, aClassification('identity_card'));
      verification.recordExtractedFields(documents[0]!.id, [
        aField('document_no'),
      ]);

      expect(verification.isFullyProcessed).toBe(false);
    });
  });

  describe('when the documents are held against each other', () => {
    const IDENTITY = VerificationProfile.CADASTRE.crossChecks[0]!;

    // Two documents of one submission, each carrying the fields the identity
    // check reaches for: the card's surname and given name, and the one full
    // name the application is made in.
    function aSubmission(applicantName = 'Əliyeva Rübabə') {
      const built = aSegmentedPackage(2);
      const [card, application] = built.documents as [Document, Document];

      built.verification.classify(card.id, aClassification('identity_card'));
      built.verification.recordExtractedFields(card.id, [
        aNamed('last_name', 'ƏLİYEVA'),
        aNamed('first_name', 'Rübabə'),
      ]);
      built.verification.classify(
        application.id,
        aClassification('application'),
      );
      built.verification.recordExtractedFields(application.id, [
        aNamed('applicant_name', applicantName),
      ]);
      built.verification.commit();

      return { ...built, card, application };
    }

    function aNamed(key: string, value: string): ExtractedField {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(0.9),
        PageNumber.first(),
      );
    }

    function aVerdict(
      verification: VerificationPackage,
      verdict: CrossCheckVerdict,
      confidence = 0.9,
    ): CrossCheck {
      return CrossCheck.of({
        key: IDENTITY.key,
        verdict,
        confidence: Confidence.of(confidence),
        note: 'compared in a test',
        values: verification.valuesFor(IDENTITY),
      });
    }

    it('offers every value the check reaches for, in the order it names them', () => {
      const { verification } = aSubmission();

      expect(
        verification.valuesFor(IDENTITY).map(value => value.value.value),
      ).toEqual(['ƏLİYEVA', 'Rübabə', 'Əliyeva Rübabə']);
    });

    it('offers nothing off a document the classifier could not place', () => {
      const built = aSegmentedPackage(1);
      built.verification.classify(
        built.document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(built.verification.valuesFor(IDENTITY)).toEqual([]);
    });

    it('will not make a check the package has only one document for', () => {
      const built = aSegmentedPackage(1);
      built.verification.classify(
        built.document.id,
        aClassification('identity_card'),
      );
      built.verification.recordExtractedFields(built.document.id, [
        aNamed('last_name', 'ƏLİYEVA'),
        aNamed('first_name', 'Rübabə'),
      ]);

      expect(built.verification.canMake(IDENTITY)).toBe(false);
    });

    it('makes a check the moment two documents can answer it', () => {
      const { verification } = aSubmission();

      expect(verification.canMake(IDENTITY)).toBe(true);
    });

    it('records the answer and says so', () => {
      const { verification } = aSubmission();

      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.MATCH),
      );

      expect(verification.hasMade(IDENTITY.key)).toBe(true);
      expect(typesOf(verification)).toEqual(['verification.CrossCheckMade']);
    });

    it('keeps one answer per check, so a re-run replaces rather than repeats', () => {
      const { verification } = aSubmission();

      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.MATCH),
      );
      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.MISMATCH),
      );

      expect(verification.crossChecks).toHaveLength(1);
      expect(verification.crossChecks[0]?.verdict).toBe(
        CrossCheckVerdict.MISMATCH,
      );
    });

    it('refuses a check this profile does not declare', () => {
      const { verification } = aSubmission();
      const foreign = CrossCheck.of({
        key: CrossCheckKey.create('shoe_size'),
        verdict: CrossCheckVerdict.MATCH,
        confidence: Confidence.of(0.9),
        note: '',
        values: verification.valuesFor(IDENTITY),
      });

      expect(() => verification.recordCrossCheck(foreign)).toThrow(
        CrossCheckNotInProfileException,
      );
    });

    it('refuses a check once the run is over', () => {
      const { verification } = aSubmission();
      const check = aVerdict(verification, CrossCheckVerdict.MATCH);
      verification.complete();

      expect(() => verification.recordCrossCheck(check)).toThrow(
        PackageNotUnderWayException,
      );
    });

    it('reports a disagreement as a finding against the package', () => {
      const { verification } = aSubmission('Məmmədov Elçin');
      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.MISMATCH),
      );

      verification.complete();

      const found = verification.report?.issues.find(
        issue => issue.kind.value === 'FieldMismatch',
      );
      expect(found?.checkKey?.value).toBe('applicant_identity');
      expect(verification.report?.status.value).not.toBe('OK');
    });

    it('files the finding on the document the profile named first', () => {
      const { verification, card } = aSubmission('Məmmədov Elçin');
      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.MISMATCH),
      );

      verification.complete();

      const found = verification.report?.issues.find(
        issue => issue.kind.value === 'FieldMismatch',
      );
      expect(found?.documentId?.value).toBe(card.id.value);
      expect(found?.fieldKey?.value).toBe('last_name');
    });

    it('reports a check nobody could decide, because the inspector has to', () => {
      const { verification } = aSubmission();
      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.UNCLEAR),
      );

      verification.complete();

      expect(
        verification.report?.issues.filter(
          issue => issue.kind.value === 'FieldMismatch',
        ),
      ).toHaveLength(1);
    });

    it('says nothing about a check that agreed', () => {
      const { verification } = aSubmission();
      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.MATCH),
      );

      verification.complete();

      expect(
        verification.report?.issues.filter(
          issue => issue.kind.value === 'FieldMismatch',
        ),
      ).toEqual([]);
    });

    it('works the findings out afresh, so an answered disagreement drops out', () => {
      const { verification } = aSubmission();
      verification.recordCrossCheck(
        aVerdict(verification, CrossCheckVerdict.MISMATCH),
      );
      verification.complete();

      const reread = VerificationPackage.restore({
        id: verification.id,
        version: 2,
        profile: VerificationProfile.CADASTRE,
        declared: DeclaredAtIntake.none(),
        status: PackageStatus.PROCESSING,
        files: verification.files,
        documents: verification.documents,
        crossChecks: verification.crossChecks,
        registryChecks: verification.registryChecks,
        archiveSearchApproval: null,
        report: verification.report,
      });
      reread.recordCrossCheck(aVerdict(reread, CrossCheckVerdict.MATCH));
      reread.complete();

      expect(
        reread.report?.issues.filter(
          issue => issue.kind.value === 'FieldMismatch',
        ),
      ).toEqual([]);
    });
  });

  describe('the events it has yet to hand over', () => {
    it('records one for the submission and nothing else', () => {
      const { verification } = aPackage();

      expect(typesOf(verification)).toEqual(['verification.PackageSubmitted']);
    });

    it('keeps them in the order the pipeline decided them', () => {
      const { verification, file } = aPackage();
      const page = aPage(1);

      verification.start();
      verification.splitIntoPages(file.id, [page]);
      verification.recordRecognition(file.id, page.id, anOcrResult());
      const document = aDocumentOf(file.id, range(1, 1));
      verification.segmentIntoDocuments(file.id, [document]);
      verification.classify(document.id, aClassification('identity_card'));
      verification.complete();

      expect(typesOf(verification)).toEqual([
        'verification.PackageSubmitted',
        'verification.VerificationStarted',
        'verification.SourceFileSplitIntoPages',
        'verification.PageRecognised',
        'verification.SourceFileSegmented',
        'verification.DocumentClassified',
        'verification.ReportCompiled',
        'verification.VerificationCompleted',
      ]);
    });

    it('reads them without clearing them', () => {
      const { verification } = aPackage();

      verification.getUncommittedEvents();

      expect(verification.getUncommittedEvents()).toHaveLength(1);
    });

    it('forgets them once they have been handed over', () => {
      const { verification } = aPackage();

      verification.commit();

      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it('records again after a commit', () => {
      const { verification } = aPackage();
      verification.commit();

      verification.start();

      expect(typesOf(verification)).toEqual([
        'verification.VerificationStarted',
      ]);
    });
  });

  // ── The archive register ─────────────────────────────────────────────────
  // What the papers say, held against what the record of the registration
  // says. The register is not a third document of the submission, and its
  // silence is not evidence about it (ADR-0009).
  describe('when the property is looked up in the archive register', () => {
    const SPEC = VerificationProfile.CADASTRE.registryChecks[0]!;

    const ADDRESS = 'Zığ qəsəbəsi, Əliyev küçəsi 12';

    function valued(key: string, value: string, confidence = 0.95) {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(confidence),
        PageNumber.first(),
      );
    }

    // Three sheets, three documents: the application the address is read off,
    // and the two papers the other attributes come from.
    function aPackageOfRecord(options: { address?: string } = {}) {
      const built = aSegmentedPackage(3);
      const [application, certificate, plan] = built.documents;

      built.verification.classify(
        application!.id,
        aClassification('application'),
      );
      built.verification.classify(
        certificate!.id,
        aClassification('archive_certificate'),
      );
      built.verification.classify(plan!.id, aClassification('land_plot_plan'));

      if (options.address !== null) {
        built.verification.recordExtractedFields(application!.id, [
          valued('property_address', options.address ?? ADDRESS),
        ]);
      }
      built.verification.recordExtractedFields(certificate!.id, [
        valued('owner_name', 'Əliyeva Rübabə'),
      ]);
      built.verification.recordExtractedFields(plan!.id, [
        valued('cadastral_number', '40-12-345-67'),
        valued('plot_area', '600 m²'),
      ]);
      built.verification.commit();

      return { ...built, application: application! };
    }

    function anAnswer(
      verification: VerificationPackage,
      outcome: RegistryOutcome,
      attributes: readonly RegistryAttribute[] = [],
    ): RegistryCheck {
      return RegistryCheck.of({
        key: SPEC.key,
        outcome,
        confidence: Confidence.of(0.95),
        note: 'Register 1-12345 holds this address.',
        asked: verification.askedOf(SPEC)!,
        reference: 'folder 14, pp. 01-dən 30',
        attributes,
      });
    }

    it('asks about the address the application is made under', () => {
      const { verification } = aPackageOfRecord();

      expect(verification.askedOf(SPEC)?.value.value).toBe(ADDRESS);
    });

    /*
     * The profile names the papers an address may be read off in the order it
     * believes them, and the first one the package states is the one asked.
     * This is not a nicety: in both real submissions run against this profile
     * the application form's address line went unread and a second sheet
     * classified as an application carried a mangled one — "Xetan uue, Burome
     * 98. 5-862 saha" — so the register was asked about nothing (ADR-0010).
     */
    it('prefers the surveyed plan-scheme over the hand-filled application', () => {
      const built = aSegmentedPackage(2);
      const [application, plan] = built.documents;

      built.verification.classify(
        application!.id,
        aClassification('application'),
      );
      built.verification.classify(plan!.id, aClassification('land_plot_plan'));
      built.verification.recordExtractedFields(application!.id, [
        valued('property_address', 'Xetan uue, Burome 98. 5-862 saha'),
      ]);
      built.verification.recordExtractedFields(plan!.id, [
        valued('property_address', ADDRESS),
      ]);
      built.verification.commit();

      expect(built.verification.askedOf(SPEC)?.value.value).toBe(ADDRESS);
    });

    // And falls through to it when no better paper states one, which is what
    // keeps the ordering a preference rather than a requirement.
    it('falls back to the application when no better paper states an address', () => {
      const { verification } = aPackageOfRecord();

      expect(verification.askedOf(SPEC)?.documentType.value).toBe(
        'application',
      );
    });

    it('offers the register everything the package says about the property', () => {
      const { verification } = aPackageOfRecord();

      expect(verification.statedFor(SPEC).map(stated => stated.name)).toEqual([
        'ownerName',
        'cadastralNumber',
        'plotArea',
      ]);
    });

    // Unlike a cross-check it needs one document, not two: the other side of
    // the comparison was never in the envelope.
    it('can be asked from a single document', () => {
      const { verification } = aPackageOfRecord();

      expect(verification.canAsk(SPEC)).toBe(true);
    });

    it('is not asked at all when the value it asks about was never read', () => {
      const built = aSegmentedPackage(1);
      built.verification.classify(
        built.document.id,
        aClassification('application'),
      );

      expect(built.verification.canAsk(SPEC)).toBe(false);
    });

    it('refuses an answer to a check the profile does not declare', () => {
      const { verification } = aPackageOfRecord();
      const foreign = RegistryCheck.of({
        key: RegistryCheckKey.create('somebody_elses_rule'),
        outcome: RegistryOutcome.CONFIRMED,
        confidence: Confidence.of(0.9),
        note: 'n/a',
        asked: verification.askedOf(SPEC)!,
      });

      expect(() => verification.recordRegistryCheck(foreign)).toThrow(
        RegistryCheckNotInProfileException,
      );
    });

    it('holds one answer per check, so a re-run replaces rather than adds', () => {
      const { verification } = aPackageOfRecord();

      verification.recordRegistryCheck(
        anAnswer(verification, RegistryOutcome.NOT_FOUND),
      );
      verification.recordRegistryCheck(
        anAnswer(verification, RegistryOutcome.CONFIRMED),
      );

      expect(verification.registryChecks).toHaveLength(1);
      expect(verification.registryChecks[0]?.outcome.confirms).toBe(true);
    });

    it('says nothing in the report when the record confirms the property', () => {
      const { verification } = aPackageOfRecord();

      verification.recordRegistryCheck(
        anAnswer(verification, RegistryOutcome.CONFIRMED),
      );
      verification.complete();

      expect(kindsOf(verification)).not.toContain('RegistryMismatch');
      expect(kindsOf(verification)).not.toContain('RegistryUnconfirmed');
    });

    it('files a finding against the package when the record says otherwise', () => {
      const { verification, application } = aPackageOfRecord();
      const differing = RegistryAttribute.of({
        name: 'ownerName',
        agrees: false,
        submitted: verification.statedFor(SPEC)[0]!.value,
        recorded: 'Quliyev Rəşad Tofiq oğlu',
      });

      verification.recordRegistryCheck(
        anAnswer(verification, RegistryOutcome.DIFFERS, [differing]),
      );
      verification.complete();

      const issue = verification.report?.issues.find(
        one => one.kind.value === 'RegistryMismatch',
      );

      expect(issue).toBeDefined();
      // Filed against the sheet the inspector opens to see what the package
      // claims, not against the register.
      expect(issue?.documentId?.value).toBe(application.id.value);
      expect(issue?.kind.isInformational).toBe(false);
      expect(issue?.message).toContain('Quliyev Rəşad Tofiq oğlu');
    });

    // The register holds the privatisations of the 1990s and 2000s, not
    // everything that exists, so an absence is told and never counted.
    it('tells the inspector, and counts nothing, when there is no record', () => {
      const { verification } = aPackageOfRecord();

      verification.recordRegistryCheck(
        anAnswer(verification, RegistryOutcome.NOT_FOUND),
      );
      verification.complete();

      const issue = verification.report?.issues.find(
        one => one.kind.value === 'RegistryUnconfirmed',
      );

      expect(issue).toBeDefined();
      expect(issue?.kind.isInformational).toBe(true);
    });

    it('tells the inspector when more than one record answers', () => {
      const { verification } = aPackageOfRecord();

      verification.recordRegistryCheck(
        anAnswer(verification, RegistryOutcome.AMBIGUOUS),
      );
      verification.complete();

      expect(kindsOf(verification)).toContain('RegistryUnconfirmed');
    });

    // A field the register never carried is silence, and silence is not a
    // disagreement.
    it('does not read a field the record is silent about as a difference', () => {
      const { verification } = aPackageOfRecord();
      const silent = RegistryAttribute.of({
        name: 'cadastralNumber',
        agrees: false,
        submitted: verification.statedFor(SPEC)[1]!.value,
        recorded: null,
      });

      verification.recordRegistryCheck(
        anAnswer(verification, RegistryOutcome.CONFIRMED, [silent]),
      );
      verification.complete();

      expect(kindsOf(verification)).not.toContain('RegistryMismatch');
    });

    it('is not fully processed until the register has been asked', () => {
      const { verification } = aPackageOfRecord();

      expect(verification.isFullyProcessed).toBe(false);
    });

    function kindsOf(verification: VerificationPackage): readonly string[] {
      return (verification.report?.issues ?? []).map(issue => issue.kind.value);
    }
  });
  /*
   * Where the submission stands: what has to happen to it next, worked out from
   * where the pipeline got to, what the run found and what the register was
   * asked (ADR-0014). Nothing sets it, so these are the transitions of the
   * package itself rather than of a field somebody maintains.
   */
  const OF_RECORD = VerificationProfile.CADASTRE.registryChecks[0]!;

  function stated(key: string, value: string): ExtractedField {
    return ExtractedField.of(
      FieldKey.create(key),
      FieldValue.create(value),
      Confidence.of(0.95),
      PageNumber.first(),
    );
  }

  /*
   * A package an inspector should have nothing to be told about, each paper
   * placed and attested: the plan of the plot and the sketch design every
   * package carries, a title to the land, and the act of acceptance into
   * operation that dates it. Accepted in 2010, with a
   * design 7.4 m tall and a plot owned and designated for housing, the case
   * falls under 8.0.9.1.2, which asks for nothing beyond the title (ADR-0025).
   * The plan-scheme states the address, so the register has something to be
   * asked about, and prints its QR code, so the check by QR code has something
   * to be made on (ADR-0028). `extraSheets` more are segmented and left unplaced, for a spec
   * to do with as it needs.
   */
  function aCompletePackage(extraSheets = 0) {
    const built = aSegmentedPackage(4 + extraSheets);
    const [plan, design, title, act] = built.documents;

    built.verification.classify(plan!.id, aClassification('land_plot_plan'));
    built.verification.classify(design!.id, aClassification('sketch_project'));
    built.verification.classify(
      title!.id,
      aClassification('registration_certificate'),
    );
    built.verification.recordExtractedFields(plan!.id, [
      stated('property_address', 'Zığ qəsəbəsi, Əliyev küçəsi 12'),
      stated('land_category', 'Fərdi yaşayış tikintisi üçün torpaq'),
      stated('qr_code', 'https://e-emdk.gov.az/plan/RN-2010-000112'),
    ]);
    built.verification.recordExtractedFields(design!.id, [
      stated('building_height', '7,4 m'),
    ]);
    built.verification.classify(
      act!.id,
      aClassification('operation_acceptance_act'),
    );
    built.verification.recordExtractedFields(act!.id, [
      stated('act_date', '14.03.2010'),
    ]);

    return built;
  }

  function anArchiveAnswer(verification: VerificationPackage): RegistryCheck {
    return RegistryCheck.of({
      key: OF_RECORD.key,
      outcome: RegistryOutcome.CONFIRMED,
      confidence: Confidence.of(0.95),
      note: 'the register holds this address',
      asked: verification.askedOf(OF_RECORD)!,
      reference: 'folder 14, pp. 01-dən 30',
      attributes: [],
    });
  }

  // A finished package whose archive search is waiting for somebody to sign
  // for it: the clean envelope, the register asked and answered, the run over.
  function anApprovablePackage() {
    const built = aCompletePackage();
    built.verification.recordRegistryCheck(anArchiveAnswer(built.verification));
    built.verification.complete();

    return built;
  }

  /*
   * The run a package gets after a file is added to it: only the new file is
   * read, because what was read off each of the others on its own still stands
   * — and then the register is asked again and the report compiled afresh
   * (ADR-0013).
   *
   * The new sheet is placed as a type the package already answers, so what the
   * run finds is a second document of that type. That is an observation and
   * never a finding against the package, which is what leaves the report clean
   * and the submission waiting on the one thing this set is about.
   */
  function rerun(verification: VerificationPackage): void {
    verification.start();

    for (const file of verification.files) {
      if (file.isSplit) continue;

      const page = aPage(1);
      verification.splitIntoPages(file.id, [page]);
      verification.recordRecognition(file.id, page.id, anOcrResult());

      const document = aDocumentOf(file.id, PageRange.single(page.number));
      verification.segmentIntoDocuments(file.id, [document]);
      verification.classify(document.id, aClassification(REQUIRED_TYPES[0]!));
    }

    verification.recordRegistryCheck(anArchiveAnswer(verification));
    verification.complete();
  }

  /*
   * The stage that closes a field one paper did not yield with the value
   * another paper of the same envelope states, and the one that lays the
   * archive register's agreement onto the reading it agreed with (ADR-0023).
   */
  describe('when a field is closed from elsewhere in the package', () => {
    const ADDRESS = VerificationProfile.CADASTRE.crossChecks.find(
      spec => spec.key.value === 'property_address',
    )!;
    const IDENTITY = VerificationProfile.CADASTRE.crossChecks.find(
      spec => spec.key.value === 'applicant_identity',
    )!;
    const OF_RECORD = VerificationProfile.CADASTRE.registryChecks[0]!;

    const ADDRESS_ON_THE_PLAN = 'Zığ qəsəbəsi, Əliyev küçəsi 12';

    function read(
      key: string,
      value: string,
      confidence = 0.9,
      page = 1,
    ): ExtractedField {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(confidence),
        PageNumber.of(page),
      );
    }

    /*
     * A submission whose sketch design yielded a project name and no address,
     * while the plan-scheme — which the profile believes first — prints the
     * address legibly. This is the case the customer named: the answer is in
     * the envelope and the inspector was shown a blank.
     */
    function aSubmission(
      states: readonly (readonly [string, readonly ExtractedField[]])[] = [
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 2)]],
      ],
    ) {
      const built = aSegmentedPackage(states.length);

      for (const [index, [type, fields]] of states.entries()) {
        const document = built.documents[index]!;

        built.verification.classify(document.id, aClassification(type));
        if (fields.length > 0) {
          built.verification.recordExtractedFields(document.id, fields);
        }
      }
      built.verification.commit();

      return {
        ...built,
        typed: (type: string) =>
          built.documents[states.findIndex(([key]) => key === type)]!,
      };
    }

    function fieldOn(
      verification: VerificationPackage,
      document: Document,
      key: string,
    ): ExtractedField | undefined {
      return verification
        .documentWith(document.id)
        .fields.find(field => field.key.value === key);
    }

    function anAgreement(
      verification: VerificationPackage,
      verdict = CrossCheckVerdict.MATCH,
    ): CrossCheck {
      return CrossCheck.of({
        key: ADDRESS.key,
        verdict,
        confidence: Confidence.of(0.9),
        note: 'compared in a test',
        values: verification.valuesFor(ADDRESS),
      });
    }

    it('closes the field with the value another paper of the package states', () => {
      const built = aSubmission();

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'property_address',
        )?.value.value,
      ).toBe(ADDRESS_ON_THE_PLAN);
    });

    it('marks it as a value this paper did not yield, and names the paper that did', () => {
      const built = aSubmission();

      built.verification.gatherFromThePackage();

      const field = fieldOn(
        built.verification,
        built.typed('sketch_project'),
        'property_address',
      );
      expect(field?.origin).toBe(FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT);
      expect(field?.wasReadHere).toBe(false);
      expect(
        field?.takenFrom?.documentId.equals(built.typed('land_plot_plan').id),
      ).toBe(true);
      expect(field?.takenFrom?.documentType.value).toBe('land_plot_plan');
      expect(field?.takenFrom?.fieldKey.value).toBe('property_address');
    });

    /*
     * The sheet the value is printed on belongs to the paper that prints it,
     * and this document has none. A number here would send an inspector to a
     * page of the wrong document — worse than sending them nowhere (ADR-0023).
     */
    it('gives it no sheet of this document, and the source keeps its own', () => {
      const built = aSubmission();

      built.verification.gatherFromThePackage();

      const field = fieldOn(
        built.verification,
        built.typed('sketch_project'),
        'property_address',
      );
      expect(field?.foundOn).toBeNull();
      expect(field?.takenFrom?.foundOn.value).toBe(1);
    });

    it('never makes it surer than the reading it was copied from', () => {
      const built = aSubmission([
        [
          'land_plot_plan',
          [read('property_address', ADDRESS_ON_THE_PLAN, 0.6)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 2)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'property_address',
        )?.confidence.value,
      ).toBeLessThan(0.6);
    });

    it('leaves a field the package says nothing about elsewhere empty', () => {
      const built = aSubmission();

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'total_area',
        ),
      ).toBeUndefined();
    });

    /*
     * A field outside every cross-check has no map saying another paper prints
     * the same value — matching two keys that happen to be spelled alike would
     * be a rule nobody wrote.
     */
    it('leaves a field no cross-check maps onto another paper empty', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('plan_date', '12.03.2019')]],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 2)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'approval_date',
        ),
      ).toBeUndefined();
    });

    /*
     * The keys the two drawings gained from the acceptance contract go through
     * the same gate as the old ones: a value is carried only where a check says
     * two papers print the same value. None of the new keys is in a check —
     * deliberately, since nothing in the profile says the plan's issuing office
     * and the certificate's are one office — so none of them is carried, and an
     * inspector reading a blank is reading a blank the package left.
     */
    it('carries none of the new fields, because no check maps them onto another paper', () => {
      const built = aSubmission([
        [
          'archive_certificate',
          [read('issuing_authority', 'Bakı Şəhər Arxivi')],
        ],
        ['land_plot_plan', [read('plan_scale', '1:500', 0.9, 2)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('land_plot_plan'),
          'issuing_authority',
        ),
      ).toBeUndefined();
    });

    // The plain case for the new keys, and the one the report has to keep
    // saying: the paper does not print it, nothing else in the package prints
    // it, and the field stays empty rather than being filled in from the
    // nearest plausible neighbour.
    it('leaves a new field no paper of the package states empty', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 2)]],
      ]);

      built.verification.gatherFromThePackage();

      for (const key of ['easements', 'turning_points', 'qr_code']) {
        expect(
          fieldOn(built.verification, built.typed('land_plot_plan'), key),
        ).toBeUndefined();
      }
      for (const key of ['built_up_area', 'datum_level', 'span_dimensions']) {
        expect(
          fieldOn(built.verification, built.typed('sketch_project'), key),
        ).toBeUndefined();
      }
    });

    /*
     * The mechanic the contract's new keys must not disturb. The sketch design
     * now declares nineteen fields instead of seven, and the address is still
     * the one of them a check maps onto the plan-scheme — so it is still the
     * one, and the only one, that arrives from it.
     */
    it('still carries the address onto a sketch design of nineteen fields', () => {
      const built = aSubmission();

      built.verification.gatherFromThePackage();

      const sketch = built.typed('sketch_project');
      const carried = built.verification
        .documentWith(sketch.id)
        .fields.filter(
          field => field.origin === FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT,
        );

      expect(carried.map(field => field.key.value)).toEqual([
        'property_address',
      ]);
      expect(carried[0]?.value.value).toBe(ADDRESS_ON_THE_PLAN);
      expect(carried[0]?.takenFrom?.documentType.value).toBe('land_plot_plan');
    });

    it('never overwrites what the paper itself yielded', () => {
      const own = 'Zığ qəsəbəsi, Əliyev küçəsi 99';
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        ['sketch_project', [read('property_address', own, 0.5, 2)]],
      ]);

      built.verification.gatherFromThePackage();

      const field = fieldOn(
        built.verification,
        built.typed('sketch_project'),
        'property_address',
      );
      expect(field?.value.value).toBe(own);
      expect(field?.origin).toBe(FieldOrigin.READ_ON_THIS_DOCUMENT);
    });

    /*
     * `applicant_identity` names the surname *and* the given name on the
     * identity card against the one full name on the application. Nothing there
     * is the same value as anything else, and carrying the application's full
     * name into the card's surname would invent a reading out of a rule that
     * never said the two were equal.
     */
    it('carries nothing across a check that composes several fields of one paper', () => {
      const built = aSubmission([
        ['application', [read('applicant_name', 'Əliyeva Rübabə Kavı qızı')]],
        ['identity_card', [read('document_no', 'AZE1234567', 0.9, 2)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(IDENTITY.isOneValueAcrossPapers).toBe(false);
      expect(
        fieldOn(built.verification, built.typed('identity_card'), 'last_name'),
      ).toBeUndefined();
      expect(
        fieldOn(built.verification, built.typed('identity_card'), 'first_name'),
      ).toBeUndefined();
    });

    it('carries a value across a check that does name one value per paper', () => {
      expect(ADDRESS.isOneValueAcrossPapers).toBe(true);
    });

    /*
     * Two papers printing two different addresses is `FieldMismatch`, which the
     * report already states. Choosing one of them would replace a disagreement
     * with a guess and make the report read better than the package is.
     */
    it('closes nothing when the papers that print the value do not agree', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        [
          'application',
          [read('property_address', 'Xətai rayonu, Neftçilər 4', 0.9, 2)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 3)]],
      ]);
      built.verification.recordCrossCheck(
        anAgreement(built.verification, CrossCheckVerdict.MISMATCH),
      );

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'property_address',
        ),
      ).toBeUndefined();
    });

    // No check was made — two papers state it and the stage never ran — so the
    // engine's own rule decides, and it has to be unanimous.
    it('closes nothing when no check was made and the readings do not read alike', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        [
          'application',
          [read('property_address', 'Xətai rayonu, Neftçilər 4', 0.9, 2)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 3)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'property_address',
        ),
      ).toBeUndefined();
    });

    /*
     * Which source, where there are several, is decided and not stumbled on:
     * the surest reading first. Here the archive certificate was read better
     * than the plan-scheme, though the profile names the plan first.
     */
    it('copies the surest of the readings that state it', () => {
      const built = aSubmission([
        [
          'land_plot_plan',
          [read('property_address', ADDRESS_ON_THE_PLAN, 0.6)],
        ],
        [
          'archive_certificate',
          [read('property_address', ADDRESS_ON_THE_PLAN, 0.95, 2)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 3)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'property_address',
        )?.takenFrom?.documentType.value,
      ).toBe('archive_certificate');
    });

    // Read equally well, so the profile's own order of trust decides — the same
    // order a registry check's subject is walked in (ADR-0010).
    it('falls back on the order the profile names the papers in', () => {
      const built = aSubmission([
        [
          'archive_certificate',
          [read('property_address', ADDRESS_ON_THE_PLAN)],
        ],
        [
          'land_plot_plan',
          [read('property_address', ADDRESS_ON_THE_PLAN, 0.9, 2)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 3)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'property_address',
        )?.takenFrom?.documentType.value,
      ).toBe('land_plot_plan');
    });

    /*
     * The whole point of marking it. A carried-over value on both sides of a
     * check would compare a value with its own source, agree every time, and
     * turn a report that says the papers disagree into one that says they do
     * not.
     */
    it('does not let a carried-over value stand as a paper the check compares', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        [
          'application',
          [read('property_address', ADDRESS_ON_THE_PLAN, 0.9, 2)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 3)]],
      ]);
      built.verification.recordCrossCheck(anAgreement(built.verification));

      built.verification.gatherFromThePackage();

      expect(
        built.verification
          .valuesFor(ADDRESS)
          .map(value => value.documentType.value),
      ).toEqual(['application', 'land_plot_plan']);
    });

    it('does not turn a disagreement into an agreement by closing a third paper', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        [
          'application',
          [read('property_address', 'Xətai rayonu, Neftçilər 4', 0.9, 2)],
        ],
        [
          'archive_certificate',
          [read('property_address', ADDRESS_ON_THE_PLAN, 0.9, 3)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 4)]],
      ]);
      built.verification.recordCrossCheck(
        anAgreement(built.verification, CrossCheckVerdict.MISMATCH),
      );

      built.verification.gatherFromThePackage();

      expect(built.verification.crossChecks[0]?.verdict).toBe(
        CrossCheckVerdict.MISMATCH,
      );
      expect(built.verification.valuesFor(ADDRESS)).toHaveLength(3);
    });

    // The register is asked what one of the package's papers states. A value no
    // paper of the profile's subject list prints is not the package stating an
    // address, however sure the engine is that the envelope holds one.
    it('does not offer a carried-over value to the archive register', () => {
      const built = aSubmission([
        [
          'archive_certificate',
          [read('property_address', ADDRESS_ON_THE_PLAN)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 2)]],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        fieldOn(
          built.verification,
          built.typed('sketch_project'),
          'property_address',
        )?.origin,
      ).toBe(FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT);
      expect(built.verification.askedOf(OF_RECORD)).toBeNull();
    });

    /*
     * A finding here says a reading was doubtful and sends the inspector to the
     * sheet it was made on. A carried-over value was read on another paper
     * entirely, and that reading is already reported against the document it
     * was made on — filing it twice would put the inspector in front of a page
     * with nothing on it to look at.
     */
    it('files no low-confidence finding against a value it did not read', () => {
      const built = aSubmission([
        [
          'land_plot_plan',
          [read('property_address', ADDRESS_ON_THE_PLAN, 0.85)],
        ],
        ['sketch_project', [read('project_name', 'Fərdi yaşayış evi', 0.9, 2)]],
      ]);
      const sketch = built.typed('sketch_project');

      built.verification.gatherFromThePackage();
      built.verification.complete();

      const carried = fieldOn(built.verification, sketch, 'property_address')!;
      expect(carried.isBelow(Confidence.FLOOR)).toBe(true);
      expect(
        built.verification.report?.issues.filter(
          issue =>
            issue.kind.equals(IssueKind.LOW_CONFIDENCE) &&
            issue.documentId?.equals(sketch.id) === true &&
            issue.fieldKey?.value === 'property_address',
        ),
      ).toEqual([]);
    });

    it('leaves the extraction stage still owing a document it only carried values into', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
        ['sketch_project', []],
      ]);

      built.verification.gatherFromThePackage();

      expect(
        built.verification.documentWith(built.typed('sketch_project').id)
          .hasFields,
      ).toBe(false);
    });

    it('says what it closed', () => {
      const built = aSubmission();
      built.verification.commit();

      built.verification.gatherFromThePackage();

      expect(typesOf(built.verification)).toEqual([
        'verification.FieldsGathered',
      ]);
    });

    it('says nothing when there was nothing to close', () => {
      const built = aSubmission([
        ['land_plot_plan', [read('property_address', ADDRESS_ON_THE_PLAN)]],
      ]);
      built.verification.commit();

      built.verification.gatherFromThePackage();

      expect(typesOf(built.verification)).toEqual([]);
    });

    it('closes nothing twice, so a second pass is a no-op', () => {
      const built = aSubmission();

      built.verification.gatherFromThePackage();
      const second = built.verification.gatherFromThePackage();

      expect(second).toEqual([]);
    });
  });

  describe('when the archive register agrees with a reading', () => {
    const SPEC = VerificationProfile.CADASTRE.registryChecks[0]!;

    const ADDRESS = 'Zığ qəsəbəsi, Əliyev küçəsi 12';

    function valued(key: string, value: string, page = 1): ExtractedField {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(0.95),
        PageNumber.of(page),
      );
    }

    // The plan-scheme the address and the parcel are read off, and the
    // certificate the owner of record is read off: the three attributes the
    // profile asks the register about.
    function aPackageOfRecord() {
      const built = aSegmentedPackage(2);
      const [plan, certificate] = built.documents as [Document, Document];

      built.verification.classify(plan.id, aClassification('land_plot_plan'));
      built.verification.classify(
        certificate.id,
        aClassification('archive_certificate'),
      );
      built.verification.recordExtractedFields(plan.id, [
        valued('property_address', ADDRESS),
        valued('cadastral_number', '40-12-345-67'),
        valued('plot_area', '600 m²'),
      ]);
      built.verification.recordExtractedFields(certificate.id, [
        valued('owner_name', 'Əliyeva Rübabə', 2),
      ]);
      built.verification.commit();

      return { ...built, plan, certificate };
    }

    function answered(
      verification: VerificationPackage,
      attributes: readonly RegistryAttribute[],
    ): void {
      verification.recordRegistryCheck(
        RegistryCheck.of({
          key: SPEC.key,
          outcome: RegistryOutcome.CONFIRMED,
          confidence: Confidence.of(0.95),
          note: 'Register 1-12345 holds this address.',
          asked: verification.askedOf(SPEC)!,
          reference: null,
          attributes,
        }),
      );
    }

    function attribute(
      verification: VerificationPackage,
      name: string,
      agrees: boolean,
      recorded: string | null,
    ): RegistryAttribute {
      return RegistryAttribute.of({
        name,
        agrees,
        submitted: verification
          .statedFor(SPEC)
          .find(stated => stated.name === name)!.value,
        recorded,
      });
    }

    function originOf(
      verification: VerificationPackage,
      document: Document,
      key: string,
    ) {
      return verification
        .documentWith(document.id)
        .fields.find(field => field.key.value === key)?.origin;
    }

    it('marks the reading the register held the same record of', () => {
      const built = aPackageOfRecord();
      answered(built.verification, [
        attribute(built.verification, 'ownerName', true, 'Əliyeva Rübabə'),
      ]);

      built.verification.confirmAgainstTheRecord();

      expect(
        originOf(built.verification, built.certificate, 'owner_name'),
      ).toBe(FieldOrigin.CONFIRMED_BY_REGISTRY);
    });

    it('leaves the value and the confidence exactly as they were read', () => {
      const built = aPackageOfRecord();
      answered(built.verification, [
        attribute(built.verification, 'ownerName', true, 'Əliyeva Rübabə'),
      ]);

      built.verification.confirmAgainstTheRecord();

      const field = built.verification
        .documentWith(built.certificate.id)
        .fields.find(one => one.key.value === 'owner_name');
      expect(field?.value.value).toBe('Əliyeva Rübabə');
      expect(field?.confidence.value).toBe(0.95);
      expect(field?.foundOn?.value).toBe(2);
    });

    /*
     * A record that says something else is `RegistryMismatch`, which the report
     * already states. A second way of saying it on the field would put one
     * finding in front of the inspector twice under two names (ADR-0023).
     */
    it('marks nothing where the record says something else', () => {
      const built = aPackageOfRecord();
      answered(built.verification, [
        attribute(built.verification, 'ownerName', false, 'Quliyev Rəşad'),
      ]);

      built.verification.confirmAgainstTheRecord();

      expect(
        originOf(built.verification, built.certificate, 'owner_name'),
      ).toBe(FieldOrigin.READ_ON_THIS_DOCUMENT);
    });

    // Silence is a column that area's register never kept, not a disagreement
    // and not an agreement (ADR-0009).
    it('marks nothing where the register kept no column for it', () => {
      const built = aPackageOfRecord();
      answered(built.verification, [
        attribute(built.verification, 'cadastralNumber', false, null),
      ]);

      built.verification.confirmAgainstTheRecord();

      expect(originOf(built.verification, built.plan, 'cadastral_number')).toBe(
        FieldOrigin.READ_ON_THIS_DOCUMENT,
      );
    });

    it('leaves the fields the register was never asked about alone', () => {
      const built = aPackageOfRecord();
      answered(built.verification, [
        attribute(built.verification, 'ownerName', true, 'Əliyeva Rübabə'),
      ]);

      built.verification.confirmAgainstTheRecord();

      expect(originOf(built.verification, built.plan, 'plot_area')).toBe(
        FieldOrigin.READ_ON_THIS_DOCUMENT,
      );
    });

    it('says what it confirmed', () => {
      const built = aPackageOfRecord();
      answered(built.verification, [
        attribute(built.verification, 'ownerName', true, 'Əliyeva Rübabə'),
      ]);
      built.verification.commit();

      built.verification.confirmAgainstTheRecord();

      expect(typesOf(built.verification)).toEqual([
        'verification.FieldsConfirmedByRegistry',
      ]);
    });

    it('says nothing when the register agreed with nothing', () => {
      const built = aPackageOfRecord();
      answered(built.verification, []);
      built.verification.commit();

      built.verification.confirmAgainstTheRecord();

      expect(typesOf(built.verification)).toEqual([]);
    });
  });

  describe('where it stands', () => {
    it('waits to be picked up while nothing has read it', () => {
      const { verification } = aPackage();

      expect(verification.standing.value).toBe('Queued');
    });

    it('says a run is reading it once one has started', () => {
      const { verification } = aStartedPackage();

      expect(verification.standing.value).toBe('UnderVerification');
    });

    it('says our own machinery broke down when the run could not finish', () => {
      const { verification } = aStartedPackage();

      verification.fail(FailureReason.create('the reader is down'));

      expect(verification.standing.value).toBe('Stalled');
    });

    it('says a required paper never arrived', () => {
      const { verification } = aSegmentedPackage();

      verification.complete();

      expect(verification.standing.value).toBe('ShortOfDocuments');
    });

    // A complete envelope carrying one sheet nothing could be made of: the
    // package is not short of a paper, and there is a finding on it all the
    // same.
    it('sends a package with findings against it to the inspector', () => {
      const built = aCompletePackage(1);
      built.verification.classify(
        built.documents[4]!.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      built.verification.complete();

      expect(built.verification.report?.status.value).toBe('IssuesFound');
      expect(built.verification.standing.value).toBe('NeedsInspector');
    });

    /*
     * The engine is done and has nothing to say against the package, and the
     * archive search it rests on has not been approved by anybody. The standing
     * says a person is owed rather than that the submission is settled — and
     * what settles it is the one thing here nobody but a person can do
     * (ADR-0016).
     */
    it('holds a clean package for the approval of the archive search', () => {
      const { verification } = aCompletePackage();
      verification.recordRegistryCheck(anArchiveAnswer(verification));

      verification.complete();

      expect(verification.standing.value).toBe('AwaitingArchiveApproval');
    });

    // The register was never asked, so there is no search for anybody to sign
    // off and nothing is outstanding.
    it('clears a package the register was never asked about', () => {
      const { verification } = aCompletePackage();

      verification.complete();

      expect(verification.report?.status.value).toBe('OK');
      expect(verification.standing.value).toBe('Cleared');
    });

    /*
     * The move a `ShortOfDocuments` package invites: the missing paper is
     * added, which discards the report and the register's answers and sends the
     * package back to be read again (ADR-0013). The standing follows, because
     * it is read off those and never held.
     */
    it('goes back to waiting when the missing paper is added', () => {
      const { verification } = aSegmentedPackage();
      verification.complete();
      expect(verification.standing.value).toBe('ShortOfDocuments');

      verification.addFiles([aFile()]);

      expect(verification.standing.value).toBe('Queued');
    });

    it('drops the approval it was waiting for when a file arrives', () => {
      const { verification } = aCompletePackage();
      verification.recordRegistryCheck(anArchiveAnswer(verification));
      verification.complete();
      expect(verification.standing.value).toBe('AwaitingArchiveApproval');

      verification.addFiles([aFile()]);

      expect(verification.registryChecks).toEqual([]);
      expect(verification.standing.value).toBe('Queued');
    });

    // The whole of what an approval changes about a submission: nothing was
    // held against it, the search it rested on has now been signed for, and it
    // is waiting on nobody (ADR-0016).
    it('clears a package once a person has signed for the archive search', () => {
      const { verification } = anApprovablePackage();

      verification.approveArchiveSearch(
        ApprovalSummary.create('the record agrees; the archive holds it'),
        null,
      );

      expect(verification.standing.value).toBe('Cleared');
    });

    /*
     * Findings against the package outrank the approval, because they are the
     * more pressing move (ADR-0014). Approving the archive search settles the
     * archive search and not the submission — the engine never refuses a
     * package, and a person still has the findings to resolve.
     */
    it('still sends a package with findings to the inspector once approved', () => {
      const built = aCompletePackage(1);
      built.verification.classify(
        built.documents[4]!.id,
        Classification.unplaced(Confidence.of(0.2)),
      );
      built.verification.recordRegistryCheck(
        anArchiveAnswer(built.verification),
      );
      built.verification.complete();

      built.verification.approveArchiveSearch(
        ApprovalSummary.create('the register agrees about the property'),
        null,
      );

      expect(built.verification.standing.value).toBe('NeedsInspector');
    });
  });

  /*
   * The one thing in a package a person puts there rather than the engine: a
   * sign-off on what the archive register answered (ADR-0016). It names nobody,
   * because there is nobody to name — there are no accounts in this system —
   * so what it records is that it happened, what was concluded, and what was
   * approved.
   */
  describe('when a person approves the archive search', () => {
    it('records the conclusion and any remark made on signing', () => {
      const { verification } = anApprovablePackage();

      verification.approveArchiveSearch(
        ApprovalSummary.create('  the archive holds the original  '),
        ApprovalComment.from('folder 14 re-checked by hand'),
      );

      const approval = verification.archiveSearchApproval;
      expect(approval?.summary.value).toBe('the archive holds the original');
      expect(approval?.comment?.value).toBe('folder 14 re-checked by hand');
      expect(typesOf(verification)).toContain(
        'verification.ArchiveSearchApproved',
      );
    });

    // Required, and the only required part: an approval that says only that it
    // happened says nothing, since nobody's name is on it either.
    it('takes no remark at all, which is a different thing from a blank one', () => {
      const { verification } = anApprovablePackage();

      verification.approveArchiveSearch(
        ApprovalSummary.create('nothing outstanding'),
        ApprovalComment.from('  '),
      );

      expect(verification.archiveSearchApproval?.comment).toBeNull();
    });

    // Not merely that something was approved: an approval the checks later
    // outrun is then readable against what they say now.
    it('records what the register had answered at the moment it was signed', () => {
      const { verification } = anApprovablePackage();

      verification.approveArchiveSearch(
        ApprovalSummary.create('nothing outstanding'),
        null,
      );

      const approved = verification.archiveSearchApproval?.checks ?? [];
      expect(approved.map(check => check.key.value)).toEqual([
        OF_RECORD.key.value,
      ]);
      expect(approved[0]!.outcome).toBe(RegistryOutcome.CONFIRMED);
    });

    // Approving a search nobody made would settle a submission on the strength
    // of nothing: a profile that asks the register nothing, and a package whose
    // address no sheet stated, leave no search to sign for.
    it('refuses a package the register was never asked about', () => {
      const { verification } = aCompletePackage();
      verification.complete();

      expect(() =>
        verification.approveArchiveSearch(
          ApprovalSummary.create('nothing outstanding'),
          null,
        ),
      ).toThrow(ArchiveSearchNotAskedException);
    });

    // The run is still free to replace what the register answered, so an
    // approval given now would cover answers that are about to change.
    it('refuses while the run that is asking the register is still going', () => {
      const { verification } = aCompletePackage();
      verification.recordRegistryCheck(anArchiveAnswer(verification));

      expect(() =>
        verification.approveArchiveSearch(
          ApprovalSummary.create('nothing outstanding'),
          null,
        ),
      ).toThrow(ArchiveSearchNotSettledException);
    });

    // An approval in force is a fact rather than a draft. The way it ends is
    // that the register is asked again, never that it is written over.
    it('refuses a second approval while one is in force', () => {
      const { verification } = anApprovablePackage();
      verification.approveArchiveSearch(
        ApprovalSummary.create('nothing outstanding'),
        null,
      );

      expect(() =>
        verification.approveArchiveSearch(
          ApprovalSummary.create('on second thoughts'),
          null,
        ),
      ).toThrow(ArchiveSearchAlreadyApprovedException);
    });

    /*
     * The rule the whole design turns on. A re-run asks the register again, and
     * what it answers may be nothing like what was signed for — so the approval
     * is spent the moment a fresh answer lands, and the submission goes back to
     * waiting on a person rather than quietly reading as settled (ADR-0016).
     */
    it('is spent when the register is asked again', () => {
      const { verification } = anApprovablePackage();
      verification.approveArchiveSearch(
        ApprovalSummary.create('nothing outstanding'),
        null,
      );
      expect(verification.standing.value).toBe('Cleared');

      verification.addFiles([aFile()]);
      expect(verification.archiveSearchApproval).toBeNull();

      // The fresh run, ending where the last one did — and unapproved, so a
      // package that once read as settled is waiting on a person again.
      rerun(verification);

      expect(verification.archiveSearchApproval).toBeNull();
      expect(verification.standing.value).toBe('AwaitingArchiveApproval');
    });

    it('says so when it is spent, rather than dropping it silently', () => {
      const { verification } = anApprovablePackage();
      verification.approveArchiveSearch(
        ApprovalSummary.create('nothing outstanding'),
        null,
      );
      verification.commit();

      verification.addFiles([aFile()]);

      expect(typesOf(verification)).toContain(
        'verification.ArchiveSearchApprovalSpent',
      );
    });

    // A package that was never approved has nothing to spend, and a re-run of
    // one must not announce that it did.
    it('says nothing about an approval a package never had', () => {
      const { verification } = anApprovablePackage();
      verification.commit();

      verification.addFiles([aFile()]);

      expect(typesOf(verification)).not.toContain(
        'verification.ArchiveSearchApprovalSpent',
      );
    });
  });
});

/*
 * Targeted supply: a document sent in for one of the holes the package
 * publishes, rather than one more file in the envelope (COMM-80).
 *
 * What is under test here is the round trip an operator actually makes — the
 * package says what it will take, a file is sent in for one of those, the run
 * reads it, and the package says whether it was answered. The rule that decides
 * the offer is under test on its own in `document-gaps.service.spec.ts`; this
 * is about what the package does with the answer.
 */
describe('VerificationPackage supplied with a document', () => {
  const READ_BADLY = Confidence.FLOOR.value - 0.2;

  // A package whose one sheet was read as an application, with the whole
  // schema read off it at `confidence`. Below the floor that is a scan the
  // package will take again; above it there is nothing to offer.
  function aPackageReadAs(type: string, confidence: number) {
    const built = aSegmentedPackage(1);
    const document = built.document;

    built.verification.classify(document.id, aClassification(type));
    built.verification.recordExtractedFields(
      document.id,
      VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create(type),
      ).specs.map(spec => aField(spec.key.value, confidence)),
    );
    built.verification.complete();
    built.verification.commit();

    return { ...built, document };
  }

  // The file an operator attaches, with what they said it answers.
  function sentFor(expectedType: string, replaces: DocumentId | null = null) {
    return SourceFile.create(
      SourceFileId.of(anId()),
      Filename.create('again.pdf'),
      ContentType.PDF,
      StorageKey.create(`uploads/${anId()}.pdf`),
      SupplyTarget.of({
        expectedType: DocumentType.create(expectedType),
        replaces,
      }),
    );
  }

  // The whole run over a file that has just arrived, as far as the answer needs
  // it: read into one sheet, carved into one document, placed under `readAs`.
  function readAs(
    verification: VerificationPackage,
    file: SourceFile,
    type: string,
  ): Document {
    verification.start();

    const page = aPage(1);
    verification.splitIntoPages(file.id, [page]);
    verification.recordRecognition(file.id, page.id, anOcrResult());

    const document = aDocumentOf(file.id, PageRange.single(page.number));
    verification.segmentIntoDocuments(file.id, [document]);
    verification.classify(document.id, aClassification(type));

    return document;
  }

  describe('what it publishes', () => {
    // The two papers every package carries, and — with nothing declared about
    // the ground and no provision decided — every title to the land, since any
    // of them answers the requirement (ADR-0025).
    it('offers every required paper and every title of a package that carries none', () => {
      const { verification } = aPackage();

      expect(
        verification.gaps
          .filter(gap => gap.reason === 'MissingDocument')
          .map(gap => gap.expectedType.value),
      ).toEqual([...REQUIRED_TYPES, ...TITLE_TYPES]);
    });

    it('offers the scan it read badly, named by the document it would replace', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );

      expect(
        verification.gaps.filter(gap => gap.reason === 'UnusableScan'),
      ).toEqual([
        {
          reason: 'UnusableScan',
          expectedType: DocumentType.create('application'),
          documentId: document.id.value,
          sourceFileId: document.sourceFileId.value,
        },
      ]);
    });

    // The duty is paid outside this system, so a receipt may turn up late or a
    // second one may be paid against a corrected amount: the package takes one
    // whether or not it is short of one.
    it('offers the payment receipt on a package that carries a good one', () => {
      const { verification } = aPackageReadAs('payment_receipt', 0.95);

      expect(
        verification.gaps
          .filter(gap => gap.expectedType.value === 'payment_receipt')
          .map(gap => gap.reason),
      ).toEqual(['AlwaysAccepted']);
    });
  });

  describe('what it will take', () => {
    it('takes a file sent in for a gap it publishes', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );

      verification.supplyDocument(sentFor('application', document.id));

      expect(verification.files).toHaveLength(2);
    });

    // The published list and the accepted call are one list. A screen drawing
    // its buttons off the first must never hit a refusal from the second.
    it('refuses a replacement of a document it never offered', () => {
      const { verification, document } = aPackageReadAs('application', 0.95);

      expect(() =>
        verification.supplyDocument(sentFor('application', document.id)),
      ).toThrow(NoSuchDocumentGapException);
    });

    it('refuses a paper it is short of nothing of', () => {
      const { verification } = aPackageReadAs('application', 0.95);

      expect(() => verification.supplyDocument(sentFor('application'))).toThrow(
        NoSuchDocumentGapException,
      );
    });

    it('leaves the package untouched when it refuses', () => {
      const { verification } = aPackageReadAs('application', 0.95);

      expect(() => verification.supplyDocument(sentFor('application'))).toThrow(
        NoSuchDocumentGapException,
      );
      expect(verification.files).toHaveLength(1);
      expect(verification.report).not.toBeNull();
      expect(verification.status.equals(PackageStatus.COMPLETED)).toBe(true);
    });

    it('re-opens the package and discards the report, like any file that arrives', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );

      verification.supplyDocument(sentFor('application', document.id));

      expect(verification.status.equals(PackageStatus.PENDING)).toBe(true);
      expect(verification.report).toBeNull();
    });

    it('says what the file was sent for, so the run can hold it to that', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );

      verification.supplyDocument(sentFor('application', document.id));

      expect(typesOf(verification)).toContain('verification.DocumentSupplied');
    });

    it('refuses a target no reading could ever satisfy', () => {
      expect(() =>
        SupplyTarget.of({ expectedType: DocumentType.OUT_OF_PROFILE }),
      ).toThrow(InvalidSupplyTargetException);
    });
  });

  describe('when what arrived is what was asked for', () => {
    it('puts the replaced document out of force, saying what replaced it', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      const replacement = readAs(verification, file, 'application');

      const replaced = verification.documentWith(document.id);
      expect(replaced.superseded?.by?.value).toBe(replacement.id.value);
      expect(replaced.superseded?.at).toBeInstanceOf(Date);
    });

    // The package is evidence, not a working draft: the bad scan stays, and
    // only stops speaking for the package.
    it('keeps the replaced document in the package and out of what it states', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      readAs(verification, file, 'application');

      expect(verification.documents).toHaveLength(2);
      expect(
        verification.documentsInForce.map(one => one.id.value),
      ).not.toContain(document.id.value);
    });

    it('takes the finding the supply was sent to answer out of the report', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      const replacement = readAs(verification, file, 'application');
      verification.recordExtractedFields(
        replacement.id,
        VerificationProfile.CADASTRE.schemaFor(
          DocumentType.create('application'),
        ).specs.map(spec => aField(spec.key.value, 0.95)),
      );
      verification.complete();

      const doubted = verification.report!.issues.filter(issue =>
        issue.kind.equals(IssueKind.LOW_CONFIDENCE),
      );
      expect(doubted).toEqual([]);
    });

    it('stops offering the gap it closed', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      const replacement = readAs(verification, file, 'application');
      verification.recordExtractedFields(
        replacement.id,
        VerificationProfile.CADASTRE.schemaFor(
          DocumentType.create('application'),
        ).specs.map(spec => aField(spec.key.value, 0.95)),
      );

      expect(
        verification.gaps.filter(gap => gap.reason === 'UnusableScan'),
      ).toEqual([]);
    });

    // Two documents of one type would otherwise be a duplicate the report
    // states — which is the wrong thing to say about a paper sent in to replace
    // the other one.
    it('does not report the replacement as a second paper of its type', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      const replacement = readAs(verification, file, 'application');
      verification.recordExtractedFields(
        replacement.id,
        VerificationProfile.CADASTRE.schemaFor(
          DocumentType.create('application'),
        ).specs.map(spec => aField(spec.key.value, 0.95)),
      );
      verification.complete();

      expect(
        verification.report!.issues.filter(issue =>
          issue.kind.equals(IssueKind.DUPLICATE_DOCUMENT),
        ),
      ).toEqual([]);
    });
  });

  describe('when what arrived is not what was asked for', () => {
    it('says so in the report rather than taking it in as one more file', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      readAs(verification, file, 'payment_receipt');
      verification.complete();

      const [refusal] = verification.report!.issues.filter(issue =>
        issue.kind.equals(IssueKind.WRONG_DOCUMENT_SUPPLIED),
      );
      expect(refusal?.sourceFileId?.value).toBe(file.id.value);
      // What was asked for, not what turned up: the finding is about the gap
      // that is still open.
      expect(refusal?.documentType?.value).toBe('application');
      expect(refusal?.message).toContain('payment_receipt');
    });

    it('leaves the document it was meant to replace in force', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      readAs(verification, file, 'payment_receipt');

      expect(verification.documentWith(document.id).isInForce).toBe(true);
    });

    it('goes on offering the gap it did not close', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      readAs(verification, file, 'payment_receipt');

      expect(
        verification.gaps.filter(
          gap =>
            gap.reason === 'UnusableScan' &&
            gap.documentId === document.id.value,
        ),
      ).toHaveLength(1);
    });

    // Not refused, only unanswered: nothing has read the file yet, and a report
    // saying the wrong paper arrived would be a report about a paper nobody has
    // looked at.
    it('says nothing while the run has not placed what arrived', () => {
      const { verification, document } = aPackageReadAs(
        'application',
        READ_BADLY,
      );
      const file = sentFor('application', document.id);

      verification.supplyDocument(file);
      verification.start();
      verification.complete();

      expect(
        verification.report!.issues.filter(issue =>
          issue.kind.equals(IssueKind.WRONG_DOCUMENT_SUPPLIED),
        ),
      ).toEqual([]);
    });
  });

  /*
   * ADR-0028. The archive's answer is made by the stage and the domain service;
   * what is asked of the aggregate is that it keeps the answer on the paper,
   * takes it only for a paper the check is for, and says what it means in the
   * report — in place of the line that says the archive was never asked.
   */
  describe('when a Decree 439 paper is held against the National Archive by its QR code', () => {
    const QR = 'https://qr.esd.milliarxiv.gov.az/F130-S1-I476-V98';
    const CHECKED_AT = new Date('2026-09-16T12:00:00.000Z');

    function aReading(key: string, value: string): ExtractedField {
      return ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value),
        Confidence.of(0.9),
        PageNumber.first(),
      );
    }

    // One homestead allotment order, placed and read, with its QR code among
    // the lines — or the paper of another type where one is named.
    function aTitle(type = 'homestead_land_allocation_decision') {
      const built = aSegmentedPackage(1);

      built.verification.classify(built.document.id, aClassification(type));
      built.verification.recordExtractedFields(
        built.document.id,
        type === 'archive_certificate'
          ? [aReading('certificate_no', 'ARX-2025-0417')]
          : [
              aReading('document_no', '1471'),
              aReading('issue_date', '29.10.1998'),
              aReading('qr_code', QR),
            ],
      );
      built.verification.commit();

      return built;
    }

    function agreeingLines(): readonly ArchiveQrFieldCheck[] {
      return ARCHIVE_QR_FIELDS.map(name =>
        ArchiveQrFieldCheck.of({
          name,
          documentValue: 'x',
          archiveValue: 'x',
          verdict: 'Match',
        }),
      );
    }

    function found(
      competent = true,
      lines: readonly ArchiveQrFieldCheck[] = agreeingLines(),
    ): ArchiveQrCheck {
      return ArchiveQrCheck.found({
        qrReference: QR,
        checkedAt: CHECKED_AT,
        issuingAuthorityCompetent: competent,
        fields: lines,
      });
    }

    function issuesOf(
      verification: VerificationPackage,
      kind: string,
    ): readonly ValidationIssue[] {
      return (verification.report?.issues ?? []).filter(
        issue => issue.kind.value === kind,
      );
    }

    it('waits on a placed Decree 439 paper until the archive has answered for it', () => {
      const { verification, document } = aTitle();

      expect(verification.awaitingArchiveQrCheck.map(one => one.id)).toEqual([
        document.id,
      ]);

      verification.recordArchiveQrCheck(document.id, found());

      expect(verification.awaitingArchiveQrCheck).toEqual([]);
    });

    it('asks by the QR code read off the paper, and gives each line as the paper states it', () => {
      const { verification, document } = aTitle();

      const question = verification.archiveQrQuestionOf(document.id);

      expect(question.type.value).toBe('homestead_land_allocation_decision');
      expect(question.qrReference).toBe(QR);
      expect(question.stated('document_no')).toBe('1471');
      expect(question.stated('holder_name')).toBeNull();
    });

    it('keeps the answer on the document and says it was made', () => {
      const { verification, document } = aTitle();

      verification.recordArchiveQrCheck(document.id, found());

      expect(
        verification.documentWith(document.id).archiveQrCheck?.status,
      ).toBe('Confirmed');
      expect(typesOf(verification)).toEqual([
        'verification.ArchiveQrCheckMade',
      ]);
      expect(verification.getUncommittedEvents()[0]).toBeInstanceOf(
        ArchiveQrCheckMade,
      );
    });

    // The archive certificate is sourced from the archive too, but it carries
    // no QR code and none of the Decree's lines: there is nothing to ask by.
    it('refuses an answer for a paper the check is not made for', () => {
      const { verification, document } = aTitle('archive_certificate');

      expect(verification.awaitingArchiveQrCheck).toEqual([]);
      expect(() =>
        verification.recordArchiveQrCheck(document.id, found()),
      ).toThrow(DocumentNotHeldAgainstTheArchiveException);
    });

    it('reports nothing against a paper the archive bore out, and no longer says it was not asked', () => {
      const { verification, document } = aTitle();

      verification.recordArchiveQrCheck(document.id, found());
      verification.complete();

      expect(issuesOf(verification, 'ArchiveQrMismatch')).toEqual([]);
      expect(
        issuesOf(verification, 'IntegrationNotConnected').filter(issue =>
          issue.documentId?.equals(document.id),
        ),
      ).toEqual([]);
    });

    it('says a paper nobody asked the archive about was read and not confirmed, as before', () => {
      const { verification, document } = aTitle();

      verification.complete();

      const [unasked] = issuesOf(verification, 'IntegrationNotConnected');
      expect(unasked?.documentId?.equals(document.id)).toBe(true);
      expect(unasked?.message).toContain('National Archive Fund');
    });

    it('files a line the archive differs on against the package, naming both sides', () => {
      const { verification, document } = aTitle();
      const lines = agreeingLines().map(line =>
        line.name === 'holder_name'
          ? ArchiveQrFieldCheck.of({
              name: 'holder_name',
              documentValue: 'Qusadze Vera Vladimirovna',
              archiveValue: 'Məmmədova Aynur Rəşid qızı',
              verdict: 'Mismatch',
            })
          : line,
      );

      verification.recordArchiveQrCheck(document.id, found(true, lines));
      verification.complete();

      const [mismatch] = issuesOf(verification, 'ArchiveQrMismatch');
      expect(mismatch?.documentId?.equals(document.id)).toBe(true);
      expect(mismatch?.documentType?.value).toBe(
        'homestead_land_allocation_decision',
      );
      expect(mismatch?.message).toContain('holder_name');
      expect(mismatch?.message).toContain('Qusadze Vera Vladimirovna');
      expect(mismatch?.message).toContain('Məmmədova Aynur Rəşid qızı');
      expect(mismatch?.message).not.toContain('competence');
      expect(mismatch?.kind.isInformational).toBe(false);
      expect(issuesOf(verification, 'IntegrationNotConnected')).toEqual([]);
    });

    it('files an issuer with no competence to issue the paper, even where every line agrees', () => {
      const { verification, document } = aTitle();

      verification.recordArchiveQrCheck(document.id, found(false));
      verification.complete();

      const [mismatch] = issuesOf(verification, 'ArchiveQrMismatch');
      expect(mismatch?.message).toContain('no competence');
      expect(mismatch?.kind.isInformational).toBe(false);
    });

    it('tells the inspector the archive held nothing under the reference, and holds nothing against the package', () => {
      const { verification, document } = aTitle();

      verification.recordArchiveQrCheck(
        document.id,
        ArchiveQrCheck.notFound(QR, CHECKED_AT),
      );
      verification.complete();

      const [unconfirmed] = issuesOf(verification, 'RegistryUnconfirmed');
      expect(unconfirmed?.documentId?.equals(document.id)).toBe(true);
      expect(unconfirmed?.message).toContain(QR);
      expect(unconfirmed?.kind.isInformational).toBe(true);
      expect(issuesOf(verification, 'ArchiveQrMismatch')).toEqual([]);
      expect(issuesOf(verification, 'IntegrationNotConnected')).toEqual([]);
    });

    it('tells the inspector a paper with no QR code read off it was not confirmed', () => {
      const { verification, document } = aTitle();

      verification.recordArchiveQrCheck(
        document.id,
        ArchiveQrCheck.noQrCode(CHECKED_AT),
      );
      verification.complete();

      const [unconfirmed] = issuesOf(verification, 'RegistryUnconfirmed');
      expect(unconfirmed?.message).toContain('no QR reference');
      expect(unconfirmed?.kind.isInformational).toBe(true);
    });

    // The answer is about what the paper says, and a file arriving elsewhere
    // does not change what this paper says (ADR-0013).
    it('keeps the answer when another file arrives', () => {
      const { verification, document } = aTitle();

      verification.recordArchiveQrCheck(document.id, found());
      verification.complete();
      verification.addFiles([aFile()]);

      expect(
        verification.documentWith(document.id).archiveQrCheck?.status,
      ).toBe('Confirmed');
    });
  });
});
