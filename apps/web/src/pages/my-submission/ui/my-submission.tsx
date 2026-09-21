/**
 * One submission, as the person who filed it reads it.
 *
 * The office's case sheet and this one answer the same case and not the same
 * questions. The inspector's names which sheet a value was read off, how sure
 * the engine was of it, which provision of Article 8 the case falls under and
 * what each check weighed against what — the office reading its own machine.
 * This one answers what the person waiting actually asked: *how far has it
 * got, what did my papers turn out to say, which of them are in,* and the one
 * thing they can act on — what is still wanted, and how to send it.
 *
 * It used to answer only the last of those. The standing, then the gaps, then
 * nothing: a submission with nine of eleven papers in and every reading agreed
 * looked exactly like one with nothing in it but two demands, because only the
 * demands were drawn. What the run had already settled was invisible, and the
 * page read as a list of complaints rather than as a report (COMM-115). The
 * digest is that missing half — the same rows the inspector's rail draws, in
 * the applicant's words and without the office's figures (`submission-digest`).
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
 *
 * **But it is not shown until the run has placed the papers.** A gap of reason
 * `MissingDocument` is "a required type no document in force answers", and at
 * the start of a run no document answers anything — nothing has been
 * classified — so the server correctly publishes every required paper as
 * missing and the panel correctly headed them «Нет в комплекте». To the office
 * that reads as a stage that has not run; to the person who uploaded those very
 * papers ten seconds ago it reads as an accusation, and it is wrong by the time
 * the run finishes. Worse on a re-run after a supply: the paper they have just
 * sent is the unclassified one. So the shortfall is drawn only once
 * `isClassified` says the run has been through the package — and nothing is
 * lost by waiting, because `takesFiles` is false for the whole of a run and the
 * panel could not have taken a file anyway. The office keeps seeing it
 * throughout; the difference is which reader is being told, not which fact.
 */
import { ArrowLeftIcon, FileQuestionIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  isClassified,
  packageRef,
  stageStatuses,
  toViewPackage,
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

import { SubmissionDigest } from './submission-digest';

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

  /*
   * Whether a paper's absence is a shortfall yet — decided once here and read
   * by both blocks below, so the sheet and the panel can never disagree about
   * whether the package is short of anything.
   */
  const shortfallKnown =
    pkg !== undefined &&
    isClassified(stageStatuses(pkg, toViewPackage(pkg).disposition));

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
          {pkg === undefined ? (
            <Skeleton className='h-80 w-full rounded-xl' />
          ) : (
            <>
              {/* ── The case, short ── where it stands, how far the run got,
                  what the papers turned out to say, and which of them are in.
                  Everything the run has already settled, which is the half the
                  gaps panel below cannot show. */}
              <SubmissionDigest
                pkg={pkg}
                profiles={profiles}
                shortfallKnown={shortfallKnown}
              />

              {/* ── What is still wanted, and how to send it ── the office's own
                  published list of what this submission will take, once the run
                  has read the package well enough for the list to be true. */}
              {shortfallKnown && (
                <DocumentGaps pkg={pkg} profiles={profiles} voice='applicant' />
              )}
            </>
          )}

          <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {t('mine.one.footnote')}
          </p>
        </div>
      </SurfaceBody>
    </SurfacePage>
  );
}
