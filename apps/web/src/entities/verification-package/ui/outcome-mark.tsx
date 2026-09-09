/**
 * How a check came out, as a pill — a mark and the word, always together (The
 * Status-Never-Alone Rule). No colour-only meaning, which is what lets five
 * answers stay five answers for a reader who cannot tell amber from orange.
 *
 * Shared by every panel that reports an outcome, so "agreed" reads alike
 * whether the papers were held against each other or against the archive
 * record: a reader should not have to learn two vocabularies for one idea.
 *
 * Named for the outcome and never for the standing — a Package Standing is
 * where the whole submission stands, which the contract names and
 * `StandingMark` draws.
 */
import {
  CheckIcon,
  CircleDashedIcon,
  FileXIcon,
  LayersIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { RegistryOutcome } from '@cadastre/api-contracts/verification';

import {
  OUTCOME_KEY,
  OUTCOME_TONE,
  type OutcomeTone,
} from '../model/archive-search';

const CHIP: Record<OutcomeTone, string> = {
  ok: 'bg-ok/12 text-ok-ink',
  issues: 'bg-issues/12 text-issues-ink',
  incomplete: 'bg-incomplete/12 text-incomplete-ink',
  // Untinted and unalarming on purpose: the register holding no record is an
  // absence of evidence, and a fault's colour would state a shortfall it never
  // claimed (ADR-0009).
  silent: 'bg-muted text-muted-foreground',
  // A question for a person rather than a finding against the package, in the
  // one hue this surface keeps for waiting on somebody.
  question: 'bg-accent-2/12 text-accent-2-ink',
};

const DOT: Record<OutcomeTone, string> = {
  ok: 'bg-ok',
  issues: 'bg-issues',
  incomplete: 'bg-incomplete',
  silent: 'bg-muted-foreground/45',
  question: 'bg-accent-2',
};

export function OutcomeMark({
  tone,
  label,
  icon,
}: {
  tone: OutcomeTone;
  label: string;
  /** Drawn in place of the dot where the answer has a mark of its own — the
   *  five archive verdicts have five icons, so none of them rests on colour. */
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium',
        CHIP[tone],
      )}
    >
      {icon ?? (
        <span aria-hidden className={cn('size-1.5 rounded-full', DOT[tone])} />
      )}
      {label}
    </span>
  );
}

/**
 * One icon per verdict, so the five are told apart without reading the colour.
 *
 * `NotFound` is a dashed ring and not a crossed-out one: a barred circle is the
 * sign for refused, and the register refuses nothing — it states that its own
 * fonds hold no record, which is an absence of evidence (ADR-0009).
 */
const OUTCOME_ICON: Record<
  RegistryOutcome,
  ComponentType<{ className?: string }>
> = {
  Confirmed: CheckIcon,
  Differs: TriangleAlertIcon,
  // The record agrees and the archive has no original of one of the papers.
  Incomplete: FileXIcon,
  NotFound: CircleDashedIcon,
  // More than one record answers to the address.
  Ambiguous: LayersIcon,
};

export function RegistryOutcomeMark({ outcome }: { outcome: RegistryOutcome }) {
  const { t } = useI18n();
  const Icon = OUTCOME_ICON[outcome];

  return (
    <OutcomeMark
      tone={OUTCOME_TONE[outcome]}
      label={t(OUTCOME_KEY[outcome])}
      icon={<Icon className='size-3 shrink-0' />}
    />
  );
}
