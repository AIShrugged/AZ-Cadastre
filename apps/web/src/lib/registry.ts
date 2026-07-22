/**
 * Domain model + authored demo register.
 *
 * All data below is SYNTHETIC — packages, applicant names, IDs, and timestamps
 * are illustrative demo material from the demo Verification Profile (PRD §4).
 * It must be replaced with live data before any real deployment. Ubiquitous
 * language follows docs/CONTEXT.md: Verification Package, Document, Disposition.
 */

export type Disposition =
  | "in_progress"
  | "ok"
  | "issues"
  | "incomplete"
  | "failed"

/** The six pipeline stages, in order (PRD §7). */
export const STAGES = 6

export type VerificationPackage = {
  /** Register number — the identity an inspector cites. */
  id: string
  /** Applicant on the package (synthetic). */
  applicant: string
  /** Which Verification Profile governs this package. */
  profile: "demo" | "cadastre"
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
}

// Timestamps are fixed strings so the demo is deterministic; "time ago" is
// computed against a reference captured once at load (see useRegisterNow).
export const PACKAGES: VerificationPackage[] = [
  {
    id: "VP-26-004821",
    applicant: "Elçin Məmmədov",
    profile: "demo",
    disposition: "in_progress",
    submittedAt: "2026-07-23T08:52:00",
    updatedAt: "2026-07-23T08:58:00",
    docsDetected: 2,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
    stage: 5,
  },
  {
    id: "VP-26-004820",
    applicant: "Nərgiz Əliyeva",
    profile: "demo",
    disposition: "issues",
    submittedAt: "2026-07-23T08:31:00",
    updatedAt: "2026-07-23T08:44:00",
    docsDetected: 3,
    docsRequired: 2,
    issues: 2,
    lowConfidence: 1,
    minConfidence: 61,
  },
  {
    id: "VP-26-004817",
    applicant: "Орхан Гулиев",
    profile: "cadastre",
    disposition: "incomplete",
    submittedAt: "2026-07-23T07:59:00",
    updatedAt: "2026-07-23T08:10:00",
    docsDetected: 1,
    docsRequired: 2,
    issues: 1,
    lowConfidence: 0,
    minConfidence: 88,
  },
  {
    id: "VP-26-004814",
    applicant: "Səbinə Hüseynova",
    profile: "demo",
    disposition: "ok",
    submittedAt: "2026-07-23T07:40:00",
    updatedAt: "2026-07-23T07:52:00",
    docsDetected: 2,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
    minConfidence: 94,
  },
  {
    id: "VP-26-004809",
    applicant: "Rəşad Quliyev",
    profile: "demo",
    disposition: "in_progress",
    submittedAt: "2026-07-23T07:22:00",
    updatedAt: "2026-07-23T07:33:00",
    docsDetected: 2,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
    stage: 2,
  },
  {
    id: "VP-26-004801",
    applicant: "Айнур Мамедова",
    profile: "cadastre",
    disposition: "failed",
    submittedAt: "2026-07-23T06:58:00",
    updatedAt: "2026-07-23T07:05:00",
    docsDetected: 0,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
  },
  {
    id: "VP-26-004796",
    applicant: "Kamran Bayramov",
    profile: "demo",
    disposition: "ok",
    submittedAt: "2026-07-22T16:41:00",
    updatedAt: "2026-07-22T16:55:00",
    docsDetected: 2,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
    minConfidence: 97,
  },
  {
    id: "VP-26-004790",
    applicant: "Gülnar İsmayılova",
    profile: "demo",
    disposition: "issues",
    submittedAt: "2026-07-22T15:10:00",
    updatedAt: "2026-07-22T15:26:00",
    docsDetected: 3,
    docsRequired: 2,
    issues: 1,
    lowConfidence: 2,
    minConfidence: 58,
  },
  {
    id: "VP-26-004783",
    applicant: "Тогрул Ахмедов",
    profile: "cadastre",
    disposition: "ok",
    submittedAt: "2026-07-22T13:03:00",
    updatedAt: "2026-07-22T13:19:00",
    docsDetected: 4,
    docsRequired: 4,
    issues: 0,
    lowConfidence: 0,
    minConfidence: 91,
  },
  {
    id: "VP-26-004778",
    applicant: "Aysel Rəhimova",
    profile: "demo",
    disposition: "incomplete",
    submittedAt: "2026-07-22T11:47:00",
    updatedAt: "2026-07-22T11:58:00",
    docsDetected: 1,
    docsRequired: 2,
    issues: 1,
    lowConfidence: 1,
    minConfidence: 72,
  },
  {
    id: "VP-26-004771",
    applicant: "Fərid Nəbiyev",
    profile: "demo",
    disposition: "ok",
    submittedAt: "2026-07-22T10:22:00",
    updatedAt: "2026-07-22T10:35:00",
    docsDetected: 2,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
    minConfidence: 96,
  },
  {
    id: "VP-26-004765",
    applicant: "Лейла Гасанова",
    profile: "cadastre",
    disposition: "issues",
    submittedAt: "2026-07-22T09:14:00",
    updatedAt: "2026-07-22T09:31:00",
    docsDetected: 4,
    docsRequired: 4,
    issues: 3,
    lowConfidence: 0,
    minConfidence: 83,
  },
  {
    id: "VP-26-004758",
    applicant: "Vüsal Cəfərov",
    profile: "demo",
    disposition: "ok",
    submittedAt: "2026-07-21T17:05:00",
    updatedAt: "2026-07-21T17:18:00",
    docsDetected: 2,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
    minConfidence: 93,
  },
  {
    id: "VP-26-004749",
    applicant: "Zeynəb Vəliyeva",
    profile: "demo",
    disposition: "failed",
    submittedAt: "2026-07-21T14:52:00",
    updatedAt: "2026-07-21T14:57:00",
    docsDetected: 1,
    docsRequired: 2,
    issues: 0,
    lowConfidence: 0,
  },
  {
    id: "VP-26-004741",
    applicant: "Ниджат Алиев",
    profile: "cadastre",
    disposition: "ok",
    submittedAt: "2026-07-21T11:38:00",
    updatedAt: "2026-07-21T11:54:00",
    docsDetected: 4,
    docsRequired: 4,
    issues: 0,
    lowConfidence: 0,
    minConfidence: 95,
  },
  {
    id: "VP-26-004736",
    applicant: "Türkan Abbasova",
    profile: "demo",
    disposition: "issues",
    submittedAt: "2026-07-21T09:20:00",
    updatedAt: "2026-07-21T09:37:00",
    docsDetected: 3,
    docsRequired: 2,
    issues: 1,
    lowConfidence: 1,
    minConfidence: 64,
  },
]

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
