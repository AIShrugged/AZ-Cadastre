import { describe, expect, it } from 'vitest';

import {
  ArchiveHoldingSchema,
  RegistryOutcomeSchema,
  type ArchiveSearchApprovalDto,
  type RegistryCheckDto,
  type RegistryOutcome,
} from '@cadastre/api-contracts/verification';

import {
  approvalInForce,
  approvalStance,
  coveredChecks,
  HOLDING_KEY,
  HOLDING_TONE,
  OUTCOME_KEY,
  OUTCOME_NOTE,
  OUTCOME_TONE,
  speaksAgainst,
  spentApprovals,
} from './archive-search';

const OUTCOMES = RegistryOutcomeSchema.options;
const HOLDINGS = ArchiveHoldingSchema.options;

const check = (key: string, outcome: RegistryOutcome): RegistryCheckDto => ({
  key,
  outcome,
  confidence: 1,
  note: '',
  asked: {
    documentId: 'doc',
    documentType: 'title_deed',
    fieldName: 'address',
    value: 'Baku, Nizami 12',
    pageNumber: 1,
    confidence: 1,
  },
  reference: null,
  attributes: [],
  documents: [],
});

const approval = (
  supersededAt: string | null,
  checks: ArchiveSearchApprovalDto['checks'] = [],
): ArchiveSearchApprovalDto => ({
  approvedAt: '2026-09-08T10:00:00.000Z',
  supersededAt,
  summary: 'The record does not contradict the submission.',
  comment: null,
  checks,
});

describe('what the archive answered, as the reader is shown it', () => {
  // The contract may gain a verdict; a client that drew nothing for it would
  // leave the one answer from outside the system blank on the screen.
  it.each(OUTCOMES)('gives %s a tone, a word and a sentence', outcome => {
    expect(OUTCOME_TONE[outcome]).toBeDefined();
    expect(OUTCOME_KEY[outcome]).toBeDefined();
    expect(OUTCOME_NOTE[outcome]).toBeDefined();
  });

  // The point of the panel. "The register says otherwise" and "the register
  // does not know" must not arrive in one colour, or the surface states a
  // shortfall the register never claimed (ADR-0009).
  it('keeps a contradiction and an absence of evidence in different tones', () => {
    expect(OUTCOME_TONE.Differs).not.toBe(OUTCOME_TONE.NotFound);
    expect(OUTCOME_TONE.Incomplete).not.toBe(OUTCOME_TONE.NotFound);
  });

  // Five verdicts, five tones: a reader who has learned one of them has not
  // been taught to read two answers as the same answer.
  it('draws each of the five verdicts differently', () => {
    const tones = OUTCOMES.map(outcome => OUTCOME_TONE[outcome]);
    expect(new Set(tones).size).toBe(OUTCOMES.length);
  });

  // A silence is never dressed as a fault, whatever else changes here.
  it('never sets an unanswered lookup in a fault tone', () => {
    expect(OUTCOME_TONE.NotFound).toBe('silent');
    expect(OUTCOME_TONE.Ambiguous).toBe('question');
    expect(speaksAgainst('NotFound')).toBe(false);
    expect(speaksAgainst('Ambiguous')).toBe(false);
  });

  it('counts only what is actually held against the package', () => {
    expect(OUTCOMES.filter(speaksAgainst)).toEqual(['Differs', 'Incomplete']);
  });

  it.each(HOLDINGS)('gives %s a mark of its own', holding => {
    expect(HOLDING_TONE[holding]).toBeDefined();
    expect(HOLDING_KEY[holding]).toBeDefined();
  });

  it('tells the three states of an original apart', () => {
    const tones = HOLDINGS.map(holding => HOLDING_TONE[holding]);
    expect(new Set(tones).size).toBe(HOLDINGS.length);
    // The archive never having kept a column for this kind of paper is silence,
    // not a shortfall in the submission.
    expect(HOLDING_TONE.Unknown).toBe('silent');
  });
});

describe('the approval of an archive search', () => {
  it('holds at most the one that has not been superseded', () => {
    const standing = approval(null);
    const spent = approval('2026-09-08T12:00:00.000Z');

    expect(approvalInForce([standing, spent])).toBe(standing);
    expect(spentApprovals([standing, spent])).toEqual([spent]);
    expect(approvalInForce([spent])).toBeNull();
  });

  // The three the service refuses on, answered before the button is offered —
  // and the fourth, where it would accept.
  it('says why a search cannot be signed for yet', () => {
    const asked = [check('property_of_record', 'Confirmed')];

    expect(
      approvalStance({
        status: 'Processing',
        registryChecks: asked,
        approvals: [],
      }),
    ).toBe('unsettled');
    expect(
      approvalStance({
        status: 'Completed',
        registryChecks: [],
        approvals: [],
      }),
    ).toBe('not_asked');
    expect(
      approvalStance({
        status: 'Completed',
        registryChecks: asked,
        approvals: [approval(null)],
      }),
    ).toBe('in_force');
    expect(
      approvalStance({
        status: 'Completed',
        registryChecks: asked,
        approvals: [approval('2026-09-08T12:00:00.000Z')],
      }),
    ).toBe('open');
  });

  // A spent approval read as a date alone leaves the reader guessing what
  // changed under it. What was signed for is kept beside what replaced it.
  it('shows what was signed for against what the register says now', () => {
    const spent = approval('2026-09-08T12:00:00.000Z', [
      { key: 'property_of_record', outcome: 'Confirmed' },
      { key: 'papers_on_file', outcome: 'Confirmed' },
    ]);

    expect(
      coveredChecks(spent, [check('property_of_record', 'Differs')]),
    ).toEqual([
      { key: 'property_of_record', approved: 'Confirmed', now: 'Differs' },
      { key: 'papers_on_file', approved: 'Confirmed', now: null },
    ]);
  });
});
