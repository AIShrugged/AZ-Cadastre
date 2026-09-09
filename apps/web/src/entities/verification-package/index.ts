/**
 * verification-package — the register's core domain: the package aggregate, its
 * standing (read off the contract, never worked out here), the governing
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
  Segment,
} from './model/verification-package';
export {
  inSegment,
  packageRef,
  segmentCounts,
  matchesQuery,
  toViewPackage,
} from './model/verification-package';

export {
  useGetPackagesQuery,
  useGetPackageQuery,
  useCreatePackageMutation,
  useAddFilesMutation,
} from './api/packages-api';
export { useGetProfilesQuery } from './api/profiles-api';

export { DispositionMark } from './ui/disposition-mark';
export { StandingMark } from './ui/standing-mark';
export { ProfileGlyph } from './ui/profile-glyph';
export { StageBar } from './ui/stage-bar';
