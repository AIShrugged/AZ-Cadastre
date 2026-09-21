/**
 * One submission, as the person who filed it reads it.
 *
 * Three questions and nothing else: where it stands, whether anything is wanted
 * from them, and how to send that in. The office's case sheet answers a
 * different set — what was read off which sheet, how sure the engine was, which
 * provision of Article 8 the case falls under, whether the archive agrees — and
 * every one of those is the office reading its own machine. An applicant given
 * the same page would be handed a confidence figure about their own title deed
 * and nothing to do about it.
 *
 * **Reading it is what makes it theirs.** `GET /packages/:id` is scoped by the
 * session, and somebody else's submission comes back **404 and never 403**: a
 * 403 on a case that exists tells a stranger it exists (ADR-0029). So the
 * missing state here is one state — "no such application of yours" — and it is
 * written to be true of both.
 *
 * **The gaps panel is the office's own**, mounted in the applicant's voice
 * (`features/supply-document`). The list of what a package will take is the
 * server's answer and the supply operation accepts exactly what it names; a
 * second copy of it written for this page would, sooner or later, offer an
 * upload the service declines and hide one it would have taken.
 */
import { ArrowLeftIcon, FileQuestionIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  APPLICANT_REPORT_KEY,
  APPLICANT_STANDING_NOTE,
  drawsOutcome,
  OutcomeMark,
  packageRef,
  REPORT_TONE,
  StandingMark,
  useGetPackageQuery,
  useGetProfilesQuery,
} from '@/entities/verification-package';
import { DocumentGaps } from '@/features/supply-document';
import { paths } from '@/shared/config';
import { formatDate, useI18n } from '@/shared/i18n';
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
import { SurfaceBody, SurfaceHeading, SurfacePage } from '@/shared/ui/surface';

/** The beat the rest of the product watches a run at. */
const RUN_BEATS_MS = 1500;

function NoSuchSubmission({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <Empty className='register-hatch flex-1 rounded-none border-0 px-6 py-24'>
      <EmptyMedia
        variant='icon'
        className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
      >
        <FileQuestionIcon className='size-5' />
      </EmptyMedia>
      <EmptyHeader className='gap-1.5'>
        <EmptyTitle className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
          {t('mine.missing.title')}
        </EmptyTitle>
        <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
          {t('mine.missing.body')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant='outline' onClick={onBack}>
          <ArrowLeftIcon /> {t('mine.missing.back')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function MySubmission() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();

  /*
   * Watched while the run is a run and still the moment it is not. An applicant
   * who has just filed is looking at this screen for exactly that, and one who
   * opened a settled application should not have it polled for as long as the
   * tab stays open.
   */
  const [polling, setPolling] = useState(true);
  const { data: pkg, isError } = useGetPackageQuery(id, {
    skip: id === '',
    pollingInterval: polling ? RUN_BEATS_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const { data: profiles = [] } = useGetProfilesQuery();

  const running =
    pkg !== undefined &&
    (pkg.status === 'Pending' || pkg.status === 'Processing');
  const shouldPoll = pkg === undefined || running;
  if (shouldPoll !== polling) setPolling(shouldPoll);

  if (isError) {
    return (
      <SurfacePage>
        <SurfaceBody>
          <NoSuchSubmission onBack={() => navigate(paths.cabinet)} />
        </SurfaceBody>
      </SurfacePage>
    );
  }

  const subject =
    pkg?.propertyAddress?.value ?? (pkg ? t('mine.entry.untitled') : undefined);

  return (
    <SurfacePage>
      <SurfaceHeading
        title={subject ?? <Skeleton className='h-6 w-72' />}
        subtitle={
          pkg ? (
            <span className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
              <span data-mono title={pkg.id}>
                {packageRef(pkg.id)}
              </span>
              <span aria-hidden>·</span>
              <span className='tabular-nums'>
                {t('mine.entry.filed', {
                  date: formatDate(pkg.createdAt, locale),
                })}
              </span>
            </span>
          ) : undefined
        }
        actions={
          <Button variant='outline' onClick={() => navigate(paths.cabinet)}>
            <ArrowLeftIcon /> {t('mine.missing.back')}
          </Button>
        }
      />

      <SurfaceBody>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6 md:py-8'>
          {/* ── Where it stands ── the whole of the news, in one panel, in the
              words a person who is waiting for an answer reads. */}
          <section className='flex flex-col gap-2.5 rounded-xl border border-rule-strong px-5 py-4'>
            <span className='register-label'>{t('mine.one.standing')}</span>
            {pkg === undefined ? (
              <>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-3 w-full max-w-md' />
              </>
            ) : (
              <>
                <StandingMark standing={pkg.standing} voice='applicant' />
                <p className='max-w-[70ch] text-[0.875rem] leading-relaxed text-muted-foreground'>
                  {t(APPLICANT_STANDING_NOTE[pkg.standing])}
                </p>
                {/* Only where it says something the standing above has not —
                    the same judgement the office's register makes about its own
                    two words (`drawsOutcome`). */}
                {pkg.reportStatus !== null &&
                  drawsOutcome(pkg.standing, pkg.reportStatus, false) && (
                    <span className='flex'>
                      <OutcomeMark
                        tone={REPORT_TONE[pkg.reportStatus]}
                        label={t(APPLICANT_REPORT_KEY[pkg.reportStatus])}
                      />
                    </span>
                  )}
              </>
            )}
          </section>

          {/* ── What is still wanted, and how to send it ── the office's own
              published list of what this submission will take. */}
          {pkg === undefined ? (
            <Skeleton className='h-32 w-full' />
          ) : (
            <DocumentGaps pkg={pkg} profiles={profiles} voice='applicant' />
          )}

          <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {t('mine.one.footnote')}
          </p>
        </div>
      </SurfaceBody>
    </SurfacePage>
  );
}
