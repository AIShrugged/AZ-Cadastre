/**
 * Approving what the archive register answered about a submission.
 *
 * The one write on this page a person makes rather than the engine. The
 * register states what its own fonds hold and passes judgement on nobody's
 * application (ADR-0009); what that means for *this* submission is a person's
 * to say, and this is where they say it and it is kept.
 *
 * Three things shape the panel:
 *
 *  - **The conclusion is the point, not the click.** `summary` is required and
 *    `comment` is not: an approval carrying nothing but a timestamp says a
 *    search was signed for and not what signing it meant — and since no name is
 *    recorded either, it would say nothing at all. A second box that must be
 *    filled in beside it is a box that gets "ok" typed into it (ADR-0016).
 *  - **No author, and no space left for one.** There are no accounts here, so
 *    the panel states the fact and the moment and says plainly why there is no
 *    name — an empty "approved by" would advertise a gap the record does not
 *    have.
 *  - **Why it cannot be signed yet is said, not implied.** The service refuses
 *    on three rules; each of them is a sentence here instead of a disabled
 *    button with nothing beside it. A refusal that still comes back is shown by
 *    the code the service named, because this copy of the rule may be the one
 *    that is wrong.
 */
import { HistoryIcon, StampIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  approvalInForce,
  approvalStance,
  spentApprovals,
  useApproveArchiveSearchMutation,
} from '@/entities/verification-package';
import { failureCode } from '@/shared/api';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import {
  APPROVAL_TEXT_MAX_LENGTH,
  type ArchiveSearchApprovalDto,
  type PackageDetailDto,
  type RegistryCheckDto,
} from '@cadastre/api-contracts/verification';

import { ApprovalRecord } from './approval-record';

export function ApproveArchiveSearch({ pkg }: { pkg: PackageDetailDto }) {
  const { t } = useI18n();
  const stance = approvalStance({
    status: pkg.status,
    registryChecks: pkg.registryChecks,
    approvals: pkg.archiveSearchApprovals,
  });
  const inForce = approvalInForce(pkg.archiveSearchApprovals);
  const spent = spentApprovals(pkg.archiveSearchApprovals);

  return (
    <section id='archive-approval' className='mb-9 scroll-mt-16'>
      <h2 className='register-label'>{t('approve.title')}</h2>
      <p className='mt-2 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
        {t('approve.note')}
      </p>

      <div className='mt-3 border-t border-rule pt-4'>
        {inForce ? (
          <ApprovalRecord
            approval={inForce}
            registryChecks={pkg.registryChecks}
          />
        ) : stance === 'open' ? (
          <ApprovalForm packageId={pkg.id} />
        ) : (
          <p className='max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {stance === 'unsettled'
              ? t('approve.unsettled')
              : t('approve.not_asked')}
          </p>
        )}
      </div>

      {/* Why no name appears, said once and where the record is read — not as
          an apology, but because a reader who has been given no name will
          otherwise look for one. */}
      {(inForce || stance === 'open') && (
        <p className='mt-4 max-w-[70ch] text-[0.75rem] leading-relaxed text-muted-foreground/70'>
          {t('approve.no_author')}
        </p>
      )}

      {spent.length > 0 && (
        <SpentApprovals approvals={spent} registryChecks={pkg.registryChecks} />
      )}
    </section>
  );
}

/** What was signed for before the archive was searched again. Kept, because a
 *  signature over answers the package has since replaced is exactly what a
 *  reader has to be able to see — folded, because it is history and the
 *  standing one is the live question. */
function SpentApprovals({
  approvals,
  registryChecks,
}: {
  approvals: readonly ArchiveSearchApprovalDto[];
  registryChecks: readonly RegistryCheckDto[];
}) {
  const { t } = useI18n();

  return (
    <details className='group mt-6'>
      <summary className='-mx-2 flex cursor-pointer list-none select-none items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
        <HistoryIcon className='size-3.5 shrink-0' />
        {t('approve.spent_title', { n: approvals.length })}
      </summary>
      <p className='mt-2 max-w-[70ch] text-[0.75rem] leading-relaxed text-muted-foreground/80'>
        {t('approve.spent_note')}
      </p>
      <div className='mt-3 flex flex-col divide-y divide-rule border-t border-rule'>
        {approvals.map(approval => (
          <ApprovalRecord
            key={approval.approvedAt}
            approval={approval}
            registryChecks={registryChecks}
            className='py-4 opacity-80'
          />
        ))}
      </div>
    </details>
  );
}

function ApprovalForm({ packageId }: { packageId: string }) {
  const { t } = useI18n();
  const [approve, { isLoading: sending }] = useApproveArchiveSearchMutation();
  const [summary, setSummary] = useState('');
  const [comment, setComment] = useState('');

  const summaryLeft = APPROVAL_TEXT_MAX_LENGTH - summary.trim().length;
  const commentLeft = APPROVAL_TEXT_MAX_LENGTH - comment.trim().length;
  const canSend =
    summary.trim().length > 0 &&
    summaryLeft >= 0 &&
    commentLeft >= 0 &&
    !sending;

  async function onApprove() {
    if (!canSend) return;
    try {
      await approve({
        id: packageId,
        // Blank is no comment rather than an empty one, which is what an
        // untouched box sends — the contract trims it away either way, and
        // saying so here keeps the two sides reading the same.
        body: { summary: summary.trim(), comment: comment.trim() || undefined },
      }).unwrap();
      toast(t('approve.done'));
      setSummary('');
      setComment('');
    } catch (error) {
      const code = failureCode(error);
      const generic = t('approve.failed');
      toast.error(code ? translateOr(t, `error.${code}`, generic) : generic);
    }
  }

  return (
    <div className='flex max-w-[70ch] flex-col gap-5'>
      <div className='flex flex-col gap-1.5'>
        <label
          htmlFor='approval-summary'
          className='text-[0.8125rem] font-medium text-foreground'
        >
          {t('approve.summary_label')}
        </label>
        <p className='text-[0.75rem] leading-relaxed text-muted-foreground'>
          {t('approve.summary_hint')}
        </p>
        <Textarea
          id='approval-summary'
          rows={3}
          value={summary}
          onChange={event => setSummary(event.target.value)}
          placeholder={t('approve.summary_placeholder')}
          aria-invalid={summaryLeft < 0}
          aria-describedby='approval-summary-count'
          disabled={sending}
        />
        <CharacterCount id='approval-summary-count' left={summaryLeft} />
      </div>

      <div className='flex flex-col gap-1.5'>
        <label
          htmlFor='approval-comment'
          className='text-[0.8125rem] font-medium text-foreground'
        >
          {t('approve.comment_label')}
        </label>
        <p className='text-[0.75rem] leading-relaxed text-muted-foreground'>
          {t('approve.comment_hint')}
        </p>
        <Textarea
          id='approval-comment'
          rows={2}
          value={comment}
          onChange={event => setComment(event.target.value)}
          placeholder={t('approve.comment_placeholder')}
          aria-invalid={commentLeft < 0}
          aria-describedby='approval-comment-count'
          disabled={sending}
        />
        <CharacterCount id='approval-comment-count' left={commentLeft} />
      </div>

      <div className='flex flex-wrap items-center justify-end gap-3'>
        <Button
          onClick={onApprove}
          disabled={!canSend}
          aria-disabled={!canSend}
        >
          <StampIcon />
          {sending ? t('approve.sending') : t('approve.action')}
        </Button>
      </div>
    </div>
  );
}

/** Counted down rather than up, and only once the box is nearly full: a
 *  paragraph-long field with a running tally over it reads as a form to be
 *  satisfied instead of a place to write. */
function CharacterCount({ id, left }: { id: string; left: number }) {
  const { t } = useI18n();
  if (left > 200) return <span id={id} className='sr-only' />;

  return (
    <span
      id={id}
      data-mono
      className={cn(
        'self-end text-[0.6875rem] tabular-nums',
        left < 0 ? 'text-failed-ink' : 'text-muted-foreground',
      )}
      aria-live='polite'
    >
      {left < 0
        ? t('approve.over', { n: -left })
        : t('approve.left', { n: left })}
    </span>
  );
}
