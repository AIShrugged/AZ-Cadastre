import { Injectable } from "@nestjs/common";

import {
  OCRProvider,
  type OcrPageInput,
  type OcrPageResult,
} from "../../application/ports/ocr-provider.port.js";

/**
 * Mock OCR provider (ADR-0003). No real recognition: it derives deterministic,
 * type-hinted text from the filename embedded in the page's storage key
 * (`<uuid>/<name>`), so the downstream classifier has something coherent to read
 * and a given upload always yields the same result. Swap for a real adapter
 * (hosted OCR API over the page image) without touching callers.
 */
/** Simulated per-page recognition latency, so pipeline progress is observable. */
const MOCK_OCR_LATENCY_MS = 1200;

@Injectable()
export class OcrProviderAdapter extends OCRProvider {
  async recognize(input: OcrPageInput): Promise<OcrPageResult> {
    // Stand in for a slow external OCR call — this is what makes the pipeline
    // long-running (and worth polling). Drop it in the real adapter.
    await new Promise((r) => setTimeout(r, MOCK_OCR_LATENCY_MS));

    const filename = input.imageStorageKey.split("/").pop() ?? "";
    const text = fakeText(filename);
    // Deterministic confidence in [0.82, 0.97] so re-runs are stable.
    const confidence = 0.82 + (hash(input.imageStorageKey) % 16) / 100;
    return { text, confidence };
  }
}

/** Canned page text that names the document type, keyed off the filename. */
function fakeText(filename: string): string {
  const name = filename.toLowerCase();
  if (name.includes("passport")) {
    return [
      "REPUBLIC OF AZERBAIJAN",
      "PASSPORT",
      "Surname / Soyad: ALIYEV",
      "Given names / Ad: ELCHIN",
      "Date of birth: 14.03.1988",
      "Passport No: AZE1234567",
      "Date of expiry: 21.09.2030",
    ].join("\n");
  }
  if (
    name.includes("license") ||
    name.includes("licence") ||
    name.includes("driver")
  ) {
    return [
      "DRIVER LICENSE",
      "Surname: ALIYEV",
      "Name: ELCHIN",
      "License No: AZ87654321",
      "Expires: 05.06.2029",
    ].join("\n");
  }
  if (name.includes("application") || name.includes("form")) {
    return [
      "APPLICATION FORM",
      "Applicant: ELCHIN ALIYEV",
      "Passport No: AZE1234567",
      "Driver License No: AZ87654321",
    ].join("\n");
  }
  if (name.includes("title") || name.includes("deed")) {
    return [
      "TITLE DEED",
      "Owner: ELCHIN ALIYEV",
      "Parcel ID: AZ-CAD-1024-311",
      "Issue date: 12.02.2021",
    ].join("\n");
  }
  if (name.includes("cadas")) {
    return [
      "CADASTRAL EXTRACT",
      "Parcel ID: AZ-CAD-1024-311",
      "Area: 642 m2",
      "Registry date: 03.11.2020",
    ].join("\n");
  }
  return `DOCUMENT\nReference: ${filename}\n(no distinguishing text recognised)`;
}

/** FNV-1a — small, stable, deterministic (no Math.random). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
