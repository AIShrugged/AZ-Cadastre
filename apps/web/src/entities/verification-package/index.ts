/**
 * verification-package — the register's core domain: the package aggregate, its
 * disposition, the governing Profile policy (read live from the engine, never
 * copied), the pipeline stage count, the live package API, and the entity's
 * read-only UI marks.
 */
export type { ProfileDto } from "./model/profile"
export {
  documentsExpected,
  missingTypes,
  profileName,
  requiredTypes,
} from "./model/profile"

export { STAGES } from "./model/pipeline"

export type {
  Disposition,
  VerificationPackage,
  Segment,
} from "./model/verification-package"
export {
  inSegment,
  segmentCounts,
  matchesQuery,
  toViewPackage,
} from "./model/verification-package"

export {
  useGetPackagesQuery,
  useGetPackageQuery,
  useCreatePackageMutation,
} from "./api/packages-api"
export { useGetProfilesQuery } from "./api/profiles-api"

export { DispositionMark } from "./ui/disposition-mark"
export { StageBar } from "./ui/stage-bar"
