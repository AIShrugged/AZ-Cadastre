import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';

import {
  DocumentClassifier,
  type ClassificationRequest,
} from '../../application/ports/outbound/index.js';
import {
  Classification,
  Confidence,
  DocumentType,
  type DocumentTypeSpec,
} from '../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../verification.module-defs.js';
import { MissingOpenRouterApiKeyException } from '../exceptions/index.js';

import { answerOf } from './answered.js';
import { confidenceFromLogprobs } from './logprob-confidence.js';

const MAX_TEXT = 8000;

const AnswerSchema = z.object({
  type: z.string(),
  confidence: z.number().min(0).max(1).nullish(),
  reason: z.string().nullish(),
});

// One document's text and one short answer.
const CLASSIFICATION_TIMEOUT_MS = 90_000;

@Injectable()
export class OpenRouterClassifierAdapter extends DocumentClassifier {
  private readonly logger = new Logger(OpenRouterClassifierAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
  ) {
    super();
    const openrouter = options.openrouter;
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException('CLASSIFIER_PROVIDER');
    }
    this.model = options.classifier.model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      // A page the provider never answers about must not hold the pipeline
      // open: without these the SDK waits ten minutes and then retries twice,
      // so one stuck sheet can cost half an hour of a run that has already read
      // everything else. The per-sheet retry in the use case does the asking
      // again; this only bounds one ask.
      timeout: CLASSIFICATION_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async classify(request: ClassificationRequest): Promise<Classification> {
    const text = request.text.value.slice(0, MAX_TEXT);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.instructions(request.candidates) },
        { role: 'user', content: text },
      ],
    });

    const raw = answerOf(this.model, completion).message?.content?.trim() ?? '';
    const answer = this.parse(raw);
    const allowed = [
      ...request.candidates.map(candidate => candidate.type),
      DocumentType.OUT_OF_PROFILE,
      DocumentType.UNKNOWN,
    ];
    const type = this.match(answer?.type ?? raw, allowed);

    // The route's certainty about the tokens it wrote, and the model's own
    // account of how sure it is, are different things and both can flatter. The
    // lower of the two is what an inspector is told; where neither is on offer
    // the reading is recorded as unscored rather than as a number invented here,
    // which is what the old nominal 0.9 amounted to.
    const scored = confidenceFromLogprobs(completion);
    const stated = answer?.confidence ?? null;
    const confidence = leastOf(scored, stated);

    this.logger.log(
      `Classified as "${type.value}" ` +
        `(model said "${answer?.type ?? raw.slice(0, 40)}"` +
        `${answer?.reason ? `: ${answer.reason.slice(0, 80)}` : ''}, ` +
        `confidence ${confidence.toFixed(3)} — logprobs ` +
        `${scored === null ? 'unavailable' : scored.toFixed(3)}, stated ` +
        `${stated === null ? 'none' : stated.toFixed(3)})`,
    );

    return Classification.of(type, Confidence.of(confidence));
  }

  private instructions(candidates: readonly DocumentTypeSpec[]): string {
    return [
      'You classify one scanned document submitted to the Azerbaijani real',
      'estate registration authority. You are given its transcribed text — one',
      'document, though it may run over several sheets.',
      '',
      'The text is usually Azerbaijani (Latin script), sometimes Azerbaijani in',
      'Cyrillic script, sometimes Russian or English, and often a mix.',
      'Transcription is imperfect: headings may be misspelled, diacritics',
      'dropped (ə→e, ı→i, ş→s) and letters confused. Handwriting is marked',
      '[hw: ...], stamps [stamp: ...], doubtful readings <?like this>, and a',
      'blank sheet [blank page]. Judge by what the document evidently IS, not by',
      'an exact string match.',
      '',
      'Choose exactly one type key:',
      '',
      ...candidates.map(candidate => this.describe(candidate)),
      '',
      `- ${DocumentType.OUT_OF_PROFILE.value}`,
      '  You can tell what this document is, and it is none of the above. The',
      "  registry's own service sheets (dövriyyə vərəqi, ekspertiza vərəqi), a",
      '  courier waybill, a covering letter, a valuation contract, a document',
      '  belonging to another matter entirely. The package is expected to carry',
      '  such documents; saying so is a correct answer, not a failure.',
      '',
      `- ${DocumentType.UNKNOWN.value}`,
      '  You cannot tell what it is: the text is too damaged, too sparse, or',
      '  says nothing about what record it belongs to. Prefer this over a guess',
      '  you are not reasonably sure of — a wrong type is worse for the',
      "  inspector than an honest 'unknown'. Do NOT use it merely because the",
      `  document is not in the profile; that is ${DocumentType.OUT_OF_PROFILE.value}.`,
      '',
      'Weigh the whole document, above all its heading and its issuing body.',
      'A type mentioned in passing — a licence number quoted on an application —',
      'does not make the document that type. Annexes, licences and drawing sets',
      'belong to the document they were issued for.',
      '',
      // The word "JSON" is load-bearing: OpenAI refuses `response_format:
      // json_object` outright — 400, no completion — unless the conversation
      // says it somewhere.
      'Reply with ONLY this JSON object:',
      '{"type":"<key>","confidence":<0..1, how sure you are of that key>,',
      '"reason":"<up to 12 words>"}',
    ].join('\n');
  }

  private describe(candidate: DocumentTypeSpec): string {
    const headings = candidate.hints.map(hint => `"${hint}"`).join(', ');

    return [
      `- ${candidate.type.value}`,
      `  ${candidate.description}`,
      `  Usually headed: ${headings}.`,
    ].join('\n');
  }

  private parse(raw: string): z.infer<typeof AnswerSchema> | null {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;

    try {
      const parsed = AnswerSchema.safeParse(JSON.parse(json));
      if (parsed.success) return parsed.data;
    } catch {
      // A model that answered with a bare key rather than an object is still
      // answering; `match` reads the key straight out of the raw text.
    }

    this.logger.warn(`Could not read classifier JSON: ${raw.slice(0, 120)}`);
    return null;
  }

  private match(raw: string, allowed: readonly DocumentType[]): DocumentType {
    const answer = raw.toLowerCase();
    const exact = allowed.find(type => type.value === answer);
    if (exact) return exact;
    // The longest key contained in the answer, so "license_annex" is not read
    // as "license" when the model wrapped its choice in a sentence.
    const contained = allowed
      .filter(type => answer.includes(type.value))
      .sort((left, right) => right.value.length - left.value.length);

    return contained[0] ?? DocumentType.UNKNOWN;
  }
}

// Two accounts of the same certainty: take the lower, and take nothing as
// nothing — a reading no one scored is recorded at zero, which puts it below
// the floor and in front of the inspector.
function leastOf(left: number | null, right: number | null): number {
  const offered = [left, right].filter(
    (value): value is number => value !== null,
  );

  return offered.length === 0 ? 0 : Math.min(...offered);
}
