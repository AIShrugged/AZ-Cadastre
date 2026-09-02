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
  PackageSubmitted,
  PageRecognised,
  SourceFileSegmented,
  SourceFileSplitIntoPages,
  VerificationCompleted,
  VerificationFailed,
  VerificationStarted,
} from '../events/index.js';
import {
  CrossCheckNotInProfileException,
  DocumentAlreadyClassifiedException,
  DocumentNotClassifiedException,
  DocumentNotInPackageException,
  DocumentsMustCoverEverySheetException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  PackageAlreadyFinishedException,
  PackageMustHaveAFileException,
  PackageNotStartableException,
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
  Classification,
  Confidence,
  ContentType,
  CrossCheck,
  CrossCheckKey,
  CrossCheckVerdict,
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

function anOcrResult(text = 'Republic of Azerbaijan'): OcrResult {
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
};

function aPackage(options: Options = {}) {
  const files = options.files ?? [aFile()];
  const verification = VerificationPackage.create(
    PackageId.of(anId()),
    options.profile ?? VerificationProfile.CADASTRE,
    files,
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

  describe('when it is rebuilt from storage', () => {
    it('records nothing', () => {
      const restored = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 4,
        profile: VerificationProfile.CADASTRE,
        status: PackageStatus.PROCESSING,
        files: [aFile()],
        documents: [],
        crossChecks: [],
        registryChecks: [],
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
        status: PackageStatus.COMPLETED,
        files: [file],
        documents: [document],
        crossChecks: [],
        registryChecks: [],
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
        status: PackageStatus.PENDING,
        files: [],
        documents: [],
        crossChecks: [],
        registryChecks: [],
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
      ).toBe('Republic of Azerbaijan');
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

    it('reads as clean when every required document was found', () => {
      const { verification } = aCompletePackage();

      verification.complete();

      expect(verification.report?.status.value).toBe('OK');
      expect(verification.report?.isClean).toBe(true);
    });

    it('names every required document nobody supplied', () => {
      const { verification, document } = aSegmentedPackage();
      verification.classify(document.id, aClassification('identity_card'));

      verification.complete();

      expect(
        verification.report?.issues.map(issue => issue.documentType?.value),
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

      expect(kindsOf(verification)).toEqual([]);
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

      expect(kindsOf(built.verification)).toEqual(['ExtraDocument']);
      expect(built.verification.report?.status.value).toBe('OK');
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
        status: PackageStatus.PROCESSING,
        files: verification.files,
        documents: verification.documents,
        crossChecks: verification.crossChecks,
        registryChecks: verification.registryChecks,
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
        status: PackageStatus.PROCESSING,
        files: verification.files,
        documents: verification.documents,
        crossChecks: verification.crossChecks,
        registryChecks: verification.registryChecks,
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
});
