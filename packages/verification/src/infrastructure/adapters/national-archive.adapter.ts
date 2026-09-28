import { Injectable } from '@nestjs/common';

import {
  NationalArchivePort,
  type ArchivedDocument,
  type ArchiveQrAnswer,
} from '../../application/ports/outbound/index.js';

/*
 * The offline stand-in for the National Archive Fund.
 *
 * Three papers, and a run with every provider on `mock` needs all three. The
 * first two are the demo package's own: the extract from the disposal order and
 * the archival certificate, the two types whose code is resolved (ADR-0049), so
 * they are the ones a mocked run actually asks about. Their values are the
 * offline extractor's values on purpose: MOCK_VALUES and
 * ARCHIVE_CERTIFICATE_VALUES in field-extractor.adapter.ts.
 *
 * The third is the paper the repository has a real case for: the 1998
 * allotment order in Rusadze Vera Vladimirovna's package, of which the
 * archive's Baku branch sent certified copies in January 2026
 * (`INPUTS/Example application and other document- Vera Vladimirovna.pdf`,
 * pp. 4–6). Nothing asks about it since ADR-0035 — a homestead allotment
 * decision is neither of the two — and it stays because it is the real shape of
 * an archive's entry and what `rusadze-order.spec.ts` holds the three offline
 * providers together on.
 *
 * Any other reference is answered with nothing.
 */

/*
 * The codes the demo's two papers print, as the decoder reads them off the
 * symbol. Said again in the integration set, where there is no image behind a
 * storage key to decode one from.
 */
const DEMO_DISPOSAL_ORDER_QR =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'R6jQk0hVvCmXpZ2sL8nT4wB1yE7uA3dF%2FQ5oN9rI6cS0gM%2BjH8kP4xW2vY7zD1b';

const DEMO_ARCHIVE_CERTIFICATE_QR =
  'https://qr.esd.milliarxiv.gov.az/info/' +
  'T4mHc7ePwXsQ9nZ1kR5bV8yL2dJ6uG3aF%2FW0oB7rN4tS1gM%2BhK9xC5vY8zD3q';

const HELD: ReadonlyMap<string, ArchivedDocument> = new Map([
  [
    DEMO_DISPOSAL_ORDER_QR,
    {
      documentNo: 'R-1147',
      // As an archive database states a date, against the paper's 12.02.2021.
      issuedOn: '2021-02-12',
      /*
       * Named and typed, and the check still judges no competence by it: the
       * Decree's table says nothing about a disposal order, so there is no rule
       * to apply and `issuingAuthorityCompetent` is null (ADR-0034).
       */
      issuingAuthority: {
        name: 'Bakı Şəhər İcra Hakimiyyəti',
        kind: 'LocalExecutiveAuthority',
      },
      holderName: 'ELÇİN ƏLİYEV',
      propertyAddress: 'Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43',
      plotArea: '642 m²',
      // Neither is a line an extract from a disposal order prints, and the
      // archive's entry for one carries neither.
      decreeItem: null,
      archiveReference: null,
      // The stand-in holds records and verifies nothing (ADR-0034), and it
      // serves no signed PDF for the digitiser to read a panel off (ADR-0035).
      signature: null,
      /*
       * A holdings stand-in supplies every line, including the issuing body it
       * files the paper under, so there is nothing it declines to be compared
       * on (ADR-0040). This is what the empty set is for: `NotCompared` is a
       * property of who answered, not of the line.
       */
      notCompared: [],
      // A stand-in holds its records in memory: there is no copy to fetch and
      // so no copy that could go unread (COMM-151).
      copyUnread: null,
    },
  ],
  [
    DEMO_ARCHIVE_CERTIFICATE_QR,
    {
      // Printed as `certificate_no` on the paper, which is the archive's
      // `document_no` under the certificate's own vocabulary (ADR-0049).
      documentNo: 'ARX-2025-0417',
      // As an archive database states a date, against the paper's 12.02.2021.
      issuedOn: '2021-02-12',
      /*
       * The archive itself, which is the whole worth of a certificate: it is an
       * extract the archive made of a book it keeps and not an act of the body
       * that kept the book. Competence is still unjudged — the Decree's table
       * says nothing about an archival certificate, so `issuingAuthorityCompetent`
       * is null (ADR-0034).
       */
      issuingAuthority: {
        name: 'Bakı Şəhər Dövlət Arxivi',
        kind: 'NationalArchive',
      },
      // The `owner_name` the certificate prints.
      holderName: 'ELÇİN ƏLİYEV',
      propertyAddress: 'Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43',
      /*
       * The three lines a certificate does not print at all, and the archive's
       * entry for one carries none of them either: it reports what is on record
       * about the plot, not the act that allotted it. They reach the inspector
       * as `NotStated` on both sides, which is what they are.
       */
      plotArea: null,
      decreeItem: null,
      archiveReference: null,
      // The stand-in holds records and verifies nothing (ADR-0034), and it
      // serves no signed PDF for the digitiser to read a panel off (ADR-0035).
      signature: null,
      // A holdings stand-in supplies every line, the issuing body included, so
      // there is nothing it declines to be compared on (ADR-0040).
      notCompared: [],
      // A stand-in holds its records in memory: there is no copy to fetch and
      // so no copy that could go unread (COMM-151).
      copyUnread: null,
    },
  ],
  [
    /*
     * The code printed on sheet 6 of that package, as the decoder reads it off
     * the symbol (ADR-0034).
     *
     * Until then this key was one of ours: the token is not legible as text on
     * the scan, so nothing could be held against the reference the paper
     * actually carries. A stand-in keyed by a reference no paper prints answers
     * every real package with `NotFound`, which is exactly what it did.
     */
    'https://qr.esd.milliarxiv.gov.az/info/' +
      'ZJvhzrotBTaKufxeEAVCshnMir5G0fjuTBO%2FsM8MvnHWubgPkFzZVz2M9%2F5D7xEU',
    {
      documentNo: '1471',
      issuedOn: '29.10.1998',
      issuingAuthority: {
        name: 'Bakı şəhəri Sabunçu Rayon İcra Hakimiyyəti',
        kind: 'LocalExecutiveAuthority',
      },
      // As the 1998 order spells it. Order 396 of 02.12.2021 corrected the
      // surname to Rusadze, and the archive's copy of the 1998 order is still
      // the 1998 order: agreeing with it confirms the paper, not the spelling.
      holderName: 'Qusadze Vera Vladimirovna',
      propertyAddress:
        'Bakı şəhəri, Sabunçu rayonu, 1-ci Zabrat qəsəbəsindən yeni ' +
        'məhəlləyə gedən yolun solunda',
      // In the hectares an archive database states a plot in; the order says
      // 400,0 kv.m, which is the same plot.
      plotArea: '0,04 ha',
      decreeItem: '2.7',
      archiveReference: 'Fond 130, siyahı 1, iş 476, vərəq 98',
      // The stand-in holds records and verifies nothing: a signature block here
      // would be a claim about a sheet nobody looked at (ADR-0034).
      signature: null,
      // Every line is on the record here, the issuing body included (ADR-0040).
      notCompared: [],
      // A stand-in holds its records in memory: there is no copy to fetch and
      // so no copy that could go unread (COMM-151).
      copyUnread: null,
    },
  ],
]);

/*
 * The host the archive's electronic document service answers on, as the codes
 * on its certified copies name it. A reference pointing anywhere else was
 * issued by somebody else — the register's own e-emlak, a notary's
 * notariat.az — and the archive has no business answering about it (ADR-0034).
 */
export const NATIONAL_ARCHIVE_HOST = 'qr.esd.milliarxiv.gov.az';

/**
 * Whoever the reference names, as a person would read it off the paper.
 *
 * A code is not always a link — one of the two packages in `INPUTS/` carries a
 * code whose whole payload is a document number — so a payload that is not a
 * URL has no issuer to name, and the report says so rather than guessing one.
 */
export function issuerOf(qrReference: string): string | null {
  try {
    return new URL(qrReference).host;
  } catch {
    return null;
  }
}

@Injectable()
export class NationalArchiveAdapter extends NationalArchivePort {
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

    const document = HELD.get(reference);

    return document
      ? {
          outcome: 'Found',
          document,
          note:
            'Answered offline, by the stand-in for the National Archive Fund ' +
            'built into the context.',
        }
      : {
          outcome: 'NotFound',
          note:
            'Answered offline, by the stand-in for the National Archive Fund ' +
            `built into the context: it holds ${HELD.size} papers and ` +
            'nothing under this reference.',
        };
  }
}
