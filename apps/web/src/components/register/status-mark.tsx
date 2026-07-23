/**
 * Disposition mark — the register's stamp, now a status dot. A filled marker +
 * the status word, always together (The Status-Never-Alone Rule). No color-only
 * meaning. The disposition is evidence of what the system found; it is never
 * phrased as an approval or a verdict.
 */
import type { Disposition } from "@/lib/registry"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const MARKER: Record<Disposition, string> = {
  ok: "bg-ok",
  issues: "bg-issues",
  incomplete: "bg-incomplete",
  in_progress: "bg-progress",
  failed: "bg-failed",
}

const INK: Record<Disposition, string> = {
  ok: "text-ok-ink",
  issues: "text-issues-ink",
  incomplete: "text-incomplete-ink",
  in_progress: "text-progress",
  failed: "text-failed-ink",
}

const KEY: Record<Disposition, string> = {
  ok: "status.ok",
  issues: "status.issues",
  incomplete: "status.incomplete",
  in_progress: "status.in_progress",
  failed: "status.failed",
}

export function DispositionMark({
  disposition,
  className,
}: {
  disposition: Disposition
  className?: string
}) {
  const { t } = useI18n()
  return (
    <span className={cn("inline-flex items-center gap-2 leading-none", className)}>
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          MARKER[disposition],
          disposition === "in_progress" && "animate-pulse",
        )}
      />
      <span className={cn("text-[0.8125rem] font-medium tracking-tight", INK[disposition])}>
        {t(KEY[disposition])}
      </span>
    </span>
  )
}
