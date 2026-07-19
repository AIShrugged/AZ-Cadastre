// Synthetic data for the POC. Grounded in the two sample cases from the ТЗ:
//   · Əliyeva Rübabə  — Бузовна, Хазарский р-н, участок 5-862 — комплект OK
//   · Rusadze Vera Vladimirovna — Забрат, Сабунчинский р-н — планированные дефекты
// UI copy is Russian; document-type names stay in Azerbaijani (latin) per the source.

export type CaseStatus = "ok" | "remarks" | "incomplete";
export type CheckLevel = "ok" | "warn" | "fail" | "manual";

/** Canonical document types for «первичная регистрация индивидуального жилого дома». */
export interface DocType {
  code: string; // Azerbaijani (latin)
  ru: string; // Russian gloss
  required: boolean;
}

export const DOC_TYPES: DocType[] = [
  { code: "ərizə", ru: "Заявление", required: true },
  { code: "şəxsiyyət vəsiqəsi", ru: "Удостоверение личности", required: true },
  { code: "sərəncam / arxiv arayışı", ru: "Правоустанавливающий документ", required: true },
  { code: "plan-sxem", ru: "План-схема участка", required: true },
  { code: "layihə / memarlıq həlli", ru: "Проект / арх. решение", required: true },
  { code: "lisenziya", ru: "Лицензия проектировщика", required: true },
  { code: "məlumatlandırma ərizəsi", ru: "Уведомление", required: true },
  { code: "qəbz", ru: "Квитанция об оплате", required: true },
  { code: "qiymətləndirmə müqaviləsi", ru: "Договор оценки", required: true },
  { code: "texniki pasport", ru: "Технический паспорт", required: false },
  { code: "müayinə aktı", ru: "Акт осмотра", required: false },
];

/** The four bundled services every application combines. */
export const SERVICES = [
  { code: "birincili qeydiyyat", ru: "Первичная регистрация прав" },
  { code: "texniki pasport", ru: "Первичный техпаспорт" },
  { code: "ünvan verilməsi", ru: "Присвоение адреса" },
  { code: "qiymətləndirmə", ru: "Оценка" },
];

export interface ExtractedField {
  label: string;
  value: string;
  mono?: boolean;
  confidence: number; // 0..1 model confidence
}

export interface CheckItem {
  group: "A" | "B" | "C" | "D";
  title: string;
  level: CheckLevel;
  note?: string;
  page?: string; // «document · page»
  confidence?: number;
}

export interface DocPage {
  code: string; // detected DocType.code
  ru: string;
  pages: number;
  quality: "digital" | "scan" | "poor";
  confidence: number;
}

export interface VerificationCase {
  id: string;
  applicant: string;
  district: string;
  plot: string;
  submittedAt: string;
  status: CaseStatus;
  services: number;
  docCount: number;
  documents: DocPage[];
  fields: ExtractedField[];
  checks: CheckItem[];
}

export const GROUP_LABELS: Record<CheckItem["group"], string> = {
  A: "Полнота пакета",
  B: "Корректность заполнения",
  C: "Согласованность документов",
  D: "Dövriyyə / Ekspertiza vərəqi",
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  ok: "Комплектно",
  remarks: "Замечания",
  incomplete: "Некомплект",
};

// ─────────────────────────────────────────────────────────────────────────────

export const CASES: VerificationCase[] = [
  {
    id: "AZ-2026-05-862",
    applicant: "Əliyeva Rübabə",
    district: "Бузовна · Хазарский р-н",
    plot: "5-862",
    submittedAt: "2026-07-14",
    status: "ok",
    services: 4,
    docCount: 11,
    documents: [
      { code: "ərizə", ru: "Заявление", pages: 2, quality: "scan", confidence: 0.92 },
      { code: "şəxsiyyət vəsiqəsi", ru: "Удостоверение личности", pages: 2, quality: "scan", confidence: 0.88 },
      { code: "sərəncam / arxiv arayışı", ru: "Правоустанавливающий", pages: 1, quality: "poor", confidence: 0.79 },
      { code: "plan-sxem", ru: "План-схема", pages: 1, quality: "digital", confidence: 0.97 },
      { code: "layihə / memarlıq həlli", ru: "Проект", pages: 6, quality: "digital", confidence: 0.98 },
      { code: "lisenziya", ru: "Лицензия проектировщика", pages: 1, quality: "scan", confidence: 0.9 },
      { code: "məlumatlandırma ərizəsi", ru: "Уведомление", pages: 1, quality: "scan", confidence: 0.86 },
      { code: "qəbz", ru: "Квитанция", pages: 1, quality: "poor", confidence: 0.74 },
      { code: "qiymətləndirmə müqaviləsi", ru: "Договор оценки", pages: 3, quality: "digital", confidence: 0.95 },
      { code: "texniki pasport", ru: "Техпаспорт", pages: 4, quality: "digital", confidence: 0.99 },
      { code: "müayinə aktı", ru: "Акт осмотра", pages: 1, quality: "digital", confidence: 0.96 },
    ],
    fields: [
      { label: "ФИО заявителя", value: "Əliyeva Rübabə", confidence: 0.94 },
      { label: "№ удостоверения", value: "AZE 5482106", mono: true, confidence: 0.9 },
      { label: "Адрес объекта", value: "Бузовна, Хазарский р-н", confidence: 0.88 },
      { label: "№ участка", value: "5-862", mono: true, confidence: 0.97 },
      { label: "№ распоряжения", value: "R-1180 / 12.03.2026", mono: true, confidence: 0.85 },
      { label: "Площадь (sənəd)", value: "142.0 м²", mono: true, confidence: 0.93 },
      { label: "Площадь (faktiki)", value: "142.6 м²", mono: true, confidence: 0.95 },
      { label: "Комнаты", value: "4", mono: true, confidence: 0.96 },
      { label: "ВÖEN оценщика", value: "1300457821", mono: true, confidence: 0.91 },
    ],
    checks: [
      { group: "A", title: "Все 9 обязательных документов присутствуют", level: "ok" },
      { group: "B", title: "Подпись и дата заявителя на заявлении", level: "ok", page: "ərizə · с. 2" },
      { group: "B", title: "Печати и подписи на акте осмотра", level: "ok", page: "müayinə aktı · с. 1" },
      { group: "B", title: "Лицензия проектировщика действительна", level: "ok", note: "срок до 2028-01" },
      { group: "C", title: "ФИО совпадает во всех документах", level: "ok" },
      { group: "C", title: "№ участка 5-862 совпадает в техпаспорте, акте, проекте", level: "ok" },
      {
        group: "C",
        title: "Отклонение обмера площади 0.6 м² (sənəd → faktiki)",
        level: "ok",
        note: "в пределах нормы обмера",
      },
      { group: "D", title: "Ограничений/отказов не зарегистрировано", level: "ok" },
      { group: "D", title: "Наличие в архивных списках MQS", level: "ok" },
      {
        group: "D",
        title: "Пересечения с соседями по кадастру — на ручную проверку",
        level: "manual",
        note: "спорный контур, требуется инспектор",
      },
    ],
  },
  {
    id: "AZ-2026-07-311",
    applicant: "Rusadze Vera Vladimirovna",
    district: "Забрат · Сабунчинский р-н",
    plot: "7-311",
    submittedAt: "2026-07-16",
    status: "incomplete",
    services: 4,
    docCount: 8,
    documents: [
      { code: "ərizə", ru: "Заявление", pages: 2, quality: "poor", confidence: 0.68 },
      { code: "şəxsiyyət vəsiqəsi", ru: "Удостоверение личности", pages: 1, quality: "poor", confidence: 0.71 },
      { code: "sərəncam / arxiv arayışı", ru: "Правоустанавливающий", pages: 2, quality: "poor", confidence: 0.64 },
      { code: "plan-sxem", ru: "План-схема", pages: 1, quality: "scan", confidence: 0.83 },
      { code: "layihə / memarlıq həlli", ru: "Проект", pages: 5, quality: "digital", confidence: 0.97 },
      { code: "məlumatlandırma ərizəsi", ru: "Уведомление", pages: 1, quality: "scan", confidence: 0.8 },
      { code: "qiymətləndirmə müqaviləsi", ru: "Договор оценки", pages: 3, quality: "digital", confidence: 0.94 },
      { code: "texniki pasport", ru: "Техпаспорт", pages: 4, quality: "digital", confidence: 0.98 },
    ],
    fields: [
      { label: "ФИО заявителя", value: "Rusadze Vera Vladimirovna", confidence: 0.7 },
      { label: "ФИО (правоустанавл.)", value: "Qusadze Vera Vladimirovna", confidence: 0.62 },
      { label: "№ удостоверения", value: "AZE 6120934", mono: true, confidence: 0.66 },
      { label: "Адрес объекта", value: "Забрат, Сабунчинский р-н", confidence: 0.81 },
      { label: "№ участка", value: "7-311", mono: true, confidence: 0.9 },
      { label: "Площадь (sənəd)", value: "118.0 м²", mono: true, confidence: 0.88 },
      { label: "Площадь (faktiki)", value: "126.4 м²", mono: true, confidence: 0.92 },
      { label: "Площадь (проект)", value: "118.0 м²", mono: true, confidence: 0.95 },
      { label: "Комнаты", value: "3", mono: true, confidence: 0.9 },
    ],
    checks: [
      {
        group: "A",
        title: "Отсутствует лицензия проектировщика (lisenziya)",
        level: "fail",
        note: "обязательный документ для услуги «проект»",
      },
      {
        group: "A",
        title: "Отсутствует квитанция об оплате (qəbz)",
        level: "fail",
      },
      { group: "A", title: "Отсутствует акт осмотра (müayinə aktı)", level: "warn", note: "формируется при выезде" },
      {
        group: "B",
        title: "Фамилия в правоустанавливающем: «Qusadze» ≠ «Rusadze»",
        level: "fail",
        page: "sərəncam · с. 1",
        note: "вероятная опечатка ‹Q›→‹R›, требуется исправление",
        confidence: 0.62,
      },
      {
        group: "B",
        title: "Не читается дата подписи заявителя",
        level: "warn",
        page: "ərizə · с. 2",
        note: "плохое качество скана",
      },
      { group: "C", title: "№ участка 7-311 совпадает в техпаспорте и проекте", level: "ok" },
      {
        group: "C",
        title: "Расхождение площади: sənəd 118.0 vs faktiki 126.4 м² (+8.4)",
        level: "fail",
        note: "значимое отклонение — превышает норму обмера",
      },
      {
        group: "C",
        title: "Кол-во комнат совпадает (3) в техпаспорте и проекте",
        level: "ok",
      },
      {
        group: "D",
        title: "Проверка ст. 8 Закона о госреестре — на ручную проверку",
        level: "manual",
      },
      {
        group: "D",
        title: "«sənəd-əsaslar» неполны — запрос в архив MQS",
        level: "manual",
      },
    ],
  },
];

/** Stages of the mocked verification pipeline (wizard step 2). */
export const PIPELINE_STAGES = [
  { key: "split", label: "Разбивка PDF на страницы" },
  { key: "classify", label: "Классификация типов документов" },
  { key: "extract", label: "Извлечение полей (OCR + structured)" },
  { key: "completeness", label: "Проверка полноты пакета" },
  { key: "consistency", label: "Сверка согласованности" },
  { key: "report", label: "Формирование отчёта" },
] as const;

export function countByLevel(checks: CheckItem[]) {
  return checks.reduce(
    (acc, c) => {
      acc[c.level] += 1;
      return acc;
    },
    { ok: 0, warn: 0, fail: 0, manual: 0 } as Record<CheckLevel, number>,
  );
}
