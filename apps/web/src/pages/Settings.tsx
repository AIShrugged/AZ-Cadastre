import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DOC_TYPES } from "@/lib/mock";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-primary" : "bg-input"
      }`}
      aria-hidden="true"
    >
      <span
        className={`inline-block size-4 rounded-full bg-background transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}

export function Settings() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Параметры приёма и правил проверки. Прототип — значения демонстрационные.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Правила проверки</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {[
              { t: "A · Полнота пакета", d: "Наличие всех обязательных документов", on: true },
              { t: "B · Корректность заполнения", d: "Поля, подписи, печати, лицензии", on: true },
              { t: "C · Согласованность", d: "Сверка ФИО, участка, площадей по пакету", on: true },
              { t: "D · Dövriyyə / Ekspertiza", d: "Ограничения, MQS, ст. 8 — спорное на ручную проверку", on: false },
            ].map((r) => (
              <div key={r.t} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.t}</p>
                  <p className="text-xs text-muted-foreground">{r.d}</p>
                </div>
                <Toggle on={r.on} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Порог допустимого отклонения обмера</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Расхождение sənəd → faktiki свыше порога помечается флагом
              </p>
              <span className="tnum rounded-lg border border-border bg-muted px-3 py-1 font-mono text-sm font-medium">
                ± 2.0 м²
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Типы документов · {DOC_TYPES.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {DOC_TYPES.map((d) => (
              <Badge key={d.code} tone={d.required ? "info" : "neutral"}>
                {d.code}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Интеграция</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Выгрузка JSON в реестр / ASAN</p>
              <p className="text-xs text-muted-foreground">
                Машинный формат извлечённых полей
              </p>
            </div>
            <Badge tone="warning" className="font-mono">в разработке</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
