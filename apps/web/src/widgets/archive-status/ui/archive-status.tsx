/**
 * Archive data — the sidebar's live band, in the place the workspace used to
 * carry an inspector's name.
 *
 * The name went because there is nobody to read one off: this system has no
 * accounts on purpose (ADR-0016), and a card naming a person manufactured the
 * appearance of an identity rather than showing one. What belongs in a band
 * that is always on screen is the state of the thing every screen depends on —
 * whether the archive register is answering.
 *
 * It says that and no number. The register publishes its liveness and nothing
 * else: how many workbooks it loaded and how many records they hold is not on
 * any endpoint, so a counter here could only be invented.
 */
import { DatabaseIcon } from 'lucide-react';

import { useArchiveReachQuery } from '@/entities/archive-record';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

// How often the band re-asks. Slow on purpose: it reports whether a service is
// up, which is not a thing that changes between two glances, and a sidebar that
// polls every second is a sidebar that costs a request per second all day.
const REACH_SETTLES_MS = 30_000;

export function ArchiveStatus() {
  const { t } = useI18n();
  const { data: reach } = useArchiveReachQuery(undefined, {
    pollingInterval: REACH_SETTLES_MS,
    skipPollingIfUnfocused: true,
  });

  // Three states and not two: before the first answer the register is not down,
  // it is unasked — and a band that reads "unreachable" for the half second
  // before every answer would be lying twice a page.
  const word =
    reach === undefined
      ? 'archive.reach.asking'
      : reach === 'answering'
        ? 'archive.reach.answering'
        : 'archive.reach.silent';

  return (
    <div className='flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center'>
      <div
        className='grid size-8 shrink-0 place-items-center rounded-lg border border-rule-strong bg-muted/40 text-muted-foreground'
        aria-hidden
      >
        <DatabaseIcon className='size-4' />
      </div>
      <div className='flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden'>
        <span className='register-label text-muted-foreground'>
          {t('archive.data')}
        </span>
        <span className='flex items-center gap-1.5'>
          <span
            aria-hidden
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              reach === undefined && 'bg-muted-foreground/45',
              reach === 'answering' && 'bg-ok',
              reach === 'silent' && 'bg-failed',
            )}
          />
          <span className='truncate text-[0.8125rem] text-sidebar-foreground'>
            {t(word)}
          </span>
        </span>
      </div>
    </div>
  );
}
