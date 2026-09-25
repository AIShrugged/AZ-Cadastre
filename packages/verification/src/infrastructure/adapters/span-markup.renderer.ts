import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { Injectable } from '@nestjs/common';

import {
  SpanMarkupRenderer,
  type MarkupRenderRequest,
} from '../../application/ports/outbound/index.js';
import type { MarkupRoom, SheetMarkup } from '../../domain/services/index.js';
import type { SheetPoint } from '../../domain/value-objects/index.js';

/*
 * The span working, drawn over the sheet it was read off (COMM-165).
 *
 * Every decision about WHAT is drawn — which corner is A, what figure goes
 * beside a wall, in what unit, what the legend says — was made in
 * `domain/services/span-markup.service.ts`. This puts it on pixels and decides
 * nothing: the only judgements here are how thick a line is and how big a word
 * has to be to stay legible, and both are read off the size of the sheet
 * because the pipeline renders at whatever DPI the deployment set (ADR-0038).
 *
 * @napi-rs/canvas and not a new dependency: it is already what the PDF pages
 * are rendered with and what the QR decoder reads through.
 */

/*
 * A room to a colour. Dark and saturated, because the line is drawn over a
 * white drawing crowded with thin black linework, and a pale outline
 * disappears into it. Eight is more rooms than a floor of an individual house
 * has; beyond that they repeat, which is better than a ninth colour nobody can
 * tell from the first.
 */
const ROOM_COLOURS = [
  '#c2255c',
  '#1971c2',
  '#2f9e44',
  '#e8590c',
  '#6741d9',
  '#0c8599',
  '#a12a2a',
  '#5c7cfa',
] as const;

// The axes are a different thing from the rooms and are drawn as one: one
// colour for all of them, and it is none of the room colours.
const AXIS_COLOUR = '#000000';

// Where the legend sits and what it is written on.
const LEGEND_BACKDROP = 'rgba(255, 255, 255, 0.92)';
const LEGEND_BORDER = '#343a40';
const LABEL_BACKDROP = 'rgba(255, 255, 255, 0.85)';

/*
 * How the two sizes are taken off the sheet.
 *
 * A stroke of two pixels is what reads on the 150 dpi rendering the pipeline
 * defaults to; on a sheet rendered at 300 it is a hairline lost in the
 * draughtsman's own linework, so it grows with the sheet and never shrinks
 * below the two. The same for the type: a caption is legible at about a
 * sixtieth of the shorter side, and no smaller than eleven pixels whatever the
 * sheet.
 */
const STROKE_DIVISOR = 600;
const LEAST_STROKE = 2;
const TYPE_DIVISOR = 60;
const LEAST_TYPE = 11;

@Injectable()
export class SpanMarkupRendererAdapter extends SpanMarkupRenderer {
  async render(request: MarkupRenderRequest): Promise<Uint8Array> {
    const sheet = await loadImage(Buffer.from(request.sheet));
    const width = sheet.width;
    const height = sheet.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(sheet, 0, 0, width, height);

    const scale = {
      width,
      height,
      stroke: Math.max(
        LEAST_STROKE,
        Math.round(Math.min(width, height) / STROKE_DIVISOR),
      ),
      type: Math.max(
        LEAST_TYPE,
        Math.round(Math.min(width, height) / TYPE_DIVISOR),
      ),
    };

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.textBaseline = 'middle';

    for (const room of request.markup.rooms) this.room(ctx, room, scale);
    this.axes(ctx, request.markup, scale);
    this.legend(ctx, request.markup, scale);

    return canvas.encode('png');
  }

  // One room: its outline, its corners lettered, and each wall captioned at its
  // middle with the figure printed along it.
  private room(ctx: SKRSContext2D, room: MarkupRoom, scale: Scale): void {
    const colour = ROOM_COLOURS[room.colour % ROOM_COLOURS.length]!;

    ctx.strokeStyle = colour;
    ctx.lineWidth = scale.stroke;
    ctx.beginPath();
    room.outline.forEach((point, index) => {
      const { x, y } = onCanvas(point, scale);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();

    const centre = centreOf(room.outline, scale);

    for (const wall of room.walls) {
      const from = onCanvas(wall.from, scale);
      const to = onCanvas(wall.to, scale);

      /*
       * The caption sits off the middle of the wall, a line's width towards the
       * middle of the room. Not decoration: on the reference set's first-floor
       * plan the two long walls of a 4000 × 1800 balcony are ninety pixels
       * apart, and two captions on their midpoints land on top of each other and
       * on the outline between them — three things drawn and none of them
       * readable.
       */
      this.caption(
        ctx,
        wall.text,
        towards(
          { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
          centre,
          scale.type,
        ),
        colour,
        scale,
        true,
      );
    }

    for (const corner of room.corners) {
      const at = onCanvas(corner.at, scale);

      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(at.x, at.y, scale.stroke * 2, 0, Math.PI * 2);
      ctx.fill();
      this.caption(ctx, corner.letter, at, colour, scale, true);
    }

    if (room.name !== null) this.caption(ctx, room.name, centre, colour, scale);
  }

  // The axes, drawn the full line the reader gave and captioned with the
  // lowercase letter the legend keys back to the printed mark.
  private axes(ctx: SKRSContext2D, markup: SheetMarkup, scale: Scale): void {
    ctx.strokeStyle = AXIS_COLOUR;
    ctx.lineWidth = scale.stroke;

    for (const axis of markup.axes) {
      const from = onCanvas(axis.from, scale);
      const to = onCanvas(axis.to, scale);

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      this.caption(ctx, axis.letter, from, AXIS_COLOUR, scale, true);
    }

    for (const chain of markup.chains) {
      const from = onCanvas(chain.from, scale);
      const to = onCanvas(chain.to, scale);

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      this.caption(
        ctx,
        chain.text,
        { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
        AXIS_COLOUR,
        scale,
      );
    }
  }

  // What the picture says about itself, top left, on an opaque panel: over a
  // drawing there is no corner that is reliably empty.
  private legend(ctx: SKRSContext2D, markup: SheetMarkup, scale: Scale): void {
    const pad = scale.type;
    const line = Math.round(scale.type * 1.5);

    ctx.font = typeface(scale.type);

    const width =
      Math.max(...markup.legend.map(text => ctx.measureText(text).width)) +
      pad * 2;
    const height = line * markup.legend.length + pad * 2;

    ctx.fillStyle = LEGEND_BACKDROP;
    ctx.fillRect(pad, pad, width, height);
    ctx.strokeStyle = LEGEND_BORDER;
    ctx.lineWidth = Math.max(1, Math.round(scale.stroke / 2));
    ctx.strokeRect(pad, pad, width, height);

    ctx.fillStyle = LEGEND_BORDER;
    markup.legend.forEach((text, index) => {
      ctx.fillText(text, pad * 2, pad * 2 + line * index + line / 2);
    });
  }

  /*
   * A word on a drawing, on a backdrop of its own.
   *
   * Without the backdrop the caption lands on the draughtsman's dimension lines
   * and neither can be read — which would make the whole picture worth nothing,
   * since the point of it is that a person can check a figure against the sheet.
   */
  private caption(
    ctx: SKRSContext2D,
    text: string,
    at: { x: number; y: number },
    colour: string,
    scale: Scale,
    small = false,
  ): void {
    const size = small ? Math.round(scale.type * 0.75) : scale.type;
    const pad = Math.round(size * 0.3);

    ctx.font = typeface(size);

    const width = ctx.measureText(text).width;
    const left = clamp(
      at.x - width / 2 - pad,
      0,
      scale.width - width - pad * 2,
    );
    const top = clamp(at.y - size / 2 - pad, 0, scale.height - size - pad * 2);

    ctx.fillStyle = LABEL_BACKDROP;
    ctx.fillRect(left, top, width + pad * 2, size + pad * 2);
    ctx.fillStyle = colour;
    ctx.fillText(text, left + pad, top + pad + size / 2);
  }
}

type Scale = {
  readonly width: number;
  readonly height: number;
  readonly stroke: number;
  readonly type: number;
};

/*
 * The families named, and not the generic `sans-serif`.
 *
 * What a bare `sans-serif` resolves to depends on whoever built the image, and
 * a family without Cyrillic draws «ед.» as blanks — the label that says the unit
 * was NOT established, rendered as no label at all. DejaVu carries the Latin
 * extended the Azerbaijani room names need, the Cyrillic that word needs, and
 * the runtime image installs it (apps/server/Dockerfile); the two after it are
 * what a developer's machine is likely to have instead.
 */
function typeface(size: number): string {
  return `600 ${size}px 'DejaVu Sans', 'Liberation Sans', 'FreeSans', sans-serif`;
}

// A point of the sheet — 0..1 of its width and height — as a pixel of this
// rendering of it.
function onCanvas(point: SheetPoint, scale: Scale): { x: number; y: number } {
  return { x: point.x * scale.width, y: point.y * scale.height };
}

function centreOf(
  outline: readonly SheetPoint[],
  scale: Scale,
): { x: number; y: number } {
  const points = outline.map(point => onCanvas(point, scale));

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

// A point moved `by` pixels from `at` towards `to`, or left where it is when
// the two are already closer than that.
function towards(
  at: { x: number; y: number },
  to: { x: number; y: number },
  by: number,
): { x: number; y: number } {
  const run = to.x - at.x;
  const rise = to.y - at.y;
  const distance = Math.hypot(run, rise);

  return distance <= by
    ? at
    : { x: at.x + (run / distance) * by, y: at.y + (rise / distance) * by };
}

function clamp(value: number, least: number, most: number): number {
  return Math.min(Math.max(value, least), Math.max(least, most));
}
