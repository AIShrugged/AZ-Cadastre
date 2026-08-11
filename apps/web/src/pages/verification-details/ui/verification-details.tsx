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
import { useState, type ComponentProps, type ReactNode } from "react"
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
  CheckedValueDto,
  CrossCheckDto,
  CrossCheckVerdict,
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
  documentsExpected,
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

function Pipeline({ stages }: { stages: StageStatus[] }) {
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
          <div className={cn("min-w-0 flex-1", i < stages.length - 1 && "pb-3")}>
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
          </div>
        </li>
      ))}
    </ol>
  )
}

// How far the run got. Live while it works, and folded away into a single line
// once it is over: a finished run is six green marks reporting history, and it
// should not hold rail space ahead of the fact the inspector came for.
function RunProgress({
  stages,
  running,
  failed,
  stageRunning,
}: {
  stages: StageStatus[]
  running: boolean
  failed: boolean
  // Whether any stage is working — more than one can be, so this is a state of
  // the run rather than a position in it.
  stageRunning: boolean
}) {
  const { t } = useI18n()
  return (
    <section>
      {running ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="register-label">{t("detail.process")}</h2>
            {stageRunning && (
              <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-primary">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse"
                />
                {t("detail.stage_running")}
              </span>
            )}
          </div>
          <Pipeline stages={stages} />
        </>
      ) : (
        <details className="group">
          <summary className="-mx-2 flex cursor-pointer list-none select-none items-baseline gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronRightIcon className="size-3 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
            <span className="register-label">
              {failed ? t("status.failed") : t("detail.process_done")}
            </span>
            <span
              data-mono
              className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground/70"
            >
              {t("detail.stages_done", { n: stages.length })}
            </span>
          </summary>
          <Pipeline stages={stages} />
        </details>
      )}
    </section>
  )
}

/** Every document the engine found, across all uploaded files, in reading
 *  order. */
function documentsOf(pkg: PackageDetailDto): DocumentDto[] {
  return pkg.files.flatMap((file) => file.documents)
}

// ─── What the register is filtered by ────────────────────────────────────────
// A package this size is mostly settled work: of sixteen documents the engine
// read here, six carry a reading the inspector should look at and eight are not
// documents this profile asks for at all. Rendering all of them at equal weight
// is what buries the six. The segments are the register's own triage — the same
// control the package register uses, with the same counts.
type DocSegment = "review" | "all" | "other"

const SEGMENTS: DocSegment[] = ["review", "all", "other"]

const SEGMENT_KEY: Record<DocSegment, string> = {
  review: "detail.seg.review",
  all: "detail.seg.all",
  other: "detail.seg.other",
}

/** A document the profile has nothing to say about: read, placed, and not asked
 *  for. It is evidence of what was in the envelope, never a shortfall. */
function isAside(doc: DocumentDto): boolean {
  return doc.type === "out_of_profile"
}

/** Whether this document holds anything the inspector should actually look at:
 *  a reading below the floor, or a type the classifier could not place. Its
 *  answer decides both the segment a document falls in and whether the entry
 *  opens with its fields showing. */
function needsReview(doc: DocumentDto): boolean {
  if (doc.type === null || doc.type === "unknown") return true
  if (isAside(doc)) return false
  if (
    doc.classificationConfidence != null &&
    doc.classificationConfidence < CONFIDENCE_FLOOR
  )
    return true
  return doc.fields.some((f) => f.confidence < CONFIDENCE_FLOOR)
}

function inSegment(doc: DocumentDto, segment: DocSegment): boolean {
  if (segment === "all") return true
  if (segment === "other") return isAside(doc)
  return needsReview(doc)
}

/** Rendered *and* spelled out. Under "all" the service sheets are in the
 *  register but folded into the line that stands for them, so a jump aimed at
 *  one has to land somewhere else — being on the page is not the same as being
 *  reachable. */
function isOpenIn(doc: DocumentDto, segment: DocSegment): boolean {
  if (!inSegment(doc, segment)) return false
  return !(segment === "all" && isAside(doc))
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
    files.every((f) => f.pages.length > 0 && f.pages.every((p) => p.ocr !== null))
  // Every file has been read into the documents it holds. A file that holds
  // nothing has not been detected yet, not detected as empty.
  const detectDone = files.length > 0 && files.every((f) => f.documents.length > 0)
  const classifyDone = detectDone && documents.every((d) => d.type !== null)
  // Extraction is done once every document with a schema behind it has its
  // fields. Neither answer the engine keeps for itself declares any: a document
  // it could not place has nothing to extract, and one it placed outside the
  // profile has no schema to extract against.
  const extractDone =
    classifyDone &&
    documents
      .filter((d) => d.type && d.type !== "unknown" && d.type !== "out_of_profile")
      .every((d) => d.fields.length > 0)
  // The first check to come back is what says the stage is under way; a run
  // that finished takes the branch below, so a package no check could be made
  // over never sits here waiting.
  const crossDone = extractDone && pkg.crossChecks.length > 0

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
  // Classification and extraction are one pass, not two: the run takes a
  // document, places it, and reads its fields before moving to the next. So
  // while that pass is under way both are genuinely working and both are marked
  // running — showing extraction as "not started" until the last document is
  // placed would report a queue the run does not have.
  stages[2] = classifyDone ? "done" : "current"
  stages[3] = extractDone ? "done" : "current"
  stages[4] = crossDone ? "done" : extractDone ? "current" : "pending"
  return stages
}

// ─── Confidence ────────────────────────────────────────────────────────────────
// A machine-read value: tabular mono, and below the 80% threshold it flags for
// review in the clay "incomplete" ink (PRD §4.6). Above the floor it stays a
// quiet figure in its own column — provenance travels with every field, but a
// reading the engine is sure of must not shout down the value it produced.
const CONFIDENCE_FLOOR = 0.8

// Zero is not "certainly wrong", it is "nobody scored this": neither the route
// nor the model would say how sure it was, so the engine declines to make a
// number up (docs/MODELS.md). It reads as an absence, and it still flags for
// review — an unscored reading is exactly one an inspector should check.
function Confidence({ value, bare = false }: { value: number; bare?: boolean }) {
  const { t } = useI18n()
  const unscored = value === 0
  const low = value < CONFIDENCE_FLOOR
  return (
    <span className="inline-flex shrink-0 items-baseline justify-end gap-1.5">
      {low && !bare && (
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
        title={unscored ? t("detail.unscored_why") : undefined}
      >
        {unscored ? t("detail.unscored") : `${Math.round(value * 100)}%`}
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
          tone === "fail" ? "font-medium text-failed-ink" : "text-foreground/80",
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
function Fields({ fields, docId }: { fields: FieldDto[]; docId: string }) {
  const { t } = useI18n()
  return (
    <dl className="mt-3 border-t border-rule">
      {fields.map((f) => (
        <div
          key={f.name}
          // The worklist's landing point. `target:` washes the row in the
          // register's own selection tint so a jump from the finding arrives on
          // a row the eye can find, and the wash fades rather than sticking.
          id={`field-${docId}-${f.name}`}
          className="grid scroll-mt-16 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-rule py-2.5 transition-colors duration-500 target:bg-accent sm:grid-cols-[minmax(8rem,15rem)_minmax(0,1fr)_auto] sm:gap-x-6 sm:gap-y-0"
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

// ─── The sheets themselves ────────────────────────────────────────────────────
// Everything else on this page is the machine's account of the scan; this is the
// scan. A value the inspector cannot check against the paper is a value they
// have to take on trust, which is the one thing this surface exists not to ask
// of them. Thumbnails, because the point is to find the right sheet quickly —
// the sheet itself opens full size in its own tab.
function Sheets({ doc, file }: { doc: DocumentDto; file: SourceFileDto }) {
  const { t } = useI18n()
  const sheets = file.pages.filter(
    (page) =>
      page.pageNumber >= doc.firstPage &&
      page.pageNumber <= doc.lastPage &&
      page.imageUrl,
  )

  if (sheets.length === 0) return null

  return (
    // Rides in the entry's side column from `lg` up, so the paper sits level
    // with the values taken off it — a reading and its evidence on one line of
    // sight, instead of the reading here and the scan three hundred pixels
    // below it. Below `lg` it falls back under the fields, where the column
    // would be too narrow to show anything.
    // No heading: sixteen entries each captioned "Sheets" is the same repetition
    // this surface was buried under, and a column of scans needs no label.
    <div className="mt-4 lg:mt-0">
      <ul className="flex flex-wrap gap-2">
        {sheets.map((page) => (
          <li key={page.pageNumber}>
            <a
              href={page.imageUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              title={t("detail.page_single", { n: page.pageNumber })}
              className="group block w-[5.25rem] overflow-hidden rounded-md border border-rule transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <img
                src={page.imageUrl ?? undefined}
                alt={t("detail.page_single", { n: page.pageNumber })}
                loading="lazy"
                // A tall crop of the head of the sheet: a scanned form says what
                // it is in its first inch, and a whole A4 shrunk to 80px says
                // nothing at all.
                className="h-28 w-full bg-background object-cover object-top"
              />
              <span
                data-mono
                className="block border-t border-rule px-1 py-0.5 text-center text-[0.625rem] tabular-nums text-muted-foreground group-hover:text-foreground"
              >
                {page.pageNumber}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DocumentEntry({ doc, file }: { doc: DocumentDto; file: SourceFileDto }) {
  const { t } = useI18n()
  // Two different answers that both leave a document without fields, and they
  // must not read alike: "we could not tell what this is" against "we could,
  // and this profile does not ask for it".
  const unclassified = doc.type === "unknown"
  const outOfProfile = doc.type === "out_of_profile"
  const fieldless = unclassified || outOfProfile
  const text = documentText(doc, file)
  // Either way there are no fields to show, so a one-line preview off the
  // document's own sheets tells the inspector roughly what is there.
  const snippet = fieldless ? text.replace(/\s+/g, " ").slice(0, 160) : ""
  const flagged = doc.fields.filter((f) => f.confidence < CONFIDENCE_FLOOR).length
  // A confidence the engine is sure of is a figure nobody reads. It is kept
  // where it can be checked — on the fields — and dropped from the heading
  // unless the heading is where the doubt is.
  const headline =
    doc.classificationConfidence != null &&
    doc.classificationConfidence < CONFIDENCE_FLOOR
      ? doc.classificationConfidence
      : null

  return (
    // Values left, the paper they were read off right — the heading sits in the
    // values column so its confidence lands in the values column too, and the
    // sheets start level with the document's own title.
    <article
      id={`doc-${doc.id}`}
      className="scroll-mt-16 py-6 first:pt-5 last:pb-0 lg:grid lg:grid-cols-[minmax(0,1fr)_11.5rem] lg:gap-x-8"
    >
      <div className="min-w-0">
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
                  fieldless ? "text-muted-foreground" : "text-foreground",
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
            {/* How many readings in this document want a second look — the count
              the worklist above sent the inspector here for, restated where the
              work is. Silent when there is nothing to check. */}
            {flagged > 0 && (
              <span
                data-mono
                className="shrink-0 rounded-full bg-incomplete/12 px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-incomplete-ink"
              >
                {flagged}
              </span>
            )}
          </div>
          {headline != null && (
            // Pushed right on its own line when the type name takes the full
            // width, so a wrapped confidence still lands in its column.
            <span className="ml-auto">
              <Confidence value={headline} />
            </span>
          )}
        </header>

        {fieldless ? (
          <p className="mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
            {outOfProfile ? t("detail.out_of_profile") : t("detail.unclassified")}
            {snippet && (
              <span className="mt-1.5 block text-[0.75rem] italic text-foreground/55">
                “{snippet}…”
              </span>
            )}
          </p>
        ) : (
          doc.fields.length > 0 && <Fields fields={doc.fields} docId={doc.id} />
        )}

        {/* The machine's account of the same sheets the column beside it
            shows, so it stays under the values it explains. */}
        {text && (
          <Transcript
            label={`${t("detail.source_text")} · ${pageLabel(t, doc)}`}
            text={text}
          />
        )}
      </div>

      <Sheets doc={doc} file={file} />
    </article>
  )
}

// ─── The documents the profile has nothing to ask of ─────────────────────────
// Eight of the sixteen documents in a package like this one are the registry's
// own service sheets: read, placed, and not asked for. Spelled out they are the
// largest thing on the page and the least actionable, so they fold into one
// line that says how many there are and which sheets they sit on. Nothing is
// lost — the line opens.
function AsideGroup({ docs, file }: { docs: DocumentDto[]; file: SourceFileDto }) {
  const { t } = useI18n()
  if (docs.length === 0) return null

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none select-none items-baseline gap-3 py-3.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <ChevronRightIcon className="size-3.5 shrink-0 translate-y-0.5 transition-transform duration-200 group-open:rotate-90" />
        <span className="min-w-0">
          {docs.length === 1
            ? t("detail.other_group_one")
            : t("detail.other_group", { n: docs.length })}
        </span>
        <span
          data-mono
          className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground/70"
        >
          {docs.map((doc) => pageLabel(t, doc).replace(/^\D+/, "")).join(", ")}
        </span>
      </summary>
      <div className="divide-y divide-rule border-t border-rule">
        {docs.map((doc) => (
          <DocumentEntry key={doc.id} doc={doc} file={file} />
        ))}
      </div>
    </details>
  )
}

// ─── One uploaded file ───────────────────────────────────────────────────────
// The provenance line for the documents beneath it: what the inspector attached,
// how many sheets it was split into, and whether those sheets were read. With
// one file it reads as a caption; with several it becomes the rule that groups
// each file's documents.
function FileGroup({
  file,
  failed,
  segment,
}: {
  file: SourceFileDto
  failed: boolean
  segment: DocSegment
}) {
  const { t } = useI18n()
  const Icon = file.contentType.startsWith("image/") ? ImageIcon : FileTextIcon
  const read = file.pages.length > 0 && file.pages.every((p) => p.ocr !== null)
  const found = file.documents.length
  const detecting = found === 0 && read && !failed
  const shown = file.documents.filter((doc) => inSegment(doc, segment))
  // Under "all" the register still reads down the file in sheet order — the
  // service sheets keep their place in the sequence, folded into the line that
  // stands for them rather than spelled out. Under a segment that is already a
  // filter, folding a second time would just hide the answer.
  const folded = segment === "all"
  const listed = folded ? shown.filter((doc) => !isAside(doc)) : shown
  const asides = folded ? shown.filter(isAside) : []
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
        shown.length === 0 ? (
          <p className="py-5 text-[0.8125rem] text-muted-foreground">
            {t("detail.empty_filter")}
          </p>
        ) : (
          <div className="divide-y divide-rule">
            {listed.map((doc) => (
              <DocumentEntry key={doc.id} doc={doc} file={file} />
            ))}
            <AsideGroup docs={asides} file={file} />
          </div>
        )
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
  total,
  settled,
}: {
  missing: readonly string[]
  total: number
  settled: boolean
}) {
  const { t } = useI18n()

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="register-label">{t("detail.required")}</h2>
        {/* Found against asked-for, so the rail's first line answers the
            completeness question outright rather than only naming the gap. */}
        {settled && total > 0 && (
          <span
            data-mono
            className={cn(
              "shrink-0 text-[0.6875rem] tabular-nums",
              missing.length > 0 ? "text-incomplete-ink" : "text-muted-foreground",
            )}
          >
            {t("detail.required_found", { n: total - missing.length, total })}
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
// In the order an inspector works down them: what the package is short of,
// where its documents contradict each other, what could not be read, what was
// read but should be checked, and last — under its own heading, because it is
// not a fault — what else was in the envelope.
const ISSUE_SECTIONS: { kind: IssueKind; heading: string }[] = [
  { kind: "MissingDocument", heading: "detail.sec.missing" },
  { kind: "FieldMismatch", heading: "detail.sec.mismatch" },
  { kind: "UnreadableDocument", heading: "detail.sec.unreadable" },
  { kind: "LowConfidence", heading: "detail.sec.low" },
]

// The two that are observations rather than shortfalls. They are counted apart
// from the findings, so a report that only notes the registry's own service
// sheets does not announce five problems — and, for the same reason, they are
// folded away rather than listed beside them.
const NOTE_SECTIONS: { kind: IssueKind; heading: string }[] = [
  { kind: "DuplicateDocument", heading: "detail.sec.duplicate" },
  { kind: "ExtraDocument", heading: "detail.sec.extra" },
]

const INFORMATIONAL: readonly IssueKind[] = ["ExtraDocument", "DuplicateDocument"]

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

type Finding = {
  subject: string
  where: string
  anchor: string | null
  docId: string | null
}

/** A click on a worklist or index row. The target may be filtered out of the
 *  register the inspector is currently looking at, so the jump is allowed to
 *  change the segment first — a link that lands on nothing is worse than no
 *  link. */
type Jump = (docId: string | null, anchor: string) => (e: MouseEvent) => void

type MouseEvent = Parameters<NonNullable<ComponentProps<"a">["onClick"]>>[0]

/** What a finding is about, in the reader's own language, and where in the
 *  register it can be answered. The wire carries the English audit line;
 *  nothing here reads it.
 *
 *  `named` is false for a single-file package: printing a fifty-character
 *  filename on every row of a list that is all one file states nothing and
 *  crowds out the page number, which is the part the inspector navigates by. */
function findingOf(
  t: Translate,
  issue: IssueDto,
  pkg: PackageDetailDto,
  named: boolean,
): Finding {
  const file = pkg.files.find((candidate) => candidate.id === issue.sourceFileId)
  const filename = named ? file?.originalFilename : undefined
  const document = documentsOf(pkg).find(
    (candidate) => candidate.id === issue.documentId,
  )
  const sheet =
    issue.pageNumber === null
      ? ""
      : t("detail.page_single", { n: issue.pageNumber })
  const within = [filename, sheet].filter(Boolean).join(" · ")
  // The exact row the finding is about, so the list is a set of jumps into the
  // register rather than a second account of it. A field is addressed by name;
  // anything else lands on its document. A missing document has no evidence to
  // land on — it is the one finding with nowhere to go.
  const anchor = document
    ? issue.fieldName
      ? `#field-${document.id}-${issue.fieldName}`
      : `#doc-${document.id}`
    : null

  if (issue.kind === "MissingDocument") {
    return {
      subject: translateOr(
        t,
        `doctype.${issue.documentType}`,
        issue.documentType ?? "",
      ),
      where: t("detail.f.missing_sub"),
      anchor: null,
      docId: null,
    }
  }

  // A disagreement is about a rule, not about a field: it is named by the
  // check, and it is answered in the cross-document panel, where both sides of
  // it are on one line — not on the one field the finding happens to be filed
  // against.
  if (issue.kind === "FieldMismatch") {
    const check = pkg.crossChecks.find(
      (candidate) => candidate.key === issue.checkKey,
    )

    return {
      subject: translateOr(t, `check.${issue.checkKey}`, issue.checkKey ?? ""),
      where:
        check?.verdict === "Unclear"
          ? t("detail.f.unclear_sub")
          : t("detail.f.mismatch_sub"),
      anchor: issue.checkKey ? `#check-${issue.checkKey}` : null,
      docId: null,
    }
  }

  if (issue.kind === "UnreadableDocument") {
    if (document) {
      return {
        subject: [pageLabel(t, document), filename].filter(Boolean).join(" · "),
        where: t("detail.f.unplaced_sub"),
        anchor,
        docId: document.id,
      }
    }
    return {
      subject: within || t("detail.files"),
      where:
        issue.pageNumber === null
          ? t("detail.f.unread_file_sub")
          : t("detail.f.unread_sheet_sub"),
      anchor,
      docId: null,
    }
  }

  // A document that read perfectly well. It is named by where it sits, and the
  // sub-line says what it is — not in the profile, or a second answer to a type
  // the package had already answered.
  if (issue.kind === "ExtraDocument" || issue.kind === "DuplicateDocument") {
    const where =
      issue.kind === "ExtraDocument"
        ? t("detail.f.extra_sub")
        : t("detail.f.duplicate_sub", {
            type: translateOr(
              t,
              `doctype.${issue.documentType}`,
              issue.documentType ?? "",
            ),
          })

    return {
      subject: document
        ? [pageLabel(t, document), filename].filter(Boolean).join(" · ")
        : within || t("detail.files"),
      where,
      anchor,
      docId: document?.id ?? null,
    }
  }

  // Low confidence: the field is the subject, and the sheet it was read off is
  // where the inspector goes to settle it. A finding about the document as a
  // whole carries no sheet of its own, so it takes the document's — without it
  // a package holding two applications states the same finding twice with
  // nothing to tell the two apart.
  const seat = document
    ? [pageLabel(t, document), filename].filter(Boolean).join(" · ")
    : ""
  return {
    subject: issue.fieldName
      ? translateOr(t, `field.${issue.fieldName}`, issue.fieldName)
      : translateOr(t, `doctype.${issue.documentType}`, issue.documentType ?? ""),
    where: within || seat || t("detail.f.low_sub"),
    anchor,
    docId: document?.id ?? null,
  }
}

/** One line of the worklist. A finding with somewhere to go is a link into the
 *  register; one without reads the same and simply doesn't move. */
function FindingRow({
  finding,
  confidence,
  onJump,
}: {
  finding: Finding
  confidence: number | null
  onJump: Jump
}) {
  const { t } = useI18n()
  // `shrink` and a wrapping row, not `shrink-0`: at tablet width the old fixed
  // meta column was pushed past the card's clipped edge, taking every finding's
  // confidence figure off the screen with it.
  const body = (
    <>
      <span className="min-w-0 text-[0.8125rem] leading-snug text-foreground">
        {finding.subject}
      </span>
      <span className="flex min-w-0 shrink items-baseline gap-3">
        <span className="min-w-0 text-[0.75rem] leading-snug text-muted-foreground">
          {finding.where}
        </span>
        {confidence !== null && <Confidence value={confidence} bare />}
      </span>
    </>
  )

  const shape =
    "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-rule py-2"

  return (
    <li>
      {finding.anchor ? (
        <a
          href={finding.anchor}
          onClick={onJump(finding.docId, finding.anchor)}
          title={t("detail.attention_go")}
          className={cn(
            shape,
            "-mx-2 rounded-md px-2 transition-colors hover:bg-foreground/4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          {body}
        </a>
      ) : (
        <div className={shape}>{body}</div>
      )}
    </li>
  )
}

function Worklist({
  report,
  pkg,
  onJump,
}: {
  report: ReportDto
  pkg: PackageDetailDto
  onJump: Jump
}) {
  const { t } = useI18n()
  const tone = REPORT_TONE[report.status]
  // Findings are counted; observations are mentioned. Counting them together
  // would tell the inspector a package with one missing receipt and four of the
  // registry's own service sheets in it has five problems.
  const findings = report.issues.filter(
    (issue) => !INFORMATIONAL.includes(issue.kind),
  )
  const notes = report.issues.filter((issue) => INFORMATIONAL.includes(issue.kind))
  const named = pkg.files.length > 1

  const section = (kind: IssueKind, heading: string) => {
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
          {found.map((issue, index) => (
            <FindingRow
              key={`${kind}-${index}`}
              finding={findingOf(t, issue, pkg, named)}
              confidence={issue.confidence}
              onJump={onJump}
            />
          ))}
        </ul>
      </div>
    )
  }

  return (
    <section className="mb-9">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="register-label">{t("detail.attention")}</h2>
        <span
          data-mono
          className="text-[0.75rem] tabular-nums text-muted-foreground"
        >
          {findings.length === 0
            ? t("findings.none")
            : findings.length === 1
              ? t("findings.issue_one")
              : t("findings.issues", { n: findings.length })}
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

        {findings.length === 0 ? (
          <p className="mt-2.5 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t("detail.clean")}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            {ISSUE_SECTIONS.map(({ kind, heading }) => section(kind, heading))}
          </div>
        )}
      </div>

      {/* What the package carries beyond what the profile asks for. It is not a
          shortfall, so it does not sit inside the disposition panel and does
          not open by default — it is available, one line down, for the
          inspector who wants the full inventory. */}
      {notes.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none select-none items-baseline gap-2 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronRightIcon className="size-3.5 shrink-0 translate-y-0.5 transition-transform duration-200 group-open:rotate-90" />
            {t("detail.observations")}
            <span
              data-mono
              className="text-[0.6875rem] tabular-nums text-muted-foreground/70"
            >
              {notes.length}
            </span>
          </summary>
          <p className="mt-2 max-w-[70ch] pl-5 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t("detail.observations_note")}
          </p>
          <div className="mt-3 flex flex-col gap-5 pl-5">
            {NOTE_SECTIONS.map(({ kind, heading }) => section(kind, heading))}
          </div>
        </details>
      )}
    </section>
  )
}

// ─── Cross-document checks ───────────────────────────────────────────────────
// The one place on the surface where two documents are read on one line. Every
// other section reports a document; this reports the submission — the name on
// the identity card beside the name the application is made in, the address as
// each paper writes it. It is the check an inspector would otherwise make by
// holding two sheets up against each other, so it is laid out the way they
// would: one row per document, values down one column, the value each row
// contributes readable in full.
//
// A check that agreed is kept and folded rather than dropped: it is what the
// inspector does not have to redo, and a panel showing only the failures would
// leave them wondering which comparisons were made at all.
const VERDICT_TONE: Record<CrossCheckVerdict, "ok" | "issues" | "incomplete"> = {
  Match: "ok",
  Mismatch: "issues",
  Unclear: "incomplete",
}

const VERDICT_LABEL: Record<CrossCheckVerdict, string> = {
  Match: "detail.check_agreed",
  Mismatch: "detail.check_disagreed",
  Unclear: "detail.check_unclear",
}

function VerdictMark({ verdict }: { verdict: CrossCheckVerdict }) {
  const { t } = useI18n()
  const tone = VERDICT_TONE[verdict]

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
        tone === "ok" && "bg-ok/12 text-ok-ink",
        tone === "issues" && "bg-issues/12 text-issues-ink",
        tone === "incomplete" && "bg-incomplete/12 text-incomplete-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          tone === "ok" && "bg-ok",
          tone === "issues" && "bg-issues",
          tone === "incomplete" && "bg-incomplete",
        )}
      />
      {t(VERDICT_LABEL[verdict])}
    </span>
  )
}

/** One value a check weighed. It is a jump into the register, because the way
 *  to settle a disagreement is to look at the sheet the value was read off. */
function CheckedValueRow({
  value,
  onJump,
}: {
  value: CheckedValueDto
  onJump: Jump
}) {
  const { t } = useI18n()
  const anchor = value.documentId
    ? `#field-${value.documentId}-${value.fieldName}`
    : null

  const body = (
    <>
      <span className="min-w-0 text-[0.8125rem] leading-snug text-muted-foreground">
        {translateOr(t, `doctype.${value.documentType}`, value.documentType)}
        <span className="text-muted-foreground/60">
          {" · "}
          {translateOr(t, `field.${value.fieldName}`, value.fieldName)}
        </span>
      </span>
      <span className="flex min-w-0 items-baseline gap-3">
        <span
          data-mono
          className="min-w-0 break-words text-[0.875rem] leading-snug text-foreground"
        >
          {value.value}
        </span>
        <Confidence value={value.confidence} bare />
      </span>
    </>
  )

  const shape =
    "grid gap-x-6 gap-y-0.5 border-b border-rule py-2 sm:grid-cols-[minmax(10rem,18rem)_minmax(0,1fr)]"

  return (
    <li>
      {anchor ? (
        <a
          href={anchor}
          onClick={onJump(value.documentId, anchor)}
          title={t("detail.checks_go")}
          className={cn(
            shape,
            "-mx-2 rounded-md px-2 transition-colors hover:bg-foreground/4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          {body}
        </a>
      ) : (
        <div className={shape}>{body}</div>
      )}
    </li>
  )
}

function CrossCheckEntry({
  check,
  onJump,
}: {
  check: CrossCheckDto
  onJump: Jump
}) {
  const { t } = useI18n()

  return (
    // Open where there is something to settle, folded where there is not: a
    // panel of five agreements spelled out would push the one disagreement off
    // the screen it is on.
    <details id={`check-${check.key}`} className="group scroll-mt-16" open={check.verdict !== "Match"}>
      <summary className="-mx-2 flex cursor-pointer list-none select-none flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <ChevronRightIcon className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
        <span className="min-w-0 text-[0.8125rem] leading-snug text-foreground">
          {translateOr(t, `check.${check.key}`, check.key)}
        </span>
        <span className="ml-auto flex shrink-0 items-baseline gap-2">
          <VerdictMark verdict={check.verdict} />
          <Confidence value={check.confidence} bare />
        </span>
      </summary>
      <ul className="mt-1 flex flex-col border-t border-rule pl-5">
        {check.values.map((value, index) => (
          <CheckedValueRow
            key={`${value.documentId ?? "gone"}-${value.fieldName}-${index}`}
            value={value}
            onJump={onJump}
          />
        ))}
      </ul>
    </details>
  )
}

function CrossChecks({
  checks,
  onJump,
}: {
  checks: readonly CrossCheckDto[]
  onJump: Jump
}) {
  const { t } = useI18n()
  const agreed = checks.filter((check) => check.verdict === "Match").length

  return (
    <section className="mb-9">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="register-label">{t("detail.checks")}</h2>
        <span
          data-mono
          className={cn(
            "text-[0.75rem] tabular-nums",
            agreed === checks.length
              ? "text-muted-foreground"
              : "text-issues-ink",
          )}
        >
          {t("detail.checks_agreed", { n: agreed, total: checks.length })}
        </span>
      </div>
      <p className="mt-1 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
        {t("detail.checks_note")}
      </p>
      <div className="mt-2 flex flex-col divide-y divide-rule border-t border-rule">
        {checks.map((check) => (
          <CrossCheckEntry key={check.key} check={check} onJump={onJump} />
        ))}
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
function ContentsRow({ doc, onJump }: { doc: DocumentDto; onJump: Jump }) {
  const { t } = useI18n()
  const flagged = needsReview(doc) && doc.type !== null
  return (
    <li>
      <a
        href={`#doc-${doc.id}`}
        onClick={onJump(doc.id, `#doc-${doc.id}`)}
        className="-mx-2 flex items-baseline gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          data-mono
          className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground"
        >
          {pageLabel(t, doc)}
        </span>
        <span
          className={cn(
            "truncate text-[0.8125rem]",
            isAside(doc) ? "text-muted-foreground" : "text-foreground/85",
          )}
        >
          {doc.type
            ? translateOr(t, `doctype.${doc.type}`, doc.type)
            : t("detail.classifying")}
        </span>
        {flagged && (
          <TriangleAlertIcon
            aria-label={t("detail.needs_review")}
            className="ml-auto size-3 shrink-0 translate-y-0.5 text-incomplete-ink"
          />
        )}
      </a>
    </li>
  )
}

function Contents({
  files,
  onJump,
}: {
  files: readonly SourceFileDto[]
  onJump: Jump
}) {
  const { t } = useI18n()
  const groups = files.filter((file) => file.documents.length > 0)
  const named = groups.length > 1
  // The index answers "what is in this package". Half of what the engine placed
  // here is not a document the profile asks for, and eight identical lines
  // saying so make the seven that matter harder to find than no index at all —
  // so they fold to a count that opens.
  const asides = groups.flatMap((file) => file.documents.filter(isAside))

  return (
    <nav className="hidden xl:block">
      <h2 className="register-label">{t("detail.contents")}</h2>
      <div className="mt-2 flex flex-col gap-3">
        {groups.map((file) => {
          const listed = file.documents.filter((doc) => !isAside(doc))
          if (listed.length === 0) return null
          return (
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
                {listed.map((doc) => (
                  <ContentsRow key={doc.id} doc={doc} onJump={onJump} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {asides.length > 0 && (
        <details className="group mt-2">
          <summary className="-mx-2 flex cursor-pointer list-none select-none items-baseline gap-1.5 rounded-md px-2 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronRightIcon className="size-3 shrink-0 translate-y-0.5 transition-transform duration-200 group-open:rotate-90" />
            {t("detail.contents_rest", { n: asides.length })}
          </summary>
          <ul className="mt-1 flex flex-col">
            {asides.map((doc) => (
              <ContentsRow key={doc.id} doc={doc} onJump={onJump} />
            ))}
          </ul>
        </details>
      )}
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
  // Null until the inspector picks one, so the default can follow what the run
  // actually found rather than being frozen at first render — the package is
  // still being verified while this page is open.
  const [pickedSegment, setPickedSegment] = useState<DocSegment | null>(null)
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
  const shouldPoll = pkg?.status === "Pending" || pkg?.status === "Processing"
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
  const stageRunning = stages.some((s) => s === "current")
  const documents = documentsOf(pkg)
  const failed = view.disposition === "failed"
  const running = !pkg.report && !failed
  // Only once classification has been through every document is a type's
  // absence a finding rather than a stage that has not run yet.
  const classified = stages[2] === "done" || stages[2] === "error"
  // Null while the profiles are still loading, and null is what the rail wants:
  // it declines to state a total rather than state a wrong one.
  const expected = documentsExpected(profiles ?? [], view.profile)
  const missing = missingTypes(
    profiles ?? [],
    view.profile,
    documents.map((d) => d.type),
  )

  const counts = {
    review: documents.filter((d) => needsReview(d)).length,
    all: documents.length,
    other: documents.filter(isAside).length,
  }
  // Open on the work when there is work: a package this size is mostly settled,
  // and the segment that shows only what wants a second look is the one the
  // inspector would pick anyway. With nothing flagged there is nothing to
  // filter to, so the register opens whole.
  const segment = pickedSegment ?? (counts.review > 0 ? "review" : "all")

  // A jump out of the worklist or the index into the register. If the segment
  // on screen already shows the target, the browser's own fragment navigation
  // does the work — hash, :target wash, scroll-margin and all. If it does not,
  // the segment changes to one where the target is rendered open, and the hash
  // is set on the next frame so the jump lands after the register has re-laid.
  const jump: Jump = (docId, anchor) => (event) => {
    const doc = documents.find((candidate) => candidate.id === docId)
    if (!doc || isOpenIn(doc, segment)) return
    event.preventDefault()
    setPickedSegment(isAside(doc) ? "other" : needsReview(doc) ? "review" : "all")
    requestAnimationFrame(() => {
      window.location.hash = anchor
    })
  }

  return (
    <SurfacePage>
      <SurfaceHeading
        title={
          <span
            data-mono
            className="text-[1.0625rem] font-medium md:text-[1.25rem]"
          >
            {pkg.id}
          </span>
        }
        badge={<DispositionMark disposition={view.disposition} />}
        subtitle={subtitle}
      />

      {/* Fragment jumps are how this surface is read — a finding in the worklist
          or a line in the index, followed down into the evidence. Animating the
          scroll keeps the connection between the two visible: the register
          travels rather than cutting, so the inspector sees where the answer
          sits relative to what they clicked. Skipped under reduced motion,
          where the cut is the accessible behaviour. */}
      <SurfaceBody className="motion-safe:scroll-smooth">
        <div className="mx-auto grid w-full max-w-[88rem] gap-x-10 gap-y-7 px-4 py-7 md:px-8 md:py-9 xl:grid-cols-[minmax(0,1fr)_18rem]">
          {/* ── State of the run: how far it got, what is still expected, and
              what the package turned out to contain. Declared first so it is
              also read first — a summary before the evidence. ── */}
          <aside className="border-b border-rule pb-7 xl:col-start-2 xl:row-start-1 xl:border-b-0 xl:border-l xl:border-rule xl:pb-0 xl:pl-9">
            {/* Capped and scrollable where it sticks: a package with many
                documents must not push the end of the index past the fold with
                no way to reach it. */}
            <div className="flex flex-col gap-7 xl:sticky xl:top-1 xl:-mx-2 xl:max-h-[calc(100dvh-10rem)] xl:overflow-y-auto xl:overscroll-contain xl:px-2 xl:pb-2">
              {/* First at every stage of the run, and first once it is over —
                  where the rail is looked at, the state of the run is the line
                  that answers whether anything below it is final yet. */}
              <RunProgress
                stages={stages}
                running={running}
                failed={failed}
                stageRunning={stageRunning}
              />

              <RequiredDocuments
                missing={missing}
                total={expected ?? 0}
                settled={classified}
              />

              {documents.length > 1 && <Contents files={pkg.files} onJump={jump} />}
            </div>
          </aside>

          {/* ── The evidence: every document the engine read, with its fields
              and the source text they came from. ── */}
          <main className="min-w-0 xl:col-start-1 xl:row-start-1">
            {/* The work comes first — what the run found that wants the
                inspector's eyes, each line a jump into the evidence below. */}
            {pkg.report && <Worklist report={pkg.report} pkg={pkg} onJump={jump} />}

            {/* What the papers were asked to agree on. It follows the worklist
                because a disagreement there is answered here, and it precedes
                the register because it is read across documents rather than
                down one. */}
            {pkg.crossChecks.length > 0 && (
              <CrossChecks checks={pkg.crossChecks} onJump={jump} />
            )}

            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
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

            {/* ── The register's own triage ── the same segment strip the
                package register uses, so the two surfaces filter alike. It
                sticks, because it is how the inspector gets back out of a long
                document. */}
            {counts.all > 1 && (
              <div className="sticky top-0 z-10 -mx-1 mt-2 flex items-stretch gap-0.5 overflow-x-auto border-b border-rule-strong bg-background px-1">
                {SEGMENTS.map((seg) => {
                  const active = segment === seg
                  return (
                    <button
                      key={seg}
                      onClick={() => setPickedSegment(seg)}
                      aria-pressed={active}
                      disabled={counts[seg] === 0}
                      className={cn(
                        "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-[0.8125rem] transition-colors",
                        "after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-transparent",
                        "disabled:pointer-events-none disabled:opacity-40",
                        active
                          ? "font-medium text-foreground after:bg-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(SEGMENT_KEY[seg])}
                      <span
                        data-mono
                        className={cn(
                          "text-[0.6875rem] tabular-nums",
                          active
                            ? "text-foreground/60"
                            : "text-muted-foreground/60",
                        )}
                      >
                        {counts[seg]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-10">
              {pkg.files.map((file) => (
                <FileGroup
                  key={file.id}
                  file={file}
                  failed={view.disposition === "failed"}
                  segment={segment}
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
