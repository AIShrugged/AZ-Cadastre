import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import { Inject, Injectable } from '@nestjs/common';
import jsQrExport from 'jsqr';

import { Logger } from '@cadastre/logger';

import {
  ObjectStorage,
  QrCodeReader,
} from '../../application/ports/outbound/index.js';
import type { PageImage } from '../../domain/value-objects/index.js';

/*
 * The sheet is scanned whole, at four sizes, and only then in tiles.
 *
 * jsQR locates one symbol per call by walking the raster for finder patterns,
 * and whether it locks onto a given code depends on how the resampling fell —
 * measurably, not in principle. Of the four sheets this was built against, the
 * archive certificate decodes at 0.5 and at no other size, and the order
 * stapled behind it decodes at 0.35, 0.75 and 1 but not at 0.5. One size is a
 * coin toss; the ladder is what makes it reliable, and each rung costs about a
 * fifth of a second.
 *
 * The ladder stops at the first code, because a sheet that prints two is rare
 * and the stage needs one reference per paper. Only a sheet that yields nothing
 * whole is worth taking apart — that is where a code the size of a postage
 * stamp in the corner of a register extract is found.
 */
const FULL_PAGE_SCALES = [0.35, 0.5, 0.75, 1] as const;

// Three across and three down. Not overlapping: overlap costs four times the
// area for the one case it buys — a code sitting across a seam — and a symbol
// small enough to need tiling at all is small enough to sit inside one.
const TILES_ACROSS = 3;

/*
 * The longest side any pass is given, in pixels.
 *
 * Above the 3508 px of a 300-dpi A4 sheet the extra pixels buy nothing: a QR
 * module several pixels wide does not decode better for being wider. It is
 * here to bound the cost of a page somebody uploaded at 1200 dpi, not to
 * shrink the scans the pipeline itself renders.
 */
const MAX_SIDE = 3600;

type Decoder = typeof jsQrExport.default;

/*
 * jsqr's bundle assigns the decoder straight to `module.exports`, while the
 * types it ships declare it as a `default` export. Under NodeNext the two
 * disagree — Node hands over the function, TypeScript describes a namespace
 * around it — and the package ships no `exports` map to settle it. Taking
 * whichever of the two is there is the only form that compiles and runs.
 */
const jsQR: Decoder =
  (jsQrExport as unknown as { default?: Decoder }).default ??
  (jsQrExport as unknown as Decoder);

@Injectable()
export class QrCodeReaderAdapter extends QrCodeReader {
  constructor(
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(Logger) private readonly logger: Logger,
  ) {
    super();
  }

  async read(image: PageImage): Promise<readonly string[]> {
    const startedAt = Date.now();
    const object = await this.storage.getObject(image.storageKey);
    const sheet = await loadImage(Buffer.from(object.body));
    const found = new Set<string>();

    for (const scale of FULL_PAGE_SCALES) {
      const code = decode(sheet, {
        x: 0,
        y: 0,
        width: sheet.width,
        height: sheet.height,
        scale,
      });

      if (code) {
        found.add(code);
        break;
      }
    }

    if (found.size === 0) {
      for (const tile of tilesOf(sheet)) {
        const code = decode(sheet, tile);
        if (code) found.add(code);
      }
    }

    this.logger.debug('Sheet scanned for QR codes', {
      storageKey: image.storageKey.value,
      pixels: sheet.width * sheet.height,
      // The payloads themselves are not logged: a code off somebody's papers
      // resolves to their document (ADR-0008).
      codes: found.size,
      durationMs: Date.now() - startedAt,
    });

    return [...found];
  }
}

type Window = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

function* tilesOf(sheet: Image): Generator<Window> {
  const width = Math.ceil(sheet.width / TILES_ACROSS);
  const height = Math.ceil(sheet.height / TILES_ACROSS);

  for (let y = 0; y < sheet.height; y += height) {
    for (let x = 0; x < sheet.width; x += width) {
      yield {
        x,
        y,
        width: Math.min(width, sheet.width - x),
        height: Math.min(height, sheet.height - y),
        scale: 1,
      };
    }
  }
}

/*
 * One pass over one window of the sheet.
 *
 * `attemptBoth` because a code is as often printed white-on-dark as
 * dark-on-white, and a scan of a sealed page can come back inverted on its own.
 * A decoder that throws is a window with no code in it and never a failed
 * sheet: the next window is still worth trying.
 */
function decode(sheet: Image, window: Window): string | null {
  const width = Math.max(1, Math.round(window.width * window.scale));
  const height = Math.max(1, Math.round(window.height * window.scale));
  const shrink = Math.min(1, MAX_SIDE / Math.max(width, height));
  const drawnWidth = Math.max(1, Math.round(width * shrink));
  const drawnHeight = Math.max(1, Math.round(height * shrink));

  // Below the size of a symbol there is nothing a finder pattern could be.
  if (drawnWidth < 32 || drawnHeight < 32) return null;

  try {
    const canvas = createCanvas(drawnWidth, drawnHeight);
    const context = canvas.getContext('2d');

    // Over white, because a source with an alpha channel otherwise composites
    // onto black and inverts the symbol at the edges.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, drawnWidth, drawnHeight);
    context.drawImage(
      sheet,
      window.x,
      window.y,
      window.width,
      window.height,
      0,
      0,
      drawnWidth,
      drawnHeight,
    );

    const raster = context.getImageData(0, 0, drawnWidth, drawnHeight);
    const code = jsQR(
      new Uint8ClampedArray(raster.data),
      drawnWidth,
      drawnHeight,
      { inversionAttempts: 'attemptBoth' },
    );
    const payload = code?.data.trim() ?? '';

    return payload.length > 0 ? payload : null;
  } catch {
    return null;
  }
}
