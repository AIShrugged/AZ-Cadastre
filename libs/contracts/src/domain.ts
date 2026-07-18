import { z } from "zod";

/**
 * Domain schemas for the inspector document-verification prototype.
 *
 * Terminology follows CONTEXT.md (Дело / Документ / Страница / Флаг ...).
 * Scope is deliberately narrow per ADR-0002: only Completeness (A) and
 * Consistency (C) checks; the inspector views a report and marks Flags.
 */

// ─── Fixed Azerbaijani document-type vocabulary ──────────────────────────────
export const DocumentType = z.enum([
  "erize", // ərizə — заявление
  "sexsiyyet_vesiqesi", // şəxsiyyət vəsiqəsi — удостоверение личности
  "serencam", // sərəncam — распоряжение (правоустанавливающий)
  "emrden_cixaris", // əmrdən çıxarış — выписка из приказа
  "arxiv_arayisi", // arxiv arayışı — архивная справка
  "plan_sxem", // plan-sxem — план-схема
  "layihe", // layihə / memarlıq həlli — проект
  "lisenziya", // lisenziya — лицензия
  "melumatlandirma_erizesi", // məlumatlandırma ərizəsi — уведомление
  "qebz", // qəbz — квитанция
  "qiymetlendirme_muqavilesi", // qiymətləndirmə müqaviləsi — договор оценки
  "texniki_pasport", // texniki pasport — техпаспорт
  "muayine_akti", // müayinə aktı — акт осмотра
  "unknown",
]);
export type DocumentType = z.infer<typeof DocumentType>;

/** Итог по Делу: OK / Замечания / Некомплект. */
export const CaseStatus = z.enum(["ok", "remarks", "incomplete"]);
export type CaseStatus = z.infer<typeof CaseStatus>;

/** Класс проверки — Полнота (A) или Согласованность (C). */
export const CheckType = z.enum(["completeness", "consistency"]);
export type CheckType = z.infer<typeof CheckType>;

export const CheckResult = z.enum(["pass", "warn", "fail"]);
export type CheckResult = z.infer<typeof CheckResult>;

/** Серьёзность Флага. */
export const FlagSeverity = z.enum(["low", "medium", "high"]);
export type FlagSeverity = z.infer<typeof FlagSeverity>;

/** Природа Флага. */
export const FlagKind = z.enum([
  "missing_document", // отсутствующий обязательный Тип документа
  "field_discrepancy", // расхождение значения поля между Документами
  "extraction_error", // ошибка/низкая уверенность извлечения
]);
export type FlagKind = z.infer<typeof FlagKind>;

/** Решение инспектора по Флагу. */
export const FlagDecision = z.enum(["pending", "accepted", "rejected"]);
export type FlagDecision = z.infer<typeof FlagDecision>;

/** Уверенность модели [0..1]. */
export const Confidence = z.number().min(0).max(1);

// ─── Entities ────────────────────────────────────────────────────────────────

/** Извлечённое поле — структурное значение, добытое LLM из Документа. */
export const ExtractedField = z.object({
  id: z.string(),
  /** Каноническое имя поля для сверки, напр. "applicant_name", "area_sqm". */
  key: z.string(),
  /** Человекочитаемая метка поля. */
  label: z.string(),
  value: z.string(),
  documentId: z.string(),
  pageNumber: z.number().int().positive(),
  confidence: Confidence,
});
export type ExtractedField = z.infer<typeof ExtractedField>;

/** Страница — единица классификации внутри исходного файла. */
export const Page = z.object({
  number: z.number().int().positive(),
  documentId: z.string(),
  type: DocumentType,
  confidence: Confidence,
});
export type Page = z.infer<typeof Page>;

/** Документ — логический документ одного Типа внутри Дела. */
export const CaseDocument = z.object({
  id: z.string(),
  type: DocumentType,
  /** Отображаемое имя Типа (на азербайджанском). */
  title: z.string(),
  pageNumbers: z.array(z.number().int().positive()).min(1),
  classificationConfidence: Confidence,
  fields: z.array(ExtractedField),
});
export type CaseDocument = z.infer<typeof CaseDocument>;

/** Значение одного поля в конкретном Документе (для Расхождения). */
export const DiscrepancyValue = z.object({
  documentId: z.string(),
  documentTitle: z.string(),
  value: z.string(),
});
export type DiscrepancyValue = z.infer<typeof DiscrepancyValue>;

/**
 * Расхождение — одно поле имеет разные значения в разных Документах.
 * Для площади несём процент отклонения; порог ±2% зашит в пайплайне.
 */
export const Discrepancy = z.object({
  fieldKey: z.string(),
  fieldLabel: z.string(),
  kind: z.enum(["text", "area"]),
  values: z.array(DiscrepancyValue).min(2),
  /** Только для kind = "area": относительное отклонение в процентах. */
  deltaPercent: z.number().nullable().default(null),
});
export type Discrepancy = z.infer<typeof Discrepancy>;

/** Флаг — помеченная проблема с решением инспектора. */
export const Flag = z.object({
  id: z.string(),
  checkType: CheckType,
  kind: FlagKind,
  severity: FlagSeverity,
  title: z.string(),
  description: z.string(),
  /** Привязка к Документу, если применимо. */
  documentId: z.string().nullable().default(null),
  /** Привязка к странице исходного файла, если применимо. */
  pageNumber: z.number().int().positive().nullable().default(null),
  discrepancy: Discrepancy.nullable().default(null),
  decision: FlagDecision.default("pending"),
  /** Заметка инспектора при вынесении решения. */
  decisionNote: z.string().nullable().default(null),
});
export type Flag = z.infer<typeof Flag>;

/** Проверка — сводный результат класса правил по Делу. */
export const Check = z.object({
  type: CheckType,
  result: CheckResult,
  summary: z.string(),
  flagIds: z.array(z.string()),
});
export type Check = z.infer<typeof Check>;

/** Стадии синхронного пайплайна (для SSE-прогресса). */
export const PipelineStage = z.enum([
  "split", // разбивка PDF на страницы
  "classify", // классификация + извлечение полей (LLM)
  "completeness", // проверка A
  "consistency", // проверка C
  "report", // компоновка отчёта
]);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const StageState = z.enum(["pending", "running", "done", "error"]);
export type StageState = z.infer<typeof StageState>;

// ─── Aggregates ──────────────────────────────────────────────────────────────

/** Полное Дело — то, что видит инспектор в Отчёте. */
export const Case = z.object({
  id: z.string(),
  applicant: z.string(),
  address: z.string(),
  parcelId: z.string(),
  service: z.string(),
  status: CaseStatus,
  /** Средняя уверенность извлечения по Делу. */
  confidence: Confidence,
  createdAt: z.string(), // ISO-8601
  documents: z.array(CaseDocument),
  flags: z.array(Flag),
  checks: z.array(Check),
});
export type Case = z.infer<typeof Case>;

/** Краткая карточка Дела для списка. */
export const CaseSummary = z.object({
  id: z.string(),
  applicant: z.string(),
  address: z.string(),
  parcelId: z.string(),
  service: z.string(),
  status: CaseStatus,
  confidence: Confidence,
  createdAt: z.string(),
  documentCount: z.number().int().nonnegative(),
  flagCount: z.number().int().nonnegative(),
  openFlagCount: z.number().int().nonnegative(),
});
export type CaseSummary = z.infer<typeof CaseSummary>;
