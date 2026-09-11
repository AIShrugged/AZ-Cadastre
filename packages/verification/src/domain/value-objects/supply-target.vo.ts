import { InvalidSupplyTargetException } from '../exceptions/index.js';

import type { DocumentType } from './document-type.vo.js';
import type { DocumentId } from './entity-ids/index.js';

/**
 * What a file sent in after the submission is answering: the kind of paper the
 * package was short of, and — where it is a replacement — the document it is
 * sent in place of.
 *
 * Recorded on the file and not worked out later, because it is the only thing
 * that makes the arrival checkable: a file with no target is one more file in
 * the envelope, and "one more file" is exactly what the operator did not ask
 * for. It is what the run holds the classification against, and what decides
 * whether the gap it was sent for is closed (COMM-80).
 *
 * The target is what the operator said, never what turned up. Whether the
 * paper actually is of that type is the run's answer and lives nowhere but in
 * the classification of the documents carved out of the file — a target
 * rewritten to match what arrived would be a record of nothing.
 */
export class SupplyTarget {
  private constructor(
    public readonly expectedType: DocumentType,
    public readonly replaces: DocumentId | null,
  ) {}

  static of(state: {
    expectedType: DocumentType;
    replaces?: DocumentId | null;
  }): SupplyTarget {
    // A target that names neither a profile type nor anything of the engine's
    // own could not be held against a classification: `unknown` and
    // `out_of_profile` are what the reader answers when it cannot place a
    // paper, and expecting one of them is expecting the reading to fail.
    if (!state.expectedType.isKnown) {
      throw new InvalidSupplyTargetException(state.expectedType.value);
    }

    return new SupplyTarget(state.expectedType, state.replaces ?? null);
  }

  get isReplacement(): boolean {
    return this.replaces !== null;
  }

  // Whether what the run made of a document answers what was asked for. Only a
  // placed type answers: a paper the reader could not place is not the paper
  // that was sent for, whatever it turns out to be.
  isAnsweredBy(type: DocumentType): boolean {
    return type.isKnown && type.equals(this.expectedType);
  }
}
