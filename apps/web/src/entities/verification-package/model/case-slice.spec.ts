import { describe, expect, it } from 'vitest';

import {
  PackageStatusSchema,
  RegistryOutcomeSchema,
  ReportStatusSchema,
  type PackagesOverviewResponse,
  type PackageStatus,
  type ReportStatus,
} from '@cadastre/api-contracts/verification';

import {
  CASE_SLICES,
  SLICE_KEY,
  sliceCounts,
  sliceFilters,
  sliceOf,
} from './case-slice';

// The contract's tallies are exhaustive over their enums — an answer short of
// a member is one the schema refuses — so the fixtures are built the same way.
const overview = (
  pipeline: Partial<Record<PackageStatus, number>>,
  outcomes: Partial<Record<ReportStatus, number>>,
  total = 0,
): PackagesOverviewResponse => ({
  period: { from: null, to: null },
  pipeline: {
    total,
    byStatus: Object.fromEntries(
      PackageStatusSchema.options.map(status => [
        status,
        pipeline[status] ?? 0,
      ]),
    ) as Record<PackageStatus, number>,
  },
  outcomes: {
    total: 0,
    byStatus: Object.fromEntries(
      ReportStatusSchema.options.map(status => [status, outcomes[status] ?? 0]),
    ) as Record<ReportStatus, number>,
  },
  findings: {
    againstPackage: { total: 0, byKind: [] },
    observations: { total: 0, byKind: [] },
  },
  archive: {
    total: 0,
    byOutcome: Object.fromEntries(
      RegistryOutcomeSchema.options.map(outcome => [outcome, 0]),
    ) as PackagesOverviewResponse['archive']['byOutcome'],
  },
});

describe('the slices the case register is read by', () => {
  it.each(CASE_SLICES)('gives %s a word of its own', slice => {
    expect(SLICE_KEY[slice]).toBe(`slice.${slice}`);
  });

  // The two filters answer two questions, and a slice narrows one of them. A
  // slice that set both would be answering a question nobody put.
  it('narrows one filter per slice, and All narrows neither', () => {
    expect(sliceFilters('all')).toEqual({
      standing: null,
      reportStatus: null,
    });
    for (const slice of CASE_SLICES.filter(s => s !== 'all')) {
      const { standing, reportStatus } = sliceFilters(slice);
      expect([standing, reportStatus].filter(v => v !== null)).toHaveLength(1);
    }
  });

  // What the machine is doing and what the run found are not one question:
  // Processing and Error are about the pipeline, the other three about the
  // report.
  it('asks the pipeline about the machine and the report about the papers', () => {
    expect(sliceFilters('processing').standing).toBe('UnderVerification');
    expect(sliceFilters('error').standing).toBe('Stalled');
    expect(sliceFilters('remarks').reportStatus).toBe('IssuesFound');
    expect(sliceFilters('incomplete').reportStatus).toBe('IncompletePackage');
    expect(sliceFilters('clean').reportStatus).toBe('OK');
  });

  it('recognises each slice back from the filters it sets', () => {
    for (const slice of CASE_SLICES) {
      expect(sliceOf(sliceFilters(slice))).toBe(slice);
    }
  });

  // A register narrowed to something no tab stands for must not highlight one:
  // a selected tab that does not describe the rows below it is a lie the reader
  // has no way to catch.
  it('claims no slice for a narrowing no tab stands for', () => {
    expect(
      sliceOf({ standing: 'AwaitingArchiveApproval', reportStatus: null }),
    ).toBeNull();
    expect(
      sliceOf({ standing: 'Stalled', reportStatus: 'IssuesFound' }),
    ).toBeNull();
  });

  // The tab count and the rows under it come from two calls; they agree only if
  // the count is of the same thing the filter selects.
  it('counts Processing by the runs actually under way', () => {
    const counts = sliceCounts(
      overview({ Pending: 4, Processing: 2, Completed: 9, Failed: 1 }, {}, 16),
    );
    expect(counts.processing).toBe(2);
    expect(counts.error).toBe(1);
    expect(counts.all).toBe(16);
  });

  // An outcome nobody reached this period is zero, never blank: a tab whose
  // count disappears is a tab the reader cannot compare with the one beside it.
  it('reads a missing tally as none rather than as unknown', () => {
    const counts = sliceCounts(overview({}, { OK: 3 }));
    expect(counts.clean).toBe(3);
    expect(counts.remarks).toBe(0);
    expect(counts.incomplete).toBe(0);
  });
});
