import { Inject, Injectable } from '@nestjs/common';

import type {
  AddressesApi,
  AddressLookupRequest,
  AddressLookupResponse,
  ArchiveRecordDto,
  CheckedAttributeDto,
} from '@cadastre/api-contracts/registry';
import { Logger } from '@cadastre/logger';
import {
  areasAgree,
  fold,
  namesAgree,
  normaliseAddress,
  referencesAgree,
} from '@cadastre/matching-engine';

import { RegistrySource } from './ports/index.js';

// What counts as agreement for each thing the register knows a property by.
// Every one of them is a rule, and every rule lives in the engine: the same
// source has to answer here and in whatever replaces this service, or the two
// cannot be compared.
const AGREES: ReadonlyMap<
  string,
  (submitted: string, recorded: string) => boolean
> = new Map([
  ['ownerName', namesAgree],
  ['plotArea', areasAgree],
  ['cadastralNumber', referencesAgree],
  ['registerNo', referencesAgree],
  ['inventoryNo', referencesAgree],
]);

function recordedValue(record: ArchiveRecordDto, name: string): string | null {
  switch (name) {
    case 'ownerName':
      return record.ownerName;
    case 'cadastralNumber':
      return record.cadastralNumber;
    case 'plotArea':
      return record.plotArea;
    case 'registerNo':
      return record.registerNo;
    case 'inventoryNo':
      return record.inventoryNo;
    // A name the register does not know is not a disagreement. It is the same
    // silence as a column an area's register never carried.
    default:
      return null;
  }
}

/**
 * Answers what the register holds, and stops there.
 *
 * There is no verdict in here. Whether an absent record, an owner who does not
 * match or an address two records answer to means anything for a submission is
 * a rule of the caller's profile — the register would have to know what is
 * being registered to have an opinion, and it does not (ADR-0009).
 */
@Injectable()
export class AddressesService implements AddressesApi {
  private readonly logger: Logger;

  constructor(
    @Inject(Logger) logger: Logger,
    @Inject(RegistrySource) private readonly source: RegistrySource,
  ) {
    this.logger = logger.child({ scope: AddressesService.name });
  }

  async lookup(request: AddressLookupRequest): Promise<AddressLookupResponse> {
    const candidates = await this.source.findByAddress(request.address);
    const answer = await this.answerFor(request, candidates);

    // The address itself is never written to the log — it is somebody's
    // property. What the lookup did with it is (ADR-0008).
    this.logger.log('Address looked up', {
      outcome: answer.outcome,
      candidates: answer.candidates,
      attributes: answer.attributes.map(attribute => ({
        name: attribute.name,
        match: attribute.match,
      })),
    });

    return answer;
  }

  private async answerFor(
    request: AddressLookupRequest,
    candidates: readonly ArchiveRecordDto[],
  ): Promise<AddressLookupResponse> {
    const [record] = candidates;

    if (!record) {
      return {
        outcome: 'NotFound',
        canonicalAddress: null,
        record: null,
        candidates: 0,
        attributes: [],
        note:
          `No record of this address among the ${await this.source.size()} the ` +
          `register holds. Its coverage is partial and historical.`,
      };
    }

    if (candidates.length > 1) {
      return {
        outcome: 'Ambiguous',
        canonicalAddress: null,
        record: null,
        candidates: candidates.length,
        attributes: [],
        note:
          `${candidates.length} records answer to this address ` +
          `(${candidates.map(one => one.registerNo).join(', ')}); the register ` +
          `cannot say which one is meant.`,
      };
    }

    const attributes = request.attributes.map(attribute =>
      AddressesService.hold(attribute.name, attribute.value, record),
    );
    const differing = attributes.filter(
      attribute => attribute.match === 'Differs',
    ).length;

    return {
      outcome: 'Found',
      canonicalAddress: normaliseAddress(record.address),
      record,
      candidates: 1,
      attributes,
      note:
        `Register ${record.registerNo} holds this address. ` +
        (attributes.length === 0
          ? 'Nothing else was supplied to hold against it.'
          : `${differing} of ${attributes.length} supplied attributes differ from the record.`),
    };
  }

  private static hold(
    name: string,
    submitted: string,
    record: ArchiveRecordDto,
  ): CheckedAttributeDto {
    const recorded = recordedValue(record, name);

    if (recorded === null) {
      return { name, match: 'NotRecorded', submitted, recorded: null };
    }

    const agrees =
      AGREES.get(name) ?? ((left, right) => fold(left) === fold(right));

    return {
      name,
      match: agrees(submitted, recorded) ? 'Matches' : 'Differs',
      submitted,
      recorded,
    };
  }
}
