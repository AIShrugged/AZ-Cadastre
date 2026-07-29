import { describe, expect, it } from "vitest";

import { Document, ExtractedField, Page } from "../entities/index.js";
import {
  DocumentClassified,
  DocumentSplitIntoPages,
  FieldsExtracted,
  PackageSubmitted,
  PageRecognised,
  VerificationCompleted,
  VerificationFailed,
  VerificationStarted,
} from "../events/index.js";
import {
  DocumentAlreadyClassifiedException,
  DocumentAlreadySplitException,
  DocumentNotClassifiedException,
  DocumentNotInPackageException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  PackageAlreadyFinishedException,
  PackageMustHaveADocumentException,
  PackageNotStartableException,
  PackageNotUnderWayException,
  PageAlreadyRecognisedException,
  PageNotInDocumentException,
  UnclassifiableDocumentException,
} from "../exceptions/index.js";
import {
  Classification,
  Confidence,
  ContentType,
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
  PageNumber,
  RecognisedText,
  StorageKey,
  VerificationProfile,
} from "../value-objects/index.js";
import { VerificationPackage } from "./verification-package.aggregate.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

function aDocument(storageKey?: string): Document {
  return Document.create(
    DocumentId.of(anId()),
    Filename.create("passport.pdf"),
    ContentType.PDF,
    StorageKey.create(storageKey ?? `uploads/${anId()}.pdf`),
  );
}

function aPage(number: number): Page {
  return Page.create(
    PageId.of(anId()),
    PageNumber.of(number),
    StorageKey.create(`pages/${anId()}.png`),
  );
}

function anOcrResult(text = "Republic of Azerbaijan"): OcrResult {
  return OcrResult.of(RecognisedText.of(text), Confidence.of(0.9));
}

function aClassification(type = "passport"): Classification {
  return Classification.of(DocumentType.create(type), Confidence.of(0.87));
}

function aField(key: string): ExtractedField {
  return ExtractedField.of(
    FieldKey.create(key),
    FieldValue.create("AZE1234567"),
    Confidence.of(0.8),
    PageNumber.first(),
  );
}

function aPackage(
  options: {
    profile?: VerificationProfile;
    documents?: readonly Document[];
  } = {},
) {
  const documents = options.documents ?? [aDocument()];
  const verification = VerificationPackage.create(
    PackageId.of(anId()),
    options.profile ?? VerificationProfile.CADASTRE,
    documents,
  );

  return { verification, documents, document: documents[0]! };
}

function aStartedPackage(
  options: {
    profile?: VerificationProfile;
    documents?: readonly Document[];
  } = {},
) {
  const built = aPackage(options);
  built.verification.start();
  built.verification.commit();

  return built;
}

function typesOf(verification: VerificationPackage): readonly string[] {
  return verification.getUncommittedEvents().map((event) => event.type);
}

describe("VerificationPackage", () => {
  describe("when it is submitted", () => {
    it("waits to be picked up, holding the documents that arrived", () => {
      const id = PackageId.of(anId());
      const documents = [aDocument(), aDocument()];

      const verification = VerificationPackage.create(
        id,
        VerificationProfile.CADASTRE,
        documents,
      );

      expect(verification.id.equals(id)).toBe(true);
      expect(verification.version).toBe(0);
      expect(verification.profile).toBe(VerificationProfile.CADASTRE);
      expect(verification.status).toBe(PackageStatus.PENDING);
      expect(verification.documents).toHaveLength(2);
    });

    it("records that it was submitted, with the profile it is judged against", () => {
      const { verification } = aPackage({
        documents: [aDocument(), aDocument()],
      });

      const [event] = verification.getUncommittedEvents();

      expect(event).toBeInstanceOf(PackageSubmitted);
      expect((event as PackageSubmitted).profile).toBe(
        VerificationProfile.CADASTRE,
      );
      expect((event as PackageSubmitted).documentCount).toBe(2);
    });

    it("refuses a package with nothing in it", () => {
      expect(() =>
        VerificationPackage.create(
          PackageId.of(anId()),
          VerificationProfile.CADASTRE,
          [],
        ),
      ).toThrow(PackageMustHaveADocumentException);
    });

    it("refuses two documents pointing at the same object in the store", () => {
      expect(() =>
        VerificationPackage.create(
          PackageId.of(anId()),
          VerificationProfile.CADASTRE,
          [aDocument("uploads/same.pdf"), aDocument("uploads/same.pdf")],
        ),
      ).toThrow(DuplicateStorageKeyException);
    });

    it("names the object two documents both point at", () => {
      expect(() =>
        VerificationPackage.create(
          PackageId.of(anId()),
          VerificationProfile.CADASTRE,
          [aDocument("uploads/same.pdf"), aDocument("uploads/same.pdf")],
        ),
      ).toThrow(/uploads\/same.pdf/);
    });

    it("accepts two documents of the same name pointing at different objects", () => {
      const { verification } = aPackage({
        documents: [aDocument("uploads/a.pdf"), aDocument("uploads/b.pdf")],
      });

      expect(verification.documents).toHaveLength(2);
    });

    it("keeps its own copy of the documents it was handed", () => {
      const documents = [aDocument()];
      const verification = VerificationPackage.create(
        PackageId.of(anId()),
        VerificationProfile.CADASTRE,
        documents,
      );

      documents.push(aDocument());

      expect(verification.documents).toHaveLength(1);
    });
  });

  describe("when it is rebuilt from storage", () => {
    it("records nothing", () => {
      const restored = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 4,
        profile: VerificationProfile.CADASTRE,
        status: PackageStatus.PROCESSING,
        documents: [aDocument()],
      });

      expect(restored.getUncommittedEvents()).toEqual([]);
    });

    it("comes back where it was left, at the version it was written under", () => {
      const restored = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 4,
        profile: VerificationProfile.DEMO,
        status: PackageStatus.COMPLETED,
        documents: [aDocument()],
      });

      expect(restored.version).toBe(4);
      expect(restored.status).toBe(PackageStatus.COMPLETED);
      expect(restored.profile).toBe(VerificationProfile.DEMO);
    });

    it("refuses nothing, so a package written before a rule can still be read", () => {
      const restored = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 1,
        profile: VerificationProfile.CADASTRE,
        status: PackageStatus.FAILED,
        documents: [],
      });

      expect(restored.documents).toEqual([]);
    });
  });

  describe("looking a document up", () => {
    it("finds a document of its own", () => {
      const { verification, document } = aPackage();

      expect(verification.documentWith(document.id).id.equals(document.id)).toBe(
        true,
      );
    });

    it("refuses a document that belongs to another package", () => {
      const { verification } = aPackage();
      const stranger = aDocument();

      expect(() => verification.documentWith(stranger.id)).toThrow(
        DocumentNotInPackageException,
      );
    });
  });

  describe("handing it to the pipeline", () => {
    it("puts a waiting package under way", () => {
      const { verification } = aPackage();
      verification.commit();

      verification.start();

      expect(verification.status).toBe(PackageStatus.PROCESSING);
      expect(typesOf(verification)).toEqual([
        "verification.VerificationStarted",
      ]);
      expect(verification.getUncommittedEvents()[0]).toBeInstanceOf(
        VerificationStarted,
      );
    });

    it("refuses a package that is already running", () => {
      const { verification } = aStartedPackage();

      expect(() => verification.start()).toThrow(PackageNotStartableException);
    });

    it("refuses a package that is already done", () => {
      const { verification } = aStartedPackage();
      verification.complete();
      verification.commit();

      expect(() => verification.start()).toThrow(PackageNotStartableException);
    });

    it("says where the package sits when it refuses to start it", () => {
      const { verification } = aStartedPackage();

      expect(() => verification.start()).toThrow(/while it is Processing/);
    });

    it("changes nothing when it refuses to start", () => {
      const { verification } = aStartedPackage();
      verification.complete();
      verification.commit();

      expect(() => verification.start()).toThrow(PackageNotStartableException);

      expect(verification.status).toBe(PackageStatus.COMPLETED);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("starts a failed package again, so a retry resumes rather than repeats", () => {
      const { verification } = aStartedPackage();
      verification.fail(FailureReason.create("the OCR provider gave up"));
      verification.commit();

      verification.start();

      expect(verification.status).toBe(PackageStatus.PROCESSING);
      expect(typesOf(verification)).toEqual([
        "verification.VerificationStarted",
      ]);
    });

    it("keeps everything a failed package had already learned when it starts again", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult());
      verification.fail(FailureReason.create("the classifier gave up"));
      verification.commit();

      verification.start();

      expect(verification.documentWith(document.id).isFullyRecognised).toBe(
        true,
      );
    });

    it("refuses to fail a package that has already completed", () => {
      const { verification } = aStartedPackage();
      verification.complete();

      expect(() => verification.fail(FailureReason.create("too late"))).toThrow(
        PackageAlreadyFinishedException,
      );
    });

    it("leaves a completed package completed when it refuses to fail it", () => {
      const { verification } = aStartedPackage();
      verification.complete();
      verification.commit();

      expect(() => verification.fail(FailureReason.create("too late"))).toThrow(
        PackageAlreadyFinishedException,
      );

      expect(verification.status).toBe(PackageStatus.COMPLETED);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("cannot be restarted through a refused failure, so a result already read is never replayed", () => {
      const { verification } = aStartedPackage();
      verification.complete();

      expect(() => verification.fail(FailureReason.create("too late"))).toThrow(
        PackageAlreadyFinishedException,
      );

      expect(() => verification.start()).toThrow(PackageNotStartableException);
    });
  });

  describe("recording the sheets a file was rendered into", () => {
    it("records them against the document named", () => {
      const { verification, document } = aStartedPackage();

      verification.splitIntoPages(document.id, [aPage(1), aPage(2)]);

      expect(verification.documentWith(document.id).pages).toHaveLength(2);
      expect(typesOf(verification)).toEqual([
        "verification.DocumentSplitIntoPages",
      ]);
      expect(verification.getUncommittedEvents()[0]).toBeInstanceOf(
        DocumentSplitIntoPages,
      );
    });

    it("leaves the other documents of the package alone", () => {
      const documents = [aDocument(), aDocument()];
      const { verification } = aStartedPackage({ documents });

      verification.splitIntoPages(documents[0]!.id, [aPage(1)]);

      expect(verification.documentWith(documents[1]!.id).isSplit).toBe(false);
    });

    it("refuses a package the pipeline is not running", () => {
      const { verification, document } = aPackage();
      verification.commit();

      expect(() =>
        verification.splitIntoPages(document.id, [aPage(1)]),
      ).toThrow(PackageNotUnderWayException);
    });

    it("changes nothing when the package is not under way", () => {
      const { verification, document } = aPackage();
      verification.commit();

      expect(() =>
        verification.splitIntoPages(document.id, [aPage(1)]),
      ).toThrow(PackageNotUnderWayException);

      expect(verification.documentWith(document.id).isSplit).toBe(false);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("refuses a document that belongs to another package", () => {
      const { verification } = aStartedPackage();
      const stranger = aDocument();

      expect(() => verification.splitIntoPages(stranger.id, [aPage(1)])).toThrow(
        DocumentNotInPackageException,
      );
    });

    it("refuses a second split of the same document", () => {
      const { verification, document } = aStartedPackage();
      verification.splitIntoPages(document.id, [aPage(1)]);
      verification.commit();

      expect(() =>
        verification.splitIntoPages(document.id, [aPage(1), aPage(2)]),
      ).toThrow(DocumentAlreadySplitException);
    });

    it("changes nothing when it refuses a second split", () => {
      const { verification, document } = aStartedPackage();
      verification.splitIntoPages(document.id, [aPage(1)]);
      verification.commit();

      expect(() =>
        verification.splitIntoPages(document.id, [aPage(1), aPage(2)]),
      ).toThrow(DocumentAlreadySplitException);

      expect(verification.documentWith(document.id).pages).toHaveLength(1);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });
  });

  describe("recording what OCR read off a page", () => {
    it("records the reading against the page named", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.commit();

      verification.recordRecognition(
        document.id,
        page.id,
        anOcrResult("page one"),
      );

      expect(
        verification.documentWith(document.id).pageWith(page.id).ocr?.text.value,
      ).toBe("page one");
      expect(typesOf(verification)).toEqual(["verification.PageRecognised"]);
      expect(verification.getUncommittedEvents()[0]).toBeInstanceOf(
        PageRecognised,
      );
    });

    it("refuses a package the pipeline is not running", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.complete();
      verification.commit();

      expect(() =>
        verification.recordRecognition(document.id, page.id, anOcrResult()),
      ).toThrow(PackageNotUnderWayException);
    });

    it("refuses a document that belongs to another package", () => {
      const { verification } = aStartedPackage();
      const stranger = aDocument();

      expect(() =>
        verification.recordRecognition(stranger.id, aPage(1).id, anOcrResult()),
      ).toThrow(DocumentNotInPackageException);
    });

    it("refuses a page that belongs to another document", () => {
      const { verification, document } = aStartedPackage();
      verification.splitIntoPages(document.id, [aPage(1)]);
      verification.commit();

      expect(() =>
        verification.recordRecognition(document.id, aPage(1).id, anOcrResult()),
      ).toThrow(PageNotInDocumentException);
    });

    it("refuses a second recognition of the same page", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult("first"));
      verification.commit();

      expect(() =>
        verification.recordRecognition(
          document.id,
          page.id,
          anOcrResult("second"),
        ),
      ).toThrow(PageAlreadyRecognisedException);
    });

    it("keeps the first reading when it refuses a second", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult("first"));
      verification.commit();

      expect(() =>
        verification.recordRecognition(
          document.id,
          page.id,
          anOcrResult("second"),
        ),
      ).toThrow(PageAlreadyRecognisedException);

      expect(
        verification.documentWith(document.id).pageWith(page.id).ocr?.text.value,
      ).toBe("first");
      expect(verification.getUncommittedEvents()).toEqual([]);
    });
  });

  describe("recording the type the classifier chose", () => {
    it("records a type the profile expects", () => {
      const { verification, document } = aStartedPackage();

      verification.classify(document.id, aClassification("title_deed"));

      expect(
        verification.documentWith(document.id).classification?.type.value,
      ).toBe("title_deed");
      expect(typesOf(verification)).toEqual([
        "verification.DocumentClassified",
      ]);
      expect(verification.getUncommittedEvents()[0]).toBeInstanceOf(
        DocumentClassified,
      );
    });

    it("refuses a document type the profile does not recognise", () => {
      const { verification, document } = aStartedPackage({
        profile: VerificationProfile.CADASTRE,
      });

      expect(() =>
        verification.classify(document.id, aClassification("driver_license")),
      ).toThrow(DocumentTypeNotInProfileException);
    });

    it("names the type and the profile that does not expect it", () => {
      const { verification, document } = aStartedPackage();

      expect(() =>
        verification.classify(document.id, aClassification("driver_license")),
      ).toThrow(/Profile "cadastre" does not recognise document type "driver_license"/);
    });

    it("changes nothing when it refuses a type the profile does not recognise", () => {
      const { verification, document } = aStartedPackage();

      expect(() =>
        verification.classify(document.id, aClassification("driver_license")),
      ).toThrow(DocumentTypeNotInProfileException);

      expect(verification.documentWith(document.id).isClassified).toBe(false);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("accepts a type another profile does expect", () => {
      const { verification, document } = aStartedPackage({
        profile: VerificationProfile.DEMO,
      });

      verification.classify(document.id, aClassification("driver_license"));

      expect(
        verification.documentWith(document.id).classification?.type.value,
      ).toBe("driver_license");
    });

    it("always accepts a document the classifier could not place, whatever the profile", () => {
      const { verification, document } = aStartedPackage();

      verification.classify(
        document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(verification.documentWith(document.id).classification?.type).toBe(
        DocumentType.UNKNOWN,
      );
      expect(typesOf(verification)).toEqual([
        "verification.DocumentClassified",
      ]);
    });

    it("refuses a package the pipeline is not running", () => {
      const { verification, document } = aPackage();
      verification.commit();

      expect(() =>
        verification.classify(document.id, aClassification()),
      ).toThrow(PackageNotUnderWayException);
    });

    it("refuses a document that belongs to another package", () => {
      const { verification } = aStartedPackage();
      const stranger = aDocument();

      expect(() =>
        verification.classify(stranger.id, aClassification()),
      ).toThrow(DocumentNotInPackageException);
    });

    it("refuses a second classification of the same document", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.commit();

      expect(() =>
        verification.classify(document.id, aClassification("title_deed")),
      ).toThrow(DocumentAlreadyClassifiedException);
    });

    it("keeps the first decision when it refuses a second", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.commit();

      expect(() =>
        verification.classify(document.id, aClassification("title_deed")),
      ).toThrow(DocumentAlreadyClassifiedException);

      expect(
        verification.documentWith(document.id).classification?.type.value,
      ).toBe("passport");
      expect(verification.getUncommittedEvents()).toEqual([]);
    });
  });

  describe("recording the values pulled from a document", () => {
    it("records values under keys the document's type declares", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.commit();

      verification.recordExtractedFields(document.id, [
        aField("passport_no"),
        aField("first_name"),
      ]);

      expect(verification.documentWith(document.id).fields).toHaveLength(2);
      expect(typesOf(verification)).toEqual(["verification.FieldsExtracted"]);
      expect(verification.getUncommittedEvents()[0]).toBeInstanceOf(
        FieldsExtracted,
      );
    });

    it("refuses a key the document's type never declared", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.commit();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField("passport_no"),
          aField("parcel_id"),
        ]),
      ).toThrow(FieldNotInSchemaException);
    });

    it("names the key and the type that does not declare it", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.commit();

      expect(() =>
        verification.recordExtractedFields(document.id, [aField("parcel_id")]),
      ).toThrow(/Document type "passport" declares no field "parcel_id"/);
    });

    it("records none of the values when one of them breaks the schema", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.commit();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField("passport_no"),
          aField("parcel_id"),
        ]),
      ).toThrow(FieldNotInSchemaException);

      expect(verification.documentWith(document.id).fields).toEqual([]);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("judges each key against the type of that document, not of another", () => {
      const documents = [aDocument(), aDocument()];
      const { verification } = aStartedPackage({ documents });
      verification.classify(documents[0]!.id, aClassification("passport"));
      verification.classify(documents[1]!.id, aClassification("title_deed"));
      verification.commit();

      verification.recordExtractedFields(documents[1]!.id, [
        aField("parcel_id"),
      ]);

      expect(() =>
        verification.recordExtractedFields(documents[0]!.id, [
          aField("parcel_id"),
        ]),
      ).toThrow(FieldNotInSchemaException);
    });

    it("refuses a document that has not been classified", () => {
      const { verification, document } = aStartedPackage();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField("passport_no"),
        ]),
      ).toThrow(DocumentNotClassifiedException);
    });

    it("refuses a document the classifier could not place, because it declares no fields", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(
        document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );
      verification.commit();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField("passport_no"),
        ]),
      ).toThrow(UnclassifiableDocumentException);
    });

    it("changes nothing when it refuses an unclassified document", () => {
      const { verification, document } = aStartedPackage();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField("passport_no"),
        ]),
      ).toThrow(DocumentNotClassifiedException);

      expect(verification.documentWith(document.id).hasFields).toBe(false);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("refuses a package the pipeline is not running", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.complete();
      verification.commit();

      expect(() =>
        verification.recordExtractedFields(document.id, [
          aField("passport_no"),
        ]),
      ).toThrow(PackageNotUnderWayException);
    });

    it("refuses a document that belongs to another package", () => {
      const { verification } = aStartedPackage();
      const stranger = aDocument();

      expect(() =>
        verification.recordExtractedFields(stranger.id, [
          aField("passport_no"),
        ]),
      ).toThrow(DocumentNotInPackageException);
    });

    it("replaces the values wholesale when the stage runs again", () => {
      const { verification, document } = aStartedPackage();
      verification.classify(document.id, aClassification("passport"));
      verification.recordExtractedFields(document.id, [
        aField("passport_no"),
        aField("first_name"),
      ]);
      verification.commit();

      verification.recordExtractedFields(document.id, [aField("passport_no")]);

      expect(
        verification
          .documentWith(document.id)
          .fields.map((field) => field.key.value),
      ).toEqual(["passport_no"]);
    });
  });

  describe("finishing", () => {
    it("marks a running package done", () => {
      const { verification } = aStartedPackage();

      verification.complete();

      expect(verification.status).toBe(PackageStatus.COMPLETED);
      expect(verification.getUncommittedEvents()[0]).toBeInstanceOf(
        VerificationCompleted,
      );
    });

    it("refuses to finish a package that was never started", () => {
      const { verification } = aPackage();
      verification.commit();

      expect(() => verification.complete()).toThrow(
        PackageNotUnderWayException,
      );
    });

    it("refuses to finish a package that is already done", () => {
      const { verification } = aStartedPackage();
      verification.complete();
      verification.commit();

      expect(() => verification.complete()).toThrow(
        PackageNotUnderWayException,
      );
    });

    it("changes nothing when it refuses to finish", () => {
      const { verification } = aPackage();
      verification.commit();

      expect(() => verification.complete()).toThrow(
        PackageNotUnderWayException,
      );

      expect(verification.status).toBe(PackageStatus.PENDING);
      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("marks a package that hit a permanent error as failed, with the reason", () => {
      const { verification } = aStartedPackage();

      verification.fail(FailureReason.create("the OCR provider gave up"));

      expect(verification.status).toBe(PackageStatus.FAILED);
      const [event] = verification.getUncommittedEvents();
      expect(event).toBeInstanceOf(VerificationFailed);
      expect((event as VerificationFailed).reason.value).toBe(
        "the OCR provider gave up",
      );
    });

    it("keeps the documents of a failed package, so a retry resumes from where it stopped", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult());

      verification.fail(FailureReason.create("the classifier gave up"));

      expect(verification.documentWith(document.id).isFullyRecognised).toBe(
        true,
      );
    });
  });

  describe("knowing when every stage has run", () => {
    it("is fully processed once each document is read, placed and pulled from", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult());
      verification.classify(document.id, aClassification("passport"));
      verification.recordExtractedFields(document.id, [aField("passport_no")]);

      expect(verification.isFullyProcessed).toBe(true);
    });

    it("is not fully processed while a page is still unread", () => {
      const { verification, document } = aStartedPackage();
      verification.splitIntoPages(document.id, [aPage(1), aPage(2)]);
      verification.classify(document.id, aClassification("passport"));

      expect(verification.isFullyProcessed).toBe(false);
    });

    it("is not fully processed while a document is still unplaced by the classifier", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult());

      expect(verification.isFullyProcessed).toBe(false);
    });

    it("asks for no fields from a document the classifier could not place", () => {
      const { verification, document } = aStartedPackage();
      const page = aPage(1);
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult());
      verification.classify(
        document.id,
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(verification.isFullyProcessed).toBe(true);
    });

    it("is not fully processed while one document of several is still behind", () => {
      const documents = [aDocument(), aDocument()];
      const { verification } = aStartedPackage({ documents });
      const page = aPage(1);
      verification.splitIntoPages(documents[0]!.id, [page]);
      verification.recordRecognition(documents[0]!.id, page.id, anOcrResult());
      verification.classify(documents[0]!.id, aClassification("passport"));
      verification.recordExtractedFields(documents[0]!.id, [
        aField("passport_no"),
      ]);

      expect(verification.isFullyProcessed).toBe(false);
    });
  });

  describe("the events it has yet to hand over", () => {
    it("records one for the submission and nothing else", () => {
      const { verification } = aPackage();

      expect(typesOf(verification)).toEqual([
        "verification.PackageSubmitted",
      ]);
    });

    it("keeps them in the order the pipeline decided them", () => {
      const { verification, document } = aPackage();
      const page = aPage(1);
      verification.start();
      verification.splitIntoPages(document.id, [page]);
      verification.recordRecognition(document.id, page.id, anOcrResult());
      verification.classify(document.id, aClassification("passport"));
      verification.recordExtractedFields(document.id, [aField("passport_no")]);
      verification.complete();

      expect(typesOf(verification)).toEqual([
        "verification.PackageSubmitted",
        "verification.VerificationStarted",
        "verification.DocumentSplitIntoPages",
        "verification.PageRecognised",
        "verification.DocumentClassified",
        "verification.FieldsExtracted",
        "verification.VerificationCompleted",
      ]);
    });

    it("reads them without clearing them", () => {
      const { verification } = aPackage();

      expect(verification.getUncommittedEvents()).toHaveLength(1);
      expect(verification.getUncommittedEvents()).toHaveLength(1);
      expect(verification.getUncommittedEvents()).toHaveLength(1);
    });

    it("forgets them once they have been handed over", () => {
      const { verification } = aPackage();

      verification.commit();

      expect(verification.getUncommittedEvents()).toEqual([]);
    });

    it("leaves the ones already handed over alone when it commits", () => {
      const { verification } = aPackage();
      const handedOver = verification.getUncommittedEvents();

      verification.commit();

      expect(handedOver).toHaveLength(1);
      expect(handedOver[0]).toBeInstanceOf(PackageSubmitted);
    });

    it("records again after a commit", () => {
      const { verification } = aPackage();
      verification.commit();

      verification.start();

      expect(typesOf(verification)).toEqual([
        "verification.VerificationStarted",
      ]);
    });

    it("cannot publish anything itself", () => {
      const { verification } = aPackage();

      expect("publish" in verification).toBe(false);
    });
  });
});
