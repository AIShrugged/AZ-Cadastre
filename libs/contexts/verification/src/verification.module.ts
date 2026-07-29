import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { DomainEventDispatcher } from "@cadastre/application";

import {
  DocumentsController,
  PackagesController,
  ProfilesController,
  VerificationExceptionFilter,
} from "./api/http/index.js";
import { RunVerificationOnSubmissionHandler } from "./application/event-handlers/index.js";
import {
  DocumentClassifier,
  FieldExtractor,
  IdGenerator,
  ObjectStorage,
  OcrProvider,
  PackageQueries,
} from "./application/ports/index.js";
import {
  CreatePackageHandler,
  GetPackageHandler,
  GetPackageSummaryHandler,
  ListPackagesHandler,
  ListProfilesHandler,
  PresignUploadHandler,
  RunVerificationHandler,
} from "./application/use-cases/index.js";
import { VerificationPackageRepository } from "./domain/repositories/index.js";
import {
  DocumentClassifierAdapter,
  FieldExtractorAdapter,
  ObjectStorageAdapter,
  OcrProviderAdapter,
  OpenRouterClassifierAdapter,
  OpenRouterFieldExtractorAdapter,
  OpenRouterOcrAdapter,
} from "./infrastructure/adapters/index.js";
import { EnvironmentSchema, type Environment } from "./infrastructure/config/index.js";
import { UuidIdGenerator } from "./infrastructure/identity/index.js";
import {
  PrismaPackageQueries,
  PrismaVerificationPackageRepository,
  VerificationPrismaService,
} from "./infrastructure/persistence/index.js";

const handlers = [
  CreatePackageHandler,
  GetPackageHandler,
  GetPackageSummaryHandler,
  ListPackagesHandler,
  ListProfilesHandler,
  PresignUploadHandler,
  RunVerificationHandler,
  RunVerificationOnSubmissionHandler,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => EnvironmentSchema.parse(config),
      envFilePath: [".env.local", ".env"],
    }),
  ],

  controllers: [DocumentsController, PackagesController, ProfilesController],

  providers: [
    ...handlers,

    DomainEventDispatcher,
    VerificationPrismaService,

    { provide: VerificationPackageRepository, useClass: PrismaVerificationPackageRepository },
    { provide: PackageQueries, useClass: PrismaPackageQueries },
    { provide: IdGenerator, useClass: UuidIdGenerator },
    { provide: ObjectStorage, useClass: ObjectStorageAdapter },

    {
      provide: OcrProvider,
      useFactory: (
        config: ConfigService<Environment, true>,
        storage: ObjectStorage,
      ): OcrProvider =>
        config.get("ocr", { infer: true }).provider === "openrouter"
          ? new OpenRouterOcrAdapter(config, storage)
          : new OcrProviderAdapter(),
      inject: [ConfigService, ObjectStorage],
    },
    {
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
      provide: FieldExtractor,
      useFactory: (config: ConfigService<Environment, true>): FieldExtractor =>
        config.get("extractor", { infer: true }).provider === "openrouter"
          ? new OpenRouterFieldExtractorAdapter(config)
          : new FieldExtractorAdapter(),
      inject: [ConfigService],
    },

    // Registered by the context that raises them, so its `code → status` table
    // travels with it.
    { provide: APP_FILTER, useClass: VerificationExceptionFilter },
  ],
})
export class VerificationModule {}
