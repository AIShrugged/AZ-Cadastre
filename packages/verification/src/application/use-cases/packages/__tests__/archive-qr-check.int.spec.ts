import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import {
  DocumentDtoSchema,
  type DocumentDto,
  type PackageDetailDto,
} from '@cadastre/api-contracts/verification';

import {
  FixedPageSplitter,
  InstantOcr,
  startContext,
  waitForTerminalStatus,
} from '../../../../../test/context-harness.js';
import {
  Confidence,
  OcrResult,
  RecognisedText,
  type PageImage,
} from '../../../../domain/value-objects/index.js';
import { CreatePackageCommand } from '../create-package/index.js';
import { GetPackageQuery } from '../get-package/index.js';
import { toDetailDto } from '../package.mapper.js';

/*
 * The Rusadze Vera Vladimirovna case, on every provider left at `mock`: the
 * archive's certified copy of the 1998 homestead allotment order is held against
 * the National Archive Fund by the QR reference printed on it, and confirmed
 * (ADR-0028).
 *
 * Here rather than in a unit test because the answer has to survive the whole
 * path — the stage saves it on the document, `complete()` loads the package
 * again and compiles the report from what was stored, and the read side
 * publishes it on `DocumentDto` out of its own query.
 */

// The sheet as a reader transcribes the copy the archive's Baku branch sent in
// January 2026: the heading the profile places it by, and the seal and the
// signature an office presses on an act.
const ORDER_1471 = [
  'AZƏRBAYCAN RESPUBLİKASI',
  'SABUNÇU RAYON İCRA HAKİMİYYƏTİ',
  'Həyətyanı torpaq sahəsinin ayrılması barədə qərar № 1471, 29.10.1998',
  'Qusadze Vera Vladimirovna — 400,0 kv.m',
  'EAS: Fond-130, siy.1, i-476, vər.98',
  '[stamp: SABUNÇU RAYON İCRA HAKİMİYYƏTİ]',
  '[signature]',
].join('\n');

/** The harness's reader, with the order's sheet in place of a demo paper. */
class RusadzeOcr extends InstantOcr {
  override async recognise(image: PageImage): Promise<OcrResult> {
    return image.storageKey.value.includes('serencam-1471')
      ? OcrResult.of(RecognisedText.of(ORDER_1471), Confidence.of(0.9))
      : super.recognise(image);
  }
}

describe('the Rusadze package, held against the National Archive by its QR code', () => {
  let module: TestingModule;
  let detail: PackageDetailDto;
  let order: DocumentDto | undefined;

  beforeAll(async () => {
    ({ module } = await startContext(inject('databaseUrl'), {
      ocr: new RusadzeOcr(),
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
      qrReference: 'https://qr.esd.milliarxiv.gov.az/F130-S1-I476-V98',
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
