import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";

import { EnvironmentSchema, type Environment } from "./infrastructure/config/env.shema.js";

import {
  FieldExtractorAdapter,
  DocumentClassifierAdapter,
  ObjectStorageAdapter,
  OcrProviderAdapter,
  OpenRouterOcrAdapter,
  OpenRouterClassifierAdapter,
  OpenRouterFieldExtractorAdapter,
} from "./infrastructure/adapters/index.js";
import {
  FieldExtractor,
  DocumentClassifier,
  ObjectStorage,
  OCRProvider,
  PipelineStore,
} from "./application/ports/index.js";
import { DocumentsController } from "./api/documents.controller.js";
import { PackagesController } from "./api/packages.controller.js";
import { PrismaService } from "./infrastructure/database/prisma.service.js";
import { PackagesRepository } from "./application/ports/packages.repository.js";
import { PrismaPackagesRepository } from "./infrastructure/database/repositories/packages.repository.js";
import { PrismaPipelineStore } from "./infrastructure/database/repositories/pipeline-store.repository.js";
import { PackagesService } from "./application/packages/packages.service.js";
import { PipelineService } from "./application/pipeline/pipeline.service.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => EnvironmentSchema.parse(config),
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    CqrsModule.forRoot(),
  ],

  controllers: [DocumentsController, PackagesController],

  providers: [
    PrismaService,
    PackagesService,
    PipelineService,
    {
      provide: PackagesRepository,
      useClass: PrismaPackagesRepository,
    },
    {
      provide: PipelineStore,
      useClass: PrismaPipelineStore,
    },
    {
      // Pick the OCR implementation from config: the deterministic mock, or the
      // real OpenRouter vision adapter (which needs storage to fetch bytes).
      provide: OCRProvider,
      useFactory: (
        config: ConfigService<Environment, true>,
        storage: ObjectStorage,
      ): OCRProvider =>
        config.get("ocr", { infer: true }).provider === "openrouter"
          ? new OpenRouterOcrAdapter(config, storage)
          : new OcrProviderAdapter(),
      inject: [ConfigService, ObjectStorage],
    },
    {
      // Mock keyword classifier, or the real OpenRouter LLM classifier.
      provide: DocumentClassifier,
      useFactory: (
        config: ConfigService<Environment, true>,
      ): DocumentClassifier =>
        config.get("classifier", { infer: true }).provider === "openrouter"
          ? new OpenRouterClassifierAdapter(config)
          : new DocumentClassifierAdapter(),
      inject: [ConfigService],
    },
    {
      // Mock demo values, or the real OpenRouter LLM extractor.
      provide: FieldExtractor,
      useFactory: (
        config: ConfigService<Environment, true>,
      ): FieldExtractor =>
        config.get("extractor", { infer: true }).provider === "openrouter"
          ? new OpenRouterFieldExtractorAdapter(config)
          : new FieldExtractorAdapter(),
      inject: [ConfigService],
    },
    {
      provide: ObjectStorage,
      useClass: ObjectStorageAdapter,
    },
  ],
})
export class AppModule {}
