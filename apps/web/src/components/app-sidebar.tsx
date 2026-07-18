import { LandPlotIcon } from "lucide-react";
import type { CaseSummary } from "@cadastre/contracts";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatusDot } from "@/components/status-badge";
import { CASE_STATUS_TONE } from "@/lib/format";

export function AppSidebar({
  cases,
  loading,
  selectedId,
  onSelect,
}: {
  cases: CaseSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <LandPlotIcon className="size-4.5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-display text-base leading-none">
              AZ-Cadastre
            </span>
            <span className="mt-1 truncate text-xs text-muted-foreground">
              Приёмка документов
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Дела</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))
                : cases.map((c) => (
                    <SidebarMenuItem key={c.id}>
                      <SidebarMenuButton
                        size="lg"
                        isActive={c.id === selectedId}
                        onClick={() => onSelect(c.id)}
                        className="data-[active=true]:shadow-[inset_2px_0_0_var(--brand)]"
                      >
                        <StatusDot tone={CASE_STATUS_TONE[c.status]} />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {c.applicant}
                          </span>
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {c.parcelId}
                          </span>
                        </div>
                      </SidebarMenuButton>
                      {c.openFlagCount > 0 && (
                        <SidebarMenuBadge className="text-status-incomplete">
                          {c.openFlagCount}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
