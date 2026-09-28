/**
 * The archive's answers about one paper that prints a QR code, drawn as the
 * shared outcome pill (`shared/ui/outcome-mark`).
 *
 * The pill is shared with the register's own verdicts because a reader should
 * not have to learn two visual grammars for "this was held against a source
 * outside the system and here is how it came out".
 */
import {
  CheckIcon,
  CircleDashedIcon,
  CloudOffIcon,
  PenLineIcon,
  PlugZapIcon,
  ScanLineIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { useI18n } from '@/shared/i18n';
import { OutcomeMark } from '@/shared/ui/outcome-mark';
import type {
  ArchiveQrCheckDto,
  ArchiveQrCheckStatus,
} from '@cadastre/api-contracts/verification';

import {
  qrConfirmsNoLine,
  qrStatusKey,
  qrStatusTone,
} from '../model/archive-qr';

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
 * there the far end exists and did not answer (ADR-0037). A `SignatureOnly` is
 * a pen, because a signature is genuinely all that was checked: the archive
 * answered and signed the file it served, and not one line of the paper was
 * held against its copy (ADR-0048).
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
  SignatureOnly: PenLineIcon,
};

/**
 * The whole check in a pill, read off the answer and not off its status alone.
 *
 * A check whose every line the archive left blank confirmed nothing, and the
 * pill is the one part of the block a folded case shows — so it is the last
 * place that may keep saying «подтверждает» over an empty comparison
 * (COMM-150). Its own mark and its own word: a pen, because the signature is
 * genuinely all that was checked, in the silent tone, because an answer with
 * nothing in it is not a pass.
 *
 * Read off the answer and not off the status alone even now that the engine has
 * a status of its own for it (ADR-0048): a report written before that migration
 * ran carries `Confirmed` over eight uncompared lines, and this surface is where
 * a reader would otherwise read it as a pass.
 */
export function ArchiveQrStatusMark({ check }: { check: ArchiveQrCheckDto }) {
  const { t } = useI18n();
  const Icon = qrConfirmsNoLine(check)
    ? PenLineIcon
    : QR_STATUS_ICON[check.status];

  return (
    <OutcomeMark
      tone={qrStatusTone(check)}
      label={t(qrStatusKey(check))}
      icon={<Icon className='size-3 shrink-0' />}
    />
  );
}
