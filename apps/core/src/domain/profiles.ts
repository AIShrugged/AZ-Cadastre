/**
 * Verification Profiles — minimal seed (ADR-0002). A profile declares, in code,
 * which document types it recognises. The full profile engine (field schemas,
 * required docs, cross-document rules) is added in later stages; for now the
 * classifier only needs the candidate document types per profile.
 */

/** Sentinel type for a document the classifier could not place. */
export const UNKNOWN_TYPE = "unknown";

/** Document-type keys each profile recognises, in report order. */
export const PROFILE_DOC_TYPES: Record<string, string[]> = {
  demo: ["passport", "driver_license", "application"],
  cadastre: ["passport", "application", "title_deed", "cadastral_extract"],
};

/** Candidate document types for a profile (empty for an unknown profile). */
export function profileDocTypes(profileKey: string): string[] {
  return PROFILE_DOC_TYPES[profileKey] ?? [];
}
