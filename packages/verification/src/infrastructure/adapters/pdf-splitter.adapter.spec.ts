import { describe, expect, it } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import { aPdfOf } from '../../../test/pdf-fixture.js';
import {
  ObjectStorage,
  type PresignedDownload,
  type PresignedUpload,
  type PutObjectRequest,
  type StoredObject,
} from '../../application/ports/outbound/index.js';
import { ContentType, StorageKey } from '../../domain/value-objects/index.js';
import type { VerificationModuleOptions } from '../../verification.module-defs.js';
import {
  PdfTooLongException,
  UnreadablePdfException,
} from '../exceptions/index.js';

import { PdfSplitterAdapter } from './pdf-splitter.adapter.js';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

class StorageStandingIn extends ObjectStorage {
  readonly written: PutObjectRequest[] = [];

  constructor(private readonly stored: Uint8Array) {
    super();
  }

  override presignUpload(): Promise<PresignedUpload> {
    throw new Error('the splitter never presigns an upload');
  }

  override presignDownload(): Promise<PresignedDownload> {
    throw new Error('the splitter never presigns a download');
  }

  override async putObject(request: PutObjectRequest): Promise<void> {
    this.written.push(request);
  }

  override async getObject(): Promise<StoredObject> {
    return { body: this.stored, contentType: ContentType.PDF };
  }
}

function splitterOf(
  pdf: Uint8Array,
  limits: Partial<VerificationModuleOptions['pdf']> = {},
): { splitter: PdfSplitterAdapter; storage: StorageStandingIn } {
  const storage = new StorageStandingIn(pdf);
  const options = {
    pdf: { pageDpi: 72, maxPages: 30, ...limits },
  } as VerificationModuleOptions;

  return {
    splitter: new PdfSplitterAdapter(options, storage, new SilentLogger()),
    storage,
  };
}

const aKey = StorageKey.create('9f1c/passport.pdf');

describe('PdfSplitterAdapter', () => {
  it('makes one page out of every sheet of the document', async () => {
    const { splitter } = splitterOf(
      aPdfOf('PAGE ONE', 'PAGE TWO', 'PAGE THREE'),
    );

    const pages = await splitter.split({ storageKey: aKey });

    expect(pages.map(page => page.number.value)).toEqual([1, 2, 3]);
  });

  it('makes a single page out of a single-sheet document', async () => {
    const { splitter } = splitterOf(aPdfOf('THE ONLY PAGE'));

    const pages = await splitter.split({ storageKey: aKey });

    expect(pages).toHaveLength(1);
    expect(pages[0]?.number.value).toBe(1);
  });

  it('stores each page image under the document it was rendered off', async () => {
    const { splitter } = splitterOf(aPdfOf('ONE', 'TWO'));

    const pages = await splitter.split({ storageKey: aKey });

    expect(pages.map(page => page.image.storageKey.value)).toEqual([
      '9f1c/passport.pdf/pages/page_001.png',
      '9f1c/passport.pdf/pages/page_002.png',
    ]);
  });

  it('names the page images so that ten sheets still sort the way they read', async () => {
    const { splitter } = splitterOf(
      aPdfOf(...Array.from({ length: 10 }, (_, index) => `PAGE ${index + 1}`)),
    );

    const pages = await splitter.split({ storageKey: aKey });
    const keys = pages.map(page => page.image.storageKey.value);

    expect([...keys].sort()).toEqual(keys);
  });

  it('puts every page image in the store, as a PNG', async () => {
    const { splitter, storage } = splitterOf(aPdfOf('ONE', 'TWO'));

    const pages = await splitter.split({ storageKey: aKey });

    expect(storage.written).toHaveLength(2);
    for (const [index, written] of storage.written.entries()) {
      expect(written.key.equals(pages[index]!.image.storageKey)).toBe(true);
      expect(written.contentType.equals(ContentType.PNG)).toBe(true);
      expect([...written.body.subarray(0, 4)]).toEqual(PNG_MAGIC);
    }
  });

  it('tells the pipeline the pages are PNGs, whatever the original was', async () => {
    const { splitter } = splitterOf(aPdfOf('ONE'));

    const pages = await splitter.split({ storageKey: aKey });

    expect(pages[0]?.image.contentType.equals(ContentType.PNG)).toBe(true);
  });

  it('renders every sheet, and two sheets that read differently do not come out identical', async () => {
    const { splitter, storage } = splitterOf(
      aPdfOf('REPUBLIC OF AZERBAIJAN', 'AZE1234567'),
    );

    await splitter.split({ storageKey: aKey });

    const [first, second] = storage.written;
    expect(Buffer.from(first!.body).equals(Buffer.from(second!.body))).toBe(
      false,
    );
  });

  // The text of a page is what OCR is given the image for, and pdf.js draws
  // glyphs through polyfilled globals that can fail silently: a page whose text
  // did not render comes out as blank as an empty sheet, and compresses like one.
  it('draws the text of a page, not a blank sheet the shape of one', async () => {
    const { splitter, storage } = splitterOf(
      aPdfOf('REPUBLIC OF AZERBAIJAN PASSPORT ALIYEV ELCHIN AZE1234567', ' '),
    );

    await splitter.split({ storageKey: aKey });

    const [withText, blank] = storage.written;
    expect(withText!.body.length).toBeGreaterThan(blank!.body.length * 2);
  });

  it('renders a page larger the higher the resolution asked for', async () => {
    const coarse = splitterOf(aPdfOf('ONE'), { pageDpi: 72 });
    const fine = splitterOf(aPdfOf('ONE'), { pageDpi: 150 });

    await coarse.splitter.split({ storageKey: aKey });
    await fine.splitter.split({ storageKey: aKey });

    expect(fine.storage.written[0]!.body.length).toBeGreaterThan(
      coarse.storage.written[0]!.body.length,
    );
  });

  it('refuses a document with more sheets than the pipeline splits', async () => {
    const { splitter } = splitterOf(aPdfOf('ONE', 'TWO', 'THREE'), {
      maxPages: 2,
    });

    await expect(splitter.split({ storageKey: aKey })).rejects.toThrow(
      PdfTooLongException,
    );
  });

  it('stores nothing at all when it refuses the document', async () => {
    const { splitter, storage } = splitterOf(aPdfOf('ONE', 'TWO'), {
      maxPages: 1,
    });

    await expect(splitter.split({ storageKey: aKey })).rejects.toThrow(
      PdfTooLongException,
    );

    expect(storage.written).toEqual([]);
  });

  it('refuses bytes that are not a PDF at all, naming the object they came from', async () => {
    const { splitter } = splitterOf(
      new Uint8Array(Buffer.from('this was never a PDF', 'latin1')),
    );

    await expect(splitter.split({ storageKey: aKey })).rejects.toThrow(
      UnreadablePdfException,
    );
    await expect(splitter.split({ storageKey: aKey })).rejects.toThrow(
      aKey.value,
    );
  });
});
