import { Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { VerificationPackage } from "../../../domain/aggregates/index.js";
import { type Document, Page } from "../../../domain/entities/index.js";
import { VerificationPackageRepository } from "../../../domain/repositories/index.js";
import {
  type DocumentId,
  FailureReason,
  PackageId,
  PageImage,
  PageNumber,
} from "../../../domain/value-objects/index.js";
import { PackageNotFoundException } from "../../exceptions/index.js";
import {
  DocumentClassifier,
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
    private readonly classifier: DocumentClassifier,
    private readonly extractor: FieldExtractor,
  ) {}

  async execute(command: RunVerificationCommand): Promise<void> {
    const packageId = PackageId.of(command.packageId);

    await this.change(packageId, (verification) => verification.start());

    try {
      const documentIds = (await this.load(packageId)).documents.map(
        (document) => document.id,
      );

      for (const documentId of documentIds) {
        await this.split(packageId, documentId);
        await this.recognise(packageId, documentId);
        await this.classify(packageId, documentId);
        await this.extract(packageId, documentId);
      }

      await this.change(packageId, (verification) => verification.complete());
      this.logger.log(
        `Package ${packageId.value}: verified ${documentIds.length} document(s)`,
      );
    } catch (error) {
      await this.recordFailure(packageId, error);
      throw error;
    }
  }

  private async split(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const document = verification.documentWith(documentId);

    if (document.isSplit) return;

    const pages = await this.pagesOf(document);

    verification.splitIntoPages(documentId, pages);
    await this.packages.save(verification);

    this.logger.log(
      `Package ${packageId.value}: "${document.filename.value}" → ` +
        `${pages.length} page(s)`,
    );
  }

  private async pagesOf(document: Document): Promise<readonly Page[]> {
    // A single-image document is already the one page it consists of; only a PDF
    // has sheets to render out.
    if (!document.contentType.splitsIntoPages) {
      return [
        Page.create(
          this.ids.pageId(),
          PageNumber.first(),
          PageImage.of(document.storageKey, document.contentType),
        ),
      ];
    }

    const split = await this.pdf.split({ storageKey: document.storageKey });

    return split.map((page) =>
      Page.create(this.ids.pageId(), page.number, page.image),
    );
  }

  private async recognise(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    // Terminates because every pass either records a page as recognised or
    // raises what stopped it.
    for (;;) {
      const verification = await this.load(packageId);
      const document = verification.documentWith(documentId);
      const batch = document.unrecognisedPages.slice(0, this.ocr.pagesAtOnce);

      if (batch.length === 0) return;

      const readings = await Promise.allSettled(
        batch.map((page) => this.ocr.recognise(page.image)),
      );

      let recognised = 0;
      for (const [index, reading] of readings.entries()) {
        const page = batch[index];
        if (!page || reading.status !== "fulfilled") continue;

        verification.recordRecognition(documentId, page.id, reading.value);
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

  private async classify(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    const verification = await this.load(packageId);
    const document = verification.documentWith(documentId);

    if (document.isClassified) return;

    const classification = await this.classifier.classify({
      text: document.text,
      candidateTypes: verification.profile.documentTypes,
    });

    verification.classify(documentId, classification);
    await this.packages.save(verification);

    this.logger.log(
      `Package ${packageId.value}: "${document.filename.value}" → ` +
        `${classification.type.value} (${classification.confidence.value.toFixed(2)})`,
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

    const schema = verification.profile.schemaFor(classification.type);
    if (schema.isEmpty) return;

    const fields = await this.extractor.extract({
      text: document.text,
      documentType: classification.type,
      schema,
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
