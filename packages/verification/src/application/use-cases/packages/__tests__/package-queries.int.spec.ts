import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import type { PackageId } from '../../../../domain/value-objects/index.js';
import {
  IssueKind,
  PackageStatus,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import type {
  PackageDetailView,
  PackageSummaryView,
} from '../../../read-models/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageSummaryQuery } from '../get-package-summary/index.js';
import { GetPackageQuery } from '../get-package/index.js';
import { ListPackagesQuery } from '../list-packages/index.js';

/*
 * The read side runs its own SQL rather than loading the aggregate, so it is
 * the one part of the context a unit test cannot reach at all: what it counts
 * is counted by the database.
 */
let submissions = 0;
const submission = () => {
  const prefix = `q-${++submissions}`;
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

describe('PackageQueriesAdapter', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;
  let finished: PackageId;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl')));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);

    finished = await commands.execute(
      new CreatePackageCommand('cadastre', submission()),
    );
    await waitForTerminalStatus(queries, finished);
  });

  afterAll(async () => {
    await module?.close();
  });

  it('counts a finished package by what the database holds, not by what the run said', async () => {
    // act
    const summary: PackageSummaryView = await queries.execute(
      new GetPackageSummaryQuery(finished.value),
    );

    // assert
    expect(summary.id).toBe(finished.value);
    expect(summary.status).toBe(PackageStatus.COMPLETED.value);
    expect(summary.profileKey).toBe('cadastre');
    expect(summary.filesCount).toBe(2);
    expect(summary.documentsCount).toBeGreaterThan(0);
    expect(summary.classifiedCount + summary.unclassifiedCount).toBe(
      summary.documentsCount,
    );
    expect(summary.reportStatus).not.toBeNull();
  });

  // The register once said 17 замечаний over a package whose own card listed
  // 19: the row counted the observations as findings and left the unsure
  // readings out, while the card counted by the domain's rule. The two numbers
  // are read off the same report, so the invariant — and not a figure — is what
  // is held here (TECH_DEBT §5).
  it('tallies the register row off the same findings the card lists', async () => {
    // act
    const summary: PackageSummaryView = await queries.execute(
      new GetPackageSummaryQuery(finished.value),
    );
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(finished.value),
    );

    // assert
    const issues = detail.report?.issues ?? [];
    const againstPackage = issues.filter(
      issue => !IssueKind.of(issue.kind).isInformational,
    );
    const unsure = againstPackage.filter(
      issue => issue.kind === IssueKind.LOW_CONFIDENCE.value,
    );

    expect(summary.lowConfidenceCount).toBe(unsure.length);
    expect(summary.issuesCount).toBe(againstPackage.length - unsure.length);
    // What the card puts at the head of its worklist.
    expect(summary.issuesCount + summary.lowConfidenceCount).toBe(
      againstPackage.length,
    );
  });

  it('carries the pages and their recognised text into the detail view', async () => {
    // act
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(finished.value),
    );

    // assert
    expect(detail.files).toHaveLength(2);
    expect(detail.files.flatMap(file => [...file.pages])).toHaveLength(4);
    expect(
      detail.files.flatMap(file => [...file.pages]).every(page => page.ocr),
    ).toBe(true);
    expect(detail.report).not.toBeNull();
  });

  it('lists a submitted package among the summaries', async () => {
    // arrange
    const second: PackageId = await commands.execute(
      new CreatePackageCommand('cadastre', submission()),
    );
    await waitForTerminalStatus(queries, second);

    // act
    const all: readonly PackageSummaryView[] = await queries.execute(
      new ListPackagesQuery(),
    );

    // assert
    expect(all.map(summary => summary.id)).toEqual(
      expect.arrayContaining([finished.value, second.value]),
    );
  });

  it('refuses a package id that was never submitted, rather than reporting an empty one', async () => {
    // act / assert — the read side answers null; naming the absence is the
    // handler's job, and the gateway turns that exception into a 404
    await expect(
      queries.execute(
        new GetPackageSummaryQuery('00000000-0000-4000-8000-000000000000'),
      ),
    ).rejects.toThrow(PackageNotFoundException);
  });
});
