/**
 * What this package will take a document for — one row per gap the server
 * published, each with the «Загрузить» that answers it.
 *
 * The list is the server's whole answer and this panel draws it and decides
 * none of it (COMM-80). That is not fastidiousness: the supply operation accepts
 * exactly what this list names, so a panel that worked out its own rows would
 * sooner or later offer an upload the service declines and hide one it would
 * have taken.
 *
 * The three reasons are not three labels on one row. They are three different
 * things to do, and the row reads as the one it is:
 *
 *  - **A paper nobody sent.** Bring the missing one. There is nothing here to
 *    look at, so there is nothing to link to.
 *  - **A scan that could not be read.** Photograph the same paper again — and
 *    the row says *what* went unread or came back doubtful, because "bad scan"
 *    on its own has an operator rephotographing at random. The document it is
 *    about is one click away, since the fastest way to see what is wrong with a
 *    scan is to look at it.
 *  - **A paper the profile takes at any time.** Not a shortfall at all: the
 *    receipt for the state duty is published on a package with nothing wrong
 *    with it, so it is drawn quietly and never in the colour of a finding.
 *
 * And a row never goes blank on the operator. A file already sent for a gap says
 * it is being read; one the run refused says what was expected and what turned
 * up; and while the package is mid-run the whole panel says the package takes no
 * files rather than offering buttons that would be declined.
 *
 * Three things to do are three weights on the page, and not three colours of the
 * same row. Read down, the panel says *what is missing* before *what was read
 * badly* before *what may be sent whenever* — the papers nobody sent lead in the
 * heaviest heading, the widest rows and the strongest rule, and the ones the
 * profile takes at any time are set in the quiet label of a section marker with
 * a ghost button beside them, because nothing is wrong there. Drawn at one
 * weight, as they were, an inspector had to read all three groups to find out
 * which of them was the finding.
 *
 * The same drop happens inside «not in the package»: the papers the profile
 * insists on are set in the body weight and the alternatives under the fold a
 * step below it, so the two are told apart by how they are drawn and not only by
 * which side of the fold they fell on.
 *
 * None of this re-reads the list. The order is the contract's, the rows are the
 * contract's, and the count beside the first heading is the server's own gaps
 * read a second way (`requiredShortfall`) — the panel decides how loudly to say
 * what it was given, and nothing about what it was given.
 *
 * What each reason means is said behind the ⓘ beside it rather than above every
 * group: it is the same sentence on every case, and the names of the papers are
 * what an operator scans this list for.
 *
 * **Two readers, one panel.** The applicant's cabinet shows the same list for
 * the same reason the office does — it is the server's answer to "what will
 * this package take", and a second copy of it would sooner or later offer an
 * upload the service declines. What changes with `voice` is the reading under a
 * bad scan: the office is told which fields went unread and at what confidence,
 * because that is how an inspector decides whether to re-photograph or to
 * accept, and it is a link to the sheet itself. An applicant has no sheet to
 * open and no floor to weigh a figure against — the whole of their move is to
 * send a clearer copy, which the row already says. So the fault detail is the
 * office's and the row is everybody's.
 */
import {
  ChevronRightIcon,
  CircleDashedIcon,
  PlusCircleIcon,
  ScanLineIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { ComponentProps } from 'react';

import {
  documentIn,
  fieldsAsked,
  GAP_REASON_KEY,
  GAP_REASON_NOTE,
  GAP_REASON_TONE,
  gapKey,
  namesAFault,
  requiredShortfall,
  requiredTypes,
  scanShortfall,
  takesFiles,
  type GapTone,
} from '@/entities/verification-package';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Jump } from '@/shared/lib/jump';
import { InfoHint } from '@/shared/ui/info-hint';
import type {
  DocumentGapDto,
  DocumentGapReason,
  PackageDetailDto,
  ProfileDto,
} from '@cadastre/api-contracts/verification';
import { CONFIDENCE_FLOOR } from '@cadastre/api-contracts/verification';

import { supplyStateFor, type SuppliedFile } from '../model/supply-state';

import { SupplyButton } from './supply-button';

/**
 * Who the panel is talking to. Not a theme: it decides what is said, and the
 * difference is one paragraph per unreadable scan.
 */
export type GapVoice = 'office' | 'applicant';

const REASON_ICON: Record<DocumentGapReason, typeof ScanLineIcon> = {
  MissingDocument: TriangleAlertIcon,
  UnusableScan: ScanLineIcon,
  AlwaysAccepted: PlusCircleIcon,
};

// A shortfall is drawn as one; a paper the profile simply accepts is not. The
// quiet third tone is the whole point of publishing three reasons — and the
// difference between them is size, weight and rule as much as ink, so the order
// survives a grayscale print and a reader who does not see the three hues apart
// (the Status-Never-Alone rule: every one of these tints travels with its word).
const TONE_HEADING: Record<GapTone, string> = {
  short:
    'gap-2 text-[0.875rem] font-semibold tracking-[-0.01em] text-incomplete-ink',
  doubt: 'gap-1.5 text-[0.8125rem] font-medium text-issues-ink',
  offer:
    'gap-1.5 text-[0.6875rem] font-medium tracking-[0.09em] uppercase text-muted-foreground',
};

/** The reason's glyph: a filled mark for the papers that are missing, the bare
 *  line icon for the other two. */
const TONE_MARK: Record<GapTone, string> = {
  short: 'size-[1.125rem] rounded-full bg-incomplete/12',
  doubt: 'size-3.5',
  offer: 'size-3',
};

const TONE_GLYPH: Record<GapTone, string> = {
  short: 'size-[0.6875rem]',
  doubt: 'size-3.5',
  offer: 'size-3',
};

const TONE_STROKE: Record<GapTone, number> = {
  short: 2.75,
  doubt: 2,
  offer: 2,
};

/** The structural rule above and below the group — heavier under the papers the
 *  package is short of, the hairline everywhere else. */
const TONE_RULE: Record<GapTone, string> = {
  short: 'border-rule-strong',
  doubt: 'border-rule',
  offer: 'border-rule',
};

/** A little more air above the group that is not a finding, so the eye reads a
 *  break between the shortfalls and the offer. */
const TONE_SECTION: Record<GapTone, string> = {
  short: '',
  doubt: '',
  offer: 'pt-1',
};

/** How a row under this reason is set, before the fold demotes it further. */
const TONE_WEIGHT: Record<GapTone, GapWeight> = {
  short: 'lead',
  doubt: 'plain',
  offer: 'quiet',
};

/**
 * How much of the page one row takes.
 *
 * `lead` is a paper the profile insists on and nobody sent: the widest row, its
 * name in the body weight. `plain` is a scan worth sending again. `quiet` is
 * everything that is not a shortfall — an alternative title under the fold, or a
 * paper accepted at any time — set a step down and answered by a ghost button,
 * so it reads as something offered rather than something owed.
 */
type GapWeight = 'lead' | 'plain' | 'quiet';

const WEIGHT_ROW: Record<GapWeight, string> = {
  lead: 'py-3',
  plain: 'py-2.5',
  quiet: 'py-2',
};

const WEIGHT_TITLE: Record<GapWeight, string> = {
  lead: 'text-[0.875rem] font-medium tracking-[-0.01em] text-foreground',
  plain: 'text-[0.875rem] text-foreground',
  quiet: 'text-[0.8125rem] text-foreground/80',
};

export function DocumentGaps({
  pkg,
  profiles,
  onJump,
  voice = 'office',
}: {
  pkg: PackageDetailDto;
  /** The engine's own copy of the policy, so a bad scan can be told which fields
   *  it was asked for. Empty while it loads, and then a row says the scan is
   *  worth sending again without pretending to know why. */
  profiles: readonly ProfileDto[];
  /** How the case sheet gets to the scan a row is about. Absent where there is
   *  no sheet to get to — the cabinet has the gaps but not the documents. */
  onJump?: Jump;
  voice?: GapVoice;
}) {
  const { t } = useI18n();
  // The contract's answer to "will this package take a file at all", not a list
  // of states kept here.
  const accepting = takesFiles(pkg.status);

  if (pkg.gaps.length === 0) {
    return (
      <section id='document-gaps' className='scroll-mt-16'>
        <GapsHeading />
        <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t('gap.none')}
        </p>
      </section>
    );
  }

  const profile = profiles.find(candidate => candidate.key === pkg.profileKey);
  // In the profile's own order, because the count of what is still owed is read
  // off it and the order is the one the case sheet lists them in.
  const required = profile ? requiredTypes(profile) : [];

  return (
    <section id='document-gaps' className='scroll-mt-16'>
      <GapsHeading count={pkg.gaps.length} hint={accepting} />
      {!accepting && (
        <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t('gap.closed_running')}
        </p>
      )}

      <div className='mt-4 flex flex-col gap-5'>
        {groupsOf(pkg.gaps).map(group => (
          <ReasonGroup
            key={group.reason}
            reason={group.reason}
            gaps={group.gaps}
            required={required}
            pkg={pkg}
            profiles={profiles}
            accepting={accepting}
            onJump={onJump}
            voice={voice}
          />
        ))}
      </div>
    </section>
  );
}

function GapsHeading({
  count,
  hint = false,
}: {
  count?: number;
  hint?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className='flex flex-wrap items-center gap-x-1.5 gap-y-1'>
      <h2 className='text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground'>
        {t('gap.title')}
      </h2>
      {count !== undefined && (
        <span className='rounded-full bg-muted px-1.5 py-px text-[0.6875rem] font-medium tabular-nums text-muted-foreground'>
          {count}
        </span>
      )}
      {hint && (
        <InfoHint label={t('common.more_info')}>{t('gap.note')}</InfoHint>
      )}
    </div>
  );
}

/**
 * The gaps under one reason, with the reason named once above them.
 *
 * The order is the contract's own — the papers that are not here, then the ones
 * read badly, then what the profile takes at any time — so the groups fall out of
 * the list rather than being sorted here.
 *
 * **The papers the profile insists on lead; the rest fold.** They also lead in
 * how they are set — body weight against the step below it — so the fold is not
 * the only thing telling the two apart. A `MissingDocument`
 * gap is published for every paper that would close a requirement — each title
 * a provision could rest on among them — so a house whose provision is still
 * open is offered sixteen titles beside the two papers the profile requires.
 * Listed flat, the two were lost in the sixteen. The fold changes what is seen
 * first and nothing else: every row is still here, one click away. Until the
 * profile has loaded, which papers are required is unknown, and nothing folds.
 */
function ReasonGroup({
  reason,
  gaps,
  required,
  pkg,
  profiles,
  accepting,
  onJump,
  voice,
}: {
  reason: DocumentGapReason;
  gaps: readonly DocumentGapDto[];
  /** The papers this profile insists on, in its own order. Empty until the
   *  profiles have loaded, and then nothing is claimed about which lead. */
  required: readonly string[];
  pkg: PackageDetailDto;
  profiles: readonly ProfileDto[];
  accepting: boolean;
  onJump?: Jump;
  voice: GapVoice;
}) {
  const { t } = useI18n();
  const tone = GAP_REASON_TONE[reason];
  const Icon = REASON_ICON[reason];
  const insisted = new Set(required);

  const leading =
    reason === 'MissingDocument' && insisted.size > 0
      ? gaps.filter(gap => insisted.has(gap.expectedType))
      : [];
  // A group with no required paper in it is not folded away whole.
  const shown = leading.length > 0 ? leading : gaps;
  const folded =
    leading.length > 0
      ? gaps.filter(gap => !insisted.has(gap.expectedType))
      : [];
  // How many of the papers the profile insists on are not here — said once, in
  // the heading, rather than as a tag on every row. It is the published gaps
  // counted, not a completeness rule worked out a second time here: a
  // requirement several papers answer publishes a gap for each of them, and
  // `requiredShortfall` is what keeps that from reading as sixteen.
  const owed =
    reason === 'MissingDocument' ? requiredShortfall(required, gaps).length : 0;

  const row = (gap: DocumentGapDto, weight: GapWeight) => (
    <GapRow
      key={gapKey(gap)}
      gap={gap}
      weight={weight}
      pkg={pkg}
      profiles={profiles}
      accepting={accepting}
      onJump={onJump}
      voice={voice}
    />
  );

  return (
    <section className={TONE_SECTION[tone]}>
      <div className='flex flex-wrap items-center gap-x-1 gap-y-1'>
        <span className={cn('inline-flex items-center', TONE_HEADING[tone])}>
          <span
            aria-hidden
            className={cn('grid shrink-0 place-items-center', TONE_MARK[tone])}
          >
            <Icon
              className={TONE_GLYPH[tone]}
              strokeWidth={TONE_STROKE[tone]}
            />
          </span>
          {t(GAP_REASON_KEY[reason])}
        </span>
        {owed > 0 && (
          <span className='rounded-full bg-incomplete/12 px-1.5 py-px text-[0.6875rem] font-medium tabular-nums text-incomplete-ink'>
            {t('gap.required_count', { n: owed })}
          </span>
        )}
        <InfoHint label={t('common.more_info')}>
          <span>{t(GAP_REASON_NOTE[reason])}</span>
          {reason === 'UnusableScan' && voice === 'office' && (
            <span className='opacity-80'>
              {t('gap.floor', { floor: Math.round(CONFIDENCE_FLOOR * 100) })}
            </span>
          )}
        </InfoHint>
      </div>

      <ul
        className={cn('mt-1.5 divide-y divide-rule border-y', TONE_RULE[tone])}
      >
        {shown.map(gap => row(gap, TONE_WEIGHT[tone]))}
      </ul>

      {folded.length > 0 && (
        <details className='group'>
          <summary className='flex cursor-pointer list-none select-none items-center gap-2 border-b border-rule py-2.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
            <ChevronRightIcon
              aria-hidden
              className='size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90'
            />
            {t('gap.more', { n: folded.length })}
          </summary>
          <ul className='divide-y divide-rule border-b border-rule'>
            {folded.map(gap => row(gap, 'quiet'))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** The gaps in the order they arrived, run together by reason. Never sorted:
 *  the contract states the order, and re-deciding it here is how a screen ends
 *  up disagreeing with the list it is drawing. */
function groupsOf(
  gaps: readonly DocumentGapDto[],
): { reason: DocumentGapReason; gaps: DocumentGapDto[] }[] {
  const groups: { reason: DocumentGapReason; gaps: DocumentGapDto[] }[] = [];

  for (const gap of gaps) {
    const open = groups.at(-1);
    if (open?.reason === gap.reason) open.gaps.push(gap);
    else groups.push({ reason: gap.reason, gaps: [gap] });
  }

  return groups;
}

function GapRow({
  gap,
  weight,
  pkg,
  profiles,
  accepting,
  onJump,
  voice,
}: {
  gap: DocumentGapDto;
  /** What this row is worth against the ones around it. Never read off the gap
   *  here — the group that drew it knows which of the three it is. */
  weight: GapWeight;
  pkg: PackageDetailDto;
  profiles: readonly ProfileDto[];
  accepting: boolean;
  onJump?: Jump;
  voice: GapVoice;
}) {
  const { t } = useI18n();
  const state = supplyStateFor(pkg, gap);
  const type = translateOr(t, `doctype.${gap.expectedType}`, gap.expectedType);

  return (
    <li
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-6 gap-y-2',
        WEIGHT_ROW[weight],
      )}
    >
      <div className='min-w-0 flex-1 pt-1'>
        {/* The name of the paper is the whole of the row's heading: what kind of
            gap it is, and what to do about it, the group above already said. */}
        <h3 className={cn('leading-snug', WEIGHT_TITLE[weight])}>{type}</h3>

        {gap.reason === 'UnusableScan' &&
          (voice === 'office' && onJump !== undefined ? (
            <ScanFault
              gap={gap}
              pkg={pkg}
              profiles={profiles}
              onJump={onJump}
            />
          ) : (
            /* All the applicant can do about a scan the engine could not read
               is send a better one, and that is the whole of the instruction —
               which fields came back faint is a measurement of our own OCR. */
            <p className='mt-2 max-w-[60ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
              {t('gap.unusable_plain')}
            </p>
          ))}

        {state.reading.map(file => (
          <Note
            key={file.fileId}
            tone='pending'
            icon={
              <CircleDashedIcon className='size-3 motion-safe:animate-spin' />
            }
          >
            {t('gap.reading', { file: file.filename })}
          </Note>
        ))}

        {state.refused.map(file => (
          <RefusedNote key={file.fileId} file={file} expected={type} />
        ))}
      </div>

      <SupplyButton
        packageId={pkg.id}
        gap={gap}
        accepting={accepting}
        quiet={weight === 'quiet'}
      />
    </li>
  );
}

/**
 * What is wrong with the scan, in the terms the operator has to fix it in.
 *
 * Three separate lines because they are three separate faults: a value the
 * paper never yielded, a value read too faintly to rely on, and a placement the
 * classifier itself was unsure of. Where the screen's copy of the policy is
 * behind the engine's there is nothing to name, and the row says only that the
 * scan is worth sending again — which is still true, and still the server's word.
 */
function ScanFault({
  gap,
  pkg,
  profiles,
  onJump,
}: {
  gap: DocumentGapDto;
  pkg: PackageDetailDto;
  profiles: readonly ProfileDto[];
  onJump: Jump;
}) {
  const { t } = useI18n();
  const found = documentIn(pkg.files, gap.documentId);
  if (!found) return null;

  const shortfall = scanShortfall(
    found.document,
    fieldsAsked(profiles, pkg.profileKey, gap.expectedType),
  );
  const fieldName = (key: string) => translateOr(t, `field.${key}`, key);
  const anchor = `#doc-${found.document.id}`;

  return (
    <div className='mt-2 rounded-lg border border-rule bg-muted/25 px-3 py-2.5'>
      {namesAFault(shortfall) ? (
        <ul className='flex flex-col gap-1 text-[0.8125rem] leading-relaxed text-foreground/80'>
          {shortfall.unread.length > 0 && (
            <li>
              <span className='text-muted-foreground'>
                {t('gap.unread_fields')}{' '}
              </span>
              <span className='text-foreground'>
                {shortfall.unread.map(fieldName).join(', ')}
              </span>
            </li>
          )}
          {shortfall.doubted.length > 0 && (
            <li>
              <span className='text-muted-foreground'>
                {t('gap.doubted_fields')}{' '}
              </span>
              <span className='text-foreground'>
                {shortfall.doubted.map((reading, n) => (
                  <span key={reading.key}>
                    {n > 0 && ', '}
                    {fieldName(reading.key)}{' '}
                    {/* The figure is the machine's — this is the number the
                        operator weighs the floor against. */}
                    <span className='text-[0.75rem] font-medium tabular-nums text-incomplete-ink'>
                      {Math.round(reading.confidence * 100)}%
                    </span>
                  </span>
                ))}
              </span>
            </li>
          )}
          {shortfall.placement !== null && (
            <li>
              <span className='text-muted-foreground'>
                {t('gap.doubted_placement')}{' '}
              </span>
              <span className='text-[0.75rem] font-medium tabular-nums text-incomplete-ink'>
                {Math.round(shortfall.placement * 100)}%
              </span>
            </li>
          )}
        </ul>
      ) : (
        <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t('gap.unusable_unspecified')}
        </p>
      )}

      {/* The quickest way to see what is wrong with a scan is to look at it. */}
      <a
        href={anchor}
        onClick={onJump(found.document.id, anchor)}
        className='mt-2 inline-flex items-center gap-1 text-[0.75rem] text-primary underline-offset-2 hover:underline'
      >
        {t('gap.open_scan', { file: found.file.originalFilename })}
        <ChevronRightIcon className='size-3' />
      </a>
    </div>
  );
}

/** The service's refusal, said as the service said it: what was asked for, and
 *  what turned up instead. Never "upload failed" — an operator cannot act on
 *  that, and the whole reason the finding names both papers is so they can. */
function RefusedNote({
  file,
  expected,
}: {
  file: SuppliedFile;
  expected: string;
}) {
  const { t } = useI18n();
  const arrived =
    file.arrivedType === null || file.arrivedType === 'unknown'
      ? t('gap.arrived_unplaced')
      : translateOr(t, `doctype.${file.arrivedType}`, file.arrivedType);

  return (
    <Note tone='fail' icon={<TriangleAlertIcon className='size-3' />}>
      {t('gap.refused', { file: file.filename, expected, arrived })}
    </Note>
  );
}

function Note({
  tone,
  icon,
  children,
}: {
  tone: 'pending' | 'fail';
  icon: ComponentProps<'span'>['children'];
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        'mt-2 flex items-start gap-2 text-[0.8125rem] leading-relaxed',
        tone === 'fail' ? 'text-failed-ink' : 'text-primary',
      )}
    >
      <span className='mt-1 shrink-0'>{icon}</span>
      <span className='max-w-[60ch]'>{children}</span>
    </p>
  );
}
