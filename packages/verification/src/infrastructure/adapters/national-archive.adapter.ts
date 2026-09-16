import { Injectable } from '@nestjs/common';

import {
  NationalArchivePort,
  type ArchivedDocument,
  type ArchiveQrAnswer,
} from '../../application/ports/outbound/index.js';

/*
 * The offline stand-in for the National Archive Fund.
 *
 * No archive is connected, and nothing is known yet about whether its QR links
 * can be followed by a server at all (TECH_DEBT §14). This holds the one paper
 * the repository has a real case for, so a run with every provider on `mock`
 * shows the check doing its work: the 1998 allotment order in Rusadze Vera
 * Vladimirovna's package, of which the archive's Baku branch sent certified
 * copies in January 2026 (`INPUTS/Example application and other document- Vera
 * Vladimirovna.pdf`, pp. 4–6).
 *
 * Its values are that copy's values, and the offline extractor reads the same
 * paper the same way on purpose: DECREE_439_VALUES in field-extractor.adapter.ts.
 * Any other reference is answered with nothing.
 */
const HELD: ReadonlyMap<string, ArchivedDocument> = new Map([
  [
    /*
     * Printed under the code on each certified copy. The token at the end of the
     * real link is not legible on the scan, so this one is ours; the host is
     * the archive's electronic document service the copies name.
     */
    'https://qr.esd.milliarxiv.gov.az/F130-S1-I476-V98',
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
    },
  ],
]);

@Injectable()
export class NationalArchiveAdapter extends NationalArchivePort {
  async lookupByQr(qrReference: string): Promise<ArchiveQrAnswer> {
    const document = HELD.get(qrReference.trim());

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
