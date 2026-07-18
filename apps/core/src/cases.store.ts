import { Injectable } from "@nestjs/common";
import type {
  Case,
  CaseStatus,
  CaseSummary,
  Flag,
  FlagDecision,
} from "@cadastre/contracts";
import { loadFixtures } from "./fixtures.js";

/**
 * In-memory case store. Per ADR-0002 the prototype would persist to SQLite +
 * local files so inspector flags survive restart; here we keep it in-process
 * and reload fixtures on boot. Flag decisions mutate state and recompute the
 * derived Case status.
 */
@Injectable()
export class CasesStore {
  private readonly cases = new Map<string, Case>();

  constructor() {
    for (const c of loadFixtures()) this.cases.set(c.id, c);
  }

  list(): CaseSummary[] {
    return [...this.cases.values()]
      .map((c) => toSummary(c))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Case | undefined {
    return this.cases.get(id);
  }

  /** Отметить Флаг решением инспектора; вернуть обновлённый Флаг или undefined. */
  decideFlag(
    caseId: string,
    flagId: string,
    decision: FlagDecision,
    note: string | null,
  ): { flag: Flag; caseStatus: CaseStatus; openFlagCount: number } | undefined {
    const c = this.cases.get(caseId);
    if (!c) return undefined;
    const flag = c.flags.find((f) => f.id === flagId);
    if (!flag) return undefined;

    flag.decision = decision;
    flag.decisionNote = note;
    c.status = recomputeStatus(c);

    return { flag, caseStatus: c.status, openFlagCount: openFlagCount(c) };
  }
}

/** Флаг «в силе», пока инспектор его не отклонил (rejected = ложное срабатывание). */
function activeFlags(c: Case): Flag[] {
  return c.flags.filter((f) => f.decision !== "rejected");
}

function openFlagCount(c: Case): number {
  return c.flags.filter((f) => f.decision === "pending").length;
}

/**
 * Итог по Делу выводится из «действующих» Флагов:
 *  - есть отсутствующий документ → Некомплект
 *  - иначе есть действующие Флаги → Замечания
 *  - иначе → OK
 */
function recomputeStatus(c: Case): CaseStatus {
  const active = activeFlags(c);
  if (active.some((f) => f.kind === "missing_document")) return "incomplete";
  if (active.length > 0) return "remarks";
  return "ok";
}

function toSummary(c: Case): CaseSummary {
  return {
    id: c.id,
    applicant: c.applicant,
    address: c.address,
    parcelId: c.parcelId,
    service: c.service,
    status: c.status,
    confidence: c.confidence,
    createdAt: c.createdAt,
    documentCount: c.documents.length,
    flagCount: c.flags.length,
    openFlagCount: openFlagCount(c),
  };
}
