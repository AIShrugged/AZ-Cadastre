import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import { suggestProfile } from '../../../../domain/services/index.js';
import {
  DeclaredAtIntake,
  DocumentType,
  VerificationProfile,
} from '../../../../domain/value-objects/index.js';
import type { ProfileSuggestionView } from '../../../read-models/index.js';

import { SuggestProfileQuery } from './suggest-profile.query.js';

@QueryHandler(SuggestProfileQuery)
export class SuggestProfileHandler implements IQueryHandler<
  SuggestProfileQuery,
  ProfileSuggestionView
> {
  execute(query: SuggestProfileQuery): Promise<ProfileSuggestionView> {
    // A basis no profile registers is a perfectly good question and is answered
    // rather than refused: "no profile registers a right founded on this" is
    // exactly what an operator asked before submitting needs to hear, and a 422
    // would tell them the same thing in a shape their screen cannot show.
    const declared = DeclaredAtIntake.of({
      legalBasis: query.legalBasis
        ? DocumentType.create(query.legalBasis)
        : null,
      builtYear: query.builtYear,
    });

    const suggestion = suggestProfile(declared, VerificationProfile.all);

    return Promise.resolve({
      profileKey: suggestion.profileKey,
      reasons: suggestion.reasons.map(reason => ({
        criterion: reason.criterion,
        note: reason.note,
      })),
    });
  }
}
