import { Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { VerificationPackage } from "../../../domain/aggregates/index.js";
import { Page } from "../../../domain/entities/index.js";
import { VerificationPackageRepository } from "../../../domain/repositories/index.js";
import {
  type DocumentId,
  FailureReason,
  PackageId,
  PageNumber,
} from "../../../domain/value-objects/index.js";
import { PackageNotFoundException } from "../../exceptions/index.js";
import {
  DocumentClassifier,
  FieldExtractor,
  IdGenerator,
  OcrProvider,
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

    verification.splitIntoPages(documentId, [
      Page.create(this.ids.pageId(), PageNumber.first(), document.storageKey),
    ]);

    await this.packages.save(verification);
  }

  private async recognise(
    packageId: PackageId,
    documentId: DocumentId,
  ): Promise<void> {
    // Terminates because every pass records one more page as recognised.
    for (;;) {
      const verification = await this.load(packageId);
      const document = verification.documentWith(documentId);
      const page = document.unrecognisedPages[0];

      if (!page) return;

      const result = await this.ocr.recognise({
        imageStorageKey: page.imageStorageKey,
        contentType: document.contentType,
      });

      verification.recordRecognition(documentId, page.id, result);
      await this.packages.save(verification);
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
