import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';

import { Logger } from '@cadastre/logger';

import {
  ObjectStorage,
  OcrProvider,
} from '../../../application/ports/outbound/index.js';
import {
  BLANK_PAGE,
  legibilityOf,
  readAsFarAsItGot,
} from '../../../domain/services/index.js';
import {
  Confidence,
  OcrResult,
  RecognisedText,
  type PageImage,
} from '../../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../../verification.module-defs.js';
import { MissingOpenRouterApiKeyException } from '../../exceptions/index.js';

import { answerOf } from './answered.js';
import { confidenceFromLogprobs } from './logprob-confidence.js';
import { telemetryOf } from './telemetry.js';

// A dense A4 sheet of an application form runs to a few thousand tokens once
// its table is written out; the default cap cuts such a page off mid-row, and a
// half-read page is worse than an unread one because nothing downstream can
// tell it was cut.
const MAX_OUTPUT_TOKENS = 8000;

// What a page is worth once the reader stopped reading it and started repeating
// itself. Below the floor, because the part it did read may be perfectly good
// and the inspector is the one who can say.
const RUNAWAY_CEILING = 0.5;

// Written as a job description rather than as an order, because the first
// version of this prompt ("You are an OCR engine. Transcribe ALL text…") was
// read by more than one model as a request to copy out an identity card for no
// stated reason, and answered with 54 characters and a truncation. The pages
// are what an applicant handed to a registry over the counter, and the reader
// on the other end is the official processing them; saying so is both true and
// what makes the page readable.
const OCR_PROMPT = [
  'You are the transcription stage of the document-verification system used by',
  'inspectors at the Azerbaijani State Register of Immovable Property. Each',
  'image is one sheet of a document package an applicant submitted to that',
  'authority to register their property. The inspector reviews these sheets by',
  'hand; your transcription is what they read them through.',
  '',
  'Transcribe every mark on the sheet, in reading order, preserving line breaks.',
  '',
  'Use these conventions exactly — later stages parse them:',
  '- Tables: reproduce as a markdown table, one row per printed row, empty cells',
  '  left empty. A form is a table: keep each label beside what was written in it.',
  `- Handwritten text: wrap it as [hw: ...] — including handwriting filling in a`,
  '  printed form. The inspector needs to know which values are handwritten.',
  '- Marks: [stamp: <text you can read, or "illegible">], [signature], [photo],',
  '  [qr], [barcode]. Whether a sheet is signed and stamped is a finding of its own.',
  '- A reading you are unsure of: wrap that fragment as <?text>. Use it freely;',
  '  a marked doubt is worth more than a confident guess.',
  `- A sheet with nothing on it: output exactly ${BLANK_PAGE} and nothing else.`,
  '- Technical drawings: transcribe the title block, every dimension and level',
  '  figure, and every schedule or explication table in full. Transcribe the text',
  '  on the drawing; do not describe the drawing.',
  '',
  'Rules:',
  '- Transcribe, never translate. Azerbaijani (Latin or Cyrillic), Russian and',
  '  English each stay in the script they are printed in, with their diacritics.',
  '- Never summarise, and never skip a region because it looks like boilerplate.',
  '- Output the transcription only — no commentary, no code fences.',
].join('\n');

// A dense sheet at 300 dpi takes a reader a minute; three is generous and
// still an answer, rather than a wait, on the pages it will never return.
const OCR_TIMEOUT_MS = 180_000;

@Injectable()
export class OpenRouterOcrAdapter extends OcrProvider {
  private readonly logger: Logger;
  private readonly client: OpenAI;
  private readonly model: string;
  override readonly pagesAtOnce: number;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    const openrouter = options.openrouter;
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException('OCR_PROVIDER');
    }
    const ocr = options.ocr;
    this.model = ocr.model;
    this.pagesAtOnce = ocr.concurrency;
    // The model is on every line this adapter writes: half of what makes a
    // transcription surprising is which model produced it.
    this.logger = logger.child({
      scope: OpenRouterOcrAdapter.name,
      model: ocr.model,
    });
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      // A page the provider never answers about must not hold the pipeline
      // open: without these the SDK waits ten minutes and then retries twice,
      // so one stuck sheet can cost half an hour of a run that has already read
      // everything else. The per-sheet retry in the use case does the asking
      // again; this only bounds one ask.
      timeout: OCR_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async recognise(image: PageImage): Promise<OcrResult> {
    const startedAt = Date.now();
    const object = await this.storage.getObject(image.storageKey);
    const mime = image.contentType.value;
    const dataUrl = `data:${mime};base64,${Buffer.from(object.body).toString('base64')}`;

    this.logger.debug('Asking for a transcription', {
      storageKey: image.storageKey.value,
      contentType: mime,
      bytes: object.body.byteLength,
    });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const answered = answerOf(this.model, completion).message?.content ?? '';
    const { text, looped } = readAsFarAsItGot(answered);
    const durationMs = Date.now() - startedAt;

    if (text.length === 0) {
      // Recorded as illegible and carried into the report, so this is the only
      // place that says whether the sheet was blank or the reader refused it.
      this.logger.warn('The reader returned nothing for this sheet', {
        storageKey: image.storageKey.value,
        answeredCharacters: answered.length,
        durationMs,
        ...telemetryOf(completion),
      });

      return OcrResult.illegible();
    }

    // Three readings of the same page, and the page is only as certain as the
    // least of them: the route's own token certainties, where the route reports
    // any worth having; the share of the page the model did not mark as
    // doubtful; and, if the model ran away repeating itself, a ceiling that
    // takes the score away from it. Each alone can flatter — a model can be
    // fluently wrong, a route can report nothing, and a loop scores highest of
    // all — so the pessimistic one is the one recorded.
    const scored = confidenceFromLogprobs(completion);
    const legible = legibilityOf(text);
    const confidence = Math.min(
      scored ?? 1,
      legible,
      looped ? RUNAWAY_CEILING : 1,
    );

    this.logger.log('Sheet transcribed', {
      storageKey: image.storageKey.value,
      characters: text.length,
      confidence: round(confidence),
      // The three readings the confidence was taken as the least of, kept
      // apart: which one capped it is the whole diagnosis.
      logprobs: scored === null ? null : round(scored),
      legibility: round(legible),
      ranAway: looped,
      durationMs,
      ...telemetryOf(completion),
    });

    return OcrResult.of(RecognisedText.of(text), Confidence.of(confidence));
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
