import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { FolderCheck, Settings, Plus, ChevronLeft } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CASES } from "@/lib/mock";

const NAV = [
  { to: "/app", label: "Проверки", Icon: FolderCheck, end: true },
  { to: "/app/settings", label: "Настройки", Icon: Settings, end: false },
];

export function DashboardLayout() {
  const { pathname } = useLocation();
  const inWizard = pathname.startsWith("/app/new");

  return (
    <div className="flex min-h-svh bg-muted/40">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link to="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Wordmark />
          </Link>
        </div>

        <div className="p-3">
          <Link
            to="/app/new"
            className={cn(buttonVariants({ size: "lg" }), "w-full justify-start gap-2")}
          >
            <Plus />
            Новая проверка
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 px-3">
          <p className="px-3 pb-1.5 font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
            Недавние
          </p>
          <ul className="flex flex-col gap-0.5">
            {CASES.map((c) => (
              <li key={c.id}>
                <NavLink
                  to={`/app/case/${c.id}`}
                  className={({ isActive }) =>
                    cn(
                      "block truncate rounded-lg px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )
                  }
                >
                  {c.applicant}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto border-t border-border p-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
              ИП
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">Инспектор приёма</p>
              <p className="truncate font-mono text-[0.62rem] text-muted-foreground">
                ASAN · 1-е Бакинское ТУ
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
          <Link to="/">
            <Wordmark subtitle={false} />
          </Link>
          {!inWizard && (
            <Link
              to="/app/new"
              className={cn(buttonVariants({ size: "sm" }), "ml-auto gap-1.5")}
            >
              <Plus />
              Новая
            </Link>
          )}
          {inWizard && (
            <Link
              to="/app"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto gap-1.5")}
            >
              <ChevronLeft />К проверкам
            </Link>
          )}
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
