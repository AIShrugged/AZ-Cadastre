import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import {
  FlagDecisionRequest,
  type CaseDetailResponse,
  type CaseExport,
  type CaseListResponse,
  type FlagDecisionResponse,
  type ProgressEvent,
} from "@cadastre/contracts";
import { CasesService } from "./cases.service.js";
import { ZodBody } from "./zod.pipe.js";

@Controller("cases")
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  /** Список Дел (карточки). */
  @Get()
  list(): CaseListResponse {
    return this.cases.list();
  }

  /** Полное Дело — Отчёт для инспектора. */
  @Get(":id")
  detail(@Param("id") id: string): CaseDetailResponse {
    return this.cases.get(id);
  }

  /** Выгрузка машинного JSON по Делу. */
  @Get(":id/export")
  export(@Param("id") id: string): CaseExport {
    return this.cases.export(id);
  }

  /** Прогресс пайплайна по SSE. */
  @Sse(":id/events")
  events(@Param("id") id: string): Observable<{ data: ProgressEvent }> {
    return this.cases.progress$(id);
  }

  /** Решение инспектора по Флагу (принято / отклонено). */
  @Post(":id/flags/:flagId/decision")
  decide(
    @Param("id") id: string,
    @Param("flagId") flagId: string,
    @Body(new ZodBody(FlagDecisionRequest)) body: FlagDecisionRequest,
  ): FlagDecisionResponse {
    return this.cases.decide(id, flagId, body);
  }
}
