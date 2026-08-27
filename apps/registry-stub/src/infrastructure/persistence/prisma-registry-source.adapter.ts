import { Inject, Injectable } from '@nestjs/common';

import type {
  ArchiveDocumentDto,
  ArchiveRecordDto,
} from '@cadastre/api-contracts/registry';
import { Logger } from '@cadastre/logger';
import { addressesAgree } from '@cadastre/matching-engine';

import { RegistrySource } from '../../application/ports/index.js';

import { Prisma } from './generated/client.js';
import { RegistryPrismaService } from './registry-prisma.service.js';

// Everything a record is projected from, named once so the query and the
// projection cannot drift apart.
const WHOLE_RECORD = {
  addresses: { orderBy: { position: 'asc' } },
  rightHolders: { orderBy: { position: 'asc' } },
  documents: { orderBy: { position: 'asc' } },
  location: true,
} as const satisfies Prisma.RegistryObjectInclude;

/**
 * The register's records, out of the register's own database.
 *
 * Two queries and not one, because the rule that decides whether two ways of
 * writing an address mean the same place is a JavaScript function and not a
 * predicate PostgreSQL can be given: `addressesAgree` binds an administrative
 * level to the word beside it, forgives a level one side omits, and reads the
 * Azerbaijani legacy Cyrillic code page. So the address rows are read, matched
 * here, and only the objects that matched are hydrated.
 *
 * That first read is the whole address table. It is fine for a register holding
 * the cases the customer supplied and it is not fine for the 55 register files:
 * when they are ingested the prefilter becomes a normalised-token index and
 * this function keeps deciding. TECH_DEBT §9 says what fires.
 */
@Injectable()
export class PrismaRegistrySourceAdapter extends RegistrySource {
  readonly #logger: Logger;

  constructor(
    @Inject(RegistryPrismaService)
    private readonly prisma: RegistryPrismaService,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    this.#logger = logger.child({ scope: PrismaRegistrySourceAdapter.name });
  }

  async findByAddress(address: string): Promise<readonly ArchiveRecordDto[]> {
    const spellings = await this.prisma.registryAddress.findMany({
      select: { objectId: true, value: true },
    });

    const objectIds = [
      ...new Set(
        spellings
          .filter(spelling => addressesAgree(address, spelling.value))
          .map(spelling => spelling.objectId),
      ),
    ];

    // The address itself is never written to the log — it is somebody's
    // property. How wide the net came back is (ADR-0008).
    this.#logger.debug('Address rows matched', {
      spellings: spellings.length,
      objects: objectIds.length,
    });

    if (objectIds.length === 0) return [];

    const objects = await this.prisma.registryObject.findMany({
      where: { id: { in: objectIds } },
      include: WHOLE_RECORD,
      orderBy: { registerNo: 'asc' },
    });

    return objects.map(object => toRecord(object));
  }

  async size(): Promise<number> {
    return this.prisma.registryObject.count();
  }
}

// Exactly what the query above returns, so the projection cannot drift from it:
// adding a relation to WHOLE_RECORD widens this type, and dropping one narrows
// it into a compile error here.
type ObjectRow = Prisma.RegistryObjectGetPayload<{
  include: typeof WHOLE_RECORD;
}>;

function toRecord(object: ObjectRow): ArchiveRecordDto {
  return {
    registerNo: object.registerNo,
    inventoryNo: object.inventoryNo,
    // The form the register spells it by today. A record with only legacy
    // spellings answers with the first of those rather than with nothing:
    // whichever way it is written, it is the address the register holds.
    address:
      object.addresses.find(one => one.kind === 'Current')?.value ??
      object.addresses[0]?.value ??
      '',
    // The first right holder. The published record names one owner, and a
    // property held in shares is a case the contract cannot state yet —
    // ADR-0010 says so rather than picking the largest share and calling it
    // the owner.
    ownerName: object.rightHolders[0]?.name ?? null,
    cadastralNumber: object.cadastralNumber,
    plotArea: object.plotArea,
    location: object.location
      ? { folder: object.location.folder, pages: object.location.pages }
      : null,
    documents: object.documents.map(document => toDocument(document, object)),
  };
}

function toDocument(
  document: ObjectRow['documents'][number],
  object: ObjectRow,
): ArchiveDocumentDto {
  return {
    name: document.name,
    holding: document.holding as ArchiveDocumentDto['holding'],
    number: document.number,
    issuedOn: document.issuedOn,
    issuingAuthority: document.issuingAuthority,
    // Where this paper is, and where the case is when the register does not
    // locate the paper separately — which is the ordinary case: the presence
    // registers record that a paper is in the file, not which page of it.
    location:
      document.folder !== null && document.pages !== null
        ? { folder: document.folder, pages: document.pages }
        : object.location
          ? { folder: object.location.folder, pages: object.location.pages }
          : null,
  };
}
