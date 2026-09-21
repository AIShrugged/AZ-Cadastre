/**
 * The register cover + workspace frame. A fixed left sidebar carries the
 * AZ-Cadastre mark, the navigation, the account that is signed in and — for the
 * office — the archive register's live state; it collapses to a hairline icon
 * rail (the toggle lives in the app bar, on the border rail, and on ⌘/Ctrl-B).
 * Below a single global app bar — identical on every route: sidebar trigger
 * left, locale + appearance right, plus a slot a route can drop one action
 * into — the inset holds the active surface. Every surface inherits this frame.
 *
 * **The navigation is one group, because the work is one** — and which work it
 * is depends on who is reading. An `operator` gets the office's day, in the
 * order they do it: look the property up in the archive, take a packet in, work
 * the register of cases. A `user` gets their own cabinet: what they have filed,
 * and filing another.
 *
 * Two lists and not one list with items hidden, because they are two products
 * with one frame — and the frame is the only thing they share. What a role may
 * actually reach is the server's to enforce (ADR-0029); this decides what is
 * worth offering, which is a different question and the only one a client may
 * answer.
 *
 * The foot of the cover carries the account card — the band the direction
 * contract always named "inspector" and which stood empty while there was
 * nobody to read a name off. The archive band stays beneath it for the office
 * and is absent for an applicant: the register's holdings are the office's own
 * measure of a system an applicant never queries, and the route that serves
 * them answers a `user` 403.
 */
import {
  ChartNoAxesColumnIcon,
  FilePlus2Icon,
  FileStackIcon,
  InboxIcon,
  SearchIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { useSession, type AccountRole } from '@/entities/account';
import { paths } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LocaleSwitch } from '@/shared/ui/locale-switch';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/shared/ui/sidebar';
import { SurfaceMasthead } from '@/shared/ui/surface';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { Wordmark } from '@/shared/ui/wordmark';
import { ArchiveStatus } from '@/widgets/archive-status';

import { AccountCard } from './account-card';
import { HeaderSlotContext } from './header-slot';

type NavItem = {
  key: string;
  icon: typeof FileStackIcon;
  to: string;
};

/** One heading and the items under it. */
type NavGroup = { key: string; items: NavItem[] };

/**
 * Whether a nav destination owns the route on screen. A surface that addresses
 * its own subject in the path — one case — must not drop the item that led
 * there out of its active state. A destination that is the root of its own map
 * is exempt from the prefix test: it would otherwise claim every route under it,
 * including the ones its siblings own.
 */
function isUnder(pathname: string, to: string, exact: boolean): boolean {
  return pathname === to || (!exact && pathname.startsWith(`${to}/`));
}

const NAV: Record<AccountRole, NavGroup[]> = {
  operator: [
    {
      key: 'nav.workspace',
      items: [
        { key: 'nav.intake', icon: InboxIcon, to: paths.intake },
        { key: 'nav.search', icon: SearchIcon, to: paths.search },
        { key: 'nav.cases', icon: FileStackIcon, to: paths.cases },
        {
          key: 'nav.analytics',
          icon: ChartNoAxesColumnIcon,
          to: paths.analytics,
        },
      ],
    },
  ],
  user: [
    {
      key: 'nav.cabinet',
      items: [
        { key: 'nav.submissions', icon: FileStackIcon, to: paths.cabinet },
        {
          key: 'nav.new_submission',
          icon: FilePlus2Icon,
          to: paths.newSubmission,
        },
      ],
    },
  ],
};

/**
 * Global app bar — identical on every route. Sidebar trigger on the left;
 * locale, appearance, and a route-owned action slot on the right. No title, no
 * breadcrumb, no back: the page names itself in its own heading below.
 *
 * Off the page when printing, with the sidebar: a surface that prints — the
 * case sheet — is a document, and the workspace it was read in is not part of
 * it.
 */
function AppBar({ slotRef }: { slotRef: (el: HTMLElement | null) => void }) {
  const { t } = useI18n();
  return (
    <SurfaceMasthead className='print:hidden'>
      <SidebarTrigger
        aria-label={t('sidebar.toggle')}
        className='size-8 shrink-0 rounded-md border border-input text-muted-foreground hover:bg-accent hover:text-foreground'
      />
      <div className='flex items-center gap-1.5'>
        <LocaleSwitch />
        <ThemeToggle />
        {/* Route action slot — filled via <HeaderActions>; collapses when empty. */}
        <div ref={slotRef} className='flex items-center gap-1.5 empty:hidden' />
      </div>
    </SurfaceMasthead>
  );
}

export function AppShell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  /*
   * The shell is only ever mounted inside the session gate, so there is an
   * account by the time it renders. It is read rather than passed down because
   * the route map is not the only reader — the card at the foot needs the whole
   * of it, and threading it through two layers of RouteObject would be a prop
   * that exists for the plumbing.
   */
  const { session } = useSession();
  const account = session.state === 'signed-in' ? session.account : null;
  const groups = account ? NAV[account.role] : [];

  return (
    <SidebarProvider>
      <Sidebar
        collapsible='icon'
        className='border-r border-sidebar-border print:hidden'
      >
        {/* Logo band — fixed to the masthead height so its baseline and bottom
            rule align with the app header across the top of the page. */}
        <SidebarHeader className='h-16 shrink-0 justify-center gap-0 border-b border-sidebar-border px-2 group-data-[collapsible=icon]:px-0'>
          <Wordmark />
        </SidebarHeader>

        <SidebarContent className='px-1 py-2 group-data-[collapsible=icon]:px-1.5'>
          {groups.map(group => (
            <SidebarGroup
              key={group.key}
              className='gap-1 group-data-[collapsible=icon]:p-0'
            >
              <SidebarGroupLabel className='register-label px-2 text-muted-foreground'>
                {t(group.key)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className='gap-0.5 group-data-[collapsible=icon]:items-center'>
                  {group.items.map(item => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isUnder(
                          pathname,
                          item.to,
                          // The archive search lives at "/" and the cabinet's
                          // list at "/my": both head their own map, so neither
                          // may claim what sits under it.
                          item.to === paths.search || item.to === paths.cabinet,
                        )}
                        tooltip={t(item.key)}
                        onClick={() => navigate(item.to)}
                        className={cn(
                          'relative h-9 gap-2.5 rounded-md px-3 text-[0.875rem] text-sidebar-foreground/80',
                          'before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full before:bg-transparent',
                          'hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-foreground data-active:before:bg-primary',
                          // Collapsed: the icon centers in the rail; drop the leading
                          // rule so the active marker never sits lopsided beside it.
                          'group-data-[collapsible=icon]:before:hidden',
                        )}
                      >
                        <item.icon className='size-4 opacity-70' />
                        <span className='flex-1 truncate text-left'>
                          {t(item.key)}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* Footer bands — the account card, then the archive band for the office
            alone. The archive band keeps the h-16 it always had and stays the
            bottom-most of them, so its top rule still lines up with the main
            column's pagination rule and the shell is still bookended top ⇄
            bottom. An applicant's cover ends on the account card instead. */}
        <SidebarFooter className='shrink-0 gap-0 p-0'>
          {account && (
            <div className='border-t border-sidebar-border px-2 py-2 group-data-[collapsible=icon]:px-1.5'>
              <AccountCard account={account} />
            </div>
          )}
          {account?.role === 'operator' && (
            <div className='flex h-16 shrink-0 flex-col justify-center border-t border-sidebar-border px-2 group-data-[collapsible=icon]:px-0'>
              <ArchiveStatus />
            </div>
          )}
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* `overflow-clip` and not `overflow-hidden`, here and on the wrapper
          below. A hidden box still scrolls from script, and a jump to an anchor
          scrolls every ancestor of the target: a finding pointing into a case
          scrolled this frame 64px, pushed the app bar off the top, and left a
          gap the reader could not scroll back — the wheel does not reach a
          hidden box. A clipped one cannot be scrolled at all, so only the
          surface's own body moves. */}
      <SidebarInset className='h-svh min-w-0 overflow-clip bg-background print:h-auto print:overflow-visible'>
        <AppBar slotRef={setHeaderSlot} />
        <HeaderSlotContext.Provider value={headerSlot}>
          <div className='flex min-h-0 flex-1 flex-col overflow-clip'>
            <Outlet />
          </div>
        </HeaderSlotContext.Provider>
      </SidebarInset>
      {/* Scroll to top on navigation; restore on back/forward. */}
      <ScrollRestoration />
    </SidebarProvider>
  );
}
