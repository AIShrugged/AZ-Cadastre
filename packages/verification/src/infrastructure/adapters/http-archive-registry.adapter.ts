import { Injectable } from '@nestjs/common';

import {
  AddressLookupResponseSchema,
  type AddressesApi,
  type AddressLookupRequest,
  type AddressLookupResponse,
} from '@cadastre/api-contracts/registry';
import type { Logger } from '@cadastre/logger';

import { ArchiveRegistryPort } from '../../application/ports/outbound/index.js';
import type { VerificationModuleOptions } from '../../verification.module-defs.js';
import {
  RegistryRefusedException,
  RegistryUnreachableException,
} from '../exceptions/index.js';

const LOOKUP = '/api/addresses/lookup';

/**
 * The register over HTTP. Today it points at the stand-in in
 * `apps/registry-stub`; the day a real register answers this contract, only the
 * base URL changes (ADR-0009).
 *
 * The answer is parsed through the published schema and not trusted: a register
 * that has drifted from the contract must fail here, in one stage that the run
 * carries on without, rather than reach the aggregate as a shape nothing
 * checked.
 */
class HttpAddresses implements AddressesApi {
  constructor(
    private readonly options: VerificationModuleOptions,
    private readonly logger: Logger,
  ) {}

  async lookup(request: AddressLookupRequest): Promise<AddressLookupResponse> {
    const url = `${this.options.registry.url.replace(/\/$/u, '')}${LOOKUP}`;
    const startedAt = Date.now();

    const response = await this.answer(url, request);
    const body = await response.text();

    if (!response.ok) {
      throw new RegistryRefusedException(url, response.status, body);
    }

    const answer = AddressLookupResponseSchema.parse(JSON.parse(body));

    // The address is somebody's property and is not written to the log. What
    // the register made of it is (ADR-0008).
    this.logger.debug('Archive register answered', {
      url,
      outcome: answer.outcome,
      candidates: answer.candidates,
      durationMs: Date.now() - startedAt,
    });

    return answer;
  }

  private async answer(
    url: string,
    request: AddressLookupRequest,
  ): Promise<Response> {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.options.registry.timeoutMs),
      });
    } catch (error) {
      // A register that is down does not fail a verification: the stage is
      // carried through and the report says the property was not confirmed.
      throw new RegistryUnreachableException(url, error);
    }
  }
}

@Injectable()
export class HttpArchiveRegistryAdapter extends ArchiveRegistryPort {
  override readonly addresses: AddressesApi;

  constructor(options: VerificationModuleOptions, logger: Logger) {
    super();
    this.addresses = new HttpAddresses(
      options,
      logger.child({ scope: HttpArchiveRegistryAdapter.name }),
    );
  }
}
