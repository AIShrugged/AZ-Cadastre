import { Injectable } from '@nestjs/common';

import {
  NationalArchivePort,
  type ArchivedDocument,
  type ArchiveQrAnswer,
} from '../../application/ports/outbound/index.js';

/*
 * The offline stand-in for the National Archive Fund.
 *
 * It holds the one paper the repository has a real case for, so a run with
 * every provider on `mock` shows the check doing its work: the 1998 allotment
 * order in Rusadze Vera Vladimirovna's package, of which the archive's Baku
 * branch sent certified copies in January 2026 (`INPUTS/Example application and
 * other document- Vera Vladimirovna.pdf`, pp. 4–6).
 *
 * Its values are that copy's values, and the offline extractor reads the same
 * paper the same way on purpose: DECREE_439_VALUES in field-extractor.adapter.ts.
 * Any other reference is answered with nothing.
 */
const HELD: ReadonlyMap<string, ArchivedDocument> = new Map([
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
            `built into the context: it holds ${HELD.size} paper and nothing ` +
            'under this reference.',
        };
  }
}
