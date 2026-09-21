/**
 * The AZ-Cadastre mark and the two lines beside it — the office the workspace
 * belongs to, then the article it works under.
 *
 * In `shared/ui` because two frames draw it and neither owns it: the signed-in
 * shell puts it at the head of the register cover, and the gate — sign in, open
 * an account — puts it above the card, which is the only thing on that page
 * that says which system the reader has arrived at. Two copies of a parcel-and-
 * tick glyph is how the two come to drift apart.
 *
 * The collapse rules ride along rather than being passed in: they are written
 * against the sidebar's own `group-data-[collapsible=icon]` and match nothing
 * outside it, so the gate gets them and is unaffected.
 */
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

export function Wordmark({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
        className,
      )}
    >
      <div className='grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent-2 text-primary-foreground shadow-[var(--shadow-primary)]'>
        {/* Cadastral register mark — a ruled parcel with a verification tick. */}
        <svg viewBox='0 0 24 24' className='size-5' aria-hidden fill='none'>
          <path d='M4 4h16v16H4z' stroke='currentColor' strokeWidth='1.4' />
          <path
            d='M4 10h16M10 4v16'
            stroke='currentColor'
            strokeWidth='1'
            opacity='0.55'
          />
          <path
            d='M12.4 13.6l1.9 1.9 3.4-3.9'
            stroke='currentColor'
            strokeWidth='1.6'
            strokeLinecap='square'
          />
        </svg>
      </div>
      <div className='flex min-w-0 flex-col group-data-[collapsible=icon]:hidden'>
        {/* The office the workspace belongs to, then the article it works
            under — the mockup's own two lines, in the reader's language. */}
        <span className='truncate text-[0.9375rem] font-semibold leading-tight tracking-tight text-sidebar-foreground'>
          {t('brand')}
        </span>
        <span className='truncate text-[0.6875rem] leading-tight text-muted-foreground'>
          {t('authority')}
        </span>
      </div>
    </div>
  );
}
