import { Module, type DynamicModule, type Provider } from '@nestjs/common';

import { CqrsDomainEventPublisher } from '@cadastre/event-publisher';
import { DomainEventPublisher } from '@cadastre/shared';

import { RunVerificationOnSubmissionHandler } from './application/event-handlers/index.js';
import {
  CrossChecker,
  DocumentClassifier,
  DocumentSegmenter,
  FieldExtractor,
  IdGenerator,
  ObjectStorage,
  OcrProvider,
  PackageQueries,
  PdfSplitter,
  VerificationApiPort,
  VerificationPackageRepository,
} from './application/ports/index.js';
import {
  DocumentsService,
  PackagesService,
  ProfilesService,
  VerificationService,
} from './application/services/index.js';
import {
  CreatePackageHandler,
  GetPackageHandler,
  GetPackageSummaryHandler,
  ListPackagesHandler,
  ListProfilesHandler,
  PresignUploadHandler,
  RunVerificationHandler,
} from './application/use-cases/index.js';
import {
  CrossCheckerAdapter,
  DocumentClassifierAdapter,
  DocumentSegmenterAdapter,
  FieldExtractorAdapter,
  ObjectStorageAdapter,
  OcrProviderAdapter,
  OpenRouterClassifierAdapter,
  OpenRouterCrossCheckerAdapter,
  OpenRouterFieldExtractorAdapter,
  OpenRouterOcrAdapter,
  OpenRouterSegmenterAdapter,
  PdfSplitterAdapter,
} from './infrastructure/adapters/index.js';
import { UuidIdGenerator } from './infrastructure/identity/index.js';
import {
  PrismaPackageQueries,
  PrismaVerificationPackageRepository,
  VerificationPrismaService,
} from './infrastructure/persistence/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleAsyncOptions,
  type VerificationModuleOptions,
} from './verification.module-defs.js';

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

const providers: Provider[] = [
  ...handlers,

  DocumentsService,
  PackagesService,
  ProfilesService,

  VerificationPrismaService,

  { provide: VerificationApiPort, useClass: VerificationService },
  { provide: DomainEventPublisher, useClass: CqrsDomainEventPublisher },
  {
    provide: VerificationPackageRepository,
    useClass: PrismaVerificationPackageRepository,
  },
  { provide: PackageQueries, useClass: PrismaPackageQueries },
  { provide: IdGenerator, useClass: UuidIdGenerator },
  { provide: ObjectStorage, useClass: ObjectStorageAdapter },
  { provide: PdfSplitter, useClass: PdfSplitterAdapter },

  {
    provide: OcrProvider,
    useFactory: (
      options: VerificationModuleOptions,
      storage: ObjectStorage,
    ): OcrProvider =>
      options.ocr.provider === 'openrouter'
        ? new OpenRouterOcrAdapter(options, storage)
        : new OcrProviderAdapter(),
    inject: [VERIFICATION_OPTIONS, ObjectStorage],
  },
  {
    provide: DocumentSegmenter,
    useFactory: (options: VerificationModuleOptions): DocumentSegmenter =>
      options.segmenter.provider === 'openrouter'
        ? new OpenRouterSegmenterAdapter(options)
        : new DocumentSegmenterAdapter(),
    inject: [VERIFICATION_OPTIONS],
  },
  {
    provide: DocumentClassifier,
    useFactory: (options: VerificationModuleOptions): DocumentClassifier =>
      options.classifier.provider === 'openrouter'
        ? new OpenRouterClassifierAdapter(options)
        : new DocumentClassifierAdapter(),
    inject: [VERIFICATION_OPTIONS],
  },
  {
    provide: FieldExtractor,
    useFactory: (
      options: VerificationModuleOptions,
      storage: ObjectStorage,
    ): FieldExtractor =>
      options.extractor.provider === 'openrouter'
        ? new OpenRouterFieldExtractorAdapter(options, storage)
        : new FieldExtractorAdapter(),
    inject: [VERIFICATION_OPTIONS, ObjectStorage],
  },
  {
    provide: CrossChecker,
    useFactory: (options: VerificationModuleOptions): CrossChecker =>
      options.crossChecker.provider === 'openrouter'
        ? new OpenRouterCrossCheckerAdapter(options)
        : new CrossCheckerAdapter(),
    inject: [VERIFICATION_OPTIONS],
  },
];

/**
 * The context's wiring, and the only thing outside it that names its classes.
 *
 * Configuration arrives through `forRootAsync` as a typed slice: nothing in
 * here reads `process.env`, so the same context runs under a different root
 * without changing.
 */
@Module({})
export class VerificationModule {
  static forRootAsync(options: VerificationModuleAsyncOptions): DynamicModule {
    return {
      module: VerificationModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: VERIFICATION_OPTIONS,
          useFactory: options.useFactory,
          inject: (options.inject ?? []) as never[],
        },
        ...providers,
      ],
      exports: [VerificationApiPort],
    };
  }
}
