/**
 * Archive data — the sidebar's live band, under the account card at the foot of
 * the register cover.
 *
 * It took that band over while the system had no accounts and nobody's name to
 * read (ADR-0016), and it keeps it now that there are (ADR-0029): the two say
 * different things and both are worth a band that is always on screen — who is
 * signed in, and the state of the thing every one of their screens depends on.
 * What did not survive accounts arriving is the band being *instead of* a name.
 *
 * It is the office's band and only the office's. The register's holdings are
 * how the office measures a system an applicant never queries, and the route
 * that serves them answers a `user` 403 — so the shell draws this for an
 * `operator` and leaves an applicant's cover ending on the account card.
 *
 * It said the second half only, once, because the register published its
 * liveness and nothing else and a count here could only have been invented.
 * It publishes a summary now (COMM-58) and there is a route to it at this
 * system's own origin, so the band states figures the register sent and the
 * band's own arithmetic is none.
 *
 * **What it is built not to say.** No verdict: there is no "the archive is
 * ready" or "four of six" here, because how much of the archive has to be in
 * before a search means anything is a rule nobody has written and the register
 * refuses to guess at (ADR-0009). And no stale figure: a register that stops
 * answering takes its numbers with it, or the band would go on reporting an
 * archive that is not there.
 *
 * The breakdown is a tooltip and not a fourth line. The sidebar collapses to a
 * 3rem rail of icons, where the band is the icon and nothing else — a tooltip
 * is the one surface that survives that, so it carries what the band cannot:
 * every source the register holds rows under, including the ones the catalogue
 * has no name for.
 */
import { DatabaseIcon } from 'lucide-react';

import {
  readHoldings,
  useArchiveSummaryQuery,
  type ArchiveReach,
} from '@/entities/archive-record';
import { formatDate, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

/**
 * How often the band re-asks.
 *
 * Two minutes, up from the thirty seconds this band polled a liveness check at,
 * and the change is the question changing rather than a tuning: what is on
 * screen is a tally of an archive that is loaded by an operator uploading a
 * workbook, which happens a handful of times in a month and never twice in a
 * minute. Thirty seconds bought a figure 2,880 times a day to redraw a number
 * that had not moved since the last deployment.
 *
 * It is still the reachability check as well, and that is what keeps this from
 * being ten minutes: when a lookup comes back empty the first thing an operator
 * looks at is this band, and it must have caught up by the time they do. Two
 * minutes is the slowest this can be and still be true when it is read; the
 * poll also stops while the tab is in the background, so a sidebar left open
 * overnight asks nothing.
 */
const HOLDINGS_SETTLE_MS = 120_000;

export function ArchiveStatus() {
  const { t, locale } = useI18n();
  const answer = useArchiveSummaryQuery(undefined, {
    pollingInterval: HOLDINGS_SETTLE_MS,
    skipPollingIfUnfocused: true,
  });
  const { reach, sources, records, loadedAt, lines } = readHoldings(answer);

  const count = (n: number) => n.toLocaleString(locale);
  // Three states and not two: before the first answer the register is not down,
  // it is unasked — and a band that reads "unreachable" for the half second
  // before every answer would be lying twice a page.
  const state = t(`archive.reach.${reach}`);

  return (
    <Tooltip>
      <TooltipTrigger
        className='flex w-full cursor-default items-center gap-2.5 rounded-md px-2 py-1 text-left group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 hover:bg-sidebar-accent'
        // The figures are two lines of loose text to a screen reader, and the
        // dot is nothing at all; this is the one sentence that says what the
        // band is showing.
        aria-label={
          reach === 'answering'
            ? `${t('archive.data')}: ${state}. ${t('archive.holdings.sources', { n: count(sources) })}. ${t('archive.holdings.records', { n: count(records) })}`
            : `${t('archive.data')}: ${state}`
        }
      >
        <span
          className='grid size-8 shrink-0 place-items-center rounded-lg border border-rule-strong bg-muted/40 text-muted-foreground'
          aria-hidden
        >
          <DatabaseIcon className='size-4' />
        </span>
        <span className='flex min-w-0 flex-col gap-0.5 leading-tight group-data-[collapsible=icon]:hidden'>
          <span className='register-label'>{t('archive.data')}</span>
          <span className='flex items-center gap-1.5'>
            <ReachDot reach={reach} />
            <span className='truncate text-[0.8125rem] text-sidebar-foreground'>
              {reach === 'answering'
                ? t('archive.holdings.sources', { n: count(sources) })
                : state}
            </span>
          </span>
          {reach === 'answering' && (
            <span className='truncate pl-3 text-[0.6875rem] text-muted-foreground tabular-nums'>
              {t('archive.holdings.records', { n: count(records) })}
            </span>
          )}
        </span>
      </TooltipTrigger>

      <TooltipContent
        side='right'
        align='end'
        className='flex-col items-stretch gap-1.5 px-3 py-2'
      >
        <span className='font-medium'>{state}</span>
        {reach === 'answering' && (
          <>
            <span className='text-background/70'>
              {loadedAt === null
                ? t('archive.holdings.never')
                : t('archive.holdings.loaded', {
                    date: formatDate(loadedAt, locale),
                  })}
            </span>
            {/* Every line the register sent, and never a fixed six: it reports
                what is in its database, so the seed's archival spellings and
                whatever an operator typed into an import both show up here
                under their own names. */}
            <span className='flex flex-col gap-0.5 border-t border-background/20 pt-1.5'>
              {lines.map(line => (
                <span key={line.id} className='flex items-baseline gap-3'>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      line.records === 0 && 'text-background/60',
                    )}
                  >
                    {line.id}
                  </span>
                  {line.records === 0 ? (
                    <span className='shrink-0 text-background/60'>
                      {t('archive.holdings.nothing')}
                    </span>
                  ) : (
                    // Figures in the mono face and nowhere else: the column
                    // reads down as numbers only when they line up, and a word
                    // set in it just looks like a word set wrong.
                    <span data-mono className='shrink-0'>
                      {count(line.records)}
                    </span>
                  )}
                </span>
              ))}
            </span>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ReachDot({ reach }: { reach: ArchiveReach }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        reach === 'asking' && 'bg-muted-foreground/45',
        reach === 'answering' && 'bg-ok',
        reach === 'silent' && 'bg-failed',
      )}
    />
  );
}
