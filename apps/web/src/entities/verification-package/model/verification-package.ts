/**
 * Verification Package — the register's core aggregate: the identity an
 * inspector cites, its disposition, and the tallies the pipeline reports.
 *
 * Package summaries are served live by the core API (`GET /api/packages`); the
 * wire DTO and the mapping into this view model live here. Fields the pipeline
 * has not produced yet (applicant, issues, confidence) are absent until their
 * stages run. Ubiquitous language follows docs/CONTEXT.md.
 *
 * What a profile expects is deliberately *not* here. That is policy the engine
 * owns and publishes (`GET /api/profiles`), and a mapper that reached for it
 * would have to keep a copy — which is how "1 of 2" came to be drawn for a demo
 * package the engine expected three documents for. A screen that wants the total
 * asks `documentsExpected` with the profiles it fetched.
 */
import type { PackageDto, PackageStatus } from "@cadastre/contracts"

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
  /** Key of the Verification Profile governing this package, as the server named it. */
  profile: string
  disposition: Disposition
  /** ISO timestamp the package was submitted. */
  submittedAt: string
  /** ISO timestamp of the last pipeline event (drives "updated Xm ago"). */
  updatedAt: string
  /** Documents the classifier has placed so far. */
  docsDetected: number
  /** Documents attached to the package — what the inspector actually uploaded. */
  docsAttached: number
  /** Validation issues raised (mismatch / expired / missing). */
  issues: number
  /** Fields flagged below the confidence threshold. */
  lowConfidence: number
  /** Lowest field confidence seen, 0–100 (undefined until extraction runs). */
  minConfidence?: number
  /** For in_progress packages: current stage 1..6. */
  stage?: number
  /** The current stage errored (e.g. a document couldn't be classified). */
  stageError?: boolean
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
 * Map a live package summary into the register's view model. Pipeline-derived
 * fields are defaulted until their stages produce real values.
 */
export function toViewPackage(dto: PackageDto): VerificationPackage {
  const disposition = dispositionOf(dto.status)
  return {
    id: dto.id,
    applicant: "",
    profile: dto.profileKey,
    disposition,
    submittedAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    // "Detected" = documents the pipeline has classified so far; grows live as
    // the register polls, from 0 up to the number uploaded.
    docsDetected: dto.classifiedCount,
    docsAttached: dto.documentsCount,
    issues: 0,
    lowConfidence: 0,
    stage: disposition === "in_progress" ? pipelineStage(dto) : undefined,
    // The classifier ran on every document but couldn't place one → the pipeline
    // halts at Classification, flagged red (it never proceeds to extraction).
    stageError:
      disposition === "in_progress" &&
      dto.documentsCount > 0 &&
      dto.classifiedCount === dto.documentsCount &&
      dto.unclassifiedCount > 0,
  }
}

/**
 * Coarse pipeline stage for the register's stage bar, from real progress: OCR
 * until any document is classified, Classification while types are still being
 * assigned, then Field extraction once extraction has produced fields. An
 * unclassifiable document halts the run at Classification. Later stages
 * (completeness → report) light up when those pipeline steps exist.
 */
function pipelineStage(dto: PackageDto): number {
  if (dto.documentsCount === 0) return 1
  if (dto.classifiedCount === 0) return 1 // OCR running
  if (dto.classifiedCount < dto.documentsCount) return 2 // classifying
  if (dto.unclassifiedCount > 0) return 2 // a document couldn't be classified
  if (dto.extractedCount > 0) return 3 // extraction reached
  return 2
}
