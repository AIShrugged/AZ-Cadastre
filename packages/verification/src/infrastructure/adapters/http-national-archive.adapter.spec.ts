import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import {
  ARCHIVE_QR_FIELDS,
  Confidence,
  PageNumber,
  RecognisedText,
  type ArchiveQrField,
} from '../../domain/value-objects/index.js';
import type { VerificationModuleOptions } from '../../verification.module-defs.js';
import { RegistryRefusedException } from '../exceptions/index.js';

import { HttpNationalArchiveAdapter } from './http-national-archive.adapter.js';
import type { SignedPdfDigitiser } from './signed-pdf.digitiser.js';
import type { SignedSheetReader } from './signed-sheet.reader.js';

const BASE = 'https://api.esd.milliarxiv.gov.az/signature-info/api';

// The link the archive's certified copies print, and the id inside it — which
// is percent-encoded in the path because it contains slashes, and which the
// service wants decoded.
const LINK =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'alOOwj1hz3AX0%2FB0KP3RmZS7GDmQTJZHJ%2F6traU%2FJ9Qxk2McOR3AWm2UQvsRSK5s';
const CASE_ID =
  'alOOwj1hz3AX0/B0KP3RmZS7GDmQTJZHJ/6traU/J9Qxk2McOR3AWm2UQvsRSK5s';

/*
 * Stand-ins for the two readers of the signed PDF: what matters here is what
 * the adapter does with what they answer, not how a file became text or how a
 * model read the eight lines off it.
 */
function anArchive(
  reading?: string | null,
  lines: Partial<Record<ArchiveQrField, string | null>> = {},
): HttpNationalArchiveAdapter {
  const digitiser =
    reading === undefined
      ? undefined
      : ({
          digitise: async () =>
            reading === null
              ? { unread: 'LinkRefused' }
              : {
                  read: {
                    text: reading,
                    sheets: [
                      {
                        number: PageNumber.first(),
                        image: null,
                        text: RecognisedText.of(reading),
                        read: Confidence.of(1),
                      },
                    ],
                    how: 'TextLayer' as const,
                    pages: 1,
                  },
                },
        } as unknown as SignedPdfDigitiser);

  const sheetReader = {
    read: async () => ({
      lines: Object.fromEntries(
        ARCHIVE_QR_FIELDS.map(field => [field, lines[field] ?? null]),
      ),
    }),
  } as unknown as SignedSheetReader;

  return new HttpNationalArchiveAdapter(
    {
      nationalArchive: { provider: 'http', url: BASE, timeoutMs: 1000 },
    } as VerificationModuleOptions,
    new SilentLogger(),
    digitiser,
    sheetReader,
  );
}

/*
 * The archive's signed copy of an allotment order, as its text layer reads —
 * the paper above and the signature panel the service renders beneath it.
 *
 * The paper's own lines are not in it: they are read by the extraction stage
 * now and reach this adapter through `SignedSheetReader`, not off the text
 * (COMM-145). What the text is still good for is the panel.
 */
const SIGNED_COPY = [
  'AZƏRBAYCAN RESPUBLİKASI MİLLİ ARXİV İDARƏSİ',
  'Arxiv çıxarışı',
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
    // and competence is judged on the second (ADR-0034). The service supplies
    // no issuing body at all, and says so (ADR-0040).
    expect(answer.document.issuingAuthority).toBeNull();
    expect(answer.document.notCompared).toEqual(['issuing_authority']);
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

    const answer = await anArchive(SIGNED_COPY, {
      document_no: '1471',
      issue_date: '29.10.1998',
      holder_name: 'Qusadze Vera Vladimirovna',
      property_address: 'Bakı şəhəri, Sabunçu rayonu, 1-ci Zabrat qəsəbəsi',
      plot_area: '0,04 ha',
      decree_item: '2.7',
      archive_reference: 'Fond 130, siyahı 1, iş 476, vərəq 98',
    }).lookupByQr(LINK);

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
    // And said to be unnamed on purpose, so the check reports a line nobody
    // asked about rather than the archive being silent on it (ADR-0040,
    // COMM-148).
    expect(answer.document.notCompared).toEqual(['issuing_authority']);
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

  /*
   * And it says which of the four steps produced the nothing (COMM-151).
   *
   * Eight nulls are ambiguous: they are what a copy that prints none of the
   * eight looks like and also what a copy nobody could open looks like. The
   * customer's package showed the first reading of a report that meant the
   * second, and there was nothing on the stand to tell them apart.
   */
  it('names the step that could not read the copy', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signatureValidity: true,
        contentUrl: 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF',
      }),
    );

    const answer = await anArchive(null).lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.copyUnread).toBe('LinkRefused');
    expect(answer.note).toContain('LinkRefused');
  });

  // An answer with no link on it is the first of the four and the cheapest to
  // rule out, so it has to be the first thing the log says.
  it('names an answer that carried no link to a copy', async () => {
    vi.stubGlobal('fetch', answering(200, { signatureValidity: true }));

    const answer = await anArchive(SIGNED_COPY).lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.copyUnread).toBe('NoLink');
  });

  /*
   * A deployment with no reader wired in reads no copy, and from the report's
   * side that is indistinguishable from an archive printing nothing — so it is
   * named too, and named as ours (COMM-151).
   */
  it('names a deployment that wired in no reader at all', async () => {
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
    expect(answer.document.copyUnread).toBe('NoDigitiser');
  });

  // A copy that was read says so, and the nulls among its lines then mean what
  // they say: the copy does not print them.
  it('leaves the copy unnamed where it was read', async () => {
    vi.stubGlobal(
      'fetch',
      answering(200, {
        signatureValidity: true,
        contentUrl: 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF',
      }),
    );

    const answer = await anArchive(SIGNED_COPY, {
      document_no: '1471',
    }).lookupByQr(LINK);

    expect(answer.outcome).toBe('Found');
    if (answer.outcome !== 'Found') return;
    expect(answer.document.copyUnread).toBeNull();
    expect(answer.document.documentNo).toBe('1471');
    expect(answer.document.decreeItem).toBeNull();
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

  /*
   * The failure the check actually died of: the archive's zone answers no AAAA
   * question, the resolver gives up on it, and `fetch` reports an errno
   * (COMM-144). It reaches the stage as an outcome and not as a throw, so the
   * paper gets a line saying it was asked about and nobody answered — a check
   * left unmade is invisible on the page, and an integration that is down
   * looked exactly like a feature that was never built (ADR-0037).
   */
  it('answers that the service could not be reached rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.reject(
          new TypeError('fetch failed', {
            cause: Object.assign(new Error('getaddrinfo EAI_AGAIN'), {
              code: 'EAI_AGAIN',
            }),
          }),
        ),
      ),
    );

    const answer = await anArchive().lookupByQr(LINK);

    expect(answer.outcome).toBe('Unreachable');
    expect(answer.note).toContain('could not be asked');
  });

  // The wire failing is worth a second attempt — it is one request per package
  // and the alternative is a paper silently unchecked (ADR-0037).
  it('asks the service twice before giving it up', async () => {
    const failing = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError('fetch failed', {
        cause: Object.assign(new Error('getaddrinfo EAI_AGAIN'), {
          code: 'EAI_AGAIN',
        }),
      }),
    );
    vi.stubGlobal('fetch', failing);

    await anArchive().lookupByQr(LINK);

    expect(failing).toHaveBeenCalledTimes(2);
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
