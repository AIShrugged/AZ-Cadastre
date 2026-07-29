import { Injectable } from "@nestjs/common";

import {
  OcrProvider,
  type OcrPageRequest,
} from "../../application/ports/index.js";
import {
  Confidence,
  OcrResult,
  RecognisedText,
} from "../../domain/value-objects/index.js";

const MOCK_OCR_LATENCY_MS = 1200;

@Injectable()
export class OcrProviderAdapter extends OcrProvider {
  async recognise(request: OcrPageRequest): Promise<OcrResult> {
    await new Promise((r) => setTimeout(r, MOCK_OCR_LATENCY_MS));

    const key = request.imageStorageKey.value;
    const filename = key.split("/").pop() ?? "";
    const text = fakeText(filename);
    // Deterministic in [0.82, 0.97], so a re-run reports the same number.
    const confidence = 0.82 + (hash(key) % 16) / 100;

    return OcrResult.of(RecognisedText.of(text), Confidence.of(confidence));
  }
}

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

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
