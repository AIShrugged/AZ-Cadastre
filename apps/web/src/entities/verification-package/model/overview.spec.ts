import { describe, expect, it } from 'vitest';

import {
  IssueKindSchema,
  PackageStatusSchema,
  RegistryOutcomeSchema,
  ReportStatusSchema,
  type ArchiveTallyDto,
  type FindingTallyDto,
  type IssueKind,
  type OutcomeTallyDto,
  type PipelineTallyDto,
} from '@cadastre/api-contracts/verification';

import {
  ARCHIVE_ORDER,
  archiveTally,
  CONVEYOR_ORDER,
  ISSUE_KIND_KEY,
  OUTCOME_ORDER,
  outcomeTally,
  pipelineTally,
  rankFindings,
  stalledCount,
} from './overview';

const pipeline = (
  byStatus: PipelineTallyDto['byStatus'],
  total: number,
): PipelineTallyDto => ({ total, byStatus });

const outcomes = (
  byStatus: OutcomeTallyDto['byStatus'],
  total: number,
): OutcomeTallyDto => ({ total, byStatus });

const archive = (
  byOutcome: ArchiveTallyDto['byOutcome'],
  total: number,
): ArchiveTallyDto => ({ total, byOutcome });

/**
 * A findings tally in the shape the endpoint actually answers with: every kind
 * that belongs to *this* tally, present whether or not it occurred, and none
 * that belongs to the other one. The two are never mixed and never summed — a
 * finding held against a package and an observation stated for the record are
 * different news.
 */
const AGAINST_KINDS: readonly IssueKind[] = [
  'MissingDocument',
  'UnreadableDocument',
  'LowConfidence',
  'FieldMismatch',
  'RegistryMismatch',
  'RegistryDocumentMissing',
  'MissingAttestation',
];

const findings = (
  counts: Partial<Record<IssueKind, number>>,
  kinds: readonly IssueKind[] = AGAINST_KINDS,
): FindingTallyDto => ({
  total: kinds.reduce<number>((sum, kind) => sum + (counts[kind] ?? 0), 0),
  byKind: kinds.map(kind => ({ kind, count: counts[kind] ?? 0 })),
});

describe('the classes each slice is drawn in', () => {
  // A record's key order is whatever the server happened to serialise. A bar
  // whose segments reshuffle between two polls is a bar nobody can read, so the
  // order is written down here — and it has to stay a full cover of the
  // contract's vocabulary, or a class the engine starts publishing would go
  // undrawn.
  it('covers every member of the contract’s own vocabularies, once each', () => {
    expect([...CONVEYOR_ORDER].sort()).toEqual(
      [...PackageStatusSchema.options].sort(),
    );
    expect([...OUTCOME_ORDER].sort()).toEqual(
      [...ReportStatusSchema.options].sort(),
    );
    expect([...ARCHIVE_ORDER].sort()).toEqual(
      [...RegistryOutcomeSchema.options].sort(),
    );
    expect(Object.keys(ISSUE_KIND_KEY).sort()).toEqual(
      [...IssueKindSchema.options].sort(),
    );
  });
});

describe('where the work is', () => {
  it('gives every state its share of the period’s submissions', () => {
    const tally = pipelineTally(
      pipeline({ Pending: 10, Processing: 10, Completed: 60, Failed: 20 }, 100),
    );

    expect(tally.total).toBe(100);
    expect(tally.slices.map(slice => slice.id)).toEqual([...CONVEYOR_ORDER]);
    expect(tally.slices.map(slice => slice.share)).toEqual([
      0.1, 0.1, 0.6, 0.2,
    ]);
  });

  // Three steps of one ramp for the three positions on the conveyor, and the
  // reserved failed ink for the state that is not a position on it at all.
  it('draws a stalled run off the conveyor’s ramp, not further along it', () => {
    const tally = pipelineTally(
      pipeline({ Pending: 1, Processing: 1, Completed: 1, Failed: 1 }, 4),
    );

    expect(tally.slices.map(slice => slice.tone)).toEqual([
      'conveyor-1',
      'conveyor-2',
      'conveyor-3',
      'failed',
    ]);
  });

  // An office that has taken nothing in is a true state, not a broken one: the
  // bar is empty, and no share is `NaN`. What tells this apart from "not asked
  // yet" is that the screen draws a skeleton until an answer exists at all.
  it('reads an empty period as zeros and never as NaN', () => {
    const tally = pipelineTally(
      pipeline({ Pending: 0, Processing: 0, Completed: 0, Failed: 0 }, 0),
    );

    expect(tally.total).toBe(0);
    for (const slice of tally.slices) {
      expect(slice.count).toBe(0);
      expect(slice.share).toBe(0);
    }
  });

  // The one number on this screen that no amount of waiting resolves, which is
  // why the screen leads with it instead of seating it among the others.
  it('names the stalled count on its own', () => {
    expect(
      stalledCount(
        pipeline({ Pending: 0, Processing: 0, Completed: 9, Failed: 3 }, 12),
      ),
    ).toBe(3);
    expect(
      stalledCount(
        pipeline({ Pending: 0, Processing: 0, Completed: 12, Failed: 0 }, 12),
      ),
    ).toBe(0);
  });
});

describe('what the runs found', () => {
  // A submission still being read has no outcome yet. It is counted in the
  // conveyor slice and never guessed at here, which is why this tally divides
  // by a total of its own rather than by the period's submissions.
  it('is a share of the submissions that have a report, not of the period', () => {
    const tally = outcomeTally(
      outcomes({ OK: 30, IssuesFound: 10, IncompletePackage: 10 }, 50),
    );

    expect(tally.total).toBe(50);
    expect(tally.slices.map(slice => slice.share)).toEqual([0.6, 0.2, 0.2]);
  });

  // The register's own three disposition tones, unchanged — an outcome has to
  // read alike on a row, on a package page and in a tally of a hundred of them.
  it('keeps the register’s own tones', () => {
    const tally = outcomeTally(
      outcomes({ OK: 1, IssuesFound: 1, IncompletePackage: 1 }, 3),
    );

    expect(tally.slices.map(slice => slice.tone)).toEqual([
      'ok',
      'issues',
      'incomplete',
    ]);
  });
});

describe('what the archive answered', () => {
  // The whole reason this slice is drawn the way it is. The register's coverage
  // is partial and historical and it answers about its own fonds, so silence is
  // an absence of evidence — it gets the neutral tone, never a fault's, and it
  // keeps a number of its own instead of being folded in with `Differs`
  // (ADR-0009).
  it('draws “no record” neutrally and never folds it in with a disagreement', () => {
    const tally = archiveTally(
      archive(
        {
          Confirmed: 4,
          Differs: 1,
          Incomplete: 1,
          NotFound: 30,
          Ambiguous: 4,
        },
        40,
      ),
    );

    const byId = Object.fromEntries(
      tally.slices.map(slice => [slice.id, slice]),
    );
    expect(byId.NotFound.tone).toBe('silent');
    expect(byId.NotFound.count).toBe(30);
    expect(byId.Differs.tone).toBe('issues');
    expect(byId.Differs.count).toBe(1);
    // Five answers, five numbers: nothing here is a sum of two of them.
    expect(tally.slices).toHaveLength(5);
  });
});

describe('what goes wrong most often', () => {
  it('ranks the kinds that occurred, most frequent first', () => {
    const ranking = rankFindings(
      findings({ MissingDocument: 3, FieldMismatch: 9, LowConfidence: 5 }),
    );

    expect(ranking.ranked.map(rank => rank.kind)).toEqual([
      'FieldMismatch',
      'LowConfidence',
      'MissingDocument',
    ]);
    expect(ranking.total).toBe(17);
  });

  // The bar's length is the answer to "which comes up most", so it is measured
  // against the most frequent kind. Against a total nobody asked about, a tail
  // of real findings would all draw as the same sliver.
  it('measures each bar against the most frequent kind', () => {
    const ranking = rankFindings(
      findings({ FieldMismatch: 10, LowConfidence: 5, MissingDocument: 1 }),
    );

    expect(ranking.ranked.map(rank => rank.share)).toEqual([1, 0.5, 0.1]);
  });

  // The contract lists every kind at zero so none can silently vanish. In a
  // figure whose subject is frequency the zeros are noise — so they are counted
  // and said in words, which keeps "none this period" from reading as "we do
  // not have such a finding".
  it('leaves the kinds that never occurred out of the bars and counts them', () => {
    const ranking = rankFindings(findings({ MissingDocument: 2 }));

    expect(ranking.ranked.map(rank => rank.kind)).toEqual(['MissingDocument']);
    expect(ranking.unseen).toBe(AGAINST_KINDS.length - 1);
  });

  it('has nothing to rank, and no NaN, when nothing was found', () => {
    const ranking = rankFindings(findings({}));

    expect(ranking.ranked).toEqual([]);
    expect(ranking.total).toBe(0);
    expect(ranking.unseen).toBe(AGAINST_KINDS.length);
  });

  // Kinds that came up the same number of times must not swap places between
  // two polls: the sort is stable, so they keep the order the contract sent.
  it('keeps equal counts in the order the contract sent them', () => {
    const ranking = rankFindings(
      findings({ MissingDocument: 4, LowConfidence: 4, FieldMismatch: 4 }),
    );

    const sent = AGAINST_KINDS.filter(kind =>
      ['MissingDocument', 'LowConfidence', 'FieldMismatch'].includes(kind),
    );
    expect(ranking.ranked.map(rank => rank.kind)).toEqual(sent);
  });
});
