import { createHash } from 'node:crypto';

import type { Logger } from '@cadastre/logger';

import type {
  ObjectStorage,
  OcrProvider,
} from '../../application/ports/outbound/index.js';
import {
  Confidence,
  ContentType,
  PageImage,
  PageNumber,
  RecognisedText,
  StorageKey,
} from '../../domain/value-objects/index.js';
import {
  EmptyPdfException,
  PdfTooLongException,
  UnreadablePdfException,
} from '../exceptions/index.js';

import { fetchFromTheArchive } from './national-archive.transport.js';
import { renderPdfPages, textLayerOf } from './pdf-page-renderer.js';

/** How the sheet was read, for the audit line. */
export type Digitisation = 'TextLayer' | 'Ocr';

/**
 * One sheet of the archive's copy, in the shape the extraction port asks a
 * sheet to arrive in (COMM-145).
 *
 * `image` is null on a born-digital file: its text layer is exact, and
 * rendering a page to show a reader a picture of what it has already read
 * verbatim buys nothing and costs a page of tokens.
 */
export type DigitisedSheet = {
  readonly number: PageNumber;
  readonly image: PageImage | null;
  readonly text: RecognisedText;
  readonly read: Confidence;
};

export type DigitisedPdf = {
  readonly text: string;
  readonly sheets: readonly DigitisedSheet[];
  readonly how: Digitisation;
  readonly pages: number;
};

/*
 * Why the archive's own copy could not be read, in the words of the step that
 * could not read it (COMM-151).
 *
 * One word per failure and each of them its own. Until now every one of these
 * came back as the same `null`, so a report that said "the archive states
 * nothing" covered a link that had expired, a file that was not a PDF and an
 * OCR provider that refused, and the log could not tell them apart either — the
 * customer's package showed eight empty lines and there was nothing on the
 * stand that said which of the four steps had produced them.
 */
export const UNREAD_COPY_REASONS = [
  // The archive answered the link with something other than 200.
  'LinkRefused',
  // The link could not be followed at all: it timed out, or the wire failed.
  'NotFetched',
  // Fetched, and what came back is not a file the renderer will open.
  'NotAPdf',
  // A PDF of more pages than this deployment reads.
  'TooLong',
  // A PDF of no pages at all.
  'NoPages',
  // The OCR provider would not read the pages that were rendered for it.
  'OcrRefused',
  // Read end to end, and it carries no text — neither a layer nor a reading.
  'NothingPrinted',
  // Anything else. Named as unknown rather than folded into one of the above,
  // because a reason that is a guess is worse than a reason that says so.
  'Failed',
] as const;

export type UnreadCopyReason = (typeof UNREAD_COPY_REASONS)[number];

/**
 * What came of following the link: the copy, or the one word for why not.
 *
 * Never an exception. The archive answered, and an answer without its PDF is
 * still the answer the stage had before there was a PDF to read — what changed
 * with COMM-151 is that the stage is now told which kind of nothing it got.
 */
export type DigitisedCopy =
  { readonly read: DigitisedPdf } | { readonly unread: UnreadCopyReason };

/*
 * How well a text layer was read: exactly.
 *
 * Not modesty's sake. The extractor caps a value at the confidence of the sheet
 * it was read off, so a figure here is a ceiling on everything read off a
 * born-digital file — and the file was not read at all, it was parsed.
 */
const PARSED_EXACTLY = 1;

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
 * comes back as an `unread` with its own name on it, and the stage answers from
 * the metadata alone, which is what it answered before this existed.
 *
 * Each of those failures says which one it was, in the answer and in the log
 * (COMM-151). They used to share one `null` and one debug line carrying an
 * error object, so a package whose comparison came back empty could not be told
 * on the stand from one whose copy simply does not print those lines — and the
 * first is ours to fix while the second is not.
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
  ): Promise<DigitisedCopy> {
    const startedAt = Date.now();
    const key = SignedPdfDigitiser.keyOf(contentUrl);
    let pdf: Uint8Array;

    try {
      const fetched = await this.fetch(contentUrl, timeoutMs, key);

      if (!fetched) return this.unread('LinkRefused', key, startedAt);

      pdf = fetched;
    } catch (error) {
      return this.unread('NotFetched', key, startedAt, error);
    }

    let layer: readonly string[] | null;

    try {
      layer = await textLayerOf(key, pdf, this.limits.maxPages);
    } catch (error) {
      // Opening the file is the renderer's own step, so what it throws names
      // the file: not a PDF, no pages, more pages than this deployment reads.
      return this.unread(becauseOfTheFile(error), key, startedAt, error);
    }

    let digitised: DigitisedPdf;

    try {
      digitised = layer
        ? SignedPdfDigitiser.parsed(layer)
        : await this.recognise(key, pdf);
    } catch (error) {
      /*
       * Past the text layer, so this is the scan path: the renderer opened the
       * file once already, and what fails now is a page of it, the bucket that
       * page is written to, or the provider asked to read it. The renderer's
       * own exceptions still name themselves; everything else here is the
       * reading, and `OcrRefused` is the honest word for it.
       */
      return this.unread(becauseOfTheReading(error), key, startedAt, error);
    }

    if (digitised.text.trim().length === 0) {
      return this.unread('NothingPrinted', key, startedAt, undefined, {
        how: digitised.how,
        pages: digitised.pages,
      });
    }

    this.logger.debug("The archive's signed copy was digitised", {
      // The link is presigned and carries a case id, so it is logged as its
      // digest — the same key the pages were written under (ADR-0008).
      key: key.value,
      how: digitised.how,
      pages: digitised.pages,
      characters: digitised.text.length,
      durationMs: Date.now() - startedAt,
    });

    return { read: digitised };
  }

  /*
   * One line per failure, and the line names the failure (COMM-151).
   *
   * `warn` and not `debug`: every one of these is this system failing to read a
   * file the archive served it, and the report it produces — eight lines the
   * archive "states nothing" on — looks from the outside exactly like an
   * archive holding a sparse record. Whoever reads the stand's log after a
   * customer asks why the comparison is empty has to find this line.
   */
  private unread(
    because: UnreadCopyReason,
    key: StorageKey,
    startedAt: number,
    error?: unknown,
    context: Record<string, unknown> = {},
  ): DigitisedCopy {
    this.logger.warn("The archive's signed copy could not be read", {
      because,
      key: key.value,
      durationMs: Date.now() - startedAt,
      ...context,
      ...(error === undefined ? {} : { error }),
    });

    return { unread: because };
  }

  private async fetch(
    contentUrl: string,
    timeoutMs: number,
    key: StorageKey,
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
      // The status is the whole of what tells a link that has expired — the
      // presigned link is good for an hour — from a file the archive has
      // withdrawn, and the caller's own line cannot carry it.
      this.logger.warn('The archive would not serve its signed copy', {
        key: key.value,
        status: response.status,
      });

      return null;
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  private static parsed(pages: readonly string[]): DigitisedPdf {
    const sheets = pages.map((text, index) => ({
      number: PageNumber.of(index + 1),
      image: null,
      text: RecognisedText.of(text),
      read: Confidence.of(PARSED_EXACTLY),
    }));

    return {
      text: pages.join('\n'),
      sheets,
      how: 'TextLayer',
      pages: sheets.length,
    };
  }

  private async recognise(
    key: StorageKey,
    pdf: Uint8Array,
  ): Promise<DigitisedPdf> {
    const sheets: DigitisedSheet[] = [];

    for await (const rendering of renderPdfPages(key, pdf, this.limits)) {
      const page = StorageKey.create(
        `${key.value}/pages/page_${String(rendering.number).padStart(3, '0')}.png`,
      );

      await this.storage.putObject({
        key: page,
        body: rendering.png,
        contentType: ContentType.PNG,
      });

      const image = PageImage.of(page, ContentType.PNG);
      const read = await this.ocr.recognise(image);

      sheets.push({
        number: PageNumber.of(rendering.number),
        image,
        text: read.text,
        read: read.confidence,
      });
    }

    return {
      text: sheets.map(sheet => sheet.text.value).join('\n'),
      sheets,
      how: 'Ocr',
      pages: sheets.length,
    };
  }

  private static keyOf(contentUrl: string): StorageKey {
    const digest = createHash('sha256')
      .update(contentUrl)
      .digest('hex')
      .slice(0, 32);

    return StorageKey.create(`${FOLDER}/${digest}/document.pdf`);
  }
}

/*
 * Which of the file's own faults this was.
 *
 * Only the renderer's exceptions are named; anything else is `Failed`, because
 * a reason invented to fill the field sends whoever reads the log looking in
 * the wrong place.
 */
function becauseOfTheFile(error: unknown): UnreadCopyReason {
  if (error instanceof UnreadablePdfException) return 'NotAPdf';
  if (error instanceof PdfTooLongException) return 'TooLong';
  if (error instanceof EmptyPdfException) return 'NoPages';

  return 'Failed';
}

// Past the text layer the same three faults can still surface — the renderer
// opens the file a second time to draw its pages — and everything that is not
// one of them is the OCR provider or the bucket its pages went to.
function becauseOfTheReading(error: unknown): UnreadCopyReason {
  const file = becauseOfTheFile(error);

  return file === 'Failed' ? 'OcrRefused' : file;
}
