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
 *
 * Document upload (dropzone, per-file transfer, validation) lives in the
 * `upload-documents` feature; this surface owns only the profile choice and the
 * start action.
 */
import { useEffect, useRef, useState } from "react"
import {
  FlaskConicalIcon,
  LandPlotIcon,
  LightbulbIcon,
  UploadCloudIcon,
  type LucideIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/shared/ui/button"
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from "@/shared/ui/surface"
import {
  ACCEPT,
  Dropzone,
  UploadedList,
  clearDocuments,
  enqueueDocuments,
  selectDocuments,
  selectReadyCount,
  selectValidCount,
} from "@/features/upload-documents"
import { useI18n } from "@/shared/i18n"
import { paths } from "@/shared/config"
import {
  useCreatePackageMutation,
  PROFILES,
  PROFILE_ORDER,
  type ProfileKey,
} from "@/entities/verification-package"
import { useAppDispatch, useAppSelector } from "@/shared/lib/store-hooks"
import { cn } from "@/shared/lib/cn"

const PROFILE_ICON: Record<ProfileKey, LucideIcon> = {
  cadastre: LandPlotIcon,
  demo: FlaskConicalIcon,
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
  const dispatch = useAppDispatch()
  const [createPackage, { isLoading: submitting }] = useCreatePackageMutation()

  const files = useAppSelector(selectDocuments)
  const total = useAppSelector(selectValidCount)
  const readyCount = useAppSelector(selectReadyCount)

  const [profile, setProfile] = useState<ProfileKey>("cadastre")
  const [dragging, setDragging] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  // A fresh visit starts with an empty list; leaving cancels any in-flight
  // transfers so nothing lingers in the store between packages.
  useEffect(() => {
    return () => {
      dispatch(clearDocuments())
    }
  }, [dispatch])

  function openPicker() {
    inputRef.current?.click()
  }

  const canStart = readyCount > 0 && !submitting

  async function onStart() {
    if (!canStart) return
    // Only fully-transferred documents carry a storage key to attach.
    const documents = files
      .filter((f) => f.status === "ready" && f.key && f.contentType)
      .map((f) => ({
        originalFilename: f.name,
        contentType: f.contentType!,
        storageKey: f.key!,
      }))
    if (documents.length === 0) return

    try {
      const pkg = await createPackage({ profileKey: profile, documents }).unwrap()
      toast(t("toast.started", { id: pkg.id }))
      navigate(paths.register)
    } catch {
      toast.error(t("toast.create_failed"))
    }
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
        if (e.dataTransfer.files.length) dispatch(enqueueDocuments(e.dataTransfer.files))
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) dispatch(enqueueDocuments(e.target.files))
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

          {/* Uploaded files — store-connected */}
          <UploadedList />
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
