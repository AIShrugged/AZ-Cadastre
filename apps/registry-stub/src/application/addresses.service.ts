import { Inject, Injectable } from '@nestjs/common';

import type {
  AddressesApi,
  AddressLookupRequest,
  AddressLookupResponse,
  ArchiveRecordDto,
  CheckedAttributeDto,
  CheckedDocumentDto,
  SubmittedDocument,
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
 * match, an address two records answer to or a paper the archive never filed
 * means anything for a submission is a rule of the caller's profile — the
 * register would have to know what is being registered to have an opinion, and
 * it does not (ADR-0009).
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
      documents: answer.documents.map(document => ({
        name: document.name,
        holding: document.holding,
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
        documents: [],
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
        documents: [],
        note:
          `${candidates.length} records answer to this address ` +
          `(${candidates.map(one => one.registerNo).join(', ')}); the register ` +
          `cannot say which one is meant.`,
      };
    }

    const attributes = request.attributes.map(attribute =>
      AddressesService.hold(attribute.name, attribute.value, record),
    );
    const documents = request.documents.map(document =>
      AddressesService.holds(document, record),
    );
    const differing = attributes.filter(
      attribute => attribute.match === 'Differs',
    ).length;
    const unheld = documents.filter(
      document => document.holding === 'NotHeld',
    ).length;

    return {
      outcome: 'Found',
      canonicalAddress: normaliseAddress(record.address),
      record,
      candidates: 1,
      attributes,
      documents,
      note:
        `Register ${record.registerNo} holds this address. ` +
        (attributes.length === 0
          ? 'Nothing else was supplied to hold against it.'
          : `${differing} of ${attributes.length} supplied attributes differ from the record.`) +
        (documents.length === 0
          ? ''
          : ` Of ${documents.length} papers asked about, the archive does not hold ${unheld}.`),
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

  /**
   * Whether the archive holds this kind of paper for the property.
   *
   * A kind the record says nothing about comes back `Unknown` and never
   * `NotHeld`: the presence registers are kept per settlement and their columns
   * differ, so a column that area never kept is silence. Only a register that
   * wrote `-` against the paper says it is not there.
   */
  private static holds(
    asked: SubmittedDocument,
    record: ArchiveRecordDto,
  ): CheckedDocumentDto {
    const held = record.documents.find(
      document => fold(document.name) === fold(asked.name),
    );

    return {
      name: asked.name,
      type: asked.type,
      holding: held?.holding ?? 'Unknown',
      number: held?.number ?? null,
      issuedOn: held?.issuedOn ?? null,
      location: held?.location ?? null,
    };
  }
}
