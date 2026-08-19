import { Injectable } from '@nestjs/common';

import {
  DocumentSegmenter,
  type SegmentationRequest,
} from '../../application/ports/outbound/index.js';
import type {
  DocumentTypeSpec,
  PageRange,
} from '../../domain/value-objects/index.js';

import { looksLike } from './hint-matching.js';
import { tileIntoRanges } from './page-range-tiling.js';

@Injectable()
export class DocumentSegmenterAdapter extends DocumentSegmenter {
  async segment(request: SegmentationRequest): Promise<readonly PageRange[]> {
    const starts: number[] = [];
    let running: DocumentTypeSpec | null = null;

    for (const page of request.pages) {
      const found = looksLike(page.text.value, request.candidates);

      // A sheet that names no type at all carries on the document it was found
      // in: continuation pages rarely repeat the heading.
      if (!found) continue;

      if (running && !running.type.equals(found.type)) {
        starts.push(page.number.value);
      }

      running = found;
    }

    return tileIntoRanges(starts, request.pages.length);
  }
}
