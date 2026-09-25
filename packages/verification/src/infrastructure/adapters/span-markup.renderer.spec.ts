import { createCanvas, loadImage } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';

import { sheetMarkupOf } from '../../domain/services/index.js';
import { sheetGeometryOf } from '../../domain/value-objects/index.js';

import { SpanMarkupRendererAdapter } from './span-markup.renderer.js';

// A blank sheet of the shape a rendered A4 page has at 150 dpi, so the type and
// the stroke are sized the way they are on a real one.
function aBlankSheet(): Uint8Array {
  const canvas = createCanvas(1240, 1754);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1240, 1754);

  return canvas.encodeSync('png');
}

function aMarkup(axes = true) {
  const geometry = sheetGeometryOf({
    pageNumber: 7,
    rooms: [
      {
        label: 'Qonaq otağı',
        outline: [
          { x: 0.2, y: 0.2 },
          { x: 0.6, y: 0.2 },
          { x: 0.6, y: 0.5 },
          { x: 0.2, y: 0.5 },
        ],
        walls: [
          { from: 0, to: 1, printed: '4000' },
          { from: 1, to: 2, printed: '2400' },
        ],
      },
    ],
    axes: axes
      ? [
          { mark: 'A', from: { x: 0.15, y: 0.2 }, to: { x: 0.85, y: 0.2 } },
          { mark: 'B', from: { x: 0.15, y: 0.5 }, to: { x: 0.85, y: 0.5 } },
        ]
      : [],
    chains: axes
      ? [
          {
            from: 'A',
            to: 'B',
            printed: '2400',
            at: [
              { x: 0.15, y: 0.2 },
              { x: 0.15, y: 0.5 },
            ],
          },
        ]
      : [],
  });

  if (!geometry) throw new Error('the fixture is not readable geometry');

  return sheetMarkupOf({
    geometry,
    documentType: 'sketch_project',
    unit: 'mm',
    unitBasis: 'BuiltUpArea',
  });
}

// What fraction of the sheet stopped being white. A picture is what this adapter
// produces, so what is asserted is that something was drawn, where, and that the
// sheet underneath survived it — not which pixel is which colour.
async function inkedFraction(
  png: Uint8Array,
  box: { left: number; top: number; right: number; bottom: number },
): Promise<number> {
  const image = await loadImage(Buffer.from(png));
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);

  const left = Math.floor(box.left * image.width);
  const top = Math.floor(box.top * image.height);
  const width = Math.floor((box.right - box.left) * image.width);
  const height = Math.floor((box.bottom - box.top) * image.height);
  const { data } = ctx.getImageData(left, top, width, height);
  let inked = 0;

  for (let at = 0; at < data.length; at += 4) {
    if (data[at]! < 240 || data[at + 1]! < 240 || data[at + 2]! < 240) {
      inked += 1;
    }
  }

  return inked / (width * height);
}

describe('SpanMarkupRendererAdapter', () => {
  it('answers with a PNG the size of the sheet it drew on', async () => {
    const png = await new SpanMarkupRendererAdapter().render({
      sheet: aBlankSheet(),
      markup: aMarkup(),
    });
    const drawn = await loadImage(Buffer.from(png));

    expect(drawn.width).toBe(1240);
    expect(drawn.height).toBe(1754);
  });

  it('draws the room outline where the geometry put it', async () => {
    const png = await new SpanMarkupRendererAdapter().render({
      sheet: aBlankSheet(),
      markup: aMarkup(),
    });

    // The room runs from 0.2 to 0.6 across and 0.2 to 0.5 down.
    expect(
      await inkedFraction(png, {
        left: 0.25,
        top: 0.25,
        right: 0.55,
        bottom: 0.45,
      }),
    ).toBeGreaterThan(0);
    // And nothing was drawn in the bottom third, where there is no geometry.
    expect(
      await inkedFraction(png, {
        left: 0.05,
        top: 0.75,
        right: 0.95,
        bottom: 0.95,
      }),
    ).toBe(0);
  });

  it('puts the legend on the sheet', async () => {
    const png = await new SpanMarkupRendererAdapter().render({
      sheet: aBlankSheet(),
      markup: aMarkup(),
    });

    expect(
      await inkedFraction(png, {
        left: 0.01,
        top: 0.01,
        right: 0.5,
        bottom: 0.08,
      }),
    ).toBeGreaterThan(0);
  });

  // A set that marks no axes draws its rooms and nothing else (ADR-0044): the
  // renderer is handed no axes and must not invent a line for them.
  it('draws nothing for a sheet whose geometry carries no axes', async () => {
    const withAxes = await new SpanMarkupRendererAdapter().render({
      sheet: aBlankSheet(),
      markup: aMarkup(true),
    });
    const without = await new SpanMarkupRendererAdapter().render({
      sheet: aBlankSheet(),
      markup: aMarkup(false),
    });
    const band = { left: 0.1, top: 0.18, right: 0.18, bottom: 0.55 };

    expect(await inkedFraction(withAxes, band)).toBeGreaterThan(0);
    expect(await inkedFraction(without, band)).toBe(0);
  });
});
