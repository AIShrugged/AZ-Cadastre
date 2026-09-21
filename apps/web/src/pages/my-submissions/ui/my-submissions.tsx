/**
 * My submissions — everything this applicant has filed, and where each of them
 * stands.
 *
 * The same endpoint the office's register reads, and deliberately so: the scope
 * is the session's, not a parameter this screen sends (ADR-0029), so
 * `GET /packages` answers an applicant with their own submissions and nobody
 * else's. A screen that filtered by owner on the client would be a screen that
 * had been handed somebody else's papers already.
 *
 * **Not the register with columns removed.** The office reads a queue: it scans
 * many cases for the one that needs it, which is what the search box, the six
 * slices and the two filters are for. A person reads the two or three
 * applications they have ever filed, and every one of them is theirs to
 * recognise at a glance — so this is a list of entries, in the order they were
 * filed, and there is nothing to narrow.
 *
 * **What each entry says is what a person came to find out**: which property it
 * is about, when they filed it, where it stands, and whether anything is
 * wanted from them. No confidence figures, no stage bar, no profile key: those
 * report how well the machine read a sheet, which is the office's business with
 * its own engine and not news about somebody's application.
 */
import { FilePlus2Icon, InboxIcon, UnplugIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  APPLICANT_REPORT_KEY,
  APPLICANT_STANDING_NOTE,
  drawsOutcome,
  OutcomeMark,
  packageRef,
  pageCount,
  REPORT_TONE,
  StandingMark,
  useGetPackagesQuery,
  type VerificationPackage,
} from '@/entities/verification-package';
import { paths } from '@/shared/config';
import { formatDate, useI18n, type Locale } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from '@/shared/ui/surface';
import { HeaderActions } from '@/widgets/app-shell';

/**
 * How many entries a page holds. Smaller than the register's twenty because the
 * entries are taller and because nobody has twenty: the number exists so the
 * screen cannot be asked for an unbounded list, not because anyone will page.
 */
const PAGE_SIZE = 10;

/** The same beat the register keeps, so a run does not appear to go at two
 *  speeds depending on who is watching it. */
const RUN_BEATS_MS = 1500;

/**
 * What the entry is about, in the applicant's own terms: the property the
 * papers state, or — before anything has been read off them — the reference the
 * office cites it by.
 *
 * The address is drawn as the plain value it is. The office's register prints
 * the confidence beside a reading it is unsure of, because an inspector has to
 * know whether to trust it before citing it; the person who filed the
 * application knows the address already, and a percentage beside it would
 * invite them to worry about a number that is about the scan.
 */
function Subject({ p }: { p: VerificationPackage }) {
  const { t } = useI18n();

  if (p.address !== null) {
    return (
      <span className='text-[0.9375rem] font-medium leading-snug text-foreground'>
        {p.address.value}
      </span>
    );
  }

  return (
    <span className='text-[0.9375rem] font-medium leading-snug text-foreground'>
      {t('mine.entry.untitled')}
    </span>
  );
}

function Entry({
  p,
  locale,
  onOpen,
}: {
  p: VerificationPackage;
  locale: Locale;
  onOpen: () => void;
}) {
  const { t } = useI18n();

  return (
    <li>
      <button
        onClick={onOpen}
        className='flex w-full flex-col gap-2.5 border-b border-rule px-4 py-4 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none md:px-6'
      >
        <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5'>
          <span className='flex min-w-0 flex-col gap-0.5'>
            <Subject p={p} />
            <span className='flex items-baseline gap-1.5 text-[0.75rem] text-muted-foreground'>
              <span data-mono title={p.id}>
                {packageRef(p.id)}
              </span>
              <span aria-hidden>·</span>
              <span className='tabular-nums'>
                {t('mine.entry.filed', {
                  date: formatDate(p.submittedAt, locale),
                })}
              </span>
            </span>
          </span>
          <StandingMark
            standing={p.standing}
            voice='applicant'
            className='shrink-0'
          />
        </div>

        <p className='max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t(APPLICANT_STANDING_NOTE[p.standing])}
        </p>

        {/* The outcome only once there is one, and only when it is news: a
            submission nothing has reported on has no result, and an outcome
            the standing above has already said in the applicant's own words is
            the same sentence twice (`drawsOutcome` — nothing here narrows by
            outcome, so the repetition is never the thing being looked for). */}
        {p.reportStatus !== null &&
          drawsOutcome(p.standing, p.reportStatus, false) && (
            <span className='flex'>
              <OutcomeMark
                tone={REPORT_TONE[p.reportStatus]}
                label={t(APPLICANT_REPORT_KEY[p.reportStatus])}
              />
            </span>
          )}
      </button>
    </li>
  );
}

function NothingFiled({ onFile }: { onFile: () => void }) {
  const { t } = useI18n();
  return (
    <Empty className='register-hatch flex-1 rounded-none border-0 border-t border-rule-strong px-6 py-24'>
      <EmptyMedia
        variant='icon'
        className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
      >
        <InboxIcon className='size-5' />
      </EmptyMedia>
      <EmptyHeader className='gap-1.5'>
        <EmptyTitle className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
          {t('mine.empty.title')}
        </EmptyTitle>
        <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
          {t('mine.empty.body')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onFile}>
          <FilePlus2Icon /> {t('mine.action.file')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function Unreachable({ onRetry }: { onRetry: () => void }) {
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
          {t('mine.error.title')}
        </EmptyTitle>
        <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
          {t('mine.error.body')}
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

export function MySubmissions() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  /*
   * Watch while anything on this page is still being read, and stop the moment
   * nothing is — the same rule the register keeps. A person who has just filed
   * something is watching this screen for exactly that.
   */
  const [polling, setPolling] = useState(true);
  const { currentData, data, isError, refetch } = useGetPackagesQuery(
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
    {
      pollingInterval: polling ? RUN_BEATS_MS : 0,
      skipPollingIfUnfocused: true,
    },
  );

  const answer = currentData ?? data;
  const rows = answer?.items ?? [];
  const shouldPoll = rows.some(p => p.stage !== undefined);
  if (shouldPoll !== polling) setPolling(shouldPoll);

  const waiting = answer === undefined;
  const pages = answer ? pageCount(answer.total, answer.limit) : 1;

  return (
    <SurfacePage>
      <HeaderActions>
        <span aria-hidden className='mx-0.5 h-6 w-px bg-rule-strong' />
        <Button onClick={() => navigate(paths.newSubmission)}>
          <FilePlus2Icon />{' '}
          <span className='hidden sm:inline'>{t('mine.action.file')}</span>
        </Button>
      </HeaderActions>

      <SurfaceHeading
        title={t('page.mine.title')}
        subtitle={t('page.mine.subtitle')}
      />

      <SurfaceBody>
        {isError && waiting ? (
          <Unreachable onRetry={() => void refetch()} />
        ) : waiting ? (
          <div
            aria-busy='true'
            aria-live='polite'
            className='flex-1 border-t border-rule-strong'
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className='flex flex-col gap-2 border-b border-rule px-4 py-5 md:px-6'
              >
                <Skeleton className='h-4 w-64' />
                <Skeleton className='h-3 w-40' />
                <Skeleton className='h-3 w-80' />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <NothingFiled onFile={() => navigate(paths.newSubmission)} />
        ) : (
          <ul className='flex flex-col border-t border-rule-strong'>
            {rows.map(p => (
              <Entry
                key={p.id}
                p={p}
                locale={locale}
                onOpen={() => navigate(paths.submission(p.id))}
              />
            ))}
          </ul>
        )}
      </SurfaceBody>

      {/* The footer is drawn on every state so the closing rule and the h-16
          bookend hold, and it carries a pager only when there is more than one
          page — nobody with three applications should be shown "1 / 1". */}
      <SurfaceFooter>
        {answer === undefined ? (
          <Skeleton className='h-3 w-32' />
        ) : (
          <>
            <p className='text-[0.8125rem] text-muted-foreground'>
              {t('mine.count', { n: answer.total })}
            </p>
            {pages > 1 && (
              <div className='flex items-center gap-1.5'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                >
                  {t('page.prev')}
                </Button>
                <span
                  data-mono
                  className='px-1 text-[0.8125rem] text-muted-foreground'
                >
                  {page} / {pages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= pages}
                  onClick={() =>
                    setPage(current => Math.min(pages, current + 1))
                  }
                >
                  {t('page.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </SurfaceFooter>
    </SurfacePage>
  );
}
