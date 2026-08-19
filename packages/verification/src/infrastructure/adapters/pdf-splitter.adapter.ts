import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  ObjectStorage,
  PdfSplitter,
  type PdfSplitRequest,
  type SplitPage,
} from '../../application/ports/outbound/index.js';
import {
  ContentType,
  PageImage,
  PageNumber,
  StorageKey,
} from '../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../verification.module-defs.js';

import { renderPdfPages } from './pdf-page-renderer.js';

@Injectable()
export class PdfSplitterAdapter extends PdfSplitter {
  private readonly logger = new Logger(PdfSplitterAdapter.name);
  private readonly limits: VerificationModuleOptions['pdf'];

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    private readonly storage: ObjectStorage,
  ) {
    super();
    this.limits = options.pdf;
  }

  async split(request: PdfSplitRequest): Promise<readonly SplitPage[]> {
    const source = await this.storage.getObject(request.storageKey);
    const pages: SplitPage[] = [];

    // Each page is stored as it comes off the renderer, so a long document never
    // holds every rendered image in memory at once.
    for await (const rendering of renderPdfPages(
      request.storageKey,
      source.body,
      this.limits,
    )) {
      const key = this.pageKey(request.storageKey, rendering.number);

      await this.storage.putObject({
        key,
        body: rendering.png,
        contentType: ContentType.PNG,
      });

      pages.push({
        number: PageNumber.of(rendering.number),
        image: PageImage.of(key, ContentType.PNG),
      });
    }

    this.logger.log(
      `Split "${request.storageKey.value}" into ${pages.length} page image(s) ` +
        `at ${this.limits.pageDpi} dpi`,
    );

    return pages;
  }

  // Under the original's own key, so the pages of a document stay findable from
  // it, and a second run of the split overwrites the images the first one wrote
  // instead of orphaning them. Padded, so a listing sorts the way pages read.
  private pageKey(source: StorageKey, number: number): StorageKey {
    return StorageKey.create(
      `${source.value}/pages/page_${String(number).padStart(3, '0')}.png`,
    );
  }
}
