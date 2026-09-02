import { Injectable } from '@nestjs/common';

import {
  DocumentClassifier,
  type ClassificationRequest,
} from '../../application/ports/outbound/index.js';
import { looksLike } from '../../domain/services/index.js';
import {
  Classification,
  Confidence,
  DocumentCatalogue,
} from '../../domain/value-objects/index.js';

const MATCHED_CONFIDENCE = 0.94;
const UNPLACED_CONFIDENCE = 0.3;

@Injectable()
export class DocumentClassifierAdapter extends DocumentClassifier {
  async classify(request: ClassificationRequest): Promise<Classification> {
    const found = looksLike(request.text.value, request.candidates);

    if (found)
      return Classification.of(found.type, Confidence.of(MATCHED_CONFIDENCE));

    // The profile is asked first and the catalogue only afterwards: a heading
    // the profile knows is the answer even when a catalogued one appears
    // earlier on the sheet, because only the profile's own types answer a
    // requirement (ADR-0012).
    const catalogued = looksLike(
      request.text.value,
      DocumentCatalogue.KNOWN.entries,
    );

    if (catalogued) {
      return Classification.outOfProfile(
        Confidence.of(MATCHED_CONFIDENCE),
        catalogued.type,
      );
    }

    return Classification.unplaced(Confidence.of(UNPLACED_CONFIDENCE));
  }
}
