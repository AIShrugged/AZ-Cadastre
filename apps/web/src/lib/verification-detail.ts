/**
 * Verification detail — synthetic per-package evidence for the details surface.
 *
 * The register store only holds package summaries; the pipeline's real output
 * (documents, OCR, extracted fields, validation issues) is generated here,
 * deterministically from the package id so a given package always looks the
 * same. It stays consistent with the summary counts the register shows. All
 * SYNTHETIC demo data — replace with live pipeline results before deployment.
 */
import {
  PROFILES,
  STAGES,
  type DocTypeKey,
  type VerificationPackage,
} from "@/lib/registry"

export type ExtractedField = {
  key: string
  value: string
  /** 0–100 */
  confidence: number
  page: number
  /** below the profile's confidence threshold (80%) */
  low?: boolean
}

export type DetectedDocument = {
  id: string
  type: DocTypeKey
  fileName: string
  pages: number
  /** 0–100 */
  ocrConfidence: number
  fields: ExtractedField[]
  /** extraction has not run yet (package still in progress) */
  pending: boolean
}

export type IssueKind = "missing" | "mismatch" | "expired" | "low_confidence"

export type ValidationIssue = {
  id: string
  kind: IssueKind
  docType?: DocTypeKey
  /** the other side of a cross-document mismatch */
  otherDocType?: DocTypeKey
  fieldKey?: string
  page?: number
  confidence?: number
}

export type StageStatus = "done" | "current" | "pending" | "error"

export type PackageDetail = {
  detectedCount: number
  requiredCount: number
  missingTypes: DocTypeKey[]
  documents: DetectedDocument[]
  /** missing + mismatch + expired, in report order */
  issues: ValidationIssue[]
  lowConfidenceFields: { docType: DocTypeKey; fieldKey: string; confidence: number; page: number }[]
  /** per-stage status for the pipeline stepper, index 0 = stage 1 */
  stages: StageStatus[]
  currentStage: number
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
export const FIELD_SCHEMA: Record<DocTypeKey, string[]> = {
  passport: ["first_name", "last_name", "dob", "passport_no", "expiry"],
  driver_license: ["first_name", "last_name", "license_no", "expiry"],
  application: ["applicant_name", "passport_no", "license_no"],
  title_deed: ["owner_name", "parcel_id", "issue_date"],
  cadastral_extract: ["parcel_id", "area", "registry_date"],
}

const DOC_FILE: Record<DocTypeKey, string> = {
  passport: "passport.pdf",
  driver_license: "driver-license.pdf",
  application: "application.pdf",
  title_deed: "title-deed.pdf",
  cadastral_extract: "cadastral-extract.jpg",
}

const DOC_PAGES: Record<DocTypeKey, number> = {
  passport: 2,
  driver_license: 1,
  application: 1,
  title_deed: 3,
  cadastral_extract: 1,
}

// ─── Deterministic pseudo-random (seeded by id; no Math.random) ──────────────
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function rng(seed: number) {
  let s = seed || 1
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}
function digits(rand: () => number, n: number): string {
  let s = ""
  for (let i = 0; i < n; i++) s += Math.floor(rand() * 10)
  return s
}
function dateStr(rand: () => number, y0: number, y1: number): string {
  const y = y0 + Math.floor(rand() * (y1 - y0 + 1))
  const m = 1 + Math.floor(rand() * 12)
  const d = 1 + Math.floor(rand() * 28)
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`
}
function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return [parts[0] ?? "", ""]
  return [parts[0], parts.slice(1).join(" ")]
}

function fieldValue(
  key: string,
  pkg: VerificationPackage,
  rand: () => number,
  expired: boolean,
): string {
  const [first, last] = splitName(pkg.applicant)
  switch (key) {
    case "first_name":
      return first
    case "last_name":
      return last
    case "applicant_name":
    case "owner_name":
      return pkg.applicant
    case "dob":
      return dateStr(rand, 1965, 1998)
    case "expiry":
      return expired ? dateStr(rand, 2019, 2024) : dateStr(rand, 2027, 2032)
    case "passport_no":
      return "AZE" + digits(rand, 7)
    case "license_no":
      return "AZ" + digits(rand, 8)
    case "parcel_id":
      return "AZ-CAD-" + digits(rand, 4) + "-" + digits(rand, 3)
    case "area":
      return digits(rand, 3) + " m²"
    case "issue_date":
      return dateStr(rand, 2016, 2023)
    case "registry_date":
      return dateStr(rand, 2018, 2024)
    default:
      return "—"
  }
}

export function buildDetail(pkg: VerificationPackage): PackageDetail {
  const rand = rng(hash(pkg.id))
  const required = PROFILES[pkg.profile].requiredDocs
  const failed = pkg.disposition === "failed"
  const inProgress = pkg.disposition === "in_progress"
  const currentStage = pkg.stage ?? (failed ? 2 : STAGES)

  // Which document types were detected (with an extra recognizable type when the
  // package detected more than the profile requires), and which are missing.
  const detectN = Math.min(pkg.docsDetected, required.length)
  let types = required.slice(0, detectN)
  if (pkg.docsDetected > required.length) {
    const extras: DocTypeKey[] = ["driver_license"]
    types = [...required, ...extras].slice(0, pkg.docsDetected)
  }
  const missingTypes = required.slice(types.length)

  const extractionDone = !inProgress ? !failed || currentStage > 3 : currentStage > 3
  const validationDone = !inProgress ? !failed || currentStage >= 5 : currentStage >= 5

  // Plan issues before building fields so an "expired" document renders a past
  // expiry value. Missing documents come first (report order).
  const has = (t: DocTypeKey) => types.includes(t)
  const plannedIssues: ValidationIssue[] = missingTypes.map((t, i) => ({
    id: `iss-m-${i}`,
    kind: "missing",
    docType: t,
  }))
  const expiredDocs = new Set<DocTypeKey>()
  if (validationDone) {
    let n = plannedIssues.length
    const target = pkg.issues
    if (n < target && has("passport") && (has("driver_license") || has("application"))) {
      const other: DocTypeKey = has("driver_license") ? "driver_license" : "application"
      plannedIssues.push({
        id: "iss-x",
        kind: "mismatch",
        docType: "passport",
        otherDocType: other,
        fieldKey: "last_name",
        page: 1,
        confidence: 90 + Math.floor(rand() * 8),
      })
      n++
    }
    if (n < target && (has("driver_license") || has("passport"))) {
      const d: DocTypeKey = has("driver_license") ? "driver_license" : "passport"
      expiredDocs.add(d)
      plannedIssues.push({ id: "iss-e", kind: "expired", docType: d })
      n++
    }
    // pad rare remainder with an expiry on any expiry-bearing doc
    while (n < target && has("passport") && !expiredDocs.has("passport")) {
      expiredDocs.add("passport")
      plannedIssues.push({ id: `iss-e2`, kind: "expired", docType: "passport" })
      n++
    }
  }

  // Build documents + fields.
  const documents: DetectedDocument[] = types.map((type, di) => {
    const pending = !extractionDone
    const fields: ExtractedField[] = pending
      ? []
      : FIELD_SCHEMA[type].map((key, fi) => ({
          key,
          value: fieldValue(key, pkg, rand, expiredDocs.has(type)),
          confidence: 90 + Math.floor(rand() * 9),
          page: type === "passport" && fi >= 3 ? 2 : 1,
        }))
    return {
      id: `doc-${di}`,
      type,
      fileName: DOC_FILE[type],
      pages: DOC_PAGES[type],
      ocrConfidence: 90 + Math.floor(rand() * 9),
      fields,
      pending,
    }
  })

  // Mark low-confidence fields (lowest = the package's recorded minimum).
  const lowConfidenceFields: PackageDetail["lowConfidenceFields"] = []
  if (validationDone && pkg.lowConfidence > 0) {
    const flat = documents.flatMap((d) => d.fields.map((f) => ({ doc: d, field: f })))
    const lowest = pkg.minConfidence ?? 68
    for (let i = 0; i < pkg.lowConfidence && flat.length; i++) {
      // spread the flags across the extracted set, deterministically
      const pick = flat[(i * 3 + 1) % flat.length]
      const conf = i === 0 ? lowest : Math.min(79, lowest + 4 + i * 3)
      pick.field.confidence = conf
      pick.field.low = true
      lowConfidenceFields.push({
        docType: pick.doc.type,
        fieldKey: pick.field.key,
        confidence: conf,
        page: pick.field.page,
      })
    }
  }

  // Pipeline stepper status per stage.
  const stages: StageStatus[] = Array.from({ length: STAGES }, (_, i) => {
    const stageNo = i + 1
    if (failed) {
      if (stageNo < currentStage) return "done"
      if (stageNo === currentStage) return "error"
      return "pending"
    }
    if (inProgress) {
      if (stageNo < currentStage) return "done"
      if (stageNo === currentStage) return "current"
      return "pending"
    }
    return "done"
  })

  return {
    detectedCount: pkg.docsDetected,
    requiredCount: required.length,
    missingTypes,
    documents,
    issues: plannedIssues,
    lowConfidenceFields,
    stages,
    currentStage,
  }
}
