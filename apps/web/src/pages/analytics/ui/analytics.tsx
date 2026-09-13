/**
 * Analytics — the register from further away, on a surface of its own.
 *
 * It used to head `/cases`, on the reasoning that an inspector comes to the
 * register anyway. What that cost was four hundred pixels of tallies between
 * them and the search box every single time they came to find one case. Taking
 * the register's measure and finding a case are asked at different moments, so
 * they are now answered in different places, and the register is a register.
 *
 * The page opens with a strip of counters and then the figures behind them —
 * the shape the mockup states this screen in. The strip is the headline and the
 * figures are the reading, and they answer over the **same window**: the period
 * control belongs to the summary band below, and the counters are drawn from
 * the same call it makes rather than from one of their own. Two calls would put
 * two moments on one screen and the counters would stop agreeing with the bars
 * underneath them.
 *
 * **The counters say what this register can honestly count.** The mockup's own
 * four are applications, approved, average cycle time and documents analysed.
 * Two of those we hold: the submissions taken in, and the reports that found
 * nothing to hold against the papers. The other two we do not — nothing in this
 * system times a case from counter to decision, and the overview counts
 * submissions and findings rather than sheets (ADR-0017). Rather than draw a
 * tile that is permanently a dash, the strip spends those two slots on the
 * questions the overview *does* answer and an inspector does ask: what the runs
 * held against the papers, and how often the archive was consulted.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  archiveTally,
  coversWholeRegister,
  parseOverviewPeriod,
  pipelineTally,
  registerQueryParams,
  toOverviewRequest,
  useGetPackagesOverviewQuery,
  WHOLE_REGISTER,
  withOverviewPeriod,
  type OverviewPeriod,
} from '@/entities/verification-package';
import { paths } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui/skeleton';
import { SurfaceBody, SurfaceHeading, SurfacePage } from '@/shared/ui/surface';
import { RegisterSummary } from '@/widgets/register-summary';

// ─── One counter ────────────────────────────────────────────────────────────
// A label over a figure, with the register's indigo down its leading edge —
// the mockup's own card, in this product's tokens.
//
// A counter leads to the submissions it counted or it leads nowhere, which is
// the rule the summary's own rows are drawn by: the list endpoint takes no
// period, so a figure is a link only while the window is the whole register.
// Under any other window it is text, and silently keeping the link would open a
// set the figure never counted.
function Counter({
  label,
  value,
  to,
}: {
  label: string;
  /** Null until an answer has arrived. A zero is only ever drawn from a zero
   *  the server sent — an empty strip on a new installation is a true statement
   *  about an office that has taken nothing in, and a skeleton is not. */
  value: number | null;
  to: string | null;
}) {
  const figure = (
    <>
      <span className='register-label block'>{label}</span>
      {value === null ? (
        <Skeleton className='mt-2 h-7 w-14' />
      ) : (
        <strong
          data-mono
          className='mt-1.5 block text-[1.6875rem] font-[750] leading-[1.1] tracking-[-0.02em] text-foreground tabular-nums'
        >
          {value}
        </strong>
      )}
    </>
  );
  return (
    <div className='relative overflow-hidden rounded-xl border border-rule bg-card px-4 py-3.5 shadow-[var(--shadow-xs)]'>
      {/* The leading rule — the mockup's 3px accent, drawn from the one indigo
          the register signals with. Decoration, so it is not in the tab order
          and not read out. */}
      <span
        aria-hidden
        className='absolute inset-y-0 left-0 w-[3px] bg-primary/75'
      />
      {to === null ? (
        figure
      ) : (
        <Link
          to={to}
          className='block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
        >
          {figure}
        </Link>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export function Analytics() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();

  const period = useMemo(() => parseOverviewPeriod(params), [params]);
  const askPeriod = useCallback(
    (next: OverviewPeriod) =>
      setParams(withOverviewPeriod(new URLSearchParams(), next)),
    [setParams],
  );

  // A fixed instant the windows are measured back from. Held here rather than
  // read inside the query: the request is its own cache key, and a `from` that
  // moved every render would be a call that never stopped.
  const [now] = useState(() => Date.now());

  // The same call the band below makes, under the same key — so this is the
  // cache's answer and not a second request, and the counters cannot disagree
  // with the bars they head.
  const { currentData, data } = useGetPackagesOverviewQuery(
    toOverviewRequest(period, now),
  );
  const summary = currentData ?? data;
  const answered = currentData !== undefined;

  const counters = useMemo(() => {
    // Only the whole register holds exactly the submissions a period-narrowed
    // count counted, because the list endpoint takes no period. Under any other
    // window a figure is text.
    const linkable = coversWholeRegister(period);
    const opens = (query: URLSearchParams) =>
      linkable ? `${paths.cases}?${query.toString()}` : null;

    return [
      {
        key: 'taken_in',
        label: t('analytics.kpi.taken_in'),
        value: summary ? pipelineTally(summary.pipeline).total : null,
        to: opens(registerQueryParams(WHOLE_REGISTER)),
      },
      {
        key: 'clean',
        label: t('analytics.kpi.clean'),
        // The reports that held nothing against the papers — not the reports
        // there are. `outcomes.total` is every submission that has been
        // reported on at all, which is a different and much larger number.
        value: summary ? (summary.outcomes.byStatus.OK ?? 0) : null,
        to: opens(
          registerQueryParams({ ...WHOLE_REGISTER, reportStatus: 'OK' }),
        ),
      },
      {
        key: 'findings',
        label: t('analytics.kpi.findings'),
        value: summary ? summary.findings.againstPackage.total : null,
        // Counted per finding, while the register lists submissions — so this
        // figure opens no set the list can name, under any window.
        to: null,
      },
      {
        key: 'archive',
        label: t('analytics.kpi.archive'),
        value: summary ? archiveTally(summary.archive).total : null,
        // Questions put to the register, not submissions. Same reason.
        to: null,
      },
    ];
  }, [summary, period, t]);

  return (
    <SurfacePage>
      <SurfaceHeading
        title={t('page.analytics.title')}
        subtitle={t('page.analytics.subtitle')}
      />

      <SurfaceBody>
        <div
          aria-busy={!answered}
          className={cn(
            'grid shrink-0 gap-3 px-4 pt-5 pb-1 transition-opacity md:px-6 sm:grid-cols-2 xl:grid-cols-4',
            !answered && 'opacity-60',
          )}
        >
          {counters.map(counter => (
            <Counter
              key={counter.key}
              label={counter.label}
              value={counter.value}
              to={counter.to}
            />
          ))}
        </div>

        {/* The figures behind the counters, over the window the control in this
            band sets — the one control on the page, because all of it is read
            over one window. */}
        <RegisterSummary period={period} onPeriod={askPeriod} now={now} />
      </SurfaceBody>
    </SurfacePage>
  );
}
