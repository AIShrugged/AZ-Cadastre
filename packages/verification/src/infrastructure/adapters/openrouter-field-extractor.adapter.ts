import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';

import { DomainException } from '@cadastre/shared';

import {
  FieldExtractor,
  ObjectStorage,
  type ExtractionRequest,
  type ExtractionSheet,
} from '../../application/ports/outbound/index.js';
import { ExtractedField } from '../../domain/entities/index.js';
import {
  Confidence,
  FieldValue,
  PageNumber,
  type DocumentTypeSpec,
} from '../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../verification.module-defs.js';
import { MissingOpenRouterApiKeyException } from '../exceptions/index.js';

import { answerOf } from './answered.js';
import { quotedIn } from './evidence.js';
import { confidenceFromLogprobs } from './logprob-confidence.js';

const MAX_TEXT = 12000;

// A drawing set runs to nine sheets and the values a schema asks for sit on the
// first of them; sending every sheet as an image would multiply the cost of the
// stage for pages that answer nothing. The transcript of every sheet always
// travels, so nothing is hidden from the model — only the pictures are rationed.
const MAX_SHEET_IMAGES = 6;

// A value the model could not quote back out of the transcript is not therefore
// wrong: it may have read it off the scan, which is the point of sending the
// scan. It is unverified, though, and an unverified reading belongs in front of
// the inspector rather than in the register as a fact — so it is capped below
// the confidence floor whatever the model says about it.
const UNVERIFIED_CEILING = 0.6;

const AnswerSchema = z.object({
  fields: z.record(
    z.string(),
    z
      .object({
        value: z.string().nullish(),
        sheet: z.number().nullish(),
        evidence: z.string().nullish(),
        confidence: z.number().min(0).max(1).nullish(),
      })
      .nullable(),
  ),
});

// The heaviest call the pipeline makes — a document's sheets as pictures as
// well as text — so it is given room, and a bound.
const EXTRACTION_TIMEOUT_MS = 180_000;

@Injectable()
export class OpenRouterFieldExtractorAdapter extends FieldExtractor {
  private readonly logger = new Logger(OpenRouterFieldExtractorAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    private readonly storage: ObjectStorage,
  ) {
    super();
    const openrouter = options.openrouter;
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException('EXTRACTOR_PROVIDER');
    }
    this.model = options.extractor.model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      // A page the provider never answers about must not hold the pipeline
      // open: without these the SDK waits ten minutes and then retries twice,
      // so one stuck sheet can cost half an hour of a run that has already read
      // everything else. The per-sheet retry in the use case does the asking
      // again; this only bounds one ask.
      timeout: EXTRACTION_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    const specs = request.spec.schema.specs;
    const transcript = request.text.value.slice(0, MAX_TEXT);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.instructions(request.spec) },
        { role: 'user', content: await this.evidenceParts(request) },
      ],
    });

    const raw = answerOf(this.model, completion).message?.content ?? '{}';
    const answered = this.parse(raw);
    const scored = confidenceFromLogprobs(completion);

    const first = request.sheets[0]?.number ?? PageNumber.first();
    const read = new Map(
      request.sheets.map(sheet => [sheet.number.value, sheet.read.value]),
    );

    const fields: ExtractedField[] = [];
    let unverified = 0;

    for (const spec of specs) {
      const answer = answered[spec.key.value];
      const value = answer?.value?.trim();
      if (!answer || !value) continue;

      // Where the model says it read the value, but only if that is a sheet
      // this document actually occupies: a page reference the inspector cannot
      // turn to is worse than the document's own first sheet.
      const claimed = answer.sheet ?? null;
      const found =
        claimed !== null && read.has(claimed) ? PageNumber.of(claimed) : first;

      // The cheap hallucination check that pays for itself: the model has to
      // quote the transcript, and a quote that is not in the transcript does
      // not stand as evidence for the value it was offered for.
      const quoted = quotedIn(transcript, answer.evidence ?? '');
      if (!quoted) unverified += 1;

      // A value is never surer than the reading it was taken from. The identity
      // card is the case in point: the sheet came back at 0.68 and the model
      // then reported its card number at 0.90 — and got a digit wrong. The page
      // knew; nothing was asking it.
      const sheetRead = read.get(found.value) ?? 0;
      const stated = answer.confidence ?? null;
      const confidence = Math.min(
        sheetRead,
        quoted
          ? leastOf(scored, stated)
          : Math.min(UNVERIFIED_CEILING, leastOf(scored, stated)),
      );

      try {
        fields.push(
          ExtractedField.of(
            spec.key,
            FieldValue.create(value),
            Confidence.of(confidence),
            found,
          ),
        );
      } catch (error) {
        // A model answer the domain refuses costs its own field, not the whole
        // extraction. Anything else is a fault of ours and travels on.
        if (!(error instanceof DomainException)) throw error;

        this.logger.warn(
          `Dropped field "${spec.key.value}": ${error.code} (${error.message})`,
        );
      }
    }

    this.logger.log(
      `Extracted ${fields.length}/${specs.length} fields from ` +
        `${request.spec.type.value} (${unverified} unquoted, logprobs ` +
        `${scored === null ? 'unavailable' : scored.toFixed(3)})`,
    );

    return fields;
  }

  // The sheets themselves, interleaved with their readings, so the model can
  // check one against the other. The transcription of a faint identity card
  // loses the card number the scan still shows; the scan of a drawing says
  // nothing the title block does not spell out.
  private async evidenceParts(
    request: ExtractionRequest,
  ): Promise<OpenAI.Chat.Completions.ChatCompletionContentPart[]> {
    const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    let images = 0;

    for (const sheet of request.sheets) {
      parts.push({
        type: 'text',
        text:
          `--- SHEET ${sheet.number.value} (transcription) ---\n` +
          sheet.text.value.slice(0, MAX_TEXT),
      });

      if (images >= MAX_SHEET_IMAGES) continue;

      const url = await this.imageUrl(sheet);
      if (!url) continue;

      parts.push({ type: 'image_url', image_url: { url } });
      images += 1;
    }

    return parts;
  }

  private async imageUrl(sheet: ExtractionSheet): Promise<string | null> {
    try {
      const object = await this.storage.getObject(sheet.image.storageKey);
      const base64 = Buffer.from(object.body).toString('base64');

      return `data:${sheet.image.contentType.value};base64,${base64}`;
    } catch (error) {
      // The reading of the sheet is already in the prompt; losing its picture
      // costs accuracy on that sheet, not the extraction.
      this.logger.warn(
        `Sheet ${sheet.number.value}: could not be attached — ${String(error)}`,
      );

      return null;
    }
  }

  private instructions(spec: DocumentTypeSpec): string {
    const schema = spec.schema.specs
      .map(field => `- ${field.key.value}: ${field.label}`)
      .join('\n');

    return [
      'You read structured values off one scanned document submitted to the',
      'Azerbaijani real estate registration authority. The applicant handed it',
      'in over the counter; an inspector is checking the values you return',
      'against the sheets themselves.',
      '',
      `The document is a ${spec.type.value}. ${spec.description}`,
      '',
      'You are given each of its sheets twice: as a transcription and as the',
      'scan the transcription was made from. Where they disagree, the scan is',
      'the document and the transcription is one reading of it. Transcription',
      'marks: [hw: ...] handwritten, [stamp: ...] a stamp, <?text> a doubtful',
      'reading, [blank page] an empty sheet.',
      '',
      'Its text is usually Azerbaijani (Latin or Cyrillic script), sometimes',
      'Russian or English.',
      '',
      'Return JSON. For each key below give an object, or null when the document',
      'does not carry that value. Use ONLY these keys:',
      schema,
      '',
      'Shape: {"fields":{"<key>":{"value":"<as printed>","sheet":<the sheet',
      'number you read it on>,"evidence":"<a short literal quote from that',
      'sheet\'s transcription containing the value>","confidence":<0..1>}}}',
      '',
      'Rules:',
      '- Transcribe values exactly as printed, in their own script. Do not',
      '  translate, transliterate or expand names and addresses.',
      '- Give a name in its base form. Azerbaijani prints names in oblique cases',
      '  on forms — "Əliyeva Rübabə Kavı qızına" is the same name as "Əliyeva',
      '  Rübabə Kavı qızı"; return the base form, without the case ending.',
      '- Write every date as DD.MM.YYYY, whatever form it appears in. Never',
      '  adjust a year to make it look plausible: copy the year that is printed.',
      '- A surname printed in capitals stays in capitals.',
      '- Give the value alone, without its printed label.',
      "- `evidence` must be text that actually appears in that sheet's",
      '  transcription. If you read the value off the scan and the transcription',
      '  does not contain it, give the nearest text that does appear, or an',
      '  empty string — never invent a quote.',
      '- `confidence` is your own: how sure you are of this value, on this',
      '  document. Say 0.3 when you are guessing at faint handwriting.',
      '- Never infer, compute or invent a value that is not on the document.',
      '  A null is worth more to the inspector than a plausible guess: they',
      '  check the ones we return.',
    ].join('\n');
  }

  private parse(
    raw: string,
  ): Record<string, z.infer<typeof AnswerSchema>['fields'][string]> {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;

    try {
      const parsed = AnswerSchema.safeParse(JSON.parse(json));
      if (parsed.success) return parsed.data.fields;
    } catch {
      // fall through to the warning below
    }

    this.logger.warn(`Could not parse extractor JSON: ${raw.slice(0, 160)}`);
    return {};
  }
}

function leastOf(left: number | null, right: number | null): number {
  const offered = [left, right].filter(
    (value): value is number => value !== null,
  );

  return offered.length === 0 ? 0 : Math.min(...offered);
}
