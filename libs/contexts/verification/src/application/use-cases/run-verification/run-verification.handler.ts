import { Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { VerificationPackage } from "../../../domain/aggregates/index.js";
import { Document, Page, type SourceFile } from "../../../domain/entities/index.js";
import { VerificationPackageRepository } from "../../../domain/repositories/index.js";
import {
  type DocumentId,
  FailureReason,
  PackageId,
  PageImage,
  PageNumber,
  type PageRange,
  type SourceFileId,
  type VerificationProfile,
} from "../../../domain/value-objects/index.js";
import { PackageNotFoundException } from "../../exceptions/index.js";
import {
  DocumentClassifier,
  DocumentSegmenter,
  FieldExtractor,
  IdGenerator,
  OcrProvider,
  PdfSplitter,
} from "../../ports/index.js";
import { RunVerificationCommand } from "./run-verification.command.js";

@CommandHandler(RunVerificationCommand)
export class RunVerificationHandler
  implements ICommandHandler<RunVerificationCommand, void>
{
  private readonly logger = new Logger(RunVerificationHandler.name);

  constructor(
    private readonly packages: VerificationPackageRepository,
    private readonly ids: IdGenerator,
    private readonly pdf: PdfSplitter,
    private readonly ocr: OcrProvider,
    private readonly segmenter: DocumentSegmenter,
    private readonly classifier: DocumentClassifier,
    private readonly extractor: FieldExtractor,
  ) {}

  async execute(command: RunVerificationCommand): Promise<void> {
    const packageId = PackageId.of(command.packageId);

    await this.change(packageId, (verification) => verification.start());

    try {
      const fileIds = (await this.load(packageId)).files.map((file) => file.id);

      // Every file is read to the end before any of it is classified: what one
      // sheet says is how the sheet after it is told to be part of the same
      // document or the start of the next.
      for (const fileId of fileIds) {
        await this.split(packageId, fileId);
        await this.recognise(packageId, fileId);
        await this.segment(packageId, fileId);
      }

      const documentIds = (await this.load(packageId)).documents.map(
        (document) => document.id,
      );

      for (const documentId of documentIds) {
        await this.classify(packageId, documentId);
        await this.extract(packageId, documentId);
      }

      await this.change(packageId, (verification) => verification.complete());
      this.logger.log(
        `Package ${packageId.value}: verified ${documentIds.length} document(s) ` +
          `across ${fileIds.length} file(s)`,
      );
    } catch (error) {
      await this.recordFailure(packageId, error);
      throw error;
    }
  }

  private async split(
    packageId: PackageId,
    sourceFileId: SourceFileId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const file = verification.fileWith(sourceFileId);

    if (file.isSplit) return;

    const pages = await this.pagesOf(file);

    verification.splitIntoPages(sourceFileId, pages);
    await this.packages.save(verification);

    this.logger.log(
      `Package ${packageId.value}: "${file.filename.value}" → ` +
        `${pages.length} page(s)`,
    );
  }

  private async pagesOf(file: SourceFile): Promise<readonly Page[]> {
    // A single-image file is already the one page it consists of; only a PDF has
    // sheets to render out.
    if (!file.contentType.splitsIntoPages) {
      return [
        Page.create(
          this.ids.pageId(),
          PageNumber.first(),
          PageImage.of(file.storageKey, file.contentType),
        ),
      ];
    }

    const split = await this.pdf.split({ storageKey: file.storageKey });

    return split.map((page) =>
      Page.create(this.ids.pageId(), page.number, page.image),
    );
  }

  private async recognise(
    packageId: PackageId,
    sourceFileId: SourceFileId,
  ): Promise<void> {
    // Terminates because every pass either records a page as recognised or
    // raises what stopped it.
    for (;;) {
      const verification = await this.load(packageId);
      const file = verification.fileWith(sourceFileId);
      const batch = file.unrecognisedPages.slice(0, this.ocr.pagesAtOnce);

      if (batch.length === 0) return;

      const readings = await Promise.allSettled(
        batch.map((page) => this.ocr.recognise(page.image)),
      );

      let recognised = 0;
      for (const [index, reading] of readings.entries()) {
        const page = batch[index];
        if (!page || reading.status !== "fulfilled") continue;

        verification.recordRecognition(sourceFileId, page.id, reading.value);
        recognised += 1;
      }

      // Saved before the failure is raised: what the provider did read is paid
      // for, so a re-run asks it only for the pages still unread.
      if (recognised > 0) await this.packages.save(verification);

      const refused = readings.find(
        (reading): reading is PromiseRejectedResult =>
          reading.status === "rejected",
      );
      if (refused) throw refused.reason;
    }
  }

  private async segment(
    packageId: PackageId,
    sourceFileId: SourceFileId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const file = verification.fileWith(sourceFileId);

    if (verification.isSegmented(sourceFileId)) return;

    const ranges = await this.rangesIn(file, verification.profile);
    if (ranges.length === 0) return;

    const documents = ranges.map((range) =>
      Document.create(this.ids.documentId(), sourceFileId, range),
    );

    verification.segmentIntoDocuments(sourceFileId, documents);
    await this.packages.save(verification);

    this.logger.log(
      `Package ${packageId.value}: "${file.filename.value}" holds ` +
        `${documents.length} document(s) — ${ranges.map(describe).join(", ")}`,
    );
  }

  private async rangesIn(
    file: SourceFile,
    profile: VerificationProfile,
  ): Promise<readonly PageRange[]> {
    const whole = file.wholeFile;

    if (!whole) return [];

    // One sheet is one document: there is no boundary to look for, and no
    // reason to pay a provider to confirm it.
    if (whole.isSingleSheet) return [whole];

    return this.segmenter.segment({
      pages: file.transcript(),
      candidates: profile.specs,
    });
  }

  private async classify(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const document = verification.documentWith(documentId);

    if (document.isClassified) return;

    const classification = await this.classifier.classify({
      text: verification.textOf(documentId),
      candidates: verification.profile.specs,
    });

    verification.classify(documentId, classification);
    await this.packages.save(verification);

    const file = verification.fileWith(document.sourceFileId);
    this.logger.log(
      `Package ${packageId.value}: "${file.filename.value}" ` +
        `${describe(document.pages)} → ${classification.type.value} ` +
        `(${classification.confidence.value.toFixed(2)})`,
    );
  }

  private async extract(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const document = verification.documentWith(documentId);
    const classification = document.classification;

    if (!classification?.isPlaced || document.hasFields) return;

    const spec = verification.profile.specFor(classification.type);
    if (spec.schema.isEmpty) return;

    const fields = await this.extractor.extract({
      text: verification.textOf(documentId),
      spec,
    });

    if (fields.length === 0) return;

    verification.recordExtractedFields(documentId, fields);
    await this.packages.save(verification);
  }

  private async change(
    packageId: PackageId,
    change: (verification: VerificationPackage) => void,
  ): Promise<void> {
    const verification = await this.load(packageId);
    change(verification);
    await this.packages.save(verification);
  }

  private async load(packageId: PackageId): Promise<VerificationPackage> {
    const verification = await this.packages.findById(packageId);

    if (!verification) throw new PackageNotFoundException(packageId);

    return verification;
  }

  private async recordFailure(
    packageId: PackageId,
    cause: unknown,
  ): Promise<void> {
    try {
      await this.change(packageId, (verification) =>
        verification.fail(FailureReason.create(String(cause))),
      );
    } catch (error) {
      this.logger.error(
        `Could not mark package ${packageId.value} failed: ${String(error)}`,
      );
    }
  }
}

function describe(range: PageRange): string {
  return range.isSingleSheet
    ? `p.${range.first.value}`
    : `pp.${range.first.value}–${range.last.value}`;
}
