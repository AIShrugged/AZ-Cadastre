import { createRequire } from 'node:module';
import path from 'node:path';

import { createCanvas, DOMMatrix, Path2D } from '@napi-rs/canvas';
import {
  getDocument,
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

export async function* renderPdfPages(
  key: StorageKey,
  pdf: Uint8Array,
  limits: RenderingLimits,
): AsyncGenerator<PageRendering> {
  const loading = getDocument({
    data: pdf,
    standardFontDataUrl: asset('standard_fonts'),
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    iccUrl: asset('iccs'),
    wasmUrl: asset('wasm'),
  });

  let document: PDFDocumentProxy;
  try {
    document = await loading.promise;
  } catch (cause) {
    throw new UnreadablePdfException(key, cause);
  }

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
