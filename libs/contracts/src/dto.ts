import { z } from "zod";
import {
  Case,
  CaseStatus,
  CaseSummary,
  Flag,
  FlagDecision,
  PipelineStage,
  StageState,
} from "./domain.js";

/**
 * Request / response DTOs for the NestJS REST + SSE surface.
 * Kept small and explicit — one schema per endpoint boundary.
 */

// ─── GET /api/cases ──────────────────────────────────────────────────────────
export const CaseListResponse = z.object({
  cases: z.array(CaseSummary),
});
export type CaseListResponse = z.infer<typeof CaseListResponse>;

// ─── GET /api/cases/:id ──────────────────────────────────────────────────────
export const CaseDetailResponse = Case;
export type CaseDetailResponse = z.infer<typeof CaseDetailResponse>;

// ─── POST /api/cases/:id/flags/:flagId/decision ──────────────────────────────
export const FlagDecisionRequest = z.object({
  decision: z.enum([
    FlagDecision.enum.accepted,
    FlagDecision.enum.rejected,
    FlagDecision.enum.pending,
  ]),
  note: z.string().max(2000).nullable().default(null),
});
export type FlagDecisionRequest = z.infer<typeof FlagDecisionRequest>;

export const FlagDecisionResponse = z.object({
  flag: Flag,
  /** Статус Дела может уточниться после решения инспектора. */
  caseStatus: CaseStatus,
  openFlagCount: z.number().int().nonnegative(),
});
export type FlagDecisionResponse = z.infer<typeof FlagDecisionResponse>;

// ─── GET /api/cases/:id/export ───────────────────────────────────────────────
export const CaseExport = z.object({
  schema: z.literal("az-cadastre.case-export/1"),
  exportedAt: z.string(),
  case: Case,
});
export type CaseExport = z.infer<typeof CaseExport>;

// ─── GET /api/cases/:id/events (SSE) ─────────────────────────────────────────
/** Событие прогресса пайплайна, транслируемое инспектору по SSE. */
export const ProgressEvent = z.object({
  caseId: z.string(),
  stage: PipelineStage,
  label: z.string(),
  state: StageState,
  /** Прогресс всего пайплайна [0..1]. */
  progress: z.number().min(0).max(1),
  at: z.string(),
});
export type ProgressEvent = z.infer<typeof ProgressEvent>;

/** Упорядоченный список стадий с их метками — для отрисовки трекера. */
export const PIPELINE_STAGES: ReadonlyArray<{
  stage: z.infer<typeof PipelineStage>;
  label: string;
}> = [
  { stage: "split", label: "Разбивка PDF на страницы" },
  { stage: "classify", label: "Классификация и извлечение полей" },
  { stage: "completeness", label: "Проверка полноты (A)" },
  { stage: "consistency", label: "Проверка согласованности (C)" },
  { stage: "report", label: "Компоновка отчёта" },
];
