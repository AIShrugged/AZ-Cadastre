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
 * How many document types the profile expects, or `null` when the server named
 * no such profile — a package governed by policy this build has never heard of.
 * Null rather than 0, so the register can decline to state a total instead of
 * stating a wrong one.
 */
export function documentsExpected(
  profiles: readonly ProfileDto[],
  key: string,
): number | null {
  const profile = profiles.find((candidate) => candidate.key === key)
  return profile ? profile.documentTypes.length : null
}
