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
  RegistryOutcome,
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
        archiveSearchApproved: detail.archiveSearchApprovals.some(
          approval => approval.supersededAt === null,
        ),
      }).value,
    );
  });

  /*
   * What the row calls the case. Nothing stores it: the register walks the
   * profile's ordering over the extracted fields, which is one nested select on
   * a page of rows rather than a column anybody keeps up to date. Here rather
   * than in a unit test because what a page actually carries over — and whether
   * the walk survives the write and the read — is a question only a database
   * answers.
   */
  describe('what the row calls the case', () => {
    it('names the applicant, the address and the parcel off the papers that were read', async () => {
      // act
      const summary: PackageSummaryView = await queries.execute(
        new GetPackageSummaryQuery(finished.value),
      );
      const detail: PackageDetailView = await queries.execute(
        new GetPackageQuery(finished.value),
      );

      // assert — the same reading the detail view lists, never a second one
      const stated = detail.files
        .flatMap(file => [...file.documents])
        .flatMap(document =>
          document.fields.map(field => ({
            type: document.type,
            name: field.name,
            value: field.value,
          })),
        );

      expect(summary.applicantName).not.toBeNull();
      expect(
        stated.some(
          field =>
            field.name === 'applicant_name' &&
            field.value === summary.applicantName?.value,
        ),
      ).toBe(true);
      expect(summary.propertyAddress?.value).toBe(
        stated.find(field => field.name === 'property_address')?.value,
      );
      expect(summary.cadastralNumber?.value).toBe(
        stated.find(field => field.name === 'cadastral_number')?.value,
      );
    });

    it('carries the same three values on the list as on the card', async () => {
      // act
      const summary: PackageSummaryView = await queries.execute(
        new GetPackageSummaryQuery(finished.value),
      );
      const page: PackageListPage = await queries.execute(EVERYTHING);

      // assert
      const row = page.items.find(item => item.id === finished.value);

      expect(row?.applicantName).toEqual(summary.applicantName);
      expect(row?.propertyAddress).toEqual(summary.propertyAddress);
      expect(row?.cadastralNumber).toEqual(summary.cadastralNumber);
    });

    /*
     * A submission the run read and could name nothing off: the sheets carry
     * no heading the classifier places, so no document answers a type any
     * ordering names and nothing was extracted. Every value is null and none of
     * them is a blank — a row that cannot name the case has to say so, because
     * an empty string reads as a value somebody left out.
     */
    it('names nothing off a package whose papers state nothing it asked for', async () => {
      // arrange — a name no branch of the offline reader recognises
      const unnamed: PackageId = await commands.execute(
        new CreatePackageCommand('cadastre', [
          {
            originalFilename: 'qovluq-siyahisi.pdf',
            contentType: 'application/pdf',
            storageKey: `uploads/q-unnamed/qovluq-siyahisi.pdf`,
          },
        ]),
      );
      await waitForTerminalStatus(queries, unnamed);

      // act
      const summary: PackageSummaryView = await queries.execute(
        new GetPackageSummaryQuery(unnamed.value),
      );

      // assert
      expect(summary.extractedCount).toBe(0);
      expect(summary.applicantName).toBeNull();
      expect(summary.propertyAddress).toBeNull();
      expect(summary.cadastralNumber).toBeNull();

      /*
       * And nothing about the archive either, which is the same package saying
       * a different kind of nothing: no sheet states an address, so no question
       * was ever put to the register. A row that answered `NotFound` here would
       * be reporting silence from an archive nobody asked (ADR-0009).
       */
      const detail: PackageDetailView = await queries.execute(
        new GetPackageQuery(unnamed.value),
      );

      expect(detail.registryChecks).toEqual([]);
      expect(summary.archiveOutcome).toBeNull();
      expect(summary.archiveSearchApproved).toBe(false);
    });
  });

  /*
   * What the row says the archive answered, held against the checks the detail
   * view lists — the same invariant the tally and the standing are held to, and
   * for the same reason: a row and the card it leads to must not come to say
   * different things about one submission.
   */
  it('says on the row what the register answered on the card', async () => {
    // act
    const summary: PackageSummaryView = await queries.execute(
      new GetPackageSummaryQuery(finished.value),
    );
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(finished.value),
    );

    // assert
    expect(summary.archiveOutcome).toBe(
      RegistryOutcome.overall(
        detail.registryChecks.map(check => RegistryOutcome.of(check.outcome)),
      )?.value ?? null,
    );
    expect(summary.archiveSearchApproved).toBe(
      detail.archiveSearchApprovals.some(
        approval => approval.supersededAt === null,
      ),
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
            [standing.value],
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

    /*
     * The slice an inspector calls "in progress" is two standings, not one:
     * accepted and being read are one job to the person doing it. Held against
     * the unfiltered list, because the point is that the page and its own count
     * are the sum of the two and not either of them.
     */
    it('narrows to any of several standings at once, which is what a slice is', async () => {
      // arrange
      const all: PackageListPage = await queries.execute(EVERYTHING);
      const asked = [
        PackageStanding.SHORT_OF_DOCUMENTS.value,
        PackageStanding.QUEUED.value,
        PackageStanding.UNDER_VERIFICATION.value,
      ];

      // act
      const page: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          undefined,
          asked,
          undefined,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // assert
      expect(page.items.map(summary => summary.id).sort()).toEqual(
        all.items
          .filter(summary => asked.includes(summary.standing))
          .map(summary => summary.id)
          .sort(),
      );
      expect(page.total).toBe(page.items.length);
    });

    // The same one twice is the same slice: a caller building the parameter off
    // a set of boxes must not be answered with a row per tick.
    it('answers a standing named twice with the rows it names once', async () => {
      // arrange
      const once: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          undefined,
          [PackageStanding.SHORT_OF_DOCUMENTS.value],
          undefined,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // act
      const twice: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          undefined,
          [
            PackageStanding.SHORT_OF_DOCUMENTS.value,
            PackageStanding.SHORT_OF_DOCUMENTS.value,
          ],
          undefined,
          LIST_PACKAGES_MAX_LIMIT,
          0,
        ),
      );

      // assert
      expect(twice.items.map(summary => summary.id)).toEqual(
        once.items.map(summary => summary.id),
      );
      expect(twice.total).toBe(once.total);
    });

    // A submission cannot both be short of a paper and have a report saying
    // everything was in order, so the two filters together must narrow to
    // nothing rather than to either one of them.
    it('narrows by both at once rather than by whichever came last', async () => {
      // act
      const page: PackageListPage = await queries.execute(
        new ListPackagesQuery(
          undefined,
          [PackageStanding.SHORT_OF_DOCUMENTS.value],
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
