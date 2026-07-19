import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileText,
  Check,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  CloudUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CaseReport } from "@/components/CaseReport";
import { cn } from "@/lib/utils";
import { CASES, PIPELINE_STAGES, type VerificationCase } from "@/lib/mock";

const STEPS = ["Загрузка", "Проверка", "Результаты"];

export function Wizard() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<VerificationCase | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
      <div className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Новая проверка пакета
      </div>
      <Stepper step={step} />

      <div className="mt-8">
        {step === 0 && (
          <StepUpload
            selected={selected}
            onSelect={setSelected}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && selected && (
          <StepVerify onDone={() => setStep(2)} onBack={() => setStep(0)} />
        )}
        {step === 2 && selected && (
          <StepResults data={selected} onRestart={() => { setSelected(null); setStep(0); }} />
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-sm font-medium transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1 origin-left transition-colors",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Step 1 · Upload ─────────────────────────────────────────────────────── */

function StepUpload({
  selected,
  onSelect,
  onNext,
}: {
  selected: VerificationCase | null;
  onSelect: (c: VerificationCase) => void;
  onNext: () => void;
}) {
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mocked: any real drop/select "recognizes" the incomplete demo package.
  const loadDemoFromUpload = () => onSelect(CASES[1]);

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => { e.preventDefault(); setDragover(false); loadDemoFromUpload(); }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragover ? "border-primary bg-primary/5" : "border-border bg-muted/40",
        )}
      >
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <CloudUpload className="size-6" />
        </div>
        <p className="mt-4 font-medium">Перетащите пакет документов</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF (сканы и цифровые), JPG, PNG · многостраничные · несколько типов в файле
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={loadDemoFromUpload}
        />
        <Button
          variant="outline"
          className="mt-5 gap-2"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          Выбрать файлы
        </Button>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Или откройте демонстрационный пакет
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CASES.map((c) => {
            const active = selected?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={cn(
                  "rounded-xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.applicant}</span>
                  {active && <Check className="size-4 shrink-0 text-primary" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.district}</p>
                <p className="mt-2 tnum font-mono text-[0.68rem] text-muted-foreground">
                  {c.docCount} документов · участок {c.plot}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">
              Распознано документов:{" "}
              <span className="tnum">{selected.documents.length}</span>
            </p>
            <Badge tone="info" className="font-mono">классификация</Badge>
          </div>
          <ul className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto">
            {selected.documents.map((d, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{d.ru}</p>
                  <p className="truncate font-mono text-[0.62rem] text-muted-foreground">
                    {d.code} · {d.pages} с.
                  </p>
                </div>
                <span className="tnum shrink-0 font-mono text-[0.68rem] text-muted-foreground">
                  {Math.round(d.confidence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="lg" className="gap-2" disabled={!selected} onClick={onNext}>
          Запустить проверку
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Step 2 · Verify (mocked progress) ───────────────────────────────────── */

function StepVerify({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [active, setActive] = useState(0); // index of stage in progress
  const total = PIPELINE_STAGES.length;
  const done = active >= total;

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setActive((a) => a + 1), 700);
    return () => clearTimeout(t);
  }, [active, done, onDone]);

  const pct = Math.min(active / total, 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
          <div>
            <p className="font-medium">Идёт проверка пакета</p>
            <p className="text-sm text-muted-foreground">
              Распознавание, извлечение полей и сверка согласованности
            </p>
          </div>
          <span className="tnum ml-auto font-mono text-sm text-muted-foreground">
            {Math.round(pct * 100)}%
          </span>
        </div>

        {/* transform-based fill (no layout animation) */}
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${pct})` }}
          />
        </div>

        <ol className="mt-6 flex flex-col gap-3">
          {PIPELINE_STAGES.map((s, i) => {
            const isDone = i < active;
            const isRunning = i === active;
            return (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                    isDone && "border-success bg-success text-success-foreground",
                    isRunning && "border-primary text-primary",
                    !isDone && !isRunning && "border-border text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <Check className="size-3.5" />
                  ) : isRunning ? (
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm transition-colors",
                    isDone || isRunning ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" className="gap-2" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Назад
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          disabled={!done}
          onClick={onDone}
        >
          Результаты
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Step 3 · Results ────────────────────────────────────────────────────── */

function StepResults({
  data,
  onRestart,
}: {
  data: VerificationCase;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-6">
      <CaseReport data={data} />
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" className="gap-2" onClick={onRestart}>
          <RotateCcw className="size-4" />
          Новая проверка
        </Button>
        <Button className="gap-2" onClick={() => navigate(`/app/case/${data.id}`)}>
          Открыть дело
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
