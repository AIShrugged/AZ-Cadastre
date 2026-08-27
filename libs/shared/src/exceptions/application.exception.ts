export abstract class ApplicationException extends Error {
  // Stable across renames: what a client matches on.
  abstract readonly code: string;

  readonly status: number = 400;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
