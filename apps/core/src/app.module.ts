import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EnvironmentSchema } from "./infrastructure/config/env.shema.js";
import { CqrsModule } from "@nestjs/cqrs";

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => EnvironmentSchema.parse(config),
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    CqrsModule.forRoot(),
  ],

  providers: [],
})
export class AppModule {}
