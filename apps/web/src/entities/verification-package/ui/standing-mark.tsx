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
  APPLICANT_STANDING_KEY,
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

/**
 * Whose words the mark is set in. The marker and its tone are the same either
 * way — the standing is one state — and only the word changes: the office reads
 * a queue, the person who filed reads their own application (`standing.ts`).
 */
export type StandingVoice = 'office' | 'applicant';

export function StandingMark({
  standing,
  voice = 'office',
  className,
}: {
  standing: PackageStanding;
  voice?: StandingVoice;
  className?: string;
}) {
  const { t } = useI18n();
  const tone = STANDING_TONE[standing];
  const word = voice === 'applicant' ? APPLICANT_STANDING_KEY : STANDING_KEY;
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
        {t(word[standing])}
      </span>
    </span>
  );
}
