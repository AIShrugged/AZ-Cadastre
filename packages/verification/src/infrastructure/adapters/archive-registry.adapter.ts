import { Injectable } from '@nestjs/common';

import type {
  AddressesApi,
  AddressLookupRequest,
  AddressLookupResponse,
  ArchiveDocumentDto,
  ArchiveRecordDto,
} from '@cadastre/api-contracts/registry';

import { ArchiveRegistryPort } from '../../application/ports/outbound/index.js';

/*
 * The offline stand-in for the archive register.
 *
 * It is not the register's own records — those are in the register's own
 * database, put there by the seed in `apps/registry-stub` (ADR-0010). The three
 * here exist so the pipeline runs end to end with no register process, no
 * database and no network at all, which is what every other provider in this
 * context does when it is left on `mock`.
 *
 * It matches on a flattened string rather than on the address rules, and says
 * so in its note: an offline stand-in that quietly forgave the same spellings
 * as the real thing would be the real thing, badly.
 */
const HELD: readonly ArchiveRecordDto[] = [
  {
    registerNo: '1-12345',
    inventoryNo: 'İnv-4471',
    address:
      'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
    ownerName: 'Əliyeva Rübabə Kavı qızı',
    cadastralNumber: '40-12-345-67',
    plotArea: '600 m²',
    location: { folder: '14', pages: '01-dən 30' },
    documents: held(['Ərizə', 'Sərəncam çıxarışı', 'Arayış']),
  },
  /*
   * The property the offline extractor reads off its own demo papers, so a run
   * with every provider on `mock` shows the stage doing its work rather than
   * always reporting the property unconfirmed. Its values are that adapter's
   * values on purpose: MOCK_VALUES in field-extractor.adapter.ts.
   */
  {
    registerNo: '3-00219',
    inventoryNo: 'İnv-7731',
    address: 'Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43',
    ownerName: 'ELÇİN ƏLİYEV',
    cadastralNumber: 'AZ-CAD-1024-311',
    plotArea: '642 m²',
    location: { folder: '05', pages: '12-dən 38' },
    documents: held(['Ərizə', 'Sərəncam çıxarışı', 'Arayış']),
  },
  {
    registerNo: '2-00871',
    inventoryNo: 'İnv-1290',
    address: 'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Nəsimi küçəsi, ev 4',
    ownerName: 'Məmmədov Elçin Vaqif oğlu',
    cadastralNumber: '40-08-112-09',
    plotArea: '520,5 m²',
    location: { folder: '31', pages: '06-DƏK səh. 48' },
    // The one record whose file is short a paper, so the offline pipeline can
    // reach the outcome at all. The presence register of this settlement wrote
    // a minus against the decree extract.
    documents: [
      ...held(['Ərizə', 'Arayış']),
      {
        name: 'Sərəncam çıxarışı',
        holding: 'NotHeld',
        number: null,
        issuedOn: null,
        issuingAuthority: null,
        location: null,
      },
    ],
  },
];

/** Papers the archive has, with nothing said about them beyond that. */
function held(names: readonly string[]): ArchiveDocumentDto[] {
  return names.map(name => ({
    name,
    holding: 'Held' as const,
    number: null,
    issuedOn: null,
    issuingAuthority: null,
    location: null,
  }));
}

function flattened(raw: string): string {
  return raw
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]/gu, '')
    .normalize('NFC');
}

function recordedValue(record: ArchiveRecordDto, name: string): string | null {
  switch (name) {
    case 'ownerName':
      return record.ownerName;
    case 'cadastralNumber':
      return record.cadastralNumber;
    case 'plotArea':
      return record.plotArea;
    default:
      return null;
  }
}

class OfflineAddresses implements AddressesApi {
  async lookup(request: AddressLookupRequest): Promise<AddressLookupResponse> {
    const wanted = flattened(request.address);
    const record = HELD.find(held => flattened(held.address) === wanted);

    if (!record) {
      return {
        outcome: 'NotFound',
        canonicalAddress: null,
        record: null,
        candidates: 0,
        attributes: [],
        documents: [],
        note:
          'Answered offline, by the stand-in built into the context: it holds ' +
          'three records and compares addresses letter for letter.',
      };
    }

    return {
      outcome: 'Found',
      canonicalAddress: record.address,
      record,
      candidates: 1,
      attributes: request.attributes.map(attribute => {
        const recorded = recordedValue(record, attribute.name);

        return {
          name: attribute.name,
          match:
            recorded === null
              ? ('NotRecorded' as const)
              : flattened(recorded) === flattened(attribute.value)
                ? ('Matches' as const)
                : ('Differs' as const),
          submitted: attribute.value,
          recorded,
        };
      }),
      documents: request.documents.map(asked => {
        const paper = record.documents.find(one => one.name === asked.name);

        return {
          name: asked.name,
          type: asked.type,
          // A kind this record says nothing about is silence and not an
          // absence, the same as it is in the register itself.
          holding: paper?.holding ?? ('Unknown' as const),
          number: paper?.number ?? null,
          issuedOn: paper?.issuedOn ?? null,
          location: paper?.location ?? record.location,
        };
      }),
      note:
        `Answered offline by the stand-in built into the context, from ` +
        `register ${record.registerNo}.`,
    };
  }
}

@Injectable()
export class ArchiveRegistryAdapter extends ArchiveRegistryPort {
  override readonly addresses: AddressesApi = new OfflineAddresses();
}
