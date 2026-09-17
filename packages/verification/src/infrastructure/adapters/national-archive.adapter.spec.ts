import { describe, expect, it } from 'vitest';

import { archiveQrCheckOf } from '../../domain/services/index.js';
import {
  DocumentType,
  RecognisedText,
  VerificationProfile,
} from '../../domain/value-objects/index.js';

import { FieldExtractorAdapter } from './field-extractor.adapter.js';
import { NationalArchiveAdapter } from './national-archive.adapter.js';

const HOMESTEAD = DocumentType.create('homestead_land_allocation_decision');

describe('NationalArchiveAdapter', () => {
  it('answers nothing under a reference it does not hold', async () => {
    const answer = await new NationalArchiveAdapter().lookupByQr(
      'https://e-emdk.gov.az/plan/RN-2025-004312',
    );

    expect(answer.outcome).toBe('NotFound');
    expect(answer.note).toContain('offline');
  });

  /*
   * The offline extractor and the offline archive are two halves of one demo,
   * and a run with every provider on `mock` has to confirm the Rusadze order
   * rather than always failing to find it. Held here, over both adapters and
   * the domain rule between them, so the two stand-ins cannot drift apart.
   */
  it('bears out the paper the offline extractor reads, on every line', async () => {
    const [fields, archive] = [
      await new FieldExtractorAdapter().extract({
        text: RecognisedText.of('Həyətyanı torpaq sahəsinin ayrılması'),
        sheets: [],
        spec: VerificationProfile.CADASTRE.specFor(HOMESTEAD),
      }),
      new NationalArchiveAdapter(),
    ];
    const read = (key: string) =>
      fields.find(field => field.key.value === key)?.value.value ?? null;
    const qrReference = read('qr_code');
    const answer = await archive.lookupByQr(qrReference ?? '');

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;

    const { document } = answer;
    const check = archiveQrCheckOf({
      type: HOMESTEAD,
      stated: read,
      qrReference,
      archived: {
        lines: {
          document_no: document.documentNo,
          issue_date: document.issuedOn,
          issuing_authority: document.issuingAuthority.name,
          holder_name: document.holderName,
          property_address: document.propertyAddress,
          plot_area: document.plotArea,
          decree_item: document.decreeItem,
          archive_reference: document.archiveReference,
        },
        issuingAuthorityKind: document.issuingAuthority.kind,
      },
      checkedAt: new Date(),
    });

    expect(check.status).toBe('Confirmed');
    expect(check.issuingAuthorityCompetent).toBe(true);
    expect(check.fields.every(field => field.verdict === 'Match')).toBe(true);
  });

  // Only the Decree 439 papers read as the Rusadze order: the demo persona's
  // other papers keep the values every other spec already relies on.
  it('leaves the offline extractor reading every other paper as before', async () => {
    const fields = await new FieldExtractorAdapter().extract({
      text: RecognisedText.of(''),
      sheets: [],
      spec: VerificationProfile.CADASTRE.specFor(
        DocumentType.create('land_plot_plan'),
      ),
    });

    expect(
      fields.find(field => field.key.value === 'qr_code')?.value.value,
    ).toBe('https://e-emdk.gov.az/plan/RN-2025-004312');
  });
});
