import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { LIST_PACKAGES_MAX_LIMIT } from '@cadastre/api-contracts/verification';

import {
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import type { PackageId } from '../../../../domain/value-objects/index.js';
import {
  IssueKind,
  PackageStanding,
  PackageStatus,
  ReportStatus,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import type { PackageListPage } from '../../../ports/outbound/index.js';
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
const submission = (name = 'erize-qeydiyyat') => {
  const prefix = `q-${++submissions}`;
  return [
    {
      originalFilename: `${name}.pdf`,
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/${name}.pdf`,
    },
    {
      originalFilename: 'sexsiyyet-vesiqe.pdf',
      contentType: 'application/pdf',
      storageKey: `uploads/${prefix}/sexsiyyet-vesiqe.pdf`,
    },
  ];
};

// Everything the register holds, in one page. `LIST_PACKAGES_MAX_LIMIT` is the
// most the contract will hand over at once, and this set never submits that
// many — so a spec can hold a filtered answer against the whole list.
const EVERYTHING = new ListPackagesQuery(
  undefined,
  undefined,
  undefined,
  LIST_PACKAGES_MAX_LIMIT,
  0,
);

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

  /*
   * Nothing stores the standing: the register works it out from three things
   * the database does hold, and one of them — whether the archive was asked at
   * all — reaches it as a count rather than as the checks themselves. That
   * count is what could go wrong here, so it is held against the checks the
   * detail view actually lists (ADR-0014).
   */
  it('reads the standing off the row rather than off a column nobody keeps', async () => {
    // act
    const summary: PackageSummaryView = await queries.execute(
      new GetPackageSummaryQuery(finished.value),
    );
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(finished.value),
    );

    // assert
    expect(summary.standing).toBe(
      PackageStanding.of({
        status: PackageStatus.of(summary.status),
        report: detail.report ? ReportStatus.of(detail.report.status) : null,
        askedTheArchive: detail.registryChecks.length > 0,
        archiveSearchApproved: false,
      }).value,
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
    const page: PackageListPage = await queries.execute(EVERYTHING);

    // assert
    expect(page.items.map(summary => summary.id)).toEqual(
      expect.arrayContaining([finished.value, second.value]),
    );
    expect(page.total).toBe(page.items.length);
  });

  /*
   * What a term matches is stated in the contract and answered here, because
   * the answer is a WHERE clause and nothing but a database can say whether it
   * is the right one.
   */
  describe('the search', () => {
    it('finds a submission by the name of a file uploaded to it', async () => {
      // arrange — a name no other submission in this set carries
      const wanted: PackageId = await commands.execute(
        new CreatePackageCommand('cadastre', submission('bina-pasportu')),
      );
      await waitForTerminalStatus(queries, wanted);

      // act
      const page: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          'bina-pasportu',
          undefined,
          undefined,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // assert
      expect(page.items.map(summary => summary.id)).toEqual([wanted.value]);
      expect(page.total).toBe(1);
    });

    // The inspector types what is on the paper, not what is in the column.
    it('ignores the case of the term and of the name', async () => {
      // arrange
      const wanted: PackageId = await commands.execute(
        new CreatePackageCommand('cadastre', submission('torpaq-akti')),
      );
      await waitForTerminalStatus(queries, wanted);

      // act
      const page: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          'TORPAQ-Akti',
          undefined,
          undefined,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // assert
      expect(page.items.map(summary => summary.id)).toEqual([wanted.value]);
    });

    // What an inspector pastes out of a link. The column is `uuid`, so this is
    // the one part of the term that is held whole rather than looked for
    // inside something.
    it('finds a submission by its own id', async () => {
      // act
      const page: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          finished.value,
          undefined,
          undefined,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // assert
      expect(page.items.map(summary => summary.id)).toEqual([finished.value]);
    });

    it('answers an empty page, and says so, when nothing matches', async () => {
      // act
      const page: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          'not-a-paper-anybody-filed',
          undefined,
          undefined,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // assert
      expect(page.items).toEqual([]);
      expect(page.total).toBe(0);
    });
  });

  /*
   * Two questions and therefore two filters: where the submission stands, and
   * what the run found. The standing is stored nowhere (ADR-0014), so the
   * filter is a condition over the columns it is derived from — and what is
   * held here is that the condition and the derivation agree, on rows a real
   * database matched.
   */
  describe('the filters', () => {
    it('narrows to the submissions standing where the caller asked', async () => {
      // arrange
      const all: PackageListPage = await queries.execute(EVERYTHING);

      for (const standing of PackageStanding.all) {
        // act
        const page: PackageListPage = await queries.execute(
          new ListPackagesQuery(
            undefined,
            standing.value,
            undefined,
            LIST_PACKAGES_MAX_LIMIT,
            0,
          ),
        );

        // assert — the same rows the unfiltered list reports as standing here
        expect(page.items.map(summary => summary.id).sort()).toEqual(
          all.items
            .filter(summary => summary.standing === standing.value)
            .map(summary => summary.id)
            .sort(),
        );
        expect(page.total).toBe(page.items.length);
      }
    });

    it('narrows to what the run found, which is not the same question', async () => {
      // arrange
      const all: PackageListPage = await queries.execute(EVERYTHING);

      for (const status of ReportStatus.all) {
        // act
        const page: PackageListPage = await queries.execute(
          new ListPackagesQuery(
            undefined,
            undefined,
            status.value,
            LIST_PACKAGES_MAX_LIMIT,
            0,
          ),
        );

        // assert
        expect(page.items.map(summary => summary.id).sort()).toEqual(
          all.items
            .filter(summary => summary.reportStatus === status.value)
            .map(summary => summary.id)
            .sort(),
        );
      }
    });

    // A submission cannot both be short of a paper and have a report saying
    // everything was in order, so the two filters together must narrow to
    // nothing rather than to either one of them.
    it('narrows by both at once rather than by whichever came last', async () => {
      // act
      const page: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          undefined,
          PackageStanding.SHORT_OF_DOCUMENTS.value,
          ReportStatus.OK.value,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // assert
      expect(page.items).toEqual([]);
    });
  });

  describe('the pages', () => {
    it('hands over one page and says how many rows there are behind it', async () => {
      // arrange
      const all: PackageListPage = await queries.execute(EVERYTHING);
      expect(all.total).toBeGreaterThan(1);

      // act
      const first: PackageListPage = await queries.execute(
        new ListPackagesQuery(undefined, undefined, undefined, 1, 0),
      );

      // assert — the tally counts what the criteria matched, not what the page
      // holds; a pager that could not tell them apart could not say how many
      // pages there are
      expect(first.items).toHaveLength(1);
      expect(first.total).toBe(all.total);
    });

    it('walks the whole list, newest first, without repeating or skipping a row', async () => {
      // arrange
      const all: PackageListPage = await queries.execute(EVERYTHING);

      // act — one row at a time, which is the harshest version of the question
      const walked: string[] = [];
      for (let offset = 0; offset < all.total; offset++) {
        const page: PackageListPage = await queries.execute(
          new ListPackagesQuery(undefined, undefined, undefined, 1, offset),
        );
        walked.push(...page.items.map(summary => summary.id));
      }

      // assert
      expect(walked).toEqual(all.items.map(summary => summary.id));
      expect(new Set(walked).size).toBe(all.total);
    });

    it('answers an empty page past the end rather than the last one again', async () => {
      // arrange
      const all: PackageListPage = await queries.execute(EVERYTHING);

      // act
      const past: PackageListPage = await queries.execute(
        new ListPackagesQuery(undefined, undefined, undefined, 10, all.total),
      );

      // assert
      expect(past.items).toEqual([]);
      expect(past.total).toBe(all.total);
    });
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
