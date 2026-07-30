import { describe, expect, it } from "vitest";

import { VerificationPackage } from "../../domain/aggregates/index.js";
import { Document } from "../../domain/entities/index.js";
import {
  InvalidConfidenceException,
  InvalidPackageStatusException,
  InvalidPageNumberException,
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
  StorageKey,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import {
  VerificationPackageMapper,
  type DocumentRow,
  type PackageRow,
  type PageRow,
} from "./verification-package.mapper.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

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

function aDocumentRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: anId(),
    originalFilename: "passport.pdf",
    contentType: "application/pdf",
    storageKey: `uploads/${anId()}/passport.pdf`,
    type: "passport",
    classificationConfidence: 0.94,
    pages: [aPageRow()],
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
    documents: [aDocumentRow()],
    ...overrides,
  };
}

function asWrittenDocument(row: DocumentRow) {
  const { extractedFields, pages, ...rest } = row;

  return {
    ...rest,
    pages: pages.map((page) => ({ ...page })),
    fields: extractedFields.map((field) => ({ ...field })),
  };
}

describe("VerificationPackageMapper", () => {
  describe("toDomain", () => {
    it("rebuilds the package's identity, profile, status and version from the row", () => {
      const row = aPackageRow({ status: "Completed", profileKey: "cadastre" });

      const aggregate = VerificationPackageMapper.toDomain(row);

      expect(aggregate.id.equals(PackageId.of(row.id))).toBe(true);
      expect(aggregate.version).toBe(3);
      expect(aggregate.profile).toBe(VerificationProfile.CADASTRE);
      expect(aggregate.status).toBe(PackageStatus.COMPLETED);
    });

    it("rebuilds the document's own values through their constructors, so a padded column comes back trimmed", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({
            originalFilename: "  passport.pdf  ",
            storageKey: "  uploads/passport.pdf  ",
            type: "  passport  ",
            extractedFields: [
              {
                name: "  first_name  ",
                value: "  ELCHIN  ",
                confidence: 0.92,
                pageNumber: 1,
              },
            ],
          }),
        ],
      });

      const document = VerificationPackageMapper.toDomain(row).documents[0]!;

      expect(document.filename.equals(Filename.create("passport.pdf"))).toBe(
        true,
      );
      expect(
        document.storageKey.equals(StorageKey.create("uploads/passport.pdf")),
      ).toBe(true);
      expect(document.contentType).toBe(ContentType.PDF);
      expect(
        document.classification?.type.equals(DocumentType.create("passport")),
      ).toBe(true);
      expect(document.fields[0]?.key.value).toBe("first_name");
      expect(document.fields[0]?.value.value).toBe("ELCHIN");
    });

    it("rebuilds a page's OCR as the domain's own result", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({
            pages: [
              aPageRow({ ocr: { text: "PASSPORT", confidence: 0.88 } }),
            ],
          }),
        ],
      });

      const [page] = VerificationPackageMapper.toDomain(row).documents[0]!.pages;

      expect(page?.isRecognised).toBe(true);
      expect(page?.ocr?.text.value).toBe("PASSPORT");
      expect(page?.ocr?.confidence.value).toBe(0.88);
    });

    it("rebuilds a page's image as the object it is and the format it is in", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({
            contentType: "application/pdf",
            pages: [
              aPageRow({
                imageStorageKey: "uploads/passport.pdf/pages/page_001.png",
                imageContentType: "image/png",
              }),
            ],
          }),
        ],
      });

      const [page] = VerificationPackageMapper.toDomain(row).documents[0]!.pages;

      expect(page?.image.storageKey.value).toBe(
        "uploads/passport.pdf/pages/page_001.png",
      );
      expect(page?.image.contentType.equals(ContentType.PNG)).toBe(true);
    });

    it("refuses a row whose page image is in a format nothing here can read", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({ pages: [aPageRow({ imageContentType: "image/tiff" })] }),
        ],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        UnsupportedContentTypeException,
      );
    });

    it("brings a document back unclassified when the row carries no type", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({ type: null, classificationConfidence: null, extractedFields: [] }),
        ],
      });

      const [document] = VerificationPackageMapper.toDomain(row).documents;

      expect(document?.classification).toBeNull();
      expect(document?.isClassified).toBe(false);
    });

    it("brings a typed document back as unsure rather than unclassified when the confidence column is empty", () => {
      const row = aPackageRow({
        documents: [aDocumentRow({ classificationConfidence: null })],
      });

      const [document] = VerificationPackageMapper.toDomain(row).documents;

      expect(document?.isClassified).toBe(true);
      expect(document?.classification?.confidence.value).toBe(0);
      expect(document?.classification?.isPlaced).toBe(true);
    });

    it("brings a page back unrecognised when the row carries no OCR", () => {
      const row = aPackageRow({
        documents: [aDocumentRow({ pages: [aPageRow({ ocr: null })] })],
      });

      const [page] = VerificationPackageMapper.toDomain(row).documents[0]!.pages;

      expect(page?.ocr).toBeNull();
      expect(page?.isRecognised).toBe(false);
    });

    it("keeps the pages in reading order", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({
            pages: [aPageRow({ pageNumber: 1 }), aPageRow({ pageNumber: 2 }), aPageRow({ pageNumber: 3 })],
          }),
        ],
      });

      const [document] = VerificationPackageMapper.toDomain(row).documents;

      expect(document?.pages.map((page) => page.number.value)).toEqual([1, 2, 3]);
    });

    it("puts the pages back into reading order when the rows arrive shuffled", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({
            pages: [aPageRow({ pageNumber: 3 }), aPageRow({ pageNumber: 1 }), aPageRow({ pageNumber: 2 })],
          }),
        ],
      });

      const [document] = VerificationPackageMapper.toDomain(row).documents;

      expect(document?.pages.map((page) => page.number.value)).toEqual([1, 2, 3]);
    });

    it("keeps the documents in the order the rows arrived in", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({ originalFilename: "passport.pdf" }),
          aDocumentRow({ originalFilename: "application.pdf", type: "application" }),
          aDocumentRow({ originalFilename: "deed.pdf", type: null, classificationConfidence: null, extractedFields: [] }),
        ],
      });

      const aggregate = VerificationPackageMapper.toDomain(row);

      expect(aggregate.documents.map((document) => document.filename.value)).toEqual([
        "passport.pdf",
        "application.pdf",
        "deed.pdf",
      ]);
    });

    it("records nothing, because a package read from storage has not just done anything", () => {
      const aggregate = VerificationPackageMapper.toDomain(aPackageRow());

      expect(aggregate.getUncommittedEvents()).toEqual([]);
    });

    it("refuses a row whose profile key no profile answers to", () => {
      const row = aPackageRow({ profileKey: "retired-profile" });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        UnknownProfileException,
      );
    });

    it("refuses a row whose status is not one the pipeline knows", () => {
      const row = aPackageRow({ status: "Archived" });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        InvalidPackageStatusException,
      );
    });

    it("refuses a row whose content type is not a format the system accepts", () => {
      const row = aPackageRow({
        documents: [aDocumentRow({ contentType: "image/tiff" })],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        UnsupportedContentTypeException,
      );
    });

    it("refuses a row whose OCR confidence is outside 0..1", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({ pages: [aPageRow({ ocr: { text: "PASSPORT", confidence: 1.5 } })] }),
        ],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        InvalidConfidenceException,
      );
    });

    it("refuses a row whose page number is not a sheet of a document", () => {
      const row = aPackageRow({
        documents: [aDocumentRow({ pages: [aPageRow({ pageNumber: 0 })] })],
      });

      expect(() => VerificationPackageMapper.toDomain(row)).toThrow(
        InvalidPageNumberException,
      );
    });
  });

  describe("toRow", () => {
    it("writes a freshly created package as a pending row with no classification and no pages", () => {
      const documentId = DocumentId.of(anId());
      const aggregate = VerificationPackage.create(
        PackageId.of(anId()),
        VerificationProfile.DEMO,
        [
          Document.create(
            documentId,
            Filename.create("passport.pdf"),
            ContentType.PDF,
            StorageKey.create("uploads/passport.pdf"),
          ),
        ],
      );

      const write = VerificationPackageMapper.toRow(aggregate);

      expect(write).toEqual({
        id: aggregate.id.value,
        status: "Pending",
        profileKey: "demo",
        documents: [
          {
            id: documentId.value,
            originalFilename: "passport.pdf",
            contentType: "application/pdf",
            storageKey: "uploads/passport.pdf",
            type: null,
            classificationConfidence: null,
            pages: [],
            fields: [],
          },
        ],
      });
    });

    it("writes no version, because the version belongs to the write and not to the state", () => {
      const write = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(aPackageRow({ version: 9 })),
      );

      expect(write).not.toHaveProperty("version");
    });

    it("writes the type and its confidence together, or neither of them", () => {
      const aggregate = VerificationPackageMapper.toDomain(
        aPackageRow({
          documents: [
            aDocumentRow({ type: "passport", classificationConfidence: 0.94 }),
            aDocumentRow({ type: null, classificationConfidence: null, extractedFields: [] }),
          ],
        }),
      );

      const write = VerificationPackageMapper.toRow(aggregate);

      expect(write.documents[0]?.type).toBe("passport");
      expect(write.documents[0]?.classificationConfidence).toBe(0.94);
      expect(write.documents[1]?.type).toBeNull();
      expect(write.documents[1]?.classificationConfidence).toBeNull();
    });

    it("writes the missing confidence of an older typed row back as nothing-was-known, not as absent", () => {
      const aggregate = VerificationPackageMapper.toDomain(
        aPackageRow({
          documents: [aDocumentRow({ type: "passport", classificationConfidence: null })],
        }),
      );

      const write = VerificationPackageMapper.toRow(aggregate);

      expect(write.documents[0]?.type).toBe("passport");
      expect(write.documents[0]?.classificationConfidence).toBe(0);
    });

    it("writes an unrecognised page with no OCR of its own", () => {
      const aggregate = VerificationPackageMapper.toDomain(
        aPackageRow({
          documents: [aDocumentRow({ pages: [aPageRow({ ocr: null })] })],
        }),
      );

      const write = VerificationPackageMapper.toRow(aggregate);

      expect(write.documents[0]?.pages[0]?.ocr).toBeNull();
    });
  });

  describe("a full round trip", () => {
    it("gives back every document, page, OCR result, classification and extracted field unchanged", () => {
      const row = aPackageRow({
        status: "Processing",
        profileKey: "cadastre",
        documents: [
          aDocumentRow({
            originalFilename: "passport.pdf",
            type: "passport",
            classificationConfidence: 0.94,
            pages: [
              aPageRow({ pageNumber: 1, ocr: { text: "PASSPORT", confidence: 0.91 } }),
              aPageRow({ pageNumber: 2, ocr: { text: "Passport No: AZE1234567", confidence: 0.87 } }),
            ],
            extractedFields: [
              { name: "first_name", value: "ELCHIN", confidence: 0.92, pageNumber: 1 },
              { name: "passport_no", value: "AZE1234567", confidence: 0.9, pageNumber: 2 },
            ],
          }),
          aDocumentRow({
            originalFilename: "scan.jpg",
            contentType: "image/jpeg",
            type: null,
            classificationConfidence: null,
            pages: [aPageRow({ pageNumber: 1, ocr: null })],
            extractedFields: [],
          }),
        ],
      });

      const write = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(row),
      );

      expect(write).toEqual({
        id: row.id,
        status: row.status,
        profileKey: row.profileKey,
        documents: row.documents.map(asWrittenDocument),
      });
    });

    it("writes the pages in reading order even when they were read back shuffled", () => {
      const row = aPackageRow({
        documents: [
          aDocumentRow({
            pages: [aPageRow({ pageNumber: 2 }), aPageRow({ pageNumber: 1 })],
          }),
        ],
      });

      const write = VerificationPackageMapper.toRow(
        VerificationPackageMapper.toDomain(row),
      );

      expect(write.documents[0]?.pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    });
  });
});
