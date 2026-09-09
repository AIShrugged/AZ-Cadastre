import { describe, expect, it } from 'vitest';

import {
  Document,
  ExtractedField,
  Page,
  SourceFile,
} from '../entities/index.js';
import {
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
  DocumentNotInPackageException,
  DocumentsMustCoverEverySheetException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  LegalBasisNotInProfileException,
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
  FieldValue,
  Filename,
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
    // Every required type, one per sheet, each placed — the package an
    // inspector should have nothing to be told about.
    function aCompletePackage() {
      const built = aSegmentedPackage(REQUIRED_TYPES.length);
      built.documents.forEach((document, index) => {
        built.verification.classify(
          document.id,
          aClassification(REQUIRED_TYPES[index]!),
        );
      });

      return built;
    }

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
     * being empty. Since ADR-0013 a good package still carries one message —
     * which supporting documents this case needs — and that is stated for the
     * applicant, so the outcome is still OK.
     */
    it('reads as clean when every required document was found', () => {
      const { verification } = aCompletePackage();

      verification.complete();

      expect(verification.report?.status.value).toBe('OK');
      expect(kindsOf(verification)).toEqual(['SupportingDocumentsRequired']);
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
      const identity = verification.documents.at(-1)!;
      verification.recordExtractedFields(identity.id, [
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
      const identity = verification.documents.at(-1)!;
      verification.recordExtractedFields(identity.id, [
        aField('document_no', 0.95),
      ]);

      verification.complete();

      expect(kindsOf(verification)).toEqual(['SupportingDocumentsRequired']);
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
      const built = aSegmentedPackage(REQUIRED_TYPES.length + 1);
      REQUIRED_TYPES.forEach((type, index) => {
        built.verification.classify(
          built.documents[index]!.id,
          aClassification(type),
        );
      });
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
        'SupportingDocumentsRequired',
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
   * Which supporting documents this case needs, worked out from how tall the
   * building is and what year it is dated by (ADR-0013).
   *
   * The thresholds and the sets the assertions below name are the profile's
   * provisional table — `supporting-documents.table.ts`, whose values are ours
   * and not the customer's. What is under test is the mechanism: that the right
   * band is chosen, that a figure nobody could read never chooses one, and that
   * the message is told either way and counts against nothing.
   */
  describe('the supporting documents it says the applicant must bring', () => {
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

    // A package holding one sketch design and whatever it was read to state,
    // under whatever the office declared about it at the counter.
    function aDesignStating(
      fields: readonly (readonly [string, string, number?])[],
      declared: DeclaredAtIntake = DeclaredAtIntake.none(),
    ): VerificationPackage {
      const built = aSegmentedPackage(1, { declared });
      built.verification.classify(
        built.document.id,
        aClassification('sketch_project'),
      );
      if (fields.length > 0) {
        built.verification.recordExtractedFields(
          built.document.id,
          fields.map(([key, value, confidence]) =>
            aValue(key, value, confidence),
          ),
        );
      }
      built.verification.complete();

      return built.verification;
    }

    function messageOf(verification: VerificationPackage): ValidationIssue {
      const told = (verification.report?.issues ?? []).filter(
        issue => issue.kind.value === 'SupportingDocumentsRequired',
      );

      expect(told).toHaveLength(1);

      return told[0]!;
    }

    it('places a low house dated by a recent year in the band for one', () => {
      const verification = aDesignStating([
        ['building_height', '9,4 m'],
        ['approval_date', '18.12.2025'],
      ]);

      expect(messageOf(verification).message).toContain('low_rise_recent');
    });

    it('places a low house dated before the notification regime in the band for one', () => {
      const verification = aDesignStating([
        ['building_height', '9,4 m'],
        ['approval_date', '04.06.2005'],
      ]);

      expect(messageOf(verification).message).toContain('low_rise_legacy');
    });

    it('places a house tall enough to have needed a permit in the band for one', () => {
      const verification = aDesignStating([
        ['building_height', '18 m'],
        ['approval_date', '18.12.2025'],
      ]);

      expect(messageOf(verification).message).toContain('mid_rise');
    });

    it('places a house tall enough to have needed the design examined in the band for one', () => {
      const verification = aDesignStating([
        ['building_height', '31 m'],
        ['approval_date', '18.12.2025'],
      ]);

      expect(messageOf(verification).message).toContain('high_rise');
    });

    // A bound is inclusive at the bottom and exclusive at the top, so the two
    // bands either side of twelve metres do not argue over twelve itself.
    it('reads a height exactly on a threshold as the band the threshold opens', () => {
      const verification = aDesignStating([
        ['building_height', '12 m'],
        ['approval_date', '18.12.2025'],
      ]);

      expect(messageOf(verification).message).toContain('mid_rise');
    });

    it('names the papers of the band it placed the case in', () => {
      const verification = aDesignStating([
        ['building_height', '18 m'],
        ['approval_date', '18.12.2025'],
      ]);

      expect(messageOf(verification).message).toContain('Construction permit');
      expect(messageOf(verification).message).toContain('Act of commissioning');
    });

    // A band that says nothing about the year answers whatever year is read,
    // including none: a rule that holds in every year holds when nobody could
    // read the year.
    it('decides a band whose rule does not turn on the year without one', () => {
      const verification = aDesignStating([['building_height', '18 m']]);

      expect(messageOf(verification).message).toContain('mid_rise');
    });

    it('falls back to the next paper of the profile ordering for the year', () => {
      const built = aSegmentedPackage(2);
      built.verification.classify(
        built.documents[0]!.id,
        aClassification('sketch_project'),
      );
      built.verification.classify(
        built.documents[1]!.id,
        aClassification('disposal_order'),
      );
      built.verification.recordExtractedFields(built.documents[0]!.id, [
        aValue('building_height', '9,4 m'),
      ]);
      built.verification.recordExtractedFields(built.documents[1]!.id, [
        aValue('issue_date', '04.06.2005'),
      ]);
      built.verification.complete();

      expect(messageOf(built.verification).message).toContain(
        'low_rise_legacy',
      );
    });

    it('files the message against the reading it was decided on', () => {
      const built = aSegmentedPackage();
      built.verification.classify(
        built.document.id,
        aClassification('sketch_project'),
      );
      built.verification.recordExtractedFields(built.document.id, [
        aValue('building_height', '18 m', 0.82),
        aValue('approval_date', '18.12.2025', 0.91),
      ]);
      built.verification.complete();

      const told = messageOf(built.verification);
      expect(told.documentId?.equals(built.document.id)).toBe(true);
      expect(told.documentType?.value).toBe('sketch_project');
      expect(told.fieldKey?.value).toBe('building_height');
      // A set is only as certain as the least certain figure it was chosen on.
      expect(told.confidence?.value).toBe(0.82);
    });

    /*
     * The half that is easy to forget. A height nobody could read must not
     * choose a band — the applicant would be sent for the wrong papers — but it
     * must not silence the message either: the applicant still has papers to
     * bring, and the inspector has to be able to see that the engine could not
     * work out which.
     */
    it('decides no band when the height could not be read', () => {
      const verification = aDesignStating([
        // Storeys, not metres. Reading it as metres would place a two-storey
        // house in the lowest band with a straight face.
        ['building_height', '2 mərtəbə'],
        ['approval_date', '18.12.2025'],
      ]);

      expect(messageOf(verification).message).toContain('could not be decided');
      expect(messageOf(verification).message).toContain(
        'the height of the building could not be read',
      );
    });

    it('decides no band when the package states neither figure', () => {
      const verification = aDesignStating([]);

      expect(messageOf(verification).message).toContain(
        'neither the height of the building nor the year',
      );
    });

    it('decides no band when the year is needed and the package states none', () => {
      const verification = aDesignStating([['building_height', '9,4 m']]);

      expect(messageOf(verification).message).toContain('could not be decided');
    });

    // Undecided is not silent: which set applies is exactly what is unknown, so
    // every set is named and the applicant learns what they may be asked for.
    it('names every set when it could decide on none of them', () => {
      const message = messageOf(aDesignStating([])).message;

      for (const band of VerificationProfile.CADASTRE.supportingDocuments[0]!
        .bands) {
        expect(message).toContain(band.key);
      }
    });

    /*
     * What tells the two apart on the wire. A message that placed the case
     * carries the reading it was placed on; one that could not carries no
     * document, no sheet and no confidence — "we could not work this out" must
     * never read like "we worked it out and all is well".
     */
    it('carries no reading when it could decide no band', () => {
      const told = messageOf(aDesignStating([]));

      expect(told.documentId).toBeNull();
      expect(told.documentType).toBeNull();
      expect(told.fieldKey).toBeNull();
      expect(told.pageNumber).toBeNull();
      expect(told.confidence).toBeNull();
    });

    it('is stated for the applicant and never against the package', () => {
      const built = aSegmentedPackage(REQUIRED_TYPES.length);
      REQUIRED_TYPES.forEach((type, index) => {
        built.verification.classify(
          built.documents[index]!.id,
          aClassification(type),
        );
      });
      built.verification.complete();

      expect(messageOf(built.verification).kind.isInformational).toBe(true);
      expect(built.verification.report?.status.value).toBe('OK');
    });

    // Absence of data is not a violation: a package that is otherwise in order
    // and whose height nobody could read still reads OK.
    it('does not spoil the outcome when it could decide no band', () => {
      const built = aSegmentedPackage(REQUIRED_TYPES.length);
      REQUIRED_TYPES.forEach((type, index) => {
        built.verification.classify(
          built.documents[index]!.id,
          aClassification(type),
        );
      });
      built.verification.complete();

      expect(messageOf(built.verification).message).toContain(
        'could not be decided',
      );
      expect(built.verification.report?.status.value).toBe('OK');
    });

    /*
     * The year the office declared at the counter, where no paper states one.
     *
     * The fallback is a fallback and not a second opinion: a figure printed on
     * a paper is what the case rests on, and the declaration is only what
     * somebody said about it. Where the papers state a year, they decide.
     */
    it('decides a band on the declared year when no paper of the package states one', () => {
      const verification = aDesignStating(
        [['building_height', '9,4 m']],
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      expect(messageOf(verification).message).toContain('low_rise_legacy');
    });

    // The reader has to be able to check the figure, and a year nobody read off
    // a sheet is checked at the counter rather than in the file.
    it('says the year it fell back on was declared at intake', () => {
      const verification = aDesignStating(
        [['building_height', '9,4 m']],
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      expect(messageOf(verification).message).toContain(
        'dated 2005 as declared at intake',
      );
    });

    it('reads the papers rather than the declaration where both state a year', () => {
      const verification = aDesignStating(
        [
          ['building_height', '9,4 m'],
          ['approval_date', '18.12.2025'],
        ],
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      const told = messageOf(verification);
      expect(told.message).toContain('low_rise_recent');
      expect(told.message).not.toContain('as declared at intake');
    });

    // Nothing is declared about the height, so a declaration cannot rescue a
    // sketch design nobody could read a height off.
    it('still decides no band when the height could not be read, whatever was declared', () => {
      const verification = aDesignStating(
        [['building_height', '2 mərtəbə']],
        DeclaredAtIntake.of({ builtYear: 2005 }),
      );

      expect(messageOf(verification).message).toContain('could not be decided');
      expect(messageOf(verification).message).toContain(
        'the height of the building could not be read',
      );
    });

    // One message per branch the profile declares, and the profile declares
    // one: a re-run works the report out from scratch, so this cannot double up.
    it('tells it once per branch the profile declares', () => {
      const verification = aDesignStating([['building_height', '18 m']]);

      expect(
        (verification.report?.issues ?? []).filter(
          issue => issue.kind.value === 'SupportingDocumentsRequired',
        ),
      ).toHaveLength(VerificationProfile.CADASTRE.supportingDocuments.length);
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

    // A package holding one sketch design stating a year, taken in under
    // whatever the office declared about it.
    function aCaseDated(
      approvalDate: string | null,
      declared: DeclaredAtIntake,
    ): VerificationPackage {
      const built = aSegmentedPackage(1, { declared });
      built.verification.classify(
        built.document.id,
        aClassification('sketch_project'),
      );
      if (approvalDate !== null) {
        built.verification.recordExtractedFields(built.document.id, [
          aValue('approval_date', approvalDate, 0.77),
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
      expect(told.documentType?.value).toBe('sketch_project');
      expect(told.fieldKey?.value).toBe('approval_date');
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
    // state no year is one the declaration was useful for, not one it argues
    // with.
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
        aClassification('sketch_project'),
      );
      built.verification.recordExtractedFields(built.document.id, [
        aValue('approval_date', '18.12.2025'),
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

  // Every required type, one per sheet, each placed and attested — the package
  // an inspector should have nothing to be told about. The plan-scheme states
  // the address, so the register has something to be asked about.
  function aCompletePackage() {
    const built = aSegmentedPackage(REQUIRED_TYPES.length);
    built.documents.forEach((document, index) => {
      built.verification.classify(
        document.id,
        aClassification(REQUIRED_TYPES[index]!),
      );
    });
    built.verification.recordExtractedFields(built.document.id, [
      stated('property_address', 'Zığ qəsəbəsi, Əliyev küçəsi 12'),
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
      const built = aSegmentedPackage(REQUIRED_TYPES.length + 1);
      REQUIRED_TYPES.forEach((type, index) => {
        built.verification.classify(
          built.documents[index]!.id,
          aClassification(type),
        );
      });
      built.verification.classify(
        built.documents[REQUIRED_TYPES.length]!.id,
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
      const built = aSegmentedPackage(REQUIRED_TYPES.length + 1);
      REQUIRED_TYPES.forEach((type, index) => {
        built.verification.classify(
          built.documents[index]!.id,
          aClassification(type),
        );
      });
      built.verification.classify(
        built.documents[REQUIRED_TYPES.length]!.id,
        Classification.unplaced(Confidence.of(0.2)),
      );
      built.verification.recordExtractedFields(built.document.id, [
        stated('property_address', 'Zığ qəsəbəsi, Əliyev küçəsi 12'),
      ]);
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
