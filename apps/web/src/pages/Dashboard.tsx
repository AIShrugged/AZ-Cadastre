import { Link } from "react-router-dom";
import { Plus, ArrowUpRight, FolderCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CaseStatusBadge } from "@/components/status";
import { cn } from "@/lib/utils";
import { CASES, STATUS_LABEL, countByLevel } from "@/lib/mock";

export function Dashboard() {
  const total = CASES.length;
  const ok = CASES.filter((c) => c.status === "ok").length;
  const attention = CASES.filter((c) => c.status !== "ok").length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Проверки</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Пакеты документов для госрегистрации недвижимости
          </p>
        </div>
        <Link to="/app/new" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
          <Plus />
          Новая проверка
        </Link>
      </div>

      {/* Stat row — real counts from the case set */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { v: total, l: "всего дел", c: "text-foreground" },
          { v: ok, l: "комплектно", c: "text-success" },
          { v: attention, l: "требуют внимания", c: "text-destructive" },
        ].map((t) => (
          <div key={t.l} className="rounded-xl border border-border bg-card px-4 py-4">
            <div className={cn("tnum text-2xl font-semibold", t.c)}>{t.v}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.l}</div>
          </div>
        ))}
      </div>

      {/* Case list */}
      <div className="mt-8">
        <div className="mb-2 flex items-center gap-2 px-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <FolderCheck className="size-3.5" />
          Дела
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {CASES.map((c, i) => {
            const counts = countByLevel(c.checks);
            const flags = counts.fail + counts.warn;
            return (
              <Link
                key={c.id}
                to={`/app/case/${c.id}`}
                className={cn(
                  "flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none sm:px-5",
                  i > 0 && "border-t border-border",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="truncate font-medium">{c.applicant}</span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                      {c.id}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {c.district} · участок{" "}
                    <span className="tnum font-medium text-foreground">{c.plot}</span>
                  </p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <div className="tnum text-sm font-medium">
                    {c.docCount} <span className="text-muted-foreground">док.</span>
                  </div>
                  <div className="tnum font-mono text-[0.68rem] text-muted-foreground">
                    {flags > 0 ? `${flags} флаг.` : "без флагов"}
                  </div>
                </div>

                <div className="hidden shrink-0 font-mono text-xs text-muted-foreground md:block">
                  {c.submittedAt}
                </div>

                <div className="shrink-0">
                  <CaseStatusBadge status={c.status} />
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
        <p className="mt-3 px-1 text-xs text-muted-foreground">
          Статусы: {STATUS_LABEL.ok} · {STATUS_LABEL.remarks} · {STATUS_LABEL.incomplete}.
          Система помечает расхождения, решение принимает инспектор.
        </p>
      </div>
    </div>
  );
}
