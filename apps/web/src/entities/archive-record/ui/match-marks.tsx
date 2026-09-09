/**
 * How sure the register is, and whether another source says otherwise — the two
 * marks a row of the archive search is read by.
 *
 * The confidence is drawn as a four-step meter **in ink and not in colour**.
 * The surface's disposition palette says a thing is in order, at fault or
 * waiting on somebody, and a confidence says none of those: a weak match is not
 * a fault, and colouring it like one would tell the operator something the
 * register never said (ADR-0009). An ordinal ramp of neutral steps carries the
 * order without borrowing a meaning, survives grayscale, and leaves Registry
 * Indigo to the one signal it belongs to.
 *
 * The band's word and the number stand beside the meter in every case, so
 * nothing here is read off the geometry alone (The Status-Never-Alone Rule).
 */
import { ScaleIcon } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { OutcomeMark } from '@/shared/ui/outcome-mark';
import { percent } from '@/shared/ui/tally';
import { bandOf } from '@cadastre/api-contracts/registry';

import { BAND_KEY, BAND_STEPS, METER_STEPS } from '../model/match';

function ConfidenceMeter({ steps }: { steps: number }) {
  return (
    <span aria-hidden className='flex h-3.5 shrink-0 items-end gap-[2px]'>
      {METER_STEPS.map(step => (
        <span
          key={step}
          style={{ height: `${step * 25}%` }}
          className={cn(
            'w-[3px] rounded-[1px]',
            step <= steps ? 'bg-foreground/70' : 'bg-rule-strong',
          )}
        />
      ))}
    </span>
  );
}

/**
 * How sure the register is of one record: the meter, the band and the number.
 *
 * The number is kept and not replaced by the word. A band is a reading aid for
 * a list; the figure is what the register actually computed, and an operator
 * comparing two rows in the same band needs it.
 */
export function ConfidenceMark({ confidence }: { confidence: number }) {
  const { t } = useI18n();
  const band = bandOf(confidence);

  return (
    <span className='inline-flex shrink-0 items-center gap-2'>
      <ConfidenceMeter steps={BAND_STEPS[band]} />
      <span className='text-[0.8125rem] font-medium text-foreground'>
        {t(BAND_KEY[band])}
      </span>
      <span
        data-mono
        className='text-[0.75rem] tabular-nums text-muted-foreground'
      >
        {percent(confidence)}
      </span>
    </span>
  );
}

/**
 * Another source answers for this property and says something else.
 *
 * A note and not a fault. The archive is six registers kept by different
 * offices over thirty years, and the Hövsan handover registers record the same
 * house twice by design (ADR-0010); which of them is right is not the
 * register's to say and not this screen's either. So it wears the one tone the
 * surface keeps for waiting on a person, and the quotation of both sources is
 * in the panel below.
 */
export function DisputedMark() {
  const { t } = useI18n();

  return (
    <OutcomeMark
      tone='question'
      label={t('search.disputed')}
      icon={<ScaleIcon className='size-3 shrink-0' />}
    />
  );
}
