import {
  AddressLookupResponseSchema,
  type AddressesApi,
  type AddressLookupRequest,
  type AddressLookupResponse,
} from '@cadastre/api-contracts/registry';
import { RegistryClientPort } from '@cadastre/api-gateway';
import type { Logger } from '@cadastre/logger';

import {
  RegistryRefusedException,
  RegistryUnreachableException,
} from './registry.exceptions.js';

const LOOKUP = '/api/addresses/lookup';

/** Where the register answers, and how long we wait for it. */
export type RegistryClientOptions = {
  url: string;
  timeoutMs: number;
};

/**
 * The archive register over HTTP, as the edge reaches it.
 *
 * It lives here and not in `libs/api-gateway` because the gateway declares what
 * it needs and never names who satisfies it: the register is a system outside
 * this one (ADR-0009), and which address answers its contract is a fact about
 * this deployment. The day a real state register answers
 * `@cadastre/api-contracts/registry`, only `REGISTRY_URL` changes.
 *
 * Deliberately not routed through the verification context, which holds an
 * outbound port over the same published slice. That one is the question a
 * submission's run asks and it is allowed to be answered by an offline
 * stand-in (`REGISTRY_PROVIDER=mock`); this one is the operator's own search of
 * the archive, and it must reach the register itself or say that it could not.
 *
 * The answer is parsed through the published schema and not trusted: a register
 * that has drifted from the contract must fail here rather than reach the
 * browser as a shape nothing checked — the client parses it with the same
 * schema and would otherwise be the first to find out.
 */
class HttpAddresses implements AddressesApi {
  constructor(
    private readonly options: RegistryClientOptions,
    private readonly logger: Logger,
  ) {}

  async lookup(request: AddressLookupRequest): Promise<AddressLookupResponse> {
    const url = `${this.options.url.replace(/\/$/u, '')}${LOOKUP}`;
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
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new RegistryUnreachableException(url, error);
    }
  }
}

export class HttpArchiveRegistryClient extends RegistryClientPort {
  override readonly addresses: AddressesApi;

  constructor(options: RegistryClientOptions, logger: Logger) {
    super();
    this.addresses = new HttpAddresses(
      options,
      logger.child({ scope: HttpArchiveRegistryClient.name }),
    );
  }
}
