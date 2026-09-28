import { describe, expect, it } from 'vitest';

import {
  CONFIDENCE_FLOOR,
  type CaseParameter,
  type CaseParameterDto,
  type CaseProvisionDto,
  type DocumentDto,
  type FieldDto,
} from '@cadastre/api-contracts/verification';

import {
  doubtfulParameters,
  isDoubtful,
  restsOnUnconfirmed,
} from './provision-confidence';

const field = (over: Partial<FieldDto> = {}): FieldDto => ({
  name: 'storeys',
  value: '2',
  confidence: 0.5,
  pageNumber: 1,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
  editedByAccountId: null,
  editedAt: null,
  ...over,
});

const doc = (over: Partial<DocumentDto> = {}): DocumentDto =>
  ({
    id: 'doc-1',
    firstPage: 1,
    lastPage: 1,
    type: 'sketch_design',
    classificationConfidence: 0.99,
    attestation: null,
    fields: [field()],
    archiveQrCheck: null,
    spanMarkup: null,
    supersededById: null,
    supersededAt: null,
    ...over,
  }) as DocumentDto;

const parameter = (
  name: CaseParameter,
  confidence: number | null,
  over: Partial<CaseParameterDto> = {},
): CaseParameterDto => ({
  parameter: name,
  value: 2,
  source: 'ReadOffDocument',
  stated: null,
  from: {
    documentId: 'doc-1',
    documentType: 'sketch_design',
    fieldName: name,
    pageNumber: 1,
    confidence,
  },
  calculation: null,
  ...over,
});

const provision = (
  parameters: CaseParameterDto[],
  turnsOn: CaseParameter[],
): CaseProvisionDto =>
  ({
    key: 'case-1',
    outcome: 'Determined',
    provision: '8.0.9.2',
    candidates: [],
    undecidedOn: [],
    parameters,
    rules: [
      {
        provision: '8.0.9.2',
        description: 'Before 2013, over 12 m',
        conditions: turnsOn.map(name => ({ parameter: name, holds: true })),
        excluded: false,
        holds: true,
      },
      {
        provision: '8.0.10.1',
        description: 'From 2013, permit',
        conditions: [{ parameter: 'builtYear', holds: false }],
        excluded: false,
        holds: false,
      },
    ],
    provisions: [],
    titleDocuments: [],
  }) as CaseProvisionDto;

describe('isDoubtful', () => {
  it('marks a figure read below the floor', () => {
    expect(
      isDoubtful(parameter('storeys', 0.5), [
        doc({ fields: [field({ name: 'storeys' })] }),
      ]),
    ).toBe(true);
  });

  it('leaves a figure read at the floor unmarked', () => {
    expect(
      isDoubtful(parameter('storeys', CONFIDENCE_FLOOR), [
        doc({ fields: [field({ name: 'storeys', confidence: 0.8 })] }),
      ]),
    ).toBe(false);
  });

  it('treats a reading nobody scored as doubtful, not as certain', () => {
    expect(isDoubtful(parameter('storeys', null), [doc()])).toBe(true);
  });

  it('drops the mark once the operator has entered the value', () => {
    const entered = doc({
      fields: [
        field({ name: 'storeys', origin: 'EnteredByOperator', confidence: 1 }),
      ],
    });

    // The figure still carries the reading's own confidence on the wire; the
    // origin on the line is what says a person settled it.
    expect(isDoubtful(parameter('storeys', 0.5), [entered])).toBe(false);
  });

  it('marks nothing where no paper stated the figure', () => {
    const declared = parameter('builtYear', null, {
      source: 'DeclaredAtIntake',
      from: null,
    });

    expect(isDoubtful(declared, [doc()])).toBe(false);
  });

  it('marks a figure decided by the kind of a title document', () => {
    // No line of the paper stated it — the paper's own placement did, with a
    // confidence of its own — and the case rests on that placement all the
    // same. There is no field to settle it on, so the mark opens the document.
    const byKind = parameter('landRight', 0.5, {
      value: 'Ownership',
      source: 'TitleDocumentType',
      from: {
        documentId: 'doc-1',
        documentType: 'state_act',
        fieldName: null,
        pageNumber: null,
        confidence: 0.5,
      },
    });

    expect(isDoubtful(byKind, [doc()])).toBe(true);
  });

  it('still marks a figure whose document this read no longer carries', () => {
    expect(isDoubtful(parameter('storeys', 0.5), [])).toBe(true);
  });
});

describe('doubtfulParameters', () => {
  it('names every figure below the floor and no other', () => {
    const case_ = provision(
      [
        parameter('storeys', 0.5),
        parameter('height', null),
        parameter('builtYear', 0.97),
      ],
      ['storeys'],
    );

    expect([...doubtfulParameters(case_, [doc({ fields: [] })])]).toEqual([
      'storeys',
      'height',
    ]);
  });
});

describe('restsOnUnconfirmed', () => {
  it('says so where a rule in play turns on a doubtful figure', () => {
    const case_ = provision([parameter('height', 0.5)], ['height']);

    expect(restsOnUnconfirmed(case_, [doc({ fields: [] })])).toBe(true);
  });

  it('stays quiet where no rule in play turns on the doubtful figure', () => {
    const case_ = provision(
      [parameter('storeys', 0.5), parameter('height', 0.97)],
      ['height'],
    );

    expect(restsOnUnconfirmed(case_, [doc({ fields: [] })])).toBe(false);
  });

  it('stays quiet where every decisive figure was read well', () => {
    const case_ = provision([parameter('height', 0.97)], ['height']);

    expect(restsOnUnconfirmed(case_, [doc({ fields: [] })])).toBe(false);
  });

  it('weighs every candidate while the provision is still open', () => {
    const open = {
      ...provision([parameter('builtYear', 0.5)], ['height']),
      outcome: 'Ambiguous',
      provision: null,
      candidates: ['8.0.9.2', '8.0.10.1'],
    } as CaseProvisionDto;

    // Only the second candidate's rule turns on the year, and it counts.
    expect(restsOnUnconfirmed(open, [doc({ fields: [] })])).toBe(true);
  });

  it('drops the line once the operator has settled the figure', () => {
    const case_ = provision([parameter('height', 0.5)], ['height']);
    const settled = doc({
      fields: [
        field({ name: 'height', origin: 'EnteredByOperator', confidence: 1 }),
      ],
    });

    expect(restsOnUnconfirmed(case_, [settled])).toBe(false);
  });
});
