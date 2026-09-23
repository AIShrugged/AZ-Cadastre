import { createHash } from 'node:crypto';

import type { Logger } from '@cadastre/logger';

import type {
  ObjectStorage,
  OcrProvider,
} from '../../application/ports/outbound/index.js';
import {
  ContentType,
  PageImage,
  StorageKey,
} from '../../domain/value-objects/index.js';

import { fetchFromTheArchive } from './national-archive.transport.js';
import { renderPdfPages, textLayerOf } from './pdf-page-renderer.js';

/** How the sheet was read, for the audit line. */
export type Digitisation = 'TextLayer' | 'Ocr';

export type DigitisedPdf = {
  readonly text: string;
  readonly how: Digitisation;
  readonly pages: number;
};

/*
 * Where the archive's own copies are kept while they are being read.
 *
 * Under a digest of the link and not under the package: the same certified copy
 * reached by two packages is one file, and a key that named the package would
 * put the archive's paper in the submission's own folder, where an inspector
 * downloading "their" files would get it.
 */
const FOLDER = 'national-archive';

/**
 * The signed PDF behind a QR code, turned into text (ADR-0035).
 *
 * The code on a certified copy opens a page with a download button on it —
 * «Sənədi yüklə» — and the file behind that button is the archive's own copy of
 * the paper, signed. It is what the eight lines of the comparison and the six
 * of the signature panel are read off: the `verifyQr` metadata states the
 * signature and nothing about what the paper says, so without this the check
 * has eight `NotStated` lines and calls that an answer.
 *
 * Read exactly where the file can be read exactly. A born-digital PDF carries
 * its own text and is parsed; a scan carries none and goes through the same
 * renderer and the same OCR provider every other sheet in the system does —
 * there is no second reader here, and a page rendered at `PDF_PAGE_DPI` is the
 * page the pipeline would have rendered.
 *
 * Nothing it can fail at is fatal. A link that has expired, a file that is not a
 * PDF, a renderer that will not open it, an OCR provider that refuses — each
 * comes back `null`, and the stage answers from the metadata alone, which is
 * what it answered before this existed.
 */
export class SignedPdfDigitiser {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly ocr: OcrProvider,
    private readonly logger: Logger,
    private readonly limits: { pageDpi: number; maxPages: number },
  ) {}

  async digitise(
    contentUrl: string,
    timeoutMs: number,
  ): Promise<DigitisedPdf | null> {
    const startedAt = Date.now();

    try {
      const pdf = await this.fetch(contentUrl, timeoutMs);

      if (!pdf) return null;

      const key = SignedPdfDigitiser.keyOf(contentUrl);
      const layer = await textLayerOf(key, pdf, this.limits.maxPages);
      const digitised = layer
        ? { text: layer, how: 'TextLayer' as const, pages: 0 }
        : await this.recognise(key, pdf);

      this.logger.debug("The archive's signed copy was digitised", {
        // The link is presigned and carries a case id, so it is logged as its
        // digest — the same key the pages were written under (ADR-0008).
        key: key.value,
        how: digitised.how,
        pages: digitised.pages,
        characters: digitised.text.length,
        durationMs: Date.now() - startedAt,
      });

      return digitised.text.trim().length === 0 ? null : digitised;
    } catch (error) {
      // Never thrown on: the archive answered, and an answer without its PDF is
      // still the answer the stage had before there was a PDF to read.
      this.logger.debug("The archive's signed copy could not be digitised", {
        durationMs: Date.now() - startedAt,
        error,
      });

      return null;
    }
  }

  private async fetch(
    contentUrl: string,
    timeoutMs: number,
  ): Promise<Uint8Array | null> {
    // The download lives in the archive's own zone, which answers no AAAA
    // question, so it is fetched the way the service itself is: IPv4 only and
    // asked twice before it is given up on (COMM-144).
    const response = await fetchFromTheArchive(contentUrl, {
      headers: { accept: 'application/pdf' },
      timeoutMs,
      logger: this.logger,
    });

    if (!response.ok) {
      this.logger.debug('The archive would not serve its signed copy', {
        status: response.status,
      });

      return null;
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  private async recognise(
    key: StorageKey,
    pdf: Uint8Array,
  ): Promise<DigitisedPdf> {
    const sheets: string[] = [];

    for await (const rendering of renderPdfPages(key, pdf, this.limits)) {
      const page = StorageKey.create(
        `${key.value}/pages/page_${String(rendering.number).padStart(3, '0')}.png`,
      );

      await this.storage.putObject({
        key: page,
        body: rendering.png,
        contentType: ContentType.PNG,
      });

      const read = await this.ocr.recognise(
        PageImage.of(page, ContentType.PNG),
      );

      sheets.push(read.text.value);
    }

    return { text: sheets.join('\n'), how: 'Ocr', pages: sheets.length };
  }

  private static keyOf(contentUrl: string): StorageKey {
    const digest = createHash('sha256')
      .update(contentUrl)
      .digest('hex')
      .slice(0, 32);

    return StorageKey.create(`${FOLDER}/${digest}/document.pdf`);
  }
}
