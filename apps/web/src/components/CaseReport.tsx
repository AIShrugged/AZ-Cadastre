import { FileText, Download, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CaseStatusBadge, CheckLevelIcon } from "@/components/status";
import {
  GROUP_LABELS,
  countByLevel,
  type CheckItem,
  type VerificationCase,
} from "@/lib/mock";

const QUALITY_LABEL: Record<string, string> = {
  digital: "цифровой",
  scan: "скан",
  poor: "плохой скан",
};

function SummaryTile({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <div className={`tnum text-2xl font-semibold ${className ?? ""}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function CaseReport({ data }: { data: VerificationCase }) {
  const counts = countByLevel(data.checks);
  const groups: CheckItem["group"][] = ["A", "B", "C", "D"];

  return (
    <div className="flex flex-col gap-6">
      {/* Verdict header */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <CaseStatusBadge status={data.status} />
                <span className="font-mono text-xs text-muted-foreground">
                  {data.id}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {data.applicant}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {data.district}
                <span className="text-border">·</span>
                участок <span className="tnum font-medium text-foreground">{data.plot}</span>
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Download className="size-4" />
              Отчёт PDF
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile value={counts.ok} label="Пройдено" className="text-success" />
            <SummaryTile value={counts.warn} label="Замечания" className="text-warning-foreground" />
            <SummaryTile value={counts.fail} label="Ошибки" className="text-destructive" />
            <SummaryTile value={counts.manual} label="Ручная проверка" className="text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">
            Система — помощник инспектора. Итоговое решение по пакету принимает
            сотрудник приёма.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Checks by group */}
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const items = data.checks.filter((c) => c.group === g);
            if (!items.length) return null;
            return (
              <Card key={g}>
                <CardHeader className="flex-row items-center gap-2.5">
                  <span className="grid size-6 place-items-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">
                    {g}
                  </span>
                  <CardTitle>{GROUP_LABELS[g]}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col divide-y divide-border">
                  {items.map((c, i) => (
                    <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <CheckLevelIcon level={c.level} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{c.title}</p>
                        {c.note && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.note}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {c.page && (
                            <span className="font-mono text-[0.68rem] text-muted-foreground">
                              {c.page}
                            </span>
                          )}
                          {c.confidence !== undefined && (
                            <Badge tone="outline" className="tnum">
                              увер. {Math.round(c.confidence * 100)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Right rail: extracted fields + documents */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Извлечённые поля</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {data.fields.map((f, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="flex items-center gap-2 text-right">
                    <span
                      className={`text-sm font-medium ${f.mono ? "tnum font-mono" : ""}`}
                    >
                      {f.value}
                    </span>
                    <span
                      className={`tnum w-9 shrink-0 text-right font-mono text-[0.62rem] ${
                        f.confidence < 0.75
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Документы пакета · {data.documents.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {data.documents.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.ru}</p>
                    <p className="truncate font-mono text-[0.62rem] text-muted-foreground">
                      {d.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="tnum font-mono text-[0.68rem] text-muted-foreground">
                      {d.pages} с.
                    </span>
                    <Badge
                      tone={d.quality === "poor" ? "warning" : "neutral"}
                      className="px-1.5 py-0"
                    >
                      {QUALITY_LABEL[d.quality]}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
