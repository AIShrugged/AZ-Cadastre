/**
 * The summary of the register — the four things an inspector opens one to ask,
 * answered over a period they choose: how much work is in the machine, what the
 * runs made of it, what goes wrong most often, and how the archive answered.
 *
 * It lives at the top of the register and not on a screen of its own. An
 * inspector comes to the register anyway, and a sixth section beside it would
 * be a page they have to remember to visit — the summary is what the register
 * looks like from further away, so it sits above the register.
 *
 * **What this surface is built to say, and what it is built not to say.**
 *
 *  - *A stalled submission is not one tile of six.* It is the only state here
 *    that no amount of waiting resolves — the machinery stopped, rather than
 *    the papers being short of something — so it is stated first, in a band of
 *    its own, above every figure and whether or not the figures are unfolded.
 *  - *The register answering "no record" is not an error.* Its coverage is
 *    partial and historical and it answers about its own fonds, never about the
 *    submission (ADR-0009). It is drawn in the neutral tone the whole product
 *    draws it in; painted as a fault it would tell the inspector, every day,
 *    that dozens of ordinary submissions had something wrong with them.
 *  - *Nothing at all and nothing yet are different news.* Until an answer has
 *    arrived this draws a skeleton; a zero is only ever drawn from a zero the
 *    server sent. An empty summary on a new installation is a true statement
 *    about an office that has taken nothing in, not a broken screen.
 *  - *A number leads to the submissions it counted, or it leads nowhere.* The
 *    list endpoint narrows by outcome but not by a period, so a count is a link
 *    only while the summary covers the whole register — see
 *    `coversWholeRegister`. The stalled band offers a labelled action instead of
 *    a linked number, because the register's `Stalled` standing is not the same
 *    set as the conveyor's `Failed` state and a number must not claim it is.
 */
import { ChevronDownIcon, OctagonAlertIcon, UnplugIcon } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  archiveTally,
  coversWholeRegister,
  ISSUE_KIND_KEY,
  OUTCOME_ICON,
  outcomeTally,
  OVERVIEW_PERIODS,
  PERIOD_KEY,
  pipelineTally,
  rankFindings,
  registerQueryParams,
  stalledCount,
  toOverviewRequest,
  useGetPackagesOverviewQuery,
  WHOLE_REGISTER,
  type FindingRanking,
  type OverviewPeriod,
  type SliceTone,
  type Tally,
} from '@/entities/verification-package';
import { paths } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  RankBars,
  TallyBar,
  TallyList,
  type TallyMark,
} from '@/shared/ui/tally';
import type {
  PackagesOverviewResponse,
  RegistryOutcome,
  ReportStatus,
} from '@cadastre/api-contracts/verification';

/**
 * The fill each tone is drawn in.
 *
 * Three of the conveyor's four are steps of one indigo ramp — light to dark as
 * a submission gets further along — and the fourth is the reserved failed ink,
 * because a broken-down run is not a further position on that ramp. The rest
 * are the register's own disposition band, unchanged from the row and the
 * package page: an outcome must read alike wherever it is said.
 */
const FILL: Record<SliceTone, string> = {
  'conveyor-1': 'bg-conveyor-1',
  'conveyor-2': 'bg-conveyor-2',
  'conveyor-3': 'bg-conveyor-3',
  failed: 'bg-failed',
  ok: 'bg-ok',
  issues: 'bg-issues',
  incomplete: 'bg-incomplete',
  // Untinted on purpose. The register holding no record is an absence of
  // evidence, and a fault's colour would state a shortfall it never claimed.
  silent: 'bg-muted-foreground/45',
  question: 'bg-accent-2',
};

/** The ink a tone's glyph is set in, where a class carries one. */
const INK: Record<SliceTone, string> = {
  'conveyor-1': 'text-conveyor-1',
  'conveyor-2': 'text-conveyor-2',
  'conveyor-3': 'text-conveyor-3',
  failed: 'text-failed-ink',
  ok: 'text-ok-ink',
  issues: 'text-issues-ink',
  incomplete: 'text-incomplete-ink',
  silent: 'text-muted-foreground',
  question: 'text-accent-2-ink',
};

/** Whether the reader last left the summary unfolded. A display preference and
 *  not part of the question in the address bar: a link to a narrowed register
 *  should not also carry how tall somebody likes their screen. */
const UNFOLDED = 'cadastre.summary.open';

function readUnfolded(): boolean {
  try {
    return localStorage.getItem(UNFOLDED) !== '0';
  } catch {
    // A browser that refuses storage is not a reason to lose the summary.
    return true;
  }
}

// ─── One figure ─────────────────────────────────────────────────────────────

function Slice({
  heading,
  note,
  children,
}: {
  heading: string;
  /** What the figure's total is a total *of*, where that is not the period's
   *  submissions — an outcome tally counts only the ones with a report, and an
   *  archive tally counts questions rather than submissions. Left unsaid, both
   *  would read as a smaller register. */
  note: string;
  children: ReactNode;
}) {
  return (
    <section className='flex min-w-0 flex-col'>
      <h3 className='register-label'>{heading}</h3>
      <p className='mt-1.5 text-[0.75rem] leading-snug text-muted-foreground'>
        {note}
      </p>
      <div className='mt-3'>{children}</div>
    </section>
  );
}

function marksOf(
  tally: Tally,
  label: (labelKey: string) => string,
  glyph?: (id: string, tone: SliceTone) => ReactNode,
): TallyMark[] {
  return tally.slices.map(slice => ({
    id: slice.id,
    fill: FILL[slice.tone],
    label: label(slice.labelKey),
    count: slice.count,
    share: slice.share,
    glyph: glyph?.(slice.id, slice.tone),
  }));
}

// ─── The ranking of what goes wrong ─────────────────────────────────────────
// Two rankings and never one number over both. A finding held against a package
// is a shortfall somebody has to resolve; an observation is stated for the
// record, and a report carrying nothing but observations still reads OK. A
// summary that summed the two would announce faults in submissions that have
// none — the report's own rule, and the same one `PackageDto.issuesCount`
// counts by.
function Ranking({
  heading,
  note,
  ranking,
  fill,
}: {
  heading: string;
  note: string;
  ranking: FindingRanking;
  fill: string;
}) {
  const { t } = useI18n();

  return (
    <Slice heading={heading} note={note}>
      {ranking.ranked.length === 0 ? (
        <p className='text-[0.8125rem] text-muted-foreground'>
          {t('summary.findings.none')}
        </p>
      ) : (
        <>
          <RankBars
            fill={fill}
            marks={ranking.ranked.map(rank => ({
              id: rank.kind,
              label: t(ISSUE_KIND_KEY[rank.kind]),
              count: rank.count,
              share: rank.share,
            }))}
          />
          {/* The kinds that did not come up, said in words rather than drawn as
              a row of empty bars. The contract lists every kind at zero so that
              none can silently vanish; in a figure whose whole subject is
              frequency, drawing the zeros would bury the answer, and leaving
              them out silently would read as "we do not have such a finding"
              instead of "none this period". */}
          {ranking.unseen > 0 && (
            <p className='mt-3 text-[0.75rem] leading-snug text-muted-foreground'>
              {t('summary.findings.unseen', { n: ranking.unseen })}
            </p>
          )}
        </>
      )}
    </Slice>
  );
}

// ─── Loading and unreachable ────────────────────────────────────────────────

function SummarySkeleton() {
  return (
    <div
      aria-busy='true'
      aria-live='polite'
      className='grid gap-x-10 gap-y-7 py-5 md:grid-cols-3'
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className='flex flex-col gap-3'>
          <Skeleton className='h-3 w-28' />
          <Skeleton className='h-2.5 w-full rounded-full' />
          <div className='flex flex-col gap-2 pt-1'>
            <Skeleton className='h-3 w-40' />
            <Skeleton className='h-3 w-32' />
            <Skeleton className='h-3 w-36' />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── The page's summary ─────────────────────────────────────────────────────

export function RegisterSummary({
  period,
  onPeriod,
  now,
}: {
  period: OverviewPeriod;
  onPeriod: (period: OverviewPeriod) => void;
  /** A fixed instant the window is measured back from. Held by the page rather
   *  than read here: this request is its own cache key, and a `from` that moved
   *  every render would be a call that never stopped. */
  now: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(readUnfolded);

  const unfold = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(UNFOLDED, next ? '1' : '0');
    } catch {
      // Nothing to do and nothing worth saying: the fold still works, it just
      // will not be remembered.
    }
  }, []);

  const { currentData, data, isError, refetch } = useGetPackagesOverviewQuery(
    toOverviewRequest(period, now),
  );

  // The same rule the register reads its own answers by: `currentData` answers
  // the period being asked about now, `data` is the last answer to any period.
  // Holding the older one on the screen while a new one is in flight is what
  // keeps a change of period from flashing the figures away, and `answered` is
  // what stops the old numbers being read as an answer to the new question.
  const summary = currentData ?? data;
  const answered = currentData !== undefined;

  const stalled = summary ? stalledCount(summary.pipeline) : 0;
  // Only the register in full holds exactly the submissions a period-narrowed
  // count counted, because the list endpoint takes no period. Under any other
  // window the counts are text.
  const linkable = coversWholeRegister(period);

  const outcomeLink = useCallback(
    (mark: TallyMark, row: ReactNode) => {
      if (!linkable || mark.count === 0) return null;
      const query = registerQueryParams({
        ...WHOLE_REGISTER,
        reportStatus: mark.id as ReportStatus,
      });
      return (
        <Link
          to={{ pathname: paths.cases, search: query.toString() }}
          className='block'
        >
          {row}
        </Link>
      );
    },
    [linkable],
  );

  return (
    <section className='shrink-0 border-b border-rule px-4 md:px-6'>
      {/* ── The band that has to be read first ──
          Drawn above the fold control and outside it, so folding the figures
          away can never fold away the one thing on this screen that asks for a
          person. Quiet when nothing has stalled — an office whose conveyor is
          running is told so plainly rather than shown nothing, because nothing
          is also what a screen that failed to load looks like. */}
      {summary && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-2 py-3',
            !answered && 'opacity-60',
          )}
        >
          {stalled > 0 ? (
            <>
              <OctagonAlertIcon className='size-4 shrink-0 text-failed' />
              {/* The count is named before it is given, rather than leading a
                  sentence that agrees with it. Russian inflects the noun after
                  a numeral and this string is written in three languages, so a
                  phrase built as "{n} submissions stalled" reads wrong at one
                  of every ten values it can take. */}
              <p className='min-w-0 text-[0.8125rem] leading-snug text-failed-ink'>
                {t('summary.stalled.label')}{' '}
                <span data-mono className='font-medium tabular-nums'>
                  {stalled}
                </span>{' '}
                {t('summary.stalled.body')}
              </p>
              {/* A labelled action and not a linked number. The register
                  narrows by standing, and `Stalled` covers a run that broke
                  down *and* a finished run that left no report — so this opens
                  a set the count does not define, and says so by being a
                  destination rather than the number made clickable. */}
              <Button
                variant='outline'
                size='sm'
                // The control is a destination, so it is an anchor and says so:
                // middle-click and "open in new tab" have to work on something
                // that navigates, and Base UI needs telling that the element it
                // is styling is not a native button.
                nativeButton={false}
                className='ml-auto shrink-0'
                render={
                  <Link
                    to={{
                      pathname: paths.cases,
                      search: registerQueryParams({
                        ...WHOLE_REGISTER,
                        standing: 'Stalled',
                      }).toString(),
                    }}
                  />
                }
              >
                {t('summary.stalled.open')}
              </Button>
            </>
          ) : (
            <p className='text-[0.8125rem] text-muted-foreground'>
              {t('summary.stalled.none')}
            </p>
          )}
        </div>
      )}

      {/* ── The heading strip ──
          The period sits here and nowhere else: one control over all four
          figures, because all four are read over one window and a figure with a
          period of its own would put four answers about four different sets of
          submissions on one screen. */}
      <div className='flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5'>
        <button
          type='button'
          onClick={() => unfold(!open)}
          aria-expanded={open}
          className='-ml-1 flex items-center gap-1.5 rounded-sm px-1 py-0.5 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring'
        >
          <ChevronDownIcon
            aria-hidden
            className={cn(
              'size-3.5 text-muted-foreground transition-transform',
              !open && '-rotate-90',
            )}
          />
          <span className='register-label'>{t('summary.title')}</span>
        </button>

        <Select
          value={period}
          onValueChange={value => onPeriod(value as OverviewPeriod)}
        >
          <SelectTrigger
            aria-label={t('summary.period.label')}
            className='ml-auto h-8 max-w-[15rem] gap-2 border-input bg-background px-2.5 text-foreground hover:bg-accent hover:text-foreground'
          >
            <span className='flex min-w-0 items-baseline gap-1.5 text-[0.8125rem]'>
              <span className='shrink-0 text-muted-foreground'>
                {t('summary.period.label')}
              </span>
              <span className='truncate font-medium'>
                {t(PERIOD_KEY[period])}
              </span>
            </span>
          </SelectTrigger>
          <SelectContent align='end'>
            {OVERVIEW_PERIODS.map(option => (
              <SelectItem key={option} value={option}>
                {t(PERIOD_KEY[option])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {open && (
        <Figures
          {...{ summary, isError, answered, refetch, outcomeLink, linkable }}
        />
      )}
    </section>
  );
}

function Figures({
  summary,
  isError,
  answered,
  refetch,
  outcomeLink,
  linkable,
}: {
  summary: PackagesOverviewResponse | undefined;
  isError: boolean;
  answered: boolean;
  refetch: () => void;
  outcomeLink: (mark: TallyMark, row: ReactNode) => ReactNode;
  linkable: boolean;
}) {
  const { t } = useI18n();

  // Nothing has been answered for this period or any other. The one state in
  // which the summary genuinely does not know what the register holds — and the
  // reason a zero is never drawn from here.
  if (summary === undefined) {
    if (isError) {
      return (
        <div className='flex flex-wrap items-center gap-3 py-5'>
          <UnplugIcon className='size-4 shrink-0 text-muted-foreground' />
          <p className='min-w-0 text-[0.8125rem] leading-snug text-muted-foreground'>
            {t('summary.error.body')}
          </p>
          <Button variant='outline' size='sm' onClick={() => refetch()}>
            {t('register.error.retry')}
          </Button>
        </div>
      );
    }
    return <SummarySkeleton />;
  }

  const pipeline = pipelineTally(summary.pipeline);
  const outcomes = outcomeTally(summary.outcomes);
  const archive = archiveTally(summary.archive);
  const against = rankFindings(summary.findings.againstPackage);
  const observations = rankFindings(summary.findings.observations);

  const emptyLabel = t('summary.empty');

  return (
    <div
      aria-busy={!answered}
      className={cn(
        'flex flex-col gap-7 pb-5 transition-opacity',
        !answered && 'opacity-60',
      )}
    >
      <div className='grid gap-x-10 gap-y-7 md:grid-cols-3'>
        <Slice
          heading={t('summary.pipeline.title')}
          note={t('summary.pipeline.note', { n: pipeline.total })}
        >
          <TallyBar
            marks={marksOf(pipeline, t)}
            empty={emptyLabel}
            className='mb-3'
          />
          <TallyList marks={marksOf(pipeline, t)} />
        </Slice>

        <Slice
          heading={t('summary.outcomes.title')}
          note={t('summary.outcomes.note', {
            n: outcomes.total,
            total: pipeline.total,
          })}
        >
          <TallyBar
            marks={marksOf(outcomes, t)}
            empty={emptyLabel}
            className='mb-3'
          />
          <TallyList marks={marksOf(outcomes, t)} link={outcomeLink} />
          {!linkable && outcomes.total > 0 && (
            // Said once, where the links would have been. An inspector who
            // narrows the period and finds the counts have stopped opening the
            // register is owed the reason, not left to conclude the screen
            // broke.
            <p className='mt-2 text-[0.75rem] leading-snug text-muted-foreground'>
              {t('summary.outcomes.unlinked')}
            </p>
          )}
        </Slice>

        <Slice
          heading={t('summary.archive.title')}
          note={t('summary.archive.note', { n: archive.total })}
        >
          <TallyBar
            marks={marksOf(archive, t)}
            empty={emptyLabel}
            className='mb-3'
          />
          <TallyList
            marks={marksOf(archive, t, (id, tone) => {
              const Icon = OUTCOME_ICON[id as RegistryOutcome];
              return <Icon className={cn('size-3', INK[tone])} />;
            })}
          />
          {/* Stated rather than left to the colour to imply. The register
              answers about its own fonds and never about the submission, so a
              column of "not found" is a gap in the archive — not a column of
              faults, and not a number to add to the ones beside it (ADR-0009). */}
          <p className='mt-2.5 text-[0.75rem] leading-snug text-muted-foreground'>
            {t('summary.archive.not_found_note')}
          </p>
        </Slice>
      </div>

      <div className='grid gap-x-10 gap-y-7 border-t border-rule pt-6 md:grid-cols-2'>
        <Ranking
          heading={t('summary.against.title')}
          note={t('summary.against.note', { n: against.total })}
          ranking={against}
          fill='bg-issues'
        />
        <Ranking
          heading={t('summary.observations.title')}
          note={t('summary.observations.note', { n: observations.total })}
          ranking={observations}
          // Not a disposition colour. An observation is stated for the record
          // and is not held against anything, so it is drawn in ink rather than
          // in one of the three the register keeps for a verdict.
          fill='bg-muted-foreground/55'
        />
      </div>
    </div>
  );
}
