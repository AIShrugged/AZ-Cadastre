import type { DocumentId } from './entity-ids/index.js';

/**
 * What pushed a document out of force, and when.
 *
 * A replaced document is never deleted. A submission is evidence and not a
 * working draft — the same principle that keeps a machine reading on file once
 * a better one exists — so the bad scan stays in the package, marked, saying
 * what replaced it and on what day. What the report is compiled from is the
 * document in force (COMM-80).
 */
export class Supersession {
  private constructor(
    // The document that replaced this one. Null only where that document has
    // since been removed with its file: the replacement still happened, and
    // `at` is what says so — the pointer is for the reader, and losing it must
    // not bring the paper back into force.
    public readonly by: DocumentId | null,
    public readonly at: Date,
  ) {}

  static of(by: DocumentId | null, at: Date): Supersession {
    return new Supersession(by, new Date(at.getTime()));
  }
}
