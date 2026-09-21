/**
 * The page a reader sees before they are anybody — sign in, open an account,
 * and the two moments on either side of them: the hold while the app asks who
 * is there, and the notice for when nothing answers.
 *
 * The same world as the rest of the product and not a separate login skin: the
 * masthead rule, the hatched ground, the hairline card, the mark in the place
 * it sits on every other page. A sign-in that looks like somewhere else is a
 * sign-in a person hesitates over, and this is the one screen where a hesitation
 * is about whether the address is genuine.
 *
 * Locale and appearance ride along in the masthead, which is not decoration: all
 * three languages are a product constraint, and a reader who cannot read the
 * form cannot sign in to change the language behind it.
 */
import { UnplugIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { LocaleSwitch } from '@/shared/ui/locale-switch';
import { SurfaceMasthead } from '@/shared/ui/surface';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { Wordmark } from '@/shared/ui/wordmark';

function GatePage({ children }: { children: ReactNode }) {
  return (
    <div className='flex min-h-svh flex-col bg-background'>
      <SurfaceMasthead>
        <Wordmark />
        <div className='flex items-center gap-1.5'>
          <LocaleSwitch />
          <ThemeToggle />
        </div>
      </SurfaceMasthead>
      <main className='register-hatch flex flex-1 justify-center px-4 py-10 md:py-16'>
        <div className='w-full max-w-[26rem]'>{children}</div>
      </main>
    </div>
  );
}

export function Gate({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead: string;
  children: ReactNode;
  /** The other door — "no account yet?" and back again. */
  footer?: ReactNode;
}) {
  return (
    <GatePage>
      <section className='rounded-xl border border-rule-strong bg-card shadow-[var(--shadow-sm)]'>
        <header className='border-b border-rule px-6 py-5'>
          <h1 className='text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-foreground'>
            {title}
          </h1>
          <p className='mt-1 text-[0.875rem] leading-relaxed text-muted-foreground'>
            {lead}
          </p>
        </header>
        <div className='px-6 py-6'>{children}</div>
      </section>
      {footer && (
        <p className='mt-4 text-center text-[0.8125rem] text-muted-foreground'>
          {footer}
        </p>
      )}
    </GatePage>
  );
}

/**
 * The hold while `GET /auth/me` is in flight.
 *
 * Deliberately almost nothing — the mark and one line. The app cannot know yet
 * whether this reader gets the office's workspace, an applicant's cabinet or
 * the sign-in form, and a shell drawn on a guess flashes a navigation the
 * reader may not have and then takes it away again.
 */
export function GateHold() {
  const { t } = useI18n();
  return (
    <GatePage>
      <p
        aria-live='polite'
        aria-busy='true'
        className='py-10 text-center text-[0.875rem] text-muted-foreground'
      >
        {t('gate.holding')}
      </p>
    </GatePage>
  );
}

/**
 * Nothing answered when the app asked who was there.
 *
 * Its own screen and never the sign-in form: a service that is down would take
 * credentials, refuse them the way it refuses everything, and teach the reader
 * that their password has stopped working.
 */
export function GateUnreachable({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <GatePage>
      <section className='flex flex-col items-center gap-4 rounded-xl border border-rule-strong bg-card px-6 py-10 text-center shadow-[var(--shadow-sm)]'>
        <span className='grid size-12 place-items-center rounded-xl border border-rule-strong bg-background text-muted-foreground'>
          <UnplugIcon className='size-5' />
        </span>
        <div className='flex flex-col gap-1.5'>
          <h1 className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
            {t('gate.unreachable.title')}
          </h1>
          <p className='text-[0.875rem] leading-relaxed text-muted-foreground'>
            {t('gate.unreachable.body')}
          </p>
        </div>
        <Button variant='outline' onClick={onRetry}>
          {t('gate.unreachable.retry')}
        </Button>
      </section>
    </GatePage>
  );
}
