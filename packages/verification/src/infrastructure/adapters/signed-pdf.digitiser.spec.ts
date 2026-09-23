import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Logger, SilentLogger, type LogContext } from '@cadastre/logger';

import { aPdfOf, aPdfWithoutATextLayerOf } from '../../../test/pdf-fixture.js';
import {
  ObjectStorage,
  OcrProvider,
  type PresignedDownload,
  type PresignedUpload,
  type PutObjectRequest,
  type StoredObject,
} from '../../application/ports/outbound/index.js';
import {
  Confidence,
  OcrResult,
  RecognisedText,
  type PageImage,
} from '../../domain/value-objects/index.js';

import {
  SignedPdfDigitiser,
  type DigitisedCopy,
  type DigitisedPdf,
} from './signed-pdf.digitiser.js';

const LINK = 'https://content-veams.milliarxiv.gov.az/f1d14ab4.PDF';

// Long enough to be a text layer and not a footer: a page of an actual document
// carries hundreds of characters, and that is how a scan's stray stamp is told
// from a file worth parsing.
const PRINTED = [
  'Senedin nomresi: 1471',
  ...Array.from(
    { length: 10 },
    (_, line) => `Sabuncu Rayon Icra Hakimiyyeti, setir ${line}`,
  ),
].join('\n');

class StorageStandingIn extends ObjectStorage {
  readonly written: PutObjectRequest[] = [];

  override presignUpload(): Promise<PresignedUpload> {
    throw new Error('the digitiser never presigns an upload');
  }

  override presignDownload(): Promise<PresignedDownload> {
    throw new Error('the digitiser never presigns a download');
  }

  override getObject(): Promise<StoredObject> {
    throw new Error('the digitiser reads the archive and not the bucket');
  }

  override async putObject(request: PutObjectRequest): Promise<void> {
    this.written.push(request);
  }
}

class ReaderStandingIn extends OcrProvider {
  override readonly pagesAtOnce = 4;
  readonly asked: string[] = [];
  #refusing = false;

  constructor(private readonly reading = 'Imzalayan: Memmedov Anar') {
    super();
  }

  // A provider that will not read the page it was handed: a rate limit, a
  // model that is down, a key that expired.
  refuse(): void {
    this.#refusing = true;
  }

  override async recognise(image: PageImage): Promise<OcrResult> {
    this.asked.push(image.storageKey.value);

    if (this.#refusing) throw new Error('429 rate limited');

    return this.reading.length === 0
      ? OcrResult.illegible()
      : OcrResult.of(RecognisedText.of(this.reading), Confidence.of(0.9));
  }
}

// Keeps the warnings, because what this spec is about is what the stand's log
// says when the comparison comes back empty (COMM-151).
class RecordingLogger extends Logger {
  readonly warnings: [string, LogContext | undefined][] = [];

  override log(): void {}
  override error(): void {}
  override debug(): void {}
  override verbose(): void {}

  override warn(message: string, context?: LogContext): void {
    this.warnings.push([message, context]);
  }

  override child(): Logger {
    return this;
  }
}

function aDigitiser(reading?: string) {
  const storage = new StorageStandingIn();
  const ocr = new ReaderStandingIn(reading);

  return {
    storage,
    ocr,
    digitiser: new SignedPdfDigitiser(storage, ocr, new SilentLogger(), {
      pageDpi: 72,
      maxPages: 10,
    }),
  };
}

function serving(body: Uint8Array | null, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(body ? (body as unknown as BodyInit) : 'nope', { status }),
  ) as unknown as typeof fetch;
}

describe('SignedPdfDigitiser', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /*
   * A born-digital sheet is read exactly rather than approximately, which is
   * the whole reason the text layer is asked about first: a certificate's
   * validity period misread by one digit is worse than unread (ADR-0035).
   */
  it('parses a PDF that carries its own text, and asks no reader', async () => {
    vi.stubGlobal('fetch', serving(aPdfOf(PRINTED)));
    const { digitiser, ocr, storage } = aDigitiser();

    const read = await digitiser.digitise(LINK, 1000);

    expect(readingOf(read).how).toBe('TextLayer');
    expect(readingOf(read).text).toContain('1471');
    expect(ocr.asked).toEqual([]);
    expect(storage.written).toEqual([]);
  });

  // A scan carries no text, so it goes through the same renderer and the same
  // OCR provider every other sheet in the system does.
  it('renders and reads a PDF that is a picture', async () => {
    vi.stubGlobal('fetch', serving(aPdfWithoutATextLayerOf(2)));
    const { digitiser, ocr, storage } = aDigitiser();

    const read = await digitiser.digitise(LINK, 1000);

    expect(readingOf(read).how).toBe('Ocr');
    expect(readingOf(read).pages).toBe(2);
    expect(readingOf(read).text).toContain('Imzalayan');
    expect(ocr.asked).toHaveLength(2);
    expect(storage.written).toHaveLength(2);
  });

  /*
   * The pages of the archive's own copy are kept under a digest of the link and
   * never under the package: the same certified copy reached by two packages is
   * one file, and a key naming the package would put the archive's paper in the
   * submission's folder, where an inspector downloading "their" files gets it.
   */
  it('keeps the rendered pages apart from the submission', async () => {
    vi.stubGlobal('fetch', serving(aPdfWithoutATextLayerOf(1)));
    const { digitiser, storage } = aDigitiser();

    await digitiser.digitise(LINK, 1000);

    expect(storage.written[0]?.key.value).toMatch(
      /^national-archive\/[\da-f]{32}\/document\.pdf\/pages\/page_001\.png$/u,
    );
    expect(storage.written[0]?.key.value).not.toContain('f1d14ab4');
  });

  /*
   * Each of these leaves the stage with the answer it had before there was a
   * copy to read, and never throws it over (ADR-0035) — and each of them says
   * which one it was (COMM-151).
   *
   * The name is the point. Until COMM-151 all four came back as one `null` and
   * one debug line, and a package whose comparison was empty could not be told
   * on the stand from one whose copy prints nothing: the customer asked why the
   * archive holds so little, and there was nothing in the log to answer with.
   */
  it.each([
    ['a link that has expired', () => serving(null, 403), 'LinkRefused'],
    [
      'a file that is not a PDF at all',
      () => serving(new Uint8Array([1, 2])),
      'NotAPdf',
    ],
    [
      'a server that cannot be reached',
      () =>
        vi.fn(async () => {
          throw new Error('ECONNRESET');
        }) as unknown as typeof fetch,
      'NotFetched',
    ],
  ])('says %s by its own name', async (_what, fetching, because) => {
    vi.stubGlobal('fetch', fetching());
    const { digitiser } = aDigitiser();

    await expect(digitiser.digitise(LINK, 1000)).resolves.toEqual({
      unread: because,
    });
  });

  // A file that reads as nothing at all has not been digitised: an empty string
  // would clear every line the metadata carried.
  it('says so where the copy reads as nothing', async () => {
    vi.stubGlobal('fetch', serving(aPdfWithoutATextLayerOf(1)));
    const { digitiser } = aDigitiser('');

    await expect(digitiser.digitise(LINK, 1000)).resolves.toEqual({
      unread: 'NothingPrinted',
    });
  });

  // A PDF of more pages than the deployment reads is its own fault and not the
  // OCR provider's, and the log has to say which.
  it('says a copy longer than this deployment reads by its own name', async () => {
    vi.stubGlobal('fetch', serving(aPdfWithoutATextLayerOf(11)));
    const { digitiser } = aDigitiser();

    await expect(digitiser.digitise(LINK, 1000)).resolves.toEqual({
      unread: 'TooLong',
    });
  });

  // A provider that refuses is the one failure of the four that is somebody
  // else's service and not the file, and it must not be reported as the file.
  it('says a reader that refused by its own name', async () => {
    vi.stubGlobal('fetch', serving(aPdfWithoutATextLayerOf(1)));
    const storage = new StorageStandingIn();
    const ocr = new ReaderStandingIn();
    ocr.refuse();

    const digitiser = new SignedPdfDigitiser(storage, ocr, new SilentLogger(), {
      pageDpi: 72,
      maxPages: 10,
    });

    await expect(digitiser.digitise(LINK, 1000)).resolves.toEqual({
      unread: 'OcrRefused',
    });
  });

  /*
   * The line whoever is holding the customer's question has to find (COMM-151).
   *
   * A warning and not a debug line, and carrying the word for which step
   * failed: the report this produces — eight lines the archive "states nothing"
   * on — looks from the outside exactly like an archive holding a sparse
   * record, so the log is the only place the difference exists.
   */
  it('warns with the name of the step that failed', async () => {
    vi.stubGlobal('fetch', serving(null, 403));
    const logger = new RecordingLogger();
    const digitiser = new SignedPdfDigitiser(
      new StorageStandingIn(),
      new ReaderStandingIn(),
      logger,
      { pageDpi: 72, maxPages: 10 },
    );

    await digitiser.digitise(LINK, 1000);

    expect(
      logger.warnings.map(([message, context]) => [
        message,
        (context as { because?: string; status?: number }).because ??
          (context as { status?: number }).status,
      ]),
    ).toEqual([
      ['The archive would not serve its signed copy', 403],
      ["The archive's signed copy could not be read", 'LinkRefused'],
    ]);
  });
});

function readingOf(copy: DigitisedCopy): DigitisedPdf {
  if (!('read' in copy)) {
    throw new Error(`the copy was not read: ${copy.unread}`);
  }

  return copy.read;
}
