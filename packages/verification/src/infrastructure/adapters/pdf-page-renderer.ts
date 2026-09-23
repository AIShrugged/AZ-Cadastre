import { createRequire } from 'node:module';
import path from 'node:path';

import { createCanvas, DOMMatrix, Path2D } from '@napi-rs/canvas';
import {
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { StorageKey } from '../../domain/value-objects/index.js';
import {
  EmptyPdfException,
  PdfTooLongException,
  UnreadablePdfException,
} from '../exceptions/index.js';

const PDF_UNIT_DPI = 72;

// pdf.js draws glyph outlines through the browser's `Path2D` and `DOMMatrix`,
// which it polyfills in Node off @napi-rs/canvas — the same package, and it must
// be the same *copy* of it: a canvas from one copy rejects a path from another,
// which is why this depends on the version pdf.js declares (^1.0.0) rather than
// a version of its own. Left unpolyfilled, text renders blank without an error.
const globals = globalThis as {
  Path2D?: unknown;
  DOMMatrix?: unknown;
};
globals.Path2D ??= Path2D;
globals.DOMMatrix ??= DOMMatrix;

// Resolved off the installed package rather than fetched from a URL: pdf.js
// loads these lazily and this renderer has no network. Without the fonts and
// cmaps a document that embeds neither renders as blank glyphs; without the wasm
// the scanned images most of these documents consist of do not decode at all.
const require = createRequire(import.meta.url);
const pdfjs = path.dirname(require.resolve('pdfjs-dist/package.json'));
const asset = (folder: string): string =>
  `${path.join(pdfjs, folder)}${path.sep}`;

export type PageRendering = {
  number: number;
  png: Uint8Array;
};

export type RenderingLimits = {
  pageDpi: number;
  maxPages: number;
};

/*
 * How much text a PDF has to carry before it counts as a document with a text
 * layer rather than a scan.
 *
 * A scanned sheet is not always empty of text: the tool that produced the file
 * stamps a footer, a page number or an invisible watermark on it, and a reader
 * that trusted any text at all would parse those four words and call the sheet
 * digitised. A page of an actual document carries hundreds of characters
 * (ADR-0035).
 */
const TEXT_LAYER_CHARACTERS = 200;

/**
 * What a PDF says without being looked at — its text layer, if it has a real
 * one (ADR-0035).
 *
 * `null` where it has none worth the name, which is the signal to render the
 * pages and read them with the OCR provider instead. The point of asking first
 * is that a born-digital sheet is read exactly rather than approximately: a
 * certificate's validity period misread by one digit is worse than unread.
 *
 * One string per page and not one for the file: whoever reads the text is given
 * it sheet by sheet the way the OCR path hands it over, and a reader that has
 * to say which sheet it read a value off cannot say it about a file it was
 * handed whole (COMM-145). Whether the layer is worth the name is still decided
 * over all the pages together — a scan's stamped footer is a few words on every
 * sheet, and asking each sheet on its own would let a long enough scan through.
 */
export async function textLayerOf(
  key: StorageKey,
  pdf: Uint8Array,
  maxPages: number,
): Promise<readonly string[] | null> {
  const loading = load(pdf);
  const document = await opened(loading, key);

  try {
    const sheets: string[] = [];

    for (
      let number = 1;
      number <= Math.min(document.numPages, maxPages);
      number += 1
    ) {
      const page = await document.getPage(number);

      try {
        const content = await page.getTextContent();

        sheets.push(
          content.items
            .map(item =>
              'str' in item ? `${item.str}${item.hasEOL ? '\n' : ''}` : '',
            )
            .join(''),
        );
      } finally {
        page.cleanup();
      }
    }

    const pages = sheets.map(sheet =>
      sheet
        .replaceAll(/[^\S\n]+/gu, ' ')
        .replaceAll(/ *\n */gu, '\n')
        .trim(),
    );
    const printed = pages.join('').replaceAll(/\s/gu, '').length;

    return printed >= TEXT_LAYER_CHARACTERS ? pages : null;
  } finally {
    await loading.destroy();
  }
}

export async function* renderPdfPages(
  key: StorageKey,
  pdf: Uint8Array,
  limits: RenderingLimits,
): AsyncGenerator<PageRendering> {
  const loading = load(pdf);
  const document = await opened(loading, key);

  try {
    if (document.numPages === 0) throw new EmptyPdfException(key);
    if (document.numPages > limits.maxPages) {
      throw new PdfTooLongException(key, document.numPages, limits.maxPages);
    }

    for (let number = 1; number <= document.numPages; number += 1) {
      yield { number, png: await renderPage(document, number, limits.pageDpi) };
    }
  } finally {
    await loading.destroy();
  }
}

/*
 * One reading of one file, off bytes the loader owns.
 *
 * The copy is not tidiness. pdf.js hands the data to its worker by
 * *transferring* the ArrayBuffer, which detaches the caller's view: without it
 * the same file cannot be opened twice — asking for a text layer and then
 * rendering the pages of the sheet that has none fails with `DataCloneError`,
 * and so does an ArrayBuffer that came straight off a `Response` (ADR-0035).
 */
function load(pdf: Uint8Array): PDFDocumentLoadingTask {
  const data = new Uint8Array(pdf.byteLength);
  data.set(pdf);

  return getDocument({
    data,
    standardFontDataUrl: asset('standard_fonts'),
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    iccUrl: asset('iccs'),
    wasmUrl: asset('wasm'),
  });
}

async function opened(
  loading: PDFDocumentLoadingTask,
  key: StorageKey,
): Promise<PDFDocumentProxy> {
  try {
    return await loading.promise;
  } catch (cause) {
    throw new UnreadablePdfException(key, cause);
  }
}

async function renderPage(
  document: PDFDocumentProxy,
  number: number,
  pageDpi: number,
): Promise<Uint8Array> {
  const page = await document.getPage(number);

  try {
    const viewport = page.getViewport({ scale: pageDpi / PDF_UNIT_DPI });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const context = canvas.getContext('2d');

    // A PDF page is transparent where nothing is drawn, and OCR reads dark text
    // off a light page — not off whatever the image is composited onto later.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      // Skia's canvas implements what pdf.js draws through, but is typed against
      // its own classes rather than the DOM's.
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return canvas.encode('png');
  } finally {
    page.cleanup();
  }
}
