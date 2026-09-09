/**
 * Further steps — the one screen that is not work. It says what the system does
 * today and what it will grow into, stage by stage, and it is in the sidebar
 * under a heading of its own so that nobody mistakes it for a surface they can
 * act on.
 *
 * **Nothing here is a mock of a screen that does not exist.** A step that is not
 * live is a sentence about what it is waiting for — usually an outside system
 * that has to answer first — and never a rendered pretend result. A demo of a
 * check nobody has implemented is how a promise gets read as a delivery.
 */
import { CheckIcon, CircleDashedIcon, CircleDotIcon } from 'lucide-react';

import {
  ROADMAP_STAGES,
  ROADMAP_STEPS,
  STEP_STANDING_KEY,
  type StepStanding,
} from '@/entities/roadmap';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { OutcomeMark, type OutcomeTone } from '@/shared/ui/outcome-mark';
import { SurfaceBody, SurfaceHeading, SurfacePage } from '@/shared/ui/surface';

// Three tones, and none of them a fault's: a step that has not been built is
// not a defect, it is work that has not been done.
const TONE: Record<StepStanding, OutcomeTone> = {
  live: 'ok',
  partial: 'incomplete',
  planned: 'silent',
};

const ICON: Record<StepStanding, typeof CheckIcon> = {
  live: CheckIcon,
  partial: CircleDotIcon,
  planned: CircleDashedIcon,
};

function StandingMark({ standing }: { standing: StepStanding }) {
  const { t } = useI18n();
  const Icon = ICON[standing];
  return (
    <OutcomeMark
      tone={TONE[standing]}
      label={t(STEP_STANDING_KEY[standing])}
      icon={<Icon className='size-3 shrink-0' />}
    />
  );
}

export function FurtherSteps() {
  const { t } = useI18n();

  return (
    <SurfacePage>
      <SurfaceHeading
        title={t('page.process.title')}
        subtitle={t('page.process.subtitle')}
      />

      <SurfaceBody>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:py-8'>
          {ROADMAP_STAGES.map(stage => {
            const steps = ROADMAP_STEPS.filter(
              step => step.stage === stage.number,
            );
            return (
              <section key={stage.number} className='flex flex-col gap-3'>
                <header className='flex items-baseline gap-2.5'>
                  <span
                    data-mono
                    className='text-[0.75rem] tabular-nums text-muted-foreground'
                  >
                    {t('roadmap.stage', { n: stage.number })}
                  </span>
                  <h2 className='text-[0.9375rem] font-semibold tracking-tight text-foreground'>
                    {t(stage.key)}
                  </h2>
                </header>

                <ul className='flex flex-col border-t border-rule'>
                  {steps.map(step => (
                    <li
                      key={step.id}
                      className='flex flex-col gap-1.5 border-b border-rule py-3'
                    >
                      <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5'>
                        <span
                          className={cn(
                            'min-w-0 text-[0.875rem]',
                            step.standing === 'live'
                              ? 'text-foreground'
                              : 'text-foreground/80',
                          )}
                        >
                          {t(step.key)}
                        </span>
                        <StandingMark standing={step.standing} />
                      </div>
                      {step.integration !== undefined && (
                        // The whole content of a step nobody here can build: the
                        // system that has to answer first, named.
                        <p className='text-[0.75rem] leading-relaxed text-muted-foreground'>
                          {t('roadmap.needs')}{' '}
                          <span data-mono className='text-foreground/70'>
                            {step.integration}
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </SurfaceBody>
    </SurfacePage>
  );
}
