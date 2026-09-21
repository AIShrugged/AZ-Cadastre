/**
 * Who is signed in, at the foot of the register cover — the band the direction
 * contract always reserved for the inspector, and which stood empty while the
 * product had no accounts to read a name off (ADR-0016, now closed by
 * ADR-0029).
 *
 * Name, role and the way out. Nothing else: there is no profile to edit, no
 * account to manage and no settings behind it, so a card that opened a menu
 * would be a menu with one item in it.
 *
 * Two menu rows rather than one card with a button in the corner, because the
 * sidebar collapses to a 3rem rail and a corner is the first thing to go. As
 * rows they keep the rail's own behaviour for free — the glyph stays, the text
 * goes, and the tooltip says what the text would have.
 */
import { LogOutIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  displayName,
  initials,
  ROLE_KEY,
  useSignOutMutation,
  type AccountDto,
} from '@/entities/account';
import { paths } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/sidebar';

export function AccountCard({ account }: { account: AccountDto }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [signOut, { isLoading: leaving }] = useSignOutMutation();
  const name = displayName(account);
  const role = t(ROLE_KEY[account.role]);

  /*
   * The cookie is the session, so the gate is reached by navigating and not by
   * forgetting anything here — and it is navigated to whatever the call
   * answered: `logout` clears the cookie on its way out either way, and a
   * reader left on a workspace they can no longer load because the response
   * was lost is worse off than one looking at the sign-in form.
   */
  async function onSignOut() {
    try {
      await signOut().unwrap();
    } finally {
      navigate(paths.login, { replace: true });
    }
  }

  return (
    <SidebarMenu className='gap-0.5'>
      <SidebarMenuItem>
        {/* Not a button: there is nowhere for it to go. The row is the card. */}
        <div
          className='flex h-11 items-center gap-2.5 rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
          title={`${name} · ${role}`}
        >
          <span
            aria-hidden
            data-mono
            className='grid size-8 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-[0.6875rem] font-medium tracking-wide text-sidebar-foreground/80'
          >
            {initials(account)}
          </span>
          <span className='flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden'>
            <span className='truncate text-[0.8125rem] font-medium text-sidebar-foreground'>
              {name}
            </span>
            <span className='register-label truncate'>{role}</span>
          </span>
        </div>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={t('account.sign_out')}
          disabled={leaving}
          onClick={() => void onSignOut()}
          className='h-8 gap-2.5 rounded-md px-3 text-[0.8125rem] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        >
          <LogOutIcon className='size-4 opacity-70' />
          <span className='flex-1 truncate text-left'>
            {t('account.sign_out')}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
