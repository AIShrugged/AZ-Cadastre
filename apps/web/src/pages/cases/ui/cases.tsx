/**
 * Cases — the register of applications the office has taken in, and the
 * inspector's queue-first work surface. Governed by The Register world: a ruled table, tabular mono data, one indigo signal, and
 * marks that report (never decide). Adaptive density; scales via pagination.
 *
 * The register asks the server its question and draws the answer. Searching,
 * narrowing and paging happen over every submission the office has taken in and
 * never over the page it last sent (ADR-0015) — this screen holds no list to
 * filter, and the twenty rows it has are twenty rows and not the register.
 *
 * **Two filters, because there are two questions.** Where a submission stands is
 * what has to happen to it next; what the run found is what the report holds
 * against the papers. They are narrowed by two controls, and neither is ever
 * folded into the other: a submission can be finished and still carry findings,
 * and one control over both could only ever answer one of them.
 *
 * **One column, because it is one thing to look at.** The two questions used to
 * be three columns — what was found, what it came to, what happens next — and
 * most of the time two of them said the same thing: `ShortOfDocuments` is what
 * `IncompletePackage` means for the queue, and `NeedsInspector` is what
 * `IssuesFound` means for it. They are now one cell (`case-state.ts`): the
 * standing leads, the findings are counted under it, and the outcome's own word
 * is drawn whenever it is news — which a repetition of the standing is not.
 *
 * It **is** drawn, repetition and all, while the outcome filter is narrowing
 * the register, which is why the table is told about that filter at all. A row
 * narrowed to a word it never shows is a row the inspector cannot check; a word
 * nobody is looking for is a word that only crowds the cell. Both are true, and
 * they are true at different moments.
 *
 * **The row names the case.** A profile and the first block of a uuid are the
 * row's furniture, not its subject — an inspector reads a register looking for
 * a person and an address. Both are the pipeline's reading of the package's own
 * papers, so both carry the confidence they were read with and neither is ever
 * passed off as a fact the office was told.
 *
 * The question lives in the address bar, so a narrowed register can be linked to
 * and returned to — the same reason a case has an address of its own.
 *
 * **The six tabs are shorthands and not a seventh filter.** Each stands for a
 * value of one of the two filters (`case-slice.ts` says which and why), so the
 * strip and the selects can never disagree about what is on screen: choosing a
 * tab writes the filter it stands for, and a filter chosen by hand lights the
 * tab that matches or none at all. Their counts come off the one summary call,
 * which counts every slice in a single transaction — six calls would count six
 * moments and the tabs would not add up to All.
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
  CASE_SLICES,
  caseState,
  documentsExpected,
  drawsOutcome,
  hasFindings,
  isNarrowed,
  OutcomeMark,
  packageRef,
  pageCount,
  parseOverviewPeriod,
  parseRegisterQuery,
  profileName,
  readWellEnough,
  registerQueryParams,
  REPORT_KEY,
  REPORT_TONE,
  SLICE_KEY,
  sliceCounts,
  sliceFilters,
  sliceOf,
  StageBar,
  STANDING_KEY,
  StandingMark,
  toListRequest,
  toOverviewRequest,
  useGetPackagesOverviewQuery,
  useGetPackagesQuery,
  useGetProfilesQuery,
  WHOLE_REGISTER,
  WHOLE_REGISTER_PERIOD,
  withOverviewPeriod,
  type CaseSlice,
  type CaseState,
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
  type StatedValueDto,
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

// ─── What the case is called ────────────────────────────────────────────────
// One value the papers state about the package, as the row says it: the
// reading, and — only where the engine was unsure of it — the figure it was
// read with.
//
// A sure confidence is a number nobody reads, so it is not drawn. An unsure one
// is, because the whole point of showing a reading in a register is that a value
// read badly is a value somebody has to check against the sheet before citing
// it. The figure and not the colour carries that, which is the same rule every
// other mark on this surface is drawn by.
function Stated({ value }: { value: StatedValueDto | null }) {
  const { t } = useI18n();
  if (value === null) {
    return <span className='text-muted-foreground/60'>—</span>;
  }
  const percent = Math.round(value.confidence * 100);
  return (
    <span className='flex min-w-0 items-baseline gap-1.5'>
      <span className='truncate' title={value.value}>
        {value.value}
      </span>
      {!readWellEnough(value.confidence) && (
        <span
          data-mono
          title={t('intake.read.glance', { p: percent })}
          className='shrink-0 text-[0.6875rem] text-incomplete-ink'
        >
          {percent}%
        </span>
      )}
    </span>
  );
}

// ─── Applicant / Address cell ───────────────────────────────────────────────
// Who the submission is for, over which property it concerns — the two things a
// person names a case by, and the two the row could not say while it led with a
// profile key and a fragment of a uuid.
//
// Null means no document of this package states it yet: the run has not reached
// the paper, or read nothing off it. Drawn as the same silence every other
// unknown cell of this table draws, and as one dash rather than two where the
// package names neither — two dashes stacked report nothing twice.
function Named({ p }: { p: VerificationPackage }) {
  if (p.applicant === null && p.address === null) {
    return <span className='text-muted-foreground/60'>—</span>;
  }
  return (
    <span className='flex max-w-[20rem] flex-col gap-0.5 leading-tight'>
      <span className='text-[0.8125rem] text-foreground'>
        <Stated value={p.applicant} />
      </span>
      <span className='text-[0.75rem] text-muted-foreground'>
        <Stated value={p.address} />
      </span>
    </span>
  );
}

// ─── Report line ────────────────────────────────────────────────────────────
// What the run made of the papers, and the findings it counted — the second
// half of the merged state cell, and the half the outcome filter narrows by.
//
// Three different pieces of news, told apart (`case-state.ts`): an outcome with
// its findings; a run under way, whose stage bar above this already reports the
// wait; and a package nothing has read, drawn as silence rather than as "no
// issues".
//
// The counts stay in the two groups the report keeps them in and are never
// added into one number: a shortfall somebody has to resolve and a reading the
// engine was unsure of are different work. They are drawn whether or not the
// outcome's own word is: a figure is what the inspector counts their day by,
// and it is never the repetition. A run that found neither is fully said by the
// words above it, so nothing is appended.
function Report({
  p,
  state,
  narrowedByOutcome,
}: {
  p: VerificationPackage;
  state: CaseState;
  narrowedByOutcome: boolean;
}) {
  const { t } = useI18n();
  if (state.kind === 'reading') return null;
  if (state.kind === 'unread') {
    return <span className='text-[0.75rem] text-muted-foreground/60'>—</span>;
  }
  const word = drawsOutcome(p.standing, state.outcome, narrowedByOutcome);
  if (!word && !hasFindings(state)) return null;
  return (
    <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
      {word && (
        <OutcomeMark
          tone={REPORT_TONE[state.outcome]}
          label={t(REPORT_KEY[state.outcome])}
        />
      )}
      {hasFindings(state) && (
        <span className='flex items-center gap-x-1.5 text-[0.75rem] leading-tight text-muted-foreground'>
          {state.issues > 0 && (
            <span className='font-medium text-issues-ink'>
              {state.issues === 1
                ? t('findings.issue_one')
                : t('findings.issues', { n: state.issues })}
            </span>
          )}
          {state.issues > 0 && state.lowConfidence > 0 && (
            <span aria-hidden>·</span>
          )}
          {state.lowConfidence > 0 && (
            <span>{t('findings.low', { n: state.lowConfidence })}</span>
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

// ─── State cell ─────────────────────────────────────────────────────────────
// What is with the case, in one column: where it stands, how far a run under
// way has got, and what the last one made of the papers.
//
// The standing leads because it is what has to happen next, and it is always
// drawn — mid-run included: it is what the standing filter narrows by. The
// report line under it is what the outcome filter narrows by, and it is drawn
// whenever there is one. Between them the cell says every word either control
// can be set to, which is what lets a narrowed row be checked by eye.
function State({
  p,
  narrowedByOutcome,
}: {
  p: VerificationPackage;
  narrowedByOutcome: boolean;
}) {
  return (
    <span className='flex flex-col items-start gap-1.5'>
      <StandingMark standing={p.standing} />
      {p.stage !== undefined && <StageBar stage={p.stage} />}
      <Report
        p={p}
        state={caseState(p)}
        narrowedByOutcome={narrowedByOutcome}
      />
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
  narrowedByOutcome,
}: {
  rows: VerificationPackage[];
  profiles: readonly ProfileDto[];
  density: Density;
  selected: string | null;
  onSelect: (p: VerificationPackage) => void;
  locale: Locale;
  now: number;
  /** Whether the outcome filter is narrowing the register — see `State`. */
  narrowedByOutcome: boolean;
}) {
  const { t } = useI18n();
  const pad = density === 'compact' ? 'py-2.5' : 'py-4';

  return (
    <Table className='border-separate border-spacing-0'>
      <TableHeader>
        <TableRow className='border-0 hover:bg-transparent'>
          {/* Five columns. No Profile column of its own: the entry leads with
              the profile's name, and the same string twice in one row is a
              column that reports nothing. Remarks, Outcome and Standing were
              three of these and are now one — what the run found, what it came
              to and what happens next are one thing to look at, and the cell
              still says the words both filters narrow by. The case it belongs
              to comes second, because that is what an inspector reads a
              register for. */}
          {[
            'col.case',
            'col.applicant',
            'col.documents',
            'col.state',
            'col.submitted',
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
                className={cn('border-b border-rule px-4 align-middle', pad)}
              >
                <Named p={p} />
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
                <State p={p} narrowedByOutcome={narrowedByOutcome} />
              </TableCell>
              <TableCell
                className={cn(
                  'border-b border-rule py-2 pr-6 pl-4 align-middle',
                  pad,
                )}
              >
                <div className='flex items-center justify-between gap-3'>
                  <Submitted p={p} locale={locale} now={now} />
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
// The same row, stacked: what the entry is over what it is called, the standing
// opposite it, then the run's progress and everything the desktop row says on
// one wrapping line. Same cells, same silences — an entry that reads one way on
// a phone and another on a desk is two registers.
function RegisterEntries({
  rows,
  profiles,
  onSelect,
  locale,
  narrowedByOutcome,
}: {
  rows: VerificationPackage[];
  profiles: readonly ProfileDto[];
  onSelect: (p: VerificationPackage) => void;
  locale: Locale;
  narrowedByOutcome: boolean;
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
            <Named p={p} />
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
              <Report
                p={p}
                state={caseState(p)}
                narrowedByOutcome={narrowedByOutcome}
              />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Loading state ──────────────────────────────────────────────────────────
// One bar per column of the table it stands in for, in the table's own order —
// a skeleton with a different number of cells than the rows that replace it is
// a layout that jumps the moment the answer lands. The two-line blocks are the
// two columns that stack a pair of lines; the state bar is the one drawn on a
// phone too, because the mobile entry shows the standing and hides the rest.
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
          <div className='hidden flex-1 flex-col gap-1.5 md:flex'>
            <Skeleton className='h-3.5 w-36' />
            <Skeleton className='h-3 w-52' />
          </div>
          <Skeleton className='hidden h-3 w-10 md:block' />
          <Skeleton className='h-4 w-28' />
          <Skeleton className='hidden h-3 w-20 md:block' />
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
          <Button onClick={() => navigate(paths.intake)}>
            <PlusIcon /> {t('action.intake')}
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

// ─── Slice tabs ─────────────────────────────────────────────────────────────
// The six views the mockup opens the register by, with what each holds beside
// its name. A tab writes the filter it stands for and nothing else, so the
// strip and the two selects below it are one control surface rather than two
// that can disagree — and a narrowing no tab stands for lights none of them.
//
// The counts are the summary's, read in one transaction over the whole
// register; a tally the summary has not answered yet is drawn as a space and
// never as 0, which would read as an empty slice.
function SliceTabs({
  active,
  counts,
  onPick,
}: {
  active: CaseSlice | null;
  counts: Record<CaseSlice, number> | null;
  onPick: (slice: CaseSlice) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role='tablist'
      aria-label={t('slice.label')}
      className='-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1'
    >
      {CASE_SLICES.map(slice => {
        const selected = slice === active;
        return (
          <button
            key={slice}
            type='button'
            role='tab'
            aria-selected={selected}
            onClick={() => onPick(slice)}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] whitespace-nowrap transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring/50',
              selected
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <span>{t(SLICE_KEY[slice])}</span>
            <span
              data-mono
              className={cn(
                'min-w-4 rounded-full px-1 text-[0.6875rem] tabular-nums',
                selected
                  ? 'bg-background text-foreground/80'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {counts === null ? '\u00A0' : counts[slice]}
            </span>
          </button>
        );
      })}
    </div>
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
export function Cases() {
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
  // What each tab holds. Over the **whole** register and never over the
  // summary's period: the list this strip narrows is not narrowed by a period,
  // so a count taken over one would describe a different set of rows than the
  // tab opens. Same endpoint, a second cache entry, one call.
  const { data: overview } = useGetPackagesOverviewQuery(
    toOverviewRequest(WHOLE_REGISTER_PERIOD, now),
  );
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
    navigate(paths.case(p.id));
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
        <Button onClick={() => navigate(paths.intake)}>
          <PlusIcon />{' '}
          <span className='hidden sm:inline'>{t('action.intake')}</span>
        </Button>
      </HeaderActions>

      {/* ── Page heading ── the register names itself and states its purpose. */}
      <SurfaceHeading
        title={t('page.cases.title')}
        subtitle={t('page.cases.subtitle')}
      />

      <SurfaceBody>
        {/* ── The register from further away ──
            Above the strip that searches it, because it is about every
            submission the office has taken in and the strip is about which of
            them this page lists. It scrolls away with the summary it heads. */}
        <RegisterSummary period={period} onPeriod={askPeriod} now={now} />

        {/* ── Slice tabs ── the register's six views, over the strip that
            searches within whichever one is open. */}
        <div className='flex shrink-0 items-center border-b border-rule px-4 py-1.5 md:px-6'>
          <SliceTabs
            active={sliceOf(query)}
            counts={overview ? sliceCounts(overview) : null}
            onPick={slice => ask({ ...sliceFilters(slice), page: 1 })}
          />
        </div>

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
                narrowedByOutcome={query.reportStatus !== null}
              />
            </div>
            <div className='flex-1 md:hidden'>
              <RegisterEntries
                rows={rows}
                profiles={profiles}
                onSelect={onSelect}
                locale={locale}
                narrowedByOutcome={query.reportStatus !== null}
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
