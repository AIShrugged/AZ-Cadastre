/**
 * New verification — the surface where an inspector opens a Verification
 * Package: choose the governing Profile, add the submitted documents, and start
 * the pipeline. Governed by The Register world — ruled bands, tabular mono for
 * filenames/sizes/counts, one indigo action, disposition that reports (never
 * decides).
 *
 * Product truth made visible: the inspector adds any files freely through one
 * dropzone — the engine reads and classifies every document, so there is no
 * per-type mapping to do by hand. The profile's expected documents are shown as
 * reference only; completeness is checked by the pipeline, and Start is never
 * hard-gated (the report flags an Incomplete Package).
 */
import { useEffect, useRef, useState } from "react"
import {
  FileTextIcon,
  FlaskConicalIcon,
  ImageIcon,
  LandPlotIcon,
  LightbulbIcon,
  TriangleAlertIcon,
  UploadCloudIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from "@/components/register/surface"
import { useI18n } from "@/lib/i18n"
import { usePackages } from "@/lib/packages-store"
import { paths } from "@/lib/paths"
import {
  createPackage,
  nextPackageId,
  PROFILES,
  PROFILE_ORDER,
  type ProfileKey,
} from "@/lib/registry"
import { cn } from "@/lib/utils"

const PROFILE_ICON: Record<ProfileKey, LucideIcon> = {
  cadastre: LandPlotIcon,
  demo: FlaskConicalIcon,
}

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

// ─── One uploaded file ────────────────────────────────────────────────────────
function FileRow({
  att,
  onRemove,
}: {
  att: Attachment
  onRemove: () => void
}) {
  const { t } = useI18n()
  const isErr = att.status === "error"
  const isUp = att.status === "uploading"
  const KindIcon = att.kind === "image" ? ImageIcon : FileTextIcon

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
          isErr
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-rule-strong bg-card text-muted-foreground",
        )}
      >
        {isErr ? <TriangleAlertIcon className="size-4" /> : <KindIcon className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate">
          <span
            data-mono
            className={cn(
              "text-[0.8125rem]",
              isErr ? "text-muted-foreground line-through" : "text-foreground/90",
            )}
          >
            {att.name}
          </span>
        </div>

        {isUp ? (
          <div className="mt-1 flex items-center gap-2.5">
            <span className="h-[3px] w-full max-w-[11rem] overflow-hidden rounded-full bg-rule">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${att.progress}%` }}
              />
            </span>
            <span data-mono className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
              {att.progress < 100 ? t("new.uploading", { p: att.progress }) : t("new.reading_pages")}
            </span>
          </div>
        ) : isErr ? (
          <span className="text-[0.75rem] text-destructive">
            {att.error === "size"
              ? t("new.err.size", { max: MAX_MB })
              : att.error === "failed"
                ? t("new.err.failed")
                : t("new.err.format")}
          </span>
        ) : (
          <span data-mono className="text-[0.75rem] tabular-nums text-muted-foreground">
            {att.kind === "pdf" && att.pages != null && (
              <>{att.pages === 1 ? t("new.page_one") : t("new.pages", { n: att.pages })} · </>
            )}
            {formatBytes(att.size)}
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("new.remove")}
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <XIcon />
      </Button>
    </li>
  )
}

// ─── The single dropzone ──────────────────────────────────────────────────────
function Dropzone({ onBrowse, className }: { onBrowse: () => void; className?: string }) {
  const { t } = useI18n()
  return (
    <div
      onClick={onBrowse}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-rule-strong bg-muted/30 px-6 py-14 text-center transition-colors",
        "hover:border-primary/55 hover:bg-accent/40",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)] transition-transform group-hover:-translate-y-0.5">
        <UploadCloudIcon className="size-7" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{t("new.dropzone.title")}</p>
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("new.dropzone.body", { max: MAX_MB })}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onBrowse()
        }}
      >
        {t("new.dropzone.browse")}
      </Button>
    </div>
  )
}

// ─── Profile picker ───────────────────────────────────────────────────────────
// A segmented radio-card selector — a tactile choice, not a dropdown. Each card
// carries the profile's identity glyph, its name, and how many documents it
// expects; the selected card takes the indigo ring and a filled check.
function ProfilePicker({
  value,
  onChange,
}: {
  value: ProfileKey
  onChange: (p: ProfileKey) => void
}) {
  const { t } = useI18n()
  const profileName = (p: ProfileKey) => t(p === "demo" ? "profile.demo" : "profile.cadastre")

  return (
    <div
      role="radiogroup"
      aria-label={t("new.field.profile")}
      className="grid gap-3 sm:grid-cols-2"
    >
      {PROFILE_ORDER.map((p) => {
        const selected = p === value
        const Icon = PROFILE_ICON[p]
        const count = PROFILES[p].requiredDocs.length
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p)}
            className={cn(
              "group flex items-center gap-3 rounded-xl border p-3.5 text-left outline-none transition-all",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-accent/50 shadow-[var(--shadow-sm)] ring-1 ring-primary"
                : "border-input bg-card hover:border-rule-strong hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
                selected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-rule-strong bg-muted/40 text-muted-foreground",
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.875rem] font-medium text-foreground">
                {profileName(p)}
              </span>
              <span className="block text-[0.75rem] text-muted-foreground">
                {t("new.profile.docs", { n: count })}
              </span>
            </span>
            {/* Radio bullet — a ring that fills with an indigo dot when chosen */}
            <span
              aria-hidden
              className={cn(
                "grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                selected ? "border-primary" : "border-rule-strong",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full bg-primary transition-transform duration-200",
                  selected ? "scale-100" : "scale-0",
                )}
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── System tip ───────────────────────────────────────────────────────────────
// A small, warm reminder of what the system does for the inspector — a splash of
// the teal accent, one useful line.
function SystemTip() {
  const { t } = useI18n()
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rule bg-muted/30 px-4 py-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-2-tint text-accent-2-ink">
        <LightbulbIcon className="size-4" />
      </span>
      <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{t("new.tip")}</span> {t("new.tip.text")}
      </p>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function NewVerification() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { packages, addPackage } = usePackages()

  const [profile, setProfile] = useState<ProfileKey>("cadastre")
  const [files, setFiles] = useState<Attachment[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const idRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({})
  const dragDepth = useRef(0)

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

  function addFiles(list: FileList) {
    const incoming = Array.from(list)
    if (!incoming.length) return
    const created: Attachment[] = []
    const toUpload: { id: string; kind: FileKind }[] = []

    for (const file of incoming) {
      const id = `att-${++idRef.current}`
      const kind = fileKind(file.name)
      if (!kind) {
        created.push({ id, name: file.name, size: file.size, kind: "image", status: "error", progress: 0, error: "format" })
        continue
      }
      if (file.size > MAX_BYTES) {
        created.push({ id, name: file.name, size: file.size, kind, status: "error", progress: 0, error: "size" })
        continue
      }
      created.push({ id, name: file.name, size: file.size, kind, status: "uploading", progress: 0 })
      toUpload.push({ id, kind })
    }

    setFiles((prev) => [...prev, ...created])
    toUpload.forEach((u) => runUpload(u.id, u.kind))
  }

  function removeFile(id: string) {
    clearTimers(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function clearAll() {
    for (const f of files) clearTimers(f.id)
    setFiles([])
  }

  function openPicker() {
    inputRef.current?.click()
  }

  // Derived state
  const total = files.filter((f) => f.status !== "error").length
  const readyCount = files.filter((f) => f.status === "ready").length
  const canStart = readyCount > 0 && !submitting

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
          now: new Date().toISOString(),
        }),
      )
      toast(t("toast.started", { id }))
      navigate(paths.register)
    }, 480)
  }

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files")

  return (
    <SurfacePage
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
          if (e.target.files?.length) addFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {/* ── Page heading ── the surface names itself; back is the footer's
          Cancel and the sidebar's Register item, never a header breadcrumb. */}
      <SurfaceHeading title={t("page.new.title")} subtitle={t("page.new.subtitle")} />

      {/* ── Body ── one clean centered column that fills the surface height:
          profile picker, a space-filling dropzone, the uploaded list, and a
          quiet preview of what the pipeline does once the inspector starts. */}
      <SurfaceBody>
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-4 py-8 md:py-10">
          {/* Profile — a tactile card picker */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[0.8125rem] font-medium text-foreground">
              {t("new.field.profile")}
            </span>
            <ProfilePicker value={profile} onChange={setProfile} />
          </div>

          {/* A small, useful reminder of what the system does */}
          <SystemTip />

          {/* The dropzone — grows to fill the empty state so there is no void */}
          <Dropzone
            onBrowse={openPicker}
            className={files.length === 0 ? "flex-1 min-h-[13rem]" : undefined}
          />

          {/* Uploaded files */}
          {files.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="register-label flex items-center gap-2">
                  {t("new.uploaded")}
                  <span data-mono className="tabular-nums text-muted-foreground">
                    {files.length}
                  </span>
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t("new.clear")}
                </Button>
              </div>
              <ul className="mt-1 divide-y divide-rule border-t border-rule">
                {files.map((f) => (
                  <FileRow key={f.id} att={f} onRemove={() => removeFile(f.id)} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </SurfaceBody>

      {/* ── Footer action bar ── an h-16 bookend with the sidebar (desktop);
          stacks to auto height on mobile where the sidebar is a sheet. */}
      <SurfaceFooter className="max-md:flex-col max-md:items-stretch max-md:gap-2">
        <span className="text-[0.8125rem]">
          {total === 0 ? (
            <span className="text-muted-foreground">{t("new.files.none")}</span>
          ) : (
            <>
              <span data-mono className="tabular-nums text-foreground/80">
                {readyCount < total ? `${readyCount}/${total}` : total}
              </span>{" "}
              <span className="text-muted-foreground">
                {readyCount < total ? t("new.files.uploading_label") : t("new.files.all_label")}
              </span>
            </>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2 max-md:justify-end">
          <Button variant="outline" onClick={() => navigate(paths.register)}>
            {t("new.cancel")}
          </Button>
          <Button onClick={onStart} disabled={!canStart} aria-disabled={!canStart}>
            {submitting ? t("new.starting") : t("new.start")}
          </Button>
        </div>
      </SurfaceFooter>

      {/* ── Whole-page drop overlay ── a state wash, not a floating card ── */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/8 p-6 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/70 bg-background/80 px-10 py-8 text-primary">
            <UploadCloudIcon className="size-7" />
            <span className="text-[0.9375rem] font-medium">{t("new.drop_overlay")}</span>
          </div>
        </div>
      )}
    </SurfacePage>
  )
}
