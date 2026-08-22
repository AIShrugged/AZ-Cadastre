import { describe, expect, it } from 'vitest';

import {
  PackageDetailDtoSchema,
  PackageDtoSchema,
} from '@cadastre/api-contracts/verification';

import type {
  CrossCheckView,
  DocumentView,
  PackageDetailView,
  PackageSummaryView,
  ReportView,
  SourceFileView,
} from '../../read-models/index.js';

import { toDetailDto, toSummaryDto } from './package.mapper.js';

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, '0')}`;
}

function aSummaryView(
  overrides: Partial<PackageSummaryView> = {},
): PackageSummaryView {
  return {
    id: anId(),
    status: 'Completed',
    profileKey: 'cadastre',
    filesCount: 2,
    documentsCount: 3,
    classifiedCount: 3,
    unclassifiedCount: 1,
    extractedCount: 2,
    reportStatus: 'IssuesFound',
    issuesCount: 1,
    lowConfidenceCount: 2,
    createdAt: new Date('2026-03-14T08:15:30.000Z'),
    updatedAt: new Date('2026-03-14T09:02:11.250Z'),
    ...overrides,
  };
}

function aDocumentView(overrides: Partial<DocumentView> = {}): DocumentView {
  return {
    id: anId(),
    firstPage: 1,
    lastPage: 1,
    type: 'passport',
    classificationConfidence: 0.94,
    fields: [
      { name: 'first_name', value: 'ELCHIN', confidence: 0.92, pageNumber: 1 },
    ],
    ...overrides,
  };
}

function aFileView(overrides: Partial<SourceFileView> = {}): SourceFileView {
  return {
    id: anId(),
    originalFilename: 'submission.pdf',
    contentType: 'application/pdf',
    pages: [
      {
        pageNumber: 1,
        imageStorageKey: 'pkg/page_001.png',
        imageUrl: null,
        ocr: { text: 'PASSPORT', confidence: 0.91 },
      },
    ],
    documents: [aDocumentView()],
    ...overrides,
  };
}

function aReportView(overrides: Partial<ReportView> = {}): ReportView {
  return {
    status: 'IssuesFound',
    generatedAt: new Date('2026-03-14T09:02:11.250Z'),
    issues: [
      {
        kind: 'MissingDocument',
        message: 'The package carries no "identity_card".',
        documentId: null,
        sourceFileId: null,
        documentType: 'identity_card',
        fieldName: null,
        checkKey: null,
        pageNumber: null,
        confidence: null,
      },
    ],
    ...overrides,
  };
}

function aCrossCheckView(
  overrides: Partial<CrossCheckView> = {},
): CrossCheckView {
  return {
    key: 'applicant_identity',
    verdict: 'Mismatch',
    confidence: 0.62,
    note: 'the surnames differ',
    values: [
      {
        documentId: anId(),
        documentType: 'identity_card',
        fieldName: 'last_name',
        value: 'ƏLİYEV',
        pageNumber: 2,
        confidence: 0.7,
      },
      {
        documentId: anId(),
        documentType: 'application',
        fieldName: 'applicant_name',
        value: 'Məmmədov Elçin',
        pageNumber: 1,
        confidence: 0.88,
      },
    ],
    ...overrides,
  };
}

function aDetailView(
  overrides: Partial<PackageDetailView> = {},
): PackageDetailView {
  return {
    ...aSummaryView(),
    files: [aFileView()],
    crossChecks: [],
    report: aReportView(),
    ...overrides,
  };
}

describe('toSummaryDto', () => {
  it('renders both timestamps as ISO-8601 strings, because the wire carries no Date', () => {
    const dto = toSummaryDto(aSummaryView());

    expect(dto.createdAt).toBe('2026-03-14T08:15:30.000Z');
    expect(dto.updatedAt).toBe('2026-03-14T09:02:11.250Z');
  });

  it("carries the register's identity, status and profile across unchanged", () => {
    const view = aSummaryView();

    const dto = toSummaryDto(view);

    expect(dto.id).toBe(view.id);
    expect(dto.status).toBe('Completed');
    expect(dto.profileKey).toBe('cadastre');
  });

  it('carries every progress count across unchanged', () => {
    const dto = toSummaryDto(
      aSummaryView({
        filesCount: 2,
        documentsCount: 5,
        classifiedCount: 4,
        unclassifiedCount: 1,
        extractedCount: 3,
      }),
    );

    expect(dto.filesCount).toBe(2);
    expect(dto.documentsCount).toBe(5);
    expect(dto.classifiedCount).toBe(4);
    expect(dto.unclassifiedCount).toBe(1);
    expect(dto.extractedCount).toBe(3);
  });

  it('reports more documents than files, because one file may hold several', () => {
    const dto = toSummaryDto(
      aSummaryView({ filesCount: 1, documentsCount: 4 }),
    );

    expect(dto.documentsCount).toBeGreaterThan(dto.filesCount);
  });

  it('renders a package whose files have not been read yet with no documents', () => {
    const dto = toSummaryDto(
      aSummaryView({
        status: 'Pending',
        filesCount: 2,
        documentsCount: 0,
        classifiedCount: 0,
        unclassifiedCount: 0,
        extractedCount: 0,
      }),
    );

    expect(dto.filesCount).toBe(2);
    expect(dto.documentsCount).toBe(0);
  });

  it('answers a shape the published summary contract accepts', () => {
    expect(() =>
      PackageDtoSchema.parse(toSummaryDto(aSummaryView())),
    ).not.toThrow();
  });

  it('says nothing about the files, because a register row does not carry them', () => {
    expect(toSummaryDto(aSummaryView())).not.toHaveProperty('files');
  });
});

describe('toDetailDto', () => {
  it('carries the summary fields onto the detail, so one shape serves both screens', () => {
    const view = aDetailView();

    const dto = toDetailDto(view);

    expect(dto.id).toBe(view.id);
    expect(dto.status).toBe('Completed');
    expect(dto.filesCount).toBe(view.filesCount);
    expect(dto.documentsCount).toBe(view.documentsCount);
  });

  it('renders a package with no files as an empty list rather than leaving it out', () => {
    const dto = toDetailDto(aDetailView({ files: [] }));

    expect(dto.files).toEqual([]);
  });

  it('renders every file in the order the read model listed them', () => {
    const dto = toDetailDto(
      aDetailView({
        files: [
          aFileView({ originalFilename: 'passport.pdf' }),
          aFileView({ originalFilename: 'application.pdf' }),
          aFileView({ originalFilename: 'deed.pdf' }),
        ],
      }),
    );

    expect(dto.files.map(file => file.originalFilename)).toEqual([
      'passport.pdf',
      'application.pdf',
      'deed.pdf',
    ]);
  });

  it('renders a file the pipeline has not read yet with no documents at all', () => {
    const dto = toDetailDto(
      aDetailView({ files: [aFileView({ documents: [] })] }),
    );

    expect(dto.files[0]?.documents).toEqual([]);
  });

  it('renders every document found inside a file, with the sheets it occupies', () => {
    const dto = toDetailDto(
      aDetailView({
        files: [
          aFileView({
            pages: [
              {
                pageNumber: 1,
                imageStorageKey: 'pkg/page_001.png',
                imageUrl: null,
                ocr: null,
              },
              {
                pageNumber: 2,
                imageStorageKey: 'pkg/page_002.png',
                imageUrl: null,
                ocr: null,
              },
              {
                pageNumber: 3,
                imageStorageKey: 'pkg/page_003.png',
                imageUrl: null,
                ocr: null,
              },
            ],
            documents: [
              aDocumentView({ firstPage: 1, lastPage: 1 }),
              aDocumentView({ firstPage: 2, lastPage: 3, type: 'title_deed' }),
            ],
          }),
        ],
      }),
    );

    expect(
      dto.files[0]?.documents.map(doc => [doc.firstPage, doc.lastPage]),
    ).toEqual([
      [1, 1],
      [2, 3],
    ]);
  });

  it('renders a document the classifier has not reached with no type and no confidence', () => {
    const dto = toDetailDto(
      aDetailView({
        files: [
          aFileView({
            documents: [
              aDocumentView({ type: null, classificationConfidence: null }),
            ],
          }),
        ],
      }),
    );

    expect(dto.files[0]?.documents[0]?.type).toBeNull();
    expect(dto.files[0]?.documents[0]?.classificationConfidence).toBeNull();
  });

  it('renders a page OCR has not read yet with no OCR block', () => {
    const dto = toDetailDto(
      aDetailView({
        files: [
          aFileView({
            pages: [
              {
                pageNumber: 1,
                imageStorageKey: 'pkg/page_001.png',
                imageUrl: null,
                ocr: null,
              },
            ],
          }),
        ],
      }),
    );

    expect(dto.files[0]?.pages[0]?.ocr).toBeNull();
  });

  it("renders each page's OCR text and confidence", () => {
    const dto = toDetailDto(
      aDetailView({
        files: [
          aFileView({
            pages: [
              {
                pageNumber: 1,
                imageStorageKey: 'pkg/page_001.png',
                imageUrl: null,
                ocr: { text: 'PASSPORT', confidence: 0.91 },
              },
              {
                pageNumber: 2,
                imageStorageKey: 'pkg/page_002.png',
                imageUrl: null,
                ocr: { text: 'TITLE DEED', confidence: 0.62 },
              },
            ],
          }),
        ],
      }),
    );

    // The signed link travels; the storage key does not. Where the register
    // keeps a scan is its own business, and a key on the wire is a key someone
    // can ask storage for directly.
    expect(dto.files[0]?.pages).toEqual([
      {
        pageNumber: 1,
        imageUrl: null,
        ocr: { text: 'PASSPORT', confidence: 0.91 },
      },
      {
        pageNumber: 2,
        imageUrl: null,
        ocr: { text: 'TITLE DEED', confidence: 0.62 },
      },
    ]);
  });

  it('renders a file that has not been split yet with no pages at all', () => {
    const dto = toDetailDto(aDetailView({ files: [aFileView({ pages: [] })] }));

    expect(dto.files[0]?.pages).toEqual([]);
  });

  it('renders a document nothing has been pulled from with no fields at all', () => {
    const dto = toDetailDto(
      aDetailView({
        files: [aFileView({ documents: [aDocumentView({ fields: [] })] })],
      }),
    );

    expect(dto.files[0]?.documents[0]?.fields).toEqual([]);
  });

  it('renders each extracted field with its key, value, confidence and page', () => {
    const dto = toDetailDto(
      aDetailView({
        files: [
          aFileView({
            documents: [
              aDocumentView({
                fields: [
                  {
                    name: 'passport_no',
                    value: 'AZE1234567',
                    confidence: 0.88,
                    pageNumber: 2,
                  },
                ],
              }),
            ],
          }),
        ],
      }),
    );

    expect(dto.files[0]?.documents[0]?.fields).toEqual([
      {
        name: 'passport_no',
        value: 'AZE1234567',
        confidence: 0.88,
        pageNumber: 2,
      },
    ]);
  });

  it('renders a package the cross-document stage has not reached with no checks', () => {
    expect(toDetailDto(aDetailView()).crossChecks).toEqual([]);
  });

  it('renders a check with its verdict, its confidence and the line it wrote', () => {
    const dto = toDetailDto(aDetailView({ crossChecks: [aCrossCheckView()] }));

    expect(dto.crossChecks[0]).toMatchObject({
      key: 'applicant_identity',
      verdict: 'Mismatch',
      confidence: 0.62,
      note: 'the surnames differ',
    });
  });

  it('renders both sides of a check, in the order the profile named them', () => {
    const dto = toDetailDto(aDetailView({ crossChecks: [aCrossCheckView()] }));

    expect(dto.crossChecks[0]?.values.map(value => value.value)).toEqual([
      'ƏLİYEV',
      'Məmmədov Elçin',
    ]);
  });

  it('renders a value whose document is gone without a document to jump to', () => {
    const orphaned = aCrossCheckView({
      values: [
        {
          documentId: null,
          documentType: 'identity_card',
          fieldName: 'last_name',
          value: 'ƏLİYEV',
          pageNumber: 2,
          confidence: 0.7,
        },
      ],
    });

    expect(
      toDetailDto(aDetailView({ crossChecks: [orphaned] })).crossChecks[0]
        ?.values[0]?.documentId,
    ).toBeNull();
  });

  it('carries the check a finding came out of, so a reader can name it', () => {
    const report = aReportView({
      issues: [
        {
          kind: 'FieldMismatch',
          message: 'The documents do not agree on "applicant_identity".',
          documentId: null,
          sourceFileId: null,
          documentType: 'identity_card',
          fieldName: 'last_name',
          checkKey: 'applicant_identity',
          pageNumber: 2,
          confidence: 0.62,
        },
      ],
    });

    expect(
      toDetailDto(aDetailView({ report })).report?.issues[0]?.checkKey,
    ).toBe('applicant_identity');
  });

  it('answers a shape the published detail contract accepts', () => {
    expect(() =>
      PackageDetailDtoSchema.parse(toDetailDto(aDetailView())),
    ).not.toThrow();
  });
});
