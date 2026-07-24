/**
 * Verification Package — the register's core aggregate: the identity an
 * inspector cites, its disposition, and the tallies the pipeline reports.
 *
 * Package summaries are now served live by the core API (`GET /api/packages`);
 * the wire DTO and the mapping into this view model live here. Fields the
 * pipeline has not produced yet (applicant, issues, confidence) are absent until
 * their stages run. Ubiquitous language follows docs/CONTEXT.md.
 */
import type { PackageDto, PackageStatus } from "@cadastre/contracts"

import { PROFILES, type ProfileKey } from "./profile"

export type Disposition =
  | "in_progress"
  | "ok"
  | "issues"
  | "incomplete"
  | "failed"

export type VerificationPackage = {
  /** Register number — the identity an inspector cites. */
  id: string
  /** Applicant on the package (extracted downstream; empty until then). */
  applicant: string
  /** Which Verification Profile governs this package. */
  profile: ProfileKey
  disposition: Disposition
  /** ISO timestamp the package was submitted. */
  submittedAt: string
  /** ISO timestamp of the last pipeline event (drives "updated Xm ago"). */
  updatedAt: string
  /** Documents detected vs. required by the profile. */
  docsDetected: number
  docsRequired: number
  /** Validation issues raised (mismatch / expired / missing). */
  issues: number
  /** Fields flagged below the confidence threshold. */
  lowConfidence: number
  /** Lowest field confidence seen, 0–100 (undefined until extraction runs). */
  minConfidence?: number
  /** For in_progress packages: current stage 1..6. */
  stage?: number
  /** Optional internal reference the inspector set at creation. */
  reference?: string
}

export type Segment = "all" | "in_progress" | "issues" | "incomplete" | "ok" | "failed"

export function inSegment(p: VerificationPackage, seg: Segment): boolean {
  if (seg === "all") return true
  return p.disposition === seg
}

export function segmentCounts(pkgs: VerificationPackage[]): Record<Segment, number> {
  const c: Record<Segment, number> = {
    all: pkgs.length,
    in_progress: 0,
    issues: 0,
    incomplete: 0,
    ok: 0,
    failed: 0,
  }
  for (const p of pkgs) c[p.disposition] += 1
  return c
}

export function matchesQuery(p: VerificationPackage, q: string): boolean {
  if (!q.trim()) return true
  const n = q.trim().toLocaleLowerCase()
  return (
    p.id.toLocaleLowerCase().includes(n) ||
    p.applicant.toLocaleLowerCase().includes(n)
  )
}

// ─── Wire DTO ⇄ view model ────────────────────────────────────────────────────
// PackageDto / PackageStatus are the shared contracts (@cadastre/contracts);
// this maps them into the register's richer view model.

function dispositionOf(status: PackageStatus): Disposition {
  switch (status) {
    case "Pending":
    case "Processing":
      return "in_progress"
    case "Completed":
      // Outcome (OK / Issues / Incomplete) comes from the report; until that
      // stage is wired, a completed package reads as OK.
      return "ok"
    case "Failed":
      return "failed"
  }
}

/**
 * Map a live package summary into the register's view model. Profile-derived and
 * pipeline-derived fields are filled from the profile (in code, ADR-0002) and
 * defaulted until their stages produce real values.
 */
export function toViewPackage(dto: PackageDto): VerificationPackage {
  const profile = dto.profileKey as ProfileKey
  const disposition = dispositionOf(dto.status)
  return {
    id: dto.id,
    applicant: "",
    profile,
    disposition,
    submittedAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    docsDetected: dto.documentsCount,
    docsRequired: PROFILES[profile]?.requiredDocs.length ?? 0,
    issues: 0,
    lowConfidence: 0,
    stage: disposition === "in_progress" ? 1 : undefined,
  }
}
