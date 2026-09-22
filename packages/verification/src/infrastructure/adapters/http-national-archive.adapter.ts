import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { Logger } from '@cadastre/logger';

import {
  NationalArchivePort,
  type ArchiveQrAnswer,
} from '../../application/ports/outbound/index.js';
import type { VerificationModuleOptions } from '../../verification.module-defs.js';
import {
  RegistryRefusedException,
  RegistryUnreachableException,
} from '../exceptions/index.js';

import { issuerOf, NATIONAL_ARCHIVE_HOST } from './national-archive.adapter.js';

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
 * `contentUrl` is read and deliberately dropped. It expires in an hour, and an
 * inspector opens a report long after the run that made it: a stored link that
 * is dead by the time anybody clicks it is worse than no link, because it looks
 * like the archive lost the file.
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

    return {
      outcome: 'Found',
      document: {
        /*
         * Eight nulls, and they are the truth: this service states nothing
         * about what the paper says. The domain reads a record that states
         * nothing and holds no signature as an empty shelf — so the one thing
         * that makes this answer worth anything is the block below it.
         */
        documentNo: null,
        issuedOn: null,
        /*
         * The service names the office that attested the copy, which is not the
         * body that issued the paper. Offering it here would have the archive's
         * own Baku branch judged on whether it could allot land in 1998, and it
         * would fail — so the body is left unnamed and competence unjudged. The
         * office is on the signature block below, where it belongs.
         */
        issuingAuthority: null,
        holderName: null,
        propertyAddress: null,
        plotArea: null,
        decreeItem: null,
        archiveReference: null,
        signature:
          answer.signatureValidity === null ||
          answer.signatureValidity === undefined
            ? null
            : {
                signedBy: answer.signerName ?? null,
                organisation: answer.org ?? null,
                unit: answer.unit ?? null,
                signedOn: answer.signatureDate ?? null,
                valid: answer.signatureValidity,
              },
      },
      note:
        `Answered by the National Archive Fund's electronic document service ` +
        `at ${base}.`,
    };
  }

  private async answer(url: string, caseId: string): Promise<Response> {
    const asked = new URL(url);
    asked.searchParams.set('id', caseId);

    try {
      return await fetch(asked, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.nationalArchive.timeoutMs),
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

// A refusal's body can be a whole error page; the report shows what it says,
// so it gets the sentence and not the page.
function firstLine(body: string): string {
  const [line = ''] = body.trim().split('\n');

  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}
