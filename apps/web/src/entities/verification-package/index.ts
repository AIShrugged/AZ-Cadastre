/**
 * verification-package — the register's core domain: the package aggregate, its
 * disposition, the governing Profile policy, the pipeline stage count, the
 * in-memory package store, and the entity's read-only UI marks.
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
  PACKAGES,
  inSegment,
  segmentCounts,
  matchesQuery,
  nextPackageId,
  createPackage,
} from "./model/verification-package"

export { PackagesProvider, usePackages } from "./model/packages-store"

export { DispositionMark } from "./ui/disposition-mark"
export { StageBar } from "./ui/stage-bar"
