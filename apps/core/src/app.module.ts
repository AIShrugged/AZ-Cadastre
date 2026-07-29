import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { VerificationModule } from "@cadastre/verification";

@Module({
  imports: [CqrsModule.forRoot(), VerificationModule],
})
export class AppModule {}
