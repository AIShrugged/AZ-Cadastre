/**
 * The merged column, tested where the merge actually decides something.
 *
 * Folding three columns into one is a layout change everywhere except here: the
 * one judgement is which of three pieces of news the cell is telling, and
 * getting it wrong draws "no issues" over a package nothing has read.
 */
import { describe, expect, it } from 'vitest';

import {
  PackageStandingSchema,
  ReportStatusSchema,
} from '@cadastre/api-contracts/verification';

import { caseState, drawsOutcome, hasFindings } from './case-state';
import type { VerificationPackage } from './verification-package';

const OUTCOMES = ReportStatusSchema.options;

const pkg = (over: Partial<VerificationPackage> = {}): VerificationPackage => ({
  id: '11111111-2222-3333-4444-555555555555',
  profile: 'article8',
  standing: 'Cleared',
  reportStatus: null,
  disposition: 'ok',
  applicant: null,
  address: null,
  submittedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  docsClassified: 0,
  docsFound: 0,
  filesAttached: 1,
  issues: 0,
  lowConfidence: 0,
  ...over,
});

describe('what is with the case', () => {
  it.each(OUTCOMES)('reports %s with the findings behind it', outcome => {
    expect(
      caseState(pkg({ reportStatus: outcome, issues: 2, lowConfidence: 1 })),
    ).toEqual({ kind: 'reported', outcome, issues: 2, lowConfidence: 1 });
  });

  // A run under way has found nothing *yet*, which is not the same as having
  // found nothing. The stage bar beside the cell reports the wait, so the cell
  // says nothing further rather than repeating it as a dash.
  it('says nothing about findings while a run is still reading', () => {
    expect(caseState(pkg({ reportStatus: null, stage: 3 }))).toEqual({
      kind: 'reading',
    });
  });

  // Silence, and never a zero: a package nothing has read is not a package
  // nothing was found in.
  it('falls silent for a package no run has reported on', () => {
    expect(caseState(pkg({ reportStatus: null }))).toEqual({ kind: 'unread' });
  });

  // A report outlives the run that wrote it, and a package can be read again.
  // What the last run said is still the answer the outcome filter narrows by,
  // so it is drawn even while the next run is under way.
  it('keeps the last report even once another run has started', () => {
    expect(caseState(pkg({ reportStatus: 'IssuesFound', stage: 2 }))).toEqual({
      kind: 'reported',
      outcome: 'IssuesFound',
      issues: 0,
      lowConfidence: 0,
    });
  });
});

describe('whether the report line has a count to add', () => {
  // "No issues · None" is the stutter the merge exists to remove.
  it('adds nothing to an outcome that counted nothing', () => {
    expect(hasFindings(caseState(pkg({ reportStatus: 'OK' })))).toBe(false);
  });

  // The counts are what the inspector reads their day off. Either group alone
  // is enough to keep the line, because they are different work.
  it.each([
    { issues: 1, lowConfidence: 0 },
    { issues: 0, lowConfidence: 4 },
    { issues: 3, lowConfidence: 2 },
  ])('keeps %o', counts => {
    expect(
      hasFindings(caseState(pkg({ reportStatus: 'IssuesFound', ...counts }))),
    ).toBe(true);
  });

  // Findings are counted by a report, so a package without one has none to
  // show however the row is otherwise filled in.
  it.each(['reading', 'unread'])('adds nothing to a %s package', () => {
    expect(
      hasFindings(caseState(pkg({ issues: 9, lowConfidence: 9, stage: 1 }))),
    ).toBe(false);
    expect(hasFindings(caseState(pkg({ issues: 9, lowConfidence: 9 })))).toBe(
      false,
    );
  });
});

describe('whether the outcome still has a word of its own to say', () => {
  // The three pairs the customer was looking at. Saying both is saying one
  // thing twice, which is what the merge was asked to stop.
  it.each([
    ['Cleared', 'OK'],
    ['ShortOfDocuments', 'IncompletePackage'],
    ['NeedsInspector', 'IssuesFound'],
  ] as const)('drops %s over %s, which repeats it', (standing, outcome) => {
    expect(drawsOutcome(standing, outcome, false)).toBe(false);
  });

  // A finished submission can still carry findings — the register says so in
  // as many words — and on that row the outcome is the whole of the news.
  it('keeps an outcome the standing does not already say', () => {
    expect(drawsOutcome('Cleared', 'IssuesFound', false)).toBe(true);
    expect(drawsOutcome('AwaitingArchiveApproval', 'OK', false)).toBe(true);
    expect(drawsOutcome('Stalled', 'IncompletePackage', false)).toBe(true);
  });

  // The whole constraint the merge had to hold: both filters stayed, so a row
  // narrowed by the outcome has to show the word it was narrowed by — even the
  // word that would otherwise be a repetition.
  it.each(ReportStatusSchema.options)(
    'keeps %s while the outcome filter is narrowing the register',
    outcome => {
      for (const standing of PackageStandingSchema.options) {
        expect(drawsOutcome(standing, outcome, true)).toBe(true);
      }
    },
  );

  // A standing the contract adds tomorrow says nothing about any outcome until
  // somebody decides it does. Drawing the word is the safe default; swallowing
  // it would hide an answer nobody chose to hide.
  it.each(PackageStandingSchema.options)(
    'draws every outcome beside %s unless the pair was ruled a repetition',
    standing => {
      const dropped = ReportStatusSchema.options.filter(
        outcome => !drawsOutcome(standing, outcome, false),
      );
      expect(dropped.length).toBeLessThanOrEqual(1);
    },
  );
});
