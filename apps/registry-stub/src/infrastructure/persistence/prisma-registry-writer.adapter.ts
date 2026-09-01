import { Inject, Injectable } from '@nestjs/common';

import { Logger } from '@cadastre/logger';

import { RegistryWriter } from '../../application/ports/index.js';
import type { ObjectImport } from '../../application/registry-import.schema.js';

import type { Prisma } from './generated/client.js';
import { RegistryPrismaService } from './registry-prisma.service.js';

/**
 * A whole workbook is one transaction, so the report the operator is handed is
 * true: it says how many objects went in, and a load that failed halfway would
 * make that a number nobody could act on.
 *
 * Long by the standards of a request, on purpose — a register file is thousands
 * of rows and the alternative is a partial load. Prisma's five-second default
 * would abort a real one.
 */
const TRANSACTION_TIMEOUT_MS = 120_000;

/**
 * Writes imported records into the register's own database.
 *
 * Idempotent in the same way `seed.ts` is, and deliberately the same shape: the
 * object is upserted on `(territorialOffice, registerNo)` and the rows hanging
 * off it are deleted and written again rather than merged. Merging would leave
 * a row from an earlier version of the file standing beside the corrected one,
 * and a register holding a spelling nobody wrote is a register that answers to
 * an address nobody has.
 */
@Injectable()
export class PrismaRegistryWriterAdapter extends RegistryWriter {
  readonly #logger: Logger;

  constructor(
    @Inject(RegistryPrismaService)
    private readonly prisma: RegistryPrismaService,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    this.#logger = logger.child({ scope: PrismaRegistryWriterAdapter.name });
  }

  async upsert(objects: readonly ObjectImport[]): Promise<void> {
    await this.prisma.$transaction(
      async transaction => {
        for (const one of objects) await write(transaction, one);
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );

    // How many rows landed, never which properties they were about (ADR-0008).
    this.#logger.debug('Register records written', { objects: objects.length });
  }
}

async function write(
  prisma: Prisma.TransactionClient,
  record: ObjectImport,
): Promise<void> {
  const { object, addresses, rightHolders, documents, aliases, location } =
    record;

  const stored = await prisma.registryObject.upsert({
    where: {
      territorialOffice_registerNo: {
        territorialOffice: object.territorialOffice,
        registerNo: object.registerNo,
      },
    },
    create: object,
    update: object,
  });

  await prisma.registryAddress.deleteMany({ where: { objectId: stored.id } });
  await prisma.registryRightHolder.deleteMany({
    where: { objectId: stored.id },
  });
  await prisma.registryDocument.deleteMany({ where: { objectId: stored.id } });
  await prisma.registryAlias.deleteMany({ where: { objectId: stored.id } });
  await prisma.archiveLocation.deleteMany({ where: { objectId: stored.id } });

  // `position` is the order the sheet listed them in, which is the order the
  // register lists them in: the first address of its kind is the canonical one.
  await prisma.registryAddress.createMany({
    data: addresses.map((address, position) => ({
      ...address,
      objectId: stored.id,
      position,
    })),
  });
  await prisma.registryRightHolder.createMany({
    data: rightHolders.map((holder, position) => ({
      ...holder,
      objectId: stored.id,
      position,
    })),
  });
  await prisma.registryDocument.createMany({
    data: documents.map((document, position) => ({
      ...document,
      objectId: stored.id,
      position,
    })),
  });
  await prisma.registryAlias.createMany({
    data: aliases.map((alias, position) => ({
      ...alias,
      objectId: stored.id,
      position,
    })),
  });

  if (location) {
    await prisma.archiveLocation.create({
      data: { ...location, objectId: stored.id },
    });
  }
}
