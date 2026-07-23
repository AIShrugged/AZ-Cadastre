/**
 * Verification details — the inspector's review surface for one package, laid
 * out as a single inspection record that reads top to bottom: the pipeline
 * process, then the validation findings (missing docs, mismatches, expirations,
 * low-confidence fields), then every detected document with its extracted
 * fields. Evidence carries its provenance — each field shows confidence and
 * page. It reports; it never states an approval or a verdict.
 */
import { useEffect, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckIcon,
  CircleStopIcon,
  FileTextIcon,
  FileX2Icon,
  GaugeIcon,
  GitCompareIcon,
  ImageIcon,
  RotateCwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DispositionMark } from "@/components/register/status-mark"
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from "@/components/register/surface"
import { formatDate, relativeShort, useI18n } from "@/lib/i18n"
import { usePackages } from "@/lib/packages-store"
import { paths } from "@/lib/paths"
import { type DocTypeKey } from "@/lib/registry"
import {
  buildDetail,
  type DetectedDocument,
  type IssueKind,
  type StageStatus,
} from "@/lib/verification-detail"
import { cn } from "@/lib/utils"

const NOW = new Date("2026-07-23T09:00:00").getTime()

// ─── Pipeline stepper ─────────────────────────────────────────────────────────
function StageNode({ status, n }: { status: StageStatus; n: number }) {
  return (
    <span
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-full border-2 text-[0.6875rem] font-semibold tabular-nums transition-colors",
        status === "done" && "border-foreground bg-foreground text-background",
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
      {status === "current" && (
        <span className="absolute inset-0 animate-pulse rounded-full ring-2 ring-primary/40" />
      )}
    </span>
  )
}

function Stepper({ stages }: { stages: StageStatus[] }) {
  const { t } = useI18n()
  return (
    <ol className="flex min-w-max items-start md:min-w-0">
      {stages.map((st, i) => {
        const leftDone = i > 0 && stages[i - 1] === "done"
        const rightDone = st === "done"
        return (
          <li key={i} className="flex flex-1 flex-col items-center gap-2 px-1">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1 rounded",
                  i === 0 ? "opacity-0" : leftDone ? "bg-foreground" : "bg-rule",
                )}
              />
              <StageNode status={st} n={i + 1} />
              <span
                className={cn(
                  "h-0.5 flex-1 rounded",
                  i === stages.length - 1 ? "opacity-0" : rightDone ? "bg-foreground" : "bg-rule",
                )}
              />
            </div>
            <span
              className={cn(
                "min-w-[4rem] max-w-[6rem] text-center text-[0.6875rem] leading-tight",
                st === "current"
                  ? "font-medium text-primary"
                  : st === "done"
                    ? "text-foreground/70"
                    : st === "error"
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
              )}
            >
              {t(`stage.${i + 1}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Confidence ───────────────────────────────────────────────────────────────
function Confidence({ value, low }: { value: number; low?: boolean }) {
  const { t } = useI18n()
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {low && (
        <span className="rounded-full bg-incomplete/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-incomplete-ink">
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
        {value}%
      </span>
    </span>
  )
}

// ─── Findings ─────────────────────────────────────────────────────────────────
const FINDING_META: Record<IssueKind, { icon: LucideIcon; tile: string }> = {
  missing: { icon: FileX2Icon, tile: "bg-incomplete/12 text-incomplete-ink" },
  mismatch: { icon: GitCompareIcon, tile: "bg-issues/15 text-issues-ink" },
  expired: { icon: CalendarClockIcon, tile: "bg-failed/12 text-failed-ink" },
  low_confidence: { icon: GaugeIcon, tile: "bg-incomplete/12 text-incomplete-ink" },
}

function FindingRow({
  kind,
  title,
  sub,
}: {
  kind: IssueKind
  title: React.ReactNode
  sub: string
}) {
  const { icon: Icon, tile } = FINDING_META[kind]
  return (
    <li className="flex items-start gap-3 border-b border-rule py-3">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", tile)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.875rem] leading-snug text-foreground">{title}</div>
        <div className="mt-0.5 text-[0.75rem] text-muted-foreground">{sub}</div>
      </div>
    </li>
  )
}

// ─── One document + its fields ────────────────────────────────────────────────
function DocumentBlock({ doc }: { doc: DetectedDocument }) {
  const { t } = useI18n()
  const Icon = doc.fileName.endsWith(".jpg") || doc.fileName.endsWith(".png") ? ImageIcon : FileTextIcon
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-rule-strong bg-card text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-[0.9375rem] font-semibold text-foreground">
              {t(`doctype.${doc.type}`)}
            </h3>
            {!doc.pending && (
              <span data-mono className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
                {t("detail.ocr")} {doc.ocrConfidence}%
              </span>
            )}
          </div>
          <div data-mono className="truncate text-[0.6875rem] text-muted-foreground">
            {doc.fileName} · {doc.pages === 1 ? t("new.page_one") : t("new.pages", { n: doc.pages })}
          </div>
        </div>
      </div>

      {doc.pending ? (
        <p className="mt-3 flex items-center gap-2 border-t border-rule pt-3 text-[0.8125rem] text-muted-foreground">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary" />
          {t("detail.pending")}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-3.5 border-t border-rule pt-3.5 sm:grid-cols-2">
          {doc.fields.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[0.6875rem] text-muted-foreground">{t(`field.${f.key}`)}</div>
                <div
                  data-mono
                  className={cn(
                    "truncate text-[0.875rem]",
                    f.low ? "text-incomplete-ink" : "text-foreground",
                  )}
                >
                  {f.value}
                </div>
              </div>
              <Confidence value={f.confidence} low={f.low} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── State panel (clean / in-progress / failed) ───────────────────────────────
function StatePanel({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon
  tone: "ok" | "muted" | "failed"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-3 rounded-xl border p-4",
        tone === "ok" && "border-ok/25 bg-ok/5",
        tone === "muted" && "border-rule bg-muted/30",
        tone === "failed" && "border-failed/25 bg-failed/5",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          tone === "ok" && "bg-ok/12 text-ok-ink",
          tone === "muted" && "bg-primary/10 text-primary",
          tone === "failed" && "bg-failed/12 text-failed-ink",
        )}
      >
        <Icon className={cn("size-4", tone === "muted" && "animate-pulse")} />
      </span>
      <p className="text-[0.875rem] leading-relaxed text-foreground/90">{children}</p>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function VerificationDetails() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const { packages, updatePackage } = usePackages()
  const pkg = packages.find((p) => p.id === id)

  // Two-click confirm for the destructive Cancel; auto-resets after a beat.
  const [confirmCancel, setConfirmCancel] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  if (!pkg) {
    return (
      <SurfacePage>
        <SurfaceHeading title={t("detail.notfound.title")} subtitle={t("detail.notfound.body")} />
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

  const detail = buildDetail(pkg)
  const profileName = t(pkg.profile === "demo" ? "profile.demo" : "profile.cadastre")
  const subtitle = `${pkg.applicant || "—"} · ${profileName} · ${formatDate(pkg.submittedAt, locale)}`
  const docName = (d: DocTypeKey) => t(`doctype.${d}`)

  // ── Pipeline control (mock) ──
  const isRunning = pkg.disposition === "in_progress"
  const isFailed = pkg.disposition === "failed"
  const nowIso = () => new Date().toISOString()
  function restart() {
    updatePackage(pkg!.id, { disposition: "in_progress", stage: 1, updatedAt: nowIso() })
    toast(t("toast.restarted", { id: pkg!.id }))
  }
  function armCancel() {
    setConfirmCancel(true)
    clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmCancel(false), 4000)
  }
  function cancelRun() {
    clearTimeout(confirmTimer.current)
    setConfirmCancel(false)
    updatePackage(pkg!.id, {
      disposition: "failed",
      stage: detail.currentStage,
      updatedAt: nowIso(),
    })
    toast(t("toast.cancelled", { id: pkg!.id }))
  }

  // Flatten the report into a single scannable findings list, in report order.
  type Finding = { id: string; kind: IssueKind; title: React.ReactNode; sub: string }
  const findings: Finding[] = []
  detail.missingTypes.forEach((tp, i) =>
    findings.push({ id: `m${i}`, kind: "missing", title: docName(tp), sub: t("detail.f.missing_sub") }),
  )
  detail.issues
    .filter((x) => x.kind === "mismatch")
    .forEach((m) =>
      findings.push({
        id: m.id,
        kind: "mismatch",
        title: (
          <span>
            {docName(m.docType!)} · {t(`field.${m.fieldKey}`)}
            <span aria-hidden className="px-1.5 font-medium text-muted-foreground">≠</span>
            {docName(m.otherDocType!)} · {t(`field.${m.fieldKey}`)}
          </span>
        ),
        sub: t("detail.page", { n: m.page ?? 1 }),
      }),
    )
  detail.issues
    .filter((x) => x.kind === "expired")
    .forEach((e) => {
      const exp = detail.documents.find((d) => d.type === e.docType)?.fields.find((f) => f.key === "expiry")?.value
      findings.push({
        id: e.id,
        kind: "expired",
        title: docName(e.docType!),
        sub: exp ? `${t("detail.f.expired_sub")} · ${exp}` : t("detail.f.expired_sub"),
      })
    })
  detail.lowConfidenceFields.forEach((lf, i) =>
    findings.push({
      id: `l${i}`,
      kind: "low_confidence",
      title: (
        <span>
          {docName(lf.docType)} · {t(`field.${lf.fieldKey}`)}
        </span>
      ),
      sub: `${lf.confidence}%`,
    }),
  )

  const summary = [
    t("detail.docs_count", { d: detail.detectedCount, r: detail.requiredCount }),
    pkg.issues > 0 &&
      (pkg.issues === 1 ? t("findings.issue_one") : t("findings.issues", { n: pkg.issues })),
    pkg.lowConfidence > 0 && t("findings.low", { n: pkg.lowConfidence }),
  ]
    .filter(Boolean)
    .join("  ·  ")

  return (
    <SurfacePage>
      <SurfaceHeading
        title={pkg.id}
        badge={<DispositionMark disposition={pkg.disposition} />}
        subtitle={subtitle}
      />

      <SurfaceBody>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-9 px-4 py-7 md:px-8 md:py-9">
          {/* ── Process ── */}
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="register-label">{t("detail.process")}</h2>
              {pkg.disposition === "in_progress" && (
                <span className="flex items-center gap-1.5 text-[0.75rem] text-primary">
                  <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary" />
                  {t(`stage.${detail.currentStage}`)} {t("detail.stage_running")}
                </span>
              )}
            </div>
            <div className="overflow-x-auto pb-1">
              <Stepper stages={detail.stages} />
            </div>
          </section>

          {/* ── Validation ── */}
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="register-label">{t("detail.validation")}</h2>
              <span data-mono className="text-[0.75rem] tabular-nums text-muted-foreground">
                {summary}
              </span>
            </div>

            {findings.length > 0 ? (
              <ul className="mt-3 border-t border-rule">
                {findings.map((f) => (
                  <FindingRow key={f.id} kind={f.kind} title={f.title} sub={f.sub} />
                ))}
              </ul>
            ) : pkg.disposition === "in_progress" ? (
              <StatePanel icon={GaugeIcon} tone="muted">
                {t("detail.in_progress_note")}
              </StatePanel>
            ) : pkg.disposition === "failed" ? (
              <StatePanel icon={TriangleAlertIcon} tone="failed">
                {t("detail.failed_note", { stage: t(`stage.${detail.currentStage}`) })}
              </StatePanel>
            ) : (
              <StatePanel icon={ShieldCheckIcon} tone="ok">
                {t("detail.clean")}
              </StatePanel>
            )}
          </section>

          {/* ── Documents ── */}
          {detail.documents.length > 0 && (
            <section>
              <h2 className="register-label">{t("detail.documents")}</h2>
              <div className="mt-4 flex flex-col divide-y divide-rule-strong">
                {detail.documents.map((doc) => (
                  <div key={doc.id} className="py-5 first:pt-0 last:pb-0">
                    <DocumentBlock doc={doc} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </SurfaceBody>

      <SurfaceFooter>
        <span className="text-[0.8125rem] text-muted-foreground">
          {t("updated.ago", { t: relativeShort(pkg.updatedAt, NOW) })}
        </span>
        <div className="flex items-center gap-2">
          {/* Pipeline control — the inspector steers the process, not the verdict */}
          {isRunning ? (
            confirmCancel ? (
              <Button
                variant="outline"
                onClick={cancelRun}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <CircleStopIcon /> {t("detail.confirm_cancel")}
              </Button>
            ) : (
              <Button variant="outline" onClick={armCancel}>
                <CircleStopIcon /> {t("detail.action.cancel")}
              </Button>
            )
          ) : isFailed ? (
            <Button onClick={restart}>
              <RotateCwIcon /> {t("detail.action.retry")}
            </Button>
          ) : (
            <Button variant="outline" onClick={restart}>
              <RotateCwIcon /> {t("detail.action.rerun")}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(paths.register)}>
            <ArrowLeftIcon /> {t("detail.back")}
          </Button>
        </div>
      </SurfaceFooter>
    </SurfacePage>
  )
}
