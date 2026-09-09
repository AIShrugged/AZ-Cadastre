/**
 * Case pre-check — where a packet becomes a case. Three steps and one screen:
 * add the packet, watch it being read, read what came of it.
 *
 * **One screen and not three pages**, because it is one act. The clerk at the
 * counter has the envelope in their hand for the whole of it, and a flow that
 * navigated away between "we are reading" and "here is what we read" would take
 * the packet off the screen at the moment the operator has to compare it with
 * the papers they are holding.
 *
 * **What the office declares is a source of its own.** Two figures are asked
 * for at the counter — what the claimed right is founded on, and what year the
 * building is said to date from — and neither is a reading: nothing has been
 * read yet when they are typed. They are optional, they never become a
 * correction to what the engine finds, and a packet taken in without them is
 * the packet this screen has always taken in.
 *
 * **The profile is suggested and never chosen.** The declaration is put to
 * `GET /profiles/suggestion` as it is filled in, and what comes back is drawn
 * as a recommendation with its reasoning beside the field each line is about.
 * It can be taken in one click; it never moves the operator's own choice, and
 * the screen will not start a pre-check under a profile nobody picked — a
 * default that happened to be right while one profile shipped would file cases
 * under the wrong one the day a second arrives.
 *
 * **The packet is not typed in.** The applicant, the address and the parcel are
 * read out of the documents themselves and shown with how well each was read;
 * a reading the engine was unsure of is marked for a second glance rather than
 * silently accepted. Nothing here writes a correction back — there is no
 * operation for it in the contract, so the screen never pretends a value can be
 * edited into the case.
 *
 * **The result is a recommendation and never a decision.** What the run found is
 * shown in the three groups the operator thinks in — the papers, the legal
 * ground, the archive — and the standing says what has to happen next. This
 * system reports evidence; the inspector decides.
 *
 * Document upload (dropzone, per-file transfer, validation) lives in the
 * `upload-documents` feature; this surface owns the profile choice, the run and
 * what is made of it.
 */
import {
  CheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  LibraryIcon,
  ScaleIcon,
  UploadCloudIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  BLANK_DECLARATION,
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  DIGITS_IN_A_YEAR,
  documentsExpected,
  groundFitsProfile,
  groundName,
  groundsOffered,
  ISSUE_KIND_KEY,
  needsAGlance,
  packageRef,
  PACKET_LINE_KEY,
  ProfileGlyph,
  profileName,
  readDeclaration,
  readDeclaredYear,
  readPacket,
  RegistryOutcomeMark,
  requiredTypes,
  STANDING_NOTE,
  StandingMark,
  suggestionLines,
  supportingSetsOf,
  toDeclaredInput,
  toSuggestionRequest,
  useCreatePackageMutation,
  useGetPackageQuery,
  useGetProfilesQuery,
  useSuggestProfileQuery,
  type DeclaredDraft,
  type ProfileDto,
} from '@/entities/verification-package';
import {
  ACCEPT,
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
import type {
  IssueKind,
  PackageDetailDto,
  ProfileSuggestionDto,
  SuggestionCriterion,
} from '@cadastre/api-contracts/verification';

// How often the screen re-asks while a run is under way. The same beat the
// register keeps, so a packet does not appear to be read at two speeds
// depending on which screen is open.
const RUN_BEATS_MS = 1500;

// How long the boxes have to stand still before the engine is asked what they
// point at. Long enough that a ground and a year typed one after the other are
// one question, short enough that the answer is there before the operator has
// looked away from the field they just filled.
const DECLARATION_SETTLES_MS = 400;

/**
 * A value as it stands once it has stopped changing.
 *
 * Everything downstream reads the settled value and never the live one — the
 * request, the reasons drawn under the fields and which declaration those
 * reasons are explained against — so a reason is never printed beside a figure
 * it was not answered about.
 */
function useSettled<T>(value: T, quiet: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), quiet);
    return () => clearTimeout(timer);
  }, [value, quiet]);

  return settled;
}

// ─── The three steps ────────────────────────────────────────────────────────
// Named for what happens and not for what the operator must do: only the first
// is theirs. Drawn at every phase, including the first, so the screen says what
// it is going to do before it does any of it.
const STEPS = ['intake.step.add', 'intake.step.read', 'intake.step.result'];

function Steps({ at }: { at: number }) {
  const { t } = useI18n();
  return (
    <ol className='flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-3 md:px-6'>
      {STEPS.map((step, index) => {
        const done = index < at;
        const now = index === at;
        return (
          <li key={step} className='flex items-center gap-2'>
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border text-[0.6875rem] font-medium tabular-nums',
                done && 'border-ok bg-ok/12 text-ok-ink',
                now && 'border-primary bg-primary text-primary-foreground',
                !done && !now && 'border-rule-strong text-muted-foreground',
              )}
            >
              {done ? <CheckIcon className='size-3' /> : index + 1}
            </span>
            <span
              className={cn(
                'text-[0.8125rem]',
                now ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {t(step)}
            </span>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className='ml-1 hidden h-px w-8 bg-rule sm:block'
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Profile picker ─────────────────────────────────────────────────────────
// A segmented radio-card selector — a tactile choice, not a dropdown. Which
// profiles exist is the engine's to say (`GET /api/profiles`), so nothing here
// names one.
function ProfilePicker({
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
      aria-label={t('intake.field.profile')}
      className='grid gap-3 sm:grid-cols-2'
    >
      {profiles.map(profile => {
        const selected = profile.key === value;
        // The required ones: an optional type the engine merely recognises is
        // not something the applicant is being asked for.
        const count = requiredTypes(profile).length;
        return (
          <button
            key={profile.key}
            type='button'
            role='radio'
            aria-checked={selected}
            onClick={() => onChange(profile.key)}
            className={cn(
              'group flex items-center gap-3 rounded-xl border p-3.5 text-left outline-none transition-all',
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
              <span className='block truncate text-[0.875rem] font-medium text-foreground'>
                {profileName(t, profile.key)}
              </span>
              <span className='block text-[0.75rem] text-muted-foreground'>
                {t('intake.profile.docs', { n: count })}
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

// ─── What the office declares at the counter ────────────────────────────────
// Two optional figures and a source of their own. Not a correction to anything
// the engine reads — nothing has been read when they are typed — and never a
// requirement: a packet declared about is the same packet, taken in the same
// way.
//
// The ground is chosen from what the profiles publish as grounds and is never
// free text: a basis nothing can be matched against could suggest no profile
// and could be held against no reading. Which grounds are offered narrows to
// the chosen profile once there is one, because that is what `POST /packages`
// accepts under it — before that it is every ground the catalogue names, or the
// suggestion would be useless at the only moment it helps.
const NOTHING_CHOSEN = '\u2014';

function DeclaredField({
  label,
  hint,
  reason,
  warning,
  children,
}: {
  label: string;
  hint: string;
  /** The suggestion's line for this field, once one has been answered. It
   *  replaces the hint rather than joining it: the hint says what the box is
   *  for, and by then the operator has filled it in. */
  reason: string | null;
  warning: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5'>
      <span className='text-[0.8125rem] font-medium text-foreground'>
        {label}
      </span>
      {children}
      <p
        className={cn(
          'text-[0.75rem] leading-snug',
          warning ? 'text-incomplete-ink' : 'text-muted-foreground',
        )}
      >
        {warning ?? reason ?? hint}
      </p>
    </div>
  );
}

function Declared({
  profiles,
  profileKey,
  draft,
  onChange,
  reasons,
}: {
  profiles: readonly ProfileDto[];
  profileKey: string | null;
  draft: DeclaredDraft;
  onChange: (draft: DeclaredDraft) => void;
  reasons: Partial<Record<SuggestionCriterion, string>>;
}) {
  const { t } = useI18n();
  const offered = groundsOffered(profiles, profileKey);
  const basis = draft.legalBasis;
  // A ground declared before a profile was picked, that the picked profile does
  // not register. It stays in the list and stays chosen — clearing what the
  // operator typed because they touched another control would lose a
  // declaration without saying so — and the line under the box says what has to
  // give before the packet can be taken in.
  const strayGround = basis !== null && !offered.includes(basis);
  const year = readDeclaredYear(draft.builtYear);

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1'>
        <span className='text-[0.8125rem] font-medium text-foreground'>
          {t('declared.title')}
        </span>
        <p className='text-[0.75rem] leading-snug text-muted-foreground'>
          {t('intake.declared.lead')}
        </p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <DeclaredField
          label={t('declared.basis')}
          hint={t('intake.declared.basis_hint')}
          reason={reasons.legalBasis ?? null}
          warning={
            strayGround && profileKey !== null
              ? t('intake.declared.basis_stray', {
                  ground: groundName(t, basis ?? ''),
                  profile: profileName(t, profileKey),
                })
              : null
          }
        >
          <Select
            value={basis ?? NOTHING_CHOSEN}
            onValueChange={value =>
              onChange({
                ...draft,
                legalBasis: value === NOTHING_CHOSEN ? null : value,
              })
            }
          >
            <SelectTrigger
              aria-label={t('declared.basis')}
              aria-invalid={strayGround && profileKey !== null}
              className='h-9 w-full bg-background text-[0.875rem]'
            >
              <span className='min-w-0 truncate'>
                {basis === null
                  ? t('declared.not_declared')
                  : groundName(t, basis)}
              </span>
            </SelectTrigger>
            <SelectContent align='start'>
              {/* Undeclaring is a choice the box has to offer: an operator who
                  picked a ground by mistake would otherwise have no way back to
                  declaring nothing, which is the state the form starts in. */}
              <SelectItem value={NOTHING_CHOSEN}>
                {t('declared.not_declared')}
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
        </DeclaredField>

        <DeclaredField
          label={t('declared.year')}
          hint={t('intake.declared.year_hint', {
            from: DECLARED_YEAR_EARLIEST,
            to: DECLARED_YEAR_LATEST,
          })}
          reason={reasons.builtYear ?? null}
          warning={
            year.state === 'unreadable'
              ? t('intake.declared.year_outside', {
                  from: DECLARED_YEAR_EARLIEST,
                  to: DECLARED_YEAR_LATEST,
                })
              : null
          }
        >
          <Input
            id='intake-built-year'
            inputMode='numeric'
            autoComplete='off'
            maxLength={DIGITS_IN_A_YEAR}
            aria-label={t('declared.year')}
            aria-invalid={year.state === 'unreadable'}
            value={draft.builtYear}
            placeholder={t('intake.declared.year_placeholder')}
            onChange={event =>
              onChange({ ...draft, builtYear: event.target.value })
            }
            className='h-9 border-input bg-background text-[0.875rem] tabular-nums'
          />
        </DeclaredField>
      </div>
    </div>
  );
}

// ─── What the declaration points at ─────────────────────────────────────────
// A recommendation with a button, and nothing that moves on its own. The
// profile stays the operator's choice: this offers to make it, once, on a
// click — and where the suggestion agrees with what they have already picked it
// says so instead of offering them the choice they have made.
//
// No profile is not an empty answer. It means the declaration points at none,
// or at more than one, or that nothing has been declared yet — and which of the
// three it is, is written under the field it is about.
function Suggestion({
  suggestion,
  asking,
  unavailable,
  picked,
  onTake,
}: {
  /** `null` while nothing has been declared — nothing has been asked, which is
   *  not the same as an answer naming no profile. Undefined while the answer to
   *  a question that *was* asked is still on its way. */
  suggestion: ProfileSuggestionDto | null | undefined;
  asking: boolean;
  unavailable: boolean;
  picked: string | null;
  onTake: (key: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-rule bg-muted/25 px-4 py-3'>
      <span className='register-label shrink-0 text-muted-foreground'>
        {t('intake.suggest.title')}
      </span>
      {suggestion === null ? (
        <span className='text-[0.8125rem] text-muted-foreground'>
          {t('intake.suggest.undeclared')}
        </span>
      ) : unavailable ? (
        // The suggestion is the one thing on this screen that may simply be
        // missing: it recommends, so a service that did not answer costs the
        // operator an explanation and nothing else.
        <span className='text-[0.8125rem] text-muted-foreground'>
          {t('intake.suggest.unavailable')}
        </span>
      ) : suggestion === undefined ? (
        <Skeleton className='h-5 w-40' />
      ) : suggestion.profileKey === null ? (
        <span className='text-[0.8125rem] text-muted-foreground'>
          {t('intake.suggest.none')}
        </span>
      ) : (
        <>
          <span className='text-[0.8125rem] font-medium text-foreground'>
            {profileName(t, suggestion.profileKey)}
          </span>
          {picked === suggestion.profileKey ? (
            <span className='flex items-center gap-1.5 text-[0.8125rem] text-ok-ink'>
              <CheckIcon className='size-3.5 shrink-0' />
              {t('intake.suggest.chosen')}
            </span>
          ) : (
            <Button
              variant='outline'
              size='sm'
              onClick={() => onTake(suggestion.profileKey ?? '')}
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
  );
}

// ─── A panel of the result ──────────────────────────────────────────────────
function Group({
  icon: Icon,
  title,
  lead,
  badge,
  children,
}: {
  icon: typeof FileTextIcon;
  title: string;
  lead?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className='rounded-xl border border-rule'>
      <header className='flex items-center gap-2.5 border-b border-rule bg-muted/25 px-4 py-2.5'>
        <Icon aria-hidden className='size-4 shrink-0 text-muted-foreground' />
        <h2 className='flex-1 text-[0.875rem] font-medium text-foreground'>
          {title}
        </h2>
        {badge}
      </header>
      <div className='flex flex-col gap-2.5 px-4 py-3.5'>
        {lead && (
          <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {lead}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

/** One kind of finding and how many of them, in the reader's language. Nothing
 *  here reads the English audit line the report carries for the record. */
function KindTally({
  detail,
  kinds,
}: {
  detail: PackageDetailDto;
  kinds: readonly IssueKind[];
}) {
  const { t } = useI18n();
  const found = kinds.flatMap(kind => {
    const n = (detail.report?.issues ?? []).filter(
      issue => issue.kind === kind,
    ).length;
    return n === 0 ? [] : [{ kind, n }];
  });

  if (found.length === 0) {
    return (
      <p className='flex items-center gap-2 text-[0.8125rem] text-ok-ink'>
        <CheckIcon className='size-3.5 shrink-0' />
        {t('intake.group.nothing')}
      </p>
    );
  }

  return (
    <ul className='flex flex-col gap-1.5'>
      {found.map(({ kind, n }) => (
        <li
          key={kind}
          className='flex items-baseline justify-between gap-4 text-[0.8125rem]'
        >
          <span className='min-w-0 text-foreground'>
            {t(ISSUE_KIND_KEY[kind])}
          </span>
          <span data-mono className='shrink-0 tabular-nums text-issues-ink'>
            {n}
          </span>
        </li>
      ))}
    </ul>
  );
}

// The papers themselves. Shortfalls in the envelope and doubts about how a
// sheet was read, which is what "documents" means to the person at the counter.
const DOCUMENT_KINDS: readonly IssueKind[] = [
  'MissingDocument',
  'UnreadableDocument',
  'MissingAttestation',
  'LowConfidence',
  'DuplicateDocument',
  'ExtraDocument',
];

// ─── Page ───────────────────────────────────────────────────────────────────
export function CaseIntake() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [createPackage, { isLoading: submitting }] = useCreatePackageMutation();

  const files = useAppSelector(selectDocuments);
  const total = useAppSelector(selectValidCount);
  const readyCount = useAppSelector(selectReadyCount);

  const { data: profiles = [] } = useGetProfilesQuery();
  // The operator's choice and nothing else. It used to fall back to the first
  // profile the server happened to list, which read as a choice nobody made:
  // while one profile ships that is invisible, and the day a second arrives it
  // files cases under a profile the operator believed they had not picked. The
  // engine refuses to guess for the same reason (`ProfilesApi.suggest`).
  const [profile, setProfile] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // What the office declares at the counter, as the boxes hold it.
  const [draft, setDraft] = useState<DeclaredDraft>(BLANK_DECLARATION);
  const declared = useMemo(() => readDeclaration(draft), [draft]);

  // The case this screen opened, once it exists. Held here rather than in the
  // address bar: a packet is taken in at the counter and the case has a page of
  // its own to be linked to afterwards.
  const [caseId, setCaseId] = useState<string | null>(null);

  // The declaration as the operator has left it, once they have left it. The
  // suggestion is cheap and creates nothing, so it is asked while they type —
  // but a call per keystroke would ask about half a year four times over and
  // draw a reason about `19` under a box that already says `1998`.
  const settled = useSettled(declared, DECLARATION_SETTLES_MS);
  const question = toSuggestionRequest(settled);
  const {
    data: suggestion,
    isFetching: asking,
    isError: unavailable,
  } = useSuggestProfileQuery(question ?? {}, { skip: question === null });

  // Said in the operator's language, and each line against the figure it is
  // about. The English `note` the answer carries is the audit line and is not
  // read here. Explained against the declaration the answer was asked with —
  // which is `settled` and not what is in the boxes this instant.
  const reasons = useMemo<Partial<Record<SuggestionCriterion, string>>>(() => {
    if (suggestion === undefined) return {};
    return Object.fromEntries(
      suggestionLines(t, suggestion, settled, profiles).map(line => [
        line.criterion,
        line.text,
      ]),
    );
  }, [t, suggestion, settled, profiles]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    return () => {
      dispatch(clearDocuments());
    };
  }, [dispatch]);

  // Watch the run while it is a run, and stop the beat the moment it is not:
  // the pipeline reads the packet once, and a screen that kept asking after it
  // finished would poll a settled case for as long as it is left open.
  // `pollingInterval` is re-read each render, so it is adjusted during render
  // from the answer just received — the same beat the register keeps.
  const [polling, setPolling] = useState(true);
  const { data: view } = useGetPackageQuery(caseId ?? '', {
    skip: caseId === null,
    pollingInterval: polling ? RUN_BEATS_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const running =
    view !== undefined &&
    (view.status === 'Pending' || view.status === 'Processing');
  const shouldPoll = caseId !== null && (view === undefined || running);
  if (shouldPoll !== polling) setPolling(shouldPoll);

  const readings = useMemo(
    () => (view === undefined ? [] : readPacket(view)),
    [view],
  );
  const sets = useMemo(() => supportingSetsOf(view?.report ?? null), [view]);

  const at = caseId === null ? 0 : view?.report ? 2 : 1;

  function openPicker() {
    inputRef.current?.click();
  }

  // A year the engine would refuse and a ground the chosen profile does not
  // register are both refusals this screen can see coming — the edge answers
  // 400 and `LEGAL_BASIS_NOT_IN_PROFILE` respectively, and an operator would
  // rather be told before the packet is sent. Neither is about the declaration
  // being empty: an untouched form blocks nothing.
  const declarable =
    readDeclaredYear(draft.builtYear).state !== 'unreadable' &&
    groundFitsProfile(profiles, profile, draft.legalBasis);

  const canStart =
    readyCount > 0 && !submitting && profile !== null && declarable;

  async function onStart() {
    if (!canStart || profile === null) return;
    const attached = attachedFiles(files);
    if (attached.length === 0) return;

    // Only what was actually declared travels, and a form nobody touched sends
    // no `declared` at all — the request this endpoint took before intake
    // asked anything.
    const stated = toDeclaredInput(declared);

    try {
      const pkg = await createPackage({
        profileKey: profile,
        files: attached,
        ...(stated && { declared: stated }),
      }).unwrap();
      setCaseId(pkg.id);
      dispatch(clearDocuments());
    } catch (error) {
      // The service names the rule it refused with a stable code; say which one
      // rather than "please try again", which tells the operator nothing they
      // can act on.
      const code = failureCode(error);
      const generic = t('intake.failed');
      toast.error(code ? translateOr(t, `error.${code}`, generic) : generic);
    }
  }

  function startOver() {
    setCaseId(null);
    setPolling(true);
    setProfile(null);
    setDraft(BLANK_DECLARATION);
    dispatch(clearDocuments());
  }

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes('Files');

  return (
    <SurfacePage
      onDragEnter={e => {
        if (caseId === null && hasFiles(e)) {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }
      }}
      onDragOver={e => {
        if (caseId === null && hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={e => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (caseId === null && e.dataTransfer.files.length)
          dispatch(enqueueDocuments(e.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        type='file'
        multiple
        accept={ACCEPT}
        className='sr-only'
        onChange={e => {
          if (e.target.files?.length)
            dispatch(enqueueDocuments(e.target.files));
          e.target.value = '';
        }}
      />

      <SurfaceHeading
        title={t('page.intake.title')}
        subtitle={t('page.intake.subtitle')}
      />

      <Steps at={at} />

      <SurfaceBody>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8'>
          {/* ── 1 · the packet ── the whole envelope through one dropzone: the
              engine reads and classifies every document, so there is no
              per-type mapping for a person to do by hand. */}
          {caseId === null ? (
            <>
              <div className='flex flex-col gap-2.5'>
                <span className='text-[0.8125rem] font-medium text-foreground'>
                  {t('intake.field.profile')}
                </span>
                <ProfilePicker
                  profiles={profiles}
                  value={profile}
                  onChange={setProfile}
                />
                {/* Said outright rather than left to a disabled button: the
                    screen is waiting on a choice, and which one is not
                    something an operator should have to infer. */}
                {profile === null && profiles.length > 0 && (
                  <p className='text-[0.75rem] leading-snug text-muted-foreground'>
                    {t('intake.profile.unchosen')}
                  </p>
                )}
              </div>

              <Declared
                profiles={profiles}
                profileKey={profile}
                draft={draft}
                onChange={setDraft}
                reasons={reasons}
              />

              <Suggestion
                suggestion={question === null ? null : suggestion}
                asking={asking}
                unavailable={unavailable}
                picked={profile}
                onTake={setProfile}
              />

              <Dropzone
                onBrowse={openPicker}
                className={
                  files.length === 0 ? 'min-h-[13rem] flex-1' : undefined
                }
              />
              <UploadedList />
            </>
          ) : (
            <>
              {/* ── 2 · what we read from the packet ── */}
              <Group
                icon={ClipboardListIcon}
                title={t('intake.read.title')}
                lead={t('intake.read.lead')}
                badge={
                  view === undefined || running ? (
                    <span className='text-[0.75rem] text-muted-foreground'>
                      {t('intake.read.filling')}
                    </span>
                  ) : undefined
                }
              >
                {view === undefined ? (
                  <Skeleton className='h-20 w-full' />
                ) : (
                  <dl className='grid gap-x-8 gap-y-3 sm:grid-cols-3'>
                    {readings.map(reading => (
                      <div
                        key={reading.line}
                        className='flex min-w-0 flex-col gap-0.5'
                      >
                        <dt className='register-label text-muted-foreground'>
                          {t(PACKET_LINE_KEY[reading.line])}
                        </dt>
                        <dd className='text-[0.8125rem] break-words text-foreground'>
                          {reading.field === null ? (
                            <span className='text-muted-foreground/70'>
                              {running
                                ? t('intake.read.reading')
                                : t('intake.read.unread')}
                            </span>
                          ) : (
                            <span data-mono>{reading.field.value}</span>
                          )}
                        </dd>
                        {needsAGlance(reading) && reading.field !== null && (
                          // Not an error and not a correction box: the engine is
                          // unsure, and the person with the papers in their hand
                          // is the one who can settle it — on the case sheet,
                          // beside the sheet it was read off.
                          <dd className='text-[0.6875rem] text-incomplete-ink'>
                            {t('intake.read.glance', {
                              p: Math.round(reading.field.confidence * 100),
                            })}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                )}
              </Group>

              {/* ── 3 · the recommendation, then what it rests on ── */}
              {view !== undefined && (
                <div className='flex flex-col gap-2 rounded-xl border border-rule-strong px-4 py-3.5'>
                  <span className='register-label text-muted-foreground'>
                    {t('intake.recommendation')}
                  </span>
                  <StandingMark standing={view.standing} />
                  <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
                    {t(STANDING_NOTE[view.standing])}
                  </p>
                </div>
              )}

              {view?.report && (
                <>
                  <Group
                    icon={FileTextIcon}
                    title={t('intake.group.documents')}
                    badge={
                      <span
                        data-mono
                        className='text-[0.75rem] tabular-nums text-muted-foreground'
                      >
                        {view.classifiedCount}/
                        {documentsExpected(profiles, view.profileKey) ??
                          view.documentsCount}
                      </span>
                    }
                  >
                    <KindTally detail={view} kinds={DOCUMENT_KINDS} />
                  </Group>

                  <Group
                    icon={ScaleIcon}
                    title={t('intake.group.legal')}
                    lead={t('supporting.lead')}
                  >
                    {sets.length === 0 ? (
                      <p className='text-[0.8125rem] text-muted-foreground'>
                        {t('intake.group.legal_none')}
                      </p>
                    ) : (
                      <ul className='flex flex-col gap-2'>
                        {sets.map((set, index) => (
                          <li
                            key={`${set.placed}-${index}`}
                            className='text-[0.8125rem] leading-relaxed'
                          >
                            <span className='text-foreground'>
                              {t('supporting.bring')}
                            </span>{' '}
                            <span
                              className={
                                set.placed
                                  ? 'text-muted-foreground'
                                  : 'text-incomplete-ink'
                              }
                            >
                              {t(
                                set.placed
                                  ? 'supporting.placed'
                                  : 'supporting.unplaced',
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Group>

                  <Group
                    icon={LibraryIcon}
                    title={t('intake.group.archive')}
                    badge={
                      <span
                        data-mono
                        className='text-[0.75rem] tabular-nums text-muted-foreground'
                      >
                        {view.registryChecks.length}
                      </span>
                    }
                  >
                    {view.registryChecks.length === 0 ? (
                      <p className='text-[0.8125rem] text-muted-foreground'>
                        {t('intake.group.archive_none')}
                      </p>
                    ) : (
                      <ul className='flex flex-col gap-2'>
                        {view.registryChecks.map(check => (
                          <li
                            key={check.key}
                            className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1'
                          >
                            <span className='min-w-0 text-[0.8125rem] text-foreground'>
                              {translateOr(t, `check.${check.key}`, check.key)}
                            </span>
                            <RegistryOutcomeMark outcome={check.outcome} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Group>
                </>
              )}
            </>
          )}
        </div>
      </SurfaceBody>

      <SurfaceFooter className='max-md:flex-col max-md:items-stretch max-md:gap-2'>
        <span className='text-[0.8125rem]'>
          {caseId === null ? (
            total === 0 ? (
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
            )
          ) : (
            <span className='text-muted-foreground'>
              {t('intake.saved')}{' '}
              <span data-mono title={caseId} className='text-foreground/80'>
                {packageRef(caseId)}
              </span>
            </span>
          )}
        </span>
        <div className='flex shrink-0 items-center gap-2 max-md:justify-end'>
          {caseId === null ? (
            <Button
              onClick={onStart}
              disabled={!canStart}
              aria-disabled={!canStart}
            >
              {submitting ? t('intake.starting') : t('intake.start')}
            </Button>
          ) : (
            <>
              <Button variant='outline' onClick={startOver}>
                {t('intake.another')}
              </Button>
              <Button onClick={() => navigate(paths.case(caseId))}>
                {t('intake.open_case')}
              </Button>
            </>
          )}
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
