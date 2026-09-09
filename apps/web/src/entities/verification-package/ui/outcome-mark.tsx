/**
 * The archive's five verdicts about a submission, drawn as the shared outcome
 * pill (`shared/ui/outcome-mark`).
 *
 * Named for the outcome and never for the standing — a Package Standing is
 * where the whole submission stands, which the contract names and
 * `StandingMark` draws.
 *
 * The pill itself is shared: the archive register's own screen reports what it
 * holds about a property in the same visual grammar, and a reader should not
 * have to learn two.
 */
import {
  CheckIcon,
  CircleDashedIcon,
  FileXIcon,
  LayersIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { useI18n } from '@/shared/i18n';
import { OutcomeMark } from '@/shared/ui/outcome-mark';
import type { RegistryOutcome } from '@cadastre/api-contracts/verification';

import { OUTCOME_KEY, OUTCOME_TONE } from '../model/archive-search';

export { OutcomeMark };

/**
 * One icon per verdict, so the five are told apart without reading the colour.
 *
 * `NotFound` is a dashed ring and not a crossed-out one: a barred circle is the
 * sign for refused, and the register refuses nothing — it states that its own
 * fonds hold no record, which is an absence of evidence (ADR-0009).
 *
 * Exported because the summary counts the same five answers and has to draw
 * them by the same glyph: a verdict that is a dashed ring on a package and an
 * anonymous dot in the tally of a hundred of them is two vocabularies for one
 * idea, and the tally is where the five sit closest together.
 */
export const OUTCOME_ICON: Record<
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
