import { describe, expect, it } from "vitest";

import { Confidence } from "./confidence.vo.js";
import { OcrResult } from "./ocr-result.vo.js";
import { RecognisedText } from "./recognised-text.vo.js";

describe("OcrResult", () => {
  it("carries the text read off the page and how sure the provider was", () => {
    const result = OcrResult.of(
      RecognisedText.of("Republic of Azerbaijan"),
      Confidence.of(0.93),
    );

    expect(result.text.value).toBe("Republic of Azerbaijan");
    expect(result.confidence.value).toBe(0.93);
  });

  it("reads a page the provider read nothing off as an illegible result", () => {
    const result = OcrResult.illegible();

    expect(result.text.isEmpty).toBe(true);
    expect(result.confidence.equals(Confidence.none())).toBe(true);
  });

  it("is legible once anything at all was read", () => {
    expect(
      OcrResult.of(RecognisedText.of("A"), Confidence.of(0.1)).isLegible,
    ).toBe(true);
  });

  it("is not legible when the provider ran and read nothing", () => {
    expect(OcrResult.illegible().isLegible).toBe(false);
  });

  it("is not legible when the page read as whitespace alone", () => {
    expect(
      OcrResult.of(RecognisedText.of("   \n "), Confidence.of(0.8)).isLegible,
    ).toBe(false);
  });

  it("judges legibility on the text, not on how sure the provider was", () => {
    expect(
      OcrResult.of(RecognisedText.of("faint but read"), Confidence.none())
        .isLegible,
    ).toBe(true);
  });

  it("is equal to another result of the same text and the same confidence", () => {
    const first = OcrResult.of(RecognisedText.of("abc"), Confidence.of(0.5));
    const second = OcrResult.of(RecognisedText.of("abc"), Confidence.of(0.5));

    expect(first.equals(second)).toBe(true);
  });

  it("differs when the text differs", () => {
    const first = OcrResult.of(RecognisedText.of("abc"), Confidence.of(0.5));
    const second = OcrResult.of(RecognisedText.of("abd"), Confidence.of(0.5));

    expect(first.equals(second)).toBe(false);
  });

  it("differs when the confidence differs", () => {
    const first = OcrResult.of(RecognisedText.of("abc"), Confidence.of(0.5));
    const second = OcrResult.of(RecognisedText.of("abc"), Confidence.of(0.6));

    expect(first.equals(second)).toBe(false);
  });

  it("is the same for every illegible page", () => {
    expect(OcrResult.illegible().equals(OcrResult.illegible())).toBe(true);
  });
});
