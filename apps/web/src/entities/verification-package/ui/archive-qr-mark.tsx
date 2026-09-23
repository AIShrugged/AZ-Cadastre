/**
 * The archive's five answers about one paper that prints a QR code, drawn as
 * the shared outcome pill (`shared/ui/outcome-mark`).
 *
 * The pill is shared with the register's own verdicts because a reader should
 * not have to learn two visual grammars for "this was held against a source
 * outside the system and here is how it came out".
 */
import {
  CheckIcon,
  CircleDashedIcon,
  CloudOffIcon,
  PlugZapIcon,
  ScanLineIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { useI18n } from '@/shared/i18n';
import { OutcomeMark } from '@/shared/ui/outcome-mark';
import type { ArchiveQrCheckStatus } from '@cadastre/api-contracts/verification';

import { QR_STATUS_KEY, QR_STATUS_TONE } from '../model/archive-qr';

/**
 * One icon per status, so the six are told apart without reading the colour —
 * and the three that share the `silent` tone are told apart by nothing else
 * (The Status-Never-Alone Rule).
 *
 * `NotFound` is a dashed ring, the same sign the register uses for a fonds that
 * holds no record: an absence of evidence and never a refusal. `NoQrCode` is a
 * scan line, because what is missing there is one step earlier — nothing was
 * decoded off the paper to ask with. `IssuerNotConnected` is a plug, because
 * what is missing is at the far end: the code was read and there is nobody here
 * to ask (ADR-0034). `IssuerUnreachable` is a cloud struck through, because
 * there the far end exists and did not answer (ADR-0037).
 */
export const QR_STATUS_ICON: Record<
  ArchiveQrCheckStatus,
  ComponentType<{ className?: string }>
> = {
  Confirmed: CheckIcon,
  Differs: TriangleAlertIcon,
  NotFound: CircleDashedIcon,
  NoQrCode: ScanLineIcon,
  IssuerNotConnected: PlugZapIcon,
  IssuerUnreachable: CloudOffIcon,
};

export function ArchiveQrStatusMark({
  status,
}: {
  status: ArchiveQrCheckStatus;
}) {
  const { t } = useI18n();
  const Icon = QR_STATUS_ICON[status];

  return (
    <OutcomeMark
      tone={QR_STATUS_TONE[status]}
      label={t(QR_STATUS_KEY[status])}
      icon={<Icon className='size-3 shrink-0' />}
    />
  );
}
