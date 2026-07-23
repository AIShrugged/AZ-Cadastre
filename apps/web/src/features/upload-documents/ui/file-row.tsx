import {
  FileTextIcon,
  ImageIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/shared/ui/button"
import { useI18n } from "@/shared/i18n"
import { cn } from "@/shared/lib/cn"
import { formatBytes, MAX_MB } from "../lib/file"
import type { Attachment } from "../model/types"

export function FileRow({
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
