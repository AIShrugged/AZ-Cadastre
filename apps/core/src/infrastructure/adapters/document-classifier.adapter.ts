import { Injectable } from "@nestjs/common";

import {
  DocumentClassifier,
  type Classification,
  type ClassifyInput,
} from "../../application/ports/document-classifier.port.js";
import { UNKNOWN_TYPE } from "../../domain/profiles.js";

/** Keywords that mark each document type in OCR text. */
const TYPE_KEYWORDS: Record<string, string[]> = {
  passport: ["passport"],
  driver_license: ["driver license", "driver licence", "driving licence"],
  application: ["application form", "application"],
  title_deed: ["title deed", "deed"],
  cadastral_extract: ["cadastral", "cadastre"],
};

/**
 * Mock document classifier (ADR-0003). Picks the candidate type whose keyword
 * appears *earliest* in the OCR text — i.e. in the document's header rather than
 * a body cross-reference (an application form mentions a passport number, so a
 * naive "contains" check would misfire). Falls back to "unknown". A real adapter
 * (an ML classifier over the text) drops in behind the same port.
 */
@Injectable()
export class DocumentClassifierAdapter extends DocumentClassifier {
  async classify(input: ClassifyInput): Promise<Classification> {
    const hay = input.text.toLowerCase();
    let best: { type: string; pos: number } | null = null;

    for (const type of input.candidateTypes) {
      const keywords = TYPE_KEYWORDS[type] ?? [type.replace(/_/g, " ")];
      let pos = -1;
      for (const kw of keywords) {
        const at = hay.indexOf(kw);
        if (at !== -1 && (pos === -1 || at < pos)) pos = at;
      }
      if (pos !== -1 && (best === null || pos < best.pos)) {
        best = { type, pos };
      }
    }

    return best
      ? { type: best.type, confidence: 0.94 }
      : { type: UNKNOWN_TYPE, confidence: 0.3 };
  }
}
