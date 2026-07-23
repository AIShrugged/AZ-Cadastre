/**
 * New verification — the surface where an inspector opens a Verification
 * Package: choose the governing Profile, attach the submitted documents, and
 * start the pipeline. Governed by The Register world — ruled bands (no cards),
 * tabular mono for filenames/sizes/counts, one indigo action, round-dot markers
 * that state a factual attach-state (never an approval).
 *
 * Product truth made visible: Profiles are policy. Choosing a profile renders
 * its required-document policy as the page's spine. The inspector's slot
 * mapping is a hint — the engine re-reads and classifies every document. Start
 * is never hard-gated on completeness; the report flags an Incomplete Package.
 */
import { useEffect, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  RotateCwIcon,
  TriangleAlertIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { LocaleSwitch } from "@/components/locale-switch"
import { ThemeToggle } from "@/components/theme-toggle"
import { useI18n } from "@/lib/i18n"
import { usePackages } from "@/lib/packages-store"
import { paths } from "@/lib/paths"
import {
  createPackage,
  nextPackageId,
  PROFILES,
  PROFILE_ORDER,
  type DocTypeKey,
  type ProfileKey,
} from "@/lib/registry"
import { cn } from "@/lib/utils"

const MAX_MB = 25
const MAX_BYTES = MAX_MB * 1024 * 1024
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"

type FileKind = "pdf" | "image"
type Status = "uploading" | "ready" | "error"
type ErrKind = "format" | "size" | "failed"

type Attachment = {
  id: string
  name: string
  size: number
  kind: FileKind
  /** Which required document type this file is mapped to, or null = additional. */
  slot: DocTypeKey | null
  status: Status
  progress: number
  pages?: number
  error?: ErrKind
}

function fileKind(name: string): FileKind | null {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "pdf"
  if (ext === "jpg" || ext === "jpeg" || ext === "png") return "image"
  return null
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Marker ───────────────────────────────────────────────────────────────────
// A round dot that states attach-state. Empty = open ring; ready = filled ink;
// uploading = indigo ring; error = destructive. Always paired with a word.
function DocMarker({ state }: { state: "empty" | "uploading" | "ready" | "error" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-2.5 shrink-0 place-items-center rounded-full border-2 transition-all duration-300",
        state === "empty" && "border-rule-strong bg-transparent",
        state === "uploading" && "animate-pulse border-primary bg-transparent",
        state === "ready" && "scale-110 border-foreground bg-foreground",
        state === "error" && "border-destructive bg-destructive",
      )}
    />
  )
}

// ─── One document row (required slot or additional file) ──────────────────────
function AttachmentRow({
  label,
  att,
  onAttach,
  onRemove,
  onRetry,
  onDropFiles,
}: {
  label: string
  att: Attachment | null
  onAttach: () => void
  onRemove?: () => void
  onRetry?: () => void
  onDropFiles?: (files: FileList) => void
}) {
  const { t } = useI18n()
  const [over, setOver] = useState(false)

  const state: "empty" | "uploading" | "ready" | "error" = !att
    ? "empty"
    : att.status === "error"
      ? "error"
      : att.status === "uploading"
        ? "uploading"
        : "ready"

  const KindIcon = att?.kind === "image" ? ImageIcon : FileTextIcon
  const droppable = Boolean(onDropFiles)

  return (
    <div
      onDragOver={
        droppable
          ? (e) => {
              if (Array.from(e.dataTransfer.types).includes("Files")) {
                e.preventDefault()
                e.stopPropagation()
                setOver(true)
              }
            }
          : undefined
      }
      onDragLeave={droppable ? () => setOver(false) : undefined}
      onDrop={
        droppable
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              setOver(false)
              if (e.dataTransfer.files.length) onDropFiles?.(e.dataTransfer.files)
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-3 border-b border-rule px-1 py-3.5 transition-colors",
        over && "bg-accent/60",
      )}
    >
      <DocMarker state={state} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[0.875rem] font-medium text-foreground">{label}</span>
        </div>

        {/* Second line — the file's state */}
        {!att ? (
          <span className="text-[0.8125rem] text-muted-foreground">{t("new.doc.not_attached")}</span>
        ) : att.status === "error" ? (
          <span className="flex items-center gap-1.5 text-[0.8125rem] text-destructive">
            <span data-mono className="truncate text-muted-foreground line-through">{att.name}</span>
            <span aria-hidden>·</span>
            <span>
              {att.error === "size"
                ? t("new.err.size", { max: MAX_MB })
                : att.error === "failed"
                  ? t("new.err.failed")
                  : t("new.err.format")}
            </span>
          </span>
        ) : att.status === "uploading" ? (
          <div className="flex items-center gap-2.5">
            <span data-mono className="max-w-[16rem] truncate text-[0.8125rem] text-muted-foreground">
              {att.name}
            </span>
            <span className="h-[3px] w-24 overflow-hidden rounded-full bg-rule">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${att.progress}%` }}
              />
            </span>
            <span data-mono className="text-[0.75rem] tabular-nums text-muted-foreground">
              {att.progress < 100 ? t("new.uploading", { p: att.progress }) : t("new.reading_pages")}
            </span>
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
            <KindIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span data-mono className="max-w-[16rem] truncate text-foreground/80">{att.name}</span>
            <span aria-hidden>·</span>
            {att.kind === "pdf" && att.pages != null && (
              <>
                <span data-mono className="tabular-nums">
                  {att.pages === 1 ? t("new.page_one") : t("new.pages", { n: att.pages })}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span data-mono className="tabular-nums">{formatBytes(att.size)}</span>
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {!att ? (
          <Button variant="outline" size="sm" onClick={onAttach}>
            <PaperclipIcon /> {t("new.attach")}
          </Button>
        ) : att.status === "error" ? (
          <>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCwIcon /> {t("new.retry")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("new.remove")}
              onClick={onRemove}
            >
              <XIcon />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onAttach} disabled={att.status === "uploading"}>
              {t("new.replace")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("new.remove")}
              onClick={onRemove}
            >
              <XIcon />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function NewVerification() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { packages, addPackage } = usePackages()

  const [profile, setProfile] = useState<ProfileKey>("cadastre")
  const [reference, setReference] = useState("")
  const [files, setFiles] = useState<Attachment[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const filesRef = useRef(files)
  const idRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingSlot = useRef<DocTypeKey | undefined>(undefined)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({})
  const dragDepth = useRef(0)

  const requiredDocs = PROFILES[profile].requiredDocs

  // Mirror files into a ref so drag/drop and picker handlers read fresh state
  // without threading it through every closure.
  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    const all = timers.current
    return () => {
      for (const id of Object.keys(all)) all[id]?.forEach(clearTimeout)
    }
  }, [])

  function clearTimers(id: string) {
    timers.current[id]?.forEach(clearTimeout)
    delete timers.current[id]
  }

  // Simulated transfer to object storage; PDFs resolve a page count on arrival.
  function runUpload(id: string, kind: FileKind) {
    const steps: [number, number][] = [[130, 26], [300, 58], [470, 85], [660, 100]]
    timers.current[id] = steps.map(([delay, pct]) =>
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) => {
            if (f.id !== id) return f
            if (pct < 100) return { ...f, progress: pct }
            const pages = kind === "pdf" ? 2 + Math.floor(Math.random() * 4) : 1
            return { ...f, progress: 100, status: "ready", pages }
          }),
        )
      }, delay),
    )
  }

  function addFiles(list: FileList, target?: DocTypeKey) {
    const incoming = Array.from(list)
    if (!incoming.length) return
    const next = [...filesRef.current]
    const toUpload: { id: string; kind: FileKind }[] = []
    const occupied = new Set(
      next.filter((f) => f.slot && f.status !== "error").map((f) => f.slot),
    )

    for (const file of incoming) {
      const id = `att-${++idRef.current}`
      const kind = fileKind(file.name)
      if (!kind) {
        next.push({ id, name: file.name, size: file.size, kind: "image", slot: null, status: "error", progress: 0, error: "format" })
        continue
      }
      if (file.size > MAX_BYTES) {
        next.push({ id, name: file.name, size: file.size, kind, slot: null, status: "error", progress: 0, error: "size" })
        continue
      }
      let slot: DocTypeKey | null
      if (target) {
        // Explicit slot — replace whatever occupied it.
        const ex = next.findIndex((f) => f.slot === target && f.status !== "error")
        if (ex >= 0) {
          clearTimers(next[ex].id)
          next.splice(ex, 1)
        }
        slot = target
        occupied.add(target)
      } else {
        // Auto — fill the next unfilled required slot, else additional.
        const open = requiredDocs.find((d) => !occupied.has(d))
        slot = open ?? null
        if (open) occupied.add(open)
      }
      next.push({ id, name: file.name, size: file.size, kind, slot, status: "uploading", progress: 0 })
      toUpload.push({ id, kind })
    }

    setFiles(next)
    toUpload.forEach((u) => runUpload(u.id, u.kind))
  }

  function removeFile(id: string) {
    clearTimers(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function openPicker(slot?: DocTypeKey) {
    pendingSlot.current = slot
    inputRef.current?.click()
  }

  function onProfileChange(p: ProfileKey) {
    setProfile(p)
    const req = PROFILES[p].requiredDocs
    // Non-destructive: files whose type no longer applies become additional.
    setFiles((prev) => prev.map((f) => (f.slot && !req.includes(f.slot) ? { ...f, slot: null } : f)))
  }

  // Derived state
  const extras = files.filter((f) => f.slot === null)
  const attForSlot = (slot: DocTypeKey) => files.find((f) => f.slot === slot) ?? null
  const covered = requiredDocs.filter((d) =>
    files.some((f) => f.slot === d && f.status === "ready"),
  ).length
  const readyCount = files.filter((f) => f.status === "ready").length
  const missing = requiredDocs.length - covered
  const canStart = readyCount > 0 && !submitting

  const docName = (d: DocTypeKey) => t(`doctype.${d}`)
  const profileName = (p: ProfileKey) => t(p === "demo" ? "profile.demo" : "profile.cadastre")

  function onStart() {
    if (!canStart) return
    setSubmitting(true)
    const id = nextPackageId(packages)
    window.setTimeout(() => {
      addPackage(
        createPackage({
          id,
          profile,
          filesAttached: readyCount,
          reference,
          now: new Date().toISOString(),
        }),
      )
      toast(t("toast.started", { id }))
      navigate(paths.register)
    }, 480)
  }

  // Page-level drag overlay
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files")

  return (
    <div
      className="flex h-svh flex-col overflow-hidden"
      onDragEnter={(e) => {
        if (hasFiles(e)) {
          e.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setDragging(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files, pendingSlot.current)
          e.target.value = ""
          pendingSlot.current = undefined
        }}
      />

      {/* ── Masthead ── */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-rule-strong px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("new.back")}
            onClick={() => navigate(paths.register)}
            className="rounded-md border-input text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0">
            <nav className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
              <button
                onClick={() => navigate(paths.register)}
                className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {t("page.register.title")}
              </button>
              <span aria-hidden>/</span>
            </nav>
            <h1 className="truncate text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
              {t("page.new.title")}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <LocaleSwitch />
          <ThemeToggle />
        </div>
      </header>

      {/* ── Standfirst ── */}
      <p className="border-b border-rule px-4 py-2.5 text-[0.875rem] leading-relaxed text-muted-foreground md:px-6">
        {t("page.new.subtitle")}
      </p>

      {/* ── Body ── a governed form on a constrained measure ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
          {/* Section — Profile & reference */}
          <section>
            <h2 className="register-label mb-3">{t("new.section.profile")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.8125rem] font-medium text-foreground" htmlFor="profile">
                  {t("new.field.profile")}
                </label>
                <Select value={profile} onValueChange={(v) => onProfileChange(v as ProfileKey)}>
                  <SelectTrigger id="profile" className="h-9 border-input bg-card">
                    <span className="text-[0.875rem]">{profileName(profile)}</span>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {PROFILE_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {profileName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-foreground" htmlFor="reference">
                  {t("new.field.reference")}
                  <span className="text-[0.6875rem] font-normal text-muted-foreground">({t("new.field.optional")})</span>
                </label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={t("new.reference.placeholder")}
                  className="h-9 border-input bg-card"
                />
              </div>
            </div>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
              {t("new.profile.expects", {
                n: requiredDocs.length,
                list: requiredDocs.map(docName).join(", "),
              })}
            </p>
          </section>

          {/* Section — Required documents (the checklist spine) */}
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="register-label">{t("new.section.required")}</h2>
              <span data-mono className="text-[0.8125rem] tabular-nums text-muted-foreground">
                {covered} / {requiredDocs.length}
              </span>
            </div>
            <p className="mt-1.5 mb-1 text-[0.75rem] leading-relaxed text-muted-foreground">
              {t("new.mapping_hint")}
            </p>
            <div className="border-t border-rule-strong">
              {requiredDocs.map((d) => (
                <AttachmentRow
                  key={d}
                  label={docName(d)}
                  att={attForSlot(d)}
                  onAttach={() => openPicker(d)}
                  onRemove={() => {
                    const a = attForSlot(d)
                    if (a) removeFile(a.id)
                  }}
                  onRetry={() => openPicker(d)}
                  onDropFiles={(fl) => addFiles(fl, d)}
                />
              ))}
            </div>
          </section>

          {/* Section — Additional documents + dropzone */}
          <section className="mt-8">
            <h2 className="register-label">{t("new.section.additional")}</h2>
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground">
              {t("new.additional.hint")}
            </p>

            {extras.length > 0 && (
              <div className="mt-3 border-t border-rule-strong">
                {extras.map((a) => (
                  <AttachmentRow
                    key={a.id}
                    label={a.status === "error" ? a.name : t("new.doc.additional")}
                    att={a}
                    onAttach={() => openPicker()}
                    onRemove={() => removeFile(a.id)}
                    onRetry={() => openPicker()}
                  />
                ))}
              </div>
            )}

            {/* Dropzone — engraver's hatch fill, dashed rule, click to browse */}
            <button
              type="button"
              onClick={() => openPicker()}
              className={cn(
                "register-hatch mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
                "border-rule-strong hover:border-primary/60 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <span className="grid size-9 place-items-center rounded-lg border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]">
                <UploadCloudIcon className="size-4.5" />
              </span>
              <span className="mt-0.5 text-[0.875rem] font-medium text-foreground">{t("new.dropzone.title")}</span>
              <span className="max-w-sm text-[0.8125rem] leading-relaxed text-muted-foreground">{t("new.dropzone.body")}</span>
            </button>
          </section>
        </div>
      </div>

      {/* ── Sticky footer action bar ── */}
      <footer className="mt-auto flex shrink-0 flex-col gap-2 border-t border-rule-strong px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[0.8125rem] text-muted-foreground">
            {readyCount === 0 ? (
              t("new.tally.none")
            ) : (
              <span data-mono className="tabular-nums text-foreground/80">
                {t("new.tally", { covered, required: requiredDocs.length, files: readyCount })}
              </span>
            )}
          </span>
          {readyCount > 0 && missing > 0 && (
            <span className="flex items-center gap-1.5 text-[0.75rem] leading-snug text-muted-foreground">
              <TriangleAlertIcon className="size-3.5 shrink-0 text-incomplete-ink" aria-hidden />
              {missing === 1
                ? t("new.incomplete_note_one")
                : t("new.incomplete_note", { n: missing })}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => navigate(paths.register)}>
            {t("new.cancel")}
          </Button>
          <Button onClick={onStart} disabled={!canStart} aria-disabled={!canStart}>
            {submitting ? t("new.starting") : t("new.start")}
          </Button>
        </div>
      </footer>

      {/* ── Whole-page drop overlay ── a state wash, not a floating card ── */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/8 p-6 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/70 bg-background/80 px-10 py-8 text-primary">
            <UploadCloudIcon className="size-7" />
            <span className="text-[0.9375rem] font-medium">{t("new.drop_overlay")}</span>
          </div>
        </div>
      )}
    </div>
  )
}
