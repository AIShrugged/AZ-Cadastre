/**
 * Verification details — the inspector's review surface for one package. Reads
 * live pipeline output from `GET /api/packages/:id`.
 *
 * The surface is an evidence workbench, not a scroll: a wide register of the
 * documents the engine read (label / value / confidence in aligned columns,
 * each entry disclosing the source text of its own sheets) beside a sticky rail
 * that holds the package's state — how far the pipeline got, what the profile
 * still expects, and an index of what is in the package. The rail answers "did
 * it finish, is anything missing, what is in here"; the register answers "is
 * this value right", which is where the inspector's attention actually goes.
 *
 * A file is a container — one PDF may hold a passport and a title deed — so the
 * file is what the inspector recognises and the documents are what the engine
 * reports within it. Fields / validation / report appear here as those pipeline
 * stages are built. It reports evidence; it never states an approval or a
 * verdict.
 */
import { useState, type ReactNode } from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImageIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { skipToken } from "@reduxjs/toolkit/query"
import type {
  DocumentDto,
  FieldDto,
  IssueDto,
  IssueKind,
  PackageDetailDto,
  ReportDto,
  ReportStatus,
  SourceFileDto,
} from "@cadastre/contracts"

import { Button } from "@/shared/ui/button"
import {
  DispositionMark,
  STAGES,
  missingTypes,
  profileName,
  toViewPackage,
  useGetPackageQuery,
  useGetProfilesQuery,
  type Disposition,
} from "@/entities/verification-package"
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from "@/shared/ui/surface"
import { formatDate, relativeShort, translateOr, useI18n } from "@/shared/i18n"
import { Skeleton } from "@/shared/ui/skeleton"
import { paths } from "@/shared/config"
import { cn } from "@/shared/lib/cn"

type Translate = (key: string, vars?: Record<string, string | number>) => string

type StageStatus = "done" | "current" | "pending" | "error"

// ─── Pipeline, read down the rail ─────────────────────────────────────────────
// Vertical, because the seven stage names are long in all three languages and a
// horizontal run of them either wraps, truncates, or scrolls sideways. Read
// downward it is one narrow column: marker, stage, its score.
function StageMarker({ status, n }: { status: StageStatus; n: number }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold tabular-nums transition-colors duration-300",
        status === "done" && "bg-ok-ink text-background",
        status === "current" && "border-2 border-primary text-primary",
        status === "pending" && "border border-rule-strong text-muted-foreground",
        status === "error" && "bg-destructive text-white",
      )}
    >
      {status === "done" ? (
        <CheckIcon className="size-3" strokeWidth={3} />
      ) : status === "error" ? (
        <TriangleAlertIcon className="size-3" />
      ) : (
        n
      )}
    </span>
  )
}

function Pipeline({
  stages,
  scores,
}: {
  stages: StageStatus[]
  scores: (number | null)[]
}) {
  const { t } = useI18n()
  return (
    <ol className="mt-3 flex flex-col">
      {stages.map((st, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <StageMarker status={st} n={i + 1} />
            {i < stages.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "my-1 w-px flex-1 transition-colors duration-500",
                  st === "done" ? "bg-ok-ink/35" : "bg-rule",
                )}
              />
            )}
          </div>
          <div
            className={cn(
              "flex min-w-0 flex-1 items-baseline justify-between gap-2",
              i < stages.length - 1 && "pb-3",
            )}
          >
            <span
              className={cn(
                "text-[0.8125rem] leading-tight transition-colors duration-300",
                st === "current"
                  ? "font-medium text-primary"
                  : st === "error"
                    ? "font-medium text-failed-ink"
                    : st === "done"
                      ? "text-foreground/80"
                      : "text-muted-foreground",
              )}
            >
              {t(`stage.${i + 1}`)}
            </span>
            {/* Each implemented step reports its confidence score. */}
            {scores[i] != null && (
              <span
                data-mono
                className={cn(
                  "shrink-0 text-[0.6875rem] tabular-nums",
                  st === "error" ? "text-failed-ink" : "text-muted-foreground",
                )}
              >
                {scores[i]}%
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Every document the engine found, across all uploaded files, in reading
 *  order. */
function documentsOf(pkg: PackageDetailDto): DocumentDto[] {
  return pkg.files.flatMap((file) => file.documents)
}

/** Confidence score per implemented stage (0–100), or null if it hasn't run.
 *  OCR = mean page confidence; Classification = mean per-document classifier
 *  confidence; Field extraction = mean per-field confidence. Document detection
 *  reports no score: where one document ends and the next begins is a boundary,
 *  not a reading with a certainty attached. */
function stageScores(pkg: PackageDetailDto): (number | null)[] {
  const mean = (xs: number[]) =>
    Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100)
  const scores: (number | null)[] = Array.from({ length: STAGES }, () => null)
  const documents = documentsOf(pkg)

  const ocr = pkg.files
    .flatMap((f) => f.pages.map((p) => p.ocr?.confidence))
    .filter((c): c is number => c != null)
  if (ocr.length) scores[0] = mean(ocr)

  const cls = documents
    .map((d) => d.classificationConfidence)
    .filter((c): c is number => c != null)
  if (cls.length) scores[2] = mean(cls)

  const fields = documents.flatMap((d) => d.fields.map((f) => f.confidence))
  if (fields.length) scores[3] = mean(fields)

  return scores
}

/** Real per-stage status from pipeline output. A stage that could not do its
 *  work no longer halts the run: it is marked done-with-a-finding and the run
 *  walks on, because the report is what the inspector is owed. Only a run that
 *  lost the package altogether ends in error. */
function stageStatuses(
  pkg: PackageDetailDto,
  disposition: Disposition,
): StageStatus[] {
  const files = pkg.files
  const documents = documentsOf(pkg)
  const ocrDone =
    files.length > 0 &&
    files.every(
      (f) => f.pages.length > 0 && f.pages.every((p) => p.ocr !== null),
    )
  // Every file has been read into the documents it holds. A file that holds
  // nothing has not been detected yet, not detected as empty.
  const detectDone = files.length > 0 && files.every((f) => f.documents.length > 0)
  const classifyDone =
    detectDone && documents.every((d) => d.type !== null)
  // Extraction is done once every classified document (that has a schema — i.e.
  // not "unknown") has its fields; unknowns have nothing to extract.
  const extractDone =
    classifyDone &&
    documents
      .filter((d) => d.type && d.type !== "unknown")
      .every((d) => d.fields.length > 0)

  const stages: StageStatus[] = Array.from({ length: STAGES }, () => "pending")
  if (disposition === "failed") {
    stages[0] = ocrDone ? "done" : "error"
    if (ocrDone) stages[1] = detectDone ? "done" : "error"
    if (ocrDone && detectDone) stages[2] = "error"
    return stages
  }
  // A finished run compiled its report, so every stage behind it has had its
  // turn — whatever each of them managed to make of the package.
  if (pkg.report) return stages.map(() => "done")

  stages[0] = ocrDone ? "done" : "current"
  stages[1] = detectDone ? "done" : ocrDone ? "current" : "pending"
  if (!detectDone) return stages
  stages[2] = classifyDone ? "done" : "current"
  stages[3] = extractDone ? "done" : classifyDone ? "current" : "pending"
  return stages
}

// ─── Confidence ────────────────────────────────────────────────────────────────
// A machine-read value: tabular mono, and below the 80% threshold it flags for
// review in the clay "incomplete" ink (PRD §4.6). Above the floor it stays a
// quiet figure in its own column — provenance travels with every field, but a
// reading the engine is sure of must not shout down the value it produced.
const CONFIDENCE_FLOOR = 0.8

function Confidence({ value }: { value: number }) {
  const { t } = useI18n()
  const low = value < CONFIDENCE_FLOOR
  return (
    <span className="inline-flex shrink-0 items-baseline justify-end gap-1.5">
      {low && (
        <span className="rounded-full bg-incomplete/12 px-1.5 py-0.5 text-[0.625rem] font-medium text-incomplete-ink">
          {t("detail.needs_review")}
        </span>
      )}
      <span
        data-mono
        className={cn(
          "text-[0.75rem] tabular-nums",
          low ? "font-medium text-incomplete-ink" : "text-muted-foreground/80",
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

// The disclosure every raw transcription opens into — the machine's reading,
// set in mono on a recessed panel so it never passes for extracted data.
function Transcript({ label, text }: { label: string; text: string }) {
  return (
    <details className="group mt-3">
      <summary className="inline-flex cursor-pointer list-none select-none items-center gap-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRightIcon className="size-3 transition-transform duration-200 group-open:rotate-90" />
        {label}
      </summary>
      <pre
        data-mono
        className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-rule bg-muted/30 p-3 text-[0.75rem] leading-relaxed text-foreground/75"
      >
        {text}
      </pre>
    </details>
  )
}

// ─── OCR status ────────────────────────────────────────────────────────────────
// One line reports the reading of a whole file — recognised / failed / pending —
// with its confidence. The transcription itself belongs to each document that
// was carved out of the file, so it is disclosed there; only while nothing has
// been carved out yet does this line carry the whole-file text (`orphan`), so
// the reading is never unreachable.
function OcrStatus({
  file,
  failed,
  orphan,
}: {
  file: SourceFileDto
  failed: boolean
  orphan: boolean
}) {
  const { t } = useI18n()
  const recognised = file.pages.filter((p) => p.ocr)
  const done = file.pages.length > 0 && recognised.length === file.pages.length

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
  const text = file.pages
    .map((p) => p.ocr?.text ?? "")
    .join("\n\n")
    .trim()

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <StatusLine
          tone="ok"
          icon={<CheckIcon className="size-3" strokeWidth={3} />}
          label={t("detail.ocr_done")}
        />
        <Confidence value={avg} />
      </div>
      {orphan && <Transcript label={t("detail.source_text")} text={text} />}
    </div>
  )
}

// ─── Page tally ───────────────────────────────────────────────────────────────
// The file's meta line doubles as the progress read-out for a long PDF: how many
// sheets it was split into, and — while the pages are still being read — how
// many have come back. It carries its own separator, because a file with nothing
// to count yet must not leave a dangling one behind.
function PageTally({ file, failed }: { file: SourceFileDto; failed: boolean }) {
  const { t } = useI18n()
  const total = file.pages.length
  const read = file.pages.filter((p) => p.ocr).length

  // No sheets yet: a run under way is still being split, and one that failed
  // never got that far — the OCR line below is what reports that.
  if (total === 0) {
    return failed ? null : (
      <>
        {" · "}
        <span className="inline-flex items-center gap-1.5 text-primary">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
          />
          {t("detail.splitting")}
        </span>
      </>
    )
  }

  const pages = total === 1 ? t("new.page_one") : t("new.pages", { n: total })
  // A running count earns its place only where there is a queue to watch: with a
  // single sheet, or none left unread, the total already says everything.
  if (total === 1 || read === total) return <>{` · ${pages}`}</>

  return (
    <>
      {` · ${pages} `}
      <span aria-live="polite" className="inline-flex items-center gap-1.5">
        {/* A failed run is not still working, so it gets the count without the
            heartbeat: 8 of 10 pages read is where it stopped. */}
        {!failed && (
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
          />
        )}
        {/* Keyed on the count, so every page that lands replays the animation. */}
        <span
          key={read}
          aria-label={t("detail.pages_read", { n: read, total })}
          className={cn(
            "font-medium tabular-nums",
            failed
              ? "text-failed-ink"
              : "text-primary duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75",
          )}
        >
          ({read})
        </span>
      </span>
    </>
  )
}

// ─── Extracted fields ────────────────────────────────────────────────────────
// The type's schema, filled in — read as a register, not as a form: the label
// column, then the machine-read value, then the confidence that reading carries.
// Values align down one column across every document on the page, which is what
// makes a name in the application comparable to the name on the identity card at
// a glance. Nothing is truncated; a long value wraps, because a value the
// inspector cannot read is a value they cannot verify.
function Fields({ fields }: { fields: FieldDto[] }) {
  const { t } = useI18n()
  return (
    <dl className="mt-3 border-t border-rule">
      {fields.map((f) => (
        <div
          key={f.name}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-rule py-2.5 sm:grid-cols-[minmax(8rem,15rem)_minmax(0,1fr)_auto] sm:gap-x-6 sm:gap-y-0"
        >
          <dt className="col-span-2 text-[0.8125rem] leading-snug text-muted-foreground sm:col-span-1">
            {translateOr(t, `field.${f.name}`, f.name)}
          </dt>
          <dd
            data-mono
            className={cn(
              "min-w-0 break-words whitespace-pre-line text-[0.875rem] leading-snug",
              f.confidence < CONFIDENCE_FLOOR
                ? "text-incomplete-ink"
                : "text-foreground",
            )}
          >
            {f.value || "—"}
          </dd>
          <Confidence value={f.confidence} />
        </div>
      ))}
    </dl>
  )
}

// ─── One document found inside a file ────────────────────────────────────────
// A file is a container, so a document is identified by where it sits in that
// container — the sheets it occupies — not by a filename of its own.
function pageLabel(t: Translate, doc: DocumentDto): string {
  return doc.firstPage === doc.lastPage
    ? t("detail.page_single", { n: doc.firstPage })
    : t("detail.page_range", { from: doc.firstPage, to: doc.lastPage })
}

/** The document's own sheets, read out — the evidence its fields were taken
 *  from, so provenance sits one line below the value it produced. */
function documentText(doc: DocumentDto, file: SourceFileDto): string {
  return file.pages
    .filter((p) => p.pageNumber >= doc.firstPage && p.pageNumber <= doc.lastPage)
    .map((p) => p.ocr?.text ?? "")
    .join("\n\n")
    .trim()
}

function DocumentEntry({ doc, file }: { doc: DocumentDto; file: SourceFileDto }) {
  const { t } = useI18n()
  const unclassified = doc.type === "unknown"
  const text = documentText(doc, file)
  // Unclassified: show a one-line preview off the document's own sheets, so the
  // inspector can still tell roughly what it is.
  const snippet = unclassified ? text.replace(/\s+/g, " ").slice(0, 160) : ""

  return (
    <article id={`doc-${doc.id}`} className="scroll-mt-6 py-6 first:pt-5 last:pb-0">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-3">
          <span
            data-mono
            className="shrink-0 text-[0.75rem] tabular-nums text-muted-foreground"
          >
            {pageLabel(t, doc)}
          </span>
          {doc.type ? (
            <h3
              className={cn(
                "text-[0.9375rem] font-[550] leading-tight tracking-[-0.01em]",
                unclassified ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {translateOr(t, `doctype.${doc.type}`, doc.type)}
            </h3>
          ) : (
            <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-primary">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
              />
              {t("detail.classifying")}
            </span>
          )}
        </div>
        {doc.classificationConfidence != null && (
          // Pushed right on its own line when the type name takes the full
          // width, so a wrapped confidence still lands in its column.
          <span className="ml-auto">
            <Confidence value={doc.classificationConfidence} />
          </span>
        )}
      </header>

      {unclassified ? (
        <p className="mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
          {t("detail.unclassified")}
          {snippet && (
            <span className="mt-1.5 block text-[0.75rem] italic text-foreground/55">
              “{snippet}…”
            </span>
          )}
        </p>
      ) : (
        doc.fields.length > 0 && <Fields fields={doc.fields} />
      )}

      {text && (
        <Transcript
          label={`${t("detail.source_text")} · ${pageLabel(t, doc)}`}
          text={text}
        />
      )}
    </article>
  )
}

// ─── One uploaded file ───────────────────────────────────────────────────────
// The provenance line for the documents beneath it: what the inspector attached,
// how many sheets it was split into, and whether those sheets were read. With
// one file it reads as a caption; with several it becomes the rule that groups
// each file's documents.
function FileGroup({ file, failed }: { file: SourceFileDto; failed: boolean }) {
  const { t } = useI18n()
  const Icon = file.contentType.startsWith("image/") ? ImageIcon : FileTextIcon
  const read = file.pages.length > 0 && file.pages.every((p) => p.ocr !== null)
  const found = file.documents.length
  const detecting = found === 0 && read && !failed
  // The rule under the file line divides it from what it holds. A file that
  // holds nothing — a run that failed before detection — gets no divider, so the
  // section never ends on a hairline with nothing beneath it.
  const holds = found > 0 || detecting

  return (
    <section>
      <div
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2",
          holds && "border-b border-rule-strong pb-3",
        )}
      >
        <div className="flex min-w-0 items-baseline gap-2.5">
          <Icon
            aria-hidden
            className="size-4 shrink-0 translate-y-0.5 text-muted-foreground"
          />
          <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">
            {file.originalFilename}
          </h2>
          <span
            data-mono
            className="shrink-0 text-[0.6875rem] text-muted-foreground"
          >
            {file.contentType}
            <PageTally file={file} failed={failed} />
          </span>
        </div>
        <OcrStatus file={file} failed={failed} orphan={found === 0} />
      </div>

      {found > 0 ? (
        <div className="divide-y divide-rule">
          {file.documents.map((doc) => (
            <DocumentEntry key={doc.id} doc={doc} file={file} />
          ))}
        </div>
      ) : (
        // The sheets are read but nothing has been carved out of them yet: the
        // file is still being split into the documents it holds.
        detecting && (
          <span className="mt-4 flex items-center gap-1.5 text-[0.8125rem] text-primary">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
            />
            {t("detail.detecting")}
          </span>
        )
      )}
    </section>
  )
}

// ─── Required documents ───────────────────────────────────────────────────────
// What the governing profile insists on, against what the engine actually found.
// It reports a shortfall; it never refuses the package — the inspector decides,
// and a document the classifier could not place may still be the missing one.
function RequiredDocuments({
  missing,
  settled,
}: {
  missing: readonly string[]
  settled: boolean
}) {
  const { t } = useI18n()

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="register-label">{t("detail.required")}</h2>
        {settled && missing.length > 0 && (
          <span
            data-mono
            className="text-[0.6875rem] tabular-nums text-incomplete-ink"
          >
            {t("detail.required_missing", { n: missing.length })}
          </span>
        )}
      </div>

      {!settled ? (
        <p className="mt-3 text-[0.8125rem] leading-snug text-muted-foreground">
          {t("detail.required_pending")}
        </p>
      ) : missing.length === 0 ? (
        <div className="mt-3">
          <StatusLine
            tone="ok"
            icon={<CheckIcon className="size-3" strokeWidth={3} />}
            label={t("detail.required_all")}
          />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {missing.map((type) => (
            <li key={type}>
              <StatusLine
                tone="fail"
                icon={<TriangleAlertIcon className="size-3" />}
                label={translateOr(t, `doctype.${type}`, type)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── The report ───────────────────────────────────────────────────────────────
// The last thing every run produces, and the only thing the operator is
// promised: a run is never stopped by a document it could not read, so whatever
// the engine met is stated here and handed over. It reports; the inspector
// decides.
const ISSUE_SECTIONS: { kind: IssueKind; heading: string }[] = [
  { kind: "MissingDocument", heading: "detail.sec.missing" },
  { kind: "UnreadableDocument", heading: "detail.sec.unreadable" },
  { kind: "LowConfidence", heading: "detail.sec.low" },
]

const REPORT_TONE: Record<ReportStatus, "ok" | "issues" | "incomplete"> = {
  OK: "ok",
  IssuesFound: "issues",
  IncompletePackage: "incomplete",
}

const REPORT_LABEL: Record<ReportStatus, string> = {
  OK: "status.ok",
  IssuesFound: "status.issues",
  IncompletePackage: "status.incomplete",
}

/** What a finding is about, in the reader's own language. The wire carries the
 *  English audit line; nothing here reads it. */
function findingOf(
  t: Translate,
  issue: IssueDto,
  pkg: PackageDetailDto,
): { subject: string; where: string } {
  const file = pkg.files.find((candidate) => candidate.id === issue.sourceFileId)
  const document = documentsOf(pkg).find(
    (candidate) => candidate.id === issue.documentId,
  )
  const sheet =
    issue.pageNumber === null
      ? ""
      : t("detail.page_single", { n: issue.pageNumber })
  const within = [file?.originalFilename, sheet].filter(Boolean).join(" · ")

  if (issue.kind === "MissingDocument") {
    return {
      subject: translateOr(
        t,
        `doctype.${issue.documentType}`,
        issue.documentType ?? "",
      ),
      where: t("detail.f.missing_sub"),
    }
  }

  if (issue.kind === "UnreadableDocument") {
    if (document) {
      return {
        subject: `${pageLabel(t, document)} · ${file?.originalFilename ?? ""}`,
        where: t("detail.f.unplaced_sub"),
      }
    }
    return {
      subject: within || t("detail.files"),
      where: issue.pageNumber === null
        ? t("detail.f.unread_file_sub")
        : t("detail.f.unread_sheet_sub"),
    }
  }

  return {
    subject: issue.fieldName
      ? translateOr(t, `field.${issue.fieldName}`, issue.fieldName)
      : translateOr(t, `doctype.${issue.documentType}`, issue.documentType ?? ""),
    where: within || t("detail.f.low_sub"),
  }
}

function Report({ report, pkg }: { report: ReportDto; pkg: PackageDetailDto }) {
  const { t } = useI18n()
  const tone = REPORT_TONE[report.status]

  return (
    <section className="mb-9">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="register-label">{t("detail.report")}</h2>
        <span
          data-mono
          className="text-[0.75rem] tabular-nums text-muted-foreground"
        >
          {report.issues.length === 0
            ? t("findings.none")
            : report.issues.length === 1
              ? t("findings.issue_one")
              : t("findings.issues", { n: report.issues.length })}
        </span>
      </div>

      <div
        className={cn(
          "mt-3 rounded-xl border p-4 md:p-5",
          tone === "ok" && "border-ok/35 bg-ok/6",
          tone === "issues" && "border-issues/35 bg-issues/6",
          tone === "incomplete" && "border-incomplete/35 bg-incomplete/6",
        )}
      >
        <div className="flex items-center gap-2 leading-none">
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              tone === "ok" && "bg-ok",
              tone === "issues" && "bg-issues",
              tone === "incomplete" && "bg-incomplete",
            )}
          />
          <span
            className={cn(
              "text-[0.875rem] font-semibold tracking-tight",
              tone === "ok" && "text-ok-ink",
              tone === "issues" && "text-issues-ink",
              tone === "incomplete" && "text-incomplete-ink",
            )}
          >
            {t(REPORT_LABEL[report.status])}
          </span>
        </div>

        {report.issues.length === 0 ? (
          <p className="mt-2.5 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t("detail.clean")}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            {ISSUE_SECTIONS.map(({ kind, heading }) => {
              const found = report.issues.filter((issue) => issue.kind === kind)
              if (found.length === 0) return null

              return (
                <div key={kind}>
                  <h3 className="register-label">
                    {t(heading)}
                    <span data-mono className="ml-2 tabular-nums opacity-70">
                      {found.length}
                    </span>
                  </h3>
                  <ul className="mt-2 flex flex-col border-t border-rule">
                    {found.map((issue, index) => {
                      const { subject, where } = findingOf(t, issue, pkg)
                      return (
                        <li
                          key={`${kind}-${index}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-rule py-2"
                        >
                          <span className="min-w-0 text-[0.8125rem] leading-snug text-foreground">
                            {subject}
                          </span>
                          <span className="flex shrink-0 items-baseline gap-3">
                            <span className="text-[0.75rem] text-muted-foreground">
                              {where}
                            </span>
                            {issue.confidence !== null && (
                              <Confidence value={issue.confidence} />
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Contents ─────────────────────────────────────────────────────────────────
// The package read as a table of contents: every document the engine placed, in
// sheet order, as a jump into the register. It is the only navigation this
// surface needs — and, read on its own, the fastest answer to "what is in this
// package". Sheet numbers restart in every file, so once a package carries more
// than one, each file names itself above its own documents; otherwise "p. 1"
// would appear twice meaning two different sheets.
function Contents({ files }: { files: readonly SourceFileDto[] }) {
  const { t } = useI18n()
  const groups = files.filter((file) => file.documents.length > 0)
  const named = groups.length > 1

  return (
    <nav className="hidden xl:block">
      <h2 className="register-label">{t("detail.contents")}</h2>
      <div className="mt-2 flex flex-col gap-3">
        {groups.map((file) => (
          <div key={file.id}>
            {named && (
              <p
                data-mono
                className="mb-1 truncate text-[0.6875rem] text-muted-foreground/80"
              >
                {file.originalFilename}
              </p>
            )}
            <ul className="flex flex-col">
              {file.documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={`#doc-${doc.id}`}
                    className="-mx-2 flex items-baseline gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      data-mono
                      className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground"
                    >
                      {pageLabel(t, doc)}
                    </span>
                    <span className="truncate text-[0.8125rem] text-foreground/85">
                      {doc.type
                        ? translateOr(t, `doctype.${doc.type}`, doc.type)
                        : t("detail.classifying")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
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
  // The profile says which documents the package must carry; the register never
  // keeps a copy of that policy (ADR-0002).
  const { data: profiles } = useGetProfilesQuery()
  const shouldPoll =
    pkg?.status === "Pending" || pkg?.status === "Processing"
  if (shouldPoll !== polling) setPolling(shouldPoll)

  if (isLoading) {
    return (
      <SurfacePage>
        <SurfaceHeading title={t("col.status")} />
        <SurfaceBody>
          <div className="mx-auto grid w-full max-w-[88rem] gap-x-10 gap-y-8 px-4 py-7 md:px-8 md:py-9 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex flex-col gap-4 xl:col-start-1 xl:row-start-1">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="flex flex-col gap-4 xl:col-start-2 xl:row-start-1">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
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
  const subtitle = `${profileName(t, view.profile)} · ${formatDate(pkg.createdAt, locale)}`
  const stages = stageStatuses(pkg, view.disposition)
  const scores = stageScores(pkg)
  const currentStage = stages.findIndex((s) => s === "current")
  const documents = documentsOf(pkg)
  // Only once classification has been through every document is a type's
  // absence a finding rather than a stage that has not run yet.
  const classified = stages[2] === "done" || stages[2] === "error"
  const missing = missingTypes(
    profiles ?? [],
    view.profile,
    documents.map((d) => d.type),
  )

  return (
    <SurfacePage>
      <SurfaceHeading
        title={
          <span data-mono className="text-[1.0625rem] font-medium md:text-[1.25rem]">
            {pkg.id}
          </span>
        }
        badge={<DispositionMark disposition={view.disposition} />}
        subtitle={subtitle}
      />

      <SurfaceBody>
        <div className="mx-auto grid w-full max-w-[88rem] gap-x-10 gap-y-7 px-4 py-7 md:px-8 md:py-9 xl:grid-cols-[minmax(0,1fr)_18rem]">
          {/* ── State of the run: how far it got, what is still expected, and
              what the package turned out to contain. Declared first so it is
              also read first — a summary before the evidence. ── */}
          <aside className="border-b border-rule pb-7 xl:col-start-2 xl:row-start-1 xl:border-b-0 xl:border-l xl:border-rule xl:pb-0 xl:pl-9">
            {/* Capped and scrollable where it sticks: a package with many
                documents must not push the end of the index past the fold with
                no way to reach it. */}
            <div className="flex flex-col gap-7 xl:sticky xl:top-1 xl:-mx-2 xl:max-h-[calc(100dvh-10rem)] xl:overflow-y-auto xl:overscroll-contain xl:px-2 xl:pb-2">
              <section>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="register-label">{t("detail.process")}</h2>
                  {currentStage >= 0 && (
                    <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-primary">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
                      />
                      {t("detail.stage_running")}
                    </span>
                  )}
                </div>
                <Pipeline stages={stages} scores={scores} />
              </section>

              <RequiredDocuments missing={missing} settled={classified} />

              {documents.length > 1 && <Contents files={pkg.files} />}
            </div>
          </aside>

          {/* ── The evidence: every document the engine read, with its fields
              and the source text they came from. ── */}
          <main className="min-w-0 xl:col-start-1 xl:row-start-1">
            {/* The run's result comes first — the inspector reads what was
                found, then the evidence it was found in. */}
            {pkg.report && <Report report={pkg.report} pkg={pkg} />}

            <div className="flex items-baseline justify-between gap-4">
              <h2 className="register-label">{t("detail.documents")}</h2>
              <span
                data-mono
                className="text-[0.75rem] tabular-nums text-muted-foreground"
              >
                {/* Documents placed out of documents found — both discovered by
                    the pipeline, so before detection runs this reads 0 of 0. */}
                {t("detail.docs_count", {
                  d: pkg.classifiedCount,
                  r: pkg.documentsCount,
                })}
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-10">
              {pkg.files.map((file) => (
                <FileGroup
                  key={file.id}
                  file={file}
                  failed={view.disposition === "failed"}
                />
              ))}
            </div>
          </main>
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
