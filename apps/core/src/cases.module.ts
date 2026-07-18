import { Module } from "@nestjs/common";
import { CasesController } from "./cases.controller.js";
import { CasesService } from "./cases.service.js";
import { CasesStore } from "./cases.store.js";

@Module({
  controllers: [CasesController],
  providers: [CasesService, CasesStore],
})
export class CasesModule {}
