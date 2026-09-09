import { Controller, Get, Inject } from '@nestjs/common';

import type { RegistrySummaryResponse } from '@cadastre/api-contracts/registry';

import { RegistrySummaryService } from '../../application/index.js';

@Controller('registry')
export class RegistrySummaryController {
  constructor(
    @Inject(RegistrySummaryService)
    private readonly summary: RegistrySummaryService,
  ) {}

  /*
   * Not `health`, and deliberately beside it rather than inside it. The health
   * route is what a compose healthcheck and the caller's start-up wait ask
   * dozens of times a minute, it answers without touching the database, and it
   * must stay that cheap; this one reads the register and says what is in it.
   *
   * A GET, unlike the lookup: there is no property here and nothing about
   * anybody in the request, so there is nothing an access log should not see.
   */
  @Get('summary')
  async get(): Promise<RegistrySummaryResponse> {
    return this.summary.get();
  }
}
