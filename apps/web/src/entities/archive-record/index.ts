/**
 * archive-record — the archive register as this client reads it: the two
 * questions it takes, the answers each can give, and the records it hands back.
 *
 * The two are kept apart here as the contract keeps them apart. A **lookup**
 * resolves one address to the one record a verification stage may act on, and
 * refuses to choose when several answer. A **search** is the operator's own —
 * any of three criteria, a confidence per record, and no verdict at all.
 *
 * A separate entity from `verification-package` on purpose. The register is a
 * system outside this one (ADR-0009): it states what its own fonds hold and
 * passes judgement on no submission, and the moment its language is folded into
 * the verification context's the two start borrowing each other's words.
 */
export type { ArchiveQuery } from './model/archive-query';
export { BLANK_QUERY, isAskable, toSearchRequest } from './model/archive-query';

export type { AnsweredCriterion, ReadCriteria } from './model/match';
export {
  BAND_KEY,
  BAND_STEPS,
  CRITERION_KEY,
  METER_STEPS,
  readCriteria,
  THRESHOLD_CHOICES,
} from './model/match';

export type { RecordField } from './model/lookup';
export {
  ATTRIBUTE_KEY,
  HOLDING_KEY,
  HOLDING_TONE,
  LOOKUP_KEY,
  LOOKUP_NOTE,
  LOOKUP_TONE,
  MATCH_KEY,
  MATCH_TONE,
  RECORD_FIELD_KEY,
  RECORD_FIELDS,
} from './model/lookup';

export {
  archiveHoldingsChanged,
  useArchiveSummaryQuery,
  useLookupAddressQuery,
  useSearchArchiveQuery,
} from './api/archive-api';

export type {
  ArchiveHoldings,
  ArchiveReach,
  SummaryAnswer,
} from './model/holdings';
export { readHoldings } from './model/holdings';

export {
  AttributeMatchMark,
  DocumentHoldingMark,
  LookupOutcomeGlyph,
} from './ui/lookup-marks';

export { ConfidenceMark, DisputedMark } from './ui/match-marks';
