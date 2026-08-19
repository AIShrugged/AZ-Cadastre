export abstract class DomainException extends Error {
  // Stable across renames: what a client matches on.
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
