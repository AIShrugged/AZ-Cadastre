import type { SheetMarkup } from '../../../domain/services/index.js';

export type MarkupRenderRequest = {
  // The sheet as the pipeline rendered it, which the markup is drawn over.
  sheet: Uint8Array;
  // What to draw, decided by the domain (`sheetMarkupOf`).
  markup: SheetMarkup;
};

/**
 * The marked-up sheet as PNG bytes (COMM-165).
 *
 * A port, because drawing needs a canvas and a canvas is a piece of the outside
 * world; what is drawn is decided in `domain/services/span-markup.service.ts`
 * and this only puts it on pixels. Nothing here chooses a letter, a figure or a
 * unit.
 */
export abstract class SpanMarkupRenderer {
  abstract render(request: MarkupRenderRequest): Promise<Uint8Array>;
}
