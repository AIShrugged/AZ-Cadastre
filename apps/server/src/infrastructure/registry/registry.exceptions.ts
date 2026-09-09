import { HttpStatus } from '@nestjs/common';

import { InfrastructureException } from '@cadastre/shared';

/**
 * The two ways the archive register fails us, spelt as this system's own
 * exception bases so the edge renders them in the one published `ErrorBody`
 * shape and the caller can tell them apart by `code`.
 *
 * Both name a status of their own rather than taking the base's 500: a register
 * that is down or that refused us is not this service being broken, and a
 * client that cannot tell the difference retries the wrong one.
 */
export class RegistryUnreachableException extends InfrastructureException {
  override readonly code = 'REGISTRY_UNREACHABLE';
  override readonly status: number = HttpStatus.GATEWAY_TIMEOUT;

  constructor(
    public readonly url: string,
    public readonly reason: unknown,
  ) {
    super(
      `The archive register at ${url} could not be reached: ${String(reason)}`,
    );
  }
}

export class RegistryRefusedException extends InfrastructureException {
  override readonly code = 'REGISTRY_REFUSED';
  override readonly status: number = HttpStatus.BAD_GATEWAY;

  // Not `status`: the base already has one, and it means the opposite of this
  // — what we answer our own caller with, not what the register answered us.
  constructor(
    public readonly url: string,
    public readonly answered: number,
    public readonly body: string,
  ) {
    super(`The archive register at ${url} answered ${answered}: ${body}`);
  }
}
