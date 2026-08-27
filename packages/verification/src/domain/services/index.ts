/**
 * Rules that belong to no single aggregate: what makes two values off two
 * papers the same value, whether a quotation is really on the page it claims,
 * which type a text looks like by the profile's own headings, and how a set of
 * document starts becomes ranges that tile a file.
 *
 * They live here, not in `infrastructure/`, because they decide domain
 * questions and import nothing but domain vocabulary. The offline adapters
 * happen to run on them entirely, and the model-backed ones check their answers
 * against them — but neither owns them.
 */
export { looksLike } from './document-hints.service.js';
export { tileIntoRanges } from './page-tiling.service.js';
export { quotedIn } from './quotation-evidence.service.js';
export {
  BLANK_PAGE,
  isBlank,
  legibilityOf,
  readAsFarAsItGot,
  type Transcription,
} from './transcription-marks.service.js';
export { looksLikeTheSameValue, tokensOf } from './value-agreement.service.js';
