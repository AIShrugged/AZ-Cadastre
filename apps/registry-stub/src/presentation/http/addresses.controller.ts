import { Body, Controller, Inject, Post } from '@nestjs/common';

import {
  AddressLookupRequestSchema,
  type AddressLookupRequest,
  type AddressLookupResponse,
} from '@cadastre/api-contracts/registry';

import { AddressesService } from '../../application/index.js';

@Controller('addresses')
export class AddressesController {
  constructor(
    @Inject(AddressesService) private readonly addresses: AddressesService,
  ) {}

  /*
   * A lookup, not a validation, and a POST rather than a GET: the address is
   * somebody's property and has no business in a URL, a query string or an
   * access log.
   */
  @Post('lookup')
  async lookup(
    @Body({ schema: AddressLookupRequestSchema }) body: AddressLookupRequest,
  ): Promise<AddressLookupResponse> {
    return this.addresses.lookup(body);
  }
}
