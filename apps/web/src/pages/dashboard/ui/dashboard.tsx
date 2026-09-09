/**
 * Verification register — the inspector's queue-first work surface. Governed by
 * The Register world: a ruled table, tabular mono data, one indigo signal, and
 * marks that report (never decide). Adaptive density; scales via pagination.
 *
 * The register asks the server its question and draws the answer. Searching,
 * narrowing and paging happen over every submission the office has taken in and
 * never over the page it last sent (ADR-0015) — this screen holds no list to
 * filter, and the twenty rows it has are twenty rows and not the register.
 *
 * **Two filters, because there are two questions.** Where a submission stands is
 * what has to happen to it next; what the run found is what the report holds
 * against the papers. They are shown in two columns and narrowed by two
 * controls, and neither is ever folded into the other: a submission can be
 * finished and still carry findings, and one control over both could only ever
 * answer one of them.
 *
 * The question lives in the address bar, so a narrowed register can be linked to
 * and returned to — the same reason a package has an address of its own.
 *
 * **The summary sits on this screen and not beside it.** The four things an
 * inspector opens a summary to ask are questions about the very submissions
 * this table lists, and a section of their own would be one more page to
 * remember; so the register opens with what it looks like from further away and
 * then lists the entries. It scrolls with them rather than pinning above them:
 * an inspector who works the queue all day folds it shut once, and the fold is
 * remembered.
 *
 * The strip that searches and narrows the register moved into the scrolling
 * region with the table it belongs to. Above the summary it would have sat four
 * hundred pixels from the rows it filters, which is the same control in the
 * wrong place.
 */
import {
  ChevronRightIcon,
  FilterXIcon,
  InboxIcon,
  PlusIcon,
  Rows2Icon,
  Rows4Icon,
  SearchIcon,
  UnplugIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  documentsExpected,
  isNarrowed,
  OutcomeMark,
  packageRef,
  pageCount,
  parseOverviewPeriod,
  parseRegisterQuery,
  profileName,
  registerQueryParams,
  REPORT_KEY,
  REPORT_TONE,
  StageBar,
  STANDING_KEY,
  StandingMark,
  toListRequest,
  useGetPackagesQuery,
  useGetProfilesQuery,
  WHOLE_REGISTER,
  withOverviewPeriod,
  type OverviewPeriod,
  type ProfileDto,
  type RegisterQuery,
  type VerificationPackage,
} from '@/entities/verification-package';
import { ImportRegistryButton } from '@/features/import-registry';
import { paths } from '@/shared/config';
import { formatDate, relativeShort, useI18n, type Locale } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from '@/shared/ui/surface';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { HeaderActions } from '@/widgets/app-shell';
import { RegisterSummary } from '@/widgets/register-summary';
import {
  PackageStandingSchema,
  ReportStatusSchema,
} from '@cadastre/api-contracts/verification';

type Density = 'comfortable' | 'compact';

// The filter's own word for "do not narrow by this at all". Not a member of
// either enum and never sent: a select needs a value for the choice of making
// no choice, and an empty string is how a select says "nothing chosen yet".
const ANY = 'any';

// Both lists are read off the contract's own enums rather than written out
// here, so a standing or an outcome the engine starts publishing appears in the
// filter with it — a list this screen kept would silently hide the new one.
const STANDINGS = PackageStandingSchema.options;
const OUTCOMES = ReportStatusSchema.options;

// How long the register waits after the last keystroke before it asks. A call
// per character would ask the database a question the inspector has not
// finished putting.
const TYPING_SETTLES_MS = 300;

// ─── Outcome cell ───────────────────────────────────────────────────────────
// What the run made of the papers, and the findings behind it. Separate from
// the standing column on purpose: this says what was found, that one says what
// happens next, and a finished submission can carry findings.
function Outcome({ p }: { p: VerificationPackage }) {
  const { t } = useI18n();
  if (p.reportStatus === null) {
    // No run has reported on this one yet. Drawn as silence rather than as "no
    // issues": a package nothing has read is not a package nothing was found in.
    return <span className='text-muted-foreground/60'>—</span>;
  }
  return (
    <span className='flex flex-col items-start gap-1 leading-tight'>
      <OutcomeMark
        tone={REPORT_TONE[p.reportStatus]}
        label={t(REPORT_KEY[p.reportStatus])}
      />
      {(p.issues > 0 || p.lowConfidence > 0) && (
        <span className='flex flex-col gap-0.5 text-[0.75rem] text-muted-foreground'>
          {p.issues > 0 && (
            <span className='font-medium text-issues-ink'>
              {p.issues === 1
                ? t('findings.issue_one')
                : t('findings.issues', { n: p.issues })}
            </span>
          )}
          {p.lowConfidence > 0 && (
            <span>{t('findings.low', { n: p.lowConfidence })}</span>
          )}
        </span>
      )}
    </span>
  );
}

// ─── Documents cell ─────────────────────────────────────────────────────────
// Placed against what the governing profile expects. `expected` is null when
// the engine named no such profile — this build has never heard of the policy
// this package was opened under — so the cell reports what it knows rather than
// inventing a total: the documents the engine found inside the uploaded files,
// or, before it has read them, the number of files themselves.
function Documents({
  p,
  expected,
}: {
  p: VerificationPackage;
  expected: number | null;
}) {
  const total = expected ?? (p.docsFound || p.filesAttached);
  const short = p.docsClassified < total;
  return (
    <span
      data-mono
      className={cn(
        'text-[0.8125rem]',
        short ? 'text-incomplete-ink' : 'text-foreground/80',
      )}
    >
      {p.docsClassified}/{total}
    </span>
  );
}

// ─── Submitted cell ─────────────────────────────────────────────────────────
function Submitted({
  p,
  locale,
  now,
}: {
  p: VerificationPackage;
  locale: Locale;
  now: number;
}) {
  const { t } = useI18n();
  if (p.stage !== undefined) {
    return (
      <span className='flex flex-col gap-0.5 leading-tight'>
        <span data-mono className='text-[0.8125rem] text-foreground/80'>
          {formatDate(p.submittedAt, locale)}
        </span>
        <span className='text-[0.75rem] text-progress'>
          {t('updated.ago', { t: relativeShort(p.updatedAt, now) })}
        </span>
      </span>
    );
  }
  return (
    <span data-mono className='text-[0.8125rem] text-foreground/80'>
      {formatDate(p.submittedAt, locale)}
    </span>
  );
}

// ─── Standing cell ──────────────────────────────────────────────────────────
// The word first, then how far the run has got where one is under way. The word
// is always drawn, even mid-run: it is what the standing filter narrows by, and
// a row narrowed to a word it never shows is a row the inspector cannot check.
function Standing({ p }: { p: VerificationPackage }) {
  return (
    <span className='flex flex-col items-start gap-1.5'>
      <StandingMark standing={p.standing} />
      {p.stage !== undefined && <StageBar stage={p.stage} />}
    </span>
  );
}

// ─── Desktop table ──────────────────────────────────────────────────────────
function RegisterTable({
  rows,
  profiles,
  density,
  selected,
  onSelect,
  locale,
  now,
}: {
  rows: VerificationPackage[];
  profiles: readonly ProfileDto[];
  density: Density;
  selected: string | null;
  onSelect: (p: VerificationPackage) => void;
  locale: Locale;
  now: number;
}) {
  const { t } = useI18n();
  const pad = density === 'compact' ? 'py-2.5' : 'py-4';

  return (
    <Table className='border-separate border-spacing-0'>
      <TableHeader>
        <TableRow className='border-0 hover:bg-transparent'>
          {/* No Profile column: the entry now leads with the profile's name, and
              the same string twice in one row is a column that reports nothing.
              Outcome and Standing are two columns for the same reason they are
              two filters — they answer two questions. */}
          {[
            'col.package',
            'col.documents',
            'col.outcome',
            'col.submitted',
            'col.standing',
          ].map((c, i, all) => (
            <TableHead
              key={c}
              className={cn(
                'register-label sticky top-0 z-10 h-auto border-b border-rule-strong bg-background px-4 py-2.5',
                i === 0 && 'pl-6',
                i === all.length - 1 && 'pr-6',
              )}
            >
              {t(c)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(p => {
          const isSel = selected === p.id;
          return (
            <TableRow
              key={p.id}
              tabIndex={0}
              onClick={() => onSelect(p)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(p);
                }
              }}
              className={cn(
                'group cursor-pointer border-0 outline-none transition-colors',
                isSel
                  ? 'bg-accent'
                  : 'hover:bg-accent/50 focus-visible:bg-accent/50',
              )}
            >
              <TableCell
                className={cn(
                  'border-b border-rule pl-6 pr-4 align-middle',
                  pad,
                  isSel && 'shadow-[inset_2px_0_0_var(--color-primary)]',
                )}
              >
                {/* What the entry is, then which entry it is. The uuid led this
                    column and told the inspector nothing they could read; it
                    stays as the reference underneath, in full on hover. */}
                <div className='flex flex-col gap-0.5 leading-tight'>
                  <span className='text-[0.8125rem] font-medium text-foreground'>
                    {profileName(t, p.profile)}
                  </span>
                  <span
                    data-mono
                    title={p.id}
                    className='text-[0.8125rem] text-muted-foreground'
                  >
                    {packageRef(p.id)}
                  </span>
                </div>
              </TableCell>
              <TableCell
                className={cn(
                  'border-b border-rule px-4 align-middle tabular-nums',
                  pad,
                )}
              >
                <Documents
                  p={p}
                  expected={documentsExpected(profiles, p.profile)}
                />
              </TableCell>
              <TableCell
                className={cn('border-b border-rule px-4 align-middle', pad)}
              >
                <Outcome p={p} />
              </TableCell>
              <TableCell
                className={cn('border-b border-rule px-4 align-middle', pad)}
              >
                <Submitted p={p} locale={locale} now={now} />
              </TableCell>
              <TableCell
                className={cn(
                  'border-b border-rule py-2 pr-6 pl-4 align-middle',
                  pad,
                )}
              >
                <div className='flex items-center justify-between gap-3'>
                  <Standing p={p} />
                  <ChevronRightIcon className='size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground group-focus-visible:text-muted-foreground' />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Mobile entry list ──────────────────────────────────────────────────────
function RegisterEntries({
  rows,
  profiles,
  onSelect,
  locale,
}: {
  rows: VerificationPackage[];
  profiles: readonly ProfileDto[];
  onSelect: (p: VerificationPackage) => void;
  locale: Locale;
}) {
  const { t } = useI18n();
  return (
    <ul className='flex flex-col border-t border-rule-strong'>
      {rows.map(p => (
        <li key={p.id}>
          <button
            onClick={() => onSelect(p)}
            className='flex w-full flex-col gap-2.5 border-b border-rule px-4 py-4 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none'
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='flex min-w-0 flex-col gap-0.5'>
                <span className='text-[0.8125rem] font-medium text-foreground'>
                  {profileName(t, p.profile)}
                </span>
                <span
                  data-mono
                  className='truncate text-[0.8125rem] text-muted-foreground'
                >
                  {packageRef(p.id)}
                </span>
              </div>
              <StandingMark standing={p.standing} className='shrink-0' />
            </div>
            {p.stage !== undefined && <StageBar stage={p.stage} />}
            <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem] text-muted-foreground'>
              <span>
                {t('col.documents')}{' '}
                <span data-mono className='text-foreground/70'>
                  {p.docsClassified}/
                  {documentsExpected(profiles, p.profile) ??
                    (p.docsFound || p.filesAttached)}
                </span>
              </span>
              <span data-mono>{formatDate(p.submittedAt, locale)}</span>
              <Outcome p={p} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Loading state ──────────────────────────────────────────────────────────
function RegisterSkeleton({ density }: { density: Density }) {
  const pad = density === 'compact' ? 'py-3' : 'py-[18px]';
  return (
    <div
      className='flex-1 border-t border-rule-strong'
      aria-busy='true'
      aria-live='polite'
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-4 border-b border-rule px-4 md:px-6',
            pad,
          )}
        >
          <div className='flex flex-1 flex-col gap-1.5'>
            <Skeleton className='h-3.5 w-32' />
            <Skeleton className='h-3 w-44' />
          </div>
          <Skeleton className='hidden h-3 w-24 md:block' />
          <Skeleton className='hidden h-3 w-8 md:block' />
          <Skeleton className='hidden h-3 w-20 md:block' />
          <Skeleton className='hidden h-3 w-20 md:block' />
          <Skeleton className='h-4 w-28' />
        </div>
      ))}
    </div>
  );
}

// ─── Empty and unreachable states ───────────────────────────────────────────
// Three different pieces of news, and never one another: a register with
// nothing in it, a question nothing answered to, and a server that did not
// answer at all.
function EmptyRegister({
  narrowed,
  onClear,
}: {
  narrowed: boolean;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Empty className='register-hatch flex-1 rounded-none border-0 border-t border-rule-strong px-6 py-24'>
      <EmptyMedia
        variant='icon'
        className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
      >
        {narrowed ? (
          <FilterXIcon className='size-5' />
        ) : (
          <InboxIcon className='size-5' />
        )}
      </EmptyMedia>
      <EmptyHeader className='gap-1.5'>
        <EmptyTitle className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
          {t(narrowed ? 'empty.filtered.title' : 'empty.title')}
        </EmptyTitle>
        <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
          {t(narrowed ? 'empty.filtered.body' : 'empty.body')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {narrowed ? (
          <Button variant='outline' onClick={onClear}>
            <FilterXIcon /> {t('empty.clear')}
          </Button>
        ) : (
          <Button onClick={() => navigate(paths.new)}>
            <PlusIcon /> {t('action.new')}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
}

function UnreachableRegister({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <Empty className='register-hatch flex-1 rounded-none border-0 border-t border-rule-strong px-6 py-24'>
      <EmptyMedia
        variant='icon'
        className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
      >
        <UnplugIcon className='size-5' />
      </EmptyMedia>
      <EmptyHeader className='gap-1.5'>
        <EmptyTitle className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
          {t('register.error.title')}
        </EmptyTitle>
        <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
          {t('register.error.body')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant='outline' onClick={onRetry}>
          {t('register.error.retry')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

// ─── One filter ─────────────────────────────────────────────────────────────
// A select and not a chip rail: seven standings, each named by a sentence
// fragment in three languages, do not fit a row of chips at any width — and a
// rail that scrolls sideways hides the choices it exists to show.
function Filter<T extends string>({
  label,
  anyLabel,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string;
  anyLabel: string;
  value: T | null;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T | null) => void;
}) {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={v => onChange(v === ANY ? null : (v as T))}
    >
      <SelectTrigger
        aria-label={label}
        className='h-8 max-w-[15rem] gap-2 border-input bg-background px-2.5 text-foreground hover:bg-accent hover:text-foreground'
      >
        <span className='flex min-w-0 items-baseline gap-1.5 text-[0.8125rem]'>
          <span className='shrink-0 text-muted-foreground'>{label}</span>
          <span className='truncate font-medium'>
            {value === null ? anyLabel : optionLabel(value)}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent align='end'>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {optionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const query = useMemo(() => parseRegisterQuery(params), [params]);
  const request = useMemo(() => toListRequest(query), [query]);
  // The window the summary is read over. It lives in the same address bar as
  // the register's own question but narrows nothing on this table — the list
  // endpoint takes no period — so it is parsed apart from the query and carried
  // through every rewrite of it rather than folded into `RegisterQuery`.
  const period = useMemo(() => parseOverviewPeriod(params), [params]);

  const ask = useCallback(
    (change: Partial<RegisterQuery>, replace = false) => {
      setParams(
        withOverviewPeriod(
          registerQueryParams({ ...query, ...change }),
          period,
        ),
        { replace },
      );
    },
    [query, period, setParams],
  );

  const askPeriod = useCallback(
    (next: OverviewPeriod) => {
      setParams(withOverviewPeriod(registerQueryParams(query), next));
    },
    [query, setParams],
  );

  // Poll while anything on this page is still being read, so pipeline progress
  // lands without a manual refresh; stop once the page is quiet. Only this page
  // is watched, because only this page is on the screen — the register is not
  // held in the client to be scanned. `pollingInterval` is re-read each render,
  // so we adjust it during render (no effect) from the data we just received.
  const [polling, setPolling] = useState(true);
  const { currentData, data, isError, refetch } = useGetPackagesQuery(request, {
    pollingInterval: polling ? 1500 : 0,
    skipPollingIfUnfocused: true,
  });

  // `currentData` is the answer to the question being asked now; `data` is the
  // last answer to any question. Holding the older one on the screen while a new
  // one is in flight is what keeps a filter change from flashing the register
  // away — and `answered` is what stops an old empty page being read as an
  // answer to the new question.
  const page = currentData ?? data;
  const answered = currentData !== undefined;
  const rows = useMemo(() => page?.items ?? [], [page]);

  const shouldPoll = rows.some(p => p.stage !== undefined);
  if (shouldPoll !== polling) setPolling(shouldPoll);

  // Which documents each profile expects — policy, so it is asked for once and
  // cached, never polled alongside the packages.
  const { data: profiles = [] } = useGetProfilesQuery();
  const [now] = useState(() => Date.now());
  const [density, setDensity] = useState<Density>('comfortable');
  const [selected, setSelected] = useState<string | null>(null);

  // The box holds what is being typed; the address bar holds what has been
  // asked. They part company for as long as the pause lasts, and meet again
  // whenever the address changes from anywhere else — a link, the back button,
  // the clear action.
  const [term, setTerm] = useState(query.search);
  useEffect(() => setTerm(query.search), [query.search]);
  useEffect(() => {
    if (term.trim() === query.search) return;
    const settle = setTimeout(
      () => ask({ search: term.trim(), page: 1 }, true),
      TYPING_SETTLES_MS,
    );
    return () => clearTimeout(settle);
  }, [term, query.search, ask]);

  const pages = page ? pageCount(page.total, page.limit) : 1;
  // A link can name a page the answer does not reach — the filter was narrowed
  // since, or the row was on the last page of a longer register. Walk back to
  // the last page there is rather than leaving the reader on a blank one.
  useEffect(() => {
    if (answered && query.page > pages) ask({ page: pages }, true);
  }, [answered, query.page, pages, ask]);

  const onSelect = (p: VerificationPackage) => {
    setSelected(p.id);
    navigate(paths.package(p.id));
  };

  const narrowed = isNarrowed(query);
  // Clearing the filters clears the filters. The period is not one of them — it
  // scopes the summary and narrows no row in this table — so it survives.
  const clear = () =>
    setParams(withOverviewPeriod(registerQueryParams(WHOLE_REGISTER), period));

  // Nothing has ever been answered for this question or any other — the one
  // state in which the register genuinely does not know what it holds.
  const waiting = page === undefined;
  const shown = page
    ? {
        first: page.total === 0 ? 0 : page.offset + 1,
        last: Math.min(page.offset + rows.length, page.total),
        total: page.total,
      }
    : null;

  return (
    <SurfacePage>
      {/* The register's one page action rides in the global app bar. */}
      <HeaderActions>
        <span aria-hidden className='mx-0.5 h-6 w-px bg-rule-strong' />
        {/* Loading the archive register is an operator's errand, not the
            inspector's work — so it sits beside the page action and not on it,
            and keeps the register's one blue action to itself. */}
        <ImportRegistryButton />
        <Button onClick={() => navigate(paths.new)}>
          <PlusIcon />{' '}
          <span className='hidden sm:inline'>{t('action.new')}</span>
        </Button>
      </HeaderActions>

      {/* ── Page heading ── the register names itself and states its purpose. */}
      <SurfaceHeading
        title={t('page.register.title')}
        subtitle={t('page.register.subtitle')}
      />

      <SurfaceBody>
        {/* ── The register from further away ──
            Above the strip that searches it, because it is about every
            submission the office has taken in and the strip is about which of
            them this page lists. It scrolls away with the summary it heads. */}
        <RegisterSummary period={period} onPeriod={askPeriod} now={now} />

        {/* ── Filter / control strip ── */}
        <div className='flex shrink-0 flex-col gap-3 border-b border-rule px-4 py-2.5 md:flex-row md:items-center md:justify-between md:px-6'>
          <div className='relative md:w-80'>
            <SearchIcon className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={term}
              onChange={e => setTerm(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.label')}
              className='h-8 border-input bg-background pl-8 text-[0.8125rem]'
            />
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Filter
              label={t('filter.standing')}
              anyLabel={t('filter.any_standing')}
              value={query.standing}
              options={STANDINGS}
              optionLabel={standing => t(STANDING_KEY[standing])}
              onChange={standing => ask({ standing, page: 1 })}
            />
            <Filter
              label={t('filter.outcome')}
              anyLabel={t('filter.any_outcome')}
              value={query.reportStatus}
              options={OUTCOMES}
              optionLabel={outcome => t(REPORT_KEY[outcome])}
              onChange={reportStatus => ask({ reportStatus, page: 1 })}
            />
            {narrowed && (
              <Button variant='ghost' size='sm' onClick={clear}>
                <FilterXIcon /> {t('empty.clear')}
              </Button>
            )}
            <ToggleGroup
              value={[density]}
              onValueChange={(v: string[]) => {
                if (v.length) setDensity(v[0] as Density);
              }}
              spacing={0}
              aria-label={t('density.label')}
              className='overflow-hidden rounded-md border border-input'
            >
              <ToggleGroupItem
                value='comfortable'
                aria-label={t('density.comfortable')}
                className='size-8 rounded-none data-pressed:bg-accent data-pressed:text-foreground'
              >
                <Rows2Icon className='size-4' />
              </ToggleGroupItem>
              <ToggleGroupItem
                value='compact'
                aria-label={t('density.compact')}
                className='size-8 rounded-none data-pressed:bg-accent data-pressed:text-foreground'
              >
                <Rows4Icon className='size-4' />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* ── Register rows ── four states, and each is told apart from the
            rest: nothing answered yet, nothing answered at all, an answer with
            no rows in it, and rows. An answer to the *previous* question is
            never drawn as an empty one — that is the difference between "no
            packages match" and "still asking". */}
        {isError && waiting ? (
          <UnreachableRegister onRetry={() => void refetch()} />
        ) : waiting || (rows.length === 0 && !answered) ? (
          <RegisterSkeleton density={density} />
        ) : rows.length === 0 ? (
          <EmptyRegister narrowed={narrowed} onClear={clear} />
        ) : (
          <div
            aria-busy={!answered}
            className={cn(
              'flex flex-1 flex-col transition-opacity',
              !answered && 'opacity-60',
            )}
          >
            <div className='hidden flex-1 md:block md:pt-3'>
              <RegisterTable
                rows={rows}
                profiles={profiles}
                density={density}
                selected={selected}
                onSelect={onSelect}
                locale={locale}
                now={now}
              />
            </div>
            <div className='flex-1 md:hidden'>
              <RegisterEntries
                rows={rows}
                profiles={profiles}
                onSelect={onSelect}
                locale={locale}
              />
            </div>
          </div>
        )}
      </SurfaceBody>

      {/* ── Pagination footer ── always rendered so the register's closing rule
          and the h-16 bookend hold across loading, empty, and populated states.
          Until something has been answered the counts are unknown, so the row
          places a skeleton where the tally goes rather than showing a
          misleading 0. */}
      <SurfaceFooter>
        {shown === null ? (
          <Skeleton className='h-3 w-40' />
        ) : (
          <>
            <p className='text-[0.8125rem] text-muted-foreground'>
              <span data-mono className='text-foreground/70'>
                {t('page.showing', {
                  a: shown.first,
                  b: shown.last,
                  n: shown.total,
                })}
              </span>
            </p>
            <div className='flex items-center gap-1.5'>
              <Button
                variant='outline'
                size='sm'
                disabled={query.page <= 1}
                onClick={() => ask({ page: Math.max(1, query.page - 1) })}
              >
                {t('page.prev')}
              </Button>
              <span
                data-mono
                className='px-1 text-[0.8125rem] text-muted-foreground'
              >
                {query.page} / {pages}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={query.page >= pages}
                onClick={() => ask({ page: Math.min(pages, query.page + 1) })}
              >
                {t('page.next')}
              </Button>
            </div>
          </>
        )}
      </SurfaceFooter>
    </SurfacePage>
  );
}
