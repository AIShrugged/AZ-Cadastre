import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  DocumentDtoSchema,
  type DocumentDto,
  type PackageDetailDto,
} from '@cadastre/api-contracts/verification';

import {
  DemoOcrFor,
  FixedPageSplitter,
  SheetsPrinting,
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';
import { toDetailDto } from '../package.mapper.js';

/*
 * The one paper whose QR code is resolved, on every provider left at `mock`:
 * the extract from the disposal order, held against the National Archive Fund
 * by the code printed on it and confirmed (ADR-0028, narrowed by ADR-0035).
 *
 * Here rather than in a unit test because the answer has to survive the whole
 * path — the stage saves it on the document, `complete()` loads the package
 * again and compiles the report from what was stored, and the read side
 * publishes it on `DocumentDto` out of its own query.
 */

/*
 * The codes the decoder would read off these sheets. Said here because there is
 * no image behind these storage keys to decode one from (ADR-0034); the first
 * is the reference the offline archive holds the extract under —
 * DEMO_DISPOSAL_ORDER_QR in national-archive.adapter.ts.
 */
const ORDER_QR =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'R6jQk0hVvCmXpZ2sL8nT4wB1yE7uA3dF%2FQ5oN9rI6cS0gM%2BjH8kP4xW2vY7zD1b';
const RUSADZE_QR =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'ZJvhzrotBTaKufxeEAVCshnMir5G0fjuTBO%2FsM8MvnHWubgPkFzZVz2M9%2F5D7xEU';

describe('the disposal order, held against the National Archive by its QR code', () => {
  let module: TestingModule;
  let detail: PackageDetailDto;
  let order: DocumentDto | undefined;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      ocr: new DemoOcrFor('serencam-cixaris'),
      codes: new SheetsPrinting({ 'serencam-cixaris': ORDER_QR }),
      splitter: new FixedPageSplitter(1),
    }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    const id = await commands.execute(
      new CreatePackageCommand('cadastre', [
        {
          originalFilename: 'erize-qeydiyyat.pdf',
          contentType: 'application/pdf',
          storageKey: 'uploads/aliyev/erize-qeydiyyat.pdf',
        },
        {
          originalFilename: 'serencam-cixaris.pdf',
          contentType: 'application/pdf',
          storageKey: 'uploads/aliyev/serencam-cixaris.pdf',
        },
      ]),
    );
    await waitForTerminalStatus(queries, id);
    detail = toDetailDto(
      await queries.execute(new GetPackageQuery(id.value, null)),
    );
    order = detail.files
      .flatMap(file => file.documents)
      .find(document => document.type === 'disposal_order');
  });

  afterAll(async () => {
    await module?.close();
  });

  it('reads the extract as the disposal order it is', () => {
    expect(detail.status).toBe('Completed');
    expect(order).toBeDefined();
  });

  /*
   * Competence is unjudged and that is not a fault: the Decree's table settles
   * eleven types and says nothing about a disposal order, so there is no rule
   * to apply (ADR-0034).
   */
  it('confirms the order against the archive', () => {
    expect(order?.archiveQrCheck).toMatchObject({
      status: 'Confirmed',
      qrReference: ORDER_QR,
      issuingAuthorityCompetent: null,
    });
  });

  /*
   * The four lines an extract from a disposal order prints, each agreeing with
   * the archive's own wording of it. The other four are `NotStated`: the paper
   * carries no item of the Decree and no reference into a fond, and neither
   * does the archive's entry for it.
   */
  it('agrees with the archive on every line both sides state', () => {
    expect(
      order?.archiveQrCheck?.fields.map(field => [field.name, field.verdict]),
    ).toEqual([
      ['document_no', 'Match'],
      ['issue_date', 'Match'],
      ['issuing_authority', 'Match'],
      ['holder_name', 'Match'],
      ['property_address', 'Match'],
      ['plot_area', 'Match'],
      ['decree_item', 'NotStated'],
      ['archive_reference', 'NotStated'],
    ]);
  });

  /*
   * The paper prints its number as `order_no` and the archive words the same
   * line `document_no`: one line off one sheet under two vocabularies, which is
   * what `ALSO_PRINTED_AS` is for (ADR-0035).
   */
  it('carries both sides of each line, as each side states it', () => {
    const number = order?.archiveQrCheck?.fields.find(
      field => field.name === 'document_no',
    );

    expect(number).toEqual({
      name: 'document_no',
      documentValue: 'R-1147',
      archiveValue: 'R-1147',
      verdict: 'Match',
    });
  });

  it('publishes the answer in the shape the contract names', () => {
    expect(DocumentDtoSchema.safeParse(order).success).toBe(true);
  });

  it('reports nothing against the order', () => {
    const aboutTheOrder = (detail.report?.issues ?? []).filter(
      issue => issue.documentId === order?.id,
    );

    expect(aboutTheOrder.map(issue => issue.kind)).not.toContain(
      'ArchiveQrMismatch',
    );
    expect(aboutTheOrder.map(issue => issue.kind)).not.toContain(
      'RegistryUnconfirmed',
    );
  });

  // Only the disposal order is held against the archive by its QR code.
  it('asks nothing of the archive about the application', () => {
    const application = detail.files
      .flatMap(file => file.documents)
      .find(document => document.type === 'application');

    expect(application?.archiveQrCheck).toBeNull();
  });
});

/*
 * The reversal ADR-0035 is: two papers that print a code, neither of which is
 * the disposal order, and neither of which gets a QR line any more.
 *
 * The register extract's code is the register's own — ADR-0034 gave it a line
 * saying e-emlak is not connected, and the customer's answer is that the
 * extract is not checked by QR code at all. The 1998 homestead allotment
 * decision's code is the archive's, and it is not the paper the customer wants
 * checked either. Both fall back to what they said before their codes were
 * resolved.
 */
describe('the papers whose codes are no longer resolved', () => {
  const EMLAK =
    'https://e-emlak.gov.az/eemdk/az/CheckElectronExtract/' +
    'qr?r=010013004784-10301&q=1126019206&t=D5C125C676973D40D8DC22D4B23D487F';

  let module: TestingModule;
  let detail: PackageDetailDto;
  let plan: DocumentDto | undefined;
  let homestead: DocumentDto | undefined;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      ocr: new DemoOcrFor('serencam-1471'),
      codes: new SheetsPrinting({
        'plan-sxem': EMLAK,
        'serencam-1471': RUSADZE_QR,
      }),
      splitter: new FixedPageSplitter(1),
    }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    const id = await commands.execute(
      new CreatePackageCommand('cadastre', [
        {
          originalFilename: 'plan-sxem.pdf',
          contentType: 'application/pdf',
          storageKey: 'uploads/humbetov/plan-sxem.pdf',
        },
        {
          originalFilename: 'serencam-1471.pdf',
          contentType: 'application/pdf',
          storageKey: 'uploads/rusadze/serencam-1471.pdf',
        },
      ]),
    );
    await waitForTerminalStatus(queries, id);
    detail = toDetailDto(
      await queries.execute(new GetPackageQuery(id.value, null)),
    );

    const documents = detail.files.flatMap(file => file.documents);
    plan = documents.find(document => document.type === 'land_plot_plan');
    homestead = documents.find(
      document => document.type === 'homestead_land_allocation_decision',
    );
  });

  afterAll(async () => {
    await module?.close();
  });

  /*
   * The code is still decoded off the symbol and still published on the paper
   * (ADR-0034): an inspector can read it and follow it themselves. What changed
   * is that nothing is asked about it.
   */
  it('still puts the decoded code on the paper, at full confidence', () => {
    const code = plan?.fields.find(field => field.name === 'qr_code');

    expect(code?.value).toBe(EMLAK);
    expect(code?.confidence).toBe(1);
    expect(code?.origin).toBe('ReadOnThisDocument');
  });

  it('holds neither paper against the archive by its code', () => {
    expect(plan?.archiveQrCheck).toBeNull();
    expect(homestead?.archiveQrCheck).toBeNull();
  });

  /*
   * The plan of the plot is confirmed through MQS, which is not connected, and
   * with no per-paper QR line to replace it that is what the report says again
   * — exactly what it said before ADR-0034 (ADR-0025).
   */
  it('says again only that the system confirming it is not connected', () => {
    const about = (kind: string) =>
      (detail.report?.issues ?? []).filter(
        issue => issue.kind === kind && issue.documentId === plan?.id,
      );

    expect(about('IntegrationNotConnected')).toHaveLength(1);
    expect(about('RegistryUnconfirmed')).toEqual([]);
  });

  /*
   * And the package-level line names the one type whose code would have been
   * resolved, which this envelope does not carry at all (ADR-0032, ADR-0035).
   */
  it('says the package carries no paper whose code it resolves', () => {
    const [skipped] = (detail.report?.issues ?? []).filter(
      issue => issue.kind === 'QrCodeUnavailable',
    );

    expect(skipped?.message).toContain('not checked by QR code');
    expect(skipped?.message).toContain(
      'no paper whose QR code this system resolves',
    );
  });
});
