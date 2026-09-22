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
 * The Rusadze Vera Vladimirovna case, on every provider left at `mock`: the
 * archive's certified copy of the 1998 homestead allotment order is held against
 * the National Archive Fund by the code printed on it, and confirmed (ADR-0028).
 *
 * Here rather than in a unit test because the answer has to survive the whole
 * path — the stage saves it on the document, `complete()` loads the package
 * again and compiles the report from what was stored, and the read side
 * publishes it on `DocumentDto` out of its own query.
 */

/*
 * The code the decoder reads off sheet 6 of the real package, and the one the
 * offline archive is keyed by. Said here because there is no image behind these
 * storage keys to decode it from (ADR-0034).
 */
const RUSADZE_QR =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'ZJvhzrotBTaKufxeEAVCshnMir5G0fjuTBO%2FsM8MvnHWubgPkFzZVz2M9%2F5D7xEU';

describe('the Rusadze package, held against the National Archive by its QR code', () => {
  let module: TestingModule;
  let detail: PackageDetailDto;
  let order: DocumentDto | undefined;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      ocr: new DemoOcrFor('serencam-1471'),
      codes: new SheetsPrinting({ 'serencam-1471': RUSADZE_QR }),
      splitter: new FixedPageSplitter(1),
    }));

    const commands = module.get(CommandBus);
    const queries = module.get(QueryBus);

    const id = await commands.execute(
      new CreatePackageCommand('cadastre', [
        {
          originalFilename: 'erize-qeydiyyat.pdf',
          contentType: 'application/pdf',
          storageKey: 'uploads/rusadze/erize-qeydiyyat.pdf',
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
    order = detail.files
      .flatMap(file => file.documents)
      .find(document => document.type === 'homestead_land_allocation_decision');
  });

  afterAll(async () => {
    await module?.close();
  });

  it('reads the order as the Decree 439 paper it is', () => {
    expect(detail.status).toBe('Completed');
    expect(order).toBeDefined();
  });

  it('confirms the order, with the issuer competent to make it', () => {
    expect(order?.archiveQrCheck).toMatchObject({
      status: 'Confirmed',
      qrReference: RUSADZE_QR,
      issuingAuthorityCompetent: true,
    });
  });

  it('agrees with the archive on all eight lines', () => {
    expect(
      order?.archiveQrCheck?.fields.map(field => [field.name, field.verdict]),
    ).toEqual([
      ['document_no', 'Match'],
      ['issue_date', 'Match'],
      ['issuing_authority', 'Match'],
      ['holder_name', 'Match'],
      ['property_address', 'Match'],
      ['plot_area', 'Match'],
      ['decree_item', 'Match'],
      ['archive_reference', 'Match'],
    ]);
  });

  // 400 square metres on the order against the archive's hectares.
  it('carries both sides of each line, as each side states it', () => {
    const area = order?.archiveQrCheck?.fields.find(
      field => field.name === 'plot_area',
    );

    expect(area).toEqual({
      name: 'plot_area',
      documentValue: '400,0 kv.m',
      archiveValue: '0,04 ha',
      verdict: 'Match',
    });
  });

  it('publishes the answer in the shape the contract names', () => {
    expect(DocumentDtoSchema.safeParse(order).success).toBe(true);
  });

  it('reports nothing against the order, and no longer says the archive was not asked', () => {
    const aboutTheOrder = (detail.report?.issues ?? []).filter(
      issue => issue.documentId === order?.id,
    );

    expect(aboutTheOrder.map(issue => issue.kind)).not.toContain(
      'ArchiveQrMismatch',
    );
    expect(aboutTheOrder.map(issue => issue.kind)).not.toContain(
      'IntegrationNotConnected',
    );
    expect(aboutTheOrder.map(issue => issue.kind)).not.toContain(
      'RegistryUnconfirmed',
    );
  });

  // Only a Decree 439 paper is held against the archive by its QR code.
  it('asks nothing of the archive about the application', () => {
    const application = detail.files
      .flatMap(file => file.documents)
      .find(document => document.type === 'application');

    expect(application?.archiveQrCheck).toBeNull();
  });
});

/*
 * The Hümbətov case, which is what COMM-133 was opened about: a register
 * extract with a QR code on its face and, until ADR-0034, not one line of the
 * report about it.
 *
 * Three things went wrong at once and this holds all three. The reader,
 * asked to transcribe the code, answered `[QR code]` — a non-empty value, so
 * the package counted as having had a code read off it and `QrCodeUnavailable`
 * was never compiled. The extract is sourced from MQS, so the only line it got
 * was the type-wide "integration not connected". And the code itself, which
 * resolves in the register's own e-emlak, was never looked at.
 */
describe('a register extract whose code the register itself issued', () => {
  const EMLAK =
    'https://e-emlak.gov.az/eemdk/az/CheckElectronExtract/' +
    'qr?r=010013004784-10301&q=1126019206&t=D5C125C676973D40D8DC22D4B23D487F';

  let module: TestingModule;
  let detail: PackageDetailDto;
  let plan: DocumentDto | undefined;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      codes: new SheetsPrinting({ 'plan-sxem': EMLAK }),
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
      ]),
    );
    await waitForTerminalStatus(queries, id);
    detail = toDetailDto(
      await queries.execute(new GetPackageQuery(id.value, null)),
    );
    plan = detail.files
      .flatMap(file => file.documents)
      .find(document => document.type === 'land_plot_plan');
  });

  afterAll(async () => {
    await module?.close();
  });

  it('puts the decoded code on the paper, at full confidence', () => {
    const code = plan?.fields.find(field => field.name === 'qr_code');

    expect(code?.value).toBe(EMLAK);
    expect(code?.confidence).toBe(1);
    expect(code?.origin).toBe('ReadOnThisDocument');
  });

  // The whole of the complaint: the sheet now has a line of its own, and it
  // names the service that would settle it.
  it('says whose code it is, and that this system cannot ask them', () => {
    expect(plan?.archiveQrCheck).toMatchObject({
      status: 'IssuerNotConnected',
      qrReference: EMLAK,
      issuer: 'e-emlak.gov.az',
    });
  });

  // Nothing is sent to a service the archive does not speak for: one service's
  // identifiers are not another's to be told about.
  it('holds the paper against nothing and blames it for nothing', () => {
    expect(plan?.archiveQrCheck?.fields).toEqual([]);
    expect(plan?.archiveQrCheck?.signature).toBeNull();
    expect(
      detail.report?.issues.filter(issue => issue.kind === 'ArchiveQrMismatch'),
    ).toEqual([]);
  });

  /*
   * The per-paper line replaces the type-wide one rather than joining it: one
   * absence, told once and against the sheet an inspector can open (ADR-0032).
   */
  it('no longer says only that MQS is not connected', () => {
    const about = (kind: string) =>
      (detail.report?.issues ?? []).filter(
        issue => issue.kind === kind && issue.documentId === plan?.id,
      );

    expect(about('IntegrationNotConnected')).toEqual([]);
    const [unconfirmed] = about('RegistryUnconfirmed');
    // Named, and the archive is not the subject of the sentence: it never
    // looked, and saying it did would be a claim about a search nobody made.
    expect(unconfirmed?.message).toContain(
      'it is issued by e-emlak.gov.az, which is not connected',
    );
    expect(unconfirmed?.message).not.toContain('National Archive Fund');
  });
});
