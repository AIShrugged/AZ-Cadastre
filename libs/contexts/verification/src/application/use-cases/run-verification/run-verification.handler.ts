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

  // A stage that cannot do its work does not stop the run: a file that will not
  // split, a sheet the reader refuses, a document nothing can place — each is
  // carried through to the report and handed to the inspector, which is what
  // the operator asked for. Only losing the package itself ends a run.
  async execute(command: RunVerificationCommand): Promise<void> {
    const packageId = PackageId.of(command.packageId);

    await this.change(packageId, (verification) => verification.start());

    try {
      const fileIds = (await this.load(packageId)).files.map((file) => file.id);

      // Every file is read to the end before any of it is classified: what one
      // sheet says is how the sheet after it is told to be part of the same
      // document or the start of the next.
      for (const fileId of fileIds) {
        await this.despite(packageId, `splitting ${fileId.value}`, () =>
          this.split(packageId, fileId),
        );
        await this.despite(packageId, `recognising ${fileId.value}`, () =>
          this.recognise(packageId, fileId),
        );
        await this.despite(packageId, `reading ${fileId.value}`, () =>
          this.segment(packageId, fileId),
        );
      }

      const documentIds = (await this.load(packageId)).documents.map(
        (document) => document.id,
      );

      for (const documentId of documentIds) {
        await this.despite(packageId, `classifying ${documentId.value}`, () =>
          this.classify(packageId, documentId),
        );
        await this.despite(packageId, `extracting ${documentId.value}`, () =>
          this.extract(packageId, documentId),
        );
      }

      // Completing is what compiles the report, so a run that read almost
      // nothing still ends with one.
      await this.change(packageId, (verification) => verification.complete());

      const report = (await this.load(packageId)).report;
      this.logger.log(
        `Package ${packageId.value}: verified ${documentIds.length} document(s) ` +
          `across ${fileIds.length} file(s) — ${report?.status.value} ` +
          `(${report?.issues.length ?? 0} finding(s))`,
      );
    } catch (error) {
      await this.recordFailure(packageId, error);
      throw error;
    }
  }

  private async despite(
    packageId: PackageId,
    what: string,
    stage: () => Promise<void>,
  ): Promise<void> {
    try {
      await stage();
    } catch (error) {
      this.logger.warn(
        `Package ${packageId.value}: ${what} failed — ${String(error)}. ` +
          "The run continues and the report will say so.",
      );
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

  // Terminates because a pass that recognised nothing ends the loop: pages the
  // provider refuses stay unread, and the report names them.
  private async recognise(
    packageId: PackageId,
    sourceFileId: SourceFileId,
  ): Promise<void> {
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

      // Saved before anything is said about the refusals: what the provider did
      // read is paid for, so a re-run asks it only for the pages still unread.
      if (recognised > 0) await this.packages.save(verification);

      for (const reading of readings) {
        if (reading.status === "rejected") {
          this.logger.warn(
            `Package ${packageId.value}: a sheet of ` +
              `"${file.filename.value}" could not be read — ` +
              String(reading.reason),
          );
        }
      }

      if (recognised < batch.length) return;
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

    try {
      return await this.segmenter.segment({
        pages: file.transcript(),
        candidates: profile.specs,
      });
    } catch (error) {
      // A file whose boundaries could not be found is still one run of sheets,
      // and one document the classifier can be asked about, rather than pages
      // that reach no stage at all.
      this.logger.warn(
        `Package: "${file.filename.value}" could not be read into documents — ` +
          `${String(error)}. Taking the file as one document.`,
      );

      return [whole];
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
