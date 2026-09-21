import { describe, expect, it } from 'vitest';

import type {
  CaseProvisionDto,
  DocumentDto,
  DocumentGapDto,
  IssueDto,
  ProvisionRequirementDto,
  RegistryCheckDto,
  RegistryOutcome,
  TitleDocumentStandingDto,
} from '@cadastre/api-contracts/verification';

import {
  archiveRows,
  completenessRows,
  crossCheckRows,
  findingKey,
  isSettled,
  provisionRows,
  tally,
  worstMark,
} from './checklist';

// Echoes the key, so a row can be checked for the word it was given.
const t = (key: string) => key;

const doc = (id: string, type: string, supersededAt: string | null = null) =>
  ({
    id,
    type,
    firstPage: 1,
    lastPage: 1,
    classificationConfidence: 0.99,
    attestation: null,
    fields: [],
    archiveQrCheck: null,
    supersededById: null,
    supersededAt,
  }) as DocumentDto;

const missing = (expectedType: string): DocumentGapDto => ({
  reason: 'MissingDocument',
  expectedType,
  documentId: null,
  sourceFileId: null,
});

const group = (
  anyOf: string[],
  answered: boolean,
  applies: boolean | null = true,
): ProvisionRequirementDto => ({
  anyOf,
  onlyBuiltBefore: applies === true ? null : 2013,
  applies,
  answered,
});

const title = (withinWindow: boolean | null): TitleDocumentStandingDto => ({
  documentId: 'title',
  documentType: 'land_right_state_act',
  landRight: 'Ownership',
  dated: null,
  withinWindow,
  items: [],
});

const provision = (over: Partial<CaseProvisionDto> = {}): CaseProvisionDto => ({
  key: 'article-8',
  outcome: 'Determined',
  provision: '8.0.10.1',
  candidates: [],
  undecidedOn: [],
  parameters: [],
  rules: [],
  provisions: [
    {
      provision: '8.0.10.1',
      description: '',
      titleRight: null,
      requirements: [
        group(['construction_permit'], true),
        group(['architectural_planning_section'], false),
        group(['operation_permit'], false),
      ],
    },
  ],
  titleDocuments: [title(true)],
  ...over,
});

const REQUIRED = ['land_plot_plan', 'sketch_project'];

describe('completeness', () => {
  it("states the profile's papers by the server's gaps, not by the documents it can see", () => {
    // A sketch design is on the page and still short: its scan was replaced by
    // one that failed to classify, and only the gap list knows (COMM-80).
    const rows = completenessRows(t, {
      required: REQUIRED,
      gaps: [missing('sketch_project')],
      provision: null,
      documents: [doc('p', 'land_plot_plan'), doc('s', 'sketch_project', 'x')],
    });

    expect(rows.map(row => [row.key, row.mark, row.anchor])).toEqual([
      ['land_plot_plan', 'ok', '#doc-p'],
      ['sketch_project', 'short', '#document-gaps'],
    ]);
  });

  it('adds the papers the decided provision asks for after the profile', () => {
    const rows = completenessRows(t, {
      required: REQUIRED,
      gaps: [],
      provision: provision(),
      documents: [doc('c', 'construction_permit')],
    });

    expect(rows.map(row => [row.key, row.mark])).toEqual([
      ['land_plot_plan', 'ok'],
      ['sketch_project', 'ok'],
      ['construction_permit', 'ok'],
      ['architectural_planning_section', 'short'],
      ['operation_permit', 'short'],
    ]);
  });

  it('lists no candidate papers while the provision is still open', () => {
    // A permit only one of the candidates needs is not a paper the package is
    // short of — it may never be asked for.
    const rows = completenessRows(t, {
      required: REQUIRED,
      gaps: [],
      provision: provision({ outcome: 'Ambiguous', provision: null }),
      documents: [],
    });

    expect(rows.map(row => row.key)).toEqual(REQUIRED);
  });

  it('leaves out what the policy does not ask of this package, and what the profile already listed', () => {
    const rows = completenessRows(t, {
      required: REQUIRED,
      gaps: [],
      provision: provision({
        provisions: [
          {
            provision: '8.0.9.1.1',
            description: '',
            titleRight: null,
            requirements: [
              group(['sketch_project'], true),
              group(['approved_design'], false, false),
              group(['operation_acceptance_act'], false, null),
            ],
          },
        ],
      }),
      documents: [],
    });

    expect(rows.map(row => row.key)).toEqual(REQUIRED);
  });
});

describe('the provision block', () => {
  it.each([
    [[title(true), title(false)], 'ok'],
    [[title(false)], 'against'],
    [[title(null), title(false)], 'open'],
    [[], 'short'],
  ] as const)('reads the title to the land off its window', (titles, mark) => {
    const [row] = provisionRows(
      t,
      provision({ titleDocuments: [...titles] }),
      [],
    );
    expect(row?.mark).toBe(mark);
  });

  it('names a group taken through a state system as quiet, and one turning on an unread year as open', () => {
    const rows = provisionRows(
      t,
      provision({
        provisions: [
          {
            provision: '8.0.9.1.1',
            description: '',
            titleRight: null,
            requirements: [
              group(['approved_design'], false, false),
              group(['operation_acceptance_act'], false, null),
            ],
          },
        ],
      }),
      [],
    );

    expect(rows.map(row => [row.key, row.mark, row.state])).toEqual([
      ['title', 'ok', 'provision.title.within'],
      ['approved_design', 'quiet', 'rail.via_integration'],
      ['operation_acceptance_act', 'open', 'rail.year_unknown'],
    ]);
  });

  it('states only the title while no provision is decided', () => {
    const rows = provisionRows(
      t,
      provision({ outcome: 'Undetermined', provision: null }),
      [],
    );
    expect(rows.map(row => row.key)).toEqual(['title']);
  });
});

describe('the checks', () => {
  it('draws a disagreement against the package and an undecided check as open', () => {
    const rows = crossCheckRows(t, [
      { key: 'a', verdict: 'Match', confidence: 1, note: '', values: [] },
      { key: 'b', verdict: 'Mismatch', confidence: 1, note: '', values: [] },
      { key: 'c', verdict: 'Unclear', confidence: 1, note: '', values: [] },
    ]);

    expect(rows.map(row => [row.mark, row.anchor])).toEqual([
      ['ok', '#check-a'],
      ['against', '#check-b'],
      ['open', '#check-c'],
    ]);
  });

  const registry = (key: string, outcome: RegistryOutcome) =>
    ({ key, outcome }) as RegistryCheckDto;

  // An address the archive has no record of says nothing about the papers; a
  // rail that drew it as a fault would state one the register never claimed
  // (ADR-0009).
  it('keeps an absent record quiet and a contradiction against', () => {
    const rows = archiveRows(t, {
      registryChecks: [
        registry('confirmed', 'Confirmed'),
        registry('differs', 'Differs'),
        registry('incomplete', 'Incomplete'),
        registry('not_found', 'NotFound'),
        registry('ambiguous', 'Ambiguous'),
      ],
      standing: 'NeedsInspector',
      archiveSearchApprovals: [],
    });

    expect(rows.map(row => row.mark)).toEqual([
      'ok',
      'against',
      'against',
      'quiet',
      'open',
    ]);
  });

  it('adds the signature the standing waits on, and the one in force', () => {
    const waiting = archiveRows(t, {
      registryChecks: [],
      standing: 'AwaitingArchiveApproval',
      archiveSearchApprovals: [],
    });
    const signed = archiveRows(t, {
      registryChecks: [],
      standing: 'Cleared',
      archiveSearchApprovals: [
        {
          approvedAt: '2026-09-08T10:00:00.000Z',
          supersededAt: null,
          summary: '',
          comment: null,
          checks: [],
        },
      ],
    });

    expect(waiting.map(row => [row.key, row.mark])).toEqual([
      ['approval', 'open'],
    ]);
    expect(signed.map(row => [row.key, row.mark])).toEqual([
      ['approval', 'ok'],
    ]);
  });
});

describe('a group read at a glance', () => {
  const rows = crossCheckRows(t, [
    { key: 'a', verdict: 'Match', confidence: 1, note: '', values: [] },
    { key: 'b', verdict: 'Unclear', confidence: 1, note: '', values: [] },
  ]);

  it('counts what is settled over what there is', () => {
    expect(tally(rows)).toEqual({ done: 1, total: 2 });
  });

  it('is set in the loudest thing it says', () => {
    expect(worstMark(rows)).toBe('open');
    expect(isSettled(rows)).toBe(false);
    expect(isSettled(rows.slice(0, 1))).toBe(true);
  });
});

describe('a finding kept under what it is about', () => {
  const issue = (over: Partial<IssueDto>): IssueDto => ({
    kind: 'LowConfidence',
    message: 'English audit line',
    documentId: 'd1',
    sourceFileId: 'f1',
    documentType: 'application',
    fieldName: 'applicant_name',
    checkKey: null,
    pageNumber: 1,
    confidence: 0.6,
    ...over,
  });

  // A key taken from position in the report would name another line the day a
  // run added a finding above it.
  it('ignores the audit line and the confidence, and tells two fields apart', () => {
    expect(findingKey(issue({ message: 'reworded', confidence: 0.7 }))).toBe(
      findingKey(issue({})),
    );
    expect(findingKey(issue({ fieldName: 'address' }))).not.toBe(
      findingKey(issue({})),
    );
  });
});
