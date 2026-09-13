/**
 * The summary of the register — the four things an inspector opens one to ask,
 * answered over a period they choose: how much work is in the machine, what the
 * runs made of it, what goes wrong most often, and how the archive answered.
 *
 * It is the whole of `/analytics`. The page reads as a dashboard — a strip of
 * counters over four figures — and says as little as it can in prose: what a
 * figure is a total *of* sits behind the ⓘ beside its title, where the reader
 * who needs the caveat finds it and the one who does not is not made to read
 * it every visit.
 *
 * **What this surface is built to say, and what it is built not to say.**
 *
 *  - *A stalled submission is not one slice of six.* It is the only state here
 *    that no amount of waiting resolves, so it is stated first, in a band of its
 *    own, above every figure — and named beside the page title besides.
 *  - *The register answering "no record" is not an error.* Its coverage is
 *    partial and historical (ADR-0009), so `NotFound` is drawn in the neutral
 *    tone the whole product draws it in, never in a fault's colour.
 *  - *Nothing at all and nothing yet are different news.* Until an answer has
 *    arrived this draws skeletons; a zero is only ever drawn from a zero the
 *    server sent.
 *  - *A number leads to the submissions it counted, or it leads nowhere.* The
 *    list endpoint narrows by outcome but not by a period, so a count is a link
 *    only while the summary covers the whole register (`coversWholeRegister`).
 *  - *Every value is also written out.* A chart here is a second reading of the
 *    numbers beside it — the legends carry each class's count and share as text
 *    — so nothing is gated behind a hover, a colour or a pointer.
 */
import {
  ArchiveIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  FileCheckIcon,
  FlagIcon,
  InboxIcon,
  OctagonAlertIcon,
  UnplugIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  LabelList,
  Pie,
  PieChart,
  Sector,
  usePlotArea,
  XAxis,
  YAxis,
  type PieSectorShapeProps,
} from 'recharts';

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
import { ChartContainer, ChartTooltip } from '@/shared/ui/chart';
import { InfoHint } from '@/shared/ui/info-hint';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { percent, TallyBar } from '@/shared/ui/tally';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import type {
  PackagesOverviewResponse,
  RegistryOutcome,
  ReportStatus,
} from '@cadastre/api-contracts/verification';

// ─── Tones ──────────────────────────────────────────────────────────────────

/**
 * The colour each tone is drawn in, as a CSS value an SVG fill can take.
 *
 * Every one is a token the design system already validated: three conveyor
 * steps of one indigo ramp plus the reserved failed ink, and the register's own
 * disposition band — so an outcome reads alike on the row, on the package page
 * and in a chart of a hundred of them. No chart here introduces a hue.
 */
const TONE_COLOR: Record<SliceTone, string> = {
  'conveyor-1': 'var(--conveyor-1)',
  'conveyor-2': 'var(--conveyor-2)',
  'conveyor-3': 'var(--conveyor-3)',
  failed: 'var(--failed)',
  ok: 'var(--ok)',
  issues: 'var(--issues)',
  incomplete: 'var(--incomplete)',
  // Untinted on purpose: the register holding no record is an absence of
  // evidence, and a fault's colour would state a shortfall it never claimed.
  silent: 'color-mix(in oklch, var(--muted-foreground) 45%, transparent)',
  question: 'var(--accent-2)',
};

/** The same tones as background utilities, for the conveyor's proportional bar. */
const TONE_FILL: Record<SliceTone, string> = {
  'conveyor-1': 'bg-conveyor-1',
  'conveyor-2': 'bg-conveyor-2',
  'conveyor-3': 'bg-conveyor-3',
  failed: 'bg-failed',
  ok: 'bg-ok',
  issues: 'bg-issues',
  incomplete: 'bg-incomplete',
  silent: 'bg-muted-foreground/45',
  question: 'bg-accent-2',
};

/** The ink a tone's glyph is set in. */
const TONE_INK: Record<SliceTone, string> = {
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

/** An observation is stated for the record and held against nothing, so it is
 *  drawn in ink rather than in one of the colours the register keeps for a
 *  verdict. */
const OBSERVATION_COLOR =
  'color-mix(in oklch, var(--muted-foreground) 55%, transparent)';

/** Kept short: the figures answer a click, they do not perform an entrance. */
const ANIMATION_MS = 450;

// ─── One class, ready to draw ───────────────────────────────────────────────

type Datum = {
  id: string;
  label: string;
  count: number;
  /** 0…1 of the whole this class belongs to. */
  share?: number;
  /** Read by Recharts as the sector's or bar's fill. */
  fill: string;
  glyph?: ReactNode;
};

function datumsOf(
  tally: Tally,
  t: (key: string) => string,
  glyph?: (id: string, tone: SliceTone) => ReactNode,
): Datum[] {
  return tally.slices.map(slice => ({
    id: slice.id,
    label: t(slice.labelKey),
    count: slice.count,
    share: slice.share,
    fill: TONE_COLOR[slice.tone],
    glyph: glyph?.(slice.id, slice.tone),
  }));
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

/** The caveat a figure carries, one tap away instead of always in view. */
function Hint({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return <InfoHint label={t('analytics.hint')}>{children}</InfoHint>;
}

function Panel({
  title,
  hint,
  action,
  className,
  children,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-rule bg-card',
        className,
      )}
    >
      <header className='flex min-h-13 flex-wrap items-center gap-x-1.5 gap-y-2 px-5 pt-4'>
        <h2 className='text-[0.9375rem] font-[550] leading-tight tracking-[-0.01em] text-foreground'>
          {title}
        </h2>
        {hint && <Hint>{hint}</Hint>}
        {action && <div className='ml-auto max-w-full'>{action}</div>}
      </header>
      <div className='flex flex-1 flex-col px-5 pt-4 pb-5'>{children}</div>
    </section>
  );
}

/** What a hovered mark says — in the order the legend beside it reads, so the
 *  eye does not have to re-learn where the number is. */
function FigureTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  const datum = payload?.[0]?.payload as Datum | undefined;
  if (!active || !datum?.label) return null;

  return (
    <div className='flex max-w-72 min-w-44 items-center gap-2.5 rounded-lg border border-rule bg-popover py-2 pr-3 pl-2.5 font-sans text-[0.8125rem] leading-snug text-popover-foreground tabular-nums shadow-[var(--shadow-overlay)]'>
      <span
        aria-hidden
        className='size-2.5 shrink-0 rounded-full'
        style={{ background: datum.fill }}
      />
      <span className='min-w-0 flex-1 whitespace-nowrap'>{datum.label}</span>
      <span className='font-semibold'>{datum.count}</span>
      {datum.share !== undefined && (
        <span className='text-muted-foreground'>{percent(datum.share)}</span>
      )}
    </div>
  );
}

/**
 * Where a popup sits relative to the chart it belongs to.
 *
 * Lifted over everything the chart shares its box with — the ring's centre
 * figure is drawn after the chart, and without this it painted over the popup —
 * and let out of the chart's own bounds, so a popup near an edge of a small ring
 * is not squeezed against it.
 */
const TOOLTIP_PLACEMENT = {
  wrapperStyle: { zIndex: 30, outline: 'none' },
  allowEscapeViewBox: { x: true, y: true },
  offset: 16,
  isAnimationActive: false,
} as const;

// ─── Part of a whole: a ring and its legend ─────────────────────────────────

function Donut({
  data,
  total,
  caption,
  link,
}: {
  data: readonly Datum[];
  total: number;
  /** What the figure in the middle is a count of. */
  caption: string;
  link?: (datum: Datum, row: ReactNode) => ReactNode;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // Classes at zero are left out of the ring and kept in the legend: a
  // zero-width sector cannot be seen but its padding can.
  const drawn = data.filter(datum => datum.count > 0);

  return (
    <div className='@container flex flex-1 items-center'>
      <div className='flex w-full flex-col items-center gap-5 @[24rem]:flex-row @[24rem]:gap-8'>
        <div className='relative size-40 shrink-0'>
          <ChartContainer config={{}} className='aspect-square size-full'>
            <PieChart>
              {drawn.length > 0 && (
                <ChartTooltip
                  {...TOOLTIP_PLACEMENT}
                  cursor={false}
                  content={<FigureTooltip />}
                />
              )}
              {drawn.length === 0 ? (
                // An empty tally still draws its ring, so an office that has
                // taken nothing in sees a figure and a zero — not a hole.
                <Pie
                  data={[{ id: 'empty', count: 1, fill: 'var(--muted)' }]}
                  dataKey='count'
                  innerRadius='72%'
                  outerRadius='94%'
                  stroke='none'
                  isAnimationActive={false}
                />
              ) : (
                <Pie
                  data={drawn as Datum[]}
                  dataKey='count'
                  nameKey='label'
                  innerRadius='72%'
                  outerRadius='94%'
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={drawn.length > 1 ? 2.5 : 0}
                  cornerRadius={4}
                  stroke='none'
                  animationDuration={ANIMATION_MS}
                  onMouseEnter={(_, index) =>
                    setHovered(drawn[index]?.id ?? null)
                  }
                  onMouseLeave={() => setHovered(null)}
                  shape={(props: PieSectorShapeProps) => {
                    const id = (props.payload as Datum).id;
                    const lifted = hovered === id;
                    return (
                      <Sector
                        {...props}
                        outerRadius={props.outerRadius + (lifted ? 4 : 0)}
                        opacity={hovered !== null && !lifted ? 0.35 : 1}
                        style={{ transition: 'opacity 150ms ease-out' }}
                      />
                    );
                  }}
                />
              )}
            </PieChart>
          </ChartContainer>
          <div className='pointer-events-none absolute inset-0 grid place-content-center text-center'>
            <span className='text-[1.75rem] font-[620] leading-none tracking-[-0.03em] text-foreground'>
              {total}
            </span>
            <span className='mt-1 max-w-24 text-[0.6875rem] leading-tight text-muted-foreground'>
              {caption}
            </span>
          </div>
        </div>

        <ul className='flex w-full min-w-0 flex-col gap-0.5'>
          {data.map(datum => {
            const row = (
              <div
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150',
                  hovered === datum.id && 'bg-muted',
                )}
              >
                <span className='grid size-3.5 shrink-0 place-items-center'>
                  {datum.glyph ?? (
                    <span
                      aria-hidden
                      className={cn(
                        'size-2.5 rounded-full',
                        datum.count === 0 && 'opacity-40',
                      )}
                      style={{ background: datum.fill }}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 text-[0.8125rem] leading-snug',
                    datum.count === 0
                      ? 'text-muted-foreground'
                      : 'text-foreground',
                  )}
                >
                  {datum.label}
                </span>
                <span className='text-[0.8125rem] font-medium text-foreground'>
                  {datum.count}
                </span>
                <span className='w-10 text-right text-[0.75rem] text-muted-foreground'>
                  {percent(datum.share ?? 0)}
                </span>
              </div>
            );
            return (
              <li
                key={datum.id}
                onMouseEnter={() => datum.count > 0 && setHovered(datum.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {link?.(datum, row) ?? row}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─── What goes wrong most often: a ranked bar chart ─────────────────────────

const RANK_ROW_PX = 46;

/**
 * A kind's name over its bar, and its count at the far end of the row.
 *
 * Drawn as a label of the bar rather than as an axis so the name sits on the
 * row it names at any width, and the count lines up down the right edge the way
 * a column of figures does.
 */
function RankLabel({
  y,
  value,
  data,
}: {
  y?: number | string;
  value?: unknown;
  data: readonly Datum[];
}) {
  const plot = usePlotArea();
  const datum = data.find(entry => entry.id === value);
  if (!plot || !datum) return null;
  const baseline = Number(y) - 7;

  return (
    <g>
      <text
        x={plot.x}
        y={baseline}
        className='fill-foreground text-[0.8125rem]'
      >
        {datum.label}
      </text>
      <text
        x={plot.x + plot.width}
        y={baseline}
        textAnchor='end'
        className='fill-foreground text-[0.8125rem] font-medium tabular-nums'
      >
        {datum.count}
      </text>
    </g>
  );
}

function RankChart({
  ranking,
  fill,
}: {
  ranking: FindingRanking;
  fill: string;
}) {
  const { t } = useI18n();

  if (ranking.ranked.length === 0) {
    return (
      <div className='register-hatch grid min-h-40 flex-1 place-items-center rounded-lg border border-rule'>
        <span className='rounded-md bg-card px-2 py-1 text-[0.8125rem] text-muted-foreground'>
          {t('summary.findings.none')}
        </span>
      </div>
    );
  }

  const data: Datum[] = ranking.ranked.map(rank => ({
    id: rank.kind,
    label: t(ISSUE_KIND_KEY[rank.kind]),
    count: rank.count,
    // Of everything this ranking counted — what the popup adds to a row that
    // already shows its name and count. `rank.share` is measured against the
    // most frequent kind, which is the bar's length and not a share of anything.
    share: ranking.total > 0 ? rank.count / ranking.total : 0,
    fill,
  }));

  return (
    <>
      <ChartContainer
        config={{}}
        className='aspect-auto w-full'
        style={{ height: data.length * RANK_ROW_PX + 6 }}
      >
        <BarChart
          data={data}
          layout='vertical'
          margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={0}
        >
          <XAxis type='number' dataKey='count' domain={[0, 'dataMax']} hide />
          <YAxis type='category' dataKey='id' hide />
          <ChartTooltip
            {...TOOLTIP_PLACEMENT}
            cursor={false}
            content={<FigureTooltip />}
          />
          <Bar
            dataKey='count'
            barSize={8}
            radius={4}
            minPointSize={3}
            background={{ fill: 'var(--muted)', radius: 4 }}
            activeBar={{ fillOpacity: 0.78 }}
            animationDuration={ANIMATION_MS}
          >
            <LabelList dataKey='id' content={<RankLabel data={data} />} />
          </Bar>
        </BarChart>
      </ChartContainer>
      {/* The kinds that did not come up, counted rather than drawn as a row of
          empty bars — which would bury the answer in a chart whose subject is
          frequency — and stated, so "none this period" does not read as "no
          such finding". */}
      {ranking.unseen > 0 && (
        <p className='mt-auto pt-3 text-[0.75rem] text-muted-foreground'>
          {t('analytics.unseen', { n: ranking.unseen })}
        </p>
      )}
    </>
  );
}

// ─── The four figures ───────────────────────────────────────────────────────

/**
 * Two rankings behind one switch, and never one number over both. A finding
 * held against a package is a shortfall somebody has to resolve; an observation
 * is stated for the record, and a report carrying nothing but observations
 * still reads OK — a chart that summed the two would announce faults in
 * submissions that have none.
 */
function FindingsPanel({
  summary,
  className,
}: {
  summary: PackagesOverviewResponse | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<'against' | 'observations'>('against');

  const against = summary && rankFindings(summary.findings.againstPackage);
  const observations = summary && rankFindings(summary.findings.observations);
  const shown = view === 'against' ? against : observations;

  const option = (
    value: typeof view,
    label: string,
    dot: string,
    total: number | undefined,
  ) => (
    <ToggleGroupItem
      value={value}
      size='sm'
      className='h-7 gap-1.5 rounded-md px-2.5 text-[0.8125rem] text-muted-foreground data-pressed:bg-card data-pressed:text-foreground data-pressed:shadow-[var(--shadow-xs)]'
    >
      <span aria-hidden className={cn('size-2 rounded-full', dot)} />
      {label}
      {total !== undefined && (
        <span className='text-[0.75rem] text-muted-foreground'>{total}</span>
      )}
    </ToggleGroupItem>
  );

  return (
    <Panel
      className={className}
      title={t('analytics.findings.title')}
      hint={
        shown &&
        (view === 'against'
          ? t('summary.against.note', { n: shown.total })
          : t('summary.observations.note', { n: shown.total }))
      }
      action={
        <ToggleGroup
          value={[view]}
          onValueChange={(next: string[]) => {
            if (next.length) setView(next[0] as typeof view);
          }}
          spacing={1}
          className='max-w-full flex-wrap rounded-lg bg-muted p-0.5'
        >
          {option(
            'against',
            t('summary.against.title'),
            'bg-issues',
            against?.total,
          )}
          {option(
            'observations',
            t('summary.observations.title'),
            'bg-muted-foreground/55',
            observations?.total,
          )}
        </ToggleGroup>
      }
    >
      {shown ? (
        <RankChart
          ranking={shown}
          fill={view === 'against' ? 'var(--issues)' : OBSERVATION_COLOR}
        />
      ) : (
        <div className='flex flex-col gap-5 pt-1'>
          {[0.9, 0.7, 0.45, 0.3].map(width => (
            <div key={width} className='flex flex-col gap-2'>
              <Skeleton className='h-3 w-40' />
              <Skeleton
                className='h-2 rounded-full'
                style={{ width: `${width * 100}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function DonutSkeleton() {
  return (
    <div className='flex flex-1 flex-wrap items-center gap-8'>
      <Skeleton className='size-40 rounded-full' />
      <div className='flex min-w-40 flex-1 flex-col gap-3'>
        <Skeleton className='h-3 w-4/5' />
        <Skeleton className='h-3 w-3/5' />
        <Skeleton className='h-3 w-2/3' />
      </div>
    </div>
  );
}

function OutcomesPanel({
  summary,
  linkable,
  className,
}: {
  summary: PackagesOverviewResponse | undefined;
  linkable: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const outcomes = summary && outcomeTally(summary.outcomes);

  const link = (datum: Datum, row: ReactNode) => {
    if (!linkable || datum.count === 0) return null;
    const query = registerQueryParams({
      ...WHOLE_REGISTER,
      reportStatus: datum.id as ReportStatus,
    });
    return (
      <Link
        to={{ pathname: paths.cases, search: query.toString() }}
        className='block rounded-md outline-none hover:[&>div]:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50'
      >
        {row}
      </Link>
    );
  };

  return (
    <Panel
      className={className}
      title={t('summary.outcomes.title')}
      hint={
        summary && (
          <>
            <span>
              {t('summary.outcomes.note', {
                n: summary.outcomes.total,
                total: summary.pipeline.total,
              })}
            </span>
            {/* Said where the links would have been: an inspector who narrows
                the period and finds the rows have stopped opening the register
                is owed the reason, not left to conclude the screen broke. */}
            {!linkable && summary.outcomes.total > 0 && (
              <span className='opacity-80'>
                {t('summary.outcomes.unlinked')}
              </span>
            )}
          </>
        )
      }
    >
      {outcomes ? (
        <Donut
          data={datumsOf(outcomes, t)}
          total={outcomes.total}
          caption={t('analytics.center.reported')}
          link={link}
        />
      ) : (
        <DonutSkeleton />
      )}
    </Panel>
  );
}

function PipelinePanel({
  summary,
  className,
}: {
  summary: PackagesOverviewResponse | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const pipeline = summary && pipelineTally(summary.pipeline);

  return (
    <Panel className={className} title={t('summary.pipeline.title')}>
      {pipeline ? (
        <div className='flex flex-1 flex-col justify-center gap-6'>
          {/* The conveyor is ordinal — waiting, being read, read — so it is one
              bar in steps of one ramp rather than a ring of unrelated slices.
              The bar is aria-hidden; the list under it is the same answer. */}
          <TallyBar
            className='h-3'
            empty={t('summary.empty')}
            marks={pipeline.slices.map(slice => ({
              id: slice.id,
              fill: TONE_FILL[slice.tone],
              label: t(slice.labelKey),
              count: slice.count,
              share: slice.share,
            }))}
          />
          <dl className='grid grid-cols-2 gap-x-6 gap-y-5'>
            {pipeline.slices.map(slice => (
              <div key={slice.id} className='flex min-w-0 flex-col gap-1.5'>
                <dt className='flex items-center gap-2 text-[0.8125rem] leading-snug text-muted-foreground'>
                  <span
                    aria-hidden
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      TONE_FILL[slice.tone],
                      slice.count === 0 && 'opacity-40',
                    )}
                  />
                  {t(slice.labelKey)}
                </dt>
                <dd className='flex items-baseline gap-2 pl-4.5'>
                  <span
                    className={cn(
                      'text-[1.375rem] font-[600] leading-none tracking-[-0.02em]',
                      slice.tone === 'failed' && slice.count > 0
                        ? 'text-failed-ink'
                        : 'text-foreground',
                    )}
                  >
                    {slice.count}
                  </span>
                  <span className='text-[0.75rem] text-muted-foreground'>
                    {percent(slice.share)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className='flex flex-col gap-6'>
          <Skeleton className='h-3 w-full rounded-full' />
          <div className='grid grid-cols-2 gap-5'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-10' />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ArchivePanel({
  summary,
  className,
}: {
  summary: PackagesOverviewResponse | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const archive = summary && archiveTally(summary.archive);

  return (
    <Panel
      className={className}
      title={t('summary.archive.title')}
      hint={
        summary && (
          <>
            <span>
              {t('summary.archive.note', { n: summary.archive.total })}
            </span>
            {/* The register answers about its own fonds and never about the
                submission, so "no record" is a gap in the archive — not a
                fault, and not a number to add to the ones beside it. */}
            <span className='opacity-80'>
              {t('summary.archive.not_found_note')}
            </span>
          </>
        )
      }
    >
      {archive ? (
        <Donut
          data={datumsOf(archive, t, (id, tone) => {
            // Five answers have five glyphs precisely so that none rests on its
            // colour; the legend keeps them.
            const Icon = OUTCOME_ICON[id as RegistryOutcome];
            return (
              <Icon aria-hidden className={cn('size-3.5', TONE_INK[tone])} />
            );
          })}
          total={archive.total}
          caption={t('analytics.center.questions')}
        />
      ) : (
        <DonutSkeleton />
      )}
    </Panel>
  );
}

// ─── The counters ───────────────────────────────────────────────────────────

type Kpi = {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Null until an answer has arrived. */
  value: number | null;
  sub: string | null;
  to: string | null;
};

/**
 * The strip of counters. Drawn from the same answer the figures are, so the
 * headline cannot disagree with the reading under it.
 *
 * **They count what this register can honestly count.** Nothing in this system
 * times a case from counter to decision, and the overview counts submissions
 * and findings rather than sheets (ADR-0017) — so the strip spends its slots on
 * what the overview does answer instead of drawing a tile that is always a dash.
 */
function KpiStrip({
  summary,
  period,
  linkable,
}: {
  summary: PackagesOverviewResponse | undefined;
  period: OverviewPeriod;
  linkable: boolean;
}) {
  const { t } = useI18n();
  const opens = (query: URLSearchParams) =>
    linkable ? `${paths.cases}?${query.toString()}` : null;
  const okShare =
    summary &&
    outcomeTally(summary.outcomes).slices.find(slice => slice.id === 'OK')
      ?.share;

  const kpis: Kpi[] = [
    {
      key: 'taken_in',
      icon: InboxIcon,
      label: t('analytics.kpi.taken_in'),
      value: summary ? summary.pipeline.total : null,
      sub: t(PERIOD_KEY[period]),
      to: opens(registerQueryParams(WHOLE_REGISTER)),
    },
    {
      key: 'clean',
      icon: FileCheckIcon,
      label: t('analytics.kpi.clean'),
      // The reports that held nothing against the papers — not the reports
      // there are, which is a different and much larger number.
      value: summary ? (summary.outcomes.byStatus.OK ?? 0) : null,
      sub: summary
        ? t('analytics.kpi.clean_sub', { p: percent(okShare ?? 0) })
        : null,
      to: opens(registerQueryParams({ ...WHOLE_REGISTER, reportStatus: 'OK' })),
    },
    {
      key: 'findings',
      icon: FlagIcon,
      label: t('analytics.kpi.findings'),
      value: summary ? summary.findings.againstPackage.total : null,
      sub: summary
        ? t('analytics.kpi.findings_sub', {
            n: summary.findings.observations.total,
          })
        : null,
      // Counted per finding, while the register lists submissions — so this
      // figure opens no set the list can name, under any window.
      to: null,
    },
    {
      key: 'archive',
      icon: ArchiveIcon,
      label: t('analytics.kpi.archive'),
      value: summary ? summary.archive.total : null,
      sub: summary
        ? t('analytics.kpi.archive_sub', {
            n: summary.archive.byOutcome.Confirmed ?? 0,
          })
        : null,
      // Questions put to the register, not submissions. Same reason.
      to: null,
    },
  ];

  return (
    <div className='grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule xl:grid-cols-4'>
      {kpis.map(kpi => (
        <KpiCell key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}

function KpiCell({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon;
  const body = (
    <>
      <div className='flex items-start justify-between gap-3'>
        <span className='text-[0.8125rem] leading-snug text-muted-foreground'>
          {kpi.label}
        </span>
        <span className='relative grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground'>
          <Icon
            aria-hidden
            className={cn(
              'size-3.5 transition-opacity duration-150',
              kpi.to && 'group-hover:opacity-0 group-focus-visible:opacity-0',
            )}
          />
          {kpi.to && (
            <ArrowUpRightIcon
              aria-hidden
              className='absolute size-3.5 text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100'
            />
          )}
        </span>
      </div>
      {kpi.value === null ? (
        <Skeleton className='h-8 w-16' />
      ) : (
        <strong className='text-[1.75rem] font-[620] leading-none tracking-[-0.035em] text-foreground proportional-nums md:text-[2rem]'>
          {kpi.value}
        </strong>
      )}
      {kpi.sub === null ? (
        <Skeleton className='h-3 w-24' />
      ) : (
        <span className='text-[0.75rem] leading-snug text-muted-foreground'>
          {kpi.sub}
        </span>
      )}
    </>
  );

  const frame = 'group flex min-w-0 flex-col gap-3 bg-card p-4 md:p-5';
  return kpi.to === null ? (
    <div className={frame}>{body}</div>
  ) : (
    <Link
      to={kpi.to}
      className={cn(
        frame,
        'outline-none transition-colors duration-150 hover:bg-accent/45 focus-visible:bg-accent/45 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
      )}
    >
      {body}
    </Link>
  );
}

// ─── Header pieces the page composes ────────────────────────────────────────

/**
 * The one control on the page. All of it is read over one window, and a figure
 * with a period of its own would put answers about different sets of
 * submissions side by side.
 */
export function PeriodSelect({
  period,
  onPeriod,
}: {
  period: OverviewPeriod;
  onPeriod: (period: OverviewPeriod) => void;
}) {
  const { t } = useI18n();
  return (
    <Select
      value={period}
      onValueChange={value => onPeriod(value as OverviewPeriod)}
    >
      <SelectTrigger
        aria-label={t('summary.period.label')}
        className='h-8 max-w-[15rem] gap-2 border-input bg-card px-2.5 text-foreground hover:bg-accent hover:text-foreground'
      >
        <CalendarIcon aria-hidden className='size-3.5 text-muted-foreground' />
        <span className='truncate text-[0.8125rem] font-medium'>
          {t(PERIOD_KEY[period])}
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
  );
}

/**
 * Whether the conveyor is running, beside the page title — a marker and a
 * word, the register's stamp. Said in both states: nothing is also what a
 * screen that failed to load looks like, so a running conveyor is told so.
 */
export function ConveyorMark({
  period,
  now,
}: {
  period: OverviewPeriod;
  now: number;
}) {
  const { t } = useI18n();
  const { currentData, data } = useGetPackagesOverviewQuery(
    toOverviewRequest(period, now),
  );
  const summary = currentData ?? data;
  if (!summary) return null;

  const stalled = stalledCount(summary.pipeline);
  return stalled > 0 ? (
    <span className='inline-flex items-center gap-1.5 text-[0.8125rem] text-failed-ink'>
      <span aria-hidden className='size-2 rounded-full bg-failed' />
      {t('summary.pipeline.failed')}
      <span className='font-medium'>{stalled}</span>
    </span>
  ) : (
    <span className='inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground'>
      <span aria-hidden className='size-2 rounded-full bg-ok' />
      {t('analytics.running')}
    </span>
  );
}

// ─── The page's summary ─────────────────────────────────────────────────────

export function RegisterSummary({
  period,
  now,
}: {
  period: OverviewPeriod;
  /** A fixed instant the window is measured back from. Held by the page: this
   *  request is its own cache key, and a `from` that moved every render would
   *  be a call that never stopped. */
  now: number;
}) {
  const { t } = useI18n();
  const { currentData, data, isError, refetch } = useGetPackagesOverviewQuery(
    toOverviewRequest(period, now),
  );

  // `currentData` answers the period being asked about now, `data` is the last
  // answer to any period. Holding the older one on screen, dimmed, is what
  // keeps a change of period from flashing the figures away.
  const summary = currentData ?? data;
  const answered = currentData !== undefined;
  const linkable = coversWholeRegister(period);
  const stalled = summary ? stalledCount(summary.pipeline) : 0;

  return (
    <div
      aria-busy={!answered}
      className={cn(
        'mx-auto flex w-full max-w-[96rem] flex-col gap-4 px-4 py-5 tabular-nums transition-opacity duration-200 md:px-6',
        summary && !answered && 'opacity-60',
      )}
    >
      {summary === undefined && isError && (
        // The one state in which the page genuinely does not know what the
        // register holds — and the reason a zero is never drawn from here.
        <div className='flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-card px-4 py-3'>
          <UnplugIcon className='size-4 shrink-0 text-muted-foreground' />
          <p className='min-w-0 flex-1 text-[0.8125rem] leading-snug text-muted-foreground'>
            {t('summary.error.body')}
          </p>
          <Button variant='outline' size='sm' onClick={() => refetch()}>
            {t('register.error.retry')}
          </Button>
        </div>
      )}

      {stalled > 0 && (
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-failed/25 bg-failed/5 px-4 py-3'>
          <OctagonAlertIcon className='size-4 shrink-0 text-failed' />
          {/* The count is named before it is given: Russian inflects the noun
              after a numeral, so "{n} submissions stalled" reads wrong at one
              of every ten values. */}
          <p className='min-w-0 flex-1 text-[0.8125rem] leading-snug text-failed-ink'>
            {t('summary.stalled.label')}{' '}
            <span className='font-medium'>{stalled}</span>{' '}
            {t('summary.stalled.body')}
          </p>
          {/* A labelled action and not a linked number: the register's
              `Stalled` standing also covers a finished run that left no
              report, so it opens a set this count does not define. */}
          <Button
            variant='outline'
            size='sm'
            nativeButton={false}
            className='shrink-0'
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
        </div>
      )}

      {!(summary === undefined && isError) && (
        <>
          <KpiStrip summary={summary} period={period} linkable={linkable} />
          <div className='grid gap-4 lg:grid-cols-12'>
            <FindingsPanel className='lg:col-span-7' summary={summary} />
            <OutcomesPanel
              className='lg:col-span-5'
              summary={summary}
              linkable={linkable}
            />
            <PipelinePanel className='lg:col-span-5' summary={summary} />
            <ArchivePanel className='lg:col-span-7' summary={summary} />
          </div>
        </>
      )}
    </div>
  );
}
