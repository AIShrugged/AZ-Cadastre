/**
 * Stage bar — a segmented read of the six-stage pipeline (OCR → Classification
 * → Field extraction → Completeness → Cross-checks → Report). One square cell
 * per stage: completed cells in ink, the running cell in registry blue, pending
 * cells as hairline. It shows real pipeline state, not a decorative meter, and
 * it is square by the world's Square Rule — never a ring.
 */
import { STAGES } from "@/lib/registry"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function StageBar({ stage }: { stage: number }) {
  const { t } = useI18n()
  const cells = Array.from({ length: STAGES }, (_, i) => i + 1)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex items-center gap-[2px]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STAGES}
        aria-valuenow={stage}
        aria-label={t("stage.progress", { k: stage, n: STAGES })}
      >
        {cells.map((c) => (
          <span
            key={c}
            className={cn(
              "h-[6px] w-[15px] transition-colors",
              c < stage && "bg-foreground",
              c === stage && "animate-pulse bg-progress",
              c > stage && "bg-rule",
            )}
          />
        ))}
      </div>
      <span className="text-[0.75rem] leading-none text-muted-foreground">
        <span data-mono className="text-foreground/70">
          {stage}/{STAGES}
        </span>{" "}
        · {t(`stage.${stage}`)}
      </span>
    </div>
  )
}
