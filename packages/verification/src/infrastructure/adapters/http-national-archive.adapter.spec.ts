import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import type { VerificationModuleOptions } from '../../verification.module-defs.js';
import { RegistryRefusedException } from '../exceptions/index.js';

import { HttpNationalArchiveAdapter } from './http-national-archive.adapter.js';
import type { SignedPdfDigitiser } from './signed-pdf.digitiser.js';

const BASE = 'https://api.esd.milliarxiv.gov.az/signature-info/api';

// The link the archive's certified copies print, and the id inside it — which
// is percent-encoded in the path because it contains slashes, and which the
// service wants decoded.
const LINK =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'alOOwj1hz3AX0%2FB0KP3RmZS7GDmQTJZHJ%2F6traU%2FJ9Qxk2McOR3AWm2UQvsRSK5s';
const CASE_ID =
  'alOOwj1hz3AX0/B0KP3RmZS7GDmQTJZHJ/6traU/J9Qxk2McOR3AWm2UQvsRSK5s';

function anArchive(reading?: string | null): HttpNationalArchiveAdapter {
  // A stand-in for the reader of the signed PDF: what matters here is what the
  // adapter does with the text, not how the file was turned into it.
  const digitiser =
    reading === undefined
      ? undefined
      : ({
          digitise: async () =>
            reading === null
              ? null
              : { text: reading, how: 'TextLayer' as const, pages: 0 },
        } as unknown as SignedPdfDigitiser);

  return new HttpNationalArchiveAdapter(
    {
      nationalArchive: { provider: 'http', url: BASE, timeoutMs: 1000 },
    } as VerificationModuleOptions,
    new SilentLogger(),
    digitiser,
  );
}

/*
 * The archive's signed copy of an allotment order, as its text layer reads —
 * the paper above and the signature panel the service renders beneath it.
 */
const SIGNED_COPY = [
  'AZƏRBAYCAN RESPUBLİKASI MİLLİ ARXİV İDARƏSİ',
  'Sənədin nömrəsi: 1471',
  'Sənədin tarixi: 29.10.1998',
  'Ərizəçi: Qusadze Vera Vladimirovna',
  'Ünvanı: Bakı şəhəri, Sabunçu rayonu, 1-ci Zabrat qəsəbəsi',
  'Sahəsi: 0,04 ha',
  'Bəndi: 2.7',
  'Fond 130, siyahı 1, iş 476, vərəq 98',
  'İmzalayan: Məmmədov Anar',
  'İmza tarixi: 14.01.2026',
  'Sertifikatı verən təşkilat: B.EST Certificate Services CA',
  'Struktur bölmə: DÖVLƏT ARXİVİNİN BAKI FİLİALI',
  'Sertifikatın etibarlılıq müddəti: 14.01.2025 - 14.01.2027',
  'İmza təsdiqləndi',
].join('\n');

function answering(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    typeof body === 'string'
      ? new Response(body, { status })
      : Response.json(body, { status }),
  ) as unknown as typeof fetch;
}

describe('HttpNationalArchiveAdapter', () => {
  const fetching = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetching);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetching.mockReset();
  });

  /*
   * A package carries codes from the register and from notaries as well, and
   * one service's identifiers are not another's to be told about. Nothing is
   * sent anywhere for a reference the archive does not issue.
   */
  it('sends nothing at all for a reference it does not issue', async () => {
    const answer = await anArchive().lookupByQr(
      'https://e-emlak.gov.az/eemdk/az/CheckElectronExtract/qr?r=1',
    );

    expect(answer.outcome).toBe('NotRecognised');
    expect(fetching).not.toHaveBeenCalled();
  });

  it('asks by the case id in the link, decoded as the service wants it', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, { signerName: 'Məmmədov Anar', signatureValidity: true }),
    );

    await anArchive().lookupByQr(LINK);

    const [asked] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(String(asked)).toContain(`${BASE}/v1/signature-info/verifyQr`);
    expect(new URL(String(asked)).searchParams.get('id')).toBe(CASE_ID);
  });

  /*
   * The shape of a real answer, taken from what the service returned on
   * 2026-09-22 for the code on the archive's certificate in the Hümbətov
   * package — down to the Baku offset on the date and the absence of
   * `expiredDate`, which the service's own web client renders and which that
   * answer did not carry. The names are stand-ins: the signer is a value off
   * somebody's papers (ADR-0008).
   */
  it('answers with what the service said about the sheet, and with no lines about the paper', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signerName: 'Məmmədov Anar',
        signatureDate: '2026-01-14T17:07:07.000+04:00',
        signatureValidity: true,
        contentUrl:
          'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF?X-Amz-Expires=3600',
        unit: 'DÖVLƏT ARXİVİNİN BAKI FİLİALI DİREKTOR',
        org: 'AZƏRBAYCAN RESPUBLİKASININ MİLLİ ARXİV İDARƏSİ',
      }),
    );

    const answer = await anArchive().lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.signature).toEqual({
      signedBy: 'Məmmədov Anar',
      organisation: 'AZƏRBAYCAN RESPUBLİKASININ MİLLİ ARXİV İDARƏSİ',
      unit: 'DÖVLƏT ARXİVİNİN BAKI FİLİALI DİREKTOR',
      signedOn: '2026-01-14T17:07:07.000+04:00',
      certificateValidity: null,
      valid: true,
    });
    expect(answer.document.documentNo).toBeNull();
    // The office that attested the copy is not the body that issued the paper,
    // and competence is judged on the second (ADR-0034).
    expect(answer.document.issuingAuthority).toBeNull();
  });

  /*
   * The link to the signed PDF is presigned and good for an hour. An inspector
   * opens a report long after the run that made it, so a stored link is dead by
   * the time anybody clicks it — and a dead link looks like the archive lost the
   * file. It is read off the answer and deliberately goes no further.
   */
  it('keeps no link to the signed file', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signatureValidity: true,
        contentUrl: 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF',
      }),
    );

    const answer = await anArchive().lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(JSON.stringify(answer.document)).not.toContain('content-veams');
  });

  it('carries a signature that did not verify through rather than dropping it', async () => {
    vi.stubGlobal('fetch', answering(200, { signatureValidity: false }));

    const answer = await anArchive().lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.signature?.valid).toBe(false);
  });

  // A service that will not say whether a signature verifies has said nothing
  // about the sheet, and the domain reads an answer holding nothing as an empty
  // shelf.
  it('holds no signature where the service would not say', async () => {
    vi.stubGlobal('fetch', answering(200, { signerName: 'Məmmədov Anar' }));

    const answer = await anArchive().lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.signature).toBeNull();
  });

  /*
   * The whole of what ADR-0035 is for: the eight lines of the comparison come
   * off the archive's own signed copy, so a disposal order gets a line-by-line
   * verdict instead of eight `NotStated`.
   */
  it("fills the lines of the paper from the archive's signed copy", async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signatureValidity: true,
        contentUrl: 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF',
      }),
    );

    const answer = await anArchive(SIGNED_COPY).lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.documentNo).toBe('1471');
    expect(answer.document.issuedOn).toBe('29.10.1998');
    expect(answer.document.holderName).toBe('Qusadze Vera Vladimirovna');
    expect(answer.document.propertyAddress).toContain('Zabrat');
    expect(answer.document.plotArea).toBe('0,04 ha');
    expect(answer.document.decreeItem).toBe('2.7');
    expect(answer.document.archiveReference).toContain('130');
    // Still unnamed: competence is judged on it, and a body read off a sheet is
    // a reading and not the archive's record of whose fund the paper sits in.
    expect(answer.document.issuingAuthority).toBeNull();
  });

  /*
   * The six the customer named, `certificateValidity` among them. The panel is
   * preferred for the five that are words — it is what the inspector is looking
   * at — and the service, which abbreviates, fills what the panel leaves out.
   */
  it('reads the six signature lines off the panel, the service behind them', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signerName: 'Somebody Else',
        signatureDate: '2026-01-14T17:07:07.000+04:00',
        org: 'AZƏRBAYCAN RESPUBLİKASININ MİLLİ ARXİV İDARƏSİ',
        signatureValidity: true,
        contentUrl: 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF',
      }),
    );

    const answer = await anArchive(SIGNED_COPY).lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.signature).toEqual({
      signedBy: 'Məmmədov Anar',
      organisation: 'B.EST Certificate Services CA',
      unit: 'DÖVLƏT ARXİVİNİN BAKI FİLİALI',
      signedOn: '14.01.2026',
      certificateValidity: '14.01.2025 - 14.01.2027',
      valid: true,
    });
  });

  /*
   * A sheet that prints "İmza təsdiqləndi" is printing what it was told when it
   * was rendered; the service checked the signature just now. The cryptographic
   * answer outranks the printed claim wherever there is one.
   */
  it('lets the service and not the sheet say whether the signature verifies', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signatureValidity: false,
        contentUrl: 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF',
      }),
    );

    const answer = await anArchive(SIGNED_COPY).lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.signature?.valid).toBe(false);
    expect(answer.document.signature?.signedBy).toBe('Məmmədov Anar');
  });

  /*
   * The link is good for an hour and the file is somebody else's server. A copy
   * that cannot be fetched or read leaves the answer exactly as it was before
   * there was a copy to read — never a stage thrown over (ADR-0035).
   */
  it('degrades to the metadata alone where the signed copy cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signerName: 'Məmmədov Anar',
        signatureValidity: true,
        contentUrl: 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF',
      }),
    );

    const answer = await anArchive(null).lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.documentNo).toBeNull();
    expect(answer.document.signature?.signedBy).toBe('Məmmədov Anar');
    expect(answer.document.signature?.certificateValidity).toBeNull();
  });

  // The answer that carries `expiredDate` — its own web client renders one —
  // still fills the line where no panel was read.
  it('falls back to the validity the service states', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signatureValidity: true,
        expiredDate: '14.01.2027',
      }),
    );

    const answer = await anArchive().lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.signature?.certificateValidity).toBe('14.01.2027');
  });

  /*
   * The service answers 500 with a sentence — `Yanlış şifrələnmiş Case ID` —
   * for an id it cannot decrypt, which is what a forged or mistyped code gets.
   * That is an answer about the paper and not a service in trouble: it must
   * reach the inspector as "the archive knows nothing of this", not as a stage
   * that fell over.
   */
  it('reads a refusal to decrypt the id as the archive holding nothing', async () => {
    vi.stubGlobal('fetch', answering(500, 'Yanlış şifrələnmiş Case ID'));

    const answer = await anArchive().lookupByQr(LINK);

    expect(answer.outcome).toBe('NotFound');
    expect(answer.note).toContain('Yanlış şifrələnmiş Case ID');
  });

  // A 4xx is the caller being wrong about the contract, which is the one thing
  // that must not be quietly turned into a finding about somebody's paper.
  it('throws where the service refuses the request itself', async () => {
    vi.stubGlobal('fetch', answering(403, 'forbidden'));

    await expect(anArchive().lookupByQr(LINK)).rejects.toThrow(
      RegistryRefusedException,
    );
  });
});
