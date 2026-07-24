/**
 * verification-package — the register's core domain: the package aggregate, its
 * disposition, the governing Profile policy, the pipeline stage count, the live
 * package API, and the entity's read-only UI marks.
 */
export type {
  ProfileKey,
  DocTypeKey,
  ProfileDef,
} from "./model/profile"
export { PROFILES, PROFILE_ORDER } from "./model/profile"

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
  useCreatePackageMutation,
} from "./api/packages-api"

export { DispositionMark } from "./ui/disposition-mark"
export { StageBar } from "./ui/stage-bar"
