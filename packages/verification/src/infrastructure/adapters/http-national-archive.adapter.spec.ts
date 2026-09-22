import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import type { VerificationModuleOptions } from '../../verification.module-defs.js';
import { RegistryRefusedException } from '../exceptions/index.js';

import { HttpNationalArchiveAdapter } from './http-national-archive.adapter.js';

const BASE = 'https://api.esd.milliarxiv.gov.az/signature-info/api';

// The link the archive's certified copies print, and the id inside it — which
// is percent-encoded in the path because it contains slashes, and which the
// service wants decoded.
const LINK =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'alOOwj1hz3AX0%2FB0KP3RmZS7GDmQTJZHJ%2F6traU%2FJ9Qxk2McOR3AWm2UQvsRSK5s';
const CASE_ID =
  'alOOwj1hz3AX0/B0KP3RmZS7GDmQTJZHJ/6traU/J9Qxk2McOR3AWm2UQvsRSK5s';

function anArchive(): HttpNationalArchiveAdapter {
  return new HttpNationalArchiveAdapter(
    {
      nationalArchive: { provider: 'http', url: BASE, timeoutMs: 1000 },
    } as VerificationModuleOptions,
    new SilentLogger(),
  );
}

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
