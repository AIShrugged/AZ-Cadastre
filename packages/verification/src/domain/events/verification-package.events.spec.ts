import { DomainEvent } from "@cadastre/shared";
import { describe, expect, it } from "vitest";

import {
  Classification,
  Confidence,
  DocumentId,
  DocumentType,
  FailureReason,
  PackageId,
  PageId,
  SourceFileId,
  VerificationProfile,
} from "../value-objects/index.js";
import {
  DocumentClassified,
  FieldsExtracted,
  PackageSubmitted,
  PageRecognised,
  SourceFileSegmented,
  SourceFileSplitIntoPages,
  VerificationCompleted,
  VerificationFailed,
  VerificationStarted,
} from "./verification-package.events.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

describe("the events a verification package applies", () => {
  it("names every one of them for this context and for what was decided", () => {
    const packageId = PackageId.of(anId());
    const sourceFileId = SourceFileId.of(anId());
    const documentId = DocumentId.of(anId());

    const events = [
      new PackageSubmitted(packageId, VerificationProfile.CADASTRE, 2),
      new VerificationStarted(packageId),
      new SourceFileSplitIntoPages(packageId, sourceFileId, 3),
      new PageRecognised(packageId, sourceFileId, PageId.of(anId())),
      new SourceFileSegmented(packageId, sourceFileId, 2),
      new DocumentClassified(
        packageId,
        documentId,
        Classification.unplaced(Confidence.none()),
      ),
      new FieldsExtracted(packageId, documentId, 5),
      new VerificationCompleted(packageId),
      new VerificationFailed(packageId, FailureReason.create("the provider gave up")),
    ];

    expect(events.map((event) => event.type)).toEqual([
      "verification.PackageSubmitted",
      "verification.VerificationStarted",
      "verification.SourceFileSplitIntoPages",
      "verification.PageRecognised",
      "verification.SourceFileSegmented",
      "verification.DocumentClassified",
      "verification.FieldsExtracted",
      "verification.VerificationCompleted",
      "verification.VerificationFailed",
    ]);
  });

  it("makes every one of them something the domain decided", () => {
    expect(new VerificationStarted(PackageId.of(anId()))).toBeInstanceOf(
      DomainEvent,
    );
  });

  it("stamps no time on them: infrastructure does that when they are written", () => {
    const event = new VerificationStarted(PackageId.of(anId()));

    expect(Object.keys(event).sort()).toEqual(["packageId", "type"]);
  });

  describe("PackageSubmitted", () => {
    it("says which profile the package is governed by and how many files arrived", () => {
      const packageId = PackageId.of(anId());

      const event = new PackageSubmitted(
        packageId,
        VerificationProfile.CADASTRE,
        3,
      );

      expect(event.packageId.equals(packageId)).toBe(true);
      expect(event.profile).toBe(VerificationProfile.CADASTRE);
      expect(event.fileCount).toBe(3);
    });
  });

  describe("SourceFileSplitIntoPages", () => {
    it("says which file was rendered and into how many sheets", () => {
      const sourceFileId = SourceFileId.of(anId());

      const event = new SourceFileSplitIntoPages(
        PackageId.of(anId()),
        sourceFileId,
        7,
      );

      expect(event.sourceFileId.equals(sourceFileId)).toBe(true);
      expect(event.pageCount).toBe(7);
    });
  });

  describe("PageRecognised", () => {
    it("says which page of which file was read", () => {
      const sourceFileId = SourceFileId.of(anId());
      const pageId = PageId.of(anId());

      const event = new PageRecognised(
        PackageId.of(anId()),
        sourceFileId,
        pageId,
      );

      expect(event.sourceFileId.equals(sourceFileId)).toBe(true);
      expect(event.pageId.equals(pageId)).toBe(true);
    });
  });

  describe("SourceFileSegmented", () => {
    it("says how many documents the file turned out to hold", () => {
      const sourceFileId = SourceFileId.of(anId());

      const event = new SourceFileSegmented(
        PackageId.of(anId()),
        sourceFileId,
        3,
      );

      expect(event.sourceFileId.equals(sourceFileId)).toBe(true);
      expect(event.documentCount).toBe(3);
    });
  });

  describe("DocumentClassified", () => {
    it("carries the whole decision, because it is internal to this context", () => {
      const classification = Classification.of(
        DocumentType.create("title_deed"),
        Confidence.of(0.91),
      );

      const event = new DocumentClassified(
        PackageId.of(anId()),
        DocumentId.of(anId()),
        classification,
      );

      expect(event.classification).toBe(classification);
    });
  });

  describe("FieldsExtracted", () => {
    it("says how many values were pulled from the document", () => {
      const event = new FieldsExtracted(
        PackageId.of(anId()),
        DocumentId.of(anId()),
        4,
      );

      expect(event.fieldCount).toBe(4);
    });
  });

  describe("VerificationFailed", () => {
    it("says why the package stopped", () => {
      const event = new VerificationFailed(
        PackageId.of(anId()),
        FailureReason.create("the OCR provider gave up"),
      );

      expect(event.reason.value).toBe("the OCR provider gave up");
    });
  });
});
