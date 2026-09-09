/**
 * The register's three answers, drawn as the shared outcome pill — a mark and
 * the word, always together (The Status-Never-Alone Rule).
 *
 * Each carries an icon of its own so the answers are told apart without reading
 * the colour. `NotFound` is a dashed ring and not a barred one: the register
 * refuses nothing, it states that its own fonds hold no record.
 */
import {
  CheckIcon,
  CircleDashedIcon,
  FileXIcon,
  LayersIcon,
  MinusIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { OutcomeMark, type OutcomeTone } from '@/shared/ui/outcome-mark';
import type {
  AttributeMatch,
  DocumentHolding,
  LookupOutcome,
} from '@cadastre/api-contracts/registry';

import {
  HOLDING_KEY,
  HOLDING_TONE,
  LOOKUP_TONE,
  MATCH_KEY,
  MATCH_TONE,
} from '../model/lookup';

const LOOKUP_ICON: Record<
  LookupOutcome,
  ComponentType<{ className?: string }>
> = {
  Found: CheckIcon,
  NotFound: CircleDashedIcon,
  Ambiguous: LayersIcon,
};

const MATCH_ICON: Record<
  AttributeMatch,
  ComponentType<{ className?: string }>
> = {
  Matches: CheckIcon,
  Differs: TriangleAlertIcon,
  // A column the register never kept — silence, drawn as an absence and not as
  // a cross, which would read as "the archive says no".
  NotRecorded: MinusIcon,
};

const HOLDING_ICON: Record<
  DocumentHolding,
  ComponentType<{ className?: string }>
> = {
  Held: CheckIcon,
  NotHeld: FileXIcon,
  Unknown: MinusIcon,
};

/**
 * The lookup's answer at heading scale — the icon in its tone, the word beside
 * it in ink. Used where the answer *is* the heading: a pill next to a title
 * that repeats it says the same thing twice.
 */
export function LookupOutcomeGlyph({ outcome }: { outcome: LookupOutcome }) {
  const Icon = LOOKUP_ICON[outcome];
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full',
        GLYPH[LOOKUP_TONE[outcome]],
      )}
    >
      <Icon className='size-3.5' />
    </span>
  );
}

const GLYPH: Record<OutcomeTone, string> = {
  ok: 'bg-ok/12 text-ok-ink',
  issues: 'bg-issues/12 text-issues-ink',
  incomplete: 'bg-incomplete/12 text-incomplete-ink',
  silent: 'bg-muted text-muted-foreground',
  question: 'bg-accent-2/12 text-accent-2-ink',
};

export function AttributeMatchMark({ match }: { match: AttributeMatch }) {
  const { t } = useI18n();
  const Icon = MATCH_ICON[match];
  return (
    <OutcomeMark
      tone={MATCH_TONE[match]}
      label={t(MATCH_KEY[match])}
      icon={<Icon className='size-3 shrink-0' />}
    />
  );
}

export function DocumentHoldingMark({ holding }: { holding: DocumentHolding }) {
  const { t } = useI18n();
  const Icon = HOLDING_ICON[holding];
  return (
    <OutcomeMark
      tone={HOLDING_TONE[holding]}
      label={t(HOLDING_KEY[holding])}
      icon={<Icon className='size-3 shrink-0' />}
    />
  );
}
