import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";

import { EnvironmentSchema } from "./infrastructure/config/env.shema.js";

import {
  FieldExtractorAdapter,
  DocumentClassifierAdapter,
} from "./infrastructure/adapters/index.js";
import {
  FieldExtractor,
  DocumentClassifier,
} from "./application/ports/index.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => EnvironmentSchema.parse(config),
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    CqrsModule.forRoot(),
  ],

  providers: [
    {
      provide: DocumentClassifier,
      useClass: DocumentClassifierAdapter,
    },
    {
      provide: FieldExtractor,
      useClass: FieldExtractorAdapter,
    },
  ],
})
export class AppModule {}
