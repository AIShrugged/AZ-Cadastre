/**
 * Verification register — the inspector's queue-first work surface. Governed by
 * The Register world: a ruled table, tabular mono data, one blue signal, and
 * disposition marks that report (never decide). Doubles as the archive via
 * search + segment filters. Adaptive density; scales via pagination.
 */
import { useEffect, useMemo, useState } from "react"
import {
  ChevronRightIcon,
  FilterXIcon,
  InboxIcon,
  PlusIcon,
  Rows2Icon,
  Rows4Icon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DispositionMark } from "@/components/register/status-mark"
import { StageBar } from "@/components/register/stage-bar"
import { LocaleSwitch } from "@/components/locale-switch"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  formatDate,
  relativeShort,
  useI18n,
  type Locale,
} from "@/lib/i18n"
import {
  inSegment,
  matchesQuery,
  PACKAGES,
  segmentCounts,
  type Segment,
  type VerificationPackage,
} from "@/lib/registry"
import { cn } from "@/lib/utils"

type Density = "comfortable" | "compact"

const SEGMENTS: Segment[] = [
  "all",
  "in_progress",
  "issues",
  "incomplete",
  "ok",
  "failed",
]

const SEG_KEY: Record<Segment, string> = {
  all: "seg.all",
  in_progress: "seg.in_progress",
  issues: "seg.issues",
  incomplete: "seg.incomplete",
  ok: "seg.ok",
  failed: "seg.failed",
}

// ─── Findings cell ──────────────────────────────────────────────────────────
function Findings({ p }: { p: VerificationPackage }) {
  const { t } = useI18n()
  if (p.disposition === "in_progress" || p.disposition === "failed") {
    return <span className="text-muted-foreground/60">—</span>
  }
  if (p.issues === 0 && p.lowConfidence === 0) {
    return <span className="text-muted-foreground">{t("findings.none")}</span>
  }
  return (
    <span className="flex flex-col gap-0.5 leading-tight">
      {p.issues > 0 && (
        <span className="font-medium text-issues-ink">
          {p.issues === 1 ? t("findings.issue_one") : t("findings.issues", { n: p.issues })}
        </span>
      )}
      {p.lowConfidence > 0 && (
        <span className="text-[0.75rem] text-muted-foreground">
          {t("findings.low", { n: p.lowConfidence })}
          {typeof p.minConfidence === "number" && (
            <>
              {" · "}
              <span data-mono>{t("min_conf", { c: p.minConfidence })}</span>
            </>
          )}
        </span>
      )}
    </span>
  )
}

// ─── Documents cell ─────────────────────────────────────────────────────────
function Documents({ p }: { p: VerificationPackage }) {
  const short = p.docsDetected < p.docsRequired
  return (
    <span
      data-mono
      className={cn(
        "text-[0.8125rem]",
        short ? "text-incomplete-ink" : "text-foreground/80",
      )}
    >
      {p.docsDetected}/{p.docsRequired}
    </span>
  )
}

// ─── Submitted cell ─────────────────────────────────────────────────────────
function Submitted({ p, locale, now }: { p: VerificationPackage; locale: Locale; now: number }) {
  const { t } = useI18n()
  if (p.disposition === "in_progress") {
    return (
      <span className="flex flex-col gap-0.5 leading-tight">
        <span data-mono className="text-[0.8125rem] text-foreground/80">
          {formatDate(p.submittedAt, locale)}
        </span>
        <span className="text-[0.75rem] text-progress">
          {t("updated.ago", { t: relativeShort(p.updatedAt, now) })}
        </span>
      </span>
    )
  }
  return (
    <span data-mono className="text-[0.8125rem] text-foreground/80">
      {formatDate(p.submittedAt, locale)}
    </span>
  )
}

// ─── Status cell ────────────────────────────────────────────────────────────
function Status({ p }: { p: VerificationPackage }) {
  if (p.disposition === "in_progress" && p.stage) {
    return <StageBar stage={p.stage} />
  }
  return <DispositionMark disposition={p.disposition} />
}

// ─── Desktop table ──────────────────────────────────────────────────────────
function RegisterTable({
  rows,
  density,
  selected,
  onSelect,
  locale,
  now,
}: {
  rows: VerificationPackage[]
  density: Density
  selected: string | null
  onSelect: (p: VerificationPackage) => void
  locale: Locale
  now: number
}) {
  const { t } = useI18n()
  const pad = density === "compact" ? "py-2.5" : "py-4"

  return (
    <Table className="border-separate border-spacing-0">
      <TableHeader>
        <TableRow className="border-0 hover:bg-transparent">
          {["col.package", "col.profile", "col.documents", "col.findings", "col.submitted", "col.status"].map(
            (c, i) => (
              <TableHead
                key={c}
                className={cn(
                  "register-label sticky top-0 z-10 h-auto border-b border-rule-strong bg-background px-4 py-2.5",
                  i === 0 && "pl-6",
                  i === 5 && "pr-6",
                )}
              >
                {t(c)}
              </TableHead>
            ),
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => {
          const isSel = selected === p.id
          return (
            <TableRow
              key={p.id}
              tabIndex={0}
              onClick={() => onSelect(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(p)
                }
              }}
              className={cn(
                "group cursor-pointer border-0 outline-none transition-colors",
                isSel ? "bg-accent" : "hover:bg-accent/50 focus-visible:bg-accent/50",
              )}
            >
              <TableCell
                className={cn(
                  "border-b border-rule pl-6 pr-4 align-middle",
                  pad,
                  isSel && "shadow-[inset_2px_0_0_var(--color-primary)]",
                )}
              >
                <div className="flex flex-col gap-0.5 leading-tight">
                  <span data-mono className="text-[0.8125rem] font-medium text-foreground">
                    {p.id}
                  </span>
                  <span className="max-w-[22ch] truncate text-[0.8125rem] text-muted-foreground">
                    {p.applicant}
                  </span>
                </div>
              </TableCell>
              <TableCell className={cn("border-b border-rule px-4 align-middle", pad)}>
                <span className="text-[0.8125rem] text-muted-foreground">
                  {t(p.profile === "demo" ? "profile.demo" : "profile.cadastre")}
                </span>
              </TableCell>
              <TableCell className={cn("border-b border-rule px-4 align-middle tabular-nums", pad)}>
                <Documents p={p} />
              </TableCell>
              <TableCell className={cn("border-b border-rule px-4 align-middle", pad)}>
                <Findings p={p} />
              </TableCell>
              <TableCell className={cn("border-b border-rule px-4 align-middle", pad)}>
                <Submitted p={p} locale={locale} now={now} />
              </TableCell>
              <TableCell className={cn("border-b border-rule py-2 pr-6 pl-4 align-middle", pad)}>
                <div className="flex items-center justify-between gap-3">
                  <Status p={p} />
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground group-focus-visible:text-muted-foreground" />
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// ─── Mobile entry list ──────────────────────────────────────────────────────
function RegisterEntries({
  rows,
  onSelect,
  locale,
}: {
  rows: VerificationPackage[]
  onSelect: (p: VerificationPackage) => void
  locale: Locale
}) {
  const { t } = useI18n()
  return (
    <ul className="flex flex-col border-t border-rule-strong">
      {rows.map((p) => (
        <li key={p.id}>
          <button
            onClick={() => onSelect(p)}
            className="flex w-full flex-col gap-2.5 border-b border-rule px-4 py-4 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span data-mono className="text-[0.8125rem] font-medium text-foreground">
                  {p.id}
                </span>
                <span className="truncate text-[0.8125rem] text-muted-foreground">
                  {p.applicant}
                </span>
              </div>
              {p.disposition !== "in_progress" && <DispositionMark disposition={p.disposition} />}
            </div>
            {p.disposition === "in_progress" && p.stage ? (
              <StageBar stage={p.stage} />
            ) : (
              <div className="flex items-center gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground">
                <span>
                  {t("col.documents")}{" "}
                  <span data-mono className="text-foreground/70">
                    {p.docsDetected}/{p.docsRequired}
                  </span>
                </span>
                <span data-mono>{formatDate(p.submittedAt, locale)}</span>
                <Findings p={p} />
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─── Loading state ──────────────────────────────────────────────────────────
function RegisterSkeleton({ density }: { density: Density }) {
  const pad = density === "compact" ? "py-3" : "py-[18px]"
  return (
    <div className="flex-1 border-t border-rule-strong" aria-busy="true" aria-live="polite">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={cn("flex items-center gap-4 border-b border-rule px-4 md:px-6", pad)}>
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="hidden h-3 w-24 md:block" />
          <Skeleton className="hidden h-3 w-8 md:block" />
          <Skeleton className="hidden h-3 w-20 md:block" />
          <Skeleton className="hidden h-3 w-20 md:block" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  )
}

// ─── Empty states ───────────────────────────────────────────────────────────
function EmptyRegister({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const { t } = useI18n()
  return (
    <Empty className="register-hatch flex-1 rounded-none border-0 border-t border-rule-strong px-6 py-24">
      <EmptyMedia
        variant="icon"
        className="mb-0 size-12 rounded-none border border-rule-strong bg-background text-muted-foreground"
      >
        {filtered ? <FilterXIcon className="size-5" /> : <InboxIcon className="size-5" />}
      </EmptyMedia>
      <EmptyHeader className="gap-1.5">
        <EmptyTitle className="text-[1.0625rem] font-semibold tracking-tight text-foreground">
          {t(filtered ? "empty.filtered.title" : "empty.title")}
        </EmptyTitle>
        <EmptyDescription className="text-[0.875rem] leading-relaxed text-muted-foreground">
          {t(filtered ? "empty.filtered.body" : "empty.body")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button variant="outline" onClick={onClear}>
            <FilterXIcon /> {t("empty.clear")}
          </Button>
        ) : (
          <Button onClick={() => toast(t("nav.new"), { description: t("toast.new") })}>
            <PlusIcon /> {t("action.new")}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { t, locale } = useI18n()
  const [now] = useState(() => new Date("2026-07-23T09:00:00").getTime())
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [segment, setSegment] = useState<Segment>("all")
  const [density, setDensity] = useState<Density>("comfortable")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(id)
  }, [])

  const counts = useMemo(() => segmentCounts(PACKAGES), [])

  const filtered = useMemo(
    () => PACKAGES.filter((p) => inSegment(p, segment) && matchesQuery(p, query)),
    [segment, query],
  )

  const pageSize = density === "compact" ? 12 : 8
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * pageSize
  const rows = filtered.slice(start, start + pageSize)

  const resetPage = () => setPage(1)

  const onSelect = (p: VerificationPackage) => {
    setSelected(p.id)
    toast(t("toast.opened", { id: p.id }))
  }

  const isFiltered = segment !== "all" || query.trim().length > 0

  return (
    <div className="flex min-h-svh flex-col">
      {/* ── Masthead ── fixed to a single band so its baseline and bottom rule
          align with the sidebar logo across the top of the page. */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule-strong px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <SidebarTrigger
            aria-label={t("sidebar.toggle")}
            className="size-8 shrink-0 rounded-none border border-input text-muted-foreground hover:bg-accent hover:text-foreground"
          />
          <h1 className="truncate text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
            {t("page.register.title")}
          </h1>
          <DemoBadge className="hidden shrink-0 sm:inline-flex" />
        </div>

        {/* Global chrome (locale + appearance), then the one page action. */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5">
            <LocaleSwitch />
            <ThemeToggle />
          </div>
          <span aria-hidden className="h-6 w-px bg-rule-strong" />
          <Button
            onClick={() => toast(t("nav.new"), { description: t("toast.new") })}
          >
            <PlusIcon /> <span className="hidden sm:inline">{t("action.new")}</span>
          </Button>
        </div>
      </header>

      {/* ── Standfirst ── the register's descriptive dek, sitting under the
          masthead where a document states its purpose before its contents. */}
      <p className="border-b border-rule px-4 py-2.5 text-[0.875rem] leading-relaxed text-muted-foreground md:px-6">
        {t("page.register.subtitle")}
      </p>

      {/* ── Filter / control strip ── */}
      <div className="flex flex-col gap-3 border-b border-rule px-4 py-2.5 md:flex-row md:items-center md:justify-between md:px-6">
        {/* Segments — horizontal scroll on overflow. The active underline is
            drawn at after:bottom-0, i.e. inside the button box rather than a
            negative offset that escapes the scroller, so overflow-x can't spawn
            a stray vertical scrollbar. It anchors to the chips (not pinned onto
            the strip's rule) so it never crowds the register below. */}
        <div className="-mx-1 flex items-stretch gap-0.5 overflow-x-auto px-1">
          {SEGMENTS.map((seg) => {
            const active = segment === seg
            return (
              <button
                key={seg}
                onClick={() => {
                  setSegment(seg)
                  resetPage()
                }}
                aria-pressed={active}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-[0.8125rem] transition-colors",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-transparent",
                  active
                    ? "font-medium text-foreground after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(SEG_KEY[seg])}
                <span
                  data-mono
                  className={cn(
                    "text-[0.6875rem]",
                    active ? "text-foreground/60" : "text-muted-foreground/60",
                  )}
                >
                  {counts[seg]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search + density */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72 md:flex-none">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                resetPage()
              }}
              placeholder={t("search.placeholder")}
              className="h-8 rounded-none border-input bg-background pl-8 text-[0.8125rem]"
            />
          </div>
          <ToggleGroup
            value={[density]}
            onValueChange={(v: string[]) => {
              if (v.length) setDensity(v[0] as Density)
            }}
            spacing={0}
            aria-label={t("density.label")}
            className="rounded-none border border-input"
          >
            <ToggleGroupItem
              value="comfortable"
              aria-label={t("density.comfortable")}
              className="size-8 rounded-none data-pressed:bg-accent data-pressed:text-foreground"
            >
              <Rows2Icon className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="compact"
              aria-label={t("density.compact")}
              className="size-8 rounded-none data-pressed:bg-accent data-pressed:text-foreground"
            >
              <Rows4Icon className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* ── Register body ── */}
      {loading ? (
        <RegisterSkeleton density={density} />
      ) : rows.length === 0 ? (
        <EmptyRegister
          filtered={isFiltered}
          onClear={() => {
            setSegment("all")
            setQuery("")
            resetPage()
          }}
        />
      ) : (
        <>
          <div className="hidden flex-1 md:block md:pt-3">
            <RegisterTable
              rows={rows}
              density={density}
              selected={selected}
              onSelect={onSelect}
              locale={locale}
              now={now}
            />
          </div>
          <div className="flex-1 md:hidden">
            <RegisterEntries rows={rows} onSelect={onSelect} locale={locale} />
          </div>
        </>
      )}

      {/* ── Pagination footer ── always rendered so the register's closing rule
          and the h-14 bookend hold across loading, empty, and populated states.
          While loading, counts are unknown, so the row placeholders a skeleton
          in place of the tally rather than showing a misleading 0. */}
      <footer className="mt-auto flex h-14 shrink-0 items-center justify-between gap-4 border-t border-rule-strong px-4 md:px-6">
        {loading ? (
          <Skeleton className="h-3 w-40" />
        ) : (
          <>
            <p className="text-[0.8125rem] text-muted-foreground">
              <span data-mono className="text-foreground/70">
                {t("page.showing", {
                  a: filtered.length === 0 ? 0 : start + 1,
                  b: Math.min(start + pageSize, filtered.length),
                  n: filtered.length,
                })}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={current <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("page.prev")}
              </Button>
              <span data-mono className="px-1 text-[0.8125rem] text-muted-foreground">
                {current} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={current >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                {t("page.next")}
              </Button>
            </div>
          </>
        )}
      </footer>
    </div>
  )
}

function DemoBadge({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 rounded-none border-rule-strong bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground",
              className,
            )}
          >
            <span aria-hidden className="size-1.5 bg-issues" />
            {t("demo.badge")}
          </Badge>
        }
      />
      <TooltipContent>{t("demo.note")}</TooltipContent>
    </Tooltip>
  )
}
