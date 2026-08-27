import { InfrastructureException } from '@cadastre/shared';

export class RegistryUnreachableException extends InfrastructureException {
  override readonly code = 'REGISTRY_UNREACHABLE';

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
