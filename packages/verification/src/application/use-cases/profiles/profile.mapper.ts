import type {
  ProfileDto,
  ProfileSuggestionDto,
  SuggestionReasonDto,
} from '@cadastre/api-contracts/verification';

import type {
  ProfileSuggestionView,
  ProfileView,
} from '../../read-models/index.js';

export function toProfileDto(view: ProfileView): ProfileDto {
  return {
    key: view.key,
    documentTypes: view.documentTypes.map(type => ({
      key: type.key,
      required: type.required,
      fields: [...type.fields],
    })),
    grounds: [...view.grounds],
  };
}

export function toProfileSuggestionDto(
  view: ProfileSuggestionView,
): ProfileSuggestionDto {
  return {
    profileKey: view.profileKey,
    // Every criterion the suggestion was decided on, in the order it read them.
    // The read model speaks the domain's strings; the contract's enum is the
    // narrower promise, and only the domain's own enumeration reaches here.
    reasons: view.reasons.map(reason => ({
      criterion: reason.criterion as SuggestionReasonDto['criterion'],
      note: reason.note,
    })),
  };
}
