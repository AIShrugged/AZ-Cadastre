/**
 * Verification Package — the register's core aggregate: the identity an
 * inspector cites, its disposition, and the tallies the pipeline reports.
 *
 * Package summaries are served live by the core API (`GET /api/packages`); the
 * wire DTO and the mapping into this view model live here. Findings come from
 * the report the run finished with, so they are absent until it has; the
 * applicant is still ahead of the pipeline. Ubiquitous language follows
 * packages/verification/CONTEXT.md.
 *
 * What a profile expects is deliberately *not* here. That is policy the engine
 * owns and publishes (`GET /api/profiles`), and a mapper that reached for it
 * would have to keep a copy — which is how "1 of 2" came to be drawn for a
 * package the engine expected three documents for. A screen that wants the total
 * asks `documentsExpected` with the profiles it fetched.
 */
import type {
  PackageDto,
  PackageStatus,
  ReportStatus,
} from "@cadastre/api-contracts/verification"

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
  docsClassified: number
  /**
   * Documents the pipeline found inside the uploaded files. A file is a
   * container — one PDF may hold several documents — so this is 0 until
   * detection has run and can exceed `filesAttached`.
   */
  docsFound: number
  /** Files the inspector uploaded. Known from the moment the package exists. */
  filesAttached: number
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

/**
 * The package's id as a register reference — the first block of the uuid the
 * database issues. A uuid is how the system names a package, not how a person
 * reads one back: thirty-six characters of hexadecimal cannot be compared down
 * a column, held in the head between two screens, or read aloud over a desk.
 *
 * The short form is a reference, never the identity: the full id travels with
 * it wherever it is shown (the row's title, the details subtitle, the URL), and
 * search still matches on the whole of it, so an id handed over in full still
 * finds its package.
 */
export function packageRef(id: string): string {
  return id.split("-")[0] ?? id
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
// PackageDto / PackageStatus are the shared contracts (@cadastre/api-contracts);
// this maps them into the register's richer view model.

/**
 * What the register stamps on the row. The pipeline lifecycle only says whether
 * a run finished; what it *found* is the report's to say, and every finished run
 * has one — a run is never stopped by what it could not read, so "Completed"
 * covers packages with findings as readily as clean ones.
 */
function dispositionOf(
  status: PackageStatus,
  reportStatus: ReportStatus | null,
): Disposition {
  switch (status) {
    case "Pending":
    case "Processing":
      return "in_progress"
    case "Completed":
      if (reportStatus === "IncompletePackage") return "incomplete"
      if (reportStatus === "IssuesFound") return "issues"
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
  const disposition = dispositionOf(dto.status, dto.reportStatus)
  return {
    id: dto.id,
    applicant: "",
    profile: dto.profileKey,
    disposition,
    submittedAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    // Grows live as the register polls: detection finds the documents, then
    // classification places them one by one.
    docsClassified: dto.classifiedCount,
    docsFound: dto.documentsCount,
    filesAttached: dto.filesCount,
    issues: dto.issuesCount,
    lowConfidence: dto.lowConfidenceCount,
    stage: disposition === "in_progress" ? pipelineStage(dto) : undefined,
  }
}

/**
 * Coarse pipeline stage for the register's stage bar, from real progress:
 * reading while no document has been found yet, Classification while types are
 * still being assigned, then Field extraction once extraction has produced
 * fields. A document the classifier cannot place no longer halts anything — it
 * becomes a finding, so the run walks on to the completeness check and the
 * report, which are compiled together when it finishes.
 *
 * A summary carries counts, not per-file progress, so it cannot separate OCR
 * from Document detection — both read as stage 1 here. The detail screen has
 * the files themselves and reports the two apart.
 */
function pipelineStage(dto: PackageDto): number {
  if (dto.documentsCount === 0) return 1 // reading the files
  if (dto.classifiedCount < dto.documentsCount) return 3 // classifying
  if (dto.extractedCount > 0) return 4 // extraction reached
  return 3
}
