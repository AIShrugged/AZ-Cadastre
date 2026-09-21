import { describe, expect, it } from 'vitest';

import type {
  DocumentDto,
  DocumentGapDto,
  FieldDto,
  ProfileDto,
  SourceFileDto,
} from '@cadastre/api-contracts/verification';
import { CONFIDENCE_FLOOR } from '@cadastre/api-contracts/verification';

import {
  documentIn,
  fieldsAsked,
  gapKey,
  isSuperseded,
  missingTypes,
  namesAFault,
  requiredShortfall,
  scanShortfall,
  supplyTarget,
} from './document-gaps';

const gap = (over: Partial<DocumentGapDto> = {}): DocumentGapDto => ({
  reason: 'MissingDocument',
  expectedType: 'technical_passport',
  documentId: null,
  sourceFileId: null,
  ...over,
});

const field = (over: Partial<FieldDto> = {}): FieldDto => ({
  name: 'cadastral_number',
  value: '1-2-3',
  confidence: 0.97,
  pageNumber: 1,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
  editedByAccountId: null,
  editedAt: null,
  ...over,
});

const doc = (over: Partial<DocumentDto> = {}): DocumentDto => ({
  id: 'doc-1',
  firstPage: 1,
  lastPage: 2,
  type: 'technical_passport',
  classificationConfidence: 0.96,
  attestation: null,
  fields: [],
  archiveQrCheck: null,
  supersededById: null,
  supersededAt: null,
  ...over,
});

const file = (over: Partial<SourceFileDto> = {}): SourceFileDto => ({
  id: 'file-1',
  originalFilename: 'scan.pdf',
  contentType: 'application/pdf',
  suppliedFor: null,
  pages: [],
  documents: [],
  ...over,
});

const profile: ProfileDto = {
  key: 'cadastre',
  documentTypes: [
    {
      key: 'technical_passport',
      required: true,
      fields: ['cadastral_number', 'area', 'address'],
      source: 'NationalArchive',
    },
    {
      key: 'payment_receipt',
      required: false,
      fields: [],
      source: 'Package',
    },
  ],
  grounds: [],
};

describe('a gap on the screen', () => {
  it('keys two unusable scans of one type apart by the document each names', () => {
    const first = gap({
      reason: 'UnusableScan',
      documentId: 'doc-1',
      sourceFileId: 'file-1',
    });
    const second = gap({
      reason: 'UnusableScan',
      documentId: 'doc-2',
      sourceFileId: 'file-1',
    });

    expect(gapKey(first)).not.toBe(gapKey(second));
  });

  it('keys a missing paper and a replacement of the same type apart', () => {
    expect(gapKey(gap())).not.toBe(
      gapKey(gap({ reason: 'UnusableScan', documentId: 'doc-1' })),
    );
  });

  it('sends back exactly what the gap published, and replaces nothing where the gap named no document', () => {
    expect(supplyTarget(gap())).toEqual({
      expectedType: 'technical_passport',
      replacesDocumentId: null,
    });
  });

  it('sends the document a bad scan would be replaced by as the target', () => {
    expect(
      supplyTarget(gap({ reason: 'UnusableScan', documentId: 'doc-7' })),
    ).toEqual({
      expectedType: 'technical_passport',
      replacesDocumentId: 'doc-7',
    });
  });
});

describe('what the package is short of', () => {
  it('is only the papers the server filed as missing', () => {
    expect(
      missingTypes([
        gap({ expectedType: 'technical_passport' }),
        gap({ reason: 'UnusableScan', expectedType: 'title_deed' }),
        gap({ reason: 'AlwaysAccepted', expectedType: 'payment_receipt' }),
      ]),
    ).toEqual(['technical_passport']);
  });

  it('is empty on a package whose only gap is the paper taken at any time', () => {
    expect(
      missingTypes([
        gap({ reason: 'AlwaysAccepted', expectedType: 'payment_receipt' }),
      ]),
    ).toEqual([]);
  });
});

describe('a document pushed out of force', () => {
  it('is the one carrying the moment it stopped counting', () => {
    expect(isSuperseded(doc())).toBe(false);
    expect(
      isSuperseded(
        doc({ supersededById: 'doc-9', supersededAt: '2026-09-11T10:00:00Z' }),
      ),
    ).toBe(true);
  });

  // A replacement that has since gone with its file leaves the stamp behind:
  // `supersededAt` is what says the document is out of force, not the pointer.
  it('is out of force even when nothing points at what replaced it', () => {
    expect(
      isSuperseded(
        doc({ supersededById: null, supersededAt: '2026-09-11T10:00:00Z' }),
      ),
    ).toBe(true);
  });
});

describe('finding a document across the package', () => {
  const wanted = doc({ id: 'doc-2' });
  const files = [
    file({ id: 'file-1', documents: [doc({ id: 'doc-1' })] }),
    file({ id: 'file-2', originalFilename: 'again.pdf', documents: [wanted] }),
  ];

  it('answers with the file it was carved out of', () => {
    expect(documentIn(files, 'doc-2')).toEqual({
      document: wanted,
      file: files[1],
    });
  });

  it('answers nothing for an id the package does not hold, and for no id at all', () => {
    expect(documentIn(files, 'doc-9')).toBeNull();
    expect(documentIn(files, null)).toBeNull();
  });
});

describe('what the profile asks of a type', () => {
  it('is the field list the engine published', () => {
    expect(fieldsAsked([profile], 'cadastre', 'technical_passport')).toEqual([
      'cadastral_number',
      'area',
      'address',
    ]);
  });

  it('is empty for a profile or a type this build has never heard of', () => {
    expect(
      fieldsAsked([profile], 'nothing_like_it', 'technical_passport'),
    ).toEqual([]);
    expect(fieldsAsked([profile], 'cadastre', 'courier_waybill')).toEqual([]);
  });
});

describe('why a scan is worth sending again', () => {
  const asked = ['cadastral_number', 'area', 'address'];

  it('names the fields the sheets never yielded', () => {
    const shortfall = scanShortfall(doc({ fields: [field()] }), asked);

    expect(shortfall.unread).toEqual(['area', 'address']);
    expect(shortfall.doubted).toEqual([]);
    expect(shortfall.placement).toBeNull();
  });

  it('names what was read here and came back under the floor, with its score', () => {
    const shortfall = scanShortfall(
      doc({
        fields: [
          field(),
          field({ name: 'area', confidence: 0.62 }),
          field({ name: 'address', confidence: CONFIDENCE_FLOOR }),
        ],
      }),
      asked,
    );

    expect(shortfall.unread).toEqual([]);
    expect(shortfall.doubted).toEqual([{ key: 'area', confidence: 0.62 }]);
  });

  // A value printed on another paper of the package is the source's reading
  // discounted: it says nothing about this scan, and the engine excluded it from
  // the rule that published this very gap (ADR-0023).
  it('neither answers a field nor doubts one with a value carried in from elsewhere', () => {
    const shortfall = scanShortfall(
      doc({
        fields: [
          field({
            name: 'area',
            confidence: 0.4,
            origin: 'TakenFromAnotherDocument',
            pageNumber: null,
            takenFrom: {
              documentId: 'doc-5',
              documentType: 'title_deed',
              fieldName: 'area',
              pageNumber: 2,
            },
          }),
        ],
      }),
      asked,
    );

    expect(shortfall.doubted).toEqual([]);
    expect(shortfall.unread).toContain('area');
  });

  it('names a placement the classifier was not sure of', () => {
    const shortfall = scanShortfall(
      doc({
        classificationConfidence: 0.71,
        fields: asked.map(name => field({ name })),
      }),
      asked,
    );

    expect(shortfall.placement).toBe(0.71);
    expect(namesAFault(shortfall)).toBe(true);
  });

  it('has nothing to show when the screen cannot see what the profile asked', () => {
    const shortfall = scanShortfall(doc({ fields: [field()] }), []);

    expect(namesAFault(shortfall)).toBe(false);
  });
});

// Guards the case sheet's "-16 of 2". Every paper that would close a
// requirement is published as its own MissingDocument gap — sixteen titles to
// the land on a case whose provision is still open — and the sheet subtracted
// all of them from the two papers the profile requires.
describe('requiredShortfall', () => {
  const gaps = [
    gap({ expectedType: 'land_plot_plan' }),
    gap({ expectedType: 'state_register_extract' }),
    gap({ expectedType: 'land_state_act' }),
    gap({ expectedType: 'sketch_project' }),
    gap({ reason: 'AlwaysAccepted', expectedType: 'payment_receipt' }),
  ];

  it('counts only the required papers among the missing ones', () => {
    expect(
      requiredShortfall(['sketch_project', 'land_plot_plan'], gaps),
    ).toEqual(['sketch_project', 'land_plot_plan']);
  });

  it('never names more papers than the profile requires', () => {
    const required = ['land_plot_plan', 'application'];
    const short = requiredShortfall(required, gaps);

    expect(short).toEqual(['land_plot_plan']);
    expect(required.length - short.length).toBeGreaterThanOrEqual(0);
  });

  it('ignores a paper the profile takes at any time', () => {
    expect(requiredShortfall(['payment_receipt'], gaps)).toEqual([]);
  });
});
