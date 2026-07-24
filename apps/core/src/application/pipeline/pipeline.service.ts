import { Injectable, Logger } from "@nestjs/common";

import { profileDocTypes } from "../../domain/profiles.js";
import { DocumentClassifier } from "../ports/document-classifier.port.js";
import { OCRProvider } from "../ports/ocr-provider.port.js";
import { PipelineStore } from "../ports/pipeline-store.port.js";

/**
 * Verification pipeline — first stages (PRD §7): OCR every page, then classify
 * each document from its recognised text. Written as activity-shaped steps
 * (ADR-0001): take a package id, read/write persisted state, safe to retry.
 * Runs in-process for the MVP; lifts into Temporal activities later untouched.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly store: PipelineStore,
    private readonly ocr: OCRProvider,
    private readonly classifier: DocumentClassifier,
  ) {}

  /**
   * Fire-and-forget entrypoint used right after a package is created (PRD §4.1).
   * The HTTP request returns immediately; failures land on the package status.
   */
  enqueue(packageId: string): void {
    void this.run(packageId).catch((err) => {
      this.logger.error(
        `Pipeline failed for package ${packageId}: ${String(err)}`,
      );
    });
  }

  /** Run OCR + classification for every document in the package. */
  async run(packageId: string): Promise<void> {
    const pkg = await this.store.getPackage(packageId);
    if (!pkg) {
      this.logger.warn(`Pipeline: package ${packageId} not found`);
      return;
    }

    await this.store.setPackageStatus(packageId, "Processing");
    const candidateTypes = profileDocTypes(pkg.profileKey);

    try {
      for (const doc of pkg.documents) {
        // 1. Ensure pages. Real PDF→PNG splitting (pdftoppm) becomes its own
        //    step later; for now each document is a single page over its
        //    original object (correct for images).
        let pages = doc.pages;
        if (pages.length === 0) {
          pages = await this.store.createPages(doc.id, [
            { pageNumber: 1, imageStorageKey: doc.storageKey },
          ]);
        }

        // 2. OCR each page that hasn't been recognised yet.
        const pageTexts: string[] = [];
        for (const page of pages) {
          if (page.ocrText !== null) {
            pageTexts.push(page.ocrText);
            continue;
          }
          const result = await this.ocr.recognize({
            imageStorageKey: page.imageStorageKey,
            contentType: doc.contentType,
          });
          await this.store.saveOcrResult(page.id, result);
          pageTexts.push(result.text);
        }

        // 3. Classify the document from its combined OCR text.
        const { type, confidence } = await this.classifier.classify({
          text: pageTexts.join("\n"),
          candidateTypes,
        });
        await this.store.setDocumentType(doc.id, type);
        this.logger.log(
          `Package ${packageId}: "${doc.originalFilename}" → ${type} (${confidence.toFixed(2)})`,
        );
      }
      this.logger.log(
        `Package ${packageId}: OCR + classification complete (${pkg.documents.length} document(s))`,
      );
    } catch (err) {
      await this.store.setPackageStatus(packageId, "Failed");
      throw err;
    }
  }
}
