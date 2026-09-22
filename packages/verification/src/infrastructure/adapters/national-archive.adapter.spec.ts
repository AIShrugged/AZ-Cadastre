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

// The code the decoder reads off sheet 6 of the Rusadze package, which is what
// the stand-in is keyed by (ADR-0034).
const RUSADZE_QR =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'ZJvhzrotBTaKufxeEAVCshnMir5G0fjuTBO%2FsM8MvnHWubgPkFzZVz2M9%2F5D7xEU';

describe('NationalArchiveAdapter', () => {
  it('answers nothing under a reference of its own it does not hold', async () => {
    const answer = await new NationalArchiveAdapter().lookupByQr(
      'https://qr.esd.milliarxiv.gov.az/info/nothing-is-filed-here',
    );

    expect(answer.outcome).toBe('NotFound');
    expect(answer.note).toContain('offline');
  });

  /*
   * A package carries codes from several services, and the archive must not
   * answer about a code the register issued: `NotFound` there would read as the
   * archive having looked, which is a claim about the paper nobody made
   * (ADR-0034).
   */
  it('refuses a reference it did not issue, and names who did', async () => {
    const answer = await new NationalArchiveAdapter().lookupByQr(
      'https://e-emlak.gov.az/eemdk/az/CheckElectronExtract/qr?r=1&q=2&t=3',
    );

    expect(answer.outcome).toBe('NotRecognised');
    if (answer.outcome !== 'NotRecognised') return;
    expect(answer.issuer).toBe('e-emlak.gov.az');
  });

  // One of the two packages in `INPUTS/` carries a code whose whole payload is
  // a document number. There is no issuer to name, and nothing may be guessed.
  it('names no issuer for a payload that is not a link', async () => {
    const answer = await new NationalArchiveAdapter().lookupByQr('1126012493');

    expect(answer.outcome).toBe('NotRecognised');
    if (answer.outcome !== 'NotRecognised') return;
    expect(answer.issuer).toBeNull();
  });

  /*
   * The offline extractor and the offline archive are two halves of one demo,
   * and a run with every provider on `mock` over the real Rusadze PDF has to
   * confirm the order rather than fail to find it. Held here, over both
   * adapters and the domain rule between them, so the two stand-ins cannot
   * drift apart.
   *
   * The reference is the decoder's and no longer the extractor's: a QR code is
   * read off the symbol and is not a field anybody returns (ADR-0034). What
   * this still holds together is the half that can drift — the lines the
   * extractor reads against the lines the archive states.
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
    const qrReference = RUSADZE_QR;
    const answer = await archive.lookupByQr(qrReference);

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
          issuing_authority: document.issuingAuthority?.name ?? null,
          holder_name: document.holderName,
          property_address: document.propertyAddress,
          plot_area: document.plotArea,
          decree_item: document.decreeItem,
          archive_reference: document.archiveReference,
        },
        issuingAuthorityKind: document.issuingAuthority?.kind ?? null,
        signature: null,
      },
      checkedAt: new Date(),
    });

    expect(check.status).toBe('Confirmed');
    expect(check.issuingAuthorityCompetent).toBe(true);
    expect(check.fields.every(field => field.verdict === 'Match')).toBe(true);
  });

  /*
   * The offline extractor returns no `qr_code` for any paper, and must not
   * start returning one again (ADR-0034).
   *
   * A stand-in value here would be dropped on the way into the aggregate, which
   * is worse than absent: it would read as a stand-in that still works, and the
   * next reader would spend an afternoon finding out it does not.
   */
  it('offers no QR code of its own for any paper', async () => {
    for (const spec of VerificationProfile.CADASTRE.specs) {
      const fields = await new FieldExtractorAdapter().extract({
        text: RecognisedText.of(''),
        sheets: [],
        spec,
      });

      expect(
        fields.some(field => field.key.value === 'qr_code'),
        `${spec.type.value} was given a QR code by the offline extractor`,
      ).toBe(false);
    }
  });
});
