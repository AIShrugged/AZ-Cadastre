/**
 * Verification Profiles as the register reads them.
 *
 * A profile is policy the engine interprets — which document types it expects —
 * and the engine publishes it at `GET /api/profiles` (ADR-0002). This module
 * holds no list of its own: it only answers questions about the list the server
 * sent. The hand-written copy it replaces said the demo profile expected two
 * documents where the engine expected three, so the register tallied every demo
 * package against a total that did not exist.
 *
 * A profile key is therefore a plain `string`. Narrowing it to a union here
 * would be the same claim in a different shape — that this file knows which
 * profiles exist — and it would go stale the same way the moment one is added.
 */
import type { ProfileDto } from "@cadastre/contracts"

import { translateOr } from "@/shared/i18n"

export type { ProfileDto }

/** The `t` from `useI18n`. */
type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * The profile's name in the reader's language, or its bare key when the
 * dictionary has no word for it yet — a profile the engine has gained and the UI
 * has not been taught.
 *
 * Never another profile's name: the label was chosen by
 * `key === "demo" ? … : "profile.cadastre"`, which read every unknown profile
 * out as Cadastre.
 */
export function profileName(t: Translate, key: string): string {
  return translateOr(t, `profile.${key}`, key)
}

/**
 * How many documents the profile requires, or `null` when the server named no
 * such profile — a package governed by policy this build has never heard of.
 * Null rather than 0, so the register can decline to state a total instead of
 * stating a wrong one.
 *
 * The required ones, not every type the profile knows: an optional type the
 * engine merely recognises is not something a package is short of.
 */
export function documentsExpected(
  profiles: readonly ProfileDto[],
  key: string,
): number | null {
  const profile = profiles.find((candidate) => candidate.key === key)
  return profile ? requiredTypes(profile).length : null
}

/** The document types a package under this profile must carry, in profile order. */
export function requiredTypes(profile: ProfileDto): readonly string[] {
  return profile.documentTypes
    .filter((type) => type.required)
    .map((type) => type.key)
}

/**
 * The required types no document in the package was classified as — what the
 * inspector is still waiting on. Types the pipeline has not reached yet count
 * as missing, so this only reads as a finding once classification is done.
 */
export function missingTypes(
  profiles: readonly ProfileDto[],
  key: string,
  found: readonly (string | null)[],
): readonly string[] {
  const profile = profiles.find((candidate) => candidate.key === key)
  if (!profile) return []

  const present = new Set(found.filter((type): type is string => type !== null))
  return requiredTypes(profile).filter((type) => !present.has(type))
}
