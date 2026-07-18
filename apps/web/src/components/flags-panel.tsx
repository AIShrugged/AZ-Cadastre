import { CircleCheckIcon } from "lucide-react";
import type {
  Case,
  Check,
  CheckResult,
  FlagDecision,
} from "@cadastre/contracts";
import { FlagCard } from "@/components/flag-card";
import { ToneBadge, type Tone } from "@/components/status-badge";
import { CHECK_LABEL, CHECK_RESULT_LABEL, CHECK_TAG } from "@/lib/format";

const RESULT_TONE: Record<CheckResult, Tone> = {
  pass: "ok",
  warn: "remarks",
  fail: "incomplete",
};

function CheckSection({
  check,
  data,
  pendingIds,
  onDecide,
}: {
  check: Check;
  data: Case;
  pendingIds: Set<string>;
  onDecide: (flagId: string, decision: FlagDecision) => void;
}) {
  const flags = data.flags.filter((f) => f.checkType === check.type);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-md bg-brand-subtle font-mono text-xs font-semibold text-brand">
            {CHECK_TAG[check.type]}
          </span>
          <h3 className="font-display text-lg">{CHECK_LABEL[check.type]}</h3>
          <ToneBadge tone={RESULT_TONE[check.result]}>
            {CHECK_RESULT_LABEL[check.result]}
          </ToneBadge>
        </div>
        <p className="text-sm text-muted-foreground">{check.summary}</p>
      </div>

      {flags.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {flags.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              pending={pendingIds.has(flag.id)}
              onDecide={onDecide}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-border bg-status-ok-subtle/40 px-3 py-2.5 text-sm text-muted-foreground">
          <CircleCheckIcon className="size-4 text-status-ok" />
          Флагов нет — проверка пройдена.
        </div>
      )}
    </section>
  );
}

export function FlagsPanel({
  data,
  pendingIds,
  onDecide,
}: {
  data: Case;
  pendingIds: Set<string>;
  onDecide: (flagId: string, decision: FlagDecision) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {data.checks.map((check) => (
        <CheckSection
          key={check.type}
          check={check}
          data={data}
          pendingIds={pendingIds}
          onDecide={onDecide}
        />
      ))}
    </div>
  );
}
