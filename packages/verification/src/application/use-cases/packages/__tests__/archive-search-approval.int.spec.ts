import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import type { AddressLookupResponse } from '@cadastre/api-contracts/registry';
import { LIST_PACKAGES_MAX_LIMIT } from '@cadastre/api-contracts/verification';

import {
  startContext,
  StubRegistry,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import {
  ArchiveSearchAlreadyApprovedException,
  ArchiveSearchNotAskedException,
} from '../../../../domain/exceptions/index.js';
import {
  PackageStanding,
  PackageStatus,
  ReportStatus,
  type PackageId,
} from '../../../../domain/value-objects/index.js';
import type { PackageListPage } from '../../../ports/outbound/index.js';
import type {
  PackageDetailView,
  PackageSummaryView,
} from '../../../read-models/index.js';
import { AddFilesCommand } from '../add-files/index.js';
import { ApproveArchiveSearchCommand } from '../approve-archive-search/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageSummaryQuery } from '../get-package-summary/index.js';
import { GetPackageQuery } from '../get-package/index.js';
import { ListPackagesQuery } from '../list-packages/index.js';

/*
 * The papers the register stage needs: the application the address is read off,
 * the archive certificate, the plan-scheme and the title the archive is asked
 * to produce the original of.
 */
const submission = (prefix: string) =>
  [
    'erize-qeydiyyat.pdf',
    'arxiv-arayisi.pdf',
    'plan-sxem.pdf',
    'serencamdan-cixaris.pdf',
  ].map(name => ({
    originalFilename: name,
    contentType: 'application/pdf',
    storageKey: `uploads/${prefix}/${name}`,
  }));

const CONFIRMED: AddressLookupResponse = {
  outcome: 'Found',
  canonicalAddress: 'Bakı şəhəri, Nəsimi rayonu, Azadlıq prospekti 12',
  record: {
    registerNo: '3-00219',
    inventoryNo: 'İnv-7731',
    address: 'Bakı şəhəri, Nəsimi rayonu, Azadlıq prospekti 12, mənzil 43',
    ownerName: 'Əliyev Elçin',
    cadastralNumber: 'AZ-CAD-1024-311',
    plotArea: '642 m²',
    location: { folder: '14', pages: '01-dən 30' },
    documents: [],
  },
  candidates: 1,
  attributes: [],
  documents: [],
  note: 'Register 3-00219 holds this address.',
};

const EVERYTHING = new ListPackagesQuery(
  undefined,
  undefined,
  undefined,
  LIST_PACKAGES_MAX_LIMIT,
  0,
);

/*
 * The one write in this context a person makes rather than the engine
 * (ADR-0016), against a real database — because the whole of what it claims is
 * about surviving a write and a read: the approval has to come back with the
 * answers it covered, and it has to stop being in force when a later run asks
 * the register again. Neither is visible in a unit test, which never stores
 * anything.
 *
 * The envelope here is deliberately not a complete one — four papers of the
 * seven the cadastre profile requires — so these packages stand at
 * `ShortOfDocuments` throughout: a missing paper outranks an approval, and
 * would go on outranking it (ADR-0014). What the approval does to a clean
 * package's standing is the aggregate's own set to say; what it does to the
 * database is here.
 */
describe('approving what the archive register answered', () => {
  let module: TestingModule;
  let commands: CommandBus;
  let queries: QueryBus;
  let approved: PackageId;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      registry: new StubRegistry(CONFIRMED),
    }));
    commands = module.get(CommandBus);
    queries = module.get(QueryBus);

    approved = await commands.execute(
      new CreatePackageCommand('cadastre', submission('approval')),
    );
    await waitForTerminalStatus(queries, approved);

    await commands.execute(
      new ApproveArchiveSearchCommand(
        approved.value,
        '  The register holds this property and agrees with the papers.  ',
        '  Folder 14 checked by hand.  ',
      ),
    );
  });

  afterAll(async () => {
    await module?.close();
  });

  it('writes down what was concluded, the remark, and when it was signed', async () => {
    // act
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(approved.value),
    );

    // assert
    expect(detail.archiveSearchApprovals).toHaveLength(1);
    expect(detail.archiveSearchApprovals[0]).toMatchObject({
      summary: 'The register holds this property and agrees with the papers.',
      comment: 'Folder 14 checked by hand.',
      supersededAt: null,
    });
    expect(detail.archiveSearchApprovals[0]?.approvedAt).toBeInstanceOf(Date);
  });

  /*
   * What was approved, and not merely that something was. Once the checks are
   * made again this is the only thing that says what the person actually saw.
   */
  it('records the answers the register had given at that moment', async () => {
    // act
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(approved.value),
    );

    // assert — the same answers the checks themselves carry
    expect(detail.archiveSearchApprovals[0]?.checks).toEqual(
      detail.registryChecks.map(check => ({
        key: check.key,
        outcome: check.outcome,
      })),
    );
  });

  // An approval in force is a fact rather than a draft: it ends by the register
  // being asked again, never by being written over.
  it('refuses a second approval while one is in force', async () => {
    // act
    const refusal = commands.execute(
      new ApproveArchiveSearchCommand(
        approved.value,
        'on second thoughts',
        undefined,
      ),
    );

    // assert
    await expect(refusal).rejects.toThrow(
      ArchiveSearchAlreadyApprovedException,
    );
  });

  /*
   * The standing is worked out from the row rather than from a column nobody
   * keeps (ADR-0014), and the approval reaches it as a count of the ones still
   * in force. That count is what could go wrong here, so it is held against the
   * approvals the detail view actually lists.
   */
  it('reads the approval into the standing off the same rows', async () => {
    // act
    const summary: PackageSummaryView = await queries.execute(
      new GetPackageSummaryQuery(approved.value),
    );
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(approved.value),
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
   * The filter is a condition over the columns the standing is derived from,
   * and one of those columns is now an approval that may or may not still be in
   * force. A package whose search is approved must land on the same standing
   * from the database as it does from the rule — the two disagreeing is exactly
   * what ADR-0014 exists to prevent.
   */
  it('narrows the list by every standing the same way the rule does', async () => {
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

      // assert
      expect(page.items.map(item => item.id).sort()).toEqual(
        all.items
          .filter(item => item.standing === standing.value)
          .map(item => item.id)
          .sort(),
      );
    }
  });

  /*
   * The rule the whole design turns on. A file arriving discards the register's
   * answers and sends the package back to be read again (ADR-0013), so the
   * approval of those answers is spent — and it is spent visibly: the row stays
   * on file with the moment it stopped counting, rather than disappearing or,
   * worse, staying silently in force over answers nobody has read.
   */
  describe('once the archive search is made again', () => {
    let reread: PackageDetailView;

    beforeAll(async () => {
      await commands.execute(
        new AddFilesCommand(approved.value, [
          {
            originalFilename: 'elave-sened.pdf',
            contentType: 'application/pdf',
            storageKey: 'uploads/approval/elave-sened.pdf',
          },
        ]),
      );
      await waitForTerminalStatus(queries, approved);
      reread = await queries.execute(new GetPackageQuery(approved.value));
    });

    it('keeps the approval on file and says when it stopped being in force', () => {
      // act
      const spent = reread.archiveSearchApprovals[0];

      // assert
      expect(reread.archiveSearchApprovals).toHaveLength(1);
      expect(spent?.summary).toBe(
        'The register holds this property and agrees with the papers.',
      );
      expect(spent?.supersededAt).toBeInstanceOf(Date);
    });

    it('leaves the package unapproved, so nothing reads it as settled', async () => {
      // act
      const summary: PackageSummaryView = await queries.execute(
        new GetPackageSummaryQuery(approved.value),
      );

      // assert — the standing is worked out with no approval in force
      expect(
        reread.archiveSearchApprovals.some(
          approval => approval.supersededAt === null,
        ),
      ).toBe(false);
      expect(summary.standing).toBe(
        PackageStanding.of({
          status: PackageStatus.of(summary.status),
          report: reread.report ? ReportStatus.of(reread.report.status) : null,
          askedTheArchive: reread.registryChecks.length > 0,
          archiveSearchApproved: false,
        }).value,
      );
    });

    // The search was made afresh, so it is a fresh thing to sign for — and the
    // record then holds both, the spent one and the one in force.
    it('lets the fresh answers be approved in their turn', async () => {
      // act
      await commands.execute(
        new ApproveArchiveSearchCommand(
          approved.value,
          'the extra paper changes nothing the register holds',
          undefined,
        ),
      );
      const detail: PackageDetailView = await queries.execute(
        new GetPackageQuery(approved.value),
      );

      // assert — newest first, and only one of them in force
      expect(
        detail.archiveSearchApprovals.map(approval => approval.supersededAt),
      ).toEqual([null, expect.any(Date)]);
      expect(detail.archiveSearchApprovals[0]?.comment).toBeNull();
    });
  });
});

/*
 * A package whose address no sheet states leaves no archive search for anybody
 * to sign off — the check was never put, so there is no answer to approve, and
 * settling a submission on the strength of a question nobody asked is worse
 * than leaving it open.
 */
describe('approving an archive search that was never made', () => {
  let module: TestingModule;
  let unasked: PackageId;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      registry: new StubRegistry(CONFIRMED),
    }));
    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    // A paper the offline reader has no text for, so nothing in this package
    // states the address the register would have been asked about.
    unasked = await commands.execute(
      new CreatePackageCommand('cadastre', [
        {
          originalFilename: 'basqa-sened.pdf',
          contentType: 'application/pdf',
          storageKey: 'uploads/unasked/basqa-sened.pdf',
        },
      ]),
    );
    await waitForTerminalStatus(queries, unasked);
  });

  afterAll(async () => {
    await module?.close();
  });

  it('refuses, rather than recording an approval of nothing', async () => {
    // arrange
    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);
    const detail: PackageDetailView = await queries.execute(
      new GetPackageQuery(unasked.value),
    );
    expect(detail.registryChecks).toEqual([]);

    // act
    const refusal = commands.execute(
      new ApproveArchiveSearchCommand(
        unasked.value,
        'nothing outstanding',
        undefined,
      ),
    );

    // assert
    await expect(refusal).rejects.toThrow(ArchiveSearchNotAskedException);
  });
});
