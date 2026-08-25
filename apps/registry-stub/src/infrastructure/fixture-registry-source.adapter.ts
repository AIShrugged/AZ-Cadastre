import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import {
  ArchiveRecordDtoSchema,
  type ArchiveRecordDto,
} from '@cadastre/api-contracts/registry';
import { Logger } from '@cadastre/logger';
import { addressesAgree } from '@cadastre/matching-engine';

import { RegistrySource } from '../application/ports/index.js';
import type { Environment } from '../config/index.js';

const FILE = 'archive-records.json';

const RecordsSchema = z.array(ArchiveRecordDtoSchema);

/**
 * The records as a file on disk.
 *
 * Parsed through the published schema rather than trusted: a fixture that has
 * drifted from the contract fails at startup, where it is one line to fix,
 * instead of at the first lookup that happens to reach the field.
 *
 * Read once and kept: the file is a fixture, not a store, and re-reading it per
 * request would only make the stand-in slower at pretending.
 */
@Injectable()
export class FixtureRegistrySourceAdapter extends RegistrySource {
  readonly #logger: Logger;
  #records: readonly ArchiveRecordDto[] | null = null;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    this.#logger = logger.child({ scope: FixtureRegistrySourceAdapter.name });
  }

  async findByAddress(address: string): Promise<readonly ArchiveRecordDto[]> {
    const records = await this.load();

    return records.filter(record => addressesAgree(address, record.address));
  }

  async size(): Promise<number> {
    return (await this.load()).length;
  }

  private async load(): Promise<readonly ArchiveRecordDto[]> {
    if (this.#records) return this.#records;

    const directory = this.config.get('fixtures', { infer: true }).directory;
    const path = resolve(process.cwd(), directory, FILE);
    const parsed = RecordsSchema.parse(
      JSON.parse(await readFile(path, 'utf8')),
    );

    this.#logger.log('Register loaded', { path, records: parsed.length });
    this.#records = parsed;

    return parsed;
  }
}
