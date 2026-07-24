import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";

import { EnvironmentSchema } from "./infrastructure/config/env.shema.js";

import {
  FieldExtractorAdapter,
  DocumentClassifierAdapter,
  ObjectStorageAdapter,
} from "./infrastructure/adapters/index.js";
import {
  FieldExtractor,
  DocumentClassifier,
  ObjectStorage,
} from "./application/ports/index.js";
import { DocumentsController } from "./api/documents.controller.js";
import { PackagesController } from "./api/packages.controller.js";
import { PrismaService } from "./infrastructure/database/prisma.service.js";
import { PackagesRepository } from "./application/ports/packages.repository.js";
import { PrismaPackagesRepository } from "./infrastructure/database/repositories/packages.repository.js";

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
    {
      provide: PackagesRepository,
      useClass: PrismaPackagesRepository,
    },
    {
      provide: DocumentClassifier,
      useClass: DocumentClassifierAdapter,
    },
    {
      provide: FieldExtractor,
      useClass: FieldExtractorAdapter,
    },
    {
      provide: ObjectStorage,
      useClass: ObjectStorageAdapter,
    },
  ],
})
export class AppModule {}
