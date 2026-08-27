/**
 * Stage bar — a segmented read of the eight-stage pipeline (OCR → Document
 * detection → Classification → Field extraction → Cross-document check →
 * Archive register → Completeness → Report). One square cell per stage:
 * completed cells in ink, the running cell in registry indigo, pending cells as
 * hairline. It shows real pipeline state, not a decorative meter — segmented
 * pill cells, never a single ring.
 *
 * A running package has no failed cell: nothing the engine cannot read stops
 * the run any more, so what it met is reported at the end rather than shown as
 * a stage that broke.
 */
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { STAGES } from '../model/pipeline';

export function StageBar({ stage }: { stage: number }) {
  const { t } = useI18n();
  const cells = Array.from({ length: STAGES }, (_, i) => i + 1);

  return (
    <div className='flex flex-col gap-1.5'>
      <div
        className='flex items-center gap-[2px]'
        role='progressbar'
        aria-valuemin={0}
        aria-valuemax={STAGES}
        aria-valuenow={stage}
        aria-label={t('stage.progress', { k: stage, n: STAGES })}
      >
        {cells.map(c => (
          <span
            key={c}
            className={cn(
              'h-[6px] w-[15px] rounded-full transition-colors',
              c < stage && 'bg-foreground',
              c === stage && 'animate-pulse bg-progress',
              c > stage && 'bg-rule',
            )}
          />
        ))}
      </div>
      <span className='text-[0.75rem] leading-none text-muted-foreground'>
        <span data-mono className='text-foreground/70'>
          {stage}/{STAGES}
        </span>{' '}
        · {t(`stage.${stage}`)}
      </span>
    </div>
  );
}
