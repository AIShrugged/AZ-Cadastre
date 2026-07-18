import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import type { Discrepancy, Flag, FlagDecision } from "@cadastre/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "@/components/severity-badge";
import { ToneBadge, type Tone } from "@/components/status-badge";
import { DECISION_LABEL, SEVERITY_TONE } from "@/lib/format";

const ACCENT: Record<Tone, string> = {
  ok: "shadow-[inset_3px_0_0_var(--status-ok)]",
  remarks: "shadow-[inset_3px_0_0_var(--status-remarks)]",
  incomplete: "shadow-[inset_3px_0_0_var(--status-incomplete)]",
};

function DiscrepancyView({ d }: { d: Discrepancy }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{d.fieldLabel}</span>
        {d.kind === "area" && d.deltaPercent !== null && (
          <ToneBadge tone="remarks">Δ {d.deltaPercent}%</ToneBadge>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {d.values.map((v, i) => (
          <div key={v.documentId} className="flex flex-1 items-center gap-2">
            {i > 0 && (
              <ArrowRightIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
            )}
            <div className="min-w-0 flex-1 border-l-2 border-border pl-2.5">
              <div className="truncate text-xs text-muted-foreground">
                {v.documentTitle}
              </div>
              <div className="truncate font-mono text-sm font-medium">
                {v.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FlagCard({
  flag,
  pending,
  onDecide,
}: {
  flag: Flag;
  pending: boolean;
  onDecide: (flagId: string, decision: FlagDecision) => void;
}) {
  const decided = flag.decision !== "pending";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-opacity",
        ACCENT[SEVERITY_TONE[flag.severity]],
        flag.decision === "rejected" && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium leading-snug">{flag.title}</span>
        <SeverityBadge severity={flag.severity} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {flag.description}
      </p>

      {flag.discrepancy && <DiscrepancyView d={flag.discrepancy} />}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          Решение:{" "}
          <span
            className={cn(
              "font-medium",
              flag.decision === "accepted" && "text-status-incomplete",
              flag.decision === "rejected" && "text-status-ok",
              !decided && "text-foreground",
            )}
          >
            {DECISION_LABEL[flag.decision]}
          </span>
          {flag.decisionNote && (
            <span className="italic"> — {flag.decisionNote}</span>
          )}
        </span>
        <div className="flex gap-2">
          <Button
            variant={flag.decision === "accepted" ? "default" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => onDecide(flag.id, "accepted")}
          >
            <CheckIcon data-icon="inline-start" />
            Принять
          </Button>
          <Button
            variant={flag.decision === "rejected" ? "default" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => onDecide(flag.id, "rejected")}
          >
            <XIcon data-icon="inline-start" />
            Отклонить
          </Button>
        </div>
      </div>
    </div>
  );
}
