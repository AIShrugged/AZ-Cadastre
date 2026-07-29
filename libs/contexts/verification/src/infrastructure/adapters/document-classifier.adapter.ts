import { Injectable } from "@nestjs/common";

import {
  DocumentClassifier,
  type ClassificationRequest,
} from "../../application/ports/index.js";
import {
  Classification,
  Confidence,
  type DocumentType,
} from "../../domain/value-objects/index.js";

const TYPE_KEYWORDS: Record<string, string[]> = {
  passport: ["passport"],
  driver_license: ["driver license", "driver licence", "driving licence"],
  application: ["application form", "application"],
  title_deed: ["title deed", "deed"],
  cadastral_extract: ["cadastral", "cadastre"],
};

const MATCHED_CONFIDENCE = 0.94;
const UNPLACED_CONFIDENCE = 0.3;

@Injectable()
export class DocumentClassifierAdapter extends DocumentClassifier {
  async classify(request: ClassificationRequest): Promise<Classification> {
    const hay = request.text.value.toLowerCase();
    let best: { type: DocumentType; pos: number } | null = null;

    for (const type of request.candidateTypes) {
      const keywords = TYPE_KEYWORDS[type.value] ?? [
        type.value.replace(/_/g, " "),
      ];
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
      ? Classification.of(best.type, Confidence.of(MATCHED_CONFIDENCE))
      : Classification.unplaced(Confidence.of(UNPLACED_CONFIDENCE));
  }
}
