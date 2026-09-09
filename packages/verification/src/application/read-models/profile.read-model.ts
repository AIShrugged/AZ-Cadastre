export type ProfileDocumentTypeView = {
  key: string;
  required: boolean;
  // The field keys the type's schema declares, in schema order. Keys, not
  // labels: the profile's own labels are written for the extractor, and the
  // reader's language is the caller's to choose.
  fields: readonly string[];
};

export type ProfileView = {
  key: string;
  documentTypes: readonly ProfileDocumentTypeView[];
  // Which of the types above can be the ground a claimed right rests on, in the
  // order the profile declares them. What an intake screen offers the operator,
  // and what a suggestion is decided on.
  grounds: readonly string[];
};

/**
 * What the figures declared at intake point at, and why.
 *
 * The reasoning is part of the answer and not an afterthought: this recommends
 * and never decides, and a recommendation nobody can argue with is one an
 * operator can only obey or distrust.
 */
export type ProfileSuggestionView = {
  // Null where the declaration points at no profile and where it points at more
  // than one. The reasons say which.
  profileKey: string | null;
  reasons: readonly SuggestionReasonView[];
};

export type SuggestionReasonView = {
  // 'legalBasis' | 'builtYear' — which declared figure the line is about, so a
  // reader can show it beside the field rather than parse the sentence.
  criterion: string;
  // The audit line, written in English when the suggestion was made.
  note: string;
};
