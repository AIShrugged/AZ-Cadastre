/**
 * Verification details — the inspector's review surface for one package. Reads
 * live pipeline output from `GET /api/packages/:id`: the process stepper, then
 * every document with its detected type and the real OCR text per page. Fields /
 * validation / report appear here as those pipeline stages are built. It reports
 * evidence; it never states an approval or a verdict.
 */
import { useState } from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  FileTextIcon,
  ImageIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { skipToken } from "@reduxjs/toolkit/query"
import type { DocumentDto, PackageDetailDto } from "@cadastre/contracts"

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

// ─── One document + its OCR ────────────────────────────────────────────────────
function DocumentBlock({ doc }: { doc: DocumentDto }) {
  const { t } = useI18n()
  const Icon = doc.contentType.startsWith("image/") ? ImageIcon : FileTextIcon
  return (
    <div>
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
              <span className="shrink-0 rounded-full border border-rule-strong bg-muted/40 px-2 py-0.5 text-[0.6875rem] font-medium text-foreground/80">
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

      <div className="mt-3 flex flex-col gap-3 border-t border-rule pt-3.5">
        {doc.pages.map((page) => (
          <div key={page.pageNumber}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="register-label">
                {t("detail.page", { n: page.pageNumber })}
              </span>
              {page.ocr && (
                <span
                  data-mono
                  className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground"
                >
                  {t("detail.ocr")} {Math.round(page.ocr.confidence * 100)}%
                </span>
              )}
            </div>
            {page.ocr ? (
              <pre
                data-mono
                className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-rule bg-muted/30 p-3 text-[0.75rem] leading-relaxed text-foreground/90"
              >
                {page.ocr.text}
              </pre>
            ) : (
              <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
                />
                {t("detail.ocr_pending")}
              </p>
            )}
          </div>
        ))}
      </div>
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
                  <DocumentBlock doc={doc} />
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
