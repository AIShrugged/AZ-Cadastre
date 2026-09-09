import { Query } from '@nestjs/cqrs';

import type { ProfileSuggestionView } from '../../../read-models/index.js';

/**
 * Which profile the figures declared at intake point at.
 *
 * A query and not a command, and it is asked before anything exists: there is
 * no package yet, and asking it changes nothing about the one that follows.
 * Either figure may be absent — the intake screen asks as soon as it has one,
 * and an answer on one figure is worth more than no answer until the other
 * arrives.
 */
export class SuggestProfileQuery extends Query<ProfileSuggestionView> {
  constructor(
    public readonly legalBasis: string | null,
    public readonly builtYear: number | null,
  ) {
    super();
  }
}
