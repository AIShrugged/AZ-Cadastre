/**
 * Verification Profiles (policy) — a profile is policy the engine interprets:
 * which document types it expects. The engine classifies uploaded documents
 * automatically; these required sets drive the completeness view at upload and
 * the "detected / required" tally. Demo material; a real cadastre profile is
 * domain data to be confirmed.
 */

export type ProfileKey = "demo" | "cadastre"

export type DocTypeKey =
  | "passport"
  | "driver_license"
  | "application"
  | "title_deed"
  | "cadastral_extract"

export type ProfileDef = {
  key: ProfileKey
  /** Document types the profile requires, in the order they should be shown. */
  requiredDocs: DocTypeKey[]
}

export const PROFILES: Record<ProfileKey, ProfileDef> = {
  demo: { key: "demo", requiredDocs: ["passport", "application"] },
  cadastre: {
    key: "cadastre",
    requiredDocs: ["passport", "application", "title_deed", "cadastral_extract"],
  },
}

export const PROFILE_ORDER: ProfileKey[] = ["cadastre", "demo"]
