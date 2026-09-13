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
  scanShortfall,
  takesFiles,
  type GapTone,
} from '@/entities/verification-package';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Jump } from '@/shared/lib/jump';
import type {
  DocumentGapDto,
  DocumentGapReason,
  PackageDetailDto,
  ProfileDto,
} from '@cadastre/api-contracts/verification';
import { CONFIDENCE_FLOOR } from '@cadastre/api-contracts/verification';

import { supplyStateFor, type SuppliedFile } from '../model/supply-state';

import { SupplyButton } from './supply-button';

const REASON_ICON: Record<DocumentGapReason, typeof ScanLineIcon> = {
  MissingDocument: TriangleAlertIcon,
  UnusableScan: ScanLineIcon,
  AlwaysAccepted: PlusCircleIcon,
};

// A shortfall is drawn as one; a paper the profile simply accepts is not. The
// quiet third tone is the whole point of publishing three reasons.
const TONE_CHIP: Record<GapTone, string> = {
  short: 'bg-incomplete/12 text-incomplete-ink',
  doubt: 'bg-issues/14 text-issues-ink',
  offer: 'bg-muted text-muted-foreground',
};

const TONE_LABEL: Record<GapTone, string> = {
  short: 'text-incomplete-ink',
  doubt: 'text-issues-ink',
  offer: 'text-muted-foreground',
};

export function DocumentGaps({
  pkg,
  profiles,
  onJump,
}: {
  pkg: PackageDetailDto;
  /** The engine's own copy of the policy, so a bad scan can be told which fields
   *  it was asked for. Empty while it loads, and then a row says the scan is
   *  worth sending again without pretending to know why. */
  profiles: readonly ProfileDto[];
  onJump: Jump;
}) {
  const { t } = useI18n();
  // The contract's answer to "will this package take a file at all", not a list
  // of states kept here.
  const accepting = takesFiles(pkg.status);

  if (pkg.gaps.length === 0) {
    return (
      <section id='document-gaps' className='scroll-mt-16'>
        <h2 className='register-label'>{t('gap.title')}</h2>
        <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t('gap.none')}
        </p>
      </section>
    );
  }

  return (
    <section id='document-gaps' className='scroll-mt-16'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
        <h2 className='register-label'>{t('gap.title')}</h2>
        <span
          data-mono
          className='shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground'
        >
          {pkg.gaps.length}
        </span>
      </div>
      <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
        {accepting ? t('gap.note') : t('gap.closed_running')}
      </p>

      <ul className='mt-4 divide-y divide-rule border-y border-rule'>
        {pkg.gaps.map(gap => (
          <GapRow
            key={gapKey(gap)}
            gap={gap}
            pkg={pkg}
            profiles={profiles}
            accepting={accepting}
            onJump={onJump}
          />
        ))}
      </ul>
    </section>
  );
}

function GapRow({
  gap,
  pkg,
  profiles,
  accepting,
  onJump,
}: {
  gap: DocumentGapDto;
  pkg: PackageDetailDto;
  profiles: readonly ProfileDto[];
  accepting: boolean;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const tone = GAP_REASON_TONE[gap.reason];
  const Icon = REASON_ICON[gap.reason];
  const state = supplyStateFor(pkg, gap);
  const type = translateOr(t, `doctype.${gap.expectedType}`, gap.expectedType);

  return (
    <li className='flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-4'>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.08em]',
              TONE_CHIP[tone],
            )}
          >
            <Icon aria-hidden className='size-3' />
            {t(GAP_REASON_KEY[gap.reason])}
          </span>
          <h3 className='text-[0.9375rem] font-[550] leading-tight tracking-[-0.01em] text-foreground'>
            {type}
          </h3>
        </div>

        <p
          className={cn(
            'mt-1.5 max-w-[65ch] text-[0.8125rem] leading-relaxed',
            tone === 'offer' ? 'text-muted-foreground' : TONE_LABEL[tone],
          )}
        >
          {t(GAP_REASON_NOTE[gap.reason])}
        </p>

        {gap.reason === 'UnusableScan' && (
          <ScanFault gap={gap} pkg={pkg} profiles={profiles} onJump={onJump} />
        )}

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

      <SupplyButton packageId={pkg.id} gap={gap} accepting={accepting} />
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
              <span data-mono className='text-[0.75rem] text-foreground'>
                {shortfall.unread.map(fieldName).join(', ')}
              </span>
            </li>
          )}
          {shortfall.doubted.length > 0 && (
            <li>
              <span className='text-muted-foreground'>
                {t('gap.doubted_fields')}{' '}
              </span>
              <span data-mono className='text-[0.75rem] text-foreground'>
                {shortfall.doubted
                  .map(
                    reading =>
                      `${fieldName(reading.key)} ${Math.round(reading.confidence * 100)}%`,
                  )
                  .join(', ')}
              </span>
            </li>
          )}
          {shortfall.placement !== null && (
            <li>
              <span className='text-muted-foreground'>
                {t('gap.doubted_placement')}{' '}
              </span>
              <span data-mono className='text-[0.75rem] text-foreground'>
                {Math.round(shortfall.placement * 100)}%
              </span>
            </li>
          )}
          <li className='text-[0.75rem] text-muted-foreground/80'>
            {t('gap.floor', { floor: Math.round(CONFIDENCE_FLOOR * 100) })}
          </li>
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
