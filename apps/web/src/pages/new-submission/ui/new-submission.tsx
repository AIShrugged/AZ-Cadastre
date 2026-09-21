/**
 * Filing a new submission — the applicant's counterpart of the office's case
 * pre-check.
 *
 * It sends the same `POST /packages` the counter sends, with the same three
 * things in it: which profile the application is filed under, what is declared
 * about the claim, and the files. What differs is who is being asked and in
 * what words — and that is the whole reason this is a second surface rather
 * than the intake screen with a role check inside it.
 *
 * **What the office's screen has that this one must not.** The pre-check shows
 * the run as it happens: what the engine read off each paper, how sure it was,
 * what the report made of it, which findings it raised. That is the office
 * reading its own machine, and an applicant who watched it would be reading
 * confidences about their own documents with no way to act on any of them. Here
 * the act ends when the application is filed, and the submission's own page is
 * where it is followed afterwards — which is also the page they will come back
 * to tomorrow.
 *
 * **The profile is chosen and never defaulted**, exactly as at the counter: the
 * engine refuses to guess which profile a declaration points at and so does
 * this screen. What it does instead is ask the same question the office asks —
 * what the claim is founded on, and what year the building dates from — and put
 * the answer to `GET /profiles/suggestion`, which comes back with a
 * recommendation the person can take in one click. It moves nothing on its own.
 *
 * **The declaration is optional here too.** A person who does not know what
 * their claim is founded on can still file: the boxes are how the suggestion
 * becomes possible, not a gate in front of the form.
 *
 * The documents themselves go through `upload-documents`, which is the one road
 * bytes take into the store on every surface that sends a file.
 */
import { CheckIcon, LightbulbIcon, UploadCloudIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  BLANK_DECLARATION,
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  DIGITS_IN_A_YEAR,
  groundFitsProfile,
  groundName,
  groundsOffered,
  ProfileGlyph,
  profileName,
  readDeclaration,
  readDeclaredYear,
  requiredTypes,
  toDeclaredInput,
  toSuggestionRequest,
  useCreatePackageMutation,
  useGetProfilesQuery,
  useSuggestProfileQuery,
  type DeclaredDraft,
  type ProfileDto,
} from '@/entities/verification-package';
import {
  attachedFiles,
  clearDocuments,
  Dropzone,
  enqueueDocuments,
  selectDocuments,
  selectReadyCount,
  selectValidCount,
  UploadedList,
} from '@/features/upload-documents';
import { failureCode } from '@/shared/api';
import { paths } from '@/shared/config';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { ACCEPT } from '@/shared/lib/document-file';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store-hooks';
import { Button } from '@/shared/ui/button';
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

// How long the boxes have to stand still before the engine is asked what they
// point at — the same pause the counter's screen keeps, and for the same
// reason: a ground and a year typed one after the other are one question.
const DECLARATION_SETTLES_MS = 400;

/** The select's own value for "nothing chosen", which is the state it starts in. */
const NOTHING_CHOSEN = '—';

function useSettled<T>(value: T, quiet: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), quiet);
    return () => clearTimeout(timer);
  }, [value, quiet]);

  return settled;
}

/** One numbered step of the form, so the page reads as a sequence rather than a
 *  wall of fields. */
function Step({
  n,
  title,
  lead,
  children,
}: {
  n: number;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-baseline gap-2.5'>
        <span
          aria-hidden
          data-mono
          className='grid size-5 shrink-0 translate-y-0.5 place-items-center rounded-full border border-rule-strong text-[0.6875rem] tabular-nums text-muted-foreground'
        >
          {n}
        </span>
        <div className='flex min-w-0 flex-col gap-0.5'>
          <h2 className='text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground'>
            {title}
          </h2>
          {lead && (
            <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
              {lead}
            </p>
          )}
        </div>
      </div>
      <div className='pl-0 sm:pl-[1.875rem]'>{children}</div>
    </section>
  );
}

/**
 * Which kind of application this is.
 *
 * The same radio cards the counter uses, because the choice is the same choice
 * and the engine publishes the list either way — what changes is the count
 * beneath each name, which here says how many papers the applicant is expected
 * to bring rather than how many the profile requires of a packet.
 */
function KindPicker({
  profiles,
  value,
  onChange,
}: {
  profiles: readonly ProfileDto[];
  value: string | null;
  onChange: (key: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div
      role='radiogroup'
      aria-label={t('mine.new.kind')}
      className={cn('grid gap-3', profiles.length > 1 && 'sm:grid-cols-2')}
    >
      {profiles.map(profile => {
        const selected = profile.key === value;
        return (
          <button
            key={profile.key}
            type='button'
            role='radio'
            aria-checked={selected}
            onClick={() => onChange(profile.key)}
            className={cn(
              'group flex w-full min-w-0 items-center gap-3 rounded-xl border p-3.5 text-left outline-none transition-all',
              'focus-visible:ring-2 focus-visible:ring-ring/50',
              selected
                ? 'border-primary bg-accent/50 shadow-[var(--shadow-sm)] ring-1 ring-primary'
                : 'border-input bg-card hover:border-rule-strong hover:bg-muted/40',
            )}
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg border transition-colors',
                selected
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-rule-strong bg-muted/40 text-muted-foreground',
              )}
            >
              <ProfileGlyph profileKey={profile.key} className='size-[18px]' />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block text-[0.875rem] leading-snug font-medium text-foreground'>
                {profileName(t, profile.key)}
              </span>
              <span className='block text-[0.75rem] text-muted-foreground'>
                {t('mine.new.kind_docs', { n: requiredTypes(profile).length })}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                'grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors',
                selected ? 'border-primary' : 'border-rule-strong',
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full bg-primary transition-transform duration-200',
                  selected ? 'scale-100' : 'scale-0',
                )}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function NewSubmission() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [createPackage, { isLoading: submitting }] = useCreatePackageMutation();

  const files = useAppSelector(selectDocuments);
  const total = useAppSelector(selectValidCount);
  const readyCount = useAppSelector(selectReadyCount);

  const { data: profiles = [] } = useGetProfilesQuery();
  const [profile, setProfile] = useState<string | null>(null);
  const [draft, setDraft] = useState<DeclaredDraft>(BLANK_DECLARATION);
  const [dragging, setDragging] = useState(false);

  const declared = useMemo(() => readDeclaration(draft), [draft]);
  const settled = useSettled(declared, DECLARATION_SETTLES_MS);
  const question = toSuggestionRequest(settled);
  const {
    data: suggestion,
    isFetching: asking,
    isError: unavailable,
  } = useSuggestProfileQuery(question ?? {}, { skip: question === null });

  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  // The queue belongs to the act and not to the session: files chosen and then
  // left behind must not turn up attached to something filed next week.
  useEffect(() => () => void dispatch(clearDocuments()), [dispatch]);

  const offered = groundsOffered(profiles, profile);
  const basis = draft.legalBasis;
  const strayGround = basis !== null && !offered.includes(basis);
  const year = readDeclaredYear(draft.builtYear);

  /*
   * Two refusals this screen can see coming — the edge answers 400 for a year
   * outside the range and `LEGAL_BASIS_NOT_IN_PROFILE` for a ground the chosen
   * kind does not register — and an applicant would very much rather be told
   * before the papers are sent. Neither is about the declaration being empty:
   * an untouched form blocks nothing.
   */
  const declarable =
    year.state !== 'unreadable' &&
    groundFitsProfile(profiles, profile, draft.legalBasis);
  const canFile =
    readyCount > 0 && !submitting && profile !== null && declarable;

  async function onFile() {
    if (!canFile || profile === null) return;
    const attached = attachedFiles(files);
    if (attached.length === 0) return;

    const stated = toDeclaredInput(declared);

    try {
      const pkg = await createPackage({
        profileKey: profile,
        files: attached,
        ...(stated && { declared: stated }),
      }).unwrap();
      dispatch(clearDocuments());
      // Straight to the submission's own page: what happens next is a run
      // nobody has to sit and watch, and that page is where they will look for
      // it tomorrow as well.
      navigate(paths.submission(pkg.id), { replace: true });
    } catch (error) {
      const code = failureCode(error);
      const generic = t('mine.new.failed');
      toast.error(code ? translateOr(t, `error.${code}`, generic) : generic);
    }
  }

  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes('Files');

  return (
    <SurfacePage
      onDragEnter={event => {
        if (hasFiles(event)) {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }
      }}
      onDragOver={event => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={event => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (event.dataTransfer.files.length)
          dispatch(enqueueDocuments(event.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        type='file'
        multiple
        accept={ACCEPT}
        className='sr-only'
        onChange={event => {
          if (event.target.files?.length)
            dispatch(enqueueDocuments(event.target.files));
          event.target.value = '';
        }}
      />

      <SurfaceHeading
        title={t('page.new_submission.title')}
        subtitle={t('page.new_submission.subtitle')}
      />

      <SurfaceBody>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:py-8'>
          <Step
            n={1}
            title={t('mine.new.claim')}
            lead={t('mine.new.claim_lead')}
          >
            <div className='grid items-start gap-4 sm:grid-cols-2'>
              <div className='flex min-w-0 flex-col gap-1.5'>
                <span className='text-[0.8125rem] font-medium text-foreground'>
                  {t('mine.new.basis')}
                </span>
                <Select
                  value={basis ?? NOTHING_CHOSEN}
                  onValueChange={value =>
                    setDraft(current => ({
                      ...current,
                      legalBasis: value === NOTHING_CHOSEN ? null : value,
                    }))
                  }
                >
                  <SelectTrigger
                    aria-label={t('mine.new.basis')}
                    aria-invalid={strayGround && profile !== null}
                    className='h-9 w-full bg-card text-[0.875rem] data-[size=default]:h-9'
                  >
                    <span className='min-w-0 truncate'>
                      {basis === null
                        ? t('mine.new.basis_none')
                        : groundName(t, basis)}
                    </span>
                  </SelectTrigger>
                  <SelectContent align='start'>
                    <SelectItem value={NOTHING_CHOSEN}>
                      {t('mine.new.basis_none')}
                    </SelectItem>
                    {(strayGround && basis !== null
                      ? [basis, ...offered]
                      : offered
                    ).map(ground => (
                      <SelectItem key={ground} value={ground}>
                        {groundName(t, ground)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {strayGround && profile !== null && (
                  <p className='text-[0.75rem] leading-snug text-incomplete-ink'>
                    {t('mine.new.basis_stray', {
                      ground: groundName(t, basis ?? ''),
                      kind: profileName(t, profile),
                    })}
                  </p>
                )}
              </div>

              <div className='flex min-w-0 flex-col gap-1.5'>
                <span className='text-[0.8125rem] font-medium text-foreground'>
                  {t('mine.new.year')}
                </span>
                <Input
                  inputMode='numeric'
                  autoComplete='off'
                  maxLength={DIGITS_IN_A_YEAR}
                  aria-label={t('mine.new.year')}
                  aria-invalid={year.state === 'unreadable'}
                  value={draft.builtYear}
                  placeholder={t('intake.declared.year_placeholder')}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      builtYear: event.target.value,
                    }))
                  }
                  className='h-9 border-input bg-card text-[0.875rem] tabular-nums'
                />
                <p
                  className={cn(
                    'text-[0.75rem] leading-snug',
                    year.state === 'unreadable'
                      ? 'text-incomplete-ink'
                      : 'text-muted-foreground',
                  )}
                >
                  {year.state === 'unreadable'
                    ? t('intake.declared.year_outside', {
                        from: DECLARED_YEAR_EARLIEST,
                        to: DECLARED_YEAR_LATEST,
                      })
                    : t('mine.new.year_hint')}
                </p>
              </div>
            </div>
          </Step>

          <Step n={2} title={t('mine.new.kind')} lead={t('mine.new.kind_lead')}>
            <div className='flex flex-col gap-3'>
              {profiles.length === 0 ? (
                <Skeleton className='h-[4.75rem] w-full' />
              ) : (
                <KindPicker
                  profiles={profiles}
                  value={profile}
                  onChange={setProfile}
                />
              )}

              {/* The recommendation, with a button and nothing that moves on its
                  own. Said as help and not as a verdict: whichever kind the
                  person picks is the one the application is filed under. */}
              <div className='flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-rule bg-muted/25 px-4 py-3'>
                <span className='flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-medium text-foreground'>
                  <LightbulbIcon
                    aria-hidden
                    className='size-3.5 text-muted-foreground'
                  />
                  {t('mine.new.suggest')}
                </span>
                {question === null ? (
                  <span className='text-[0.8125rem] text-muted-foreground'>
                    {t('mine.new.suggest_undeclared')}
                  </span>
                ) : unavailable ? (
                  <span className='text-[0.8125rem] text-muted-foreground'>
                    {t('intake.suggest.unavailable')}
                  </span>
                ) : suggestion === undefined ? (
                  <Skeleton className='h-5 w-40' />
                ) : suggestion.profileKey === null ? (
                  <span className='text-[0.8125rem] text-muted-foreground'>
                    {t('mine.new.suggest_none')}
                  </span>
                ) : (
                  <>
                    <span className='text-[0.8125rem] font-medium text-foreground'>
                      {profileName(t, suggestion.profileKey)}
                    </span>
                    {profile === suggestion.profileKey ? (
                      <span className='flex items-center gap-1.5 text-[0.8125rem] text-ok-ink'>
                        <CheckIcon className='size-3.5 shrink-0' />
                        {t('intake.suggest.chosen')}
                      </span>
                    ) : (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setProfile(suggestion.profileKey ?? null)
                        }
                      >
                        {t('intake.suggest.take')}
                      </Button>
                    )}
                  </>
                )}
                {asking && suggestion !== undefined && (
                  <span className='text-[0.75rem] text-muted-foreground'>
                    {t('intake.suggest.asking')}
                  </span>
                )}
              </div>
            </div>
          </Step>

          <Step
            n={3}
            title={t('mine.new.papers')}
            lead={t('mine.new.papers_lead')}
          >
            <div className='flex flex-col gap-4'>
              <Dropzone
                onBrowse={() => inputRef.current?.click()}
                className={files.length === 0 ? 'min-h-[12rem]' : undefined}
              />
              <UploadedList />
            </div>
          </Step>
        </div>
      </SurfaceBody>

      <SurfaceFooter className='max-md:flex-col max-md:items-stretch max-md:gap-2'>
        <span className='text-[0.8125rem]'>
          {total === 0 ? (
            <span className='text-muted-foreground'>
              {t('upload.files.none')}
            </span>
          ) : (
            <>
              <span data-mono className='tabular-nums text-foreground/80'>
                {readyCount < total ? `${readyCount}/${total}` : total}
              </span>{' '}
              <span className='text-muted-foreground'>
                {readyCount < total
                  ? t('upload.files.uploading_label')
                  : t('upload.files.all_label')}
              </span>
            </>
          )}
        </span>
        <div className='flex shrink-0 items-center gap-2 max-md:justify-end'>
          <Button
            onClick={() => void onFile()}
            disabled={!canFile}
            aria-disabled={!canFile}
          >
            {submitting ? t('mine.new.filing') : t('mine.new.file')}
          </Button>
        </div>
      </SurfaceFooter>

      {dragging && (
        <div className='pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/8 p-6 backdrop-blur-[1px]'>
          <div className='flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/70 bg-background/80 px-10 py-8 text-primary'>
            <UploadCloudIcon className='size-7' />
            <span className='text-[0.9375rem] font-medium'>
              {t('upload.drop_overlay')}
            </span>
          </div>
        </div>
      )}
    </SurfacePage>
  );
}
