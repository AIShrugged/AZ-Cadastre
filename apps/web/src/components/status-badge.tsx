import type { CaseStatus } from "@cadastre/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CASE_STATUS_LABEL, CASE_STATUS_TONE } from "@/lib/format";

export type Tone = "ok" | "remarks" | "incomplete";

const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-status-ok-subtle text-status-ok",
  remarks: "bg-status-remarks-subtle text-status-remarks",
  incomplete: "bg-status-incomplete-subtle text-status-incomplete",
};

const TONE_DOT: Record<Tone, string> = {
  ok: "bg-status-ok",
  remarks: "bg-status-remarks",
  incomplete: "bg-status-incomplete",
};

/** Мягкий бейдж семантического тона; опциональная ведущая точка. */
export function ToneBadge({
  tone,
  dot = false,
  className,
  children,
}: {
  tone: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge variant="secondary" className={cn(TONE_BADGE[tone], className)}>
      {dot && (
        <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      )}
      {children}
    </Badge>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  return <span className={cn("size-2 rounded-full", TONE_DOT[tone])} />;
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <ToneBadge tone={CASE_STATUS_TONE[status]} dot>
      {CASE_STATUS_LABEL[status]}
    </ToneBadge>
  );
}
