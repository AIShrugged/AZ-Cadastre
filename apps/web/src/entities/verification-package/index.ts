/**
 * verification-package — the register's core domain: the package aggregate, its
 * standing and the outcome of the run on it (both read off the contract, never
 * worked out here), what the run says has to be brought next and whether it
 * could work out which set, the question the register puts to the server, the governing
 * Profile policy (read live from the engine, never copied), the pipeline stage
 * count, the live package API, and the entity's read-only UI marks.
 */
export type { ProfileDto } from './model/profile';
export {
  documentsExpected,
  missingTypes,
  profileName,
  requiredTypes,
} from './model/profile';

export { STAGES } from './model/pipeline';

export type {
  ApprovalStance,
  OutcomeTone,
  CoveredCheck,
} from './model/archive-search';
export {
  approvalInForce,
  approvalStance,
  coveredChecks,
  HOLDING_KEY,
  HOLDING_TONE,
  OUTCOME_KEY,
  OUTCOME_NOTE,
  OUTCOME_TONE,
  speaksAgainst,
  spentApprovals,
} from './model/archive-search';

export { REPORT_KEY, REPORT_TONE } from './model/report-outcome';

export type { OverviewPeriod } from './model/overview-period';
export {
  coversWholeRegister,
  OVERVIEW_PERIODS,
  parseOverviewPeriod,
  PERIOD_KEY,
  toOverviewRequest,
  WHOLE_REGISTER_PERIOD,
  withOverviewPeriod,
} from './model/overview-period';

export type {
  FindingRank,
  FindingRanking,
  SliceTone,
  Tally,
  TallySlice,
} from './model/overview';
export {
  archiveTally,
  ARCHIVE_ORDER,
  CONVEYOR_KEY,
  CONVEYOR_ORDER,
  ISSUE_KIND_KEY,
  outcomeTally,
  OUTCOME_ORDER,
  pipelineTally,
  rankFindings,
  stalledCount,
} from './model/overview';

export type {
  ReportReading,
  SupportingSet,
} from './model/supporting-documents';
export {
  anyUnplaced,
  readReport,
  supportingSetsOf,
  SUPPORTING_DOCUMENTS,
} from './model/supporting-documents';

export type { RegisterQuery } from './model/register-query';
export {
  isNarrowed,
  pageCount,
  parseRegisterQuery,
  REGISTER_PAGE_SIZE,
  registerQueryParams,
  toListRequest,
  WHOLE_REGISTER,
} from './model/register-query';

export type { PackageStanding, StandingTone } from './model/standing';
export {
  isRunning,
  STANDING_KEY,
  STANDING_NOTE,
  STANDING_TONE,
  takesFiles,
} from './model/standing';

export type {
  Disposition,
  VerificationPackage,
} from './model/verification-package';
export { packageRef, toViewPackage } from './model/verification-package';

export type { PackagePage } from './api/packages-api';
export {
  useGetPackagesQuery,
  useGetPackageQuery,
  useCreatePackageMutation,
  useAddFilesMutation,
  useApproveArchiveSearchMutation,
} from './api/packages-api';
export { useGetProfilesQuery } from './api/profiles-api';
export { useGetPackagesOverviewQuery } from './api/overview-api';

export {
  OutcomeMark,
  OUTCOME_ICON,
  RegistryOutcomeMark,
} from './ui/outcome-mark';
export { StandingMark } from './ui/standing-mark';
export { ProfileGlyph } from './ui/profile-glyph';
export { StageBar } from './ui/stage-bar';
