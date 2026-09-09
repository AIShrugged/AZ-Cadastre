/**
 * archive-record — the archive register as this client reads it: the question
 * an operator puts to it, the three answers it can give, and the record it
 * hands back.
 *
 * A separate entity from `verification-package` on purpose. The register is a
 * system outside this one (ADR-0009): it states what its own fonds hold and
 * passes judgement on no submission, and the moment its language is folded into
 * the verification context's the two start borrowing each other's words.
 */
export type { ArchiveQuery } from './model/archive-query';
export { BLANK_QUERY, isAskable, toLookupRequest } from './model/archive-query';

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

export type { ArchiveReach } from './api/archive-api';
export { useArchiveReachQuery, useLookupAddressQuery } from './api/archive-api';

export {
  AttributeMatchMark,
  DocumentHoldingMark,
  LookupOutcomeMark,
} from './ui/lookup-marks';
