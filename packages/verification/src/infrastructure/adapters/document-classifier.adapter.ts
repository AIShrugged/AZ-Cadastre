import { Injectable } from '@nestjs/common';

import {
  DocumentClassifier,
  type ClassificationRequest,
} from '../../application/ports/outbound/index.js';
import { enclosesHeading, headingMatch } from '../../domain/services/index.js';
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
    const catalogue = DocumentCatalogue.KNOWN;
    const found = headingMatch(request.text.value, request.candidates);
    // The profile is asked first and the catalogue only afterwards: a heading
    // the profile knows is the answer even when a catalogued one appears
    // earlier on the sheet, because only the profile's own types answer a
    // requirement (ADR-0012).
    //
    // With one exception, and it is not that rule loosened but that rule read
    // literally. A catalogued heading that CONTAINS the profile's is not a
    // second reading of the sheet, it is the same words read short: the profile
    // is headed "паспорт" for an identity card and the catalogue "технический
    // паспорт" for a building's, and without this every technical passport is
    // answered `identity_card` — a seven-letter match beating an exact one
    // (ADR-0022). Two headings that merely both appear still go to the profile.
    const swallowed =
      found !== null &&
      enclosesHeading(request.text.value, found, catalogue.entries);

    if (found && !swallowed) {
      return Classification.of(
        found.spec.type,
        Confidence.of(MATCHED_CONFIDENCE),
      );
    }

    const catalogued = headingMatch(request.text.value, catalogue.entries);

    if (catalogued) {
      return Classification.outOfProfile(
        Confidence.of(MATCHED_CONFIDENCE),
        catalogued.spec.type,
      );
    }

    return Classification.unplaced(Confidence.of(UNPLACED_CONFIDENCE));
  }
}
