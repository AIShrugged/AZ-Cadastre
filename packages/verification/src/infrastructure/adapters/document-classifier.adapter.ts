import { Injectable } from '@nestjs/common';

import {
  DocumentClassifier,
  type ClassificationRequest,
} from '../../application/ports/outbound/index.js';
import {
  Classification,
  Confidence,
} from '../../domain/value-objects/index.js';

import { looksLike } from './hint-matching.js';

const MATCHED_CONFIDENCE = 0.94;
const UNPLACED_CONFIDENCE = 0.3;

@Injectable()
export class DocumentClassifierAdapter extends DocumentClassifier {
  async classify(request: ClassificationRequest): Promise<Classification> {
    const found = looksLike(request.text.value, request.candidates);

    return found
      ? Classification.of(found.type, Confidence.of(MATCHED_CONFIDENCE))
      : Classification.unplaced(Confidence.of(UNPLACED_CONFIDENCE));
  }
}
