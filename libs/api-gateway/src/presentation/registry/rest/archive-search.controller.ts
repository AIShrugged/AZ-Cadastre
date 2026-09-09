import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common'; // prettier-ignore

import {
  ArchiveSearchRequestSchema,
  type ArchiveSearchRequest,
  type ArchiveSearchResponse,
} from '@cadastre/api-contracts/registry';

import { RegistryClientPort } from '../../../application/ports/index.js';

/**
 * The archive searched, published at this system's own origin.
 *
 * The third area of the register's contract to get a door, and it restates
 * nothing: request and response are the contract's own shapes, the body is
 * refused by the contract's own schema before the register is called, and a
 * register that is down or that refuses us comes back as the same `ErrorBody` a
 * lookup's refusal does.
 *
 * It is the operator's own search of the archive and not a submission's lookup,
 * so it goes through this port and never through the verification context —
 * which is allowed to have its register mocked, and would then answer an
 * operator's search from three built-in records.
 */
@Controller('registry')
export class ArchiveSearchController {
  constructor(
    @Inject(RegistryClientPort) private readonly registry: RegistryClientPort,
  ) {}

  /*
   * A POST, because a name and an address are somebody's property and have no
   * business in a URL, a query string or an access log — the same reason the
   * lookup is one, and the reason the summary beside it is not: that one
   * carries nothing about anybody.
   *
   * 200 and not 201: a search is a question, and nothing is created by asking.
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body({ schema: ArchiveSearchRequestSchema }) body: ArchiveSearchRequest,
  ): Promise<ArchiveSearchResponse> {
    return this.registry.search.search(body);
  }
}
