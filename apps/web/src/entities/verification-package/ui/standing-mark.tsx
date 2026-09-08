/**
 * Standing mark — where the submission stands, as a marker and the word for it,
 * always together (The Status-Never-Alone Rule). No colour-only meaning.
 *
 * It states what has to happen next; it is never phrased as an approval or a
 * verdict, because this system makes neither.
 */
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { PackageStanding } from '@cadastre/api-contracts/verification';

import {
  isRunning,
  STANDING_KEY,
  STANDING_TONE,
  type StandingTone,
} from '../model/standing';

const MARKER: Record<StandingTone, string> = {
  ok: 'bg-ok',
  issues: 'bg-issues',
  incomplete: 'bg-incomplete',
  progress: 'bg-progress',
  awaiting: 'bg-accent-2',
  failed: 'bg-failed',
};

const INK: Record<StandingTone, string> = {
  ok: 'text-ok-ink',
  issues: 'text-issues-ink',
  incomplete: 'text-incomplete-ink',
  progress: 'text-progress',
  awaiting: 'text-accent-2-ink',
  failed: 'text-failed-ink',
};

export function StandingMark({
  standing,
  className,
}: {
  standing: PackageStanding;
  className?: string;
}) {
  const { t } = useI18n();
  const tone = STANDING_TONE[standing];
  return (
    <span
      className={cn('inline-flex items-center gap-2 leading-none', className)}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          MARKER[tone],
          isRunning(standing) && 'motion-safe:animate-pulse',
        )}
      />
      <span
        className={cn('text-[0.8125rem] font-medium tracking-tight', INK[tone])}
      >
        {t(STANDING_KEY[standing])}
      </span>
    </span>
  );
}
