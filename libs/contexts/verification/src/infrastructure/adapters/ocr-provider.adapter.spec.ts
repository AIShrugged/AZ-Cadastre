import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentType,
  OcrResult,
  StorageKey,
} from "../../domain/value-objects/index.js";
import { OcrProviderAdapter } from "./ocr-provider.adapter.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

async function recognise(
  imageStorageKey: string,
  contentType: ContentType = ContentType.PDF,
): Promise<OcrResult> {
  const reading = new OcrProviderAdapter().recognise({
    imageStorageKey: StorageKey.create(imageStorageKey),
    contentType,
  });

  await vi.advanceTimersByTimeAsync(1200);

  return reading;
}

describe("OcrProviderAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the same text and the same confidence off a page however often it is asked", async () => {
    const key = `${anId()}/passport.png`;

    const first = await recognise(key);
    const second = await recognise(key);

    expect(second.text.equals(first.text)).toBe(true);
    expect(second.confidence.equals(first.confidence)).toBe(true);
  });

  it("reads a passport page as a passport", async () => {
    const result = await recognise(`${anId()}/passport-scan.png`);

    expect(result.text.value).toContain("PASSPORT");
    expect(result.text.value).toContain("Passport No: AZE1234567");
  });

  it("reads a driver licence page as a driver licence, however the word was spelled", async () => {
    const license = await recognise(`${anId()}/license.png`);
    const licence = await recognise(`${anId()}/licence.png`);
    const driver = await recognise(`${anId()}/driver.png`);

    for (const result of [license, licence, driver]) {
      expect(result.text.value).toContain("DRIVER LICENSE");
    }
  });

  it("reads an application form as an application form, mentioning the documents it cites", async () => {
    const result = await recognise(`${anId()}/application.pdf.png`);

    expect(result.text.value).toContain("APPLICATION FORM");
    expect(result.text.value).toContain("Passport No: AZE1234567");
  });

  it("reads a title deed as a title deed", async () => {
    const result = await recognise(`${anId()}/title-deed.png`);

    expect(result.text.value).toContain("TITLE DEED");
    expect(result.text.value).toContain("Parcel ID: AZ-CAD-1024-311");
  });

  it("reads a cadastral extract as a cadastral extract", async () => {
    const result = await recognise(`${anId()}/cadastral-extract.png`);

    expect(result.text.value).toContain("CADASTRAL EXTRACT");
  });

  it("gives each persona its own text, so a package of different files does not read alike", async () => {
    const folder = anId();

    const texts = await Promise.all(
      ["passport.png", "license.png", "application.png", "deed.png", "cadastre.png"].map(
        (filename) => recognise(`${folder}/${filename}`),
      ),
    );

    expect(new Set(texts.map((result) => result.text.value)).size).toBe(5);
  });

  it("falls back to a page that names itself when the filename says nothing about the type", async () => {
    const result = await recognise(`${anId()}/scan-0001.png`);

    expect(result.text.value).toContain("DOCUMENT");
    expect(result.text.value).toContain("scan-0001.png");
    expect(result.text.value).toContain("no distinguishing text recognised");
  });

  it("reads something off every page, so nothing comes back illegible", async () => {
    const result = await recognise(`${anId()}/scan-0002.png`);

    expect(result.isLegible).toBe(true);
  });

  it("reports a confidence the domain accepts, between 0.82 and 0.97", async () => {
    const folder = anId();

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        recognise(`${folder}/page-${index}.png`),
      ),
    );

    for (const result of results) {
      expect(result.confidence.value).toBeGreaterThanOrEqual(0.82);
      expect(result.confidence.value).toBeLessThanOrEqual(0.97);
    }
  });

  it("takes the confidence from the key, so it is not one fixed number for every page", async () => {
    const folder = anId();

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        recognise(`${folder}/page-${index}.png`),
      ),
    );

    const distinct = new Set(results.map((result) => result.confidence.value));

    expect(distinct.size).toBeGreaterThan(1);
  });

  it("names the page it fell back on, so two unremarkable pages do not read alike", async () => {
    const folder = anId();

    const first = await recognise(`${folder}/page-1.png`);
    const second = await recognise(`${folder}/page-2.png`);

    expect(first.text.value).toContain("page-1.png");
    expect(second.text.value).toContain("page-2.png");
    expect(first.text.equals(second.text)).toBe(false);
  });

  it("reads the same page the same way whatever format the source document was", async () => {
    const key = `${anId()}/passport.png`;

    const fromPdf = await recognise(key, ContentType.PDF);
    const fromImage = await recognise(key, ContentType.PNG);

    expect(fromImage.equals(fromPdf)).toBe(true);
  });

  it("reads a key with no folder in it off the key itself", async () => {
    const result = await recognise("passport.png");

    expect(result.text.value).toContain("PASSPORT");
  });
});
