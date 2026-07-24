/**
 * Verification details — the inspector's review surface for one package. Reads
 * live pipeline output from `GET /api/packages/:id`: the process stepper, then
 * every document with its detected type and the real OCR text per page. Fields /
 * validation / report appear here as those pipeline stages are built. It reports
 * evidence; it never states an approval or a verdict.
 */
import { useState, type ReactNode } from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImageIcon,
  ScanTextIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { skipToken } from "@reduxjs/toolkit/query"
import type {
  DocumentDto,
  FieldDto,
  PackageDetailDto,
} from "@cadastre/contracts"

import { Button } from "@/shared/ui/button"
import {
  DispositionMark,
  STAGES,
  toViewPackage,
  useGetPackageQuery,
  type Disposition,
} from "@/entities/verification-package"
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from "@/shared/ui/surface"
import { formatDate, relativeShort, useI18n } from "@/shared/i18n"
import { Skeleton } from "@/shared/ui/skeleton"
import { paths } from "@/shared/config"
import { cn } from "@/shared/lib/cn"

type StageStatus = "done" | "current" | "pending" | "error"

// ─── Pipeline stepper ─────────────────────────────────────────────────────────
function StageNode({ status, n }: { status: StageStatus; n: number }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border-2 text-[0.6875rem] font-semibold tabular-nums transition-colors duration-300",
        status === "done" && "border-ok-ink bg-ok-ink text-background",
        status === "current" && "border-primary text-primary",
        status === "pending" && "border-rule-strong text-muted-foreground",
        status === "error" && "border-destructive bg-destructive text-white",
      )}
    >
      {status === "done" ? (
        <CheckIcon className="size-3.5" strokeWidth={3} />
      ) : status === "error" ? (
        <TriangleAlertIcon className="size-3.5" />
      ) : (
        n
      )}
    </span>
  )
}

type ConnectorState = "done" | "pending" | "hidden"

function Connector({ state }: { state: ConnectorState }) {
  if (state === "hidden") return <span className="h-0.5 flex-1" />
  return (
    <span
      className={cn(
        "h-0.5 flex-1 rounded transition-colors duration-500",
        state === "done" ? "bg-ok-ink" : "bg-rule",
      )}
    />
  )
}

function Stepper({ stages }: { stages: StageStatus[] }) {
  const { t } = useI18n()
  const stateOf = (i: number, side: "left" | "right"): ConnectorState => {
    if (side === "left" && i === 0) return "hidden"
    if (side === "right" && i === stages.length - 1) return "hidden"
    const s = side === "left" ? stages[i - 1] : stages[i]
    return s === "done" ? "done" : "pending"
  }
  return (
    <ol className="flex min-w-max items-start md:min-w-0">
      {stages.map((st, i) => (
        <li key={i} className="flex flex-1 flex-col items-center gap-2 px-1">
          <div className="flex w-full items-center">
            <Connector state={stateOf(i, "left")} />
            <StageNode status={st} n={i + 1} />
            <Connector state={stateOf(i, "right")} />
          </div>
          <span
            className={cn(
              "min-w-[4rem] max-w-[6rem] text-center text-[0.6875rem] leading-tight transition-colors duration-300",
              st === "current"
                ? "font-medium text-primary"
                : st === "done"
                  ? "text-ok-ink"
                  : st === "error"
                    ? "font-medium text-destructive"
                    : "text-muted-foreground",
            )}
          >
            {t(`stage.${i + 1}`)}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Real per-stage status from pipeline output. OCR + Classification are wired;
 *  later stages stay pending until they exist. */
function stageStatuses(
  pkg: PackageDetailDto,
  disposition: Disposition,
): StageStatus[] {
  const total = pkg.documentsCount
  const ocrDone =
    total > 0 &&
    pkg.documents.every(
      (d) => d.pages.length > 0 && d.pages.every((p) => p.ocr !== null),
    )
  const classifyDone = total > 0 && pkg.classifiedCount === total

  const stages: StageStatus[] = Array.from({ length: STAGES }, () => "pending")
  if (disposition === "failed") {
    stages[0] = ocrDone ? "done" : "error"
    if (ocrDone) stages[1] = "error"
    return stages
  }
  stages[0] = ocrDone ? "done" : "current"
  stages[1] = classifyDone ? "done" : ocrDone ? "current" : "pending"
  return stages
}

// ─── Confidence ────────────────────────────────────────────────────────────────
// A machine-read value: tabular mono, and below the 80% threshold it flags for
// review in the clay "incomplete" ink (PRD §4.6).
const CONFIDENCE_FLOOR = 0.8

function Confidence({ value }: { value: number }) {
  const { t } = useI18n()
  const low = value < CONFIDENCE_FLOOR
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {low && (
        <span className="rounded-full bg-incomplete/12 px-1.5 py-0.5 text-[0.625rem] font-medium text-incomplete-ink">
          {t("detail.needs_review")}
        </span>
      )}
      <span
        data-mono
        className={cn(
          "text-[0.75rem] tabular-nums",
          low ? "font-medium text-incomplete-ink" : "text-muted-foreground",
        )}
      >
        {Math.round(value * 100)}%
      </span>
    </span>
  )
}

// A single labelled status marker: tinted dot-chip + word, never colour alone.
function StatusLine({
  tone,
  icon,
  label,
}: {
  tone: "ok" | "fail" | "pending"
  icon: ReactNode
  label: string
}) {
  return (
    <span className="flex items-center gap-2 text-[0.8125rem]">
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full",
          tone === "ok" && "bg-ok/12 text-ok-ink",
          tone === "fail" && "bg-failed/12 text-failed-ink",
          tone === "pending" && "text-primary",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          tone === "fail"
            ? "font-medium text-failed-ink"
            : "text-foreground/80",
        )}
      >
        {label}
      </span>
    </span>
  )
}

// ─── OCR status ────────────────────────────────────────────────────────────────
// Replaces the raw transcription with one legible line — recognised / failed /
// pending, plus the reading confidence — and keeps the text one disclosure away
// so the provenance is never lost (Product Principle 2).
function OcrStatus({ doc, failed }: { doc: DocumentDto; failed: boolean }) {
  const { t } = useI18n()
  const recognised = doc.pages.filter((p) => p.ocr)
  const done = doc.pages.length > 0 && recognised.length === doc.pages.length

  if (!done) {
    return failed ? (
      <StatusLine
        tone="fail"
        icon={<TriangleAlertIcon className="size-3" />}
        label={t("detail.ocr_failed")}
      />
    ) : (
      <StatusLine
        tone="pending"
        icon={
          <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
        }
        label={t("detail.ocr_pending")}
      />
    )
  }

  const avg =
    recognised.reduce((sum, p) => sum + (p.ocr?.confidence ?? 0), 0) /
    recognised.length

  return (
    <div className="flex items-center justify-between gap-3">
      <StatusLine
        tone="ok"
        icon={<CheckIcon className="size-3" strokeWidth={3} />}
        label={t("detail.ocr_done")}
      />
      <Confidence value={avg} />
    </div>
  )
}

// ─── Recognized text ─────────────────────────────────────────────────────────
// The full transcription, kept one disclosure away and pushed to the foot of the
// document so it never crowds the status line or the fields — traceable on
// demand, out of the way otherwise.
function RecognizedText({ doc }: { doc: DocumentDto }) {
  const { t } = useI18n()
  const text = doc.pages
    .map((p) => p.ocr?.text ?? "")
    .join("\n\n")
    .trim()
  if (!text) return null
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none select-none items-center gap-1 text-[0.6875rem] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRightIcon className="size-3 transition-transform duration-200 group-open:rotate-90" />
        {t("detail.view_text")}
      </summary>
      <pre
        data-mono
        className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-rule bg-muted/30 p-3 text-[0.75rem] leading-relaxed text-foreground/80"
      >
        {text}
      </pre>
    </details>
  )
}

// ─── Extracted fields ────────────────────────────────────────────────────────
// The type's schema, filled in: label over the machine-read value, each carrying
// its own confidence so provenance travels with every field.
function Fields({ fields }: { fields: FieldDto[] }) {
  const { t } = useI18n()
  return (
    <dl className="grid grid-cols-1 border-t border-rule sm:grid-cols-2 sm:gap-x-10">
      {fields.map((f) => (
        <div
          key={f.name}
          className="flex items-baseline justify-between gap-3 border-b border-rule py-2.5"
        >
          <div className="min-w-0">
            <dt className="text-[0.6875rem] text-muted-foreground">
              {t(`field.${f.name}`)}
            </dt>
            <dd
              data-mono
              className={cn(
                "mt-0.5 truncate text-[0.875rem]",
                f.confidence < CONFIDENCE_FLOOR
                  ? "text-incomplete-ink"
                  : "text-foreground",
              )}
            >
              {f.value || "—"}
            </dd>
          </div>
          <Confidence value={f.confidence} />
        </div>
      ))}
    </dl>
  )
}

// ─── One document ────────────────────────────────────────────────────────────
function DocumentBlock({
  doc,
  failed,
}: {
  doc: DocumentDto
  failed: boolean
}) {
  const { t } = useI18n()
  const Icon = doc.contentType.startsWith("image/") ? ImageIcon : FileTextIcon
  const unclassified = doc.type === "unknown"
  // Unclassified: skip the transcription, show a one-line preview so the
  // inspector can still tell roughly what the document is.
  const snippet = unclassified
    ? doc.pages
        .map((p) => p.ocr?.text ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120)
    : ""

  return (
    <div>
      {/* Header — filename + detected type */}
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-rule-strong bg-card text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-[0.9375rem] font-semibold text-foreground">
              {doc.originalFilename}
            </h3>
            {doc.type ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                  unclassified
                    ? "border border-rule-strong bg-muted/40 text-muted-foreground"
                    : "border border-primary/20 bg-primary/8 text-primary",
                )}
              >
                {t(`doctype.${doc.type}`)}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 text-[0.6875rem] font-medium text-primary">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
                />
                {t("detail.classifying")}
              </span>
            )}
          </div>
          <div
            data-mono
            className="truncate text-[0.6875rem] text-muted-foreground"
          >
            {doc.contentType} ·{" "}
            {doc.pages.length === 1
              ? t("new.page_one")
              : t("new.pages", { n: doc.pages.length })}
          </div>
        </div>
      </div>

      {/* Body — status, then fields, with the raw transcription at the foot */}
      {unclassified ? (
        <div className="mt-4 flex flex-col gap-5 border-t border-rule pt-4">
          <div className="flex flex-col gap-2.5">
            <OcrStatus doc={doc} failed={failed} />
            <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
              {t("detail.unclassified")}
              {snippet && (
                <span className="mt-1.5 block truncate text-[0.75rem] italic text-foreground/55">
                  “{snippet}…”
                </span>
              )}
            </p>
          </div>
          <RecognizedText doc={doc} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-5 border-t border-rule pt-4">
          <OcrStatus doc={doc} failed={failed} />

          {doc.fields.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <ScanTextIcon className="size-3.5 text-muted-foreground" />
                <span className="register-label">{t("detail.fields")}</span>
              </div>
              <Fields fields={doc.fields} />
            </div>
          )}

          <RecognizedText doc={doc} />
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function VerificationDetails() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()

  // Poll while the pipeline is still working; stop once it settles. The toggle
  // is adjusted during render (no effect) from the data we just received.
  const [polling, setPolling] = useState(true)
  const {
    data: pkg,
    isLoading,
    isError,
  } = useGetPackageQuery(id ?? skipToken, {
    pollingInterval: polling ? 1500 : 0,
    skipPollingIfUnfocused: true,
  })
  const shouldPoll =
    pkg?.status === "Pending" || pkg?.status === "Processing"
  if (shouldPoll !== polling) setPolling(shouldPoll)

  if (isLoading) {
    return (
      <SurfacePage>
        <SurfaceHeading title={t("col.status")} />
        <SurfaceBody>
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 md:px-8">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </SurfaceBody>
      </SurfacePage>
    )
  }

  if (isError || !pkg) {
    return (
      <SurfacePage>
        <SurfaceHeading
          title={t("detail.notfound.title")}
          subtitle={t("detail.notfound.body")}
        />
        <SurfaceBody>
          <div className="px-4 py-8 md:px-6">
            <Button variant="outline" onClick={() => navigate(paths.register)}>
              <ArrowLeftIcon /> {t("detail.back")}
            </Button>
          </div>
        </SurfaceBody>
      </SurfacePage>
    )
  }

  const view = toViewPackage(pkg)
  const profileName = t(
    view.profile === "demo" ? "profile.demo" : "profile.cadastre",
  )
  const subtitle = `${profileName} · ${formatDate(pkg.createdAt, locale)}`
  const stages = stageStatuses(pkg, view.disposition)
  const currentStage = stages.findIndex((s) => s === "current")

  return (
    <SurfacePage>
      <SurfaceHeading
        title={pkg.id}
        badge={<DispositionMark disposition={view.disposition} />}
        subtitle={subtitle}
      />

      <SurfaceBody>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-9 px-4 py-7 md:px-8 md:py-9">
          {/* ── Process ── */}
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="register-label">{t("detail.process")}</h2>
              {currentStage >= 0 && (
                <span className="flex items-center gap-1.5 text-[0.75rem] font-medium text-primary">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
                  />
                  {t(`stage.${currentStage + 1}`)} {t("detail.stage_running")}
                </span>
              )}
            </div>
            <div className="overflow-x-auto pb-1">
              <Stepper stages={stages} />
            </div>
          </section>

          {/* ── Documents + OCR ── */}
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="register-label">{t("detail.documents")}</h2>
              <span
                data-mono
                className="text-[0.75rem] tabular-nums text-muted-foreground"
              >
                {t("detail.docs_count", {
                  d: pkg.classifiedCount,
                  r: pkg.documentsCount,
                })}
              </span>
            </div>
            <div className="mt-4 flex flex-col divide-y divide-rule-strong">
              {pkg.documents.map((doc) => (
                <div key={doc.id} className="py-5 first:pt-0 last:pb-0">
                  <DocumentBlock
                    doc={doc}
                    failed={view.disposition === "failed"}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </SurfaceBody>

      <SurfaceFooter>
        <span className="text-[0.8125rem] text-muted-foreground">
          {t("updated.ago", { t: relativeShort(pkg.updatedAt, Date.now()) })}
        </span>
        <Button variant="outline" onClick={() => navigate(paths.register)}>
          <ArrowLeftIcon /> {t("detail.back")}
        </Button>
      </SurfaceFooter>
    </SurfacePage>
  )
}
