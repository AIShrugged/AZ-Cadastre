import { describe, expect, it } from "vitest";

import { VerificationPackage } from "../../domain/aggregates/index.js";
import { Document, SourceFile } from "../../domain/entities/index.js";
import {
  InvalidConfidenceException,
  InvalidPackageStatusException,
  InvalidPageNumberException,
  InvalidPageRangeException,
  UnknownProfileException,
  UnsupportedContentTypeException,
} from "../../domain/exceptions/index.js";
import {
  ContentType,
  DocumentId,
  DocumentType,
  Filename,
  PackageId,
  PackageStatus,
  PageNumber,
  PageRange,
  SourceFileId,
  StorageKey,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import {
  VerificationPackageMapper,
  type DocumentRow,
  type PackageRow,
  type PageRow,
  type SourceFileRow,
} from "./verification-package.mapper.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

const FILE_ID = "0190a1b2-c3d4-7e5f-8a9b-00000000f11e";

function aPageRow(overrides: Partial<PageRow> = {}): PageRow {
  return {
    id: anId(),
    pageNumber: 1,
    imageStorageKey: `pages/${anId()}.png`,
    imageContentType: "image/png",
    ocr: { text: "REPUBLIC OF AZERBAIJAN\nPASSPORT", confidence: 0.91 },
    ...overrides,
  };
}

function aSourceFileRow(overrides: Partial<SourceFileRow> = {}): SourceFileRow {
  return {
    id: FILE_ID,
    originalFilename: "submission.pdf",
    contentType: "application/pdf",
    storageKey: `uploads/${anId()}/submission.pdf`,
    pages: [aPageRow()],
    ...overrides,
  };
}

function aDocumentRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: anId(),
    sourceFileId: FILE_ID,
    firstPage: 1,
    lastPage: 1,
    type: "passport",
    classificationConfidence: 0.94,
    extractedFields: [
      { name: "first_name", value: "ELCHIN", confidence: 0.92, pageNumber: 1 },
    ],
    ...overrides,
  };
}

function aPackageRow(overrides: Partial<PackageRow> = {}): PackageRow {
  return {
    id: anId(),
    status: "Processing",
    profileKey: "demo",
    version: 3,
    sourceFiles: [aSourceFileRow()],
    documents: [aDocumentRow()],
    ...overrides,
  };
}

describe("VerificationPackageMapper", () => {
  describe("toDomain", () => {
    it("rebuilds the package's identity, profile, status and version from the row", () => {
      const row = aPackageRow({ status: "Completed", profileKey: "cadastre" });

      const aggregate = VerificationPackageMapper.toDomain(row);

      expect(aggregate.id.value).toBe(row.id);
      expect(aggregate.profile).toBe(VerificationProfile.CADASTRE);
      expect(aggregate.status.equals(PackageStatus.COMPLETED)).toBe(true);
      expect(aggregate.version).toBe(3);
    });

    it("rebuilds a file's own values through their constructors, so a padded column comes back trimmed", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({ originalFilename: "  submission.pdf  " }),
        ],
      });

      const [file] = VerificationPackageMapper.toDomain(row).files;

      expect(file?.filename.value).toBe("submission.pdf");
      expect(file?.contentType.equals(ContentType.PDF)).toBe(true);
    });

    it("hangs a document off the file it was found in, over the sheets it occupies", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [aPageRow({ pageNumber: 1 }), aPageRow({ pageNumber: 2 })],
          }),
        ],
        documents: [aDocumentRow({ firstPage: 1, lastPage: 2 })],
      });

      const [document] = VerificationPackageMapper.toDomain(row).documents;

      expect(document?.sourceFileId.value).toBe(FILE_ID);
      expect(document?.pages.first.value).toBe(1);
      expect(document?.pages.last.value).toBe(2);
    });

    it("rebuilds several documents of one file", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [
              aPageRow({ pageNumber: 1 }),
              aPageRow({ pageNumber: 2 }),
              aPageRow({ pageNumber: 3 }),
            ],
          }),
        ],
        documents: [
          aDocumentRow({ firstPage: 1, lastPage: 1 }),
          aDocumentRow({ firstPage: 2, lastPage: 3, type: "title_deed" }),
        ],
      });

      const aggregate = VerificationPackageMapper.toDomain(row);

      expect(aggregate.documents).toHaveLength(2);
      expect(
        aggregate.documentsIn(SourceFileId.of(FILE_ID)),
      ).toHaveLength(2);
    });

    it("rebuilds a page's OCR as the domain's own result", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [aPageRow({ ocr: { text: "PASSPORT", confidence: 0.77 } })],
          }),
        ],
      });

      const [file] = VerificationPackageMapper.toDomain(row).files;
      const ocr = file?.pages[0]?.ocr;

      expect(ocr?.text.value).toBe("PASSPORT");
      expect(ocr?.confidence.value).toBe(0.77);
    });

    it("rebuilds a page's image as the object it is and the format it is in", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [
              aPageRow({
                imageStorageKey: "pages/sheet.png",
                imageContentType: "image/png",
              }),
            ],
          }),
        ],
      });

      const image = VerificationPackageMapper.toDomain(row).files[0]?.pages[0]
        ?.image;

      expect(image?.storageKey.value).toBe("pages/sheet.png");
      expect(image?.contentType.equals(ContentType.PNG)).toBe(true);
    });

    it("refuses a row whose page image is in a format nothing here can read", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [aPageRow({ imageContentType: "image/tiff" })],
          }),
        ],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        UnsupportedContentTypeException,
      );
    });

    it("brings a document back unclassified when the row carries no type", () => {
      const row = aPackageRow({
        documents: [aDocumentRow({ type: null, classificationConfidence: null })],
      });

      const [document] = VerificationPackageMapper.toDomain(row).documents;

      expect(document?.isClassified).toBe(false);
    });

    it("brings a typed document back as unsure rather than unclassified when the confidence column is empty", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({ type: "passport", classificationConfidence: null }),
        ],
      });

      const [document] = VerificationPackageMapper.toDomain(row).documents;

      expect(document?.isClassified).toBe(true);
      expect(document?.classification?.confidence.value).toBe(0);
    });

    it("brings a page back unrecognised when the row carries no OCR", () => {
      const row = aPackageRow({
        sourceFiles: [aSourceFileRow({ pages: [aPageRow({ ocr: null })] })],
      });

      const [file] = VerificationPackageMapper.toDomain(row).files;

      expect(file?.pages[0]?.isRecognised).toBe(false);
    });

    it("puts the pages back into reading order when the rows arrive shuffled", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [
              aPageRow({ pageNumber: 3 }),
              aPageRow({ pageNumber: 1 }),
              aPageRow({ pageNumber: 2 }),
            ],
          }),
        ],
      });

      const [file] = VerificationPackageMapper.toDomain(row).files;

      expect(file?.pages.map((page) => page.number.value)).toEqual([1, 2, 3]);
    });

    it("records nothing, because a package read from storage has not just done anything", () => {
      const aggregate = VerificationPackageMapper.toDomain(aPackageRow());

      expect(aggregate.getUncommittedEvents()).toEqual([]);
    });

    it("refuses a row whose profile key no profile answers to", () => {
      expect(() =>
        VerificationPackageMapper.toDomain(aPackageRow({ profileKey: "none" })),
      ).toThrow(UnknownProfileException);
    });

    it("refuses a row whose status is not one the pipeline knows", () => {
      expect(() =>
        VerificationPackageMapper.toDomain(aPackageRow({ status: "Paused" })),
      ).toThrow(InvalidPackageStatusException);
    });

    it("refuses a row whose content type is not a format the system accepts", () => {
      const row = aPackageRow({
        sourceFiles: [aSourceFileRow({ contentType: "application/msword" })],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        UnsupportedContentTypeException,
      );
    });

    it("refuses a row whose OCR confidence is outside 0..1", () => {
      const row = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [aPageRow({ ocr: { text: "PASSPORT", confidence: 1.4 } })],
          }),
        ],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        InvalidConfidenceException,
      );
    });

    it("refuses a row whose page number is not a sheet of a file", () => {
      const row = aPackageRow({
        sourceFiles: [aSourceFileRow({ pages: [aPageRow({ pageNumber: 0 })] })],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        InvalidPageNumberException,
      );
    });

    it("refuses a document row that ends before it starts", () => {
      const row = aPackageRow({
        documents: [aDocumentRow({ firstPage: 4, lastPage: 2 })],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        InvalidPageRangeException,
      );
    });
  });

  describe("toRow", () => {
    it("writes a freshly created package as a pending row with its files and no documents", () => {
      const storageKey = `uploads/${anId()}/submission.pdf`;
      const aggregate = VerificationPackage.create(
        PackageId.of(anId()),
        VerificationProfile.CADASTRE,
        [
          SourceFile.create(
            SourceFileId.of(anId()),
            Filename.create("submission.pdf"),
            ContentType.PDF,
            StorageKey.create(storageKey),
          ),
        ],
      );

      const row = VerificationPackageMapper.toRow(aggregate);

      expect(row.status).toBe("Pending");
      expect(row.profileKey).toBe("cadastre");
      expect(row.documents).toEqual([]);
      expect(row.sourceFiles).toEqual([
        {
          id: aggregate.files[0]!.id.value,
          originalFilename: "submission.pdf",
          contentType: "application/pdf",
          storageKey,
          pages: [],
        },
      ]);
    });

    it("writes no version, because the version belongs to the write and not to the state", () => {
      const row = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(aPackageRow({ version: 9 })),
      );

      expect(row).not.toHaveProperty("version");
    });

    it("writes a document under the file it was found in, with the sheets it spans", () => {
      const aggregate = VerificationPackageMapper.toDomain(
        aPackageRow({
          sourceFiles: [
            aSourceFileRow({
              pages: [aPageRow({ pageNumber: 1 }), aPageRow({ pageNumber: 2 })],
            }),
          ],
          documents: [aDocumentRow({ firstPage: 1, lastPage: 2 })],
        }),
      );

      const [document] = VerificationPackageMapper.toRow(aggregate).documents;

      expect(document?.sourceFileId).toBe(FILE_ID);
      expect(document?.firstPage).toBe(1);
      expect(document?.lastPage).toBe(2);
    });

    it("writes the type and its confidence together, or neither of them", () => {
      const typed = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(aPackageRow()),
      );
      const untyped = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(
          aPackageRow({
            documents: [
              aDocumentRow({ type: null, classificationConfidence: null }),
            ],
          }),
        ),
      );

      expect(typed.documents[0]?.type).toBe("passport");
      expect(typed.documents[0]?.classificationConfidence).toBe(0.94);
      expect(untyped.documents[0]?.type).toBeNull();
      expect(untyped.documents[0]?.classificationConfidence).toBeNull();
    });

    it("writes the missing confidence of an older typed row back as nothing-was-known, not as absent", () => {
      const aggregate = VerificationPackageMapper.toDomain(
        aPackageRow({
          documents: [
            aDocumentRow({ type: "passport", classificationConfidence: null }),
          ],
        }),
      );

      const row = VerificationPackageMapper.toRow(aggregate);

      expect(row.documents[0]?.classificationConfidence).toBe(0);
    });

    it("writes an unrecognised page with no OCR of its own", () => {
      const aggregate = VerificationPackageMapper.toDomain(
        aPackageRow({
          sourceFiles: [aSourceFileRow({ pages: [aPageRow({ ocr: null })] })],
        }),
      );

      const row = VerificationPackageMapper.toRow(aggregate);

      expect(row.sourceFiles[0]?.pages[0]?.ocr).toBeNull();
    });
  });

  describe("a full round trip", () => {
    it("gives back every file, page, OCR result, document, classification and extracted field unchanged", () => {
      const original = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [
              aPageRow({ pageNumber: 1 }),
              aPageRow({ pageNumber: 2, ocr: null }),
            ],
          }),
        ],
        documents: [
          aDocumentRow({ firstPage: 1, lastPage: 1 }),
          aDocumentRow({
            firstPage: 2,
            lastPage: 2,
            type: "application",
            classificationConfidence: 0.7,
            extractedFields: [
              {
                name: "applicant_name",
                value: "ELCHIN",
                confidence: 0.8,
                pageNumber: 2,
              },
            ],
          }),
        ],
      });

      const written = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(original),
      );

      expect(written.sourceFiles).toEqual(
        original.sourceFiles.map((file) => ({
          id: file.id,
          originalFilename: file.originalFilename,
          contentType: file.contentType,
          storageKey: file.storageKey,
          pages: file.pages.map((page) => ({ ...page })),
        })),
      );
      expect(written.documents).toEqual(
        original.documents.map(({ extractedFields, ...rest }) => ({
          ...rest,
          fields: extractedFields.map((field) => ({ ...field })),
        })),
      );
    });

    it("writes the pages in reading order even when they were read back shuffled", () => {
      const shuffled = aPackageRow({
        sourceFiles: [
          aSourceFileRow({
            pages: [
              aPageRow({ pageNumber: 2 }),
              aPageRow({ pageNumber: 3 }),
              aPageRow({ pageNumber: 1 }),
            ],
          }),
        ],
      });

      const written = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(shuffled),
      );

      expect(
        written.sourceFiles[0]?.pages.map((page) => page.pageNumber),
      ).toEqual([1, 2, 3]);
    });

    it("keeps a document the domain built through the pipeline", () => {
      const file = SourceFile.create(
        SourceFileId.of(anId()),
        Filename.create("submission.pdf"),
        ContentType.PDF,
        StorageKey.create(`uploads/${anId()}/submission.pdf`),
      );
      const document = Document.create(
        DocumentId.of(anId()),
        file.id,
        PageRange.of(PageNumber.of(1), PageNumber.of(2)),
      );
      const aggregate = VerificationPackage.restore({
        id: PackageId.of(anId()),
        version: 2,
        profile: VerificationProfile.CADASTRE,
        status: PackageStatus.PROCESSING,
        files: [file],
        documents: [
          document.classifiedAs(
            VerificationPackageMapper.toDomain(aPackageRow()).documents[0]!
              .classification!,
          ),
        ],
      });

      const row = VerificationPackageMapper.toRow(aggregate);

      expect(row.documents[0]?.type).toBe(DocumentType.create("passport").value);
      expect(row.documents[0]?.firstPage).toBe(1);
      expect(row.documents[0]?.lastPage).toBe(2);
    });
  });
});
