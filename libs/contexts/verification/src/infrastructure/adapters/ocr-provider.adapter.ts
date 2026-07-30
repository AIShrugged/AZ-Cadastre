import { Injectable } from "@nestjs/common";

import { OcrProvider } from "../../application/ports/index.js";
import {
  Confidence,
  OcrResult,
  type PageImage,
  RecognisedText,
} from "../../domain/value-objects/index.js";

const MOCK_OCR_LATENCY_MS = 1200;

@Injectable()
export class OcrProviderAdapter extends OcrProvider {
  // Nothing throttles a fake, so a whole document's worth of pages can go at
  // once and the mock keeps a demo as quick as it is convincing.
  override readonly pagesAtOnce = 8;

  async recognise(image: PageImage): Promise<OcrResult> {
    await new Promise((r) => setTimeout(r, MOCK_OCR_LATENCY_MS));

    const key = image.storageKey.value;
    // More than the last segment, because a page rendered off a PDF is named
    // after its number and carries the uploaded filename in its folder — but not
    // the random prefix the presign step put in front, whose hex spells "deed"
    // often enough to matter.
    const text = fakeText(key.slice(key.indexOf("/") + 1));
    // Deterministic in [0.82, 0.97], so a re-run reports the same number.
    const confidence = 0.82 + (hash(key) % 16) / 100;

    return OcrResult.of(RecognisedText.of(text), Confidence.of(confidence));
  }
}

function fakeText(key: string): string {
  const name = key.toLowerCase();
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
  return `DOCUMENT\nReference: ${key}\n(no distinguishing text recognised)`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
