import type { Provider } from '@nestjs/common';

import { Logger } from '@cadastre/logger';

import {
  ArchiveRegistryPort,
  CrossChecker,
  DocumentClassifier,
  DocumentSegmenter,
  FieldExtractor,
  ObjectStorage,
  OcrProvider,
  PdfSplitter,
} from '../../application/ports/outbound/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../verification.module-defs.js';

import { ArchiveRegistryAdapter } from './archive-registry.adapter.js';
import { CrossCheckerAdapter } from './cross-checker.adapter.js';
import { DocumentClassifierAdapter } from './document-classifier.adapter.js';
import { DocumentSegmenterAdapter } from './document-segmenter.adapter.js';
import { FieldExtractorAdapter } from './field-extractor.adapter.js';
import { HttpArchiveRegistryAdapter } from './http-archive-registry.adapter.js';
import { ObjectStorageAdapter } from './object-storage.adapter.js';
import { OcrProviderAdapter } from './ocr-provider.adapter.js';
import {
  OpenRouterClassifierAdapter,
  OpenRouterCrossCheckerAdapter,
  OpenRouterFieldExtractorAdapter,
  OpenRouterOcrAdapter,
  OpenRouterSegmenterAdapter,
} from './openrouter/index.js';
import { PdfSplitterAdapter } from './pdf-splitter.adapter.js';

export { ArchiveRegistryAdapter } from './archive-registry.adapter.js';
export { CrossCheckerAdapter } from './cross-checker.adapter.js';
export { HttpArchiveRegistryAdapter } from './http-archive-registry.adapter.js';
export { DocumentClassifierAdapter } from './document-classifier.adapter.js';
export { DocumentSegmenterAdapter } from './document-segmenter.adapter.js';
export { FieldExtractorAdapter } from './field-extractor.adapter.js';
export { ObjectStorageAdapter } from './object-storage.adapter.js';
export { OcrProviderAdapter } from './ocr-provider.adapter.js';
export {
  OpenRouterClassifierAdapter,
  OpenRouterCrossCheckerAdapter,
  OpenRouterFieldExtractorAdapter,
  OpenRouterOcrAdapter,
  OpenRouterSegmenterAdapter,
} from './openrouter/index.js';
export { renderPdfPages } from './pdf-page-renderer.js';
export { PdfSplitterAdapter } from './pdf-splitter.adapter.js';

/**
 * The five model-backed stages each answer to one port and are chosen per
 * stage, not per deployment: a run can read with OpenRouter and cross-check
 * offline, which is how a stage is compared against its stand-in without
 * changing anything else.
 *
 * The offline adapters are not test doubles — they run the domain rules in
 * `domain/services/` and are what the context does with no API key.
 */
export const VERIFICATION_ADAPTERS: Provider[] = [
  { provide: ObjectStorage, useClass: ObjectStorageAdapter },
  { provide: PdfSplitter, useClass: PdfSplitterAdapter },
  {
    provide: OcrProvider,
    useFactory: (
      options: VerificationModuleOptions,
      storage: ObjectStorage,
      logger: Logger,
    ): OcrProvider =>
      options.ocr.provider === 'openrouter'
        ? new OpenRouterOcrAdapter(options, storage, logger)
        : new OcrProviderAdapter(),
    inject: [VERIFICATION_OPTIONS, ObjectStorage, Logger],
  },
  {
    provide: DocumentSegmenter,
    useFactory: (
      options: VerificationModuleOptions,
      logger: Logger,
    ): DocumentSegmenter =>
      options.segmenter.provider === 'openrouter'
        ? new OpenRouterSegmenterAdapter(options, logger)
        : new DocumentSegmenterAdapter(),
    inject: [VERIFICATION_OPTIONS, Logger],
  },
  {
    provide: DocumentClassifier,
    useFactory: (
      options: VerificationModuleOptions,
      logger: Logger,
    ): DocumentClassifier =>
      options.classifier.provider === 'openrouter'
        ? new OpenRouterClassifierAdapter(options, logger)
        : new DocumentClassifierAdapter(),
    inject: [VERIFICATION_OPTIONS, Logger],
  },
  {
    provide: FieldExtractor,
    useFactory: (
      options: VerificationModuleOptions,
      storage: ObjectStorage,
      logger: Logger,
    ): FieldExtractor =>
      options.extractor.provider === 'openrouter'
        ? new OpenRouterFieldExtractorAdapter(options, storage, logger)
        : new FieldExtractorAdapter(),
    inject: [VERIFICATION_OPTIONS, ObjectStorage, Logger],
  },
  {
    provide: CrossChecker,
    useFactory: (
      options: VerificationModuleOptions,
      logger: Logger,
    ): CrossChecker =>
      options.crossChecker.provider === 'openrouter'
        ? new OpenRouterCrossCheckerAdapter(options, logger)
        : new CrossCheckerAdapter(),
    inject: [VERIFICATION_OPTIONS, Logger],
  },
  /*
   * The sixth stage is not model-backed: it asks a register, and the choice is
   * between a register that is running and the stand-in built into the context.
   * Same shape as the five above, for the same reason — a stage is pointed at
   * the real thing one at a time (ADR-0009).
   */
  {
    provide: ArchiveRegistryPort,
    useFactory: (
      options: VerificationModuleOptions,
      logger: Logger,
    ): ArchiveRegistryPort =>
      options.registry.provider === 'http'
        ? new HttpArchiveRegistryAdapter(options, logger)
        : new ArchiveRegistryAdapter(),
    inject: [VERIFICATION_OPTIONS, Logger],
  },
];
