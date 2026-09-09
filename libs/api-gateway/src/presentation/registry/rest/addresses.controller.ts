import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';

import {
  AddressLookupRequestSchema,
  type AddressLookupRequest,
  type AddressLookupResponse,
} from '@cadastre/api-contracts/registry';

import { RegistryClientPort } from '../../../application/ports/index.js';

/**
 * The archive register's lookup, published at this system's own origin.
 *
 * The register is outside this system and speaks the same contracts package the
 * browser does, so there is nothing to publish here — only a door to open: until
 * this route existed the client had to reach the register directly, through a
 * proxy of its own, at an origin with no authentication in front of it
 * (TECH_DEBT §10).
 *
 * It restates nothing. Request and response are the contract's own shapes, the
 * body is validated by the contract's own schema, and a refusal comes back as
 * the same `ErrorBody` a verification refusal does.
 */
@Controller('addresses')
export class AddressesController {
  constructor(
    @Inject(RegistryClientPort) private readonly registry: RegistryClientPort,
  ) {}

  /*
   * A POST and not a GET, because the register makes it one: the address is
   * somebody's property and has no business in a URL, a query string or an
   * access log.
   *
   * 200 and not 201: a lookup is a question, and nothing is created to have an
   * address of its own. The register's own route answers 201 — Nest's default
   * for a POST — and that is its business; what this API publishes is decided
   * here.
   */
  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  async lookup(
    @Body({ schema: AddressLookupRequestSchema }) body: AddressLookupRequest,
  ): Promise<AddressLookupResponse> {
    return this.registry.addresses.lookup(body);
  }
}
