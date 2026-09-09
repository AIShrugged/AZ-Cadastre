/**
 * One approval of an archive search, as it is read back.
 *
 * Three things and no fourth: that it was given, when, and what was concluded
 * from the search. There is **no author line and no placeholder for one** — the
 * system has no accounts, so a name here could only be one somebody typed, and
 * an empty slot labelled "approved by" would advertise a gap the record does
 * not have (ADR-0016).
 *
 * The answers it was signed over are kept with it. A spent approval read as a
 * date alone leaves the reader guessing what changed underneath it; here the
 * verdict that was signed for stands beside the one that replaced it.
 */
import { CheckIcon, MessageSquareIcon } from 'lucide-react';

import {
  coveredChecks,
  RegistryOutcomeMark,
} from '@/entities/verification-package';
import { formatDate, formatTime, translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type {
  ArchiveSearchApprovalDto,
  RegistryCheckDto,
} from '@cadastre/api-contracts/verification';

export function ApprovalRecord({
  approval,
  registryChecks,
  className,
}: {
  approval: ArchiveSearchApprovalDto;
  /** The package's checks as they stand now, which is what makes an outrun
   *  approval legible rather than merely marked. */
  registryChecks: readonly RegistryCheckDto[];
  className?: string;
}) {
  const { t, locale } = useI18n();
  const spent = approval.supersededAt !== null;
  const covered = coveredChecks(approval, registryChecks);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium',
            spent ? 'bg-muted text-muted-foreground' : 'bg-ok/12 text-ok-ink',
          )}
        >
          <CheckIcon className='size-3 shrink-0' />
          {t('approve.given')}
        </span>
        <span data-mono className='text-[0.75rem] text-muted-foreground'>
          {formatDate(approval.approvedAt, locale)}
          {' · '}
          {formatTime(approval.approvedAt)}
        </span>
        {approval.supersededAt && (
          <span className='text-[0.75rem] text-muted-foreground/80'>
            {t('approve.spent_since', {
              d: formatDate(approval.supersededAt, locale),
            })}
          </span>
        )}
      </div>

      {/* The conclusion, set as the person's own words: the one part of this
          package a machine did not write. */}
      <p className='max-w-[70ch] whitespace-pre-wrap border-l-2 border-rule pl-3 text-[0.875rem] leading-relaxed text-foreground'>
        {approval.summary}
      </p>

      {approval.comment && (
        <p className='flex max-w-[70ch] gap-2 text-[0.8125rem] leading-relaxed text-muted-foreground'>
          <MessageSquareIcon className='size-3.5 shrink-0 translate-y-1' />
          <span className='min-w-0 whitespace-pre-wrap'>
            <span className='text-muted-foreground/70'>
              {t('approve.remark')}
              {' — '}
            </span>
            {approval.comment}
          </span>
        </p>
      )}

      {covered.length > 0 && (
        <div>
          <p className='text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground/70'>
            {t('approve.covered')}
          </p>
          <ul className='mt-1.5 flex flex-col gap-1.5'>
            {covered.map(check => (
              <li
                key={check.key}
                className='flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.8125rem] text-muted-foreground'
              >
                <span className='min-w-0'>
                  {translateOr(t, `check.${check.key}`, check.key)}
                </span>
                <RegistryOutcomeMark outcome={check.approved} />
                {/* Only where the search has since answered otherwise: an
                    approval that still matches needs no second pill saying so. */}
                {check.now !== null && check.now !== check.approved && (
                  <>
                    <span className='text-muted-foreground/60'>
                      {t('approve.now')}
                    </span>
                    <RegistryOutcomeMark outcome={check.now} />
                  </>
                )}
                {check.now === null && (
                  <span className='italic text-muted-foreground/60'>
                    {t('approve.gone')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
