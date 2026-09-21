/**
 * The archive's four answers about one Decree 439 paper, drawn as the shared
 * outcome pill (`shared/ui/outcome-mark`).
 *
 * The pill is shared with the register's own verdicts because a reader should
 * not have to learn two visual grammars for "this was held against a source
 * outside the system and here is how it came out".
 */
import {
  CheckIcon,
  CircleDashedIcon,
  ScanLineIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { useI18n } from '@/shared/i18n';
import { OutcomeMark } from '@/shared/ui/outcome-mark';
import type { ArchiveQrCheckStatus } from '@cadastre/api-contracts/verification';

import { QR_STATUS_KEY, QR_STATUS_TONE } from '../model/archive-qr';

/**
 * One icon per status, so the four are told apart without reading the colour —
 * and `NotFound` and `NoQrCode`, which share the `silent` tone, are told apart
 * by nothing else (The Status-Never-Alone Rule).
 *
 * `NotFound` is a dashed ring, the same sign the register uses for a fonds that
 * holds no record: an absence of evidence and never a refusal. `NoQrCode` is a
 * scan line, because what is missing there is one step earlier — nothing was
 * read off the paper to ask the archive with.
 */
export const QR_STATUS_ICON: Record<
  ArchiveQrCheckStatus,
  ComponentType<{ className?: string }>
> = {
  Confirmed: CheckIcon,
  Differs: TriangleAlertIcon,
  NotFound: CircleDashedIcon,
  NoQrCode: ScanLineIcon,
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
