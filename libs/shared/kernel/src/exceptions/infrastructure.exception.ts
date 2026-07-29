export abstract class InfrastructureException extends Error {
  // Stable across renames: what a client matches on.
  abstract readonly code: string;

  readonly status: number = 500;

  protected constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}
