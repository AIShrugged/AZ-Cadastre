import { UploadCloudIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { MAX_MB } from "../lib/file"

export function Dropzone({
  onBrowse,
  className,
}: {
  onBrowse: () => void
  className?: string
}) {
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
