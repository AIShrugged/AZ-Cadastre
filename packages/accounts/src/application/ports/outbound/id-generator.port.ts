import type { AccountId } from '../../../domain/value-objects/index.js';

/**
 * Where an id comes from. A port, so that a use case does not reach for a
 * generator and a spec does not get a different id every run.
 */
export abstract class IdGenerator {
  abstract accountId(): AccountId;
}
