import {
  CaseDetailResponse,
  CaseListResponse,
  FlagDecisionResponse,
  type CaseSummary,
  type Case,
  type FlagDecision,
  type FlagDecisionResponse as TFlagDecisionResponse,
} from "@cadastre/contracts";

/** База — относительный /api (Vite проксирует на NestJS). */
const BASE = "/api";

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${path}`);
  }
  return res.json();
}

export async function listCases(): Promise<CaseSummary[]> {
  const data = await getJson("/cases");
  return CaseListResponse.parse(data).cases;
}

export async function getCase(id: string): Promise<Case> {
  const data = await getJson(`/cases/${id}`);
  return CaseDetailResponse.parse(data);
}

export async function decideFlag(
  caseId: string,
  flagId: string,
  decision: FlagDecision,
  note: string | null = null,
): Promise<TFlagDecisionResponse> {
  const res = await fetch(
    `${BASE}/cases/${caseId}/flags/${flagId}/decision`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note }),
    },
  );
  if (!res.ok) {
    throw new Error(`Не удалось сохранить решение (${res.status})`);
  }
  return FlagDecisionResponse.parse(await res.json());
}

/** URL выгрузки JSON — открываем в новой вкладке / скачиваем. */
export function exportCaseUrl(id: string): string {
  return `${BASE}/cases/${id}/export`;
}

/** URL SSE-потока прогресса пайплайна. */
export function eventsUrl(id: string): string {
  return `${BASE}/cases/${id}/events`;
}
