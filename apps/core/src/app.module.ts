import { Module } from "@nestjs/common";
import { CasesModule } from "./cases.module.js";

@Module({
  imports: [CasesModule],
})
export class AppModule {}
