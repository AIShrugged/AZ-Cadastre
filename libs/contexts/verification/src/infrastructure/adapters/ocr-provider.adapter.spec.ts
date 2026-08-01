import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentType,
  OcrResult,
  PageImage,
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
  contentType: ContentType = ContentType.PNG,
): Promise<OcrResult> {
  const reading = new OcrProviderAdapter().recognise(
    PageImage.of(StorageKey.create(imageStorageKey), contentType),
  );

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
    const key = `${anId()}/vesiqe.png`;

    const first = await recognise(key);
    const second = await recognise(key);

    expect(second.text.equals(first.text)).toBe(true);
    expect(second.confidence.equals(first.confidence)).toBe(true);
  });

  it("reads an identity card page as an identity card", async () => {
    const result = await recognise(`${anId()}/vesiqe-scan.png`);

    expect(result.text.value).toContain("ŞƏXSİYYƏT VƏSİQƏSİ");
    expect(result.text.value).toContain("Vəsiqə No: AZE1234567");
  });

  it("reads a sheet rendered off a PDF as the file it came out of, not as a numbered page", async () => {
    const result = await recognise(`${anId()}/vesiqe.pdf/pages/page_002.png`);

    expect(result.text.value).toContain("ŞƏXSİYYƏT VƏSİQƏSİ");
  });

  it("gives two sheets of one PDF their own confidences, so a file does not read as one page", async () => {
    const file = `${anId()}/vesiqe.pdf`;

    const first = await recognise(`${file}/pages/page_001.png`);
    const second = await recognise(`${file}/pages/page_002.png`);

    expect(second.confidence.equals(first.confidence)).toBe(false);
  });

  it("reads a licence page as a licence, however the word was spelled", async () => {
    const azeri = await recognise(`${anId()}/lisenziya.png`);
    const english = await recognise(`${anId()}/license.png`);
    const british = await recognise(`${anId()}/licence.png`);

    for (const result of [azeri, english, british]) {
      expect(result.text.value).toContain("LİSENZİYA");
      expect(result.text.value).toContain("Lisenziya No: AZ-LIC-2019-4471");
    }
  });

  it("reads an annex as the annex and not as the licence it belongs to", async () => {
    const result = await recognise(`${anId()}/lisenziya-elave.png`);

    expect(result.text.value).toContain("LİSENZİYAYA ƏLAVƏ");
    expect(result.text.value).toContain("Əlavə No: 1");
  });

  it("reads a registration application as one, mentioning the documents it cites", async () => {
    const result = await recognise(`${anId()}/qeydiyyat-erize.pdf.png`);

    expect(result.text.value).toContain("DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ");
    expect(result.text.value).toContain("Şəxsiyyət vəsiqəsi No: AZE1234567");
  });

  it("tells the notification-procedure application apart from the registration one", async () => {
    const result = await recognise(`${anId()}/bildiris-erize.png`);

    expect(result.text.value).toContain("BİLDİRİŞ İCRAATI QAYDASINDA ƏRİZƏ");
  });

  it("reads an architectural plan as an architectural plan", async () => {
    const result = await recognise(`${anId()}/memarliq-hell.png`);

    expect(result.text.value).toContain("MEMARLIQ-PLANLAŞDIRMA HƏLLİ");
    expect(result.text.value).toContain("Kadastr nömrəsi: AZ-CAD-1024-311");
  });

  it("gives each persona its own text, so a package of different files does not read alike", async () => {
    const folder = anId();

    const texts = await Promise.all(
      [
        "qeydiyyat.png",
        "vesiqe.png",
        "bildiris.png",
        "memarliq.png",
        "lisenziya.png",
        "lisenziya-elave.png",
      ].map((filename) => recognise(`${folder}/${filename}`)),
    );

    expect(new Set(texts.map((result) => result.text.value)).size).toBe(6);
  });

  it("falls back to a page that names itself when the filename says nothing about the type", async () => {
    const result = await recognise(`${anId()}/scan-0001.png`);

    expect(result.text.value).toContain("SƏNƏD");
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

  it("reads the same page the same way whatever format the source file was", async () => {
    const key = `${anId()}/vesiqe.png`;

    const fromPdf = await recognise(key, ContentType.PDF);
    const fromImage = await recognise(key, ContentType.PNG);

    expect(fromImage.equals(fromPdf)).toBe(true);
  });

  it("reads a key with no folder in it off the key itself", async () => {
    const result = await recognise("vesiqe.png");

    expect(result.text.value).toContain("ŞƏXSİYYƏT VƏSİQƏSİ");
  });
});
