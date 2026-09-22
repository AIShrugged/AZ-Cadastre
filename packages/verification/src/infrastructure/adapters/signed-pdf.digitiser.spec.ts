import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

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

import { SignedPdfDigitiser } from './signed-pdf.digitiser.js';

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

  constructor(private readonly reading = 'Imzalayan: Memmedov Anar') {
    super();
  }

  override async recognise(image: PageImage): Promise<OcrResult> {
    this.asked.push(image.storageKey.value);

    return this.reading.length === 0
      ? OcrResult.illegible()
      : OcrResult.of(RecognisedText.of(this.reading), Confidence.of(0.9));
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

    expect(read?.how).toBe('TextLayer');
    expect(read?.text).toContain('1471');
    expect(ocr.asked).toEqual([]);
    expect(storage.written).toEqual([]);
  });

  // A scan carries no text, so it goes through the same renderer and the same
  // OCR provider every other sheet in the system does.
  it('renders and reads a PDF that is a picture', async () => {
    vi.stubGlobal('fetch', serving(aPdfWithoutATextLayerOf(2)));
    const { digitiser, ocr, storage } = aDigitiser();

    const read = await digitiser.digitise(LINK, 1000);

    expect(read?.how).toBe('Ocr');
    expect(read?.pages).toBe(2);
    expect(read?.text).toContain('Imzalayan');
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

  // Each of these leaves the stage with the answer it had before there was a
  // copy to read, and never throws it over (ADR-0035).
  it.each([
    ['a link that has expired', () => serving(null, 403)],
    ['a file that is not a PDF at all', () => serving(new Uint8Array([1, 2]))],
    [
      'a server that cannot be reached',
      () =>
        vi.fn(async () => {
          throw new Error('ECONNRESET');
        }) as unknown as typeof fetch,
    ],
  ])('answers with nothing for %s', async (_what, fetching) => {
    vi.stubGlobal('fetch', fetching());
    const { digitiser } = aDigitiser();

    await expect(digitiser.digitise(LINK, 1000)).resolves.toBeNull();
  });

  // A file that reads as nothing at all has not been digitised: an empty string
  // would clear every line the metadata carried.
  it('answers with nothing where the copy reads as nothing', async () => {
    vi.stubGlobal('fetch', serving(aPdfWithoutATextLayerOf(1)));
    const { digitiser } = aDigitiser('');

    await expect(digitiser.digitise(LINK, 1000)).resolves.toBeNull();
  });
});
