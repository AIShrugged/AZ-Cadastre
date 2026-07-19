import { useState } from "react";
import {
  FileText,
  Download,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckLevelIcon } from "@/components/status";
import { cn } from "@/lib/utils";
import {
  GROUP_LABELS,
  STATUS_LABEL,
  countByLevel,
  type CaseStatus,
  type CheckItem,
  type CheckLevel,
  type VerificationCase,
} from "@/lib/mock";

/* ── Severity vocabulary (rails, tints, ordering) ───────────────────────── */

const SEV: Record<
  CheckLevel,
  { rail: string; tint: string; bar: string; label: string; rank: number }
> = {
  fail: { rail: "border-l-destructive", tint: "bg-destructive/[0.05]", bar: "bg-destructive", label: "Ошибка", rank: 0 },
  warn: { rail: "border-l-warning", tint: "bg-warning/[0.09]", bar: "bg-warning", label: "Замечание", rank: 1 },
  manual: { rail: "border-l-primary", tint: "bg-primary/[0.05]", bar: "bg-primary", label: "Ручная проверка", rank: 2 },
  ok: { rail: "border-l-success", tint: "bg-success/[0.06]", bar: "bg-success", label: "Пройдено", rank: 3 },
};

const VERDICT: Record<
  CaseStatus,
  { Icon: typeof CheckCircle2; text: string; chip: string; border: string; tint: string }
> = {
  ok: {
    Icon: CheckCircle2,
    text: "text-success",
    chip: "bg-success/12 text-success",
    border: "border-success/30",
    tint: "bg-success/[0.04]",
  },
  remarks: {
    Icon: AlertTriangle,
    text: "text-warning-foreground",
    chip: "bg-warning/20 text-warning-foreground",
    border: "border-warning/40",
    tint: "bg-warning/[0.06]",
  },
  incomplete: {
    Icon: XCircle,
    text: "text-destructive",
    chip: "bg-destructive/10 text-destructive",
    border: "border-destructive/30",
    tint: "bg-destructive/[0.04]",
  },
};

/* ── Russian pluralization + human summary ──────────────────────────────── */

function plural(n: number, [one, few, many]: [string, string, string]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

function summarize(data: VerificationCase): string {
  const missing = data.checks.filter((c) => c.group === "A" && c.level === "fail").length;
  const errors = data.checks.filter((c) => c.group !== "A" && c.level === "fail").length;
  const c = countByLevel(data.checks);

  const clauses: string[] = [];
  if (missing > 0)
    clauses.push(
      `не хватает ${missing} ${plural(missing, ["обязательного документа", "обязательных документов", "обязательных документов"])}`,
    );
  if (errors > 0)
    clauses.push(
      `${errors} ${plural(errors, ["значимое расхождение", "значимых расхождения", "значимых расхождений"])}`,
    );
  if (c.warn > 0)
    clauses.push(`${c.warn} ${plural(c.warn, ["замечание", "замечания", "замечаний"])}`);
  if (c.manual > 0)
    clauses.push(
      `${c.manual} ${plural(c.manual, ["пункт", "пункта", "пунктов"])} — на ручную проверку`,
    );

  const tail = clauses.length ? clauses.join(" · ") + "." : "";
  const lead =
    data.status === "incomplete"
      ? "Приём приостановлен до исправления. "
      : data.status === "remarks"
        ? "Пакет комплектен, есть замечания. "
        : "Пакет комплектен, критичных расхождений нет. ";
  return lead + tail;
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SeverityBar({ counts, total }: { counts: Record<CheckLevel, number>; total: number }) {
  const order: CheckLevel[] = ["fail", "warn", "manual", "ok"];
  const segs = order.filter((l) => counts[l] > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segs.map((l) => (
          <span key={l} className={SEV[l].bar} style={{ flexGrow: counts[l] }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {order.map((l) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-2 rounded-full ${SEV[l].bar}`} />
            <span className="tnum font-medium text-foreground">{counts[l]}</span>
            {SEV[l].label.toLowerCase()}
          </span>
        ))}
        <span className="tnum ml-auto font-mono text-[0.68rem] text-muted-foreground">
          {total} проверок
        </span>
      </div>
    </div>
  );
}

function CheckRow({ c }: { c: CheckItem }) {
  const hasMeta = c.page || c.confidence !== undefined;
  return (
    <li className={cn("flex gap-3 rounded-r-md border-l-2 py-2.5 pr-3 pl-3.5", SEV[c.level].rail, SEV[c.level].tint)}>
      <CheckLevelIcon level={c.level} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium [overflow-wrap:anywhere]">{c.title}</p>
          <span
            title={GROUP_LABELS[c.group]}
            className="mt-px grid size-5 shrink-0 place-items-center rounded bg-foreground/[0.06] font-mono text-[0.62rem] font-semibold text-muted-foreground"
          >
            {c.group}
          </span>
        </div>
        {c.note && <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>}
        {hasMeta && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[0.66rem] text-muted-foreground">
            {c.page && <span>{c.page}</span>}
            {c.page && c.confidence !== undefined && <span className="text-border">·</span>}
            {c.confidence !== undefined && (
              <span className="tnum">увер. {Math.round(c.confidence * 100)}%</span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

/** Compact segmented toggle between flags and passed checks. */
function SegToggle({
  value,
  onChange,
  flags,
  passed,
}: {
  value: "flags" | "passed";
  onChange: (v: "flags" | "passed") => void;
  flags: number;
  passed: number;
}) {
  const opts = [
    { key: "flags" as const, label: "Внимание", n: flags },
    { key: "passed" as const, label: "Пройдено", n: passed },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            <span
              className={cn(
                "tnum rounded px-1 font-mono text-xs",
                active ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {o.n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function CaseReport({ data }: { data: VerificationCase }) {
  const counts = countByLevel(data.checks);
  const attention = [...data.checks]
    .filter((c) => c.level !== "ok")
    .sort((a, b) => SEV[a.level].rank - SEV[b.level].rank);
  const passed = data.checks.filter((c) => c.level === "ok");
  const v = VERDICT[data.status];
  const [tab, setTab] = useState<"flags" | "passed">(
    attention.length ? "flags" : "passed",
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Verdict banner */}
      <Card className={`overflow-hidden ${v.border} ${v.tint}`}>
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${v.chip}`}>
                <v.Icon className="size-7" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className={`text-2xl font-semibold tracking-tight ${v.text}`}>
                    {STATUS_LABEL[data.status]}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">{data.id}</span>
                </div>
                <p className="mt-1 truncate text-lg font-medium">{data.applicant}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {data.district}
                  <span className="text-border">·</span>
                  участок <span className="tnum font-medium text-foreground">{data.plot}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Download className="size-4" />
              Отчёт PDF
            </button>
          </div>

          {/* Plain-language summary */}
          <p className="max-w-2xl text-sm text-foreground/90">{summarize(data)}</p>

          <SeverityBar counts={counts} total={data.checks.length} />

          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            Система — помощник инспектора. Итоговое решение по пакету принимает
            сотрудник приёма.
          </p>
        </CardContent>
      </Card>

      {/* Checks — full width, one focused list at a time */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight">Результаты проверок</h3>
            <SegToggle value={tab} onChange={setTab} flags={attention.length} passed={passed.length} />
          </div>

          {tab === "flags" ? (
            attention.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {attention.map((c, i) => (
                  <CheckRow key={i} c={c} />
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/[0.06] px-4 py-4">
                <ShieldCheck className="size-5 shrink-0 text-success" />
                <p className="text-sm">
                  Расхождений и некомплекта не обнаружено — можно передавать инспектору.
                </p>
              </div>
            )
          ) : (
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {passed.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success/70" />
                  <span className="[overflow-wrap:anywhere]">{c.title}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Reference detail — fields + documents side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Extracted fields — scannable cell grid */}
        <Card>
          <CardHeader>
            <CardTitle>Извлечённые поля</CardTitle>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="size-3 text-warning-foreground" />
              жёлтым — низкая уверенность, проверьте вручную
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.fields.map((f, i) => {
              const low = f.confidence < 0.75;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    low ? "border-warning/40 bg-warning/[0.06]" : "border-border/70",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[0.7rem] text-muted-foreground">{f.label}</span>
                    <span
                      className={cn(
                        "tnum shrink-0 font-mono text-[0.6rem]",
                        low ? "text-warning-foreground" : "text-muted-foreground/70",
                      )}
                    >
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-medium [overflow-wrap:anywhere]",
                      f.mono && "tnum font-mono",
                    )}
                  >
                    {f.value}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Documents — compact, quality only flagged when poor */}
        <Card>
          <CardHeader>
            <CardTitle>Документы пакета · {data.documents.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {data.documents.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 py-2",
                  i > 0 && "border-t border-border/60",
                )}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.ru}</p>
                  <p className="truncate font-mono text-[0.62rem] text-muted-foreground">
                    {d.code}
                  </p>
                </div>
                {d.quality === "poor" && (
                  <span className="flex shrink-0 items-center gap-1 rounded bg-warning/[0.12] px-1.5 py-0.5 text-[0.66rem] font-medium text-warning-foreground">
                    <AlertTriangle className="size-3" />
                    плохой скан
                  </span>
                )}
                <span className="tnum shrink-0 font-mono text-[0.68rem] text-muted-foreground">
                  {d.pages} с.
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
