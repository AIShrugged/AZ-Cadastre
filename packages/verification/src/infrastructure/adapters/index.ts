import type { Provider } from '@nestjs/common';

import { Logger } from '@cadastre/logger';

import {
  ArchiveRegistryPort,
  CrossChecker,
  DocumentClassifier,
  DocumentSegmenter,
  FieldExtractor,
  NationalArchivePort,
  ObjectStorage,
  OcrProvider,
  PdfSplitter,
  QrCodeReader,
  SheetGeometryReader,
  SpanMarkupRenderer,
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
import { HttpNationalArchiveAdapter } from './http-national-archive.adapter.js';
import { NationalArchiveAdapter } from './national-archive.adapter.js';
import { ObjectStorageAdapter } from './object-storage.adapter.js';
import { OcrProviderAdapter } from './ocr-provider.adapter.js';
import {
  OpenRouterClassifierAdapter,
  OpenRouterCrossCheckerAdapter,
  OpenRouterFieldExtractorAdapter,
  OpenRouterGeometryAdapter,
  OpenRouterOcrAdapter,
  OpenRouterSegmenterAdapter,
} from './openrouter/index.js';
import { PdfSplitterAdapter } from './pdf-splitter.adapter.js';
import { QrCodeReaderAdapter } from './qr-code-reader.adapter.js';
import { SheetGeometryReaderAdapter } from './sheet-geometry.adapter.js';
import { SignedPdfDigitiser } from './signed-pdf.digitiser.js';
import { SignedSheetReader } from './signed-sheet.reader.js';
import { SpanMarkupRendererAdapter } from './span-markup.renderer.js';

export { ArchiveRegistryAdapter } from './archive-registry.adapter.js';
export { CrossCheckerAdapter } from './cross-checker.adapter.js';
export { HttpArchiveRegistryAdapter } from './http-archive-registry.adapter.js';
export { HttpNationalArchiveAdapter } from './http-national-archive.adapter.js';
export { DocumentClassifierAdapter } from './document-classifier.adapter.js';
export { DocumentSegmenterAdapter } from './document-segmenter.adapter.js';
export { FieldExtractorAdapter } from './field-extractor.adapter.js';
export { NationalArchiveAdapter } from './national-archive.adapter.js';
export { ObjectStorageAdapter } from './object-storage.adapter.js';
export { OcrProviderAdapter } from './ocr-provider.adapter.js';
export {
  OpenRouterClassifierAdapter,
  OpenRouterCrossCheckerAdapter,
  OpenRouterFieldExtractorAdapter,
  OpenRouterGeometryAdapter,
  OpenRouterOcrAdapter,
  OpenRouterSegmenterAdapter,
} from './openrouter/index.js';
export { renderPdfPages } from './pdf-page-renderer.js';
export { PdfSplitterAdapter } from './pdf-splitter.adapter.js';
export { QrCodeReaderAdapter } from './qr-code-reader.adapter.js';
export { SheetGeometryReaderAdapter } from './sheet-geometry.adapter.js';
export { SpanMarkupRendererAdapter } from './span-markup.renderer.js';
export { SignedPdfDigitiser } from './signed-pdf.digitiser.js';
export { SignedSheetReader } from './signed-sheet.reader.js';
export { readSignedSheet } from './signed-sheet.reading.js';

/**
 * The model-backed stages each answer to one port and are chosen per
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
  /*
   * The decoder has no provider to choose between and never will: a QR symbol
   * is read by arithmetic, not by a model, so there is nothing for a stand-in
   * to stand in for and nothing an API key would buy (ADR-0034).
   */
  { provide: QrCodeReader, useClass: QrCodeReaderAdapter },
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
  /*
   * Drawing the markup is arithmetic on a canvas and has no provider to choose:
   * what is drawn is decided in `domain/services/span-markup.service.ts`, and
   * there is nothing a model or an API key would buy (COMM-165).
   */
  { provide: SpanMarkupRenderer, useClass: SpanMarkupRendererAdapter },
  {
    provide: SheetGeometryReader,
    useFactory: (
      options: VerificationModuleOptions,
      storage: ObjectStorage,
      logger: Logger,
    ): SheetGeometryReader =>
      options.geometry.provider === 'openrouter'
        ? new OpenRouterGeometryAdapter(options, storage, logger)
        : new SheetGeometryReaderAdapter(),
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
  /*
   * The National Archive Fund, asked by the QR code decoded off a paper
   * (ADR-0028, ADR-0034). Same shape as the register above and chosen the same
   * way: `mock` is the stand-in built into the context, `http` is the archive's
   * own electronic document service.
   */
  {
    provide: NationalArchivePort,
    useFactory: (
      options: VerificationModuleOptions,
      storage: ObjectStorage,
      ocr: OcrProvider,
      extractor: FieldExtractor,
      logger: Logger,
    ): NationalArchivePort =>
      options.nationalArchive.provider === 'http'
        ? new HttpNationalArchiveAdapter(
            options,
            logger,
            /*
             * The signed PDF behind the code's link is read with the pipeline's
             * own renderer and the pipeline's own OCR provider (ADR-0035) — so
             * a deployment reading its packages with OpenRouter reads the
             * archive's copies with it too, and one that reads them offline
             * reads both offline.
             */
            new SignedPdfDigitiser(storage, ocr, logger, options.pdf),
            // And the eight lines come off it through the pipeline's own
            // extraction stage, for the same reason and the same way: the sheet
            // is prose, and prose is read by a reader (ADR-0038).
            new SignedSheetReader(extractor, logger),
          )
        : new NationalArchiveAdapter(),
    inject: [
      VERIFICATION_OPTIONS,
      ObjectStorage,
      OcrProvider,
      FieldExtractor,
      Logger,
    ],
  },
];
