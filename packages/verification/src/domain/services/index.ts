/**
 * Rules that belong to no single aggregate: what makes two values off two
 * papers the same value, whether a quotation is really on the page it claims,
 * which type a text looks like by the profile's own headings, how a set of
 * document starts becomes ranges that tile a file, and what height and what
 * year a paper states.
 *
 * They live here, not in `infrastructure/`, because they decide domain
 * questions and import nothing but domain vocabulary. The offline adapters
 * happen to run on them entirely, and the model-backed ones check their answers
 * against them — but neither owns them.
 */
export {
  EARLIEST_YEAR,
  heightInMetres,
  LATEST_YEAR,
  yearIn,
} from './building-measures.service.js';
export {
  enclosesHeading,
  headingMatch,
  looksLike,
  type HeadingMatch,
} from './document-hints.service.js';
export { tileIntoRanges } from './page-tiling.service.js';
export {
  suggestProfile,
  type ProfileIntake,
  type ProfileSuggestion,
  type SuggestionCriterion,
  type SuggestionReason,
} from './profile-suggestion.service.js';
export { quotedIn } from './quotation-evidence.service.js';
export {
  attestationIn,
  BLANK_PAGE,
  isBlank,
  legibilityOf,
  readAsFarAsItGot,
  type Attestation,
  type Transcription,
} from './transcription-marks.service.js';
export { looksLikeTheSameValue, tokensOf } from './value-agreement.service.js';
