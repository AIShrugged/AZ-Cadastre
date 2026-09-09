import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common'; // prettier-ignore

import {
  ArchiveSearchRequestSchema,
  type ArchiveSearchRequest,
  type ArchiveSearchResponse,
} from '@cadastre/api-contracts/registry';

import { ArchiveSearchService } from '../../application/index.js';

@Controller('registry')
export class ArchiveSearchController {
  constructor(
    @Inject(ArchiveSearchService)
    private readonly archive: ArchiveSearchService,
  ) {}

  /*
   * Beside the summary rather than beside the lookup, because it is a question
   * about the register and not about one property: `registry/summary` says what
   * the archive holds, and this says which of it might be what somebody is
   * looking for.
   *
   * A POST and not a GET, for the reason the lookup is one and the summary is
   * not: a name and an address are somebody's property and have no business in
   * a URL, a query string or an access log. 200 and not 201 — a search is a
   * question, and nothing is created by asking it.
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body({ schema: ArchiveSearchRequestSchema }) body: ArchiveSearchRequest,
  ): Promise<ArchiveSearchResponse> {
    return this.archive.search(body);
  }
}
