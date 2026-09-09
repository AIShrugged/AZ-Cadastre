import { Controller, Get, Inject } from '@nestjs/common';

import type { RegistrySummaryResponse } from '@cadastre/api-contracts/registry';

import { RegistryClientPort } from '../../../application/ports/index.js';

/**
 * How much of the archive the register holds, published at this system's own
 * origin.
 *
 * The second area of the register's contract to get a door, and it exists for
 * the same reason the first one did: the sidebar's archive block had nothing to
 * ask but the register's own `/api/health`, reached round the API through the
 * `/registry` proxy at an origin with no authentication in front of it
 * (TECH_DEBT §10) — and health says a process is answering, never what it
 * loaded.
 *
 * It restates nothing: the response is the contract's own shape, handed through
 * as the register gave it, and a register that is down or that refuses us comes
 * back as the same `ErrorBody` a lookup's refusal does.
 */
@Controller('registry')
export class RegistrySummaryController {
  constructor(
    @Inject(RegistryClientPort) private readonly registry: RegistryClientPort,
  ) {}

  @Get('summary')
  async get(): Promise<RegistrySummaryResponse> {
    return this.registry.summary.get();
  }
}
