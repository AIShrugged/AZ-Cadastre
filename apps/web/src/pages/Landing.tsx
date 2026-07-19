import { Link } from "react-router-dom";
import {
  ArrowRight,
  Upload,
  ScanText,
  ListChecks,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CaseStatusBadge, CheckLevelIcon } from "@/components/status";
import { cn } from "@/lib/utils";
import { SERVICES, CASES, countByLevel } from "@/lib/mock";

const PIPELINE = [
  { Icon: Upload, title: "Загрузка", body: "Пакет PDF/JPG, многостраничные сканы. Разбивка на страницы." },
  { Icon: ScanText, title: "Распознавание", body: "Классификация типа документа, OCR, извлечение полей." },
  { Icon: ListChecks, title: "Проверка", body: "Полнота, корректность заполнения, согласованность пакета." },
  { Icon: FileCheck2, title: "Отчёт", body: "Статус, флаги с привязкой к странице, уверенность модели, JSON." },
];

const CHECKS = [
  { tag: "A", title: "Полнота пакета", body: "Присутствуют ли все обязательные документы услуги «первичная регистрация»: заявление, ID, правоустанавливающий, план, проект + лицензия, уведомление, квитанция, договор оценки." },
  { tag: "B", title: "Корректность заполнения", body: "Непустые обязательные поля, подпись и дата заявителя, печати на актах, действительность лицензии, корректность фамилии в правоустанавливающих." },
  { tag: "C", title: "Согласованность документов", body: "Сверка ФИО, адреса, № участка, площадей, комнат и высот по всему пакету. Малое отклонение обмера — норма, значимое — флаг." },
  { tag: "D", title: "Dövriyyə / Ekspertiza vərəqi", body: "Формализация проверок отделов: ограничения, архивные списки MQS, пересечения с соседями, ст. 8 Закона, «sənəd-əsaslar». Спорные — на ручную проверку." },
];

export function Landing() {
  return (
    <div className="min-h-svh bg-background">
      {/* N1b masthead */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Wordmark />
          </Link>
          <nav className="ml-4 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#pipeline" className="transition-colors hover:text-foreground">Как работает</a>
            <a href="#checks" className="transition-colors hover:text-foreground">Проверки</a>
            <a href="#services" className="transition-colors hover:text-foreground">Услуги</a>
          </nav>
          <Link
            to="/app"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}
          >
            Открыть панель
          </Link>
          <Link
            to="/app/new"
            className={cn(buttonVariants({ size: "sm" }), "hidden gap-1.5 sm:inline-flex")}
          >
            Создать проверку
          </Link>
        </div>
      </header>

      {/* Hero — workbench split */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Госкадастр · ASAN xidmət
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
            Приём и проверка документов госрегистрации — без ручной сверки
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Загрузка пакета, распознавание типов документов и проверка полноты,
            корректности заполнения и согласованности. Отчёт с флагами для
            инспектора — не автоматический отказ или одобрение.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/app/new"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              Создать проверку
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/app"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Панель инспектора
            </Link>
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            4 услуги в одном заявлении: регистрация прав · техпаспорт · адрес · оценка
          </p>
        </div>

        {/* Composed report preview (real content, not fake chrome) */}
        <HeroPreview />
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Пайплайн приёма
            </h2>
            <p className="mt-3 text-muted-foreground">
              От загрузки пакета до машиночитаемого JSON для интеграции с
              реестром и ASAN.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map(({ Icon, title, body }, i) => (
              <div
                key={title}
                className="relative rounded-xl border border-border bg-background p-5"
              >
                <span className="tnum font-mono text-xs text-muted-foreground">
                  0{i + 1}
                </span>
                <Icon className="mt-3 size-6 text-primary" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checks A/B/C/D */}
      <section id="checks" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Четыре группы правил
          </h2>
          <p className="mt-3 text-muted-foreground">
            Ядро системы — согласованность пакета: одни и те же ФИО, адрес,
            участок и площади должны сходиться во всех документах.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {CHECKS.map(({ tag, title, body }) => (
            <div key={tag} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary">
                  {tag}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Услуги в заявлении
              </h2>
              <p className="mt-2 text-muted-foreground">
                Первичная регистрация индивидуального жилого дома объединяет
                четыре услуги.
              </p>
            </div>
            <Badge tone="info" className="font-mono">4 в одном пакете</Badge>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <div
                key={s.code}
                className="rounded-xl border border-border bg-background p-5"
              >
                <span className="tnum font-mono text-xs text-primary">
                  0{i + 1}
                </span>
                <p className="mt-2 font-medium">{s.ru}</p>
                <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">
                  {s.code}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="rounded-2xl border border-border bg-primary px-8 py-12 text-center text-primary-foreground">
          <h2 className="mx-auto max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Проверьте первый пакет документов
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Загрузите сканы дела — система разложит их по типам и вернёт чеклист
            с флагами за секунды.
          </p>
          <Link
            to="/app/new"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "mt-7 gap-2",
            )}
          >
            Создать проверку
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Ft5 statement footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              ПЮЛ «Государственный кадастр и реестр недвижимости» при Госслужбе по
              имущественным вопросам · 1-е Бакинское территориальное управление.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Прототип · помощник инспектора
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeroPreview() {
  // Real data from the incomplete demo case — every number below is derived.
  const c = CASES[1];
  const counts = countByLevel(c.checks);
  const tiles = [
    { v: counts.ok, l: "пройдено", cls: "text-success" },
    { v: counts.warn, l: "замечания", cls: "text-warning-foreground" },
    { v: counts.fail, l: "ошибки", cls: "text-destructive" },
  ];
  // First few flags, in fail → ok order, straight from the case checks.
  const rows = [...c.checks]
    .sort((a, b) => (a.level === "fail" ? -1 : 1) - (b.level === "fail" ? -1 : 1))
    .slice(0, 4);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{c.applicant}</p>
          <p className="truncate font-mono text-[0.68rem] text-muted-foreground">
            {c.id} · Забрат
          </p>
        </div>
        <CaseStatusBadge status={c.status} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.l} className="rounded-lg border border-border bg-background px-3 py-2">
            <div className={cn("tnum text-lg font-semibold", t.cls)}>{t.v}</div>
            <div className="text-[0.68rem] text-muted-foreground">{t.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            <CheckLevelIcon level={r.level} />
            <span className="truncate text-foreground/90">{r.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
