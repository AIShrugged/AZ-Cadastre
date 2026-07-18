import { Injectable, NotFoundException } from "@nestjs/common";
import { Observable, concatMap, delay, from, of } from "rxjs";
import {
  PIPELINE_STAGES,
  type Case,
  type CaseExport,
  type CaseListResponse,
  type FlagDecisionRequest,
  type FlagDecisionResponse,
  type ProgressEvent,
} from "@cadastre/contracts";
import { CasesStore } from "./cases.store.js";

@Injectable()
export class CasesService {
  constructor(private readonly store: CasesStore) {}

  list(): CaseListResponse {
    return { cases: this.store.list() };
  }

  get(id: string): Case {
    const found = this.store.get(id);
    if (!found) throw new NotFoundException(`İş tapılmadı: ${id}`);
    return found;
  }

  decide(
    caseId: string,
    flagId: string,
    body: FlagDecisionRequest,
  ): FlagDecisionResponse {
    const result = this.store.decideFlag(
      caseId,
      flagId,
      body.decision,
      body.note,
    );
    if (!result) throw new NotFoundException("İş və ya Flag tapılmadı.");
    return result;
  }

  export(id: string): CaseExport {
    return {
      schema: "az-cadastre.case-export/1",
      exportedAt: new Date().toISOString(),
      case: this.get(id),
    };
  }

  /**
   * Реплей синхронного пайплайна как поток SSE-событий: каждая стадия проходит
   * running → done с шагом времени, чтобы инспектор видел прогресс обработки.
   */
  progress$(id: string): Observable<{ data: ProgressEvent }> {
    this.get(id); // 404, если Дела нет
    const total = PIPELINE_STAGES.length;
    const events: ProgressEvent[] = [];

    PIPELINE_STAGES.forEach(({ stage, label }, i) => {
      events.push({
        caseId: id,
        stage,
        label,
        state: "running",
        progress: i / total,
        at: new Date().toISOString(),
      });
      events.push({
        caseId: id,
        stage,
        label,
        state: "done",
        progress: (i + 1) / total,
        at: new Date().toISOString(),
      });
    });

    return from(events).pipe(
      concatMap((e) => of({ data: e }).pipe(delay(550))),
    );
  }
}
