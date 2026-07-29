import { ApplicationException } from "@cadastre/kernel";

export class ConcurrencyConflictException extends ApplicationException {
  override readonly code = "CONCURRENCY_CONFLICT";
  override readonly status = 409;

  constructor(
    public readonly aggregate: string,
    public readonly aggregateId: string,
    public readonly expectedVersion: number,
  ) {
    super(
      `${aggregate} ${aggregateId} was modified concurrently — expected version ${expectedVersion}`,
    );
  }
}
