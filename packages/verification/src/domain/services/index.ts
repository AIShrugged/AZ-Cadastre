/**
 * Rules that belong to no single aggregate: what makes two values off two
 * papers the same value, whether a quotation is really on the page it claims,
 * which type a text looks like by the profile's own headings, how a set of
 * document starts becomes ranges that tile a file, what height, span, storeys,
 * right over the land and year a paper states, which provision of Article 8 a
 * case falls under, what a document's sheets say about the seal and the
 * signature an office attests it with, and what the National Archive's copy of
 * a paper makes of the paper.
 *
 * They live here, not in `infrastructure/`, because they decide domain
 * questions and import nothing but domain vocabulary. The offline adapters
 * happen to run on them entirely, and the model-backed ones check their answers
 * against them — but neither owns them.
 */
export {
  archiveQrCheckOf,
  isCheckedByItsQrCode,
  isHeldAgainstTheArchiveByQr,
  type ArchivedPaper,
} from './archive-qr-verdict.service.js';
export {
  dateSpanIn,
  EARLIEST_YEAR,
  heightInMetres,
  LATEST_YEAR,
  spanInMetres,
  storeysIn,
  yearIn,
} from './building-measures.service.js';
export {
  PARAMETER_SOURCES,
  provisionOf,
  type CaseProvision,
  type FigureReading,
  type ParameterReading,
  type ParameterSource,
  type ProvisionStanding,
  type RequirementStanding,
  type TitleDocumentStanding,
} from './case-provision.service.js';
export {
  attestationOf,
  MARK_STATES,
  type DocumentAttestation,
  type MarkExpectations,
  type MarkObservation,
  type MarkState,
  type SheetReading,
} from './document-attestation.service.js';
export {
  GAP_REASONS,
  gapsIn,
  type DocumentGap,
  type GapReason,
  type ReadDocument,
} from './document-gaps.service.js';
export {
  enclosesHeading,
  headingMatch,
  looksLike,
  sheetsToPicture,
  type HeadingMatch,
} from './document-hints.service.js';
export { landPurposeIn, landRightIn } from './land-title.service.js';
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
  AXIS_CHAINS,
  SPAN_UNIT_BASES,
  SPAN_UNITS,
  spanCalculationOf,
  type AxisChain,
  type AxisSpan,
  type ChainSpans,
  type SpanCalculation,
  type SpanUnit,
  type SpanUnitBasis,
} from './span.service.js';
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
