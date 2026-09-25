import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';

import { Logger } from '@cadastre/logger';

import {
  ObjectStorage,
  SheetGeometryReader,
  type GeometryRequest,
} from '../../../application/ports/outbound/index.js';
import {
  sheetGeometryOf,
  type PageImage,
  type SheetGeometry,
} from '../../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../../verification.module-defs.js';
import { MissingOpenRouterApiKeyException } from '../../exceptions/index.js';

import { answerOf } from './answered.js';
import { geometryInstructions } from './geometry-prompt.js';
import { telemetryOf } from './telemetry.js';

const MAX_TEXT = 4000;

// The heaviest answer of the pipeline: a polygon per room, for several sheets at
// once. Its own budget, and wider than the extractor's, because the answer is
// long rather than the question hard.
const GEOMETRY_TIMEOUT_MS = 240_000;

const PointSchema = z.object({ x: z.number(), y: z.number() });

/*
 * The sheet the answer is about, coerced.
 *
 * Measured, not defensive: asked about sheet 7 of the reference set,
 * `gemini-2.5-pro` answers `"sheet": "5"` — a string, and the number printed in
 * the drawing's own title block rather than the one it was shown the sheet
 * under. A schema holding out for a number drops the entry, and with it every
 * room and axis on a sheet the model read correctly.
 */
const SheetNumberSchema = z.coerce.number();

const AnswerSchema = z.object({
  sheets: z
    .array(
      z.object({
        sheet: SheetNumberSchema,
        rooms: z
          .array(
            z.object({
              label: z.string().nullish(),
              outline: z.array(PointSchema).nullish(),
              walls: z
                .array(
                  z.object({
                    from: z.number(),
                    to: z.number(),
                    printed: z.string().nullish(),
                  }),
                )
                .nullish(),
            }),
          )
          .nullish(),
        axes: z
          .array(
            z.object({
              mark: z.string().nullish(),
              from: PointSchema.nullish(),
              to: PointSchema.nullish(),
            }),
          )
          .nullish(),
        chains: z
          .array(
            z.object({
              from: z.string().nullish(),
              to: z.string().nullish(),
              printed: z.string().nullish(),
              at: z.array(PointSchema).nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});

type AnsweredSheet = NonNullable<
  z.infer<typeof AnswerSchema>['sheets']
>[number];

/**
 * The geometry of a drawing's sheets, read by a model that can see them
 * (COMM-165).
 *
 * A call of its own with a model of its own (`GEOMETRY_MODEL`), and not another
 * key of the extraction schema. Two reasons, both measured. The span is read off
 * text and the reading has been measured on four real designs
 * (`eval/span`, docs/MODELS.md): asking the same call for coordinates as well
 * would invalidate that measurement, because a longer answer is a different
 * answer. And the model that reads a chain best is not the one that reads a
 * passport best — `qwen2.5-vl-72b` does not read dimension chains at all, and
 * `EXTRACTOR_MODEL` is one setting for every type of paper.
 *
 * Everything the model says is put through `sheetGeometryOf`, which drops what
 * cannot be drawn. A reader shown a drawing answers with coordinates off the
 * sheet and rooms of two corners; none of that is worth losing the sheet over,
 * and none of it reaches a canvas.
 */
@Injectable()
export class OpenRouterGeometryAdapter extends SheetGeometryReader {
  private readonly logger: Logger;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    const openrouter = options.openrouter;
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException('GEOMETRY_PROVIDER');
    }
    this.model = options.geometry.model;
    this.logger = logger.child({
      scope: OpenRouterGeometryAdapter.name,
      model: this.model,
    });
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      timeout: GEOMETRY_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async read(request: GeometryRequest): Promise<readonly SheetGeometry[]> {
    if (request.sheets.length === 0) return [];

    const startedAt = Date.now();
    const parts = await this.evidenceParts(request);

    // Every sheet lost its picture. Asking for the geometry of a drawing off
    // its transcription would get an answer, and the answer would be invented.
    if (!parts.some(part => part.type === 'image_url')) {
      this.logger.warn('No sheet could be shown, so none was asked about', {
        type: request.spec.type.value,
        sheets: request.sheets.map(sheet => sheet.number.value),
      });

      return [];
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: geometryInstructions(request.spec) },
        { role: 'user', content: parts },
      ],
    });

    const raw = answerOf(this.model, completion).message?.content ?? '{}';
    const answered = this.parse(raw);
    const geometry = answered.flatMap(sheet => {
      const of = this.sheetOf(sheet.sheet, request, answered.length);

      if (of === null) return [];

      const read = sheetGeometryOf({
        pageNumber: of,
        rooms: (sheet.rooms ?? []).map(room => ({
          label: room.label ?? null,
          outline: room.outline ?? [],
          walls: room.walls ?? [],
        })),
        axes: (sheet.axes ?? []).map(axis => ({
          mark: axis.mark ?? null,
          from: axis.from ?? undefined,
          to: axis.to ?? undefined,
        })),
        chains: (sheet.chains ?? []).map(chain => ({
          from: chain.from ?? null,
          to: chain.to ?? null,
          printed: chain.printed ?? null,
          at: chain.at ?? [],
        })),
      });

      return read ? [read] : [];
    });

    this.logger.log('Geometry read off a drawing', {
      type: request.spec.type.value,
      asked: request.sheets.map(sheet => sheet.number.value),
      read: geometry.map(sheet => ({
        sheet: sheet.pageNumber.value,
        rooms: sheet.rooms.length,
        axes: sheet.axes.length,
      })),
      durationMs: Date.now() - startedAt,
      ...telemetryOf(completion),
    });

    return geometry;
  }

  /*
   * Which sheet of the file an answer is about, or null where nothing can say.
   *
   * A number the reader was shown is taken at its word: drawing geometry onto a
   * page it was not read off is the one failure that would be invisible and
   * wrong at the same time.
   *
   * A number it was NOT shown is usually the sheet number printed in the
   * drawing's own title block — the reference set's page 7 is "Vərəq 5" — and
   * where exactly one sheet was asked about and exactly one answered, there is
   * no other sheet it could be about. That case is taken, and said. Where
   * several were asked about, it is dropped: a wrong attribution among many is
   * a guess, and a guess here puts a room outline on somebody else's floor.
   */
  private sheetOf(
    answered: number,
    request: GeometryRequest,
    answers: number,
  ): number | null {
    const shown = request.sheets.map(sheet => sheet.number.value);

    if (shown.includes(answered)) return answered;

    if (shown.length === 1 && answers === 1) {
      this.logger.debug('The reader numbered the sheet as the drawing does', {
        answered,
        shown: shown[0],
      });

      return shown[0]!;
    }

    this.logger.warn('Geometry was answered for a sheet nobody was shown', {
      answered,
      shown,
    });

    return null;
  }

  private async evidenceParts(
    request: GeometryRequest,
  ): Promise<OpenAI.Chat.Completions.ChatCompletionContentPart[]> {
    const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    for (const sheet of request.sheets) {
      const url = await this.imageUrl(sheet.image);

      if (!url) continue;

      parts.push({
        type: 'text',
        text:
          `--- SHEET ${sheet.number.value} (transcription) ---\n` +
          sheet.text.value.slice(0, MAX_TEXT),
      });
      parts.push({ type: 'image_url', image_url: { url } });
    }

    return parts;
  }

  private async imageUrl(image: PageImage): Promise<string | null> {
    try {
      const object = await this.storage.getObject(image.storageKey);

      return `data:${image.contentType.value};base64,${Buffer.from(
        object.body,
      ).toString('base64')}`;
    } catch (error) {
      // Unlike the extractor, losing the picture loses the sheet: there is no
      // geometry in a transcription, so the sheet is simply not asked about.
      this.logger.warn('A sheet could not be shown to the geometry reader', {
        storageKey: image.storageKey.value,
        error,
      });

      return null;
    }
  }

  private parse(raw: string): readonly AnsweredSheet[] {
    const json = raw.match(/\{[\s\S]*\}/u)?.[0] ?? raw;

    try {
      const parsed = AnswerSchema.safeParse(JSON.parse(json));
      if (parsed.success) return parsed.data.sheets ?? [];
    } catch {
      // fall through to the warning below
    }

    this.logger.warn("Could not read the geometry reader's JSON", {
      answered: raw.slice(0, 200),
    });

    return [];
  }
}
