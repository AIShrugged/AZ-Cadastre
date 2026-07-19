import { CheckCircle2, AlertTriangle, XCircle, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type CaseStatus, type CheckLevel } from "@/lib/mock";

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const map = {
    ok: { tone: "success", Icon: CheckCircle2 },
    remarks: { tone: "warning", Icon: AlertTriangle },
    incomplete: { tone: "danger", Icon: XCircle },
  } as const;
  const { tone, Icon } = map[status];
  return (
    <Badge tone={tone}>
      <Icon />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const LEVEL: Record<
  CheckLevel,
  { tone: "success" | "warning" | "danger" | "info"; Icon: typeof CheckCircle2; ring: string }
> = {
  ok: { tone: "success", Icon: CheckCircle2, ring: "text-success" },
  warn: { tone: "warning", Icon: AlertTriangle, ring: "text-warning-foreground" },
  fail: { tone: "danger", Icon: XCircle, ring: "text-destructive" },
  manual: { tone: "info", Icon: UserCog, ring: "text-primary" },
};

export function levelStyle(level: CheckLevel) {
  return LEVEL[level];
}

export function CheckLevelIcon({ level }: { level: CheckLevel }) {
  const { Icon, ring } = LEVEL[level];
  return <Icon className={`size-4 shrink-0 ${ring}`} />;
}
