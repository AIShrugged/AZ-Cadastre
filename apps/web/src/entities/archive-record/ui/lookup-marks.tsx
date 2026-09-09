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
import { OutcomeMark } from '@/shared/ui/outcome-mark';
import type {
  AttributeMatch,
  DocumentHolding,
  LookupOutcome,
} from '@cadastre/api-contracts/registry';

import {
  HOLDING_KEY,
  HOLDING_TONE,
  LOOKUP_KEY,
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

export function LookupOutcomeMark({ outcome }: { outcome: LookupOutcome }) {
  const { t } = useI18n();
  const Icon = LOOKUP_ICON[outcome];
  return (
    <OutcomeMark
      tone={LOOKUP_TONE[outcome]}
      label={t(LOOKUP_KEY[outcome])}
      icon={<Icon className='size-3 shrink-0' />}
    />
  );
}

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
