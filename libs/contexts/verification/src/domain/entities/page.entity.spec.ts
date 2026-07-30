import { describe, expect, it } from "vitest";

import { PageAlreadyRecognisedException } from "../exceptions/index.js";
import {
  Confidence,
  ContentType,
  OcrResult,
  PageId,
  PageImage,
  PageNumber,
  RecognisedText,
  StorageKey,
} from "../value-objects/index.js";
import { Page } from "./page.entity.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

function anImage(name = `pages/${anId()}.png`): PageImage {
  return PageImage.of(StorageKey.create(name), ContentType.PNG);
}

function aPage(number = 1): Page {
  return Page.create(PageId.of(anId()), PageNumber.of(number), anImage());
}

function anOcrResult(text = "Republic of Azerbaijan"): OcrResult {
  return OcrResult.of(RecognisedText.of(text), Confidence.of(0.9));
}

describe("Page", () => {
  it("is created as one sheet with its rendered image and nothing read off it yet", () => {
    const id = PageId.of(anId());
    const image = anImage("pages/first.png");

    const page = Page.create(id, PageNumber.first(), image);

    expect(page.id.equals(id)).toBe(true);
    expect(page.number.equals(PageNumber.first())).toBe(true);
    expect(page.image.equals(image)).toBe(true);
    expect(page.ocr).toBeNull();
    expect(page.isRecognised).toBe(false);
  });

  it("carries the format its image was stored in, which a rendered sheet and an uploaded photo do not share", () => {
    const photographed = Page.create(
      PageId.of(anId()),
      PageNumber.first(),
      PageImage.of(StorageKey.create("uploads/scan.jpg"), ContentType.JPEG),
    );

    expect(photographed.image.contentType.equals(ContentType.JPEG)).toBe(true);
  });

  it("is rebuilt from storage with whatever OCR had already read", () => {
    const ocr = anOcrResult();

    const page = Page.restore(
      PageId.of(anId()),
      PageNumber.of(3),
      anImage("pages/third.png"),
      ocr,
    );

    expect(page.ocr).toBe(ocr);
    expect(page.isRecognised).toBe(true);
  });

  it("is rebuilt from storage as unread when OCR had not reached it", () => {
    const page = Page.restore(
      PageId.of(anId()),
      PageNumber.first(),
      anImage("pages/first.png"),
      null,
    );

    expect(page.isRecognised).toBe(false);
  });

  it("records what OCR read, returning the page as it now stands", () => {
    const page = aPage();
    const ocr = anOcrResult();

    const recognised = page.recognised(ocr);

    expect(recognised.ocr).toBe(ocr);
    expect(recognised.isRecognised).toBe(true);
  });

  it("keeps its identity, its place in the document and its image when it is read", () => {
    const page = aPage(4);

    const recognised = page.recognised(anOcrResult());

    expect(recognised.id.equals(page.id)).toBe(true);
    expect(recognised.number.equals(page.number)).toBe(true);
    expect(recognised.image.equals(page.image)).toBe(true);
  });

  it("leaves the page it was read from alone, because a page never changes in place", () => {
    const page = aPage();

    page.recognised(anOcrResult());

    expect(page.ocr).toBeNull();
    expect(page.isRecognised).toBe(false);
  });

  it("records a page OCR read nothing off, because that is an outcome and not a failure", () => {
    const recognised = aPage().recognised(OcrResult.illegible());

    expect(recognised.isRecognised).toBe(true);
    expect(recognised.ocr?.isLegible).toBe(false);
  });

  it("refuses a second recognition rather than overwriting the first", () => {
    const recognised = aPage().recognised(anOcrResult("first reading"));

    expect(() => recognised.recognised(anOcrResult("second reading"))).toThrow(
      PageAlreadyRecognisedException,
    );
  });

  it("names the page it refuses to read twice", () => {
    const page = aPage();
    const recognised = page.recognised(anOcrResult());

    expect(() => recognised.recognised(anOcrResult())).toThrow(page.id.value);
  });

  it("changes nothing when it refuses a second recognition", () => {
    const first = anOcrResult("first reading");
    const recognised = aPage().recognised(first);

    expect(() => recognised.recognised(anOcrResult("second reading"))).toThrow(
      PageAlreadyRecognisedException,
    );

    expect(recognised.ocr).toBe(first);
  });

  it("refuses even a page restored from storage already read", () => {
    const page = Page.restore(
      PageId.of(anId()),
      PageNumber.first(),
      anImage("pages/first.png"),
      anOcrResult(),
    );

    expect(() => page.recognised(anOcrResult())).toThrow(
      PageAlreadyRecognisedException,
    );
  });
});
