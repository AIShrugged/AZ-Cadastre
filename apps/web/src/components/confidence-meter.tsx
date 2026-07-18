import { cn } from "@/lib/utils";
import { confidenceTone, pct } from "@/lib/format";
import type { Tone } from "@/components/status-badge";

const FILL: Record<Tone, string> = {
  ok: "bg-status-ok",
  remarks: "bg-status-remarks",
  incomplete: "bg-status-incomplete",
};

/** Компактный метр уверенности модели [0..1] с цветовым тоном. */
export function ConfidenceMeter({
  value,
  className,
  showValue = true,
}: {
  value: number;
  className?: string;
  showValue?: boolean;
}) {
  const tone = confidenceTone(value);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Уверенность модели"
      >
        <div
          className={cn("h-full rounded-full transition-all", FILL[tone])}
          style={{ width: `${Math.max(4, Math.round(value * 100))}%` }}
        />
      </div>
      {showValue && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {pct(value)}
        </span>
      )}
    </div>
  );
}
