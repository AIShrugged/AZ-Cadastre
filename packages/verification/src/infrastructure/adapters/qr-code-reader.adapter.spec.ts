import { createCanvas, loadImage } from '@napi-rs/canvas';
import { toBuffer } from 'qrcode';
import { describe, expect, it } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import {
  ObjectStorage,
  type StoredObject,
} from '../../application/ports/outbound/index.js';
import {
  ContentType,
  PageImage,
  StorageKey,
} from '../../domain/value-objects/index.js';

import { QrCodeReaderAdapter } from './qr-code-reader.adapter.js';

// A 300-dpi A4 sheet, which is what the splitter renders and so what the
// decoder is actually given. Held at the real size on purpose: the windowing
// and the scale ladder are the whole of this adapter, and a 200×200 test image
// would exercise neither.
const SHEET = { width: 2480, height: 3508 };

/*
 * One sheet with a code of a given size printed at a given place on it.
 *
 * The codes on the customer's own papers run from about a twelfth of the sheet
 * width — the archive's certified copies — down to about a twenty-fifth, on the
 * register extract, where it sits in the corner beside the issuing office's
 * line. Both are drawn here.
 */
async function aSheetPrinting(
  payload: string,
  options: { modules?: number; at?: 'corner' | 'middle' } = {},
): Promise<Uint8Array> {
  const canvas = createCanvas(SHEET.width, SHEET.height);
  const context = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, SHEET.width, SHEET.height);

  const size = options.modules ?? Math.round(SHEET.width / 12);
  const code = await loadImage(
    await toBuffer(payload, { margin: 2, width: size }),
  );
  const [x, y] =
    options.at === 'middle'
      ? [(SHEET.width - size) / 2, (SHEET.height - size) / 2]
      : [SHEET.width - size - 120, 140];

  context.drawImage(code, x, y, size, size);

  return canvas.toBuffer('image/png');
}

function aBlankSheet(): Uint8Array {
  const canvas = createCanvas(SHEET.width, SHEET.height);
  const context = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, SHEET.width, SHEET.height);
  context.fillStyle = '#111111';
  context.font = '40px sans-serif';
  context.fillText('DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ', 200, 400);

  return canvas.toBuffer('image/png');
}

class OneStoredSheet extends ObjectStorage {
  constructor(private readonly png: Uint8Array) {
    super();
  }

  override async getObject(): Promise<StoredObject> {
    return { body: this.png, contentType: ContentType.PNG };
  }

  override presignUpload(): never {
    throw new Error('not asked of in this spec');
  }

  override putObject(): never {
    throw new Error('not asked of in this spec');
  }

  override presignDownload(): never {
    throw new Error('not asked of in this spec');
  }
}

function read(png: Uint8Array): Promise<readonly string[]> {
  return new QrCodeReaderAdapter(
    new OneStoredSheet(png),
    new SilentLogger(),
  ).read(
    PageImage.of(StorageKey.create('pages/page_001.png'), ContentType.PNG),
  );
}

describe('QrCodeReaderAdapter', () => {
  /*
   * The link the archive's certified copies print. Decoding it whole is the
   * whole point of the adapter: the reader transcribed the same link off the
   * same sheet twice and got it wrong both times, in the `I`/`l` and the `J`/`j`
   * — and the archive answers `Yanlış şifrələnmiş Case ID` to either of them
   * (ADR-0034).
   */
  const ARCHIVE_LINK =
    'https://qr.esd.milliarxiv.gov.az/info/' +
    'alOOwj1hz3AX0%2FB0KP3RmZS7GDmQTJZHJ%2F6traU%2FJ9Qxk2McOR3AWm2UQvsRSK5s';

  it('gives back the payload of a code printed on the sheet, character for character', async () => {
    expect(await read(await aSheetPrinting(ARCHIVE_LINK))).toEqual([
      ARCHIVE_LINK,
    ]);
  });

  // The register extract's code: a stamp in the corner of an A4 sheet, which is
  // the case the full-page passes are least likely to catch and the tiles exist
  // for.
  it('finds a code the size of a postage stamp in the corner of a sheet', async () => {
    const link =
      'https://e-emlak.gov.az/eemdk/az/CheckElectronExtract/' +
      'qr?r=010013004784-10301&q=1126019206&t=D5C125C676973D40D8DC22D4B23D487F';

    expect(
      await read(await aSheetPrinting(link, { modules: 180, at: 'corner' })),
    ).toEqual([link]);
  });

  // One of the two packages in `INPUTS/` carries a code whose whole payload is
  // a document number. Nothing may assume a code is a link.
  it('gives back a payload that is not a link', async () => {
    expect(await read(await aSheetPrinting('1126012493'))).toEqual([
      '1126012493',
    ]);
  });

  /*
   * The ordinary sheet, and the answer that has to be cheap and empty. An
   * adapter that returned something here would put a value on the `qr_code`
   * line of every paper in the package.
   */
  it('answers with nothing for a sheet that prints no code', async () => {
    expect(await read(aBlankSheet())).toEqual([]);
  });

  // A page too small to hold a symbol is not an error: the pipeline renders
  // whatever the applicant uploaded, and a thumbnail must leave the run alone.
  it('answers with nothing for an image no symbol could fit in', async () => {
    const canvas = createCanvas(12, 12);
    canvas.getContext('2d').fillRect(0, 0, 12, 12);

    expect(await read(canvas.toBuffer('image/png'))).toEqual([]);
  });
});
