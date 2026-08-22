import type { Provider } from '@nestjs/common';

import {
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

import { CrossCheckerAdapter } from './cross-checker.adapter.js';
import { DocumentClassifierAdapter } from './document-classifier.adapter.js';
import { DocumentSegmenterAdapter } from './document-segmenter.adapter.js';
import { FieldExtractorAdapter } from './field-extractor.adapter.js';
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

export { CrossCheckerAdapter } from './cross-checker.adapter.js';
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
