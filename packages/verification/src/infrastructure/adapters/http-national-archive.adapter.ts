import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { Logger } from '@cadastre/logger';

import {
  NationalArchivePort,
  type ArchivedDocument,
  type ArchivedSignature,
  type ArchiveQrAnswer,
} from '../../application/ports/outbound/index.js';
import type { VerificationModuleOptions } from '../../verification.module-defs.js';
import {
  RegistryRefusedException,
  RegistryUnreachableException,
} from '../exceptions/index.js';

import { issuerOf, NATIONAL_ARCHIVE_HOST } from './national-archive.adapter.js';
import { fetchFromTheArchive } from './national-archive.transport.js';
import type { SignedPdfDigitiser } from './signed-pdf.digitiser.js';
import { readSignedSheet } from './signed-sheet.reading.js';

const VERIFY_QR = '/v1/signature-info/verifyQr';

/*
 * What the archive's electronic document service answers about one code
 * (ADR-0034).
 *
 * It is a signature service and not a holdings service. Asked on 2026-09-22
 * about the code on the archive's certificate in the Hümbətov package, it
 * answered:
 *
 *     signerName        the director who signed it, by name
 *     signatureDate     2026-01-14T17:07:07.000+04:00
 *     signatureValidity true
 *     org               AZƏRBAYCAN RESPUBLİKASININ MİLLİ ARXİV İDARƏSİ
 *     unit              … / DÖVLƏT ARXİVİNİN BAKI FİLİALI DİREKTOR
 *     contentUrl        a presigned link to the signed PDF, good for an hour
 *
 * — and nothing about what the paper says: no document number, no holder, no
 * address. So the eight lines of ADR-0028's comparison come back empty from it
 * and the answer is about the sheet instead.
 *
 * `contentUrl` is the «Sənədi yüklə» download — the archive's own signed copy of
 * the paper — and it is followed inside this call, while the link is still live
 * (ADR-0035). It is never stored: it expires in an hour, and an inspector opens
 * a report long after the run that made it, so a saved link that is dead by the
 * time anybody clicks it is worse than no link, because it looks like the
 * archive lost the file. What is kept is what the file said.
 *
 * Every field is optional and the object is loose on purpose. The shape is the
 * service's and not a published contract — `expiredDate`, which its own web
 * client renders, was absent from that answer altogether. A field that changes
 * name must leave the rest usable, because `signatureValidity` alone is worth
 * more than the whole of the rest.
 */
const VerifyQrAnswerSchema = z.looseObject({
  signerName: z.string().nullish(),
  signatureDate: z.string().nullish(),
  org: z.string().nullish(),
  unit: z.string().nullish(),
  signatureValidity: z.boolean().nullish(),
  // The «Sənədi yüklə» download: a presigned link to the signed PDF, good for
  // an hour (ADR-0035).
  contentUrl: z.string().nullish(),
  /*
   * What the service's own web client renders as the certificate's validity,
   * where the answer carries it at all — it was absent from the one real answer
   * this adapter was written against, which is why the sheet is the first
   * source for the line and this is only the fallback.
   */
  expiredDate: z.string().nullish(),
});

/**
 * The National Archive Fund's electronic document service, over HTTP.
 *
 * The reference a paper carries is a link into the service's own web page —
 * `https://qr.esd.milliarxiv.gov.az/info/<id>` — and the page asks its API for
 * the record. This asks the same API the same way, with the same id: the last
 * segment of the path, which is an encrypted case id and is passed through
 * exactly as it was decoded off the symbol.
 *
 * A reference the archive does not issue is never sent anywhere. That is not
 * only tidiness: a package carries codes from the register and from notaries,
 * and posting one service's identifiers to another service would tell it about
 * papers it has no business knowing of.
 */
@Injectable()
export class HttpNationalArchiveAdapter extends NationalArchivePort {
  constructor(
    private readonly options: VerificationModuleOptions,
    private readonly logger: Logger,
    // The reader of the signed PDF the code's link serves (ADR-0035). Optional
    // so a deployment — or a spec — can ask the service and nothing else, in
    // which case the answer is the metadata alone, as it was before ADR-0035.
    private readonly signedPdf?: SignedPdfDigitiser,
  ) {
    super();
  }

  async lookupByQr(qrReference: string): Promise<ArchiveQrAnswer> {
    const reference = qrReference.trim();
    const issuer = issuerOf(reference);

    if (issuer !== NATIONAL_ARCHIVE_HOST) {
      return {
        outcome: 'NotRecognised',
        issuer,
        note:
          'Not asked: this reference is not one the National Archive Fund ' +
          `issues (${issuer ?? 'the payload is not a link'}).`,
      };
    }

    const caseId = caseIdIn(reference);

    if (caseId === null) {
      return {
        outcome: 'NotRecognised',
        issuer,
        note:
          'Not asked: the reference is a link to the archive but carries no ' +
          'case id to ask by.',
      };
    }

    const base = this.options.nationalArchive.url.replace(/\/$/u, '');

    try {
      return await this.askAbout(base, caseId);
    } catch (error) {
      /*
       * The service was asked and did not answer (ADR-0037).
       *
       * Told to the caller and not thrown, because a stage that throws here
       * leaves the paper with no line of its own — and a check that is absent
       * reads as a check that does not apply, so an archive that is down looks
       * like a feature nobody built (COMM-144).
       *
       * The wire and nothing else. A refusal still throws: a 4xx is this
       * system being wrong about the contract, and a deployment bug that shows
       * up on the report as "the archive did not answer" is a deployment bug
       * nobody goes looking for.
       */
      if (!(error instanceof RegistryUnreachableException)) throw error;

      this.logger.warn('The archive service could not be reached', {
        url: `${base}${VERIFY_QR}`,
        error,
      });

      return {
        outcome: 'Unreachable',
        issuer,
        note:
          `The National Archive Fund's electronic document service at ` +
          `${base} could not be asked: ${error.message}`,
      };
    }
  }

  private async askAbout(
    base: string,
    caseId: string,
  ): Promise<ArchiveQrAnswer> {
    const url = `${base}${VERIFY_QR}`;
    const startedAt = Date.now();
    const response = await this.answer(url, caseId);
    const body = await response.text();

    /*
     * The service answers 500 with a sentence — `Yanlış şifrələnmiş Case ID`,
     * the id is not one it can decrypt — for a reference it does not hold. That
     * is an answer about the paper and not a service in trouble, so it is
     * `NotFound` and not a refusal: a forged or mistyped code must reach the
     * inspector as "the archive knows nothing of this", not as a stage that
     * fell over.
     */
    if (response.status >= 500) {
      this.logger.debug('The archive service would not resolve a reference', {
        url,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });

      return {
        outcome: 'NotFound',
        note:
          `The National Archive Fund's electronic document service answered ` +
          `${response.status} for this reference: ${firstLine(body)}`,
      };
    }

    if (!response.ok) {
      throw new RegistryRefusedException(url, response.status, body);
    }

    const answer = VerifyQrAnswerSchema.parse(JSON.parse(body));

    this.logger.debug('The archive service answered', {
      url,
      // Whether it verified, never who signed it: the signer is a named person
      // off somebody's papers (ADR-0008).
      signatureValid: answer.signatureValidity ?? null,
      durationMs: Date.now() - startedAt,
    });

    const metadata = signatureOf(answer);
    const sheet = answer.contentUrl
      ? await this.signedPdf?.digitise(
          answer.contentUrl,
          this.options.nationalArchive.timeoutMs,
        )
      : null;
    const read = sheet ? readSignedSheet(sheet.text) : null;

    return {
      outcome: 'Found',
      document: read
        ? {
            /*
             * The archive's own copy of the paper, as its signed PDF states it
             * (ADR-0035).
             *
             * The lines come off the file the code leads to and not off the
             * `verifyQr` answer, which states nothing about what the paper says.
             * The issuing body stays unnamed even when the sheet prints one: it
             * is what competence is judged on, and a name read off a scan is a
             * reading, not the archive's record of whose fund the paper sits in
             * — offering it would have the check answer "no power" on a
             * misread word (ADR-0034).
             */
            documentNo: read.lines.document_no,
            issuedOn: read.lines.issue_date,
            issuingAuthority: null,
            holderName: read.lines.holder_name,
            propertyAddress: read.lines.property_address,
            plotArea: read.lines.plot_area,
            decreeItem: read.lines.decree_item,
            archiveReference: read.lines.archive_reference,
            signature: merged(metadata, read.signature),
          }
        : emptyExcept(metadata),
      note:
        `Answered by the National Archive Fund's electronic document service ` +
        `at ${base}` +
        (sheet
          ? `, and its signed copy read ${
              sheet.how === 'TextLayer' ? 'from its text' : 'by OCR'
            }.`
          : '.'),
    };
  }

  private async answer(url: string, caseId: string): Promise<Response> {
    const asked = new URL(url);
    asked.searchParams.set('id', caseId);

    try {
      // Over IPv4 and with one retry: the archive's zone does not answer an
      // AAAA question at all, and a resolution that asks for both families
      // dies on the resolver's timeout (COMM-144).
      return await fetchFromTheArchive(asked, {
        headers: { accept: 'application/json' },
        timeoutMs: this.options.nationalArchive.timeoutMs,
        logger: this.logger,
      });
    } catch (error) {
      throw new RegistryUnreachableException(url, error);
    }
  }
}

/*
 * The case id the service is asked by: everything after `/info/` in the link.
 *
 * Decoded once, because it arrives percent-encoded in the link and the service
 * wants the id itself — the page the link opens does exactly this, and the id
 * contains `/`, which is why it was encoded in the first place.
 */
function caseIdIn(reference: string): string | null {
  const path = new URL(reference).pathname;
  const [, section, ...rest] = path.split('/');

  if (section !== 'info' || rest.length === 0) return null;

  const raw = rest.join('/');

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/*
 * What the service itself said about the signature, which is all it says about
 * a sheet it holds no contents for.
 *
 * Null where it does not verify signatures at all: a block of four nulls and a
 * `valid` nobody asserted would read as a service that looked and found nothing
 * wrong (ADR-0034).
 */
function signatureOf(answer: {
  signerName?: string | null;
  signatureDate?: string | null;
  org?: string | null;
  unit?: string | null;
  signatureValidity?: boolean | null;
  expiredDate?: string | null;
}): ArchivedSignature | null {
  if (
    answer.signatureValidity === null ||
    answer.signatureValidity === undefined
  ) {
    return null;
  }

  return {
    signedBy: answer.signerName ?? null,
    organisation: answer.org ?? null,
    unit: answer.unit ?? null,
    signedOn: answer.signatureDate ?? null,
    certificateValidity: answer.expiredDate ?? null,
    valid: answer.signatureValidity,
  };
}

/*
 * The six lines of the signature panel, the sheet first and the service behind
 * it (ADR-0035).
 *
 * The sheet is preferred for the five that are words: it is the panel the
 * inspector is looking at, and the service abbreviates. `valid` is the other way
 * round — the service computed it by checking the signature, and the sheet only
 * prints what it was told at the time it was rendered, so a cryptographic answer
 * outranks a printed claim wherever there is one.
 */
function merged(
  metadata: ArchivedSignature | null,
  sheet: ReturnType<typeof readSignedSheet>['signature'],
): ArchivedSignature | null {
  const valid = metadata?.valid ?? sheet.valid;

  // Neither side said whether it verifies, so neither said anything about the
  // sheet at all.
  if (valid === null || valid === undefined) return null;

  return {
    signedBy: sheet.signedBy ?? metadata?.signedBy ?? null,
    organisation: sheet.organisation ?? metadata?.organisation ?? null,
    unit: sheet.unit ?? metadata?.unit ?? null,
    signedOn: sheet.signedOn ?? metadata?.signedOn ?? null,
    certificateValidity:
      sheet.certificateValidity ?? metadata?.certificateValidity ?? null,
    valid,
  };
}

/*
 * Eight nulls, and they are the truth: asked and answered, with nothing read
 * off the signed copy — no link, no digitiser wired in, or a file that could
 * not be fetched or read (ADR-0035). The domain reads a record that states
 * nothing and holds no signature as an empty shelf, so the signature block is
 * the whole of what this answer is worth.
 */
function emptyExcept(signature: ArchivedSignature | null): ArchivedDocument {
  return {
    documentNo: null,
    issuedOn: null,
    /*
     * The service names the office that attested the copy, which is not the
     * body that issued the paper. Offering it here would have the archive's own
     * Baku branch judged on whether it could allot land in 1998, and it would
     * fail — so the body is left unnamed and competence unjudged. The office is
     * on the signature block, where it belongs.
     */
    issuingAuthority: null,
    holderName: null,
    propertyAddress: null,
    plotArea: null,
    decreeItem: null,
    archiveReference: null,
    signature,
  };
}

// A refusal's body can be a whole error page; the report shows what it says,
// so it gets the sentence and not the page.
function firstLine(body: string): string {
  const [line = ''] = body.trim().split('\n');

  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}
