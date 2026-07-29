import { PackageDetailDtoSchema, PackageDtoSchema } from "@cadastre/contracts";
import { describe, expect, it } from "vitest";

import type {
  DocumentView,
  PackageDetailView,
  PackageSummaryView,
} from "../../application/read-models/index.js";
import { toDetailDto, toSummaryDto } from "./package.presenter.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

function aSummaryView(
  overrides: Partial<PackageSummaryView> = {},
): PackageSummaryView {
  return {
    id: anId(),
    status: "Completed",
    profileKey: "cadastre",
    documentsCount: 3,
    classifiedCount: 3,
    unclassifiedCount: 1,
    extractedCount: 2,
    createdAt: new Date("2026-03-14T08:15:30.000Z"),
    updatedAt: new Date("2026-03-14T09:02:11.250Z"),
    ...overrides,
  };
}

function aDocumentView(overrides: Partial<DocumentView> = {}): DocumentView {
  return {
    id: anId(),
    originalFilename: "passport.pdf",
    contentType: "application/pdf",
    type: "passport",
    classificationConfidence: 0.94,
    pages: [{ pageNumber: 1, ocr: { text: "PASSPORT", confidence: 0.91 } }],
    fields: [
      { name: "first_name", value: "ELCHIN", confidence: 0.92, pageNumber: 1 },
    ],
    ...overrides,
  };
}

function aDetailView(
  overrides: Partial<PackageDetailView> = {},
): PackageDetailView {
  return {
    ...aSummaryView(),
    documents: [aDocumentView()],
    ...overrides,
  };
}

describe("toSummaryDto", () => {
  it("renders both timestamps as ISO-8601 strings, because the wire carries no Date", () => {
    const view = aSummaryView({
      createdAt: new Date("2026-03-14T08:15:30.000Z"),
      updatedAt: new Date("2026-03-14T09:02:11.250Z"),
    });

    const dto = toSummaryDto(view);

    expect(dto.createdAt).toBe("2026-03-14T08:15:30.000Z");
    expect(dto.updatedAt).toBe("2026-03-14T09:02:11.250Z");
  });

  it("carries the register's identity, status and profile across unchanged", () => {
    const view = aSummaryView({ status: "Processing", profileKey: "demo" });

    const dto = toSummaryDto(view);

    expect(dto.id).toBe(view.id);
    expect(dto.status).toBe("Processing");
    expect(dto.profileKey).toBe("demo");
  });

  it("carries every progress count across unchanged", () => {
    const view = aSummaryView({
      documentsCount: 4,
      classifiedCount: 3,
      unclassifiedCount: 1,
      extractedCount: 2,
    });

    const dto = toSummaryDto(view);

    expect(dto.documentsCount).toBe(4);
    expect(dto.classifiedCount).toBe(3);
    expect(dto.unclassifiedCount).toBe(1);
    expect(dto.extractedCount).toBe(2);
  });

  it("renders a package nothing has happened to yet with counts of zero", () => {
    const dto = toSummaryDto(
      aSummaryView({
        status: "Pending",
        documentsCount: 0,
        classifiedCount: 0,
        unclassifiedCount: 0,
        extractedCount: 0,
      }),
    );

    expect(dto.documentsCount).toBe(0);
    expect(dto.extractedCount).toBe(0);
  });

  it("answers a shape the published summary contract accepts", () => {
    const dto = toSummaryDto(aSummaryView());

    expect(PackageDtoSchema.parse(dto)).toEqual(dto);
  });

  it("says nothing about the documents, because a register row does not carry them", () => {
    const dto = toSummaryDto(aDetailView());

    expect(dto).not.toHaveProperty("documents");
  });
});

describe("toDetailDto", () => {
  it("carries the summary fields onto the detail, so one shape serves both screens", () => {
    const view = aDetailView({
      status: "Completed",
      profileKey: "demo",
      documentsCount: 2,
      classifiedCount: 2,
      unclassifiedCount: 0,
      extractedCount: 2,
    });

    const dto = toDetailDto(view);

    expect(dto).toMatchObject({
      id: view.id,
      status: "Completed",
      profileKey: "demo",
      documentsCount: 2,
      classifiedCount: 2,
      unclassifiedCount: 0,
      extractedCount: 2,
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
    });
  });

  it("renders a package with no documents as an empty list rather than leaving it out", () => {
    const dto = toDetailDto(aDetailView({ documents: [] }));

    expect(dto.documents).toEqual([]);
  });

  it("renders every document in the order the read model listed them", () => {
    const dto = toDetailDto(
      aDetailView({
        documents: [
          aDocumentView({ originalFilename: "passport.pdf" }),
          aDocumentView({ originalFilename: "application.pdf" }),
          aDocumentView({ originalFilename: "deed.pdf" }),
        ],
      }),
    );

    expect(dto.documents.map((document) => document.originalFilename)).toEqual([
      "passport.pdf",
      "application.pdf",
      "deed.pdf",
    ]);
  });

  it("renders a document the classifier has not reached with no type and no confidence", () => {
    const dto = toDetailDto(
      aDetailView({
        documents: [
          aDocumentView({ type: null, classificationConfidence: null, fields: [] }),
        ],
      }),
    );

    expect(dto.documents[0]?.type).toBeNull();
    expect(dto.documents[0]?.classificationConfidence).toBeNull();
  });

  it("renders a page OCR has not read yet with no OCR block", () => {
    const dto = toDetailDto(
      aDetailView({
        documents: [
          aDocumentView({ pages: [{ pageNumber: 1, ocr: null }] }),
        ],
      }),
    );

    expect(dto.documents[0]?.pages).toEqual([{ pageNumber: 1, ocr: null }]);
  });

  it("renders each page's OCR text and confidence", () => {
    const dto = toDetailDto(
      aDetailView({
        documents: [
          aDocumentView({
            pages: [
              { pageNumber: 1, ocr: { text: "PASSPORT", confidence: 0.91 } },
              { pageNumber: 2, ocr: { text: "AZE1234567", confidence: 0.87 } },
            ],
          }),
        ],
      }),
    );

    expect(dto.documents[0]?.pages).toEqual([
      { pageNumber: 1, ocr: { text: "PASSPORT", confidence: 0.91 } },
      { pageNumber: 2, ocr: { text: "AZE1234567", confidence: 0.87 } },
    ]);
  });

  it("renders a document that has not been split yet with no pages at all", () => {
    const dto = toDetailDto(
      aDetailView({ documents: [aDocumentView({ pages: [] })] }),
    );

    expect(dto.documents[0]?.pages).toEqual([]);
  });

  it("renders a document nothing has been pulled from with no fields at all", () => {
    const dto = toDetailDto(
      aDetailView({ documents: [aDocumentView({ fields: [] })] }),
    );

    expect(dto.documents[0]?.fields).toEqual([]);
  });

  it("renders each extracted field with its key, value, confidence and page", () => {
    const dto = toDetailDto(
      aDetailView({
        documents: [
          aDocumentView({
            fields: [
              { name: "first_name", value: "ELCHIN", confidence: 0.92, pageNumber: 1 },
              { name: "passport_no", value: "AZE1234567", confidence: 0.9, pageNumber: 2 },
            ],
          }),
        ],
      }),
    );

    expect(dto.documents[0]?.fields).toEqual([
      { name: "first_name", value: "ELCHIN", confidence: 0.92, pageNumber: 1 },
      { name: "passport_no", value: "AZE1234567", confidence: 0.9, pageNumber: 2 },
    ]);
  });

  it("answers a shape the published detail contract accepts", () => {
    const dto = toDetailDto(aDetailView());

    expect(PackageDetailDtoSchema.parse(dto)).toEqual(dto);
  });
});
