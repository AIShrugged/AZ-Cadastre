import { describe, expect, it } from 'vitest';

import { PackageId } from '../../domain/value-objects/index.js';

import { PackageQueriesAdapter } from './package-queries.adapter.js';
import type { VerificationPrismaService } from './verification-prisma.service.js';

const PACKAGE_ID = '0190a1b2-c3d4-7e5f-8a9b-000000000001';

type Row = Record<string, unknown>;

/** The one row the register reads, with the report's findings written as the
 *  kinds alone — the tally is all this adapter does with them. */
function aRow(kinds: readonly string[] | null): Row {
  return {
    id: PACKAGE_ID,
    status: 'Completed',
    profileKey: 'cadastre',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    _count: { sourceFiles: 1 },
    documents: [],
    report:
      kinds === null
        ? null
        : {
            status: 'IssuesFound',
            issues: kinds.map(kind => ({ kind })),
          },
  };
}

/** Prisma stands in at the boundary: the adapter is asked for the register's
 *  row, and what it counts off the one it is given is the whole subject. */
function adapterOver(rows: readonly Row[]): PackageQueriesAdapter {
  const prisma = {
    verificationPackage: {
      findMany: () => Promise.resolve(rows),
      findUnique: () => Promise.resolve(rows[0] ?? null),
    },
  } as unknown as VerificationPrismaService;

  return new PackageQueriesAdapter(prisma);
}

describe('PackageQueriesAdapter', () => {
  describe('the register tally', () => {
    it('counts a shortfall in the package and an unsure reading apart', async () => {
      const [summary] = await adapterOver([
        aRow(['MissingDocument', 'FieldMismatch', 'LowConfidence']),
      ]).listSummaries();

      expect(summary?.issuesCount).toBe(2);
      expect(summary?.lowConfidenceCount).toBe(1);
    });

    // The register said 17 замечаний over a package whose card showed 19: the
    // row was counting the eight service sheets, the three second extracts and
    // the silent archive as findings, and leaving out the fourteen readings the
    // engine was unsure of. Both screens now count by the domain's rule.
    it('leaves the observations out of both counts', async () => {
      const [summary] = await adapterOver([
        aRow([
          ...Array.from({ length: 8 }, () => 'ExtraDocument'),
          ...Array.from({ length: 3 }, () => 'DuplicateDocument'),
          'RegistryUnconfirmed',
          ...Array.from({ length: 14 }, () => 'LowConfidence'),
          ...Array.from({ length: 3 }, () => 'MissingDocument'),
          'FieldMismatch',
          'FieldMismatch',
        ]),
      ]).listSummaries();

      expect(summary?.issuesCount).toBe(5);
      expect(summary?.lowConfidenceCount).toBe(14);
      // What the package's card puts at the head of its worklist.
      expect(
        (summary?.issuesCount ?? 0) + (summary?.lowConfidenceCount ?? 0),
      ).toBe(19);
    });

    it('reports a package carrying nothing but observations as clean', async () => {
      const [summary] = await adapterOver([
        aRow(['ExtraDocument', 'DuplicateDocument', 'RegistryUnconfirmed']),
      ]).listSummaries();

      expect(summary?.issuesCount).toBe(0);
      expect(summary?.lowConfidenceCount).toBe(0);
    });

    // The archive answers have their own surface on the card, but they are
    // findings against the package all the same, and the register has only the
    // one column to say so in.
    it('counts what the archive disagreed with', async () => {
      const [summary] = await adapterOver([
        aRow(['RegistryMismatch', 'RegistryDocumentMissing']),
      ]).listSummaries();

      expect(summary?.issuesCount).toBe(2);
    });

    // A read surface must not be taken down by one row it cannot place: an
    // unrecognised kind is counted rather than thrown on.
    it('counts a kind the enumeration does not know', async () => {
      const [summary] = await adapterOver([
        aRow(['SomethingThisBuildHasNeverHeardOf']),
      ]).listSummaries();

      expect(summary?.issuesCount).toBe(1);
    });

    it('counts nothing before the run has compiled a report', async () => {
      const [summary] = await adapterOver([aRow(null)]).listSummaries();

      expect(summary?.reportStatus).toBeNull();
      expect(summary?.issuesCount).toBe(0);
      expect(summary?.lowConfidenceCount).toBe(0);
    });

    // The row and the card are read off the same mapping, which is what stops
    // them drifting apart again.
    it('tallies a single summary the same way as the list', async () => {
      const kinds = ['ExtraDocument', 'MissingDocument', 'LowConfidence'];
      const summary = await adapterOver([aRow(kinds)]).findSummary(
        PackageId.of(PACKAGE_ID),
      );

      expect(summary?.issuesCount).toBe(1);
      expect(summary?.lowConfidenceCount).toBe(1);
    });
  });
});
