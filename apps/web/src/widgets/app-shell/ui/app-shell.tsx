/**
 * The register cover + workspace frame. A fixed left sidebar carries the
 * AZ-Cadastre mark, the workspace navigation, and the archive register's live
 * state; it collapses to a hairline icon rail (the toggle lives in the app bar,
 * on the border rail, and on ⌘/Ctrl-B). Below a single global app bar —
 * identical on every route: sidebar trigger left, locale + appearance right,
 * plus a slot a route can drop one action into — the inset holds the active
 * surface. Every surface inherits this frame.
 *
 * **The navigation is one group, because the work is one.** `Workspace` is what
 * an operator does, in the order they do it: look the property up in the
 * archive, take a packet in, work the register of cases.
 *
 * There is no account card and no sign-in. The product has no accounts on
 * purpose (ADR-0016): one user, the inspector, and nothing to read a name off.
 */
import { FileStackIcon, InboxIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import {
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { paths } from '@/shared/config';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
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
import { ArchiveStatus } from '@/widgets/archive-status';

import { HeaderSlotContext } from './header-slot';
import { LocaleSwitch } from './locale-switch';
import { ThemeToggle } from './theme-toggle';

function Wordmark() {
  const { t } = useI18n();
  return (
    <div className='flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'>
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
 * there out of its active state. Archive search is exempt from the prefix test:
 * it lives at "/" and would otherwise claim every route.
 */
function isUnder(pathname: string, to: string): boolean {
  return pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
}

const NAV: NavGroup[] = [
  {
    key: 'nav.workspace',
    items: [
      { key: 'nav.intake', icon: InboxIcon, to: paths.intake },
      { key: 'nav.search', icon: SearchIcon, to: paths.search },
      { key: 'nav.cases', icon: FileStackIcon, to: paths.cases },
    ],
  },
];

/**
 * Global app bar — identical on every route. Sidebar trigger on the left;
 * locale, appearance, and a route-owned action slot on the right. No title, no
 * breadcrumb, no back: the page names itself in its own heading below.
 */
function AppBar({ slotRef }: { slotRef: (el: HTMLElement | null) => void }) {
  const { t } = useI18n();
  return (
    <SurfaceMasthead>
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

  return (
    <SidebarProvider>
      <Sidebar collapsible='icon' className='border-r border-sidebar-border'>
        {/* Logo band — fixed to the masthead height so its baseline and bottom
            rule align with the app header across the top of the page. */}
        <SidebarHeader className='h-16 shrink-0 justify-center gap-0 border-b border-sidebar-border px-2 group-data-[collapsible=icon]:px-0'>
          <Wordmark />
        </SidebarHeader>

        <SidebarContent className='px-1 py-2 group-data-[collapsible=icon]:px-1.5'>
          {NAV.map(group => (
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
                        isActive={isUnder(pathname, item.to)}
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

        {/* Footer band — mirrors the h-16 masthead so its top rule aligns with
            the main column's pagination rule, bookending the shell top ⇄ bottom. */}
        <SidebarFooter className='h-16 shrink-0 justify-center gap-0 border-t border-sidebar-border px-2 py-0 group-data-[collapsible=icon]:px-0'>
          <ArchiveStatus />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className='h-svh min-w-0 overflow-hidden bg-background'>
        <AppBar slotRef={setHeaderSlot} />
        <HeaderSlotContext.Provider value={headerSlot}>
          <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
            <Outlet />
          </div>
        </HeaderSlotContext.Provider>
      </SidebarInset>
      {/* Scroll to top on navigation; restore on back/forward. */}
      <ScrollRestoration />
    </SidebarProvider>
  );
}
