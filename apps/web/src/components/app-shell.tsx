/**
 * The register cover + workspace frame. A fixed left sidebar carries the
 * AZ-Cadastre mark, the workspace navigation, and the inspector's identity; it
 * collapses to a hairline icon rail (the toggle lives in the app bar, on the
 * border rail, and on ⌘/Ctrl-B). Below a single global app bar — identical on
 * every route: sidebar trigger left, locale + appearance right, plus a slot a
 * route can drop one action into — the inset holds the active surface. Every
 * future surface (Verification Details, Profiles…) inherits this frame.
 */
import { useState } from "react"
import {
  FileStackIcon,
  FolderCogIcon,
  HistoryIcon,
  PlusIcon,
} from "lucide-react"
import { Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

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
} from "@/components/ui/sidebar"
import { LocaleSwitch } from "@/components/locale-switch"
import { ThemeToggle } from "@/components/theme-toggle"
import { HeaderSlotContext } from "@/components/register/header-slot"
import { SurfaceMasthead } from "@/components/register/surface"
import { useI18n } from "@/lib/i18n"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

function Wordmark() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent-2 text-primary-foreground shadow-[var(--shadow-primary)]">
        {/* Cadastral register mark — a ruled parcel with a verification tick. */}
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none">
          <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4 10h16M10 4v16" stroke="currentColor" strokeWidth="1" opacity="0.55" />
          <path d="M12.4 13.6l1.9 1.9 3.4-3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        </svg>
      </div>
      <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
        <span className="text-[0.9375rem] font-semibold leading-tight tracking-tight text-sidebar-foreground">
          AZ<span className="text-primary">·</span>Cadastre
        </span>
        <span className="truncate text-[0.6875rem] leading-tight text-muted-foreground">
          {t("authority")}
        </span>
      </div>
    </div>
  )
}

type NavItem = { key: string; icon: typeof FileStackIcon; to?: string }

const NAV: NavItem[] = [
  { key: "nav.register", icon: FileStackIcon, to: paths.register },
  { key: "nav.new", icon: PlusIcon, to: paths.new },
  { key: "nav.profiles", icon: FolderCogIcon },
  { key: "nav.audit", icon: HistoryIcon },
]

function InspectorCard() {
  const { t } = useI18n()
  return (
    <div
      className={cn(
        // Bare avatar + identity, no boxed border — mirrors the header wordmark
        // so the ink AR square sits flush under the blue logo mark above it.
        "flex items-center gap-2.5",
        "group-data-[collapsible=icon]:justify-center",
      )}
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-[0.75rem] font-semibold text-background"
        aria-hidden
      >
        AR
      </div>
      <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-[0.8125rem] font-medium text-sidebar-foreground">
          Aynur Rəsulova
        </span>
        <span className="text-[0.6875rem] text-muted-foreground">
          {t("role.inspector")} · ID <span data-mono>4471</span>
        </span>
      </div>
    </div>
  )
}

/**
 * Global app bar — identical on every route. Sidebar trigger on the left;
 * locale, appearance, and a route-owned action slot on the right. No title, no
 * breadcrumb, no back: the page names itself in its own heading below.
 */
function AppBar({ slotRef }: { slotRef: (el: HTMLElement | null) => void }) {
  const { t } = useI18n()
  return (
    <SurfaceMasthead>
      <SidebarTrigger
        aria-label={t("sidebar.toggle")}
        className="size-8 shrink-0 rounded-md border border-input text-muted-foreground hover:bg-accent hover:text-foreground"
      />
      <div className="flex items-center gap-1.5">
        <LocaleSwitch />
        <ThemeToggle />
        {/* Route action slot — filled via <HeaderActions>; collapses when empty. */}
        <div ref={slotRef} className="flex items-center gap-1.5 empty:hidden" />
      </div>
    </SurfaceMasthead>
  )
}

export function AppShell() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Logo band — fixed to the masthead height so its baseline and bottom
            rule align with the app header across the top of the page. */}
        <SidebarHeader className="h-16 shrink-0 justify-center gap-0 border-b border-sidebar-border px-2 group-data-[collapsible=icon]:px-0">
          <Wordmark />
        </SidebarHeader>

        <SidebarContent className="px-1 py-2 group-data-[collapsible=icon]:px-1.5">
          <SidebarGroup className="gap-1 group-data-[collapsible=icon]:p-0">
            <SidebarGroupLabel className="register-label px-2 text-muted-foreground">
              {t("nav.workspace")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:items-center">
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={item.to ? item.to === pathname : false}
                      tooltip={t(item.key)}
                      onClick={() =>
                        item.to
                          ? navigate(item.to)
                          : toast(t(item.key), { description: t("toast.new") })
                      }
                      className={cn(
                        "relative h-9 gap-2.5 rounded-md px-3 text-[0.875rem] text-sidebar-foreground/80",
                        "before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full before:bg-transparent",
                        "hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-foreground data-active:before:bg-primary",
                        // Collapsed: the icon centers in the rail; drop the leading
                        // rule so the active marker never sits lopsided beside it.
                        "group-data-[collapsible=icon]:before:hidden",
                      )}
                    >
                      <item.icon className="size-4 opacity-70" />
                      <span>{t(item.key)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer band — mirrors the h-16 masthead so its top rule aligns with
            the main column's pagination rule, bookending the shell top ⇄ bottom. */}
        <SidebarFooter className="h-16 shrink-0 justify-center gap-0 border-t border-sidebar-border px-2 py-0 group-data-[collapsible=icon]:px-0">
          <InspectorCard />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-svh min-w-0 overflow-hidden bg-background">
        <AppBar slotRef={setHeaderSlot} />
        <HeaderSlotContext.Provider value={headerSlot}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </HeaderSlotContext.Provider>
      </SidebarInset>
      {/* Scroll to top on navigation; restore on back/forward. */}
      <ScrollRestoration />
    </SidebarProvider>
  )
}
