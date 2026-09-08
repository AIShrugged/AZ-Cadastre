import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  startContext,
  waitForTerminalStatus,
} from '../../../../test/context-harness.js';
import type {
  PackageDetailView,
  PackagesOverviewView,
} from '../../../application/read-models/index.js';
import {
  CreatePackageCommand,
  GetPackageQuery,
  GetPackagesOverviewQuery,
  GetPackageSummaryQuery,
} from '../../../application/use-cases/packages/index.js';
import {
  IssueKind,
  PackageStatus,
  type PackageId,
} from '../../../domain/value-objects/index.js';
import { VerificationPrismaService } from '../verification-prisma.service.js';

/*
 * What the summary counts is counted by Postgres, so this is the set that can
 * answer for it at all: the unit specs hold what the register makes of four
 * groups it is handed, and these hold that the four statements are put to a
 * real database and come back agreeing with the packages they are about.
 *
 * The database is shared with every other file in this set, so nothing here
 * asks about all time. Each spec names a period, and the period is what makes
 * the answer exactly the submissions this file made (TECH_DEBT §5: a new count
 * on the read side is submitted through the command bus and asserted through
 * the query bus, never inserted row by row).
 */
let submissions = 0;
const submission = () => {
  const prefix = `o-${++submissions}`;
  return [
    {
      originalFilename: 'erize-qeydiyyat.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/erize-qeydiyyat.pdf`,
    },
    {
      originalFilename: 'sexsiyyet-vesiqe.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/sexsiyyet-vesiqe.pdf`,
    },
  ];
};

describe('the summary of a period', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;

  // The window this file's own submissions fall in, and nothing else's.
  let from: Date;
  let to: Date;
  let submitted: PackageId[];

  const overview = (period: {
    from?: Date;
    to?: Date;
  }): Promise<PackagesOverviewView> =>
    queries.execute(
      new GetPackagesOverviewQuery(
        period.from?.toISOString(),
        period.to?.toISOString(),
      ),
    );

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl')));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);

    from = new Date();
    submitted = [];
    // The same two papers three times over, and deliberately: what a spec here
    // needs is submissions to count, and a file name of its own would be a name
    // another file's search spec could match (they share one database).
    for (const files of [submission(), submission(), submission()]) {
      const id: PackageId = await commands.execute(
        new CreatePackageCommand('cadastre', files),
      );
      await waitForTerminalStatus(queries, id);
      submitted.push(id);
    }
    to = new Date();
  });

  afterAll(async () => {
    await module?.close();
  });

  /** The submissions this file made, as the detail view reports them. */
  const details = (): Promise<PackageDetailView[]> =>
    Promise.all(
      submitted.map(id => queries.execute(new GetPackageQuery(id.value))),
    );

  it('counts the submissions of the period along the conveyor', async () => {
    // act
    const summary = await overview({ from, to });

    // assert — every one of them was waited for, so none is still in the
    // machine; where each landed is the run's business and not this spec's
    expect(summary.pipeline.total).toBe(submitted.length);
    expect(
      summary.pipeline.byMember[PackageStatus.COMPLETED.value]! +
        summary.pipeline.byMember[PackageStatus.FAILED.value]!,
    ).toBe(submitted.length);
    expect(summary.pipeline.byMember[PackageStatus.PENDING.value]).toBe(0);
    expect(summary.pipeline.byMember[PackageStatus.PROCESSING.value]).toBe(0);
  });

  it('counts what the runs made of them off the same reports the cards show', async () => {
    // arrange
    const reported = (await details()).filter(detail => detail.report);

    // act
    const summary = await overview({ from, to });

    // assert
    expect(summary.outcomes.total).toBe(reported.length);
    for (const detail of reported) {
      expect(summary.outcomes.byMember[detail.report!.status]).toBeGreaterThan(
        0,
      );
    }
  });

  /*
   * The split the whole slice turns on, held against the findings themselves
   * rather than against a figure: a shortfall the inspector has to resolve, and
   * something noted for the record beside it. A summary that summed the two
   * would announce faults in submissions that have none.
   */
  it('counts the findings against a package apart from the observations', async () => {
    // arrange
    const issues = (await details()).flatMap(detail => [
      ...(detail.report?.issues ?? []),
    ]);
    const observations = issues.filter(
      issue => IssueKind.of(issue.kind).isInformational,
    );

    // act
    const summary = await overview({ from, to });

    // assert
    expect(issues.length).toBeGreaterThan(0);
    expect(summary.findings.againstPackage.total).toBe(
      issues.length - observations.length,
    );
    expect(summary.findings.observations.total).toBe(observations.length);
  });

  it('tallies each kind off the reports that hold it, most frequent first', async () => {
    // arrange
    const issues = (await details()).flatMap(detail => [
      ...(detail.report?.issues ?? []),
    ]);

    // act
    const summary = await overview({ from, to });

    // assert — every kind the reports hold, counted; and the order is the
    // answer, so it is held to as well
    const counted = [
      ...summary.findings.againstPackage.byKind,
      ...summary.findings.observations.byKind,
    ];
    for (const kind of new Set(issues.map(issue => issue.kind))) {
      expect(counted).toContainEqual({
        kind,
        count: issues.filter(issue => issue.kind === kind).length,
      });
    }
    const counts = summary.findings.againstPackage.byKind.map(row => row.count);
    expect(counts).toEqual([...counts].sort((one, other) => other - one));
  });

  /*
   * "Not found" is the register saying nothing about the property, and its
   * coverage is partial and historical (ADR-0009). It keeps a number of its own
   * so a gap in the archive is never reported as a fault in the submissions.
   */
  it('counts the register answers per question put to it, each outcome apart', async () => {
    // arrange
    const checks = (await details()).flatMap(detail => [
      ...detail.registryChecks,
    ]);

    // act
    const summary = await overview({ from, to });

    // assert
    expect(summary.archive.total).toBe(checks.length);
    for (const outcome of new Set(checks.map(check => check.outcome))) {
      expect(summary.archive.byMember[outcome]).toBe(
        checks.filter(check => check.outcome === outcome).length,
      );
    }
  });

  describe('the window', () => {
    it('leaves out a submission accepted before it', async () => {
      // arrange — the moment the last of them was accepted
      const last = await queries.execute(
        new GetPackageSummaryQuery(submitted.at(-1)!.value),
      );

      // act — a period that starts where that submission was accepted
      const summary = await overview({ from: last.createdAt, to });

      // assert — the start is inclusive, so it holds that one and not the ones
      // before it
      expect(summary.pipeline.total).toBeGreaterThanOrEqual(1);
      expect(summary.pipeline.total).toBeLessThan(submitted.length);
    });

    it('leaves out a submission accepted at the very end of it', async () => {
      // arrange
      const first = await queries.execute(
        new GetPackageSummaryQuery(submitted[0]!.value),
      );

      // act — the end is exclusive, so a period ending where the first
      // submission was accepted holds none of them
      const summary = await overview({ from, to: first.createdAt });

      // assert — which is what makes two adjacent months count every
      // submission once and none of them twice
      expect(summary.pipeline.total).toBe(0);
      expect(summary.outcomes.total).toBe(0);
      expect(summary.findings.againstPackage.total).toBe(0);
      expect(summary.archive.total).toBe(0);
    });

    it('still names every state and outcome over a period that holds nothing', async () => {
      // act — nothing has been accepted since this instant
      const summary = await overview({ from: new Date() });

      // assert — a tile that vanishes on a quiet week is a tile a reader
      // cannot trust to be there
      expect(summary.pipeline.total).toBe(0);
      expect(Object.keys(summary.pipeline.byMember)).toHaveLength(
        PackageStatus.all.length,
      );
      expect(summary.findings.observations.byKind.length).toBeGreaterThan(0);
      expect(
        summary.findings.observations.byKind.every(row => row.count === 0),
      ).toBe(true);
    });
  });

  /*
   * The one question the specs above cannot put: what happens when the office
   * has taken in more than a handful. The rows go in directly and carry a
   * period of their own, because running five thousand submissions through the
   * pipeline would take hours and the pipeline is not what is under test here —
   * what is, is that the answer stays four aggregates over an index rather than
   * five thousand rows folded in the application.
   *
   * They are removed again in the same spec: the database is shared with every
   * other file in this set.
   */
  it('answers over a table with thousands of submissions in it', async () => {
    // arrange — a window no other spec's submissions fall in
    const prisma = module.get(VerificationPrismaService);
    const volume = 5_000;
    const epoch = new Date('2099-01-01T00:00:00.000Z');
    const until = new Date('2099-01-02T00:00:00.000Z');

    try {
      await prisma.verificationPackage.createMany({
        data: Array.from({ length: volume }, (_, index) => ({
          profileKey: 'volume-probe',
          status:
            index % 100 === 0 ? ('Failed' as const) : ('Completed' as const),
          createdAt: new Date(epoch.getTime() + index),
        })),
      });

      // act
      const started = Date.now();
      const summary = await overview({ from: epoch, to: until });
      const elapsedMs = Date.now() - started;

      // assert
      expect(summary.pipeline.total).toBe(volume);
      expect(summary.pipeline.byMember[PackageStatus.FAILED.value]).toBe(
        volume / 100,
      );
      // Not a benchmark, and deliberately loose: this is the bound below which
      // nothing can be reading five thousand rows out of the database to add
      // them up in the application. Aggregating in Postgres answers in
      // milliseconds.
      expect(elapsedMs).toBeLessThan(5_000);
    } finally {
      await prisma.verificationPackage.deleteMany({
        where: { profileKey: 'volume-probe' },
      });
    }
  });
});
