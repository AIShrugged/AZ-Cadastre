import type { FlagSeverity } from "@cadastre/contracts";
import { SEVERITY_LABEL, SEVERITY_TONE } from "@/lib/format";
import { ToneBadge } from "@/components/status-badge";

export function SeverityBadge({ severity }: { severity: FlagSeverity }) {
  return (
    <ToneBadge tone={SEVERITY_TONE[severity]}>
      {SEVERITY_LABEL[severity]}
    </ToneBadge>
  );
}
