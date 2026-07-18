import type {
  CaseStatus,
  CheckResult,
  CheckType,
  FlagDecision,
  FlagSeverity,
} from "@cadastre/contracts";

/** Русскоязычные подписи (chrome). Данные документов остаются на азербайджанском. */

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  ok: "OK",
  remarks: "Замечания",
  incomplete: "Некомплект",
};

/** Токен статуса → семантический цвет (см. index.css). */
export const CASE_STATUS_TONE: Record<CaseStatus, "ok" | "remarks" | "incomplete"> = {
  ok: "ok",
  remarks: "remarks",
  incomplete: "incomplete",
};

export const CHECK_LABEL: Record<CheckType, string> = {
  completeness: "Полнота",
  consistency: "Согласованность",
};

export const CHECK_TAG: Record<CheckType, string> = {
  completeness: "A",
  consistency: "C",
};

export const CHECK_RESULT_LABEL: Record<CheckResult, string> = {
  pass: "Пройдена",
  warn: "Замечания",
  fail: "Не пройдена",
};

export const SEVERITY_LABEL: Record<FlagSeverity, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая",
};

/** Серьёзность → семантический тон. */
export const SEVERITY_TONE: Record<FlagSeverity, "ok" | "remarks" | "incomplete"> = {
  low: "ok",
  medium: "remarks",
  high: "incomplete",
};

export const DECISION_LABEL: Record<FlagDecision, string> = {
  pending: "Не рассмотрен",
  accepted: "Принят",
  rejected: "Отклонён",
};

export function pct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** Тон уверенности для метра: высокая / средняя / низкая. */
export function confidenceTone(
  confidence: number,
): "ok" | "remarks" | "incomplete" {
  if (confidence >= 0.9) return "ok";
  if (confidence >= 0.75) return "remarks";
  return "incomplete";
}

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}
